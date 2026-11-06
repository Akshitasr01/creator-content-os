import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { CONTENT_TYPES, formatDate, REWRITE_OPTIONS } from "../../lib/constants";
import { api } from "../../services/api";
import CopyButton from "../CopyButton";
import StatusBadge from "../StatusBadge";
import { Badge, Button, Card, DemoBadge, Spinner } from "../ui";
import AssetEditor from "./AssetEditor";
import AssetView from "./AssetView";
import { assetToText } from "./assetFormat";
import FeedbackControls from "./FeedbackControls";

/** One generated asset with every Content Studio action (PDF steps 23-25). */
export default function AssetCard({ asset, number, ideaTitle, onChange }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null); // "rewrite" | "status"
  const [showHistory, setShowHistory] = useState(false);
  const type = asset.content_type;
  const config = CONTENT_TYPES[type] || { label: type };
  const history = asset.previous_versions || [];

  async function act(kind, request, successMessage) {
    setBusy(kind);
    try {
      const updated = await request();
      onChange(updated);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(content) {
    const ok = await act("edit", () => api.updateContent(asset.id, { content }), "Saved. The previous version is in history.");
    if (ok) setEditing(false);
    return ok;
  }

  function rewrite(instruction) {
    const label = REWRITE_OPTIONS.find((o) => o.value === instruction)?.label;
    act("rewrite", () => api.rewriteContent(asset.id, instruction), `Rewritten: ${label}.`);
  }

  async function sendFeedback(feedback) {
    try {
      await api.sendFeedback(asset.id, feedback);
      onChange({ ...asset, status: feedback.rating === "up" ? "liked" : "disliked" });
      toast.success("Thanks, feedback saved.");
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  const isApproved = asset.status === "approved";

  return (
    <Card className="relative overflow-hidden">
      {busy === "rewrite" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm text-slate-600 backdrop-blur-sm" role="status">
          <Spinner className="size-6 text-brand-600" />
          Rewriting this asset…
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {config.label} {number}
            </h3>
            <StatusBadge status={asset.status} />
            {asset.provider === "mock" && <DemoBadge />}
            {asset.version > 1 && <Badge>v{asset.version}</Badge>}
          </div>
          {ideaTitle && <p className="mt-1 truncate text-sm text-slate-500">Idea: {ideaTitle}</p>}
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={assetToText(type, asset.content)} label="Copy all" />
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={Boolean(busy)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      <div className="p-5">
        {editing ? (
          <AssetEditor type={type} content={asset.content} onSave={saveEdit} onCancel={() => setEditing(false)} />
        ) : (
          <AssetView type={type} content={asset.content} />
        )}
      </div>

      {!editing && (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`rewrite-${asset.id}`}>
              Rewrite this asset
            </label>
            <select
              id={`rewrite-${asset.id}`}
              value=""
              disabled={Boolean(busy)}
              onChange={(event) => event.target.value && rewrite(event.target.value)}
              className="h-8 rounded-lg border-0 bg-white px-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            >
              <option value="">✨ Rewrite…</option>
              {REWRITE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              variant={isApproved ? "primary" : "secondary"}
              size="sm"
              aria-pressed={isApproved}
              loading={busy === "status"}
              disabled={Boolean(busy)}
              onClick={() =>
                act("status", () => api.updateContent(asset.id, { status: isApproved ? "draft" : "approved" }),
                  isApproved ? "Moved back to draft." : "Approved.")
              }
            >
              {isApproved ? "✓ Approved" : "Approve"}
            </Button>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
                History ({history.length})
              </Button>
            )}
          </div>
          <FeedbackControls status={asset.status} onFeedback={sendFeedback} disabled={Boolean(busy)} />
        </div>
      )}

      {showHistory && !editing && (
        <div className="border-t border-slate-100 px-5 py-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Previous versions</h4>
          <ol className="space-y-3">
            {[...history].reverse().map((version) => (
              <li key={`${version.version}-${version.replaced_at}`} className="rounded-lg p-3 text-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-600">
                    v{version.version} · replaced by {String(version.replaced_by).replace(/_/g, " ")} · {formatDate(version.replaced_at)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => act("edit", () => api.updateContent(asset.id, { content: version.content }), `Restored v${version.version}.`)}
                  >
                    Restore
                  </Button>
                </div>
                <p className="mt-2 line-clamp-2 text-slate-500">{assetToText(type, version.content)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
