/**
 * The ONLY place the frontend talks to FastAPI.
 *
 * Every request carries the Supabase access token so the backend can verify
 * who is calling. The browser never talks to OpenAI and never writes app data
 * to Supabase directly - Supabase is used from the browser for auth only.
 */
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function messageFrom(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  // FastAPI request-validation errors: [{loc, msg}, ...]
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = first.loc?.filter((part) => part !== "body").join(" → ");
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  return `Request failed (${status}).`;
}

async function request(path, { method = "GET", body } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Check that the backend is running and try again.",
      0,
      "network"
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(messageFrom(data, response.status), response.status, data?.code);
  }
  return data;
}

export const api = {
  health: () => request("/health"),

  // Creator profile
  getProfile: () => request("/creator-profile"),
  saveProfile: (profile) => request("/creator-profile", { method: "PUT", body: profile }),
  getUsage: () => request("/usage"),

  // Projects
  listProjects: () => request("/projects"),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (project) => request("/projects", { method: "POST", body: project }),
  updateAnalysis: (id, analysis) =>
    request(`/projects/${id}/analysis`, { method: "PUT", body: { analysis } }),

  // AI pipeline
  analyzeProject: (id) => request(`/projects/${id}/analyze`, { method: "POST" }),
  generateIdeas: (id) => request(`/projects/${id}/ideas`, { method: "POST" }),
  generateContent: (id, outputs, ideaIndexes = []) =>
    request(`/projects/${id}/generate`, {
      method: "POST",
      body: { outputs, idea_indexes: ideaIndexes },
    }),

  // Single assets
  updateContent: (id, changes) => request(`/content/${id}`, { method: "PATCH", body: changes }),
  rewriteContent: (id, instruction) =>
    request(`/content/${id}/rewrite`, { method: "POST", body: { instruction } }),
  sendFeedback: (id, feedback) =>
    request(`/content/${id}/feedback`, { method: "POST", body: feedback }),
};
