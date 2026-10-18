import { callApi } from "./client";

export const partnerChatApi = (action, payload = {}) =>
  callApi("foodPartnerChat", { ...payload, action });
