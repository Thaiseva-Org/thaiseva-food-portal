import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebaseConfig";

export default function PrivateOrderPhoto({ orderId, path, alt, className }) {
  const [preview, setPreview] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl;
    let expiryTimer;
    httpsCallable(getFunctions(app, "asia-east2"), "getFoodOrderPhoto")({ orderId, path }).then(({ data }) => {
      if (cancelled) return;
      let url = data.url;
      if (data.contentBase64) {
        const bytes = Uint8Array.from(atob(data.contentBase64), char => char.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: data.contentType }));
        url = objectUrl;
      }
      setPreview({ path, orderId, url, error: !url });
      expiryTimer = setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (!cancelled) setPreview({ path, orderId, error: true });
      }, 300000);
    }).catch(() => { if (!cancelled) setPreview({ path, orderId, error: true }); });
    return () => {
      cancelled = true;
      clearTimeout(expiryTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, path, attempt]);
  const current = preview?.path === path && preview?.orderId === orderId ? preview : null;
  return current?.url && !current.error
    ? <a href={current.url} target="_blank" rel="noopener noreferrer"><img src={current.url} alt={alt} className={className} referrerPolicy="no-referrer" onError={() => setPreview({ path, orderId, error: true })} /></a>
    : <div className="rounded-lg border border-slate-200 p-3 text-sm">{current?.error ? <>Photo unavailable. <button type="button" className="underline" onClick={() => { setPreview(null); setAttempt(value => value + 1); }}>Retry</button></> : "Loading delivery photo…"}</div>;
}
