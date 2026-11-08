import { useCallback } from "react";
import { Link } from "react-router-dom";

import StatusBadge from "../components/StatusBadge";
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import RecentVideos from "../components/video/RecentVideos";
import { useApiData } from "../hooks/useApiData";
import { useProfile } from "../hooks/useProfile";
import { formatDate, SOURCE_TYPES } from "../lib/constants";
import { api } from "../services/api";

function projectLink(project) {
  // Projects with content open straight into the Content Studio (PDF step 20).
  return project.asset_count > 0 ? `/projects/${project.id}/studio` : `/projects/${project.id}`;
}

function nextStep(project) {
  if (project.asset_count > 0) return `${project.asset_count} asset${project.asset_count === 1 ? "" : "s"}`;
  if (project.status === "failed") return "Needs attention";
  if (project.idea_count > 0) return "Ready to generate";
  if (project.has_analysis) return "Ready for ideas";
  return "Not analyzed yet";
}

export default function DashboardPage() {
  const { profile } = useProfile();
  const projects = useApiData(useCallback(() => api.listProjects(), []));
  const health = useApiData(useCallback(() => api.health(), []));

  const newProjectButton = (
    <Link
      to="/create"
      className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
    >
      + New project
    </Link>
  );

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile.creator_name}`}
        description="Turn long-form content into Reels, LinkedIn posts and carousels."
        actions={newProjectButton}
      />

      {health.data?.ai_provider === "mock" && (
        <Alert tone="warning" title="Demo mode" className="mb-6">
          AI generation is switched off, so content is labelled <strong>Demo output</strong> and built from your text
          without AI. To use real AI, set <code className="rounded bg-amber-100 px-1">AI_PROVIDER=openai</code> in
          backend/.env.
        </Alert>
      )}

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-4 text-lg font-semibold text-slate-900">
          Recent projects
        </h2>

        {projects.loading && <PageSpinner label="Loading projects…" />}

        {projects.error && (
          <Alert action={<Button variant="secondary" size="sm" onClick={projects.reload}>Try again</Button>}>
            {projects.error}
          </Alert>
        )}

        {projects.data?.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Paste a transcript, article or script and we'll turn it into a week of content."
            action={newProjectButton}
          />
        )}

        {projects.data?.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link
                  to={projectLink(project)}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{project.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {SOURCE_TYPES.find((t) => t.value === project.source_type)?.label || project.source_type} ·{" "}
                      {formatDate(project.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">{nextStep(project)}</span>
                    <StatusBadge status={project.status} />
                    <span className="hidden text-slate-400 sm:inline" aria-hidden="true">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentVideos />
    </>
  );
}
