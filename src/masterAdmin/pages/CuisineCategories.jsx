import { useEffect, useState } from "react";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import InfoMessage from "../../components/InfoMessage";

const ref = doc(db, "settings", "cuisines");

export default function CuisineCategories() {
  const [cuisines, setCuisines] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => onSnapshot(ref, (snapshot) => {
    const values = snapshot.data()?.data;
    setCuisines(Array.isArray(values) ? values : []);
  }, () => setMessage({ type: "error", message: "Could not load cuisines." })), []);

  const add = async (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || value.length > 100 || value.includes(",")) {
      setMessage({ type: "error", message: "Enter a cuisine name up to 100 characters without commas." });
      return;
    }
    setBusy(true);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const list = Array.isArray(snapshot.data()?.data) ? snapshot.data().data : [];
        if (list.some((item) => item.toLowerCase() === value.toLowerCase())) throw new Error("That cuisine already exists.");
        transaction.set(ref, { data: [...list, value] });
      });
      setName("");
      setMessage({ type: "success", message: `${value} added.` });
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Could not add cuisine." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (value) => {
    if (!window.confirm(`Delete ${value} from cuisine categories?`)) return;
    setBusy(true);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const list = Array.isArray(snapshot.data()?.data) ? snapshot.data().data : [];
        transaction.set(ref, { data: list.filter((item) => item !== value) });
      });
      setMessage({ type: "success", message: `${value} deleted.` });
    } catch {
      setMessage({ type: "error", message: "Could not delete cuisine." });
    } finally {
      setBusy(false);
    }
  };

  return <div className="px-4 pt-8 pb-20 md:px-6 md:pt-10">
    <h1 className="page-header">Cuisine Categories</h1>
    <p className="page-subtext mt-1">Choose which cuisines are available for menu items.</p>
    {message && <div className="mt-5 max-w-xl"><InfoMessage type={message.type} message={message.message} /></div>}
    <form onSubmit={add} className="modern-card mt-8 flex max-w-xl flex-wrap gap-3 p-5">
      <input className="modern-input flex-1" aria-label="Cuisine name" placeholder="Cuisine name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
      <button className="btn-primary" type="submit" disabled={busy || !name.trim()}>Add cuisine</button>
    </form>
    <div className="modern-card mt-5 flex flex-wrap gap-3 p-5">
      {cuisines.length === 0 && <p className="text-sm text-ink-muted">No cuisines added yet.</p>}
      {cuisines.map((value) => <div key={value} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
        <span>{value}</span>
        <button type="button" className="text-danger-600 disabled:opacity-50" disabled={busy} onClick={() => remove(value)} aria-label={`Delete ${value}`}>Delete</button>
      </div>)}
    </div>
  </div>;
}
