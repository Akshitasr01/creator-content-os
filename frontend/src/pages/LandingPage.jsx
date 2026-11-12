import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  ChevronDown,
  FileText,
  History,
  Languages,
  Lock,
  Menu,
  Scissors,
  WandSparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import Logo, { LogoMark } from "../components/Logo";
import { IconTile } from "../components/ui";
import VideoUrlForm from "../components/VideoUrlForm";
import { useAuth } from "../hooks/useAuth";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  { icon: Scissors, title: "Finds the moments worth posting", body: "AI reads the full transcript and picks up to 10 self-contained, non-overlapping clips, each with a reason." },
  { icon: Captions, title: "Vertical clips with subtitles", body: "Real 9:16 MP4s with burned-in captions and full-quality audio, ready to download." },
  { icon: AudioLines, title: "Written in your voice", body: "Your tone, audience, sample posts and banned phrases shape every Reel, post and carousel." },
  { icon: FileText, title: "A brief before anything is written", body: "Review what the AI understood (themes, hooks, claims) and correct it before generating." },
  { icon: WandSparkles, title: "One-click rewrites", body: "Shorter, stronger hook, more storytelling, more professional, simpler, or Hinglish." },
  { icon: History, title: "Edit with version history", body: "Every change keeps the previous version. Approve, restore, copy or download." },
  { icon: Languages, title: "English, Hindi and Hinglish", body: "Write for the audience you actually have, in the language they speak." },
  { icon: Lock, title: "Private by default", body: "Your projects, transcripts and clips are visible only to you. Keys never reach the browser." },
];

const STEPS = [
  { title: "Bring one long-form piece", body: "Paste a YouTube or video link, upload a video or audio file, or paste a transcript or article." },
  { title: "Review what the AI found", body: "A content brief, 10 angles and the strongest clip moments, all editable before you generate." },
  { title: "Publish a week of content", body: "Reels, short clips, LinkedIn posts and carousels in your voice. Edit, rewrite, copy, download." },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    blurb: "Try the full workflow on your own content.",
    features: ["3 projects per month", "5 clips per video", "Reels, LinkedIn & carousel posts", "Creator voice profile"],
    cta: "Start for free",
  },
  {
    name: "Creator",
    price: "$19",
    blurb: "For creators publishing every week.",
    features: ["30 projects per month", "10 clips per video", "Subtitled 9:16 MP4 downloads", "All rewrite tools", "Version history"],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Studio",
    price: "$49",
    blurb: "For teams and high-volume educators.",
    features: ["Unlimited projects", "Long videos up to 3 hours", "Priority processing", "Everything in Creator"],
    cta: "Start free trial",
  },
];

const FAQS = [
  { q: "What can I turn into content?", a: "A YouTube link, a direct video file URL, an uploaded video or audio file, or pasted text such as a transcript, article, script or notes." },
  { q: "How do YouTube links work?", a: "We show the official YouTube preview and use the video's captions (for your own videos), a transcript you paste, or the original file you upload. We never download videos from YouTube." },
  { q: "Will the content sound like me?", a: "Yes. You set your niche, audience, tone, style, phrases to avoid and three sample posts once, and every output is written from that profile. You can edit it any time." },
  { q: "Can I edit what the AI writes?", a: "Everything is editable: the brief, ideas, posts, captions and clip timestamps. Each edit keeps the previous version so you can restore it." },
  { q: "Which platforms are supported?", a: "Instagram Reels and other short-form video, LinkedIn posts and carousels. Clips are rendered as vertical 9:16 MP4s." },
  { q: "Is my content private?", a: "Yes. Your data is protected by row-level security so only your account can read it, and rendered clips are stored privately behind expiring links." },
];

/* ---------- Product preview: an HTML mock of the workspace (no images) ---------- */

function ClipThumb({ label, time, active }) {
  return (
    <div className={`relative aspect-[9/16] overflow-hidden rounded-md ${active ? "bg-graphite" : "bg-charcoal"}`}>
      <div className="absolute inset-x-0 top-[38%] mx-auto size-6 rounded-full bg-paper/15" />
      <div className="absolute inset-x-[18%] top-[48%] h-6 rounded-t-full bg-paper/10" />
      <div className="absolute inset-x-2 bottom-7 space-y-1">
        <div className="mx-auto h-1.5 w-4/5 rounded-full bg-paper/85" />
        <div className="mx-auto h-1.5 w-3/5 rounded-full bg-paper/85" />
      </div>
      <span className="absolute left-1.5 top-1.5 rounded bg-ink/70 px-1 text-[9px] font-medium tabular-nums text-paper">{time}</span>
      <span className="absolute inset-x-1.5 bottom-1.5 truncate text-[9px] font-medium text-paper/70">{label}</span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-xl" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-3">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <div className="mx-auto hidden h-6 w-72 items-center justify-center rounded-md border border-line bg-paper text-[11px] text-muted sm:flex">
          app.creatorcontentos.com/videos
        </div>
      </div>
      <div className="grid md:grid-cols-[180px_1fr]">
        <div className="hidden border-r border-line p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-1">
            <LogoMark className="size-5 text-ink" />
            <span className="text-[11px] font-semibold">Creator Content OS</span>
          </div>
          {["Dashboard", "Create content", "Video clips", "Brand voice"].map((item, index) => (
            <div key={item} className={`mb-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${index === 2 ? "bg-ink text-paper" : "text-subtle"}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-ink">How I grew to 100k by teaching in public</p>
              <p className="text-[11px] text-muted">YouTube · 42:18 · 8 clips</p>
            </div>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-paper">Completed</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <ClipThumb label="The 1% rule" time="0:42" active />
            <ClipThumb label="Teach, don't pitch" time="5:10" />
            <ClipThumb label="My worst launch" time="12:03" />
            <ClipThumb label="Systems > goals" time="18:47" />
            <div className="hidden sm:block"><ClipThumb label="Pricing myth" time="26:30" /></div>
            <div className="hidden sm:block"><ClipThumb label="Start today" time="39:55" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Reel script", "Most creators quit at 1,000 followers. Here's the one habit that got me past it…"],
              ["LinkedIn post", "I spent 3 years teaching for free. It was the best marketing decision I ever made."],
              ["Carousel · 7 slides", "Slide 1: Teaching in public beats posting in public. Here's why:"],
            ].map(([kind, text]) => (
              <div key={kind} className="rounded-lg border border-line p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{kind}</p>
                <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-graphite">{text}</p>
                <div className="mt-2.5 flex gap-1.5">
                  <span className="h-5 w-12 rounded border border-line" />
                  <span className="h-5 w-10 rounded bg-ink" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

function SectionHeading({ eyebrow, title, body, id }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-base leading-relaxed text-subtle">{body}</p>}
    </div>
  );
}

function SiteHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const primary = user ? { to: "/dashboard", label: "Open dashboard" } : { to: "/signup", label: "Get started" };

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm text-subtle transition-colors hover:bg-mist hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {!user && (
            <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-graphite transition-colors hover:bg-mist">
              Sign in
            </Link>
          )}
          <Link to={primary.to} className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-graphite">
            {primary.label}
          </Link>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-graphite hover:bg-mist md:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav id="site-menu" className="animate-fade-in border-t border-line bg-paper px-4 py-3 md:hidden" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm text-graphite hover:bg-mist">
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex gap-2 border-t border-line pt-3">
            {!user && (
              <Link to="/login" className="flex h-10 flex-1 items-center justify-center rounded-lg border border-line text-sm font-medium text-ink">
                Sign in
              </Link>
            )}
            <Link to={primary.to} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-ink text-sm font-medium text-paper">
              {primary.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const startLink = user ? "/create" : "/signup";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-line bg-canvas">
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[13px] text-subtle shadow-xs">
              <span className="size-1.5 rounded-full bg-ink" aria-hidden="true" />
              For educators, coaches and creators
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink sm:text-7xl">
              One Video.
              <br />
              <span className="text-muted">A Week of Content.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-subtle sm:text-lg">
              Turn a long-form video, podcast or article into short clips, Reels scripts, LinkedIn posts and carousels, written in your own voice.
            </p>
            <div className="mt-10">
              <VideoUrlForm />
            </div>
            <div className="mx-auto mt-16 max-w-5xl text-left sm:mt-20">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Output strip */}
        <section className="border-b border-line" aria-label="What one video becomes">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-4 sm:px-6 md:grid-cols-4 md:divide-x">
            {[
              ["10", "clip moments per video"],
              ["9:16", "MP4s with subtitles"],
              ["3", "post formats per idea"],
              ["8", "one-click rewrites"],
            ].map(([value, label]) => (
              <div key={label} className="px-2 py-8 text-center md:px-6">
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl font-semibold tracking-tight text-ink">{value}</dd>
                <dd className="mt-1 text-sm text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 py-24" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              id="features-heading"
              eyebrow="Features"
              title="Everything between recording and posting"
              body="One workspace for finding your best moments, cutting clips and writing posts that sound like you."
            />
            <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="bg-paper p-6 transition-colors hover:bg-canvas">
                  <IconTile icon={feature.icon} />
                  <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-subtle">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 border-y border-line bg-canvas py-24" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps. No editing timeline." />
            <ol className="mt-16 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-line bg-paper p-7">
                  <span className="text-[13px] font-semibold tabular-nums text-muted">0{index + 1}</span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-subtle">{step.body}</p>
                  {index < STEPS.length - 1 && (
                    <ArrowRight className="absolute -right-5 top-1/2 hidden size-4 -translate-y-1/2 text-muted md:block" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Voice showcase */}
        <section className="py-24" aria-labelledby="voice-heading">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">Creator voice</p>
              <h2 id="voice-heading" className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                It writes like you. Not like a template.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-subtle">
                Set your audience, tone, writing style, phrases to avoid and a few posts you're proud of. Every hook, caption and carousel is written from that profile.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-graphite">
                {["Per-platform length and call-to-action preferences", "Hinglish and Hindi supported natively", "Thumbs up or down teaches it what works"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6" aria-hidden="true">
              <div className="rounded-xl border border-line bg-paper p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">A</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">LinkedIn post</p>
                    <p className="text-xs text-muted">Conversational · Educator · English</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">I stopped selling my course. Sales doubled.</p>
                <p className="mt-2 text-sm leading-relaxed text-subtle">
                  For six months I posted one thing: what I learned that week, explained simply. No pitch. No links. Just the lesson.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-subtle">Here's what changed, and the 3 rules I follow now:</p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                  {["Shorter", "Stronger hook", "More storytelling", "Hinglish"].map((label) => (
                    <span key={label} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-graphite">{label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 border-t border-line bg-canvas py-24" aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="pricing-heading" eyebrow="Pricing" title="Simple plans that grow with you" body="Start free. Upgrade when you're publishing every week." />
            <div className="mt-16 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border p-7 ${plan.featured ? "border-ink bg-ink text-paper shadow-xl" : "border-line bg-paper text-ink"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                    {plan.featured && <span className="rounded-full border border-paper/25 px-2 py-0.5 text-[11px] font-medium text-paper/80">Most popular</span>}
                  </div>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-semibold tracking-tight">{plan.price}</span>
                    <span className={plan.featured ? "text-paper/60" : "text-muted"}>/month</span>
                  </p>
                  <p className={`mt-3 text-sm ${plan.featured ? "text-paper/70" : "text-subtle"}`}>{plan.blurb}</p>
                  <ul className={`mt-8 flex-1 space-y-3 border-t pt-6 text-sm ${plan.featured ? "border-paper/15" : "border-line"}`}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className={`mt-0.5 size-4 shrink-0 ${plan.featured ? "text-paper" : "text-ink"}`} aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={startLink}
                    className={`mt-8 flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      plan.featured ? "bg-paper text-ink hover:bg-mist" : "border border-line bg-paper text-ink hover:bg-mist"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-[13px] text-muted">
              Example pricing. Creator Content OS is currently in free beta and nothing is charged.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 py-24" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-12 divide-y divide-line border-y border-line">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="animate-fade-in pb-5 pr-10 text-sm leading-relaxed text-subtle">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-3xl bg-ink px-6 py-16 text-center text-paper sm:px-12 sm:py-20">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Your next week of content is already recorded.</h2>
            <p className="mx-auto mt-4 max-w-xl text-paper/70">Paste one link and see what it becomes.</p>
            <Link
              to={startLink}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-paper px-6 text-[15px] font-medium text-ink transition-colors hover:bg-mist"
            >
              {user ? "Create a project" : "Get started free"} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Turn one long-form piece into a week of platform-native content, in your voice.</p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Product</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              {NAV_LINKS.map((link) => (
                <li key={link.href}><a href={link.href} className="transition-colors hover:text-ink">{link.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink">Account</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              {user ? (
                <li><Link to="/dashboard" className="transition-colors hover:text-ink">Dashboard</Link></li>
              ) : (
                <>
                  <li><Link to="/login" className="transition-colors hover:text-ink">Sign in</Link></li>
                  <li><Link to="/signup" className="transition-colors hover:text-ink">Create account</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-muted sm:px-6">© {new Date().getFullYear()} Creator Content OS. Your voice, every platform.</p>
        </div>
      </footer>
    </div>
  );
}
