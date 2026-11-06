import { Badge, Spinner } from "./ui";

const STATUS = {
  draft: { tone: "slate", label: "Draft" },
  analyzing: { tone: "blue", label: "Analyzing", busy: true },
  analyzed: { tone: "brand", label: "Analyzed" },
  ideas_generated: { tone: "brand", label: "Analyzed" }, // older projects
  generating: { tone: "blue", label: "Generating", busy: true },
  ready: { tone: "green", label: "Ready" },
  failed: { tone: "red", label: "Failed" },
  // asset statuses
  liked: { tone: "green", label: "Liked" },
  disliked: { tone: "red", label: "Disliked" },
  approved: { tone: "green", label: "Approved" },
};

export default function StatusBadge({ status }) {
  const config = STATUS[status] || { tone: "slate", label: status || "Unknown" };
  return (
    <Badge tone={config.tone}>
      {config.busy && <Spinner className="size-3" />}
      {config.label}
    </Badge>
  );
}
