import { useState } from "react";

import { Button, TextArea, TextInput } from "../ui";

function tagsToText(tags) {
  return (tags || []).join(" ");
}

function textToTags(text) {
  return text.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);
}

/** Simple editor for one asset. Explicit Save (PDF step 23). */
export default function AssetEditor({ type, content, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    ...content,
    hashtags: tagsToText(content.hashtags),
    slides: (content.slides || []).map((slide) => ({ ...slide })),
  }));
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  function setSlide(index, key, value) {
    setDraft((current) => ({
      ...current,
      slides: current.slides.map((slide, i) => (i === index ? { ...slide, [key]: value } : slide)),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const result = { ...draft, hashtags: textToTags(draft.hashtags) };
    if (type === "reel") result.estimated_duration_seconds = Number(draft.estimated_duration_seconds) || 0;
    if (type === "carousel") result.slides = draft.slides.map((slide, i) => ({ ...slide, number: i + 1 }));
    else delete result.slides;
    const saved = await onSave(result);
    if (!saved) setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {type === "reel" && (
        <>
          <TextArea label="Hook" rows={2} required value={draft.hook} onChange={set("hook")} />
          <TextArea label="Script" rows={10} required value={draft.script} onChange={set("script")} />
          <TextArea label="Caption" rows={3} required value={draft.caption} onChange={set("caption")} />
          <TextInput label="Call to action" required value={draft.cta} onChange={set("cta")} />
          <TextInput
            label="Estimated duration (seconds)"
            type="number"
            min={5}
            max={180}
            value={draft.estimated_duration_seconds}
            onChange={set("estimated_duration_seconds")}
          />
        </>
      )}

      {type === "linkedin" && (
        <>
          <TextArea label="First line" rows={2} required value={draft.hook} onChange={set("hook")} />
          <TextArea label="Body" rows={12} required value={draft.body} onChange={set("body")} />
          <TextInput label="Call to action" value={draft.cta} onChange={set("cta")} />
        </>
      )}

      {type === "carousel" && (
        <>
          <TextInput label="Title" required value={draft.title} onChange={set("title")} />
          {draft.slides.map((slide, index) => (
            <fieldset key={index} className="grid gap-3 rounded-lg p-4 ring-1 ring-slate-200">
              <legend className="px-1 text-xs font-medium text-slate-500">Slide {index + 1}</legend>
              <TextInput label="Heading" required value={slide.heading} onChange={(e) => setSlide(index, "heading", e.target.value)} />
              <TextArea label="Body" rows={2} value={slide.body} onChange={(e) => setSlide(index, "body", e.target.value)} />
            </fieldset>
          ))}
          <TextArea label="Caption" rows={3} required value={draft.caption} onChange={set("caption")} />
          <TextInput label="Call to action" value={draft.cta} onChange={set("cta")} />
        </>
      )}

      <TextInput label="Hashtags" hint="Separate with spaces." value={draft.hashtags} onChange={set("hashtags")} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
