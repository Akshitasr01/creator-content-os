import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Alert, Button, Card, PageHeader, TextArea, TextInput } from "../components/ui";
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
        title="New project"
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
        <Card className="p-5">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-600">
              Writing as <strong className="text-slate-900">{profile.creator_name}</strong> · {profile.language}
              {profile.tone ? ` · ${profile.tone}` : ""}
            </p>
            <Link to="/settings" className="font-medium text-brand-600 hover:text-brand-700">
              Edit creator profile
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
            <legend className="mb-1.5 text-sm font-medium text-slate-800">Source type</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOURCE_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="cursor-pointer rounded-lg p-3 text-sm ring-1 ring-slate-300 has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-500"
                >
                  <input
                    type="radio"
                    name="source_type"
                    value={type.value}
                    checked={sourceType === type.value}
                    onChange={() => setSourceType(type.value)}
                    className="sr-only"
                  />
                  <span className="block font-medium text-slate-900">{type.label}</span>
                  <span className="block text-xs text-slate-500">{type.hint}</span>
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
            <p className={`mt-1.5 text-right text-xs ${length && !lengthOk ? "text-amber-700" : "text-slate-500"}`}>
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
