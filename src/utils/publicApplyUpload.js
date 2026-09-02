import {
  startPublicRestaurantApplication,
} from "../api";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebaseConfig";

export async function ensurePublicApplicationId(existingId) {
  if (existingId) return existingId;
  const started = await startPublicRestaurantApplication();
  return started.applicationId;
}

export async function uploadPublicApplicationFile(applicationId, kind, file) {
  const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `applications/${applicationId}/${kind}_${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  try {
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, path };
  } catch (err) {
    console.error("Public upload failed:", err);
    throw new Error("File upload failed. Please try again.");
  }
}
