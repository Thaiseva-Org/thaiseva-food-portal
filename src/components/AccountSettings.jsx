import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "../AuthContext";

const passwordError = (code) => {
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "The current password is incorrect.";
  }
  if (code === "auth/weak-password") return "Choose a stronger password.";
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait and try again.";
  }
  return "Unable to change the password. Please try again.";
};

const AccountSettings = ({ roleLabel, embedded }) => {
  const { currentUser } = useAuth();
  const [securityStatus, setSecurityStatus] = useState({ type: "", text: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const supportsPassword = currentUser?.providerData?.some(
    (provider) => provider.providerId === "password"
  );

  useEffect(() => {
    if (!embedded) document.title = `Thaiseva | ${roleLabel} Settings`;
  }, [roleLabel, embedded]);

  const changePassword = async (event) => {
    event.preventDefault();
    setSecurityStatus({ type: "", text: "" });
    if (!supportsPassword) {
      setSecurityStatus({
        type: "error",
        text: "This account uses an external sign-in provider. Manage its password with that provider.",
      });
      return;
    }
    if (newPassword.length < 8) {
      setSecurityStatus({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityStatus({ type: "error", text: "New passwords do not match." });
      return;
    }
    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityStatus({ type: "success", text: "Password changed successfully." });
    } catch (error) {
      setSecurityStatus({ type: "error", text: passwordError(error.code) });
    } finally {
      setSavingPassword(false);
    }
  };

  const noticeClass = (type) =>
    type === "success"
      ? "border-success-200 bg-success-50 text-success-700"
      : "border-danger-200 bg-danger-50 text-danger-700";

  const content = (
    <>
      {!embedded && (
        <div className="mb-6">
          <p className="eyebrow">Account</p>
          <h1 className="page-header">Settings</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage your password.
          </p>
        </div>
      )}

      <div className="max-w-2xl">
        <section className="panel">
          <h2 className="section-title">Security</h2>
          <p className="mt-1 text-sm text-ink-muted">Change your password.</p>
          {securityStatus.text && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${noticeClass(securityStatus.type)}`} role="status">
              {securityStatus.text}
            </div>
          )}
          {supportsPassword ? (
          <>
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="current-password" className="mb-1.5 block text-sm font-semibold text-ink">Current password</label>
              <input id="current-password" type="password" className="modern-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-ink">New password</label>
              <input id="new-password" type="password" className="modern-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-ink">Confirm new password</label>
              <input id="confirm-password" type="password" className="modern-input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <button type="submit" className="add-new-btn w-full sm:w-auto" disabled={savingPassword}>
              {savingPassword ? "Changing…" : "Change password"}
            </button>
          </form>
          </>
          ) : (
            <p className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-ink-muted">
              This account uses an external sign-in provider. Manage its password with that provider.
            </p>
          )}
        </section>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <div className="page-shell mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      {content}
    </div>
  );
};

export default AccountSettings;
