/**
 * A video link typed on the landing page, kept for this browser tab so it
 * survives sign-up / sign-in and can pre-fill the YouTube or link form.
 */
const KEY = "cco.pendingVideoUrl";

export function isYouTubeUrl(value) {
  return /^(https?:\/\/)?([\w-]+\.)?(youtube\.com|youtu\.be)\//i.test(value.trim());
}

export function savePendingVideoUrl(url) {
  try {
    sessionStorage.setItem(KEY, url.trim());
  } catch {
    // Storage blocked (private mode etc.): the user just pastes the link again.
  }
}

export function peekPendingVideoUrl() {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingVideoUrl() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Where a saved link should open: the YouTube flow or the direct-URL flow. */
export function pendingVideoPath(url) {
  return isYouTubeUrl(url) ? "/videos/new?source=youtube" : "/videos/new?source=link";
}
