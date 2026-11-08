import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import ClipCard from "../components/video/ClipCard";
import ProcessingStatus from "../components/video/ProcessingStatus";
import VideoStatusBadge from "../components/video/VideoStatusBadge";
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

function TranscriptPanel({ segments }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-slate-700 hover:text-slate-900">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        Timestamped transcript ({segments.length} lines)
      </summary>
      <ol className="max-h-96 space-y-1 overflow-y-auto border-t border-slate-100 px-5 py-4 text-sm">
        {segments.map((segment, index) => (
          <li key={index} className="flex gap-3">
            <span className="w-12 shrink-0 tabular-nums text-slate-400">{formatTime(segment.start)}</span>
            <span className="text-slate-700">{segment.text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function VideoWorkspace({ videoId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: video, error, loading, refresh, setData } = usePolledVideo(videoId);
  const [retrying, setRetrying] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

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

  const canRender = video.media_type === "video" && video.source_file_available && !IN_PROGRESS_STATUSES.has(video.status);
  const hasTranscript = video.transcript?.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/videos" className="text-sm font-medium text-slate-500 hover:text-slate-800">← All video projects</Link>}
        title={video.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {SOURCE_KIND_LABELS[video.source_kind]}
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
        <ProcessingStatus video={video} onRetry={handleRetry} retrying={retrying} />

        {video.status === "completed" && video.status_message && (
          <Alert tone={video.rendered_count > 0 || video.media_type === "audio" ? "success" : "info"}>
            {video.status_message}.
            {video.media_type === "audio" && " Audio sources produce timestamp suggestions only."}
            {video.media_type === "video" && !video.source_file_available && " The source file is no longer on the server, so clips can't be re-rendered."}
          </Alert>
        )}

        {hasTranscript && <TranscriptPanel segments={video.transcript} />}

        {video.clips.length > 0 ? (
          <section aria-labelledby="clips-heading">
            <h2 id="clips-heading" className="mb-4 text-lg font-semibold text-slate-900">Clips</h2>
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
