import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AssetCard from "../components/studio/AssetCard";
import { Alert, Button, EmptyState, PageHeader, PageSpinner } from "../components/ui";
import { useApiData } from "../hooks/useApiData";
import { CONTENT_TYPES } from "../lib/constants";
import { api } from "../services/api";

const FILTERS = [{ value: "all", label: "All" }, ...Object.entries(CONTENT_TYPES).map(([value, c]) => ({ value, label: c.plural }))];

/** Content Studio: every asset grouped by platform, editable and copyable (PDF step 23). */
export default function ContentStudioPage() {
  const { projectId } = useParams();
  const { data: project, error, loading, reload, setData } = useApiData(
    useCallback(() => api.getProject(projectId), [projectId])
  );
  const [filter, setFilter] = useState("all");

  if (loading) return <PageSpinner label="Loading Content Studio…" />;
  if (error) {
    return (
      <Alert title="We couldn't open this project" action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>
        {error}
      </Alert>
    );
  }

  const ideas = project.content_ideas?.ideas || [];
  const content = project.content || [];

  function replaceAsset(updated) {
    setData((current) => ({
      ...current,
      content: current.content.map((item) => (item.id === updated.id ? updated : item)),
    }));
  }

  const groups = Object.keys(CONTENT_TYPES)
    .map((type) => ({ type, items: content.filter((item) => item.content_type === type) }))
    .filter((group) => group.items.length > 0 && (filter === "all" || filter === group.type));

  const approved = content.filter((item) => item.status === "approved").length;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={`/projects/${projectId}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Brief & ideas
          </Link>
        }
        title="Content Studio"
        description={`${project.title} · ${content.length} asset${content.length === 1 ? "" : "s"} · ${approved} approved`}
        actions={
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
          >
            Generate more
          </Link>
        }
      />

      {content.length === 0 ? (
        <EmptyState
          title="No content generated yet"
          description="Analyze your source, pick ideas, then generate Reels, LinkedIn posts and carousels."
          action={
            <Link to={`/projects/${projectId}`} className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              Go to brief & ideas
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by content type">
            {FILTERS.map((option) => {
              const count = option.value === "all" ? content.length : content.filter((c) => c.content_type === option.value).length;
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(option.value)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {option.label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.type} aria-labelledby={`group-${group.type}`}>
                <h2 id={`group-${group.type}`} className="mb-4 text-lg font-semibold text-slate-900">
                  {CONTENT_TYPES[group.type].plural}
                  <span className="ml-2 text-sm font-normal text-slate-500">{CONTENT_TYPES[group.type].platform}</span>
                </h2>
                <div className="grid gap-6 xl:grid-cols-2">
                  {group.items.map((asset, index) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      number={index + 1}
                      ideaTitle={ideas[asset.idea_index]?.title}
                      onChange={replaceAsset}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
