export function getOnboardingPhase(resData, roleData, isRestaurantAdmin) {
  const status = resData?.status || roleData?.applicationStatus || null;

  if (isRestaurantAdmin || status === "Verified") return "complete";
  if (status === "Pending") return "pending";
  if (status === "Rejected") return "rejected";
  return "start";
}
