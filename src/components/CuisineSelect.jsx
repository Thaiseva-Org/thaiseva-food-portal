import { useEffect, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const splitCuisines = (value) => String(value || "").split(",").map((part) => part.trim()).filter(Boolean);

export default function CuisineSelect({ value, onChange, label = "Cuisines", id, required = false }) {
  const [options, setOptions] = useState([]);
  useEffect(() => onSnapshot(doc(db, "settings", "cuisines"), (snapshot) => {
    setOptions(Array.isArray(snapshot.data()?.data) ? snapshot.data().data : []);
  }, () => setOptions([])), []);

  const selected = splitCuisines(value);
  return <Autocomplete
    multiple
    options={[...new Set([...options, ...selected])]}
    value={selected}
    onChange={(_, values) => onChange(values.join(", "))}
    renderInput={(params) => <TextField {...params} id={id} label={label} placeholder="Choose cuisines" size="small" required={required && selected.length === 0} />}
  />;
}
