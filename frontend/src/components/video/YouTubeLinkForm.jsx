import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../hooks/useToast";
import { formatTime } from "../../lib/videoFormat";
import { clearPendingVideoUrl, isYouTubeUrl, peekPendingVideoUrl } from "../../lib/pendingVideoUrl";
import { videoApi } from "../../services/videoApi";
import { Alert, Button, Card, TextInput } from "../ui";
import YouTubeEmbed from "./YouTubeEmbed";

/** YouTube link -> validate on the server -> official preview -> create project. */
export default function YouTubeLinkForm({ capabilities }) {
  const navigate = useNavigate();
  const toast = useToast();
  // Pre-fill a YouTube link typed on the landing page, then forget it.
  const [url, setUrl] = useState(() => {
    const pending = peekPendingVideoUrl();
    return isYouTubeUrl(pending) ? pending : "";
  });
  useEffect(() => clearPendingVideoUrl(), []);
  const [info, setInfo] = useState(null); // validated preview for `validatedUrl`
  const [validatedUrl, setValidatedUrl] = useState("");
  const [title, setTitle] = useState("");
  const [clipCount, setClipCount] = useState(5);
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isValidated = info && validatedUrl === url.trim();

  async function handleValidate(event) {
    event?.preventDefault();
    if (!url.trim()) return setError("Paste a YouTube link.");
    setValidating(true);
    setError("");
    setInfo(null);
    try {
      const result = await videoApi.validateYouTube(url.trim());
      setInfo(result);
      setValidatedUrl(url.trim());
      setTitle((current) => current || result.title);
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const source = await videoApi.fromYouTube({ url: validatedUrl, title: title.trim() || info.title, clipCount });
      toast.success("YouTube project created. Next: add its transcript.");
      navigate(`/videos/${source.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <form onSubmit={handleValidate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput
            className="flex-1"
            label="YouTube video link"
            required
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button type="submit" variant={isValidated ? "secondary" : "primary"} loading={validating}>
            {isValidated && <Check className="size-4" aria-hidden="true" />}
            {isValidated ? "Validated" : "Validate link"}
          </Button>
        </form>
        <p className="text-xs text-muted">
          Supported: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, youtube.com/live/…, youtube.com/embed/…
        </p>
        {error && <Alert>{error}</Alert>}
      </Card>

      {info && (
        <Card className="overflow-hidden">
          <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr]">
            {info.embeddable ? (
              <YouTubeEmbed videoId={info.video_id} title={info.title} />
            ) : (
              info.thumbnail_url && <img src={info.thumbnail_url} alt="" className="w-full rounded-lg" />
            )}
            <div className="space-y-4">
              <div>
                <p className="font-semibold leading-snug text-ink">{info.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {info.channel_title}
                  {info.duration_seconds ? ` · ${formatTime(info.duration_seconds)}` : ""}
                </p>
                {info.has_captions === false && (
                  <p className="mt-2 text-xs text-subtle">YouTube reports no captions yet; you can paste a transcript or upload the original.</p>
                )}
              </div>
              <TextInput label="Project title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              <div>
                <label htmlFor="yt-clip-count" className="mb-1.5 flex justify-between text-sm font-medium text-graphite">
                  <span>Number of clips</span>
                  <span className="tabular-nums text-ink">{clipCount}</span>
                </label>
                <input
                  id="yt-clip-count"
                  type="range"
                  min={1}
                  max={capabilities?.max_clips || 10}
                  value={clipCount}
                  onChange={(e) => setClipCount(Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </div>
              <Button className="w-full" size="lg" onClick={handleCreate} loading={creating} disabled={!isValidated}>
                Continue: add transcript
              </Button>
              {!isValidated && <p className="text-xs text-subtle">The link changed. Validate it again.</p>}
            </div>
          </div>
        </Card>
      )}

      <Alert tone="info" title="How YouTube links work">
        The preview streams from YouTube; nothing is downloaded. Clips are chosen from the video's transcript (YouTube captions
        with your Google sign-in, or a pasted transcript). To get <strong>downloadable MP4s</strong>, attach your original video
        file. Without it you get accurate timestamps, hooks and captions to use in YouTube Studio's "Create Short".
      </Alert>
    </div>
  );
}
