import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AssetCard from "../components/studio/AssetCard";
import { Alert, BackLink, Button, EmptyState, PageHeader, PageSpinner, Tabs } from "../components/ui";
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
          <BackLink to={`/projects/${projectId}`}>Brief & ideas</BackLink>
        }
        title="Content Studio"
        description={`${project.title} · ${content.length} asset${content.length === 1 ? "" : "s"} · ${approved} approved`}
        actions={
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-paper px-4 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-mist"
          >
            <Sparkles className="size-4" aria-hidden="true" /> Generate more
          </Link>
        }
      />

      {content.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No content generated yet"
          description="Analyze your source, pick ideas, then generate Reels, LinkedIn posts and carousels."
          action={
            <Link to={`/projects/${projectId}`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper hover:bg-graphite">
              Go to brief & ideas
            </Link>
          }
        />
      ) : (
        <>
          <Tabs
            label="Filter by content type"
            className="mb-8"
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((option) => ({
              value: option.value,
              label: option.label,
              count: option.value === "all" ? content.length : content.filter((c) => c.content_type === option.value).length,
            }))}
          />

          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.type} aria-labelledby={`group-${group.type}`}>
                <h2 id={`group-${group.type}`} className="mb-4 flex items-baseline gap-2 border-b border-line pb-3 text-[15px] font-semibold tracking-tight text-ink">
                  {CONTENT_TYPES[group.type].plural}
                  <span className="text-[13px] font-normal text-muted">
                    {CONTENT_TYPES[group.type].platform} · {group.items.length}
                  </span>
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
