import { getFunctions, httpsCallable } from "firebase/functions";
import { app, appCheckReady } from "../../firebaseConfig";

const otpFunctions = getFunctions(app, "asia-east2");

async function callOtp(name, data) {
  if (!(await appCheckReady)) {
    throw new Error("Email verification is unavailable. Please contact support.");
  }
  const response = await httpsCallable(otpFunctions, name)(data);
  return response.data;
}

export const sendEmailOtp = (email) => callOtp("sendEmailOtp", { email });
export const resendEmailOtp = (email, challengeId) =>
  callOtp("resendEmailOtp", { email, challengeId });
export const verifyEmailOtp = (email, challengeId, code) =>
  callOtp("verifyEmailOtp", { email, challengeId, code });
