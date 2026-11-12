import { useCallback } from "react";
import { Clapperboard, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, Button, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import VideoSourceList from "../components/video/VideoSourceList";
import { useApiData } from "../hooks/useApiData";
import { videoApi } from "../services/videoApi";

export default function VideosPage() {
  const videos = useApiData(useCallback(() => videoApi.list(), []));

  const newButton = (
    <Link
      to="/create"
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-paper shadow-xs transition-colors hover:bg-graphite"
    >
      <Plus className="size-4" aria-hidden="true" /> New video project
    </Link>
  );

  return (
    <>
      <PageHeader title="Video clips" description="Long-form videos and audio turned into short-form clips." />
      {videos.loading && <PageSpinner label="Loading video projects…" />}
      {videos.error && (
        <Alert action={<Button variant="secondary" size="sm" onClick={videos.reload}>Try again</Button>}>{videos.error}</Alert>
      )}
      {videos.data?.length === 0 && (
        <EmptyState
          icon={Clapperboard}
          title="No video projects yet"
          description="Upload a long-form video and get up to 10 vertical reels with subtitles."
          action={newButton}
        />
      )}
      {videos.data?.length > 0 && <VideoSourceList videos={videos.data} />}
    </>
  );
}
