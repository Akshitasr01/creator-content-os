import { RotateCcw } from "lucide-react";

import { Alert, Button, Card, Spinner, Steps } from "../ui";

const ORDER = ["queued", "downloading", "transcribing", "selecting", "rendering", "completed"];

const TRANSCRIPT_LABELS = { youtube_captions: "Transcript (YouTube captions)", manual: "Transcript (pasted)" };

function stepsFor(video) {
  const steps = [];
  if (video.source_kind === "url") steps.push({ key: "downloading", label: "Download" });
  steps.push({ key: "transcribing", label: TRANSCRIPT_LABELS[video.transcript_source] || "Transcribe" });
  steps.push({ key: "selecting", label: "Find moments" });
  // A YouTube link without the original file can't be rendered.
  const renderable = video.source_kind !== "youtube" || video.source_file_available;
  if (video.media_type === "video" && renderable) steps.push({ key: "rendering", label: "Render clips" });
  return steps;
}

/** Live progress for a processing video, or a failure with Retry. */
export default function ProcessingStatus({ video, onRetry, retrying }) {
  if (video.status === "failed") {
    return (
      <Alert
        title="Processing failed"
        action={
          <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
            {!retrying && <RotateCcw className="size-3.5" aria-hidden="true" />}
            Retry
          </Button>
        }
      >
        {video.error_message || "Something went wrong."} Completed steps are kept; Retry continues where it stopped.
      </Alert>
    );
  }
  if (video.status === "completed" || video.status === "awaiting_transcript") return null;

  const current = ORDER.indexOf(video.status);
  return (
    <Card className="p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2.5 font-medium text-ink">
          <Spinner className="size-4 text-ink" />
          {video.status_message || "Processing…"}
        </p>
        <span className="text-sm tabular-nums text-muted">{video.progress}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={video.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out" style={{ width: `${Math.max(3, video.progress)}%` }} />
      </div>
      <Steps
        className="mt-5"
        steps={stepsFor(video).map((step) => {
          const index = ORDER.indexOf(step.key);
          return { label: step.label, state: index < current ? "done" : index === current ? "active" : "todo" };
        })}
      />
      <p className="mt-4 text-xs text-muted">
        You can leave this page; processing continues on the server. Long videos can take several minutes.
      </p>
    </Card>
  );
}
