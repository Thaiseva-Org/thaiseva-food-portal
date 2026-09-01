import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const requiredEnv = (key) => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const functions = getFunctions(app, "asia-southeast1");

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const appCheckReady =
  appCheckSiteKey && typeof window !== "undefined"
    ? new Promise((resolve) => {
        const initialize = () => {
          import("firebase/app-check")
            .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
              resolve(
                initializeAppCheck(app, {
                  provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
                  isTokenAutoRefreshEnabled: true,
                })
              )
            )
            .catch((error) => {
              console.error("Firebase App Check could not initialize:", error);
              resolve(null);
            });
        };

        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(initialize, { timeout: 1200 });
        } else {
          window.setTimeout(initialize, 0);
        }
      })
    : Promise.resolve(null);

export { auth, db, storage, functions, app, appCheckReady };
