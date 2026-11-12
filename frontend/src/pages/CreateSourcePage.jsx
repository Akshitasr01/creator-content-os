import { ArrowUpRight, AudioLines, CirclePlay, Link2, PenLine, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { IconTile, PageHeader } from "../components/ui";

const SOURCES = [
  {
    to: "/videos/new?source=youtube",
    icon: CirclePlay,
    title: "YouTube video link",
    description: "Paste a YouTube link. Preview it, add its transcript, and get the best clip moments. Attach your original file for MP4s.",
    badge: "Clips",
  },
  {
    to: "/videos/new?source=link",
    icon: Link2,
    title: "Direct video file URL",
    description: "A direct link to a video file you own (.mp4, .mov, .webm). Get up to 10 vertical clips.",
    badge: "Clips",
  },
  {
    to: "/videos/new?source=upload",
    icon: Upload,
    title: "Upload video",
    description: "Upload a long-form video. We transcribe it, find the best moments and render 9:16 reels with subtitles.",
    badge: "Clips",
  },
  {
    to: "/projects/new",
    icon: PenLine,
    title: "Text content",
    description: "Paste a transcript, article, notes or script. Get Reels scripts, LinkedIn posts and carousels.",
    badge: "Posts",
  },
  {
    to: "/videos/new?source=audio",
    icon: AudioLines,
    title: "Audio upload",
    description: "A podcast or voice recording. Get a timestamped transcript and the best clip moments as suggestions.",
    badge: "Suggestions",
  },
];

/** "What are you starting from?" - entry point for every new project. */
export default function CreateSourcePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create something new" description="Choose what you're starting from. Everything ends up in the same workspace." />
      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((source) => (
          <Link
            key={source.title}
            to={source.to}
            className="group flex flex-col rounded-xl border border-line bg-paper p-6 shadow-xs transition-all duration-150 hover:-translate-y-px hover:border-ink/30 hover:shadow-sm focus-visible:border-ink"
          >
            <div className="flex items-start justify-between">
              <IconTile icon={source.icon} className="transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper" />
              <span className="flex items-center gap-2">
                <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-subtle">{source.badge}</span>
                <ArrowUpRight className="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </span>
            </div>
            <h2 className="mt-5 text-[15px] font-semibold tracking-tight text-ink">{source.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{source.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
