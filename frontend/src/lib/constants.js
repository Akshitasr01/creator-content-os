// Keep in sync with backend/core/config.py defaults (the backend re-validates).
export const SOURCE_MIN_CHARS = 200;
export const SOURCE_MAX_CHARS = 30000;
export const MAX_ASSETS_PER_REQUEST = 8;

export const SOURCE_TYPES = [
  { value: "transcript", label: "Transcript", hint: "Video or podcast transcript" },
  { value: "article", label: "Article", hint: "Blog post or newsletter" },
  { value: "notes", label: "Notes", hint: "Rough notes or outline" },
  { value: "script", label: "Script", hint: "Talk or video script" },
];

export const CONTENT_TYPES = {
  reel: { label: "Reel", plural: "Instagram Reels", platform: "Instagram" },
  linkedin: { label: "LinkedIn post", plural: "LinkedIn posts", platform: "LinkedIn" },
  carousel: { label: "Carousel", plural: "Carousels", platform: "Instagram" },
};

export const REWRITE_OPTIONS = [
  { value: "shorter", label: "Shorter" },
  { value: "stronger_hook", label: "Stronger hook" },
  { value: "more_conversational", label: "More conversational" },
  { value: "more_professional", label: "More professional" },
  { value: "simplify", label: "Simplify" },
  { value: "more_storytelling", label: "More storytelling" },
  { value: "hinglish", label: "Convert to Hinglish" },
  { value: "regenerate", label: "Regenerate from scratch" },
];

export const FEEDBACK_REASONS = [
  { value: "too_formal", label: "Too formal" },
  { value: "too_long", label: "Too long" },
  { value: "weak_hook", label: "Weak hook" },
  { value: "sounds_ai", label: "Sounds like AI" },
  { value: "not_my_voice", label: "Not my voice" },
  { value: "other", label: "Other" },
];

export const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
];

export const LANGUAGES = ["English", "Hindi", "Hinglish"];

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
