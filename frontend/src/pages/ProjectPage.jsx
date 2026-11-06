import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ContentBrief from "../components/project/ContentBrief";
import GeneratePanel from "../components/project/GeneratePanel";
import IdeaList from "../components/project/IdeaList";
import StatusBadge from "../components/StatusBadge";
import { Alert, Button, Card, CardHeader, DemoBadge, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import { useApiData } from "../hooks/useApiData";
import { useProfile } from "../hooks/useProfile";
import { useToast } from "../hooks/useToast";
import { SOURCE_TYPES } from "../lib/constants";
import { api } from "../services/api";

/** Analysis + idea preview + generate (PDF steps 13, 22). */
function ProjectWorkspace({ projectId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useProfile();
  const { data: project, error, loading, reload, setData } = useApiData(
    useCallback(() => api.getProject(projectId), [projectId])
  );
  const [busy, setBusy] = useState(null); // "analyze" | "ideas" | "generate"
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  if (loading) return <PageSpinner label="Loading project…" />;
  if (error) {
    return (
      <Alert title="We couldn't open this project" action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>
        {error}
      </Alert>
    );
  }

  const analysis = project.analysis;
  const ideas = project.content_ideas?.ideas || [];
  const assetCount = project.content?.length || 0;

  // Runs one AI action; the backend saves results, we merge the returned project.
  async function run(action, request, successMessage) {
    setBusy(action);
    setActionError("");
    try {
      const updated = await request();
      setData((current) => ({ ...current, ...updated }));
      toast.success(successMessage);
    } catch (err) {
      setActionError(err.message);
      // The backend may have saved a 'failed' status + message; show it.
      api.getProject(projectId).then(setData).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  async function saveBrief(values) {
    try {
      const updated = await api.updateAnalysis(projectId, values);
      setData((current) => ({ ...current, ...updated }));
      toast.success("Brief updated. Ideas and new content will use your corrections.");
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async function generate(outputs) {
    setBusy("generate");
    setActionError("");
    try {
      const result = await api.generateContent(projectId, outputs, [...selected]);
      if (result.errors.length) {
        toast.error(`Some assets failed: ${result.errors.join("; ")}`);
      }
      if (result.created.length) {
        toast.success(`Generated ${result.created.length} asset${result.created.length === 1 ? "" : "s"}.`);
        navigate(`/projects/${projectId}/studio`);
        return;
      }
      setActionError("No assets could be generated. Please try again.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  function toggleIdea(index) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const sourceLabel = SOURCE_TYPES.find((t) => t.value === project.source_type)?.label || project.source_type;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← All projects
          </Link>
        }
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {sourceLabel} · {project.source_text.length.toLocaleString()} characters
            <StatusBadge status={project.status} />
          </span>
        }
        actions={
          assetCount > 0 && (
            <Link
              to={`/projects/${projectId}/studio`}
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Open Content Studio ({assetCount})
            </Link>
          )
        }
      />

      <div className="space-y-6">
        {(actionError || (project.status === "failed" && project.error_message)) && (
          <Alert title="Something went wrong">{actionError || project.error_message}</Alert>
        )}

        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-slate-700 hover:text-slate-900">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            View source content
          </summary>
          <p className="max-h-96 overflow-y-auto whitespace-pre-wrap border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-700">
            {project.source_text}
          </p>
        </details>

        {/* Step 1: analysis */}
        {analysis ? (
          <ContentBrief
            analysis={analysis}
            onSave={saveBrief}
            reanalyzing={busy === "analyze"}
            onReanalyze={() => run("analyze", () => api.analyzeProject(projectId), "Content re-analyzed.")}
          />
        ) : (
          <EmptyState
            icon="1"
            title="Analyze your content"
            description="We'll read your source and build a Content Brief: topic, audience, key themes, claims and hooks. You can correct it before generating anything."
            action={
              <Button
                size="lg"
                loading={busy === "analyze"}
                onClick={() => run("analyze", () => api.analyzeProject(projectId), "Content analyzed.")}
              >
                {busy === "analyze" ? "Analyzing… (10-40s)" : "Analyze content"}
              </Button>
            }
          />
        )}

        {/* Step 2: ideas */}
        {analysis && (
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Content ideas {project.content_ideas?.generated_by?.provider === "mock" && <DemoBadge />}
                </span>
              }
              description={
                ideas.length
                  ? `${ideas.length} ideas · select the ones you want, or let us pick.`
                  : "Standalone angles worth their own post, before writing anything."
              }
              actions={
                <Button
                  variant={ideas.length ? "secondary" : "primary"}
                  size="sm"
                  loading={busy === "ideas"}
                  disabled={Boolean(busy)}
                  onClick={() => run("ideas", () => api.generateIdeas(projectId), "New ideas added.")}
                >
                  {ideas.length ? "Generate more ideas" : "Generate ideas"}
                </Button>
              }
            />
            {ideas.length > 0 ? (
              <IdeaList ideas={ideas} selected={selected} onToggle={toggleIdea} />
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                {busy === "ideas" ? "Finding the strongest angles…" : "No ideas yet."}
              </p>
            )}
          </Card>
        )}

        {/* Step 3: generate */}
        {ideas.length > 0 && (
          <GeneratePanel
            targetPlatforms={profile.target_platforms}
            selectedCount={selected.size}
            onGenerate={generate}
            generating={busy === "generate"}
          />
        )}
      </div>
    </>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams();
  // key resets all state when navigating between projects
  return <ProjectWorkspace key={projectId} projectId={projectId} />;
}
