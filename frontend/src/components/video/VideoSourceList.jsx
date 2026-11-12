import { ArrowRight, AudioLines, CirclePlay, Clapperboard } from "lucide-react";
import { Link } from "react-router-dom";

import { formatDate } from "../../lib/constants";
import { formatTime, SOURCE_KIND_LABELS } from "../../lib/videoFormat";
import { IconTile } from "../ui";
import VideoStatusBadge from "./VideoStatusBadge";

function summary(video) {
  if (video.status === "completed") {
    if (video.media_type === "audio") return `${video.clip_count} clip suggestions`;
    return `${video.rendered_count}/${video.clip_count} clips rendered`;
  }
  if (video.status === "failed") return "Needs attention";
  if (video.status === "awaiting_transcript") return "Add a transcript";
  return `${video.progress}%`;
}

function iconFor(video) {
  if (video.media_type === "audio") return AudioLines;
  return video.source_kind === "youtube" ? CirclePlay : Clapperboard;
}

/** List of video projects, shared by the dashboard and the Videos page. */
export default function VideoSourceList({ videos }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper shadow-xs">
      {videos.map((video) => (
        <li key={video.id}>
          <Link
            to={`/videos/${video.id}`}
            className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-canvas sm:flex-row sm:items-center sm:gap-5"
          >
            <IconTile icon={iconFor(video)} className="hidden sm:flex" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{video.title}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {SOURCE_KIND_LABELS[video.source_kind] || video.source_kind}
                {video.duration_seconds ? ` · ${formatTime(video.duration_seconds)}` : ""} · {formatDate(video.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] tabular-nums text-subtle">{summary(video)}</span>
              <VideoStatusBadge status={video.status} />
              <ArrowRight className="hidden size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block" aria-hidden="true" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
