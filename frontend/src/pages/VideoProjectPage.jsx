import { Check, Circle, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Alert, BackLink, Button, Card, CardHeader, Disclosure, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import ClipCard from "../components/video/ClipCard";
import ProcessingStatus from "../components/video/ProcessingStatus";
import VideoStatusBadge from "../components/video/VideoStatusBadge";
import { OriginalFileUpload, TranscriptOptions } from "../components/video/YouTubePanels";
import YouTubeEmbed from "../components/video/YouTubeEmbed";
import { useApiData } from "../hooks/useApiData";
import { useToast } from "../hooks/useToast";
import { formatTime, SOURCE_KIND_LABELS } from "../lib/videoFormat";
import { IN_PROGRESS_STATUSES, videoApi } from "../services/videoApi";

const POLL_MS = 3000;

function isBusy(video) {
  return (
    IN_PROGRESS_STATUSES.has(video.status) ||
    video.clips.some((clip) => clip.render_status === "queued" || clip.render_status === "rendering")
  );
}

/** Loads the video project and re-checks every few seconds while it is processing. */
function usePolledVideo(videoId) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    videoApi
      .get(videoId)
      .then((data) => active && setState({ data, error: "", loading: false }))
      .catch((error) => active && setState((current) => ({ ...current, error: error.message, loading: false })));
    return () => {
      active = false;
    };
  }, [videoId, tick]);

  const busy = state.data ? isBusy(state.data) : false;
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setTimeout(() => setTick((t) => t + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [busy, state.data]);

  const refresh = () => setTick((t) => t + 1);
  const setData = (updater) => setState((current) => ({ ...current, data: updater(current.data) }));
  return { ...state, refresh, setData };
}

function ChecklistItem({ done, children }) {
  return (
    <li className={`flex items-center gap-2.5 ${done ? "text-ink" : "text-muted"}`}>
      {done ? (
        <span className="flex size-4 items-center justify-center rounded-full bg-ink text-paper" aria-hidden="true">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : (
        <Circle className="size-4 text-line" strokeWidth={2} aria-hidden="true" />
      )}
      <span>{children}</span>
      <span className="sr-only">{done ? "(done)" : "(to do)"}</span>
    </li>
  );
}

function TranscriptPanel({ segments }) {
  return (
    <Disclosure summary={`Timestamped transcript (${segments.length} lines)`}>
      <ol className="max-h-96 space-y-1 overflow-y-auto px-5 py-4 text-sm">
        {segments.map((segment, index) => (
          <li key={index} className="flex gap-3">
            <span className="w-12 shrink-0 tabular-nums text-muted">{formatTime(segment.start)}</span>
            <span className="text-graphite">{segment.text}</span>
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

function VideoWorkspace({ videoId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: video, error, loading, refresh, setData } = usePolledVideo(videoId);
  const [retrying, setRetrying] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [renderingSelected, setRenderingSelected] = useState(false);
  const capabilities = useApiData(useCallback(() => videoApi.capabilities(), [])).data;

  if (loading) return <PageSpinner label="Loading video project…" />;
  if (!video) {
    return (
      <Alert title="We couldn't open this video project" action={<Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>}>
        {error}
      </Alert>
    );
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await videoApi.retry(videoId);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRetrying(false);
    }
  }

  async function handleTextProject() {
    setCreatingProject(true);
    try {
      const result = await videoApi.createTextProject(videoId);
      if (result.truncated) toast.info("The transcript was long, so the first 30,000 characters were used.");
      navigate(`/projects/${result.project_id}`);
    } catch (err) {
      toast.error(err.message);
      setCreatingProject(false);
    }
  }

  function replaceClip(updated) {
    setData((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === updated.id ? { ...clip, ...updated } : clip)),
    }));
    if (updated.render_status === "queued") refresh();
  }

  function toggleSelect(clipId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }

  async function handleRenderSelected() {
    setRenderingSelected(true);
    try {
      await videoApi.renderClips(videoId, [...selected]);
      toast.info(`Rendering ${selected.size} clip${selected.size === 1 ? "" : "s"}…`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRenderingSelected(false);
    }
  }

  const canRender = video.media_type === "video" && video.source_file_available && !IN_PROGRESS_STATUSES.has(video.status);
  const hasTranscript = video.transcript?.length > 0;
  const isYouTube = video.source_kind === "youtube";
  const needsOriginal = isYouTube && !video.source_file_available && video.status === "completed" && video.clips.length > 0;
  const kindLabel = isYouTube ? `YouTube${video.channel_title ? ` · ${video.channel_title}` : ""}` : SOURCE_KIND_LABELS[video.source_kind];

  return (
    <>
      <PageHeader
        eyebrow={<BackLink to="/videos">All video projects</BackLink>}
        title={video.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {kindLabel}
            {video.duration_seconds ? ` · ${formatTime(video.duration_seconds)}` : ""}
            {video.clip_count > 0 && ` · ${video.clip_count} clips`}
            <VideoStatusBadge status={video.status} />
          </span>
        }
        actions={
          hasTranscript && (
            <Button variant="secondary" onClick={handleTextProject} loading={creatingProject}>
              {video.linked_project_id ? "Open text project" : "Use transcript for posts"}
            </Button>
          )
        }
      />

      <div className="space-y-6">
        {error && <Alert tone="warning">Couldn't refresh: {error}</Alert>}
        {isYouTube && video.youtube_video_id && (
          <Card className="overflow-hidden">
            <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr] md:items-start">
              <YouTubeEmbed videoId={video.youtube_video_id} title={video.title} />
              <div className="space-y-2 text-sm text-subtle">
                <p className="text-[15px] font-semibold tracking-tight text-ink">Source: YouTube video</p>
                <p>
                  <a
                    href={video.youtube_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-subtle transition-colors hover:text-ink"
                  >
                    Open on YouTube <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </p>
                <ul className="space-y-2.5 pt-2">
                  <ChecklistItem done={hasTranscript}>
                    Transcript{" "}
                    {video.transcript_source === "youtube_captions"
                      ? "(YouTube captions)"
                      : video.transcript_source === "manual"
                        ? "(pasted)"
                        : video.transcript_source === "whisper"
                          ? "(transcribed from original)"
                          : "needed"}
                  </ChecklistItem>
                  <ChecklistItem done={video.clips.length > 0}>
                    Clip moments {video.clips.length ? `(${video.clips.length})` : ""}
                  </ChecklistItem>
                  <ChecklistItem done={video.source_file_available}>
                    {video.source_file_available ? "Original video attached" : "Original video (needed for MP4 downloads)"}
                  </ChecklistItem>
                </ul>
              </div>
            </div>
          </Card>
        )}

        {video.status === "awaiting_transcript" && (
          <TranscriptOptions video={video} capabilities={capabilities} onUpdated={refresh} />
        )}

        <ProcessingStatus video={video} onRetry={handleRetry} retrying={retrying} />

        {video.status === "completed" && video.status_message && (
          <Alert tone={video.rendered_count > 0 || video.media_type === "audio" ? "success" : "info"}>
            {video.status_message}.
            {video.media_type === "audio" && " Audio sources produce timestamp suggestions only."}
            {video.media_type === "video" && !video.source_file_available && !isYouTube && " The source file is no longer on the server, so clips can't be re-rendered."}
          </Alert>
        )}

        {needsOriginal && (
          <Card>
            <CardHeader
              title="Get downloadable MP4s"
              description="These clips are timestamp suggestions. YouTube links can't be cut into files, so attach your original video to render them."
            />
            <div className="p-5">
              <OriginalFileUpload video={video} capabilities={capabilities} onUpdated={refresh} />
            </div>
          </Card>
        )}

        {hasTranscript && <TranscriptPanel segments={video.transcript} />}

        {video.clips.length > 0 ? (
          <section aria-labelledby="clips-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="clips-heading" className="text-[15px] font-semibold tracking-tight text-ink">Clips</h2>
              {canRender && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(selected.size === video.clips.length ? new Set() : new Set(video.clips.map((c) => c.id)))}
                  >
                    {selected.size === video.clips.length ? "Clear selection" : "Select all"}
                  </Button>
                  <Button size="sm" onClick={handleRenderSelected} loading={renderingSelected} disabled={selected.size === 0}>
                    Render selected ({selected.size})
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {video.clips.map((clip, index) => (
                <ClipCard
                  // Re-mount when the rendered file changes so the preview link updates.
                  key={`${clip.id}:${clip.render_status}:${clip.file_size_bytes || 0}`}
                  clip={clip}
                  number={index + 1}
                  mediaType={video.media_type}
                  canRender={canRender}
                  onChange={replaceClip}
                  youtubeVideoId={isYouTube ? video.youtube_video_id : undefined}
                  selected={selected.has(clip.id)}
                  onToggleSelect={canRender ? () => toggleSelect(clip.id) : undefined}
                />
              ))}
            </div>
          </section>
        ) : (
          video.status === "completed" && (
            <EmptyState title="No clips found" description="We couldn't find self-contained moments in this recording." />
          )
        )}

        {IN_PROGRESS_STATUSES.has(video.status) && video.clips.length === 0 && (
          <Card>
            <CardHeader title="Clips" description="Clips appear here as soon as the strongest moments are selected." />
          </Card>
        )}
      </div>
    </>
  );
}

export default function VideoProjectPage() {
  const { videoId } = useParams();
  return <VideoWorkspace key={videoId} videoId={videoId} />;
}
