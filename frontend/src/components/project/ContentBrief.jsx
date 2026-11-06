import { useState } from "react";

import { Button, Card, CardHeader, DemoBadge, TextArea, TextInput } from "../ui";

const LIST_FIELDS = [
  { key: "key_points", label: "Key themes" },
  { key: "examples", label: "Examples & data points" },
  { key: "strong_claims", label: "Strong claims" },
  { key: "hooks", label: "Potential hooks" },
  { key: "content_angles", label: "Suggested content angles" },
];

function toLines(list) {
  return (list || []).join("\n");
}

function fromLines(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function BriefEditor({ analysis, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    main_topic: analysis.main_topic || "",
    target_audience: analysis.target_audience || "",
    summary: analysis.summary || "",
    ...Object.fromEntries(LIST_FIELDS.map(({ key }) => [key, toLines(analysis[key])])),
  }));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave({
      main_topic: draft.main_topic.trim(),
      target_audience: draft.target_audience.trim(),
      summary: draft.summary.trim(),
      ...Object.fromEntries(LIST_FIELDS.map(({ key }) => [key, fromLines(draft[key])])),
    });
    if (!saved) setSaving(false);
  }

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 p-5 sm:grid-cols-2">
      <TextInput label="Main topic" required value={draft.main_topic} onChange={set("main_topic")} />
      <TextInput label="Audience" required value={draft.target_audience} onChange={set("target_audience")} />
      <TextArea className="sm:col-span-2" label="Summary" rows={3} required value={draft.summary} onChange={set("summary")} />
      {LIST_FIELDS.map(({ key, label }) => (
        <TextArea key={key} label={label} hint="One item per line." rows={4} value={draft[key]} onChange={set(key)} />
      ))}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save brief
        </Button>
      </div>
    </form>
  );
}

/** Shows what the system understood and lets the user correct it (PDF step 22). */
export default function ContentBrief({ analysis, onSave, onReanalyze, reanalyzing }) {
  const [editing, setEditing] = useState(false);
  const isDemo = analysis.generated_by?.provider === "mock";

  async function handleSave(values) {
    const ok = await onSave(values);
    if (ok) setEditing(false);
    return ok;
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Content brief {isDemo && <DemoBadge />}
          </span>
        }
        description={analysis.edited_by_user ? "Edited by you" : "What the AI understood from your source"}
        actions={
          !editing && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit brief
              </Button>
              <Button variant="ghost" size="sm" onClick={onReanalyze} loading={reanalyzing}>
                Re-analyze
              </Button>
            </>
          )
        }
      />

      {editing ? (
        <BriefEditor analysis={analysis} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <div className="space-y-6 p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Main topic</dt>
              <dd className="mt-1 font-medium text-slate-900">{analysis.main_topic}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Audience</dt>
              <dd className="mt-1 text-slate-900">{analysis.target_audience}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary</dt>
              <dd className="mt-1 text-slate-700">{analysis.summary}</dd>
            </div>
          </dl>
          <div className="grid gap-6 md:grid-cols-2">
            {LIST_FIELDS.map(({ key, label }) =>
              analysis[key]?.length ? (
                <div key={key}>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {analysis[key].map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
