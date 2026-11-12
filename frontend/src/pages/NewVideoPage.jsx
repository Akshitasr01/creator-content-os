import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { FileCheck2, UploadCloud } from "lucide-react";

import { Alert, BackLink, Button, Card, IconTile, PageHeader, PageSpinner, TextInput } from "../components/ui";
import { useApiData } from "../hooks/useApiData";
import { useToast } from "../hooks/useToast";
import { clearPendingVideoUrl, isYouTubeUrl, peekPendingVideoUrl } from "../lib/pendingVideoUrl";
import { formatBytes } from "../lib/videoFormat";
import { videoApi } from "../services/videoApi";
import YouTubeLinkForm from "../components/video/YouTubeLinkForm";

const MODES = {
  youtube: {
    title: "YouTube video",
    description: "Paste a YouTube link to preview it, then add its transcript to find the strongest clip moments.",
  },
  link: {
    title: "Direct video file URL",
    description: "Paste a direct link to a video file you own. We'll transcribe it and cut the strongest moments into vertical reels.",
  },
  upload: {
    title: "Upload a video",
    description: "We'll transcribe it, find the strongest self-contained moments and render 9:16 clips with subtitles.",
  },
  audio: {
    title: "Upload audio",
    description: "We'll transcribe it and suggest the strongest clip moments with timestamps, hooks and captions.",
  },
};

function FileDrop({ accept, file, onFile, maxMb }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors focus-within:border-ink ${
        dragging ? "border-ink bg-mist" : "border-muted/50 bg-canvas hover:border-ink/40 hover:bg-mist"
      }`}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(event) => event.target.files[0] && onFile(event.target.files[0])} />
      {file ? (
        <>
          <IconTile icon={FileCheck2} inverted />
          <p className="mt-3 font-medium text-ink">{file.name}</p>
          <p className="text-sm text-muted">{formatBytes(file.size)} · click to choose a different file</p>
        </>
      ) : (
        <>
          <IconTile icon={UploadCloud} />
          <p className="mt-3 font-medium text-ink">Drop a file here or click to browse</p>
          <p className="text-sm text-muted">
            {accept.replaceAll(",", ", ")} · up to {maxMb >= 1024 ? `${maxMb / 1024} GB` : `${maxMb} MB`}
          </p>
        </>
      )}
    </label>
  );
}

export default function NewVideoPage() {
  const [params] = useSearchParams();
  const mode = params.get("source");
  const navigate = useNavigate();
  const toast = useToast();
  const caps = useApiData(useCallback(() => videoApi.capabilities(), []));

  const [title, setTitle] = useState("");
  // Pre-fill a direct video link typed on the landing page, then forget it.
  const [url, setUrl] = useState(() => {
    const pending = mode === "link" ? peekPendingVideoUrl() : "";
    return pending && !isYouTubeUrl(pending) ? pending : "";
  });
  useEffect(() => {
    if (mode === "link") clearPendingVideoUrl();
  }, [mode]);
  const [file, setFile] = useState(null);
  const [clipCount, setClipCount] = useState(5);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  if (!MODES[mode]) return <Navigate to="/create" replace />;
  if (caps.loading) return <PageSpinner />;

  const capabilities = caps.data;
  const accept = capabilities
    ? (mode === "audio" ? capabilities.audio_extensions : capabilities.video_extensions).join(",")
    : "";
  const notReady = capabilities && (!capabilities.transcription || !capabilities.rendering);

  function validate() {
    const next = {};
    if (!title.trim()) next.title = "Give the project a title.";
    if (mode === "link" && !/^https:\/\/\S+$/i.test(url.trim())) next.url = "Enter a full link starting with https://";
    if (mode !== "link" && !file) next.file = "Choose a file to upload.";
    if (file && capabilities && file.size > capabilities.max_upload_mb * 1024 * 1024) {
      next.file = `This file is larger than the ${capabilities.max_upload_mb} MB limit.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      const source =
        mode === "link"
          ? await videoApi.fromUrl({ title: title.trim(), url: url.trim(), clipCount })
          : await videoApi.upload({ file, title: title.trim(), clipCount, kind: mode === "audio" ? "audio" : "video" }, setUploadProgress);
      toast.success("Processing started. This page updates automatically.");
      navigate(`/videos/${source.id}`);
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  const header = (
    <PageHeader
      eyebrow={<BackLink to="/create">Choose a different source</BackLink>}
      title={MODES[mode].title}
      description={MODES[mode].description}
    />
  );

  // YouTube links need neither FFmpeg nor local transcription to get started.
  if (mode === "youtube") {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        {caps.error && <Alert className="mb-6">{caps.error}</Alert>}
        <YouTubeLinkForm capabilities={capabilities} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {header}

      {caps.error && <Alert className="mb-6">{caps.error}</Alert>}
      {notReady && (
        <Alert tone="warning" title="Server setup incomplete" className="mb-6">
          {!capabilities.transcription && "Transcription (faster-whisper) is not installed. "}
          {!capabilities.rendering && (capabilities.ffmpeg_message || "FFmpeg is not installed, so media can't be processed. ")}
        </Alert>
      )}
      {capabilities?.ai_provider === "mock" && (
        <Alert tone="info" className="mb-6">
          Demo mode: transcription and rendering are real, but clip choices and captions come from simple rules and are
          labelled <strong>Demo output</strong>. Set AI_PROVIDER=openai for AI selection.
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card className="space-y-5 p-5">
          <TextInput
            label="Project title"
            required
            placeholder="DSA roadmap livestream"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={200}
          />

          {mode === "link" ? (
            <div className="space-y-3">
              <TextInput
                label="Video file link"
                required
                type="url"
                placeholder="https://cdn.example.com/my-talk.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={errors.url}
              />
              <div className="rounded-lg border border-line bg-canvas p-4 text-sm text-subtle">
                <p className="font-medium text-graphite">Supported links</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Direct <strong>https</strong> links to a media file you own or have rights to, ending in {capabilities?.video_extensions.join(", ")} (or audio).</li>
                  <li>
                    <strong>Not supported here:</strong> Instagram, TikTok, Facebook, X, Vimeo and similar pages, which don't permit
                    downloading by third-party tools. For YouTube, use the{" "}
                    <Link to="/videos/new?source=youtube" className="font-medium text-ink underline underline-offset-4">YouTube link</Link> option.
                    For other platforms, download your own video from their creator tools, then{" "}
                    <Link to="/videos/new?source=upload" className="font-medium text-ink underline underline-offset-4">upload it</Link>.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-sm font-medium text-graphite">
                {mode === "audio" ? "Audio file" : "Video file"} <span className="text-danger">*</span>
              </p>
              <FileDrop accept={accept} file={file} maxMb={capabilities?.max_upload_mb || 0} onFile={(f) => { setFile(f); setErrors((c) => ({ ...c, file: undefined })); }} />
              {errors.file && <p className="mt-1.5 text-sm text-danger">{errors.file}</p>}
              <p className="mt-1.5 text-xs text-muted">
                Only upload content you own or have permission to use. Max length {capabilities?.max_duration_minutes} minutes.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="clip-count" className="mb-1.5 flex justify-between text-sm font-medium text-graphite">
              <span>Number of clips</span>
              <span className="tabular-nums text-ink">{clipCount}</span>
            </label>
            <input
              id="clip-count"
              type="range"
              min={1}
              max={capabilities?.max_clips || 10}
              value={clipCount}
              onChange={(e) => setClipCount(Number(e.target.value))}
              className="w-full accent-ink"
            />
            <p className="mt-1 text-xs text-muted">Up to 10. Fewer clips are returned if the recording has fewer strong moments.</p>
          </div>
        </Card>

        {mode === "audio" && (
          <Alert tone="info">Audio sources produce clip <strong>suggestions</strong> (timestamps, hooks, captions). No video file is rendered.</Alert>
        )}
        {serverError && <Alert title="Couldn't start processing">{serverError}</Alert>}

        {uploadProgress !== null && (
          <div aria-live="polite">
            <div className="mb-1 flex justify-between text-sm text-subtle">
              <span>{uploadProgress < 1 ? "Uploading…" : "Upload complete, checking the file…"}</span>
              <span className="tabular-nums">{Math.round(uploadProgress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-mist">
              <div className="h-full bg-ink transition-all" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={submitting} disabled={notReady}>
            {mode === "audio" ? "Find clip moments" : "Generate clips"}
          </Button>
        </div>
      </form>
    </div>
  );
}
