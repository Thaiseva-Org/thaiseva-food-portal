const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");
const path = require("node:path");

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fixture() {
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours ahead
  const records = new Map([
    [
      "restaurants/owner-a",
      {
        id: "REST-A",
        name: "Restaurant A",
        ownerId: "owner-a",
        status: "Verified",
        active: true,
        serviceType: "Both",
      },
    ],
    [
      "restaurants/owner-delivery-only",
      {
        id: "REST-D",
        name: "Delivery Only",
        ownerId: "owner-delivery-only",
        status: "Verified",
        active: true,
        serviceType: "Delivery",
      },
    ],
  ]);
  const auditLogs = [];

  const snap = (p) => ({
    exists: records.has(p),
    data: () => records.get(p),
    id: p ? p.split("/").at(-1) : "",
    ref: { path: p },
  });

  const queryMock = (collectionName) => {
    let filters = [];
    let queryLimit = 100;
    const q = {
      where: (field, op, val) => {
        filters.push({ field, op, val });
        return q;
      },
      limit: (n) => {
        queryLimit = n;
        return q;
      },
      orderBy: () => q,
      get: async () => {
        let matched = [];
        for (const [key, val] of records.entries()) {
          if (key.startsWith(`${collectionName}/`)) {
            let pass = true;
            for (const f of filters) {
              if (f.op === "==" && val[f.field] !== f.val) pass = false;
            }
            if (pass) {
              matched.push(snap(key));
            }
          }
        }
        return {
          docs: matched.slice(0, queryLimit),
          empty: matched.length === 0,
          size: Math.min(matched.length, queryLimit),
        };
      },
    };
    return q;
  };

  const ref = (p) => {
    return {
      path: p,
      id: p ? p.split("/").at(-1) : "",
      collection: (name) => ref(`${p}/${name}`),
      doc: (id) => {
        const docId = id || `book_${Math.random().toString(36).slice(2, 10)}`;
        return ref(`${p}/${docId}`);
      },
      get: async () => snap(p),
      set: async (data, opts = {}) => {
        if (opts.merge && records.has(p)) {
          records.set(p, { ...records.get(p), ...data });
        } else {
          records.set(p, data);
        }
      },
      update: async (data) => {
        if (!records.has(p)) throw new HttpsError("not-found", "Not found");
        records.set(p, { ...records.get(p), ...data });
      },
      where: (field, op, val) => queryMock(p).where(field, op, val),
    };
  };

  const db = {
    collection: (name) => {
      const r = ref(name);
      return {
        ...r,
        where: (field, op, val) => queryMock(name).where(field, op, val),
      };
    },
    runTransaction: async (fn) => {
      const updates = [];
      const tx = {
        get: async (target) => {
          if (target && typeof target.get === "function") return target.get();
          return snap(target?.path);
        },
        set: (r, data) => updates.push(() => records.set(r.path, data)),
        update: (r, data) => {
          if (!records.has(r.path)) throw new HttpsError("not-found", "Not found");
          updates.push(() => records.set(r.path, { ...records.get(r.path), ...data }));
        },
      };
      const result = await fn(tx);
      updates.forEach((u) => u());
      return result;
    },
  };

  const deps = {
    "node:crypto": require("node:crypto"),
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": {
      getFirestore: () => db,
      FieldValue: {
        serverTimestamp: () => "server-time",
        increment: (n) => ({ increment: n }),
        arrayUnion: (...items) => items,
      },
    },
    "./audit": {
      writeAuditLogTx: (tx, db, entry) => auditLogs.push(entry),
    },
    "./auth": {
      ROLES: { MASTER: "masterAdmin", OWNER: "restaurantOwner", CUSTOMER: "customer" },
      assertTenantAccess: (caller, ownerId) => {
        if (caller.role === "masterAdmin") return;
        if (caller.role === "restaurantOwner" && caller.uid === ownerId) return;
        throw new HttpsError("permission-denied", "Tenant denied");
      },
    },
  };

  const context = {
    module: { exports: {} },
    require: (dep) => {
      if (deps[dep]) return deps[dep];
      throw new Error(`Missing dependency ${dep}`);
    },
    console,
  };

  vm.runInNewContext(
    readFileSync(path.join(__dirname, "../functions/src/lib/bookings.js"), "utf8"),
    context
  );

  return {
    bookingsLib: context.module.exports,
    records,
    futureDate,
  };
}

const customer1 = { uid: "cust-1", role: "customer" };
const customer2 = { uid: "cust-2", role: "customer" };
const ownerA = { uid: "owner-a", role: "restaurantOwner" };
const ownerB = { uid: "owner-b", role: "restaurantOwner" };
const master = { uid: "master-1", role: "masterAdmin" };

test("tableReservations: creation validations and restaurant eligibility", async () => {
  const f = fixture();
  const { bookingsLib, futureDate } = f;

  // 1. Successful booking
  const res = await bookingsLib.createDineInBooking(customer1, {
    ownerId: "owner-a",
    customerName: "John Guest",
    phoneNumber: "0819876543",
    adults: 2,
    children: 1,
    scheduledAt: futureDate,
    notes: "Quiet corner table please",
  });
  assert.ok(res.booking.bookingId);
  assert.equal(res.booking.status, "Pending");

  const stored = f.records.get(`dineInBookings/${res.booking.bookingId}`);
  assert.ok(stored);
  assert.equal(stored.customerName, "John Guest");
  assert.equal(stored.adults, 2);
  assert.equal(stored.children, 1);
  assert.equal(stored.ownerId, "owner-a");

  // 2. Reject delivery-only restaurant
  await assert.rejects(
    bookingsLib.createDineInBooking(customer1, {
      ownerId: "owner-delivery-only",
      customerName: "John Guest",
      phoneNumber: "0819876543",
      adults: 2,
      scheduledAt: futureDate,
    }),
    { code: "failed-precondition" }
  );

  // 3. Reject invalid party size (0 adults)
  await assert.rejects(
    bookingsLib.createDineInBooking(customer1, {
      ownerId: "owner-a",
      customerName: "John Guest",
      phoneNumber: "0819876543",
      adults: 0,
      scheduledAt: futureDate,
    }),
    { code: "invalid-argument" }
  );

  // 4. Reject past or immediate date (< 15 mins)
  const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
  await assert.rejects(
    bookingsLib.createDineInBooking(customer1, {
      ownerId: "owner-a",
      customerName: "John Guest",
      phoneNumber: "0819876543",
      adults: 2,
      scheduledAt: pastDate,
    }),
    { code: "failed-precondition" }
  );
});

test("tableReservations: customer updates and cancellation", async () => {
  const f = fixture();
  const { bookingsLib, futureDate } = f;

  // Create booking
  const created = await bookingsLib.createDineInBooking(customer1, {
    ownerId: "owner-a",
    customerName: "Alice Guest",
    phoneNumber: "0819998888",
    adults: 3,
    scheduledAt: futureDate,
    notes: "High chair needed",
  });
  const bookingId = created.booking.bookingId;

  // Update pending booking
  const updated = await bookingsLib.updateDineInBooking(customer1, {
    bookingId,
    adults: 4,
    notes: "High chair and window view",
  });
  assert.equal(updated.booking.adults, 4);
  assert.equal(updated.booking.notes, "High chair and window view");

  // Customer 2 cannot update Customer 1's booking
  await assert.rejects(
    bookingsLib.updateDineInBooking(customer2, {
      bookingId,
      adults: 5,
    }),
    { code: "permission-denied" }
  );

  // Customer cancels booking
  const cancelled = await bookingsLib.cancelDineInBooking(customer1, {
    bookingId,
    reason: "Plans changed",
  });
  assert.equal(cancelled.status, "Canceled");
  assert.equal(f.records.get(`dineInBookings/${bookingId}`).status, "Canceled");

  // Cannot update already canceled booking
  await assert.rejects(
    bookingsLib.updateDineInBooking(customer1, {
      bookingId,
      adults: 2,
    }),
    { code: "failed-precondition" }
  );
});

test("tableReservations: restaurant owner / master status transitions and tenant protection", async () => {
  const f = fixture();
  const { bookingsLib, futureDate } = f;

  // Create booking
  const created = await bookingsLib.createDineInBooking(customer1, {
    ownerId: "owner-a",
    customerName: "Bob Guest",
    phoneNumber: "0817776666",
    adults: 2,
    scheduledAt: futureDate,
  });
  const bookingId = created.booking.bookingId;

  // Owner B cannot accept Restaurant A's booking
  await assert.rejects(
    bookingsLib.setDineInBookingStatus(ownerB, {
      bookingId,
      status: "Accepted",
    }),
    { code: "permission-denied" }
  );

  // Owner A accepts the booking
  const acceptRes = await bookingsLib.setDineInBookingStatus(ownerA, {
    bookingId,
    status: "Accepted",
  });
  assert.equal(acceptRes.status, "Accepted");
  assert.equal(f.records.get(`dineInBookings/${bookingId}`).status, "Accepted");

  // Master admin cancels the accepted booking
  const cancelRes = await bookingsLib.setDineInBookingStatus(master, {
    bookingId,
    status: "Canceled",
  });
  assert.equal(cancelRes.status, "Canceled");

  // Cannot revive canceled booking to Accepted
  await assert.rejects(
    bookingsLib.setDineInBookingStatus(ownerA, {
      bookingId,
      status: "Accepted",
    }),
    { code: "failed-precondition" }
  );

  // Single booking read access: customer 1 allowed, customer 2 denied
  const readRes = await bookingsLib.getDineInBooking(customer1, { bookingId });
  assert.equal(readRes.booking.bookingId, bookingId);

  await assert.rejects(
    bookingsLib.getDineInBooking(customer2, { bookingId }),
    { code: "permission-denied" }
  );
});
