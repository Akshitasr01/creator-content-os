/**
 * Backend calls for AI Video-to-Reels. Same auth model as services/api.js:
 * every request carries the Supabase access token; the browser never talks to
 * the AI provider or writes video data to Supabase directly.
 */
import { API_BASE_URL } from "../lib/apiBase";
import { supabase } from "../lib/supabaseClient";
import { ApiError } from "./api";

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
async function uploadForm(path, form, onProgress) {
  const headers = await authHeader();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
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

function upload({ file, title, clipCount, kind }, onProgress) {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("clip_count", String(clipCount));
  form.append("kind", kind);
  return uploadForm("/videos/upload", form, onProgress);
}

function attachOriginal(id, file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  return uploadForm(`/videos/${id}/original-file`, form, onProgress);
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

  // YouTube (the video itself is never downloaded)
  validateYouTube: (url) => request("/youtube/validate", { method: "POST", body: { url } }),
  fromYouTube: ({ url, title, clipCount }) =>
    request("/videos/from-youtube", { method: "POST", body: { url, title, clip_count: clipCount } }),
  submitTranscript: (id, text) => request(`/videos/${id}/transcript`, { method: "POST", body: { text } }),
  youtubeCaptions: (id, accessToken) =>
    request(`/videos/${id}/youtube-captions`, { method: "POST", body: { access_token: accessToken } }),
  attachOriginal,
  renderClips: (id, clipIds) => request(`/videos/${id}/render`, { method: "POST", body: { clip_ids: clipIds } }),
};

export const IN_PROGRESS_STATUSES = new Set(["queued", "downloading", "transcribing", "selecting", "rendering"]);
