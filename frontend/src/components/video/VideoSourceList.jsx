import { Link } from "react-router-dom";

import { formatDate } from "../../lib/constants";
import { formatTime, SOURCE_KIND_LABELS } from "../../lib/videoFormat";
import VideoStatusBadge from "./VideoStatusBadge";

function summary(video) {
  if (video.status === "completed") {
    if (video.media_type === "audio") return `${video.clip_count} clip suggestions`;
    return `${video.rendered_count}/${video.clip_count} clips rendered`;
  }
  if (video.status === "failed") return "Needs attention";
  return `${video.progress}%`;
}

/** List of video projects, shared by the dashboard and the Videos page. */
export default function VideoSourceList({ videos }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {videos.map((video) => (
        <li key={video.id}>
          <Link
            to={`/videos/${video.id}`}
            className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-6"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600" aria-hidden="true">
              {video.media_type === "audio" ? "♪" : "▶"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{video.title}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {SOURCE_KIND_LABELS[video.source_kind] || video.source_kind}
                {video.duration_seconds ? ` · ${formatTime(video.duration_seconds)}` : ""} · {formatDate(video.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{summary(video)}</span>
              <VideoStatusBadge status={video.status} />
              <span className="hidden text-slate-400 sm:inline" aria-hidden="true">→</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
