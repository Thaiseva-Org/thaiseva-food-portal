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

function fixture({signingDenied = false} = {}) {
  const records = new Map();
  const authUsers = new Map();
  const claimsLog = [];
  const auditLogs = [];
  const deletedUsers = [];
  const deletedStoragePrefixes = [];
  const savedFiles = [];

  const snap = (p) => ({
    exists: records.has(p),
    data: () => records.get(p),
    id: p ? p.split("/").at(-1) : "",
    ref: { path: p },
  });

  const queryMock = (collectionName) => {
    let filters = [];
    const q = {
      where: (field, op, val) => {
        filters.push({ field, op, val });
        return q;
      },
      limit: () => q,
      get: async () => {
        let matched = [];
        for (const [key, val] of records.entries()) {
          if (key.startsWith(`${collectionName}/`)) {
            let pass = true;
            for (const f of filters) {
              if (f.op === "==" && f.field.split(".").reduce((value, part) => value?.[part], val) !== f.val) pass = false;
            }
            if (pass) {
              matched.push(snap(key));
            }
          }
        }
        return { docs: matched, empty: matched.length === 0 };
      },
    };
    return q;
  };

  const ref = (p) => {
    return {
      path: p,
      id: p ? p.split("/").at(-1) : "",
      collection: (name) => ref(`${p}/${name}`),
      doc: (id) => ref(`${p}/${id || `id_${Math.random().toString(36).slice(2, 8)}`}`),
      add: async (data) => {
        const id = `id_${Math.random().toString(36).slice(2, 8)}`;
        records.set(`${p}/${id}`, data);
        return ref(`${p}/${id}`);
      },
      get: async () => snap(p),
      set: async (data, opts = {}) => {
        if (opts.merge && records.has(p)) {
          const old = records.get(p);
          records.set(p, { ...old, ...data });
        } else {
          records.set(p, data);
        }
      },
      update: async (data) => {
        if (!records.has(p)) {
          throw new HttpsError("not-found", `Document ${p} not found.`);
        }
        records.set(p, { ...records.get(p), ...data });
      },
      where: (field, op, val) => queryMock(p).where(field, op, val),
    };
  };

  const db = {
    recursiveDelete: async (target) => {
      for (const key of [...records.keys()]) {
        if (key === target.path || key.startsWith(`${target.path}/`)) records.delete(key);
      }
    },
    collection: (name) => {
      const r = ref(name);
      return {
        ...r,
        where: (field, op, val) => queryMock(name).where(field, op, val),
      };
    },
    runTransaction: async (fn) => {
      return fn({
        get: async (target) => {
          if (target && typeof target.get === "function") {
            return target.get();
          }
          return snap(target?.path);
        },
        set: (r, data) => records.set(r.path, data),
        update: (r, data) => {
          if (!records.has(r.path)) throw new HttpsError("not-found", "Not found");
          records.set(r.path, { ...records.get(r.path), ...data });
        },
      });
    },
  };

  const authMock = {
    getUserByEmail: async (email) => {
      if (authUsers.has(email)) {
        return authUsers.get(email);
      }
      const err = new Error("User not found");
      err.code = "auth/user-not-found";
      throw err;
    },
    createUser: async ({ email, displayName }) => {
      if (authUsers.has(email)) {
        const err = new Error("Email already exists");
        err.code = "auth/email-already-exists";
        throw err;
      }
      const user = { uid: `uid_${Math.random().toString(36).slice(2, 8)}`, email, displayName };
      authUsers.set(email, user);
      return user;
    },
    deleteUser: async (uid) => {
      deletedUsers.push(uid);
    },
    setCustomUserClaims: async (uid, claims) => {
      claimsLog.push({ uid, claims });
    },
  };

  const deps = {
    "./privateFiles": require("../functions/src/lib/privateFiles"),
    "./emailVerification": require("../functions/src/lib/emailVerification"),
    "node:crypto": require("node:crypto"),
    "firebase-functions/v2/https": { HttpsError },
    "firebase-admin/firestore": {
      getFirestore: () => db,
      FieldValue: {
        serverTimestamp: () => "server-time",
        increment: (n) => ({ increment: n }),
        arrayUnion: (...items) => items,
      },
      Timestamp: {
        now: () => "ts-now",
      },
    },
    "firebase-admin/auth": {
      getAuth: () => authMock,
    },
    "firebase-admin/storage": {
      getStorage: () => {
        const bucket = {
          name: "gothai-bucket",
          deleteFiles: async ({ prefix }) => deletedStoragePrefixes.push(prefix),
          file: (f) => ({
            name: f,
            getSignedUrl: async () => {
              if (signingDenied) throw Object.assign(new Error("Permission denied: signBlob"), {code: 403});
              return [`https://storage.signed.url/${f}`];
            },
            getMetadata: async () => [{size: "14", contentType: "application/pdf"}],
            download: async () => [Buffer.from("%PDF-synthetic")],
            save: async (bytes, options) => { savedFiles.push({path: f, bytes, options}); },
            exists: async () => [true],
            copy: async () => {},
            makePublic: async () => {},
          }),
        };
        return { bucket: () => bucket };
      },
    },
    "./audit": {
      writeAuditLog: async (entry) => auditLogs.push(entry),
      writeAuditLogTx: (tx, db, entry) => auditLogs.push(entry),
    },
    "./auth": {
      ROLES: { MASTER: "masterAdmin", OWNER: "restaurantOwner" },
      requireMaster: (caller) => {
        if (caller?.role !== "masterAdmin") {
          throw new HttpsError("permission-denied", "Master admin required");
        }
      },
      setUserClaims: async (uid, claims) => {
        claimsLog.push({ uid, claims });
      },
    },
    "./restaurants": {
      cleanText: (val, field, max) => {
        const text = String(val || "").trim();
        if (!text || text.length > max) {
          throw new HttpsError("invalid-argument", `${field} invalid`);
        }
        return text;
      },
      cleanImageUrl: (url) => {
        if (!url || !/^https:\/\//i.test(url)) {
          throw new HttpsError("invalid-argument", "Invalid image URL");
        }
        return url;
      },
      DEFAULT_COMMISSION_PCT: 10,
    },
  };

  const load = (name) => {
    const context = {
      module: { exports: {} },
      require: (dep) => {
        if (deps[dep]) return deps[dep];
        throw new Error(`Missing dependency ${dep}`);
      },
      console,
      Buffer,
    };
    vm.runInNewContext(
      readFileSync(path.join(__dirname, `../functions/src/lib/${name}.js`), "utf8"),
      context
    );
    return context.module.exports;
  };

  return {
    restaurantsLib: load("restaurants"),
    ridersLib: load("riders"),
    appsLib: load("applications"),
    chatsLib: load("customerChats"),
    records,
    authUsers,
    claimsLog,
    auditLogs,
    deletedUsers,
    deletedStoragePrefixes,
    savedFiles,
  };
}

const master = { uid: "master-1", role: "masterAdmin" };
const owner = { uid: "owner-1", role: "restaurantOwner" };
const customer = { uid: "cust-1", role: "customer" };

test("private previews remain authorized when the service account cannot sign URLs", async () => {
  const f = fixture({signingDenied: true});
  const path = "restaurants/owner-1/documents/license/proof.pdf";
  const result = await f.appsLib.getApplicationFileUrl(owner, {path});
  assert.equal(result.contentBase64, Buffer.from("%PDF-synthetic").toString("base64"));
  assert.equal(result.url, undefined);
  await assert.rejects(f.appsLib.getApplicationFileUrl(customer, {path}), {code: "permission-denied"});
  await assert.rejects(f.appsLib.getApplicationFileUrl({uid: "other", role: "restaurantOwner"}, {path}), {code: "permission-denied"});
});

test("public applications use bounded private server uploads with type and capability checks", async () => {
  const f = fixture();
  const {applicationId} = await f.appsLib.startPublicRestaurantApplication();
  const payload = {applicationId, kind: "ownerId", contentType: "application/pdf", fileName: "proof.pdf",
    contentBase64: Buffer.from("%PDF-synthetic").toString("base64")};
  const result = await f.appsLib.uploadPublicApplicationContent(payload);
  assert.match(result.path, new RegExp(`^applications/${applicationId}/ownerId_`));
  assert.equal(f.savedFiles.length, 1);
  assert.equal(f.savedFiles[0].options.metadata.cacheControl, "private, no-store");
  assert.equal(f.savedFiles[0].options.metadata.firebaseStorageDownloadTokens, undefined);
  await assert.rejects(f.appsLib.uploadPublicApplicationContent({...payload, contentBase64: Buffer.from("<script>bad</script>").toString("base64")}), {code: "invalid-argument"});
  await assert.rejects(f.appsLib.uploadPublicApplicationContent({...payload, applicationId: "../victim"}), {code: "invalid-argument"});
  const record = f.records.get(`restaurantApplications/${applicationId}`);
  record.uploadCount = 12;
  await assert.rejects(f.appsLib.uploadPublicApplicationContent(payload), {code: "resource-exhausted"});
  record.uploadCount = 0; record.status = "Verified";
  await assert.rejects(f.appsLib.uploadPublicApplicationContent(payload), {code: "failed-precondition"});
});

test("permanent restaurant deletion is master-only, confirmed, and preserves order records", async () => {
  const f = fixture();
  f.records.set("restaurants/owner-1", { name: "Aroy", emailId: "aroy@example.com" });
  f.records.set("users/owner-1", { role: "restaurantOwner" });
  f.records.set("food_items/owner-1/items/dish-1", { itemName: "Dish" });
  f.records.set("orders/order-1", { currentStatus: "Delivered", Restaurant: { ownerId: "owner-1" } });

  await assert.rejects(f.restaurantsLib.permanentlyDeleteRestaurant(owner, { ownerUid: "owner-1", confirmationName: "Aroy" }), { code: "permission-denied" });
  await assert.rejects(f.restaurantsLib.permanentlyDeleteRestaurant(master, { ownerUid: "thaiseva-platform", confirmationName: "Aroy" }), { code: "invalid-argument" });
  await assert.rejects(f.restaurantsLib.permanentlyDeleteRestaurant(master, { ownerUid: "owner-1", confirmationName: "Wrong" }), { code: "invalid-argument" });
  f.records.set("orders/order-2", { currentStatus: "Preparing", Restaurant: { ownerId: "owner-1" } });
  await assert.rejects(f.restaurantsLib.permanentlyDeleteRestaurant(master, { ownerUid: "owner-1", confirmationName: "Aroy" }), { code: "failed-precondition" });
  f.records.delete("orders/order-2");

  const result = await f.restaurantsLib.permanentlyDeleteRestaurant(master, { ownerUid: "owner-1", confirmationName: "Aroy" });
  assert.equal(result.deleted, true);
  assert.equal(f.records.has("restaurants/owner-1"), false);
  assert.equal(f.records.has("food_items/owner-1/items/dish-1"), false);
  assert.equal(f.records.has("users/owner-1"), false);
  assert.equal(f.records.has("orders/order-1"), true);
  assert.deepEqual(f.deletedUsers, ["owner-1"]);
  assert.deepEqual(f.deletedStoragePrefixes, ["restaurants/owner-1/"]);
});

test("riders: creation, updating, and active status toggling", async () => {
  const f = fixture();
  const { ridersLib } = f;

  // Create rider
  const riderInput = {
    name: "Somchai S",
    phone: "0812345678",
    vehicleType: "Motorcycle",
    vehicleNumber: "1กข-9999",
  };

  const { riderId } = await ridersLib.createFoodRider(master, riderInput);
  assert.ok(riderId);
  const created = f.records.get(`foodRiders/${riderId}`);
  assert.ok(created);
  assert.equal(created.name, "Somchai S");
  assert.equal(created.phone, "0812345678");
  assert.equal(created.vehicleType, "Motorcycle");
  assert.equal(created.active, true);

  // Update rider
  await ridersLib.updateFoodRider(master, {
    riderId,
    name: "Somchai Updated",
    phone: "0898765432",
    vehicleType: "Scooter",
    vehicleNumber: "2ขค-1111",
  });
  const updated = f.records.get(`foodRiders/${riderId}`);
  assert.equal(updated.name, "Somchai Updated");
  assert.equal(updated.vehicleType, "Scooter");

  // Deactivate rider
  await ridersLib.setFoodRiderActive(master, {
    riderId,
    active: false,
  });
  assert.equal(f.records.get(`foodRiders/${riderId}`).active, false);

  // Duplicate phone rejected
  await assert.rejects(
    ridersLib.createFoodRider(master, {
      ...riderInput,
      phone: "0898765432", // already taken by updated rider
    }),
    { code: "already-exists" }
  );

  // Non-master rejected
  await assert.rejects(
    ridersLib.createFoodRider(owner, riderInput),
    { code: "permission-denied" }
  );

  // Invalid vehicle type rejected
  await assert.rejects(
    ridersLib.createFoodRider(master, {
      ...riderInput,
      vehicleType: "Spaceship",
    }),
    { code: "invalid-argument" }
  );
});

test("applications: rejects reused emails from accounts, restaurants and applications", async () => {
  const f = fixture();
  await assert.rejects(f.appsLib.checkPublicPartnerEmail({ email: "invalid" }), { code: "invalid-argument" });
  assert.equal((await f.appsLib.checkPublicPartnerEmail({ email: " New@Example.com " })).available, true);
  f.authUsers.set("account@example.com", { uid: "existing-owner" });
  f.records.set("restaurants/existing", { emailId: "restaurant@example.com" });
  f.records.set("restaurantApplications/pending", { emailId: "pending@example.com", status: "Pending" });
  f.records.set("restaurantApplications/approved", { emailId: "approved@example.com", status: "Verified" });
  for (const email of [" Account@Example.com ", "restaurant@example.com", "pending@example.com", "approved@example.com"]) {
    await assert.rejects(f.appsLib.checkPublicPartnerEmail({ email }), { code: "already-exists" });
  }
});

test("applications: public submission and master review approval / rejection", async () => {
  const f = fixture();
  const { appsLib } = f;

  // Start public application
  const started = await appsLib.startPublicRestaurantApplication();
  assert.ok(started.applicationId);
  const appId = started.applicationId;

  // Submit public application
  const payload = {
    applicationId: appId,
    name: "Aroy Thai Bistro",
    phoneNumber: "0811112222",
    emailId: "aroy@example.com",
    foodType: "Thai",
    location: "Sukhumvit Soi 11, Bangkok",
    description: "Authentic royal Thai food",
    imageUrl: `applications/${appId}/cover.jpg`,
    ownerName: "Prasert",
    businessRegistrationNumber: "REG-998877",
    serviceType: "Both",
    openingHours: "10:00 - 22:00",
    businessLicenseUrl: `applications/${appId}/license.pdf`,
    ownerIdDocUrl: `applications/${appId}/id.pdf`,
  };

  const { proofHash } = require("../functions/src/lib/emailVerification");
  const otpKey = "test-only-otp-key";
  const token = "a".repeat(43);
  const proofPath = `emailOtpVerificationProofs/${proofHash(otpKey, "signup-proof", token)}`;
  f.records.set(proofPath, { emailHash: proofHash(otpKey, "signup-email", payload.emailId),
    expiresAt: Date.now() + 60000, consumedBy: null });
  await assert.rejects(appsLib.submitPublicRestaurantApplication(payload, otpKey), { code: "unauthenticated" });
  payload.verificationToken = token;
  await appsLib.submitPublicRestaurantApplication(payload, otpKey);
  assert.equal(f.records.get(proofPath).consumedBy, `partner-application:${appId}`);
  await appsLib.submitPublicRestaurantApplication(payload, otpKey);
  const submittedApp = f.records.get(`restaurantApplications/${appId}`);
  assert.equal(submittedApp.status, "Pending");
  assert.equal(submittedApp.name, "Aroy Thai Bistro");
  assert.equal(submittedApp.emailVerified, true);

  // Master approval
  await appsLib.reviewPublicApplication(master, {
    applicationId: appId,
    decision: "Verified",
    commission: 15,
    password: "Password123!",
  });

  const approvedApp = f.records.get(`restaurantApplications/${appId}`);
  assert.equal(approvedApp.status, "Verified");
  assert.ok(approvedApp.reviewedAt);

  // Verify restaurant document was created
  const resDoc = f.records.get(`restaurants/${approvedApp.ownerUid}`);
  assert.ok(resDoc);
  assert.equal(resDoc.name, "Aroy Thai Bistro");
  assert.equal(resDoc.status, "Verified");
  assert.equal(resDoc.comission, 15);

  // Verify claims were assigned
  assert.ok(f.claimsLog.length > 0);
  assert.equal(f.claimsLog[0].claims.foodRole, "restaurantOwner");

  // Test rejection flow on another application
  const started2 = await appsLib.startPublicRestaurantApplication();
  const appId2 = started2.applicationId;
  const secondToken = "b".repeat(43);
  f.records.set(`emailOtpVerificationProofs/${proofHash(otpKey, "signup-proof", secondToken)}`,
    { emailHash: proofHash(otpKey, "signup-email", "reject@example.com"),
      expiresAt: Date.now() + 60000, consumedBy: null });
  await appsLib.submitPublicRestaurantApplication({
    ...payload,
    verificationToken: secondToken,
    applicationId: appId2,
    emailId: "reject@example.com",
    imageUrl: `applications/${appId2}/cover.jpg`,
    businessLicenseUrl: `applications/${appId2}/license.pdf`,
    ownerIdDocUrl: `applications/${appId2}/id.pdf`,
  }, otpKey);

  // Rejection with decision: "Rejected"
  await appsLib.reviewPublicApplication(master, {
    applicationId: appId2,
    decision: "Rejected",
  });
  const rejectedApp = f.records.get(`restaurantApplications/${appId2}`);
  assert.equal(rejectedApp.status, "Rejected");

  // Already verified application cannot be re-approved
  await assert.rejects(
    appsLib.reviewPublicApplication(master, {
      applicationId: appId,
      decision: "Verified",
      commission: 10,
      password: "Password123!",
    }),
    { code: "failed-precondition" }
  );

  // Invalid decision rejected
  await assert.rejects(
    appsLib.reviewPublicApplication(master, {
      applicationId: appId2,
      decision: "Maybe",
    }),
    { code: "invalid-argument" }
  );

  // Customer denied access to private application file
  await assert.rejects(
    appsLib.getApplicationFileUrl(customer, {
      path: `applications/${appId}/license.pdf`,
    }),
    { code: "permission-denied" }
  );
});

test("customerChats: customer support messaging and channel isolation", async () => {
  const f = fixture();
  const { chatsLib } = f;

  // Food customer sends message
  const result = await chatsLib.sendFoodCustomerMessage(customer, {
    message: "Hello, I have an inquiry about order #123",
    customerName: "Alice Customer",
  });
  assert.ok(result.messageId);

  const chatDoc = f.records.get(`foodCustomerSupportChats/${customer.uid}`);
  assert.ok(chatDoc);
  assert.equal(chatDoc.channel, "food");
  assert.equal(chatDoc.customerName, "Alice Customer");
  assert.equal(chatDoc.isReadByAdmin, false);
  assert.equal(chatDoc.lastMessage.text, "Hello, I have an inquiry about order #123");

  // Admin or restaurant owner cannot use food customer chat endpoint
  await assert.rejects(
    chatsLib.sendFoodCustomerMessage(master, { message: "Test" }),
    { code: "permission-denied" }
  );
  await assert.rejects(
    chatsLib.sendFoodCustomerMessage(owner, { message: "Test" }),
    { code: "permission-denied" }
  );

  // Blank message rejected
  await assert.rejects(
    chatsLib.sendFoodCustomerMessage(customer, { message: "   " }),
    { code: "invalid-argument" }
  );
});
