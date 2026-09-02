import { useEffect, useState } from "react";


export function isApplicationStoragePath(value) {
  return /^applications\/[a-f0-9]{16,32}\/[A-Za-z0-9._-]+$/i.test(
    String(value || "").trim()
  );
}

export function useResolvedApplicationFileUrl(storagePath) {
  const [url, setUrl] = useState(() =>
    isApplicationStoragePath(storagePath) ? "" : storagePath || ""
  );

  useEffect(() => {
    const raw = String(storagePath || "").trim();
    if (!raw) {
      setUrl("");
      return undefined;
    }
    if (!isApplicationStoragePath(raw)) {
      setUrl(raw);
      return undefined;
    }
    let cancelled = false;
    
    // Instead of using the Cloud Function (which can throw 500 if IAM roles are missing),
    // use the client SDK. The storage.rules already allow admins to read these files.
    import("firebase/storage").then(({ ref, getDownloadURL }) => {
      import("../../firebaseConfig").then(({ storage }) => {
        const storageRef = ref(storage, raw);
        getDownloadURL(storageRef)
          .then((downloadUrl) => {
            if (!cancelled) setUrl(downloadUrl);
          })
          .catch((err) => {
            console.error("Could not resolve application file:", err);
            if (!cancelled) setUrl("");
          });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
}
