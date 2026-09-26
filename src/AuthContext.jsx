import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { appCheckReady, auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { ensureUserProfile } from "./api";
import Loading from "./components/Loading";
import { getOnboardingPhase } from "./utils/authRouting";
import { isMasterAdminIdentity } from "./utils/adminIdentity";
import { secureSignOut } from "./utils/authSession";
import {
  clearSession,
  formatSessionExpiryReason,
  readSession,
  touchSessionActivity,
  validateSession,
  writeSession,
  buildSessionRecord,
  DEFAULT_IDLE_MINUTES,
} from "./utils/sessionSecurity";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Master admin is backend-only (custom claims and/or flags set by Admin SDK).
 * Everyone else is a restaurant owner (onboarding → pending → verified).
 */
function deriveRolesFromClaimsAndProfile(claims, roleData, resData, uid, email) {
  const isMasterAdmin = isMasterAdminIdentity(claims, email);

  const isRestaurantAdmin =
    !isMasterAdmin &&
    (claims?.foodRole === "restaurantOwner" ||
      claims?.foodRestaurantOwner === true ||
      (roleData?.isRestaurantAdmin === true &&
        resData?.status === "Verified" &&
        resData?.ownerId === uid));

  return { isMasterAdmin, isRestaurantAdmin };
}

const emptyAuthState = {
  currentUser: null,
  roleData: null,
  resData: null,
  claims: null,
  isMasterAdmin: false,
  isRestaurantAdmin: false,
  onboardingPhase: "start",
  needsOnboarding: false,
  loading: false,
  sessionExpiredReason: null,
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    ...emptyAuthState,
    loading: true,
  });
  const tokenResultRef = useRef(null);
  const endingSessionRef = useRef(false);

  const endSession = useCallback(async (reason) => {
    if (endingSessionRef.current) return;
    endingSessionRef.current = true;
    try {
      await secureSignOut();
    } catch {
      clearSession();
    } finally {
      tokenResultRef.current = null;
      setAuthState({
        ...emptyAuthState,
        loading: false,
        sessionExpiredReason: reason || null,
      });
      endingSessionRef.current = false;
    }
  }, []);

  const refreshAuthProfile = useCallback(
    async (user, { forceRefresh = false } = {}) => {
      if (!user) {
        clearSession();
        tokenResultRef.current = null;
        setAuthState((prev) => ({
          ...emptyAuthState,
          loading: false,
          // keep expiry message if we just signed out for security
          sessionExpiredReason: prev.sessionExpiredReason,
        }));
        return;
      }

      // App Check is intentionally initialized during the browser's first idle
      // period so reCAPTCHA does not compete with the public shell. Authenticated
      // Firestore reads still wait for it, preserving enforcement guarantees.
      await appCheckReady;

      const [tokenResult, userDoc, resDoc] = await Promise.all([
        user.getIdTokenResult(forceRefresh),
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "restaurants", user.uid)),
      ]);

      tokenResultRef.current = tokenResult;

      // Ensure a client session exists (e.g. tab restore with Firebase persistence)
      let session = readSession();
      if (!session || session.uid !== user.uid) {
        session = buildSessionRecord(tokenResult, {
          uid: user.uid,
          rememberMe: Boolean(session?.rememberMe),
        });
        writeSession(session);
      }

      const validation = validateSession({
        uid: user.uid,
        tokenResult,
        session,
      });
      if (!validation.ok) {
        await endSession(validation.reason);
        return;
      }

      const claims = tokenResult.claims || {};
      const roleData = userDoc.exists() ? userDoc.data() : null;
      const resData = resDoc.exists() ? resDoc.data() : null;

      const { isMasterAdmin, isRestaurantAdmin } =
        deriveRolesFromClaimsAndProfile(
          claims,
          roleData,
          resData,
          user.uid,
          user.email
        );

      const onboardingPhase = isMasterAdmin
        ? "complete"
        : getOnboardingPhase(resData, roleData, isRestaurantAdmin);

      const needsOnboarding =
        !isMasterAdmin &&
        (onboardingPhase === "start" ||
          onboardingPhase === "pending" ||
          onboardingPhase === "rejected");

      setAuthState({
        currentUser: user,
        roleData,
        resData,
        claims,
        isMasterAdmin,
        isRestaurantAdmin,
        onboardingPhase,
        needsOnboarding,
        loading: false,
        sessionExpiredReason: null,
      });
    },
    [endSession]
  );

  // Firebase auth + JWT lifecycle
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      try {
        await refreshAuthProfile(user, { forceRefresh: false });
      } catch (error) {
        console.error("Auth state error:", error);
        setAuthState((prev) => ({ ...prev, loading: false }));
      }
    });

    // Keep claims/exp in sync when Firebase refreshes the ID token (~hourly)
    const unsubToken = auth.onIdTokenChanged(async (user) => {
      if (!user) return;
      try {
        const tokenResult = await user.getIdTokenResult(false);
        tokenResultRef.current = tokenResult;
        const session = readSession();
        if (!session) return;
        const validation = validateSession({
          uid: user.uid,
          tokenResult,
          session,
        });
        if (!validation.ok) {
          await endSession(validation.reason);
        }
      } catch (err) {
        console.error("Token change error:", err);
      }
    });

    return () => {
      unsubAuth();
      unsubToken();
    };
  }, [refreshAuthProfile, endSession]);

  // Idle timeout: track activity + periodic session check
  useEffect(() => {
    if (!authState.currentUser) return undefined;

    const onActivity = () => {
      touchSessionActivity();
    };

    const events = ["click", "keydown", "scroll", "touchstart"];
    // Throttle activity writes
    let lastTouch = 0;
    const throttled = () => {
      const now = Date.now();
      if (now - lastTouch < 15_000) return;
      lastTouch = now;
      onActivity();
    };
    events.forEach((e) =>
      window.addEventListener(e, throttled, { passive: true })
    );

    const intervalMs = Math.min(
      60_000,
      Math.max(15_000, (DEFAULT_IDLE_MINUTES * 60 * 1000) / 4)
    );
    const timer = window.setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        // Refresh token if close to expiry; validate idle/max
        const tokenResult =
          tokenResultRef.current || (await user.getIdTokenResult(false));
        const expMs = Number(tokenResult.claims?.exp || 0) * 1000;
        if (expMs && expMs - Date.now() < 5 * 60 * 1000) {
          await user.getIdToken(true);
          tokenResultRef.current = await user.getIdTokenResult(false);
        }
        const validation = validateSession({
          uid: user.uid,
          tokenResult: tokenResultRef.current || tokenResult,
        });
        if (!validation.ok) {
          await endSession(validation.reason);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        await endSession("token_expired");
      }
    }, intervalMs);

    // Visibility: re-check when user returns to the tab
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const user = auth.currentUser;
      if (!user) return;
      try {
        const tokenResult = await user.getIdTokenResult(false);
        tokenResultRef.current = tokenResult;
        const validation = validateSession({
          uid: user.uid,
          tokenResult,
        });
        if (!validation.ok) {
          await endSession(validation.reason);
        } else {
          touchSessionActivity();
        }
      } catch {
        await endSession("token_expired");
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.forEach((e) => window.removeEventListener(e, throttled));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authState.currentUser, endSession]);

  const logout = useCallback(async () => {
    await endSession(null);
    setAuthState({ ...emptyAuthState, loading: false, sessionExpiredReason: null });
  }, [endSession]);

  const clearSessionMessage = useCallback(() => {
    setAuthState((prev) => ({ ...prev, sessionExpiredReason: null }));
  }, []);

  const contextValue = useMemo(
    () => ({
      currentUser: authState.currentUser,
      roleData: authState.roleData,
      resData: authState.resData,
      claims: authState.claims,
      isMasterAdmin: authState.isMasterAdmin,
      isRestaurantAdmin: authState.isRestaurantAdmin,
      onboardingPhase: authState.onboardingPhase,
      needsOnboarding: authState.needsOnboarding,
      loading: authState.loading,
      sessionExpiredReason: authState.sessionExpiredReason,
      sessionExpiredMessage: authState.sessionExpiredReason
        ? formatSessionExpiryReason(authState.sessionExpiredReason)
        : null,
      clearSessionMessage,
      logout,
      refreshAuthProfile: (opts) =>
        refreshAuthProfile(auth.currentUser, {
          forceRefresh: opts?.forceRefresh !== false,
        }),
      ensureProfile: ensureUserProfile,
    }),
    [authState, refreshAuthProfile, logout, clearSessionMessage]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {authState.loading ? (
        <div className="min-h-screen flex items-center justify-center bg-page-gradient">
          <Loading />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
