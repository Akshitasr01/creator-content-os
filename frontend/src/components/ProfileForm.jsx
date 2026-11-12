import { useState } from "react";

import { LANGUAGES, PLATFORMS } from "../lib/constants";
import { Button, Card, CardHeader, Select, TextArea, TextInput } from "./ui";

const SAMPLE_COUNT = 3;

function initialState(profile) {
  const samples = profile?.sample_posts || [];
  const preferences = profile?.platform_preferences || [];
  return {
    creator_name: profile?.creator_name || "",
    niche: profile?.niche || "",
    audience: profile?.audience || "",
    language: profile?.language || "English",
    tone: profile?.tone || "",
    style_description: profile?.style_description || "",
    things_to_avoid: profile?.things_to_avoid || "",
    target_platforms: profile?.target_platforms?.length ? profile.target_platforms : ["instagram", "linkedin"],
    sample_posts: Array.from({ length: SAMPLE_COUNT }, (_, i) => samples[i] || ""),
    platform_preferences: PLATFORMS.map(({ value }) => {
      const saved = preferences.find((p) => p.platform === value);
      return { platform: value, preferred_length: saved?.preferred_length || "medium", cta_style: saved?.cta_style || "" };
    }),
  };
}

/**
 * One focused form for the creator profile + voice (PDF step 7).
 * Used by onboarding (first save) and Settings (editing later).
 */
export default function ProfileForm({ profile, onSubmit, submitLabel, showPlatformPreferences = false }) {
  const [form, setForm] = useState(() => initialState(profile));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateSample(index, value) {
    setForm((current) => ({
      ...current,
      sample_posts: current.sample_posts.map((post, i) => (i === index ? value : post)),
    }));
  }

  function togglePlatform(platform) {
    setForm((current) => ({
      ...current,
      target_platforms: current.target_platforms.includes(platform)
        ? current.target_platforms.filter((p) => p !== platform)
        : [...current.target_platforms, platform],
    }));
    setErrors((current) => ({ ...current, target_platforms: undefined }));
  }

  function updatePreference(platform, field, value) {
    setForm((current) => ({
      ...current,
      platform_preferences: current.platform_preferences.map((p) =>
        p.platform === platform ? { ...p, [field]: value } : p
      ),
    }));
  }

  function validate() {
    const next = {};
    if (!form.creator_name.trim()) next.creator_name = "Enter the name you publish under.";
    if (!form.niche.trim()) next.niche = "Tell us your niche so ideas stay relevant.";
    if (!form.audience.trim()) next.audience = "Describe who you create for.";
    if (form.target_platforms.length === 0) next.target_platforms = "Pick at least one platform.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        sample_posts: form.sample_posts.map((s) => s.trim()).filter(Boolean),
        platform_preferences: showPlatformPreferences ? form.platform_preferences : [],
      });
    } finally {
      setSaving(false);
    }
  }

  const samplesFilled = form.sample_posts.filter((s) => s.trim()).length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader title="About you" description="Who you are and who you create for." />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <TextInput
            label="Creator name"
            required
            value={form.creator_name}
            onChange={(e) => update("creator_name", e.target.value)}
            error={errors.creator_name}
            maxLength={100}
          />
          <TextInput
            label="Niche"
            required
            placeholder="Coding + career"
            value={form.niche}
            onChange={(e) => update("niche", e.target.value)}
            error={errors.niche}
            maxLength={200}
          />
          <TextArea
            className="sm:col-span-2"
            label="Audience"
            required
            rows={2}
            placeholder="Indian engineering students preparing for placements"
            value={form.audience}
            onChange={(e) => update("audience", e.target.value)}
            error={errors.audience}
            maxLength={500}
          />
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-graphite">
              Target platforms <span className="text-muted">*</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-mist has-checked:border-ink has-checked:bg-mist"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-ink"
                    checked={form.target_platforms.includes(platform.value)}
                    onChange={() => togglePlatform(platform.value)}
                  />
                  {platform.label}
                </label>
              ))}
            </div>
            {errors.target_platforms && <p className="mt-1.5 text-sm text-danger">{errors.target_platforms}</p>}
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Creator voice"
          description="How you sound. The AI adapts to these preferences; it does not clone you."
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Select label="Language" value={form.language} onChange={(e) => update("language", e.target.value)}>
            {LANGUAGES.map((language) => (
              <option key={language}>{language}</option>
            ))}
          </Select>
          <TextInput
            label="Tone"
            placeholder="Casual, educational"
            value={form.tone}
            onChange={(e) => update("tone", e.target.value)}
            maxLength={200}
          />
          <TextArea
            className="sm:col-span-2"
            label="Writing style"
            rows={3}
            placeholder="Short sentences, concrete examples, occasional humour"
            value={form.style_description}
            onChange={(e) => update("style_description", e.target.value)}
            maxLength={2000}
          />
          <TextArea
            className="sm:col-span-2"
            label="Words and behaviours to avoid"
            rows={2}
            placeholder="Corporate phrasing, too many emojis, fake motivation"
            value={form.things_to_avoid}
            onChange={(e) => update("things_to_avoid", e.target.value)}
            maxLength={2000}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sample posts"
          description={`Paste 3 strong posts that sound like you. Used as style references only. (${samplesFilled}/3 added)`}
        />
        <div className="grid gap-5 p-5">
          {form.sample_posts.map((sample, index) => (
            <TextArea
              key={index}
              label={`Sample post ${index + 1}`}
              rows={4}
              value={sample}
              onChange={(e) => updateSample(index, e.target.value)}
              maxLength={5000}
            />
          ))}
        </div>
      </Card>

      {showPlatformPreferences && (
        <Card>
          <CardHeader title="Platform preferences" description="Defaults applied whenever content is generated for a platform." />
          <div className="divide-y divide-line">
            {form.platform_preferences.map((preference) => (
              <div key={preference.platform} className="grid gap-4 p-5 sm:grid-cols-[8rem_10rem_1fr] sm:items-end">
                <p className="text-sm font-semibold text-ink sm:pb-2">
                  {PLATFORMS.find((p) => p.value === preference.platform)?.label}
                </p>
                <Select
                  label="Preferred length"
                  value={preference.preferred_length}
                  onChange={(e) => updatePreference(preference.platform, "preferred_length", e.target.value)}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </Select>
                <TextInput
                  label="CTA style"
                  placeholder="Ask a question / Save for later / Follow for more"
                  value={preference.cta_style}
                  onChange={(e) => updatePreference(preference.platform, "cta_style", e.target.value)}
                  maxLength={300}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
