import { useEffect, useId, useMemo, useRef, useState } from "react";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

/**
 * Searchable category combobox for menu items.
 * - First action: Add new category
 * - Lists all available categories (filterable)
 * - New categories are applied to the item; best-effort save to settings/categories
 */
const CategorySelect = ({
  value = "",
  onChange,
  categories: initialCategories = [],
  required = false,
  disabled = false,
  label = "Category",
  compact = false,
}) => {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(() =>
    normalizeList(initialCategories)
  );
  const [mode, setMode] = useState("list"); // list | create
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setOptions((prev) => mergeLists(prev, initialCategories));
  }, [initialCategories]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setMode("list");
        setSearch("");
        setError("");
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMode("list");
        setSearch("");
        setError("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && mode === "list") {
      queueMicrotask(() => searchRef.current?.focus());
    }
  }, [open, mode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.toLowerCase().includes(q));
  }, [options, search]);

  const searchTrim = search.trim();
  const exactExists = options.some(
    (c) => c.toLowerCase() === searchTrim.toLowerCase()
  );
  const showCreateFromSearch = Boolean(searchTrim) && !exactExists;

  // Rows: Add new first, then create-from-search, then available (filtered)
  const rows = useMemo(() => {
    const list = [{ type: "add" }];
    if (showCreateFromSearch) {
      list.push({ type: "create-search", label: searchTrim });
    }
    filtered.forEach((c) => list.push({ type: "option", label: c }));
    return list;
  }, [filtered, showCreateFromSearch, searchTrim]);

  useEffect(() => {
    setHighlight(0);
  }, [search, mode, open]);

  const selectCategory = (name) => {
    onChange?.(name);
    setOpen(false);
    setMode("list");
    setSearch("");
    setNewName("");
    setError("");
  };

  const persistCategory = async (name) => {
    const ref = doc(db, "settings", "categories");
    try {
      await updateDoc(ref, { data: arrayUnion(name) });
      return true;
    } catch {
      try {
        const snap = await getDoc(ref);
        const existing = snap.exists()
          ? normalizeList(snap.data()?.data)
          : [];
        if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
          return true;
        }
        await setDoc(ref, { data: [...existing, name] }, { merge: true });
        return true;
      } catch {
        // Partners may lack write access — category still works on the item.
        return false;
      }
    }
  };

  const commitNewCategory = async (raw) => {
    const name = String(raw || "").trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    if (name.length > 100) {
      setError("Category must be at most 100 characters.");
      return;
    }
    const existing = options.find(
      (c) => c.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      selectCategory(existing);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistCategory(name);
      setOptions((prev) => mergeLists(prev, [name]));
      selectCategory(name);
    } finally {
      setSaving(false);
    }
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e) => {
    if (mode !== "list") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (!row) return;
      if (row.type === "add") {
        setMode("create");
        setNewName(searchTrim);
        setError("");
      } else if (row.type === "create-search") {
        commitNewCategory(row.label);
      } else if (row.type === "option") {
        selectCategory(row.label);
      }
    }
  };

  return (
    <div className="block" ref={rootRef}>
      <span
        className={`mb-1.5 block font-semibold text-ink ${
          compact ? "text-sm" : "text-sm"
        }`}
      >
        {label}{" "}
        {required && <span className="text-danger-500">*</span>}
      </span>

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setMode("list");
          setError("");
        }}
        onKeyDown={onTriggerKeyDown}
        className={`modern-input flex w-full items-center justify-between gap-2 text-left ${
          compact ? "!py-2.5" : "!py-2.5"
        } ${open ? "border-brand-500 ring-2 ring-brand-500/20" : ""} ${
          !value ? "text-neutral-400" : "text-ink"
        }`}
      >
        <span className="truncate">
          {value || "Select or add a category"}
        </span>
        <i
          className={`bi bi-chevron-down shrink-0 text-ink-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Hidden input for HTML5 required when used in forms */}
      {required && (
        <input
          tabIndex={-1}
          className="sr-only"
          value={value}
          onChange={() => {}}
          required
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          id={listId}
          className="relative z-30 mt-1.5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
          role="listbox"
          aria-label="Categories"
          onKeyDown={onListKeyDown}
        >
          {mode === "list" ? (
            <>
              <div className="border-b border-neutral-100 p-2">
                <div className="relative">
                  <i
                    className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search categories…"
                    className="modern-input !py-2 !pl-9 !text-sm"
                    aria-label="Search categories"
                    autoComplete="off"
                  />
                </div>
              </div>

              <ul className="max-h-60 overflow-y-auto py-1" role="presentation">
                {rows.map((row, index) => {
                  const active = index === highlight;
                  if (row.type === "add") {
                    return (
                      <li key="__add__" role="option" aria-selected={active}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 ${
                            active ? "bg-brand-50" : "hover:bg-brand-50/70"
                          }`}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => {
                            setMode("create");
                            setNewName(searchTrim);
                            setError("");
                          }}
                        >
                          <i className="bi bi-plus-circle" aria-hidden="true" />
                          Add new category
                        </button>
                      </li>
                    );
                  }
                  if (row.type === "create-search") {
                    return (
                      <li
                        key="__create_search__"
                        role="option"
                        aria-selected={active}
                      >
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-success-700 ${
                            active ? "bg-success-50" : "hover:bg-success-50/80"
                          }`}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => commitNewCategory(row.label)}
                          disabled={saving}
                        >
                          <i className="bi bi-plus-lg" aria-hidden="true" />
                          Create “{row.label}”
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={row.label} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${
                          value === row.label
                            ? "bg-brand-50 font-semibold text-brand-800"
                            : active
                              ? "bg-neutral-50 text-ink"
                              : "text-ink hover:bg-neutral-50"
                        }`}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => selectCategory(row.label)}
                      >
                        <span className="truncate">{row.label}</span>
                        {value === row.label && (
                          <i
                            className="bi bi-check-lg text-brand-600"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}

                {filtered.length === 0 && !showCreateFromSearch && (
                  <li className="px-3 py-4 text-center text-sm text-ink-muted">
                    No categories match. Use “Add new category”.
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="space-y-3 p-3">
              <p className="text-sm font-semibold text-ink">New category</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitNewCategory(newName);
                  }
                }}
                placeholder="e.g. Seafood, Desserts…"
                className="modern-input"
                maxLength={100}
                autoFocus
                disabled={saving}
              />
              {error && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-success !min-h-9 !px-3 text-sm"
                  disabled={saving}
                  onClick={() => commitNewCategory(newName)}
                >
                  {saving ? "Saving…" : "Add category"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !min-h-9 !px-3 text-sm"
                  disabled={saving}
                  onClick={() => {
                    setMode("list");
                    setNewName("");
                    setError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function mergeLists(a, b) {
  return normalizeList([...(a || []), ...(b || [])]);
}

export default CategorySelect;
