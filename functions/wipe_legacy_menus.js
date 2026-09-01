const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

async function wipeLegacyMenus() {
  console.log("Starting cleanup of legacy menus...");
  const snapshot = await db.collection("food_items").get();
  
  for (const doc of snapshot.docs) {
    if (doc.id === "thaiseva-platform") {
      console.log(`Skipping master menu: ${doc.id}`);
      continue;
    }
    
    console.log(`Deleting items for restaurant: ${doc.id}`);
    const itemsSnapshot = await db.collection("food_items").doc(doc.id).collection("items").get();
    
    const batch = db.batch();
    itemsSnapshot.docs.forEach((itemDoc) => {
      batch.delete(itemDoc.ref);
    });
    
    if (itemsSnapshot.size > 0) {
      await batch.commit();
      console.log(`Deleted ${itemsSnapshot.size} items from ${doc.id}`);
    } else {
      console.log(`No items found for ${doc.id}`);
    }

    // Delete the root document as well to keep the collection clean
    await db.collection("food_items").doc(doc.id).delete();
  }
  
  console.log("Cleanup complete!");
}

wipeLegacyMenus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
