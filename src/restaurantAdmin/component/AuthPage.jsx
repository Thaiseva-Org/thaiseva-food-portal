import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { auth } from "../../../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  FaEnvelope,
  FaLock,
  FaUserAlt,
  FaRegEye,
  FaRegEyeSlash,
  FaExclamationCircle,
  FaClipboardList,
  FaImages,
  FaArrowRight,
} from "react-icons/fa";
import { Logo as logo } from "../../assets";
import { ensureUserProfile } from "../../api";
import { resolvePostLoginPath } from "../../utils/authRouting";
import { useAuth } from "../../AuthContext";
import {
  applyAuthPersistence,
  establishAuthSession,
} from "../../utils/authSession";
import {
  clearLoginFailures,
  getLoginThrottleState,
  recordLoginFailure,
} from "../../utils/sessionSecurity";

const HIGHLIGHTS = [
  {
    icon: FaClipboardList,
    label: "Live kitchen orders",
    detail: "Tickets from the ThaiSeva app and website arrive here as they are placed.",
    tile: "bg-brand-500 text-white",
  },
  {
    icon: FaImages,
    label: "Menu & photos",
    detail: "What you keep here is what customers see on ThaiSeva.",
    tile: "bg-secondary-500 text-white",
  },
];

const AuthField = ({ id, label, icon, children }) => (
  <div>
    <label
      className="mb-1.5 block text-sm font-semibold text-ink"
      htmlFor={id}
    >
      {label}
    </label>
    <div className="group flex min-h-12 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 transition-all duration-fast focus-within:border-brand-500 focus-within:bg-white focus-within:shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 shadow-sm ring-1 ring-neutral-200/80 group-focus-within:text-brand-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      {children}
    </div>
  </div>
);

const AuthPageAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showpsw, setShowpsw] = useState(false);
  const [name, setName] = useState("");
  const [isSignUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const {
    currentUser,
    isMasterAdmin,
    needsOnboarding,
    sessionExpiredMessage,
    clearSessionMessage,
  } = useAuth();

  useEffect(() => {
    document.title = "Thaiseva | Sign in";
  }, []);

  // Already signed in → skip auth screen
  useEffect(() => {
    if (!currentUser) return;
    if (isMasterAdmin) {
      navigate("/foodAdmin", { replace: true });
    } else if (needsOnboarding) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/partner", { replace: true });
    }
  }, [currentUser, isMasterAdmin, needsOnboarding, navigate]);

  const finishLogin = async (user) => {
    // Bind JWT session (force-refresh ID token + client session marker)
    await establishAuthSession(user, { rememberMe });
    clearLoginFailures();
    clearSessionMessage?.();
    const path = await resolvePostLoginPath(user);
    navigate(path, { replace: true });
  };

  const assertNotLockedOut = () => {
    const throttle = getLoginThrottleState();
    if (throttle.locked) {
      const mins = Math.ceil(throttle.remainingMs / 60000);
      throw Object.assign(
        new Error(
          `Too many failed sign-in attempts. Try again in about ${mins} minute(s).`
        ),
        { code: "auth/too-many-requests" }
      );
    }
  };

  const validatePassword = (passwordValue) => {
    if (passwordValue.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (!/[A-Z]/.test(passwordValue)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(passwordValue)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/\d/.test(passwordValue)) {
      return "Password must contain at least one number.";
    }
    if (!/[@$!%*?&]/.test(passwordValue)) {
      return "Password must contain at least one special character (@$!%*?&).";
    }
    return "valid";
  };

  /**
   * Create profile only if missing. Never overwrite roles/flags.
   * Prefer Cloud Function; fall back to client create rules if functions offline.
   */
  const ensureProfileSafe = async (user, displayName) => {
    try {
      await ensureUserProfile({
        name: displayName || name || user.displayName || "",
        email: user.email,
      });
    } catch {
      // Fallback: client-side create-if-missing only (rules block privilege fields)
      const { doc, getDoc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../../../firebaseConfig");
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name: displayName || name || user.displayName || "User",
          email: user.email,
          role: "restaurantOwner",
          serviceCategory: "Restaurant",
          isRestaurantAdmin: false,
          isMasterAdmin: false,
          createdAt: serverTimestamp(),
          userId: user.uid,
        });
      }
    }
  };

  const handleEmailPasswordAuth = async () => {
    try {
      setError("");
      setSubmitting(true);
      assertNotLockedOut();
      if (isSignUp && !name) {
        setError("Please provide username");
        return;
      }
      if (!email) {
        setError("Please provide email");
        return;
      }
      if (!password) {
        setError("Please provide password");
        return;
      }
      if (isSignUp && password) {
        const res = validatePassword(password);
        if (res !== "valid") {
          setError(res);
          return;
        }
      }
      // Session vs local JWT persistence (must be set before sign-in)
      await applyAuthPersistence(rememberMe);

      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await ensureProfileSafe(userCredential.user, name);
        await finishLogin(userCredential.user);
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        await ensureProfileSafe(userCredential.user);
        await finishLogin(userCredential.user);
      }
    } catch (err) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-email"
      ) {
        recordLoginFailure();
      }
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use. Please log in.");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Please check your email or password.");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email. Please sign up.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else if (err.code === "auth/too-many-requests") {
        setError(err.message || "Too many attempts. Please wait and try again.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        console.error(err);
        setError(err.message || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-transparent py-3 text-sm text-ink placeholder:text-neutral-400 focus:outline-none disabled:opacity-60";

  return (
    <div className="flex min-h-screen bg-page-gradient">
      <aside className="relative hidden min-h-screen w-[46%] overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col xl:w-[48%]">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-28 -top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-secondary-500/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex h-full min-h-screen w-full flex-1 flex-col px-10 py-11 xl:px-14 xl:py-12">
          <div>
            <img
              src={logo}
              alt="Thaiseva"
              className="h-11 w-auto rounded-xl bg-white px-3.5 py-1.5 object-contain shadow-sm"
            />
            <p className="mt-10 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-300">
              <span className="inline-block h-px w-6 bg-secondary-400" aria-hidden="true" />
              Food portal
            </p>
            <h1 className="mt-4 max-w-md text-4xl font-bold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
              Customers order on ThaiSeva. You handle them here.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
              This portal receives food orders placed on the ThaiSeva app and
              website. Sign in to run the kitchen and keep your menu live.
            </p>
          </div>

          <ul className="mt-10 max-w-md space-y-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="flex items-start gap-3.5 rounded-2xl border border-white/12 bg-white/[0.09] px-4 py-3.5 backdrop-blur-sm"
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tile}`}
                  >
                    <Icon className="text-base" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/65">
                      {item.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-auto pt-12 text-xs leading-relaxed text-white/55">
            New restaurants apply first. A login is created after we accept you.
          </p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[420px] animate-slide-up">
          <div className="mb-7 text-center lg:text-left">
            <img
              src={logo}
              alt="Thaiseva"
              className="mx-auto mb-5 h-10 w-auto object-contain mix-blend-multiply lg:hidden"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              Welcome back
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink-heading sm:text-3xl">
              Sign in
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Sign in to handle orders from the ThaiSeva app and website. Use
              the email and password we shared when you were accepted.
            </p>
          </div>

          <div className="modern-card p-6 shadow-card sm:p-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEmailPasswordAuth();
              }}
              className="space-y-4"
              noValidate
            >
              {isSignUp && (
                <AuthField
                  id="name"
                  label="Name"
                  icon={<FaUserAlt className="text-sm" />}
                >
                  <input
                    type="text"
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError("");
                    }}
                    className={inputClass}
                    placeholder="Your name"
                    required
                    disabled={submitting}
                  />
                </AuthField>
              )}

              <AuthField
                id="email"
                label="Email"
                icon={<FaEnvelope className="text-sm" />}
              >
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={inputClass}
                  placeholder="Email address"
                  required
                  disabled={submitting}
                />
              </AuthField>

              <AuthField
                id="password"
                label="Password"
                icon={<FaLock className="text-sm" />}
              >
                <input
                  type={showpsw ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={inputClass}
                  placeholder="Password"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowpsw((p) => !p)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-subtle hover:bg-neutral-100 hover:text-ink focus-ring"
                  aria-label={showpsw ? "Hide password" : "Show password"}
                  aria-pressed={showpsw}
                >
                  {showpsw ? <FaRegEye /> : <FaRegEyeSlash />}
                </button>
              </AuthField>

              {sessionExpiredMessage && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-sm text-warning-800"
                  role="status"
                >
                  <FaExclamationCircle className="mt-0.5 shrink-0" />
                  <span>{sessionExpiredMessage}</span>
                </div>
              )}
              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm text-danger-700"
                  role="alert"
                >
                  <FaExclamationCircle className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <span className="block text-sm font-medium text-ink">
                    Stay signed in on this device
                  </span>
                  <span className="block text-xs text-ink-subtle">
                    Otherwise you are signed out when the browser closes.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="add-new-btn w-full py-3 text-base"
              >
                {submitting ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

          </div>

          <div className="mt-6 rounded-2xl border border-neutral-100 bg-white/80 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
            <p className="text-sm text-ink-muted">No login yet?</p>
            <Link
              to="/apply"
              className="mt-1 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brand-600 hover:text-brand-700 focus-ring"
            >
              Apply to become a partner
              <FaArrowRight className="text-[11px]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPageAdmin;
