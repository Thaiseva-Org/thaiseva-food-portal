const assert = require('node:assert/strict');
const {test, after} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {initializeApp, deleteApp} = require('../node_modules/firebase/app');
const {getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, terminate} = require('../node_modules/firebase/firestore');
const {getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, listAll, deleteObject} = require('../node_modules/firebase/storage');
const projectId = 'demo-thaiseva-security';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Run only through Firebase emulators:exec.');
const apps = [];
function client(uid, claims = {}) {
  const app = initializeApp({projectId, apiKey: 'local-test', storageBucket: `${projectId}.appspot.com`}, uid || 'anonymous');
  const db = getFirestore(app), storage = getStorage(app);
  const mockUserToken = uid ? {sub: uid, email: `${uid}@example.test`, email_verified: false, ...claims} : undefined;
  connectFirestoreEmulator(db, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_HOST.split(':').pop()), mockUserToken ? {mockUserToken} : {});
  connectStorageEmulator(storage, '127.0.0.1', Number(process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':').pop()), mockUserToken ? {mockUserToken} : {});
  apps.push({app, db});
  return {db, storage};
}
const attacker = client('attacker');
const victim = client('victim');
const staff = client('staff', {admin: true});
const foodStaff = client('food-staff', {foodRole: 'masterAdmin'});
const anonymous = client();
const subAdmin = client('sub-admin');
const restaurant = client('restaurant');
const rider = client('rider');
async function deny(action) {
  await assert.rejects(action, error => ['permission-denied', 'storage/unauthorized'].includes(error.code));
}
async function seed(documentPath, data) {
  // Seed via authenticated emulator admin SDK bypass; never contacts production.
  const encode = value => typeof value === 'boolean' ? {booleanValue: value}
    : typeof value === 'number' ? {integerValue: String(value)}
    : value && typeof value === 'object' ? {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]))}}
    : {stringValue: String(value)};
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`, {
    method: 'PATCH', headers: {Authorization: 'Bearer owner', 'Content-Type': 'application/json'}, body: JSON.stringify({fields}),
  });
  assert.equal(response.status, 200);
}

const put = (actor, file, type = 'image/jpeg', bytes = new Uint8Array([1,2])) => uploadBytes(ref(actor.storage, file), bytes, {contentType: type});
const read = (actor, file) => getBytes(ref(actor.storage, file));
const remove = (actor, file) => deleteObject(ref(actor.storage, file));
test('public profile JPEGs enforce owner, filename, MIME, limit and deletion', async () => {
  const file = 'profile_pics/victim.jpg';
  await put(victim, file);
  await read(anonymous, file);
  await deny(() => put(attacker, file));
  await deny(() => put(anonymous, 'profile_pics/anonymous.jpg'));
  await deny(() => put(victim, 'profile_pics/victim.png', 'image/png'));
  await deny(() => put(victim, file, 'text/html'));
  await put(victim, file, 'image/jpeg', new Uint8Array(15 * 1024 * 1024));
  await deny(() => put(victim, file, 'image/jpeg', new Uint8Array(15 * 1024 * 1024 + 1)));
  await deny(() => remove(attacker, file));
  await remove(victim, file);
});
test('support submissions are owner-created, immutable and admin-readable/deletable', async () => {
  const file = 'uploads/victim/support/proof.pdf';
  await put(victim, file, 'application/pdf');
  for (const actor of [anonymous, attacker, victim]) await deny(() => read(actor, file));
  await read(staff, file);
  await read(foodStaff, file);
  await deny(() => put(attacker, 'uploads/victim/forged.pdf', 'application/pdf'));
  await deny(() => put(anonymous, 'uploads/anonymous/proof.pdf', 'application/pdf'));
  await deny(() => put(victim, file, 'application/pdf'));
  await deny(() => put(staff, file, 'application/pdf'));
  await deny(() => remove(victim, file));
  await remove(staff, file);
});
test('order photos reject unrelated users and permit only current order participants', async () => {
  const file = 'food_orders/victim/order1/location.jpg';
  await seed('orders/order1', {Receiver:{id:'victim'},Restaurant:{ownerId:'restaurant'},assignedRiderId:'rider'});
  await put(victim, file);
  await deny(() => read(attacker, file));
  for (const actor of [victim, staff, foodStaff, restaurant, rider]) await read(actor, file);
  await seed('orders/order1', {Receiver:{id:'victim'},Restaurant:{ownerId:'restaurant'},assignedRiderId:'new-rider'});
  await deny(() => read(rider, file));
  await put(victim, 'food_orders/victim/legacy.jpg');
  await deny(() => read(restaurant, 'food_orders/victim/legacy.jpg'));
  await deny(() => read(anonymous, file));
  await deny(() => put(attacker, file));
  await deny(() => put(victim, 'food_orders/victim/order1/location.pdf', 'application/pdf'));
  await deny(() => remove(attacker, file));
  await remove(foodStaff, file);
});

test('partner projections preserve tenant isolation and deny client mutations and full order reads', async () => {
  await seed('partnerOrderViews/isolated', {Restaurant:{ownerId:'restaurant'},Receiver:{name:'synthetic',phoneNumber:'000000000'},Amount:100});
  await seed('orders/isolated', {Restaurant:{ownerId:'restaurant'},Receiver:{id:'victim',email:'synthetic@example.invalid'},Amount:100});
  assert.equal((await getDoc(doc(restaurant.db,'partnerOrderViews/isolated'))).exists(),true);
  await deny(() => getDoc(doc(attacker.db,'partnerOrderViews/isolated')));
  await deny(() => getDoc(doc(restaurant.db,'orders/isolated')));
  assert.equal((await getDoc(doc(victim.db,'orders/isolated'))).exists(),true);
  await deny(() => updateDoc(doc(restaurant.db,'partnerOrderViews/isolated'), {Amount:1}));
});
test('public catalog folders reject visitor/customer writes and preserve staff uploads', async () => {
  for (const folder of ['images','hotel-images','restaurantImages','blogImages','hotelImages','serviceImages']) {
    const file = `${folder}/review.jpg`;
    await put(staff, file);
    await read(anonymous, file);
    await deny(() => put(anonymous, `${folder}/forged.jpg`));
    await deny(() => put(attacker, file));
    await deny(() => put(staff, `${folder}/bad.html`, 'text/html'));
    await remove(staff, file);
  }
  await put(staff, 'site-media/banner.jpg');
  await read(anonymous, 'site-media/banner.jpg');
  await deny(() => put(attacker, 'site-media/forged.jpg'));
  await deny(() => put(staff, '123456-file'));
  await deny(() => put(attacker, 'unknown/path.jpg'));
});
test('partner public media and private documents cannot bypass image validation or ownership', async () => {
  for (const folder of ['partners','hotels','HotelDB']) {
    const image = `${folder}/victim/media/photo.jpg`;
    const document = `${folder}/victim/documents/license.pdf`;
    await put(victim, image);
    await read(anonymous, image);
    await deny(() => put(victim, `${folder}/victim/media/bad.html`, 'text/html'));
    await put(victim, document, 'application/pdf');
    await read(staff, document);
    await deny(() => read(attacker, document));
    await deny(() => read(anonymous, document));
    await deny(() => put(attacker, document, 'application/pdf'));
  }
});
test('food menu images, private verification, applications and legacy chat stay covered', async () => {
  await put(victim, 'restaurants/victim/items/item1');
  await read(anonymous, 'restaurants/victim/items/item1');
  await put(foodStaff, 'restaurants/victim/profile/logo.jpg');
  const proof = 'restaurants/victim/documents/license/proof.pdf';
  await put(victim, proof, 'application/pdf');
  await read(foodStaff, proof);
  await deny(() => read(anonymous, proof));
  await deny(() => put(victim, proof, 'application/pdf'));
  await deny(() => put(anonymous, 'applications/test/proof.pdf', 'application/pdf'));
  await put(victim, 'chat/victim/voice.mp3', 'audio/mpeg');
  await read(staff, 'chat/victim/voice.mp3');
  await deny(() => read(attacker, 'chat/victim/voice.mp3'));
  await put(victim, 'users/victim/files/private.jpg');
  await deny(() => read(anonymous, 'users/victim/files/private.jpg'));
});
test('protected role fallback works without trusting emails or self-set flags', async () => {
  await seed('users/attacker', {isMasterAdmin: true, foodRole: 'masterAdmin'});
  await deny(() => put(attacker, 'site-media/forged.jpg'));
  await seed('Users/sub-admin', {role: 'Sub Admin'});
  await put(subAdmin, 'site-media/legacy.jpg');
  await seed('users/sub-admin', {role: 'Customer'});
  await deny(() => put(subAdmin, 'site-media/forged.jpg'));
});
after(async () => { for (const {app, db} of apps) { await terminate(db); await deleteApp(app); } });
