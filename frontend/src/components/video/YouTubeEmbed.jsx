/**
 * Official YouTube embedded player (privacy-enhanced domain). Streams from YouTube;
 * nothing is downloaded. Optional start/end limit playback to one clip.
 */
export default function YouTubeEmbed({ videoId, title, start, end, className = "" }) {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (start !== undefined) params.set("start", String(Math.floor(start)));
  if (end !== undefined) params.set("end", String(Math.ceil(end)));
  return (
    <div className={`aspect-video w-full overflow-hidden rounded-lg bg-ink ${className}`}>
      <iframe
        className="size-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
        title={title || "YouTube video"}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
