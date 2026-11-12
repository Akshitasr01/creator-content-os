import { AudioLines } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Alert, BackLink, Button, Card, PageHeader, TextArea, TextInput } from "../components/ui";
import { useProfile } from "../hooks/useProfile";
import { useToast } from "../hooks/useToast";
import { SOURCE_MAX_CHARS, SOURCE_MIN_CHARS, SOURCE_TYPES } from "../lib/constants";
import { api } from "../services/api";

/** Title + source type + pasted text. Saved before any AI call (PDF steps 8, 21). */
export default function NewProjectPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("transcript");
  const [sourceText, setSourceText] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(null); // "draft" | "analyze" | null
  const [serverError, setServerError] = useState("");

  const length = sourceText.trim().length;
  const lengthOk = length >= SOURCE_MIN_CHARS && length <= SOURCE_MAX_CHARS;

  function validate() {
    const next = {};
    if (!title.trim()) next.title = "Give the project a title.";
    if (length < SOURCE_MIN_CHARS) next.sourceText = `Paste at least ${SOURCE_MIN_CHARS} characters (currently ${length}).`;
    if (length > SOURCE_MAX_CHARS) next.sourceText = `Keep it under ${SOURCE_MAX_CHARS.toLocaleString()} characters.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(mode) {
    if (!validate()) return;
    setSubmitting(mode);
    setServerError("");
    let project;
    try {
      project = await api.createProject({ title, source_type: sourceType, source_text: sourceText });
    } catch (err) {
      setServerError(err.message);
      setSubmitting(null);
      return;
    }

    if (mode === "analyze") {
      try {
        await api.analyzeProject(project.id);
        toast.success("Content analyzed. Review the brief, then generate ideas.");
      } catch (err) {
        // The project is already saved; the project page shows the error and a retry button.
        toast.error(`Project saved, but analysis failed: ${err.message}`);
      }
    } else {
      toast.success("Draft saved.");
    }
    navigate(`/projects/${project.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<BackLink to="/create">Choose a different source</BackLink>}
        title="New text project"
        description="Paste one long-form piece of content. You'll review what the AI understood before anything is generated."
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save("analyze");
        }}
        noValidate
        className="space-y-6"
      >
        <Card className="px-5 py-3.5">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-2 text-subtle">
              <AudioLines className="size-4 shrink-0 text-ink" aria-hidden="true" />
              Writing as <strong className="text-ink">{profile.creator_name}</strong> · {profile.language}
              {profile.tone ? ` · ${profile.tone}` : ""}
            </p>
            <Link to="/settings" className="text-[13px] font-medium text-subtle transition-colors hover:text-ink">
              Edit brand voice
            </Link>
          </div>
        </Card>

        <Card className="space-y-5 p-5">
          <TextInput
            label="Project title"
            required
            placeholder="Complete DSA roadmap"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((c) => ({ ...c, title: undefined }));
            }}
            error={errors.title}
            maxLength={200}
          />

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-graphite">Source type</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOURCE_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="group cursor-pointer rounded-lg border border-line bg-paper p-3 text-sm transition-colors hover:bg-mist has-checked:border-ink has-checked:bg-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
                >
                  <input
                    type="radio"
                    name="source_type"
                    value={type.value}
                    checked={sourceType === type.value}
                    onChange={() => setSourceType(type.value)}
                    className="sr-only"
                  />
                  <span className="block font-medium text-ink group-has-checked:text-paper">{type.label}</span>
                  <span className="mt-0.5 block text-xs text-muted group-has-checked:text-paper/70">{type.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <TextArea
              label="Source content"
              required
              rows={14}
              placeholder="Paste your transcript, article, script or notes here…"
              value={sourceText}
              onChange={(e) => {
                setSourceText(e.target.value);
                setErrors((c) => ({ ...c, sourceText: undefined }));
              }}
              error={errors.sourceText}
            />
            <p className={`mt-1.5 text-right text-xs tabular-nums ${length && !lengthOk ? "font-medium text-ink" : "text-muted"}`}>
              {length.toLocaleString()} / {SOURCE_MAX_CHARS.toLocaleString()} characters
              {length > 0 && length < SOURCE_MIN_CHARS && ` · ${SOURCE_MIN_CHARS - length} more needed`}
            </p>
          </div>
        </Card>

        {serverError && <Alert title="Couldn't save the project">{serverError}</Alert>}
        {submitting === "analyze" && (
          <Alert tone="info">Your project is saved. Reading and analyzing it usually takes 10-40 seconds…</Alert>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => save("draft")} loading={submitting === "draft"} disabled={Boolean(submitting)}>
            Save as draft
          </Button>
          <Button type="submit" loading={submitting === "analyze"} disabled={Boolean(submitting)}>
            {submitting === "analyze" ? "Analyzing your content…" : "Save and analyze content"}
          </Button>
        </div>
      </form>
    </div>
  );
}
