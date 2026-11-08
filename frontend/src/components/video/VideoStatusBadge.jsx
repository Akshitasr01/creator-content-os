import { Badge, Spinner } from "../ui";

const STATUS = {
  queued: { tone: "slate", label: "Queued", busy: true },
  downloading: { tone: "blue", label: "Downloading", busy: true },
  transcribing: { tone: "blue", label: "Transcribing", busy: true },
  selecting: { tone: "blue", label: "Finding moments", busy: true },
  rendering: { tone: "blue", label: "Rendering", busy: true },
  completed: { tone: "green", label: "Completed" },
  failed: { tone: "red", label: "Failed" },
};

const RENDER_STATUS = {
  not_rendered: { tone: "slate", label: "Suggestion only" },
  unavailable: { tone: "slate", label: "Suggestion only" },
  queued: { tone: "slate", label: "Queued", busy: true },
  rendering: { tone: "blue", label: "Rendering", busy: true },
  rendered: { tone: "green", label: "Video ready" },
  failed: { tone: "red", label: "Render failed" },
};

export default function VideoStatusBadge({ status, kind = "source" }) {
  const config = (kind === "clip" ? RENDER_STATUS : STATUS)[status] || { tone: "slate", label: status };
  return (
    <Badge tone={config.tone}>
      {config.busy && <Spinner className="size-3" />}
      {config.label}
    </Badge>
  );
}
