import { useEffect, useState } from "react";
import {getApplicationFileUrl} from "../api";


export function isApplicationStoragePath(value) {
  return /^applications\/[a-f0-9]{16,32}\/[A-Za-z0-9._-]+$/i.test(
    String(value || "").trim()
  );
}

function isPrivatePath(value) {
  return isApplicationStoragePath(value) || /^restaurants\/[A-Za-z0-9_-]+\/documents\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(String(value || ""));
}

export function privateFilePath(value) {
  const raw = String(value || "").trim();
  if (isPrivatePath(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com") return null;
    const match = url.pathname.match(/^\/v0\/b\/(gothai-ffea1\.(?:firebasestorage\.app|appspot\.com))\/o\/(.+)$/);
    const object = match ? decodeURIComponent(match[2]) : "";
    return isPrivatePath(object) ? object : null;
  } catch { return null; }
}

export function useResolvedApplicationFileUrl(storagePath) {
  const [url, setUrl] = useState(() =>
    privateFilePath(storagePath) ? "" : storagePath || ""
  );

  useEffect(() => {
    const raw = String(storagePath || "").trim();
    if (!raw) {
      setUrl("");
      return undefined;
    }
    const objectPath = privateFilePath(raw);
    if (!objectPath) {
      setUrl(raw);
      return undefined;
    }
    let cancelled = false;
    let objectUrl = null;
    let expiryTimer = null;
    
    // Private files never receive permanent public download-token URLs.
    setUrl("");
    getApplicationFileUrl({path: objectPath}).then((result) => {
      if (cancelled) return;
      if (result.url) setUrl(result.url);
      else if (result.contentBase64) {
        const bytes = Uint8Array.from(atob(result.contentBase64), value => value.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], {type: result.contentType || "application/octet-stream"}));
        setUrl(objectUrl);
        expiryTimer = window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl); objectUrl = null;
          if (!cancelled) setUrl("");
        }, 10 * 60 * 1000);
      } else setUrl("");
    }).catch(() => { if (!cancelled) setUrl(""); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (expiryTimer) window.clearTimeout(expiryTimer);
    };
  }, [storagePath]);

  return url;
}
