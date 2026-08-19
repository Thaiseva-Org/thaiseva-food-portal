import { useEffect, useState } from "react";
import { getApplicationFileUrl } from "../api";

export function isApplicationStoragePath(value) {
  return /^applications\/[a-f0-9]{16,32}\/[A-Za-z0-9._-]+$/i.test(
    String(value || "").trim()
  );
}

export function useResolvedApplicationFileUrl(ref) {
  const [url, setUrl] = useState(() =>
    isApplicationStoragePath(ref) ? "" : ref || ""
  );

  useEffect(() => {
    const raw = String(ref || "").trim();
    if (!raw) {
      setUrl("");
      return undefined;
    }
    if (!isApplicationStoragePath(raw)) {
      setUrl(raw);
      return undefined;
    }
    let cancelled = false;
    getApplicationFileUrl({ path: raw })
      .then((data) => {
        if (!cancelled) setUrl(data?.url || "");
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return url;
}
