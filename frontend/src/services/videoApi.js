/**
 * Backend calls for AI Video-to-Reels. Same auth model as services/api.js:
 * every request carries the Supabase access token; the browser never talks to
 * the AI provider or writes video data to Supabase directly.
 */
import { supabase } from "../lib/supabaseClient";
import { ApiError } from "./api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return `Request failed (${status}).`;
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that the backend is running and try again.", 0, "network");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(data, response.status), response.status, data?.code);
  return data;
}

/** Multipart upload with progress (fetch can't report upload progress). */
async function upload({ file, title, clipCount, kind }, onProgress) {
  const headers = await authHeader();
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("clip_count", String(clipCount));
  form.append("kind", kind);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/videos/upload`);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    xhr.onerror = () =>
      reject(new ApiError("Upload failed. Check your connection and that the backend is running.", 0, "network"));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(errorMessage(data, xhr.status), xhr.status, data?.code));
    };
    xhr.send(form);
  });
}

export const videoApi = {
  capabilities: () => request("/videos/capabilities"),
  list: () => request("/videos"),
  get: (id) => request(`/videos/${id}`),
  fromUrl: ({ title, url, clipCount }) =>
    request("/videos/from-url", { method: "POST", body: { title, url, clip_count: clipCount } }),
  upload,
  retry: (id) => request(`/videos/${id}/retry`, { method: "POST" }),
  createTextProject: (id) => request(`/videos/${id}/text-project`, { method: "POST" }),
  updateClip: (id, changes) => request(`/video-clips/${id}`, { method: "PATCH", body: changes }),
  renderClip: (id) => request(`/video-clips/${id}/render`, { method: "POST" }),
};

export const IN_PROGRESS_STATUSES = new Set(["queued", "downloading", "transcribing", "selecting", "rendering"]);
