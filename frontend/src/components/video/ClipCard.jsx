import { Download, PencilLine, Play, RefreshCw, Timer } from "lucide-react";
import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { formatBytes, formatTime, parseTime } from "../../lib/videoFormat";
import { videoApi } from "../../services/videoApi";
import CopyButton from "../CopyButton";
import { Badge, Button, Card, DemoBadge, Spinner, TextArea, TextInput } from "../ui";
import VideoStatusBadge from "./VideoStatusBadge";
import YouTubeEmbed from "./YouTubeEmbed";

function hashtagLine(tags) {
  return (tags || []).map((tag) => `#${tag}`).join(" ");
}

function PreviewArea({ clip, previewUrl, mediaType }) {
  const frame = "flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-lg p-4 text-center text-sm";
  if (clip.render_status === "rendered" && previewUrl) {
    return (
      <video
        src={previewUrl}
        controls
        playsInline
        preload="metadata"
        className="aspect-[9/16] w-full rounded-lg bg-ink object-contain"
        aria-label={`Preview of ${clip.title}`}
      />
    );
  }
  if (clip.render_status === "queued" || clip.render_status === "rendering") {
    return (
      <div className={`${frame} border border-line bg-mist text-subtle`} role="status">
        <Spinner className="size-6 text-ink" />
        {clip.render_status === "queued" ? "Waiting to render…" : "Rendering vertical video…"}
      </div>
    );
  }
  return (
    <div className={`${frame} border border-dashed border-muted/40 bg-canvas text-muted`}>
      <Timer className="size-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-medium text-graphite">Timestamp suggestion</p>
      <p>
        {clip.render_status === "failed"
          ? clip.render_error || "Rendering failed."
          : mediaType === "audio"
            ? "Audio source: no video file is rendered."
            : clip.render_error || "Not rendered yet."}
      </p>
    </div>
  );
}

function ClipEditor({ clip, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: clip.title,
    hook: clip.hook,
    caption: clip.caption,
    cta: clip.cta,
    hashtags: (clip.hashtags || []).join(" "),
    start: formatTime(clip.start_seconds),
    end: formatTime(clip.end_seconds),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    const start = parseTime(form.start);
    const end = parseTime(form.end);
    if (start === null || end === null) return setError("Use times like 1:05 or 65.");
    if (end <= start) return setError("End time must be after start time.");

    const changes = {
      title: form.title.trim(),
      hook: form.hook,
      caption: form.caption,
      cta: form.cta,
      hashtags: form.hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean),
    };
    // Only send times if they changed (formatting rounds to whole seconds).
    if (formatTime(start) !== formatTime(clip.start_seconds)) changes.start_seconds = start;
    if (formatTime(end) !== formatTime(clip.end_seconds)) changes.end_seconds = end;

    setSaving(true);
    setError("");
    try {
      const updated = await videoApi.updateClip(clip.id, changes);
      toast.success(changes.start_seconds !== undefined || changes.end_seconds !== undefined
        ? "Saved. Timestamps changed, so render the clip again."
        : "Clip saved.");
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput label="Title" required value={form.title} onChange={set("title")} maxLength={200} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Start" hint="m:ss" value={form.start} onChange={set("start")} />
        <TextInput label="End" hint="m:ss" value={form.end} onChange={set("end")} />
      </div>
      <TextArea label="Opening hook" rows={2} value={form.hook} onChange={set("hook")} maxLength={500} />
      <TextArea label="Caption" rows={3} value={form.caption} onChange={set("caption")} maxLength={2200} />
      <TextInput label="Call to action" value={form.cta} onChange={set("cta")} maxLength={300} />
      <TextInput label="Hashtags" hint="Separate with spaces." value={form.hashtags} onChange={set("hashtags")} />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>Save clip</Button>
      </div>
    </form>
  );
}

/** One AI-selected moment: real rendered video when available, otherwise clearly a suggestion. */
export default function ClipCard({ clip, number, mediaType, canRender, onChange, youtubeVideoId, selected, onToggleSelect }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [rendering, setRendering] = useState(false);
  // Keep the first signed link so polling doesn't restart a playing video.
  const [previewUrl] = useState(clip.preview_url);
  const [downloadUrl] = useState(clip.download_url);

  const busy = clip.render_status === "queued" || clip.render_status === "rendering";
  const showRender = canRender && !busy && clip.render_status !== "unavailable";

  async function handleRender() {
    setRendering(true);
    try {
      onChange(await videoApi.renderClip(clip.id));
      toast.info("Rendering started.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRendering(false);
    }
  }

  const copyText = [clip.caption, clip.cta, hashtagLine(clip.hashtags)].filter(Boolean).join("\n\n");

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select clip ${number}`}
          />
        )}
        <span className="text-xs font-semibold tabular-nums text-muted">{String(number).padStart(2, "0")}</span>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-ink" title={clip.title}>{clip.title}</h3>
        {clip.provider === "mock" && <DemoBadge />}
        <VideoStatusBadge status={clip.render_status} kind="clip" />
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,11rem)_1fr]">
        <div className="mx-auto w-full max-w-44 sm:max-w-none">
          <PreviewArea clip={clip} previewUrl={previewUrl} mediaType={mediaType} />
          <p className="mt-2 text-center text-xs tabular-nums text-muted">
            {formatTime(clip.start_seconds)}–{formatTime(clip.end_seconds)} · {Math.round(clip.duration_seconds)}s
            {clip.file_size_bytes ? ` · ${formatBytes(clip.file_size_bytes)}` : ""}
          </p>
          {youtubeVideoId && clip.render_status !== "rendered" && (
            <Button variant="ghost" size="sm" className="mt-1 w-full" aria-expanded={showYouTube} onClick={() => setShowYouTube((v) => !v)}>
              {!showYouTube && <Play className="size-3.5" aria-hidden="true" />}
              {showYouTube ? "Hide YouTube preview" : "Watch on YouTube"}
            </Button>
          )}
        </div>

        <div className="min-w-0">
          {editing ? (
            <ClipEditor
              clip={clip}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setEditing(false);
                onChange(updated);
              }}
            />
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Opening hook</h4>
                <p className="mt-1 font-semibold text-ink">{clip.hook}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Caption</h4>
                <p className="mt-1 whitespace-pre-wrap text-graphite">{clip.caption}</p>
                {clip.cta && <p className="mt-1 font-medium text-graphite">{clip.cta}</p>}
                {clip.hashtags?.length > 0 && <p className="mt-1 text-ink">{hashtagLine(clip.hashtags)}</p>}
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Why this moment</h4>
                <p className="mt-1 text-graphite">{clip.reason}</p>
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-subtle hover:text-ink">
                  Transcript excerpt
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-subtle">{clip.transcript_excerpt}</p>
              </details>
            </div>
          )}
        </div>
      </div>

      {showYouTube && youtubeVideoId && (
        <div className="border-t border-line px-5 py-4">
          <YouTubeEmbed videoId={youtubeVideoId} title={clip.title} start={clip.start_seconds} end={clip.end_seconds} />
          <p className="mt-2 text-xs text-muted">Streaming from YouTube. This is a preview, not a downloadable file.</p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-5 py-3">
          {clip.render_status === "rendered" && downloadUrl && (
            <a
              href={downloadUrl}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-paper shadow-xs transition-colors hover:bg-graphite"
            >
              <Download className="size-3.5" aria-hidden="true" /> Download MP4
            </a>
          )}
          <CopyButton text={copyText} label="Copy caption" />
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={busy}>
            <PencilLine className="size-3.5" aria-hidden="true" /> Edit
          </Button>
          {showRender && (
            <Button variant="secondary" size="sm" onClick={handleRender} loading={rendering}>
              {!rendering && <RefreshCw className="size-3.5" aria-hidden="true" />}
              {clip.render_status === "rendered" ? "Re-render" : "Render video"}
            </Button>
          )}
          {clip.render_status === "unavailable" && <Badge>Suggestions only for audio</Badge>}
        </div>
      )}
    </Card>
  );
}
