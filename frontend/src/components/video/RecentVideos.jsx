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
        <h2 id="videos-heading" className="text-lg font-semibold text-ink">Video projects</h2>
        {videos.data?.length > SHOWN && (
          <Link to="/videos" className="text-sm font-medium text-subtle hover:text-ink">
            View all {videos.data.length}
          </Link>
        )}
      </div>

      {videos.loading && <Spinner className="size-5 text-muted" />}
      {videos.error && <Alert tone="warning">Video projects are unavailable: {videos.error}</Alert>}
      {videos.data?.length === 0 && (
        <Link
          to="/create"
          className="flex flex-col gap-1 rounded-xl border border-dashed border-line bg-paper px-5 py-5 transition hover:border-ink/30 hover:bg-canvas sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="font-medium text-ink">Turn a long video into reels</span>
            <span className="block text-sm text-muted">
              Upload a video and get up to 10 vertical clips with subtitles, hooks and captions.
            </span>
          </span>
          <span className="text-sm font-medium text-ink">Try it</span>
        </Link>
      )}
      {videos.data?.length > 0 && <VideoSourceList videos={videos.data.slice(0, SHOWN)} />}
    </section>
  );
}
