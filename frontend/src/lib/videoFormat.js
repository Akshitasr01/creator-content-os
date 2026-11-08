/** 75.4 -> "1:15", 3725 -> "1:02:05" */
export function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "1:15" / "1:02:05" / "75" / "75.5" -> seconds, or null if invalid */
export function parseTime(text) {
  const value = String(text).trim();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  if (!/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(value)) return null;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

export function formatBytes(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export const SOURCE_KIND_LABELS = { url: "Video link", upload: "Uploaded video", audio: "Audio" };
