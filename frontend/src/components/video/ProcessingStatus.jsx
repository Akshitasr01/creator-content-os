import { Alert, Button, Card } from "../ui";

const ORDER = ["queued", "downloading", "transcribing", "selecting", "rendering", "completed"];

function stepsFor(video) {
  const steps = [];
  if (video.source_kind === "url") steps.push({ key: "downloading", label: "Download" });
  steps.push({ key: "transcribing", label: "Transcribe" });
  steps.push({ key: "selecting", label: "Find moments" });
  if (video.media_type === "video") steps.push({ key: "rendering", label: "Render clips" });
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
            Retry
          </Button>
        }
      >
        {video.error_message || "Something went wrong."} Completed steps are kept; Retry continues where it stopped.
      </Alert>
    );
  }
  if (video.status === "completed") return null;

  const current = ORDER.indexOf(video.status);
  return (
    <Card className="p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium text-slate-900">{video.status_message || "Processing…"}</p>
        <span className="text-sm tabular-nums text-slate-500">{video.progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={video.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${Math.max(3, video.progress)}%` }} />
      </div>
      <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {stepsFor(video).map((step) => {
          const index = ORDER.indexOf(step.key);
          const state = index < current ? "done" : index === current ? "active" : "todo";
          return (
            <li key={step.key} className={`flex items-center gap-2 ${state === "todo" ? "text-slate-400" : "text-slate-800"}`}>
              <span
                className={`flex size-5 items-center justify-center rounded-full text-xs ${
                  state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-brand-600 text-white" : "bg-slate-200"
                }`}
                aria-hidden="true"
              >
                {state === "done" ? "✓" : ""}
              </span>
              {step.label}
              {state === "active" && <span className="sr-only">(in progress)</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-slate-500">
        You can leave this page; processing continues on the server. Long videos can take several minutes.
      </p>
    </Card>
  );
}
