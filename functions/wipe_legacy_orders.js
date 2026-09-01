const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function wipeLegacyOrders() {
  console.log("Starting cleanup of legacy orders...");
  const snapshot = await db.collection("orders").get();
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  if (snapshot.size > 0) {
    // Firestore batches can only have 500 operations, so if there are more than 500 we should chunk it.
    if (snapshot.size > 500) {
      console.log(`Found ${snapshot.size} orders. Batching deletions...`);
      let count = 0;
      let currentBatch = db.batch();
      for (const doc of snapshot.docs) {
        currentBatch.delete(doc.ref);
        count++;
        if (count % 500 === 0) {
          await currentBatch.commit();
          currentBatch = db.batch();
        }
      }
      if (count % 500 !== 0) {
        await currentBatch.commit();
      }
      console.log(`Deleted ${snapshot.size} orders`);
    } else {
      await batch.commit();
      console.log(`Deleted ${snapshot.size} orders`);
    }
  } else {
    console.log(`No orders found`);
  }

  console.log("Cleanup complete!");
}

wipeLegacyOrders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
