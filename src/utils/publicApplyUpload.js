import {
  finalizePublicUpload,
  getPublicApplicationUploadUrl,
  startPublicRestaurantApplication,
} from "../api";

export async function ensurePublicApplicationId(existingId) {
  if (existingId) return existingId;
  const started = await startPublicRestaurantApplication();
  return started.applicationId;
}

export async function uploadPublicApplicationFile(applicationId, kind, file) {
  const { uploadUrl, path, contentType } = await getPublicApplicationUploadUrl({
    applicationId,
    kind,
    contentType: file.type || "application/octet-stream",
    fileName: file.name,
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) {
    throw new Error("File upload failed. Please try again.");
  }
  const done = await finalizePublicUpload({ applicationId, path });
  return { url: done.url, path: done.path || path };
}
