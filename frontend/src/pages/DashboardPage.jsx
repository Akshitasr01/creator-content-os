import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CirclePlay,
  Clapperboard,
  FileText,
  FolderOpen,
  Gauge,
  Link2,
  Mic,
  PenLine,
  Scissors,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import { Alert, Button, Card, EmptyState, IconTile, Spinner, Tabs } from "../components/ui";
import VideoSourceList from "../components/video/VideoSourceList";
import VideoUrlForm from "../components/VideoUrlForm";
import { useApiData } from "../hooks/useApiData";
import { useProfile } from "../hooks/useProfile";
import { formatDate, PLATFORMS, SOURCE_TYPES } from "../lib/constants";
import { clearPendingVideoUrl, peekPendingVideoUrl, pendingVideoPath } from "../lib/pendingVideoUrl";
import { api } from "../services/api";
import { videoApi } from "../services/videoApi";

const CREATE_OPTIONS = [
  { to: "/videos/new?source=youtube", icon: CirclePlay, title: "YouTube link", body: "Find clip moments in a video" },
  { to: "/videos/new?source=upload", icon: Upload, title: "Upload video", body: "Render 9:16 clips with subtitles" },
  { to: "/projects/new", icon: PenLine, title: "Paste text", body: "Reels, LinkedIn & carousels" },
  { to: "/videos/new?source=audio", icon: Mic, title: "Upload audio", body: "Podcast clip suggestions" },
];

const RECENT_LIMIT = 6;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function projectLink(project) {
  // Projects with content open straight into the Content Studio (PDF step 20).
  return project.asset_count > 0 ? `/projects/${project.id}/studio` : `/projects/${project.id}`;
}

function nextStep(project) {
  if (project.asset_count > 0) return `${project.asset_count} post${project.asset_count === 1 ? "" : "s"}`;
  if (project.status === "failed") return "Needs attention";
  if (project.idea_count > 0) return "Ready to generate";
  if (project.has_analysis) return "Ready for ideas";
  return "Not analyzed yet";
}

function timeAgo(value) {
  if (!value) return "";
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds >= 86400 * 7) return formatDate(value);
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function videoSummary(video) {
  if (video.status === "completed") {
    return video.media_type === "audio"
      ? `${video.clip_count} clip suggestions`
      : `${video.rendered_count} of ${video.clip_count} clips rendered`;
  }
  if (video.status === "failed") return "Processing failed";
  if (video.status === "awaiting_transcript") return "Waiting for transcript";
  return "Processing…";
}

/* ---------- Pieces ---------- */

function StatCard({ icon, label, value, detail, loading, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-subtle">{label}</p>
        <IconTile icon={icon} className="size-8! rounded-md" />
      </div>
      <div className="mt-4 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
        {loading ? <Spinner className="size-5 text-muted" /> : value}
      </div>
      {detail && <p className="mt-2 text-[13px] text-muted">{detail}</p>}
      {children}
    </Card>
  );
}

function SectionTitle({ children, action, id }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

const SMALL_LINK = "text-[13px] font-medium text-subtle transition-colors hover:text-ink";
const PRIMARY_LINK = "inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-graphite";

/** Shown when a visitor pasted a link on the landing page before signing up. */
function PendingLinkBanner() {
  const [url, setUrl] = useState(() => peekPendingVideoUrl());
  if (!url) return null;
  return (
    <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <IconTile icon={Link2} inverted />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Continue with the link you pasted</p>
        <p className="truncate text-[13px] text-muted">{url}</p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearPendingVideoUrl();
            setUrl("");
          }}
        >
          Dismiss
        </Button>
        <Link to={pendingVideoPath(url)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-paper hover:bg-graphite">
          Continue <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function ProjectList({ projects }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper shadow-xs">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            to={projectLink(project)}
            className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-canvas sm:flex-row sm:items-center sm:gap-5"
          >
            <IconTile icon={FileText} className="hidden sm:flex" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{project.title}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {SOURCE_TYPES.find((t) => t.value === project.source_type)?.label || project.source_type} · {formatDate(project.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-subtle">{nextStep(project)}</span>
              <StatusBadge status={project.status} />
              <ArrowRight className="hidden size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block" aria-hidden="true" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BrandVoiceCard({ profile }) {
  const platforms = (profile.target_platforms || [])
    .map((value) => PLATFORMS.find((p) => p.value === value)?.label || value)
    .join(", ");
  const rows = [
    ["Niche", profile.niche],
    ["Audience", profile.audience],
    ["Tone", profile.tone],
    ["Language", profile.language],
    ["Platforms", platforms],
  ].filter(([, value]) => value);
  const samples = (profile.sample_posts || []).filter((post) => post?.trim()).length;

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <AudioLines className="size-4 text-ink" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Brand voice</h2>
        </div>
        <Link to="/settings" className={`inline-flex items-center gap-1 ${SMALL_LINK}`}>
          Edit <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <dl className="space-y-3 px-5 py-4 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-graphite" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
        {samples} of 3 sample posts added{samples < 3 ? ". More samples bring the voice closer to yours." : "."}
      </p>
    </Card>
  );
}

function HistoryCard({ projects, videos }) {
  const events = useMemo(() => {
    const fromProjects = (projects || []).map((p) => ({
      key: `p-${p.id}`,
      to: projectLink(p),
      icon: FileText,
      title: p.title,
      text: p.asset_count > 0 ? `${p.asset_count} post${p.asset_count === 1 ? "" : "s"} generated` : nextStep(p),
      at: p.updated_at || p.created_at,
    }));
    const fromVideos = (videos || []).map((v) => ({
      key: `v-${v.id}`,
      to: `/videos/${v.id}`,
      icon: v.media_type === "audio" ? AudioLines : Clapperboard,
      title: v.title,
      text: videoSummary(v),
      at: v.updated_at || v.created_at,
    }));
    return [...fromProjects, ...fromVideos].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 6);
  }, [projects, videos]);

  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Generation history</h2>
      </div>
      {events.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-muted">Your generated posts and clips will appear here.</p>
      ) : (
        <ol className="px-5 py-3">
          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <li key={event.key} className="relative flex gap-3 py-2.5">
                {index < events.length - 1 && <span className="absolute -bottom-2.5 left-[13px] top-10 w-px bg-line" aria-hidden="true" />}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-paper" aria-hidden="true">
                  <Icon className="size-3.5 text-subtle" />
                </span>
                <Link to={event.to} className="min-w-0 flex-1 transition-opacity hover:opacity-70">
                  <p className="truncate text-[13px] font-medium text-ink">{event.title}</p>
                  <p className="text-xs text-muted">
                    {event.text} · {timeAgo(event.at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function LoadingRow() {
  return (
    <div className="py-10 text-center" role="status">
      <Spinner className="mx-auto size-5 text-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ---------- Page ---------- */

export default function DashboardPage() {
  const { profile } = useProfile();
  const projects = useApiData(useCallback(() => api.listProjects(), []));
  const videos = useApiData(useCallback(() => videoApi.list(), []));
  const usage = useApiData(useCallback(() => api.getUsage(), []));
  const health = useApiData(useCallback(() => api.health(), []));
  const [tab, setTab] = useState("text");

  const projectList = projects.data || [];
  const videoList = videos.data || [];
  const postCount = projectList.reduce((sum, p) => sum + (p.asset_count || 0), 0);
  const clipCount = videoList.reduce((sum, v) => sum + (v.clip_count || 0), 0);
  const renderedCount = videoList.reduce((sum, v) => sum + (v.rendered_count || 0), 0);
  const usagePercent = usage.data
    ? Math.min(100, Math.round((usage.data.used_today / Math.max(1, usage.data.daily_limit)) * 100))
    : 0;
  const firstName = (profile.creator_name || "").trim().split(/\s+/)[0];

  return (
    <div className="space-y-10">
      {/* Greeting + quick start */}
      <section>
        <p className="text-[13px] text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted">What are we turning into content today?</p>

        <div className="mt-6">
          <PendingLinkBanner />
          {health.data?.ai_provider === "mock" && (
            <Alert tone="warning" title="Demo mode" className="mb-6">
              AI generation is switched off, so content is labelled <strong>Demo output</strong> and built from your text without AI.
              To use real AI, set <code className="rounded border border-line bg-mist px-1 font-mono text-xs">AI_PROVIDER=openai</code> in
              backend/.env.
            </Alert>
          )}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
              <div className="lg:w-60 lg:shrink-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">Start from a video link</h2>
                <p className="mt-1 text-[13px] text-muted">YouTube or a direct video file URL.</p>
              </div>
              <div className="flex-1">
                <VideoUrlForm size="md" align="left" elevated={false} />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Create content */}
      <section aria-labelledby="create-heading">
        <SectionTitle id="create-heading" action={<Link to="/create" className={SMALL_LINK}>All sources</Link>}>
          Create content
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CREATE_OPTIONS.map((option) => (
            <Link
              key={option.to}
              to={option.to}
              className="group flex flex-col rounded-xl border border-line bg-paper p-4 shadow-xs transition-all duration-150 hover:-translate-y-px hover:border-ink/30 hover:shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between">
                <IconTile icon={option.icon} className="transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper" />
                <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">{option.title}</p>
              <p className="mt-0.5 text-[13px] text-muted">{option.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Your numbers</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={FolderOpen}
            label="Projects"
            value={projectList.length + videoList.length}
            loading={projects.loading || videos.loading}
            detail={`${projectList.length} text · ${videoList.length} video`}
          />
          <StatCard icon={FileText} label="Posts generated" value={postCount} loading={projects.loading} detail="Reels, LinkedIn & carousels" />
          <StatCard icon={Scissors} label="Clips found" value={clipCount} loading={videos.loading} detail={`${renderedCount} rendered as MP4`} />
          <StatCard
            icon={Gauge}
            label="AI usage today"
            value={usage.data ? `${usage.data.used_today}/${usage.data.daily_limit}` : "–"}
            loading={usage.loading}
            detail={usage.error ? "Unavailable" : usage.data?.provider === "mock" ? "Demo mode (free)" : "Resets daily"}
          >
            {usage.data && (
              <div
                className="mt-3 h-1 overflow-hidden rounded-full bg-mist"
                role="progressbar"
                aria-label="Daily AI usage"
                aria-valuenow={usagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${usagePercent}%` }} />
              </div>
            )}
          </StatCard>
        </div>
      </section>

      {/* Recent projects + side column */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="recent-heading" className="min-w-0">
          <SectionTitle
            id="recent-heading"
            action={
              tab === "video" && videoList.length > RECENT_LIMIT ? (
                <Link to="/videos" className={SMALL_LINK}>View all {videoList.length}</Link>
              ) : null
            }
          >
            Recent projects
          </SectionTitle>
          <Tabs
            label="Project type"
            className="mb-4"
            value={tab}
            onChange={setTab}
            items={[
              { value: "text", label: "Text posts", count: projects.data ? projectList.length : undefined },
              { value: "video", label: "Video clips", count: videos.data ? videoList.length : undefined },
            ]}
          />

          {tab === "text" && (
            <div role="tabpanel">
              {projects.loading && <LoadingRow />}
              {projects.error && (
                <Alert action={<Button variant="secondary" size="sm" onClick={projects.reload}>Try again</Button>}>{projects.error}</Alert>
              )}
              {projects.data?.length === 0 && (
                <EmptyState
                  icon={PenLine}
                  title="No text projects yet"
                  description="Paste a transcript, article or script and we'll turn it into a week of posts."
                  action={<Link to="/projects/new" className={PRIMARY_LINK}>Create your first project</Link>}
                />
              )}
              {projectList.length > 0 && <ProjectList projects={projectList} />}
            </div>
          )}

          {tab === "video" && (
            <div role="tabpanel">
              {videos.loading && <LoadingRow />}
              {videos.error && <Alert tone="warning">Video projects are unavailable: {videos.error}</Alert>}
              {videos.data?.length === 0 && (
                <EmptyState
                  icon={Clapperboard}
                  title="No video projects yet"
                  description="Upload a long video or paste a link and get up to 10 vertical clips with subtitles, hooks and captions."
                  action={<Link to="/create" className={PRIMARY_LINK}>Turn a video into clips</Link>}
                />
              )}
              {videoList.length > 0 && <VideoSourceList videos={videoList.slice(0, RECENT_LIMIT)} />}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <BrandVoiceCard profile={profile} />
          <HistoryCard projects={projects.data} videos={videos.data} />
        </aside>
      </div>
    </div>
  );
}
