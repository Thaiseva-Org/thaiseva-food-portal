const APPLICATION_PATH_RE = /^applications\/[a-f0-9]{16,32}\/[A-Za-z0-9._-]+$/;
const VERIFICATION_PATH_RE = /^restaurants\/([A-Za-z0-9_-]+)\/documents\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;
function isPrivateFilePath(value) {
  const path = String(value || "").trim();
  return APPLICATION_PATH_RE.test(path) || VERIFICATION_PATH_RE.test(path);
}
function verificationOwner(value) {
  return String(value || "").trim().match(VERIFICATION_PATH_RE)?.[1] || null;
}
function privateFilePath(value) {
  const raw = String(value || "").trim();
  if (isPrivateFilePath(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com") return null;
    const match = url.pathname.match(/^\/v0\/b\/(gothai-ffea1\.(?:firebasestorage\.app|appspot\.com))\/o\/(.+)$/);
    const object = match ? decodeURIComponent(match[2]) : "";
    return isPrivateFilePath(object) ? object : null;
  } catch { return null; }
}
module.exports = {isPrivateFilePath, verificationOwner, privateFilePath};
