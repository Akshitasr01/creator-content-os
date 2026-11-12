import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { requestYouTubeAccessToken } from "../../lib/googleAuth";
import { formatBytes } from "../../lib/videoFormat";
import { videoApi } from "../../services/videoApi";
import { Alert, Button, Card, CardHeader, Tabs, TextArea } from "../ui";

/** Upload the creator's own copy of the YouTube video (needed for real MP4 clips). */
export function OriginalFileUpload({ video, capabilities, onUpdated, compact = false }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const accept = (capabilities?.video_extensions || [".mp4", ".mov", ".webm"]).join(",");

  async function handleUpload() {
    if (!file) return setError("Choose the original video file first.");
    setError("");
    setProgress(0);
    try {
      await videoApi.attachOriginal(video.id, file, setProgress);
      toast.success("Original video attached.");
      onUpdated();
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-subtle">
          Download your own video from YouTube Studio (<strong>Content</strong> → hover the video → <strong>⋮ Options</strong> →{" "}
          <strong>Download</strong>) and upload it here. It must be the same video so the clip times line up.
        </p>
      )}
      {capabilities && !capabilities.rendering && (
        <Alert tone="warning">{capabilities.ffmpeg_message}</Alert>
      )}
      <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-muted/50 bg-canvas px-4 py-6 text-center text-sm transition-colors hover:border-ink/40 hover:bg-mist focus-within:border-ink">
        <input type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files[0] && setFile(e.target.files[0])} />
        {file ? (
          <span><strong>{file.name}</strong> · {formatBytes(file.size)} <span className="text-muted">(click to change)</span></span>
        ) : (
          <span className="text-subtle">Click to choose the original video file ({accept.replaceAll(",", ", ")})</span>
        )}
      </label>
      {progress !== null && (
        <div aria-live="polite">
          <div className="mb-1 flex justify-between text-xs text-subtle">
            <span>{progress < 1 ? "Uploading…" : "Checking the file…"}</span>
            <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-mist">
            <div className="h-full bg-ink transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button onClick={handleUpload} loading={progress !== null} disabled={!file || (capabilities && !capabilities.rendering)}>
        Attach original video
      </Button>
    </div>
  );
}

const TABS = [
  { key: "captions", label: "Get captions from YouTube" },
  { key: "paste", label: "Paste transcript" },
  { key: "original", label: "Upload original video" },
];

/** Shown while a YouTube project waits for a timestamped transcript. */
export function TranscriptOptions({ video, capabilities, onUpdated }) {
  const toast = useToast();
  const clientId = capabilities?.google_oauth_client_id;
  const [tab, setTab] = useState(clientId ? "captions" : "paste");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action, successMessage) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(successMessage);
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const getCaptions = () =>
    run(async () => {
      const token = await requestYouTubeAccessToken(clientId);
      await videoApi.youtubeCaptions(video.id, token);
    }, "Captions received. Finding the strongest moments…");

  const submitPaste = () => {
    if (text.trim().length < 10) return setError("Paste the transcript first.");
    return run(() => videoApi.submitTranscript(video.id, text), "Transcript added. Finding the strongest moments…");
  };

  return (
    <Card>
      <CardHeader
        title="Step 1 · Add the transcript"
        description="Clips are chosen from a timestamped transcript. YouTube doesn't allow apps to download videos, so pick one option."
      />
      <div className="px-5 pt-5">
        <Tabs
          label="Transcript source"
          value={tab}
          onChange={(key) => {
            setTab(key);
            setError("");
          }}
          items={TABS.map((option) => ({ value: option.key, label: option.label }))}
        />
      </div>

      <div className="space-y-4 p-5">
        {tab === "captions" &&
          (clientId ? (
            <>
              <p className="text-sm text-subtle">
                Sign in with the Google account that <strong>owns this video's channel</strong>. YouTube only shares caption files
                with the video's owner or editors. We use the permission once to read the captions and don't store it.
              </p>
              <Button onClick={getCaptions} loading={busy}>Sign in with Google and get captions</Button>
            </>
          ) : (
            <Alert tone="info" title="Google sign-in isn't set up on this server">
              Ask the administrator to add <code>GOOGLE_OAUTH_CLIENT_ID</code> (README → "YouTube setup"). Meanwhile, paste the
              transcript or upload the original video.
            </Alert>
          ))}

        {tab === "paste" && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-subtle">
              <li>Open the video on YouTube and click <strong>…more</strong> under the title.</li>
              <li>Click <strong>Show transcript</strong> (timestamps must be visible).</li>
              <li>Select all transcript lines, copy, and paste them below. SRT/VTT caption files also work.</li>
            </ol>
            <TextArea
              label="Timestamped transcript"
              rows={10}
              placeholder={"0:00\nMost students learn DP in the wrong order.\n0:05\nThat is the biggest mistake…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button onClick={submitPaste} loading={busy}>Use this transcript</Button>
          </>
        )}

        {tab === "original" && (
          <>
            <p className="text-sm text-subtle">
              We'll transcribe it locally <strong>and</strong> render real 9:16 MP4 clips with subtitles.
            </p>
            <OriginalFileUpload video={video} capabilities={capabilities} onUpdated={onUpdated} compact />
          </>
        )}

        {error && <Alert>{error}</Alert>}
      </div>
    </Card>
  );
}
