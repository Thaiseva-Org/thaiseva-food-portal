import { Link } from "react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import CategorySelect from "../../components/CategorySelect";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import { partnerPath } from "../../../utils/partnerRoutes";

const fieldClass = (hasError) =>
  `modern-input !py-2.5 ${
    hasError
      ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20"
      : ""
  }`;

const Template = ({
  image,
  setDescription,
  setDiscount,
  setDropdownOpen,
  setItemName,
  setCategory,
  setPrice,
  dropdownOpen,
  uploading,
  uploadProgress = 0,
  handleAddItem,
  handleDragOver,
  handleDrop,
  handleFileChange,
  clearImage,
  itemName,
  itemType,
  price,
  discount,
  category,
  description,
  setItemType,
  submitBtn = "Add menu item",
  fieldErrors = {},
  formError = null,
  formSuccess = null,
  mode = "add",
  loadingItem = false,
  active = false,
  setActive,
  itemId,
  cuisine = "",
  setCuisine,
  cancelPath = partnerPath("foodItem"),
}) => {
  const modalRef = useRef(null);
  const fileInputId = useId();
  const inlineFileId = useId();
  const [categories, setCategories] = useState([]);
  const [dragOverPhoto, setDragOverPhoto] = useState(false);
  const isEdit = mode === "edit";

  const discountNum = Number(discount) || 0;
  const priceNum = Number(price) || 0;
  const salePreview =
    discountNum > 0 && priceNum > 0
      ? Math.round(priceNum * (1 - discountNum / 100) * 100) / 100
      : null;

  const completeness = useMemo(() => {
    const checks = [
      Boolean(String(itemName || "").trim()),
      Number(price) > 0,
      Boolean(String(category || "").trim()),
      Boolean(itemType),
      Boolean(String(description || "").trim()),
      Boolean(image),
    ];
    const done = checks.filter(Boolean).length;
    return {
      done,
      total: checks.length,
      pct: Math.round((done / checks.length) * 100),
    };
  }, [itemName, price, category, itemType, description, image]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const list = snapshot.data().data;
          setCategories(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        console.log(e);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [dropdownOpen, setDropdownOpen]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!uploading) handleAddItem();
  };

  const onPhotoDragOver = (e) => {
    handleDragOver(e);
    setDragOverPhoto(true);
  };
  const onPhotoDragLeave = (e) => {
    e.preventDefault();
    setDragOverPhoto(false);
  };
  const onPhotoDrop = (e) => {
    setDragOverPhoto(false);
    handleDrop(e);
  };

  if (loadingItem) {
    return (
      <div className="page-shell px-4 py-10">
        <div className="panel py-16">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isEdit
          ? "fixed inset-0 z-50 overflow-y-auto bg-brand-950/60 p-0 backdrop-blur-[2px] sm:p-5"
          : "page-shell px-4 py-5 sm:px-5 lg:px-6 pb-24 sm:pb-6"
      }
    >
      <div
        className={
          isEdit
            ? "relative mx-auto min-h-full w-full max-w-5xl bg-page-gradient px-4 py-5 shadow-2xl sm:min-h-0 sm:rounded-3xl sm:px-5 lg:px-6"
            : ""
        }
      >
      {isEdit && (
        <Link
          to={cancelPath}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-ink shadow-sm transition hover:rotate-90 hover:bg-neutral-50 focus-ring"
          aria-label="Close edit item"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </Link>
      )}
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm">
            <Link
              to={cancelPath}
              className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 focus-ring rounded"
            >
              <i className="bi bi-arrow-left text-xs" aria-hidden="true" />
              Menu
            </Link>
            <span className="text-neutral-300" aria-hidden="true">
              /
            </span>
            <h1 className="font-bold text-ink-heading text-lg sm:text-xl">
              {isEdit ? "Edit menu item" : "Add menu item"}
            </h1>
          </nav>
          <p className="page-subtext mt-1 max-w-xl">
            {isEdit
              ? "Update photo and details — the preview updates as you type."
              : "Drop a photo on the card. New items go live on the menu."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-sm">
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${completeness.pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-ink-muted tabular-nums">
              {completeness.done}/{completeness.total}
            </span>
          </div>
          {itemId && (
            <span className="hidden sm:inline rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-mono text-ink-muted">
              #{itemId}
            </span>
          )}
        </div>
      </header>

      {(formError || formSuccess) && (
        <div className="mb-3 space-y-2">
          {formError && <InfoMessage type="error" message={formError} />}
          {formSuccess && <InfoMessage type="success" message={formSuccess} />}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        {/* Equal-height two-column workspace */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-5">
          {/* LEFT: preview + photo */}
          <aside className="lg:col-span-4 flex flex-col min-w-0">
            <div className="panel !p-0 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Preview & photo
                </p>
                {image && clearImage && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-danger-600 hover:text-danger-700 focus-ring rounded"
                    onClick={clearImage}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="px-3.5 pb-3.5 flex flex-col flex-1 gap-3">
                <article
                  className={`group flex-1 flex flex-col overflow-hidden rounded-xl border bg-white transition-shadow min-h-0 ${
                    dragOverPhoto
                      ? "border-brand-500 ring-2 ring-brand-500/25"
                      : "border-neutral-200"
                  }`}
                  onDragOver={onPhotoDragOver}
                  onDragLeave={onPhotoDragLeave}
                  onDrop={onPhotoDrop}
                >
                  <div
                    className={`relative shrink-0 h-40 sm:h-44 lg:h-40 xl:h-48 bg-neutral-50 ${
                      !image ? "border-b border-dashed border-neutral-200" : ""
                    }`}
                  >
                    {image && typeof image === "string" ? (
                      <img
                        src={image}
                        alt={itemName || "Selected dish"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center ${
                          dragOverPhoto
                            ? "bg-brand-50 text-brand-600"
                            : "text-neutral-400"
                        }`}
                      >
                        <i
                          className="bi bi-cloud-arrow-up text-3xl"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-ink">
                          Drop photo here
                        </p>
                        <p className="text-xs text-ink-muted">
                          JPG / PNG · max 5MB
                        </p>
                      </div>
                    )}

                    <div className="pointer-events-none absolute left-2 top-2 flex max-w-[85%] flex-wrap gap-1">
                      {discountNum > 0 && (
                        <span className="badge-warning">{discountNum}% off</span>
                      )}
                      {itemType && (
                        <span
                          className={
                            itemType === "Veg"
                              ? "badge-success"
                              : "badge-danger"
                          }
                        >
                          {itemType === "Veg" ? "VEG" : "NON VEG"}
                        </span>
                      )}
                    </div>

                    {image && (
                      <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/55 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <label
                          htmlFor={inlineFileId}
                          className={`cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm ${
                            uploading ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          Change photo
                        </label>
                      </div>
                    )}

                    {dragOverPhoto && image && (
                      <div className="absolute inset-0 flex items-center justify-center bg-brand-600/40">
                        <p className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow">
                          Drop to replace
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 p-3 flex-1 min-h-[5.5rem]">
                    <p className="truncate text-[15px] font-semibold text-ink leading-snug">
                      {itemName?.trim() || (
                        <span className="text-neutral-400 font-medium">
                          Dish name
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {category || (
                        <span className="text-neutral-400">Category</span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5">
                      {salePreview != null ? (
                        <>
                          <span className="text-base font-bold text-ink-heading tabular-nums">
                            {"\u0E3F"}
                            {salePreview.toFixed(2)}
                          </span>
                          <span className="text-xs text-ink-muted line-through tabular-nums">
                            {"\u0E3F"}
                            {priceNum.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-base font-bold text-ink-heading tabular-nums">
                          {"\u0E3F"}
                          {priceNum > 0 ? priceNum.toFixed(2) : "0.00"}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-ink-muted mt-1 leading-relaxed">
                      {description?.trim() || (
                        <span className="italic text-neutral-400">
                          Description…
                        </span>
                      )}
                    </p>
                  </div>
                </article>

                <input
                  type="file"
                  id={inlineFileId}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  className="hidden"
                  disabled={uploading}
                />
                <div className="flex gap-2 shrink-0">
                  <label
                    htmlFor={inlineFileId}
                    className={`btn-primary flex-1 !min-h-10 cursor-pointer justify-center !text-sm ${
                      uploading ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    <i className="bi bi-upload" aria-hidden="true" />
                    {image ? "Change photo" : "Choose photo"}
                  </label>
                  <button
                    type="button"
                    className="btn-outline !min-h-10 !px-3"
                    onClick={() => setDropdownOpen(true)}
                    disabled={uploading}
                    title="Larger upload"
                    aria-label="Open larger upload dialog"
                  >
                    <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT: form */}
          <div className="lg:col-span-8 flex flex-col min-w-0">
            <div className="panel !p-4 sm:!p-5 flex flex-col h-full gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    Item name <span className="text-danger-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className={fieldClass(fieldErrors.itemName)}
                    placeholder="e.g. Pad Thai with shrimp"
                    maxLength={120}
                    autoFocus={!isEdit}
                  />
                  {fieldErrors.itemName && (
                    <p className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.itemName}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    Price (THB) <span className="text-danger-500">*</span>
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">
                      {"\u0E3F"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      className={`${fieldClass(fieldErrors.price)} !pl-8`}
                      placeholder="0.00"
                    />
                  </div>
                  {fieldErrors.price && (
                    <p className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.price}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    Discount (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onWheel={(e) => e.target.blur()}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      if (discount === "") setDiscount(0);
                    }}
                    onChange={(e) => {
                      const inputValue = e.target.value.replace(/^0+(?=\d)/, "");
                      if (
                        inputValue === "" ||
                        (/^\d{0,3}$/.test(inputValue) &&
                          Number(inputValue) >= 0 &&
                          Number(inputValue) <= 100)
                      ) {
                        setDiscount(inputValue);
                      }
                    }}
                    className={fieldClass(fieldErrors.discount)}
                    placeholder="0"
                  />
                  {salePreview != null && (
                    <p className="mt-1 text-xs font-medium text-success-700">
                      Customers pay {"\u0E3F"}
                      {salePreview.toFixed(2)}{" "}
                      <span className="text-ink-muted line-through font-normal">
                        {"\u0E3F"}
                        {priceNum.toFixed(2)}
                      </span>
                    </p>
                  )}
                </label>

                <div className="min-w-0">
                  <CategorySelect
                    value={category}
                    onChange={setCategory}
                    categories={categories}
                    required
                    disabled={uploading}
                    label="Category"
                    compact
                  />
                  {fieldErrors.category && (
                    <p className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.category}
                    </p>
                  )}
                </div>

                <fieldset className="min-w-0">
                  <legend className="mb-1.5 block text-sm font-semibold text-ink">
                    Item type <span className="text-danger-500">*</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "Veg", label: "Veg" },
                      { value: "Non Veg", label: "Non Veg" },
                    ].map((opt) => {
                      const selected = itemType === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                            selected
                              ? opt.value === "Veg"
                                ? "border-success-500 bg-success-50 text-success-800"
                                : "border-danger-500 bg-danger-50 text-danger-800"
                              : "border-neutral-200 bg-white text-ink-muted hover:bg-neutral-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="foodType"
                            value={opt.value}
                            checked={selected}
                            onChange={(e) => setItemType(e.target.value)}
                            className="sr-only"
                          />
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              opt.value === "Veg"
                                ? "bg-success-500"
                                : "bg-danger-500"
                            }`}
                            aria-hidden="true"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                  {fieldErrors.itemType && (
                    <p className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.itemType}
                    </p>
                  )}
                </fieldset>
              </div>

              {/* Cuisine field (Master Admin only) */}
              {setCuisine && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    Cuisine
                  </span>
                  <input
                    type="text"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    className={fieldClass(fieldErrors.cuisine)}
                    placeholder="e.g. Thai, Indian, Italian"
                    maxLength={100}
                  />
                  {fieldErrors.cuisine && (
                    <p className="mt-1 text-xs font-medium text-danger-600">
                      {fieldErrors.cuisine}
                    </p>
                  )}
                </label>
              )}

              {isEdit && typeof setActive === "function" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">Visibility</p>
                    <p className="text-xs text-ink-muted">
                      {active ? "Active on menu" : "Hidden from customers"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    onClick={() => setActive(!active)}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-ring ${
                      active ? "bg-success-500" : "bg-neutral-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        active ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>
              )}

              <label className="flex flex-col flex-1 min-h-0">
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  Description <span className="text-danger-500">*</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${fieldClass(fieldErrors.description)} flex-1 min-h-[100px] lg:min-h-[120px] resize-y`}
                  placeholder="Ingredients, spice level, portion size, allergens…"
                  rows={4}
                  maxLength={2000}
                />
                <div className="mt-1 flex justify-between gap-2 text-xs text-ink-muted">
                  <span className="hidden sm:inline">
                    Shown on the menu card
                  </span>
                  <span className="ms-auto tabular-nums">
                    {(description || "").length}/2000
                  </span>
                </div>
                {fieldErrors.description && (
                  <p className="mt-1 text-xs font-medium text-danger-600">
                    {fieldErrors.description}
                  </p>
                )}
              </label>

              {uploading && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand-800">
                    <span>
                      {uploadProgress > 0 && uploadProgress < 100
                        ? "Uploading photo…"
                        : "Saving item…"}
                    </span>
                    <span className="tabular-nums">{uploadProgress || 0}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{
                        width: `${Math.max(uploadProgress || 8, 8)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-auto hidden sm:flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4">
                <Link
                  to={partnerPath("foodItem")}
                  className="btn-outline !min-h-10 !px-5"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-success !min-h-10 !px-6"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg" aria-hidden="true" />
                      {submitBtn}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky actions */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <Link
              to={cancelPath}
              className="btn-outline flex-1 !min-h-11 text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-success flex-[1.4] !min-h-11"
              disabled={uploading}
            >
              {uploading ? "Saving…" : submitBtn}
            </button>
          </div>
        </div>
      </form>
      </div>

      {dropdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setDropdownOpen(false)}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="upload-title"
                  className="text-lg font-bold text-ink-heading"
                >
                  Upload photo
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Drag & drop or choose a file
                </p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 focus-ring"
                onClick={() => setDropdownOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <div
              className="flex min-h-[11rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <i
                className="bi bi-cloud-arrow-up text-4xl text-brand-500"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-medium text-ink">Drop image here</p>
              <p className="text-xs text-ink-muted mt-1">
                JPEG, PNG, WebP · max 5MB
              </p>
              <input
                type="file"
                id={fileInputId}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
              />
              <label
                htmlFor={fileInputId}
                className="btn-primary mt-4 !min-h-10 cursor-pointer"
              >
                Select file
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Template;
