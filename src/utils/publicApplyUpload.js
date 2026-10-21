import {startPublicRestaurantApplication, uploadPublicApplicationContent} from "../api";

export async function ensurePublicApplicationId(existingId) {
  if (existingId) return existingId;
  const started = await startPublicRestaurantApplication();
  return started.applicationId;
}

export async function uploadPublicApplicationFile(applicationId, kind, file) {
  if (!file || file.size > 8 * 1024 * 1024) throw new Error("File must be under 8MB.");
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
  const result = await uploadPublicApplicationContent({applicationId, kind,
    contentType: file.type, fileName: file.name, contentBase64: base64});
  // The page preview is temporary; submissions store only the private path.
  const url = URL.createObjectURL(file);
  window.addEventListener("pagehide", () => URL.revokeObjectURL(url), {once: true});
  return {path: result.path, url};
}
