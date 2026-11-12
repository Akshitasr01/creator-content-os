import CopyButton from "../CopyButton";
import { captionText, hashtagLine } from "./assetFormat";

function Section({ label, children, copyText }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">{label}</h4>
        {copyText && <CopyButton text={copyText} label="Copy" size="sm" variant="ghost" />}
      </div>
      {children}
    </div>
  );
}

function ReelView({ content }) {
  return (
    <div className="space-y-5">
      <Section label="Hook" copyText={content.hook}>
        <p className="text-lg font-semibold leading-snug text-ink">{content.hook}</p>
      </Section>
      <Section label={`Script · ~${content.estimated_duration_seconds}s`} copyText={content.script}>
        <p className="whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 text-sm leading-relaxed text-graphite">{content.script}</p>
      </Section>
      <Section label="Caption" copyText={captionText(content)}>
        <p className="whitespace-pre-wrap text-sm text-graphite">{content.caption}</p>
        <p className="mt-2 text-sm font-medium text-graphite">{content.cta}</p>
        <p className="mt-2 text-sm text-ink">{hashtagLine(content.hashtags)}</p>
      </Section>
    </div>
  );
}

function LinkedInView({ content }) {
  return (
    <div className="rounded-lg border border-line p-4 sm:p-5">
      <p className="font-semibold text-ink">{content.hook}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-graphite">{content.body}</p>
      {content.cta && <p className="mt-3 text-sm text-graphite">{content.cta}</p>}
      {content.hashtags?.length > 0 && <p className="mt-3 text-sm text-ink">{hashtagLine(content.hashtags)}</p>}
    </div>
  );
}

/** Slide-by-slide preview rendered from the structured response (PDF step 16). */
function CarouselView({ content }) {
  const slides = content.slides || [];
  return (
    <div className="space-y-5">
      <ol className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2" aria-label="Carousel slides">
        {slides.map((slide, index) => (
          <li
            key={slide.number}
            className={`flex aspect-[4/5] w-56 shrink-0 snap-start flex-col rounded-xl border p-5 ${
              index === 0 ? "border-ink bg-ink text-paper" : "border-line bg-paper text-ink"
            }`}
          >
            <span className={`text-xs font-medium ${index === 0 ? "text-paper/80" : "text-muted"}`}>
              {slide.number} / {slides.length}
            </span>
            <p className={`mt-3 font-semibold leading-snug ${index === 0 ? "text-xl" : "text-base"}`}>{slide.heading}</p>
            <p className={`mt-2 text-sm leading-relaxed ${index === 0 ? "text-paper/70" : "text-subtle"}`}>{slide.body}</p>
          </li>
        ))}
      </ol>
      <Section label="Caption" copyText={captionText(content)}>
        <p className="whitespace-pre-wrap text-sm text-graphite">{content.caption}</p>
        {content.cta && <p className="mt-2 text-sm font-medium text-graphite">{content.cta}</p>}
        {content.hashtags?.length > 0 && <p className="mt-2 text-sm text-ink">{hashtagLine(content.hashtags)}</p>}
      </Section>
    </div>
  );
}

const VIEWS = { reel: ReelView, linkedin: LinkedInView, carousel: CarouselView };

export default function AssetView({ type, content }) {
  const View = VIEWS[type];
  return View ? <View content={content} /> : <pre className="text-xs">{JSON.stringify(content, null, 2)}</pre>;
}
