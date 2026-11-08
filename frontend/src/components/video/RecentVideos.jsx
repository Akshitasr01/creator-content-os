import { useCallback } from "react";
import { Link } from "react-router-dom";

import { useApiData } from "../../hooks/useApiData";
import { videoApi } from "../../services/videoApi";
import { Alert, Spinner } from "../ui";
import VideoSourceList from "./VideoSourceList";

const SHOWN = 3;

/** Dashboard section: recent video projects, or an invitation to try the feature. */
export default function RecentVideos() {
  const videos = useApiData(useCallback(() => videoApi.list(), []));

  return (
    <section aria-labelledby="videos-heading" className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="videos-heading" className="text-lg font-semibold text-slate-900">Video projects</h2>
        {videos.data?.length > SHOWN && (
          <Link to="/videos" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all {videos.data.length}
          </Link>
        )}
      </div>

      {videos.loading && <Spinner className="size-5 text-slate-400" />}
      {videos.error && <Alert tone="warning">Video projects are unavailable: {videos.error}</Alert>}
      {videos.data?.length === 0 && (
        <Link
          to="/create"
          className="flex flex-col gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-5 transition hover:border-brand-300 hover:bg-brand-50/40 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="font-medium text-slate-900">Turn a long video into reels</span>
            <span className="block text-sm text-slate-500">
              Upload a video and get up to 10 vertical clips with subtitles, hooks and captions.
            </span>
          </span>
          <span className="text-sm font-medium text-brand-600">Try it →</span>
        </Link>
      )}
      {videos.data?.length > 0 && <VideoSourceList videos={videos.data.slice(0, SHOWN)} />}
    </section>
  );
}
