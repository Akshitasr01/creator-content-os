import { Link } from "react-router-dom";

import { PageHeader } from "../components/ui";

const SOURCES = [
  {
    to: "/videos/new?source=youtube",
    icon: "▶",
    title: "YouTube video link",
    description: "Paste a YouTube link. Preview it, add its transcript, and get the best clip moments. Attach your original file for MP4s.",
    badge: "Clips",
  },
  {
    to: "/videos/new?source=link",
    icon: "🔗",
    title: "Direct video file URL",
    description: "A direct link to a video file you own (.mp4, .mov, .webm). Get up to 10 vertical clips.",
    badge: "Clips",
  },
  {
    to: "/videos/new?source=upload",
    icon: "🎬",
    title: "Upload video",
    description: "Upload a long-form video. We transcribe it, find the best moments and render 9:16 reels with subtitles.",
    badge: "Clips",
  },
  {
    to: "/projects/new",
    icon: "📝",
    title: "Text content",
    description: "Paste a transcript, article, notes or script. Get Reels scripts, LinkedIn posts and carousels.",
    badge: "Posts",
  },
  {
    to: "/videos/new?source=audio",
    icon: "🎙",
    title: "Audio upload",
    description: "A podcast or voice recording. Get a timestamped transcript and the best clip moments as suggestions.",
    badge: "Suggestions",
  },
];

/** "What are you starting from?" - entry point for every new project. */
export default function CreateSourcePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create something new" description="Choose what you're starting from." />
      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <Link
            key={source.title}
            to={source.to}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:border-brand-500"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden="true">
                {source.icon}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{source.badge}</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-brand-700">{source.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{source.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
