import { useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../../firebaseConfig";
import { customAlert } from "../utils/alertService";
import { useResolvedApplicationFileUrl } from "../utils/applicationFiles";
import PartnerPrivacyNotice from "./PartnerPrivacyNotice";

const SingleDocCard = ({
  label,
  kind,
  docState,
  onUpload,
  onClear,
  isUploading,
  required,
  disabled,
  readOnly,
}) => {
  const resolvedUrl = useResolvedApplicationFileUrl(docState?.url);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-brand-300 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-gray-800">{label}</span>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {required ? (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Required
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              )}
            </div>
          )}
        </div>

        {docState?.name && !docState?.cleared ? (
          <div className="mb-3">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
              <i
                className="bi bi-file-earmark-pdf text-red-500 text-2xl shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-semibold text-gray-900 truncate"
                  title={docState.name}
                >
                  {docState.name}
                </p>
                {docState.newUpload ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 border border-emerald-200">
                    <i className="bi bi-check-circle-fill mr-1" /> Ready to save
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500">Document on file</span>
                )}
              </div>
              {resolvedUrl && (
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold p-1 hover:bg-blue-50 rounded shrink-0 inline-flex items-center gap-1"
                  title="View or download document"
                >
                  <i className="bi bi-box-arrow-up-right" />
                  <span>View</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center">
            <p className="text-xs text-gray-400 italic">No document on file</p>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-neutral-100">
          <label
            className={`cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isUploading || disabled
                ? "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            {isUploading ? (
              <>
                <span className="inline-block animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <i className="bi bi-upload" />
                <span>{docState?.name && !docState?.cleared ? "Change file" : "Choose file"}</span>
              </>
            )}
            <input
              type="file"
              accept="application/pdf,image/*"
              disabled={isUploading || disabled}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(file, kind);
              }}
            />
          </label>

          {!required && docState?.name && !docState?.cleared && onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled || isUploading}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function VerificationDocuments({
  businessLicense,
  setBusinessLicense,
  ownerIdDoc,
  setOwnerIdDoc,
  foodSafetyCert,
  setFoodSafetyCert,
  ownerUid,
  disabled = false,
  readOnly = false,
  onUploadingChange,
}) {
  const [uploading, setUploading] = useState({});

  const handleUpload = async (file, kind, setter) => {
    if (readOnly) return;
    if (!file) return;
    if (!file.type?.startsWith("image/") && file.type !== "application/pdf") {
      customAlert("Documents must be a PDF or image file (JPG, PNG).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      customAlert("Document must be under 15MB.");
      return;
    }
    if (!ownerUid) {
      customAlert("Missing restaurant owner UID.");
      return;
    }

    try {
      setUploading((prev) => {
        const next = { ...prev, [kind]: true };
        if (onUploadingChange) onUploadingChange(Object.values(next).some(Boolean));
        return next;
      });

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(
        storage,
        `restaurants/${ownerUid}/documents/${kind}/${safeName}`
      );
      await uploadBytes(storageRef, file);

      setter({
        url: storageRef.fullPath,
        name: file.name,
        newUpload: true,
        cleared: false,
      });
    } catch (error) {
      console.error("Document upload failed:", error);
      customAlert("Unable to upload document: " + (error.message || "Storage error"));
    } finally {
      setUploading((prev) => {
        const next = { ...prev, [kind]: false };
        if (onUploadingChange) onUploadingChange(Object.values(next).some(Boolean));
        return next;
      });
    }
  };

  return (
    <div className="mb-6">
      {!readOnly && <PartnerPrivacyNotice />}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-gray-800 text-sm font-bold">Verification Documents</h3>
            {readOnly && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <i className="bi bi-shield-lock" /> Read-Only
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {readOnly
              ? "Official business and verification documents on file for this restaurant."
              : "View, upload, or replace business and compliance documents (PDF, JPG, PNG)."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SingleDocCard
          label="Business license"
          kind="business-license"
          docState={businessLicense}
          onUpload={(file, kind) => handleUpload(file, kind, setBusinessLicense)}
          isUploading={Boolean(uploading["business-license"])}
          required={true}
          disabled={disabled}
          readOnly={readOnly}
        />
        <SingleDocCard
          label="Owner ID"
          kind="owner-id"
          docState={ownerIdDoc}
          onUpload={(file, kind) => handleUpload(file, kind, setOwnerIdDoc)}
          isUploading={Boolean(uploading["owner-id"])}
          required={true}
          disabled={disabled}
          readOnly={readOnly}
        />
        <SingleDocCard
          label="Food safety certificate"
          kind="food-safety"
          docState={foodSafetyCert}
          onUpload={(file, kind) => handleUpload(file, kind, setFoodSafetyCert)}
          onClear={() => setFoodSafetyCert?.({ url: "", name: "", cleared: true })}
          isUploading={Boolean(uploading["food-safety"])}
          required={false}
          disabled={disabled}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
