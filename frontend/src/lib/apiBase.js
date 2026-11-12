/**
 * Backend base URL, shared by services/api.js and services/videoApi.js.
 *
 * Production builds must set VITE_API_BASE_URL (vite.config.js stops the
 * build otherwise). The localhost fallback exists only for `npm run dev`.
 */
const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();

export const API_BASE_URL = (configured || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")).replace(/\/+$/, "");
