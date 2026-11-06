import CopyButton from "../CopyButton";
import { captionText, hashtagLine } from "./assetFormat";

function Section({ label, children, copyText }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h4>
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
        <p className="text-lg font-semibold leading-snug text-slate-900">{content.hook}</p>
      </Section>
      <Section label={`Script · ~${content.estimated_duration_seconds}s`} copyText={content.script}>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{content.script}</p>
      </Section>
      <Section label="Caption" copyText={captionText(content)}>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{content.caption}</p>
        <p className="mt-2 text-sm font-medium text-slate-800">{content.cta}</p>
        <p className="mt-2 text-sm text-brand-700">{hashtagLine(content.hashtags)}</p>
      </Section>
    </div>
  );
}

function LinkedInView({ content }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 sm:p-5">
      <p className="font-semibold text-slate-900">{content.hook}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{content.body}</p>
      {content.cta && <p className="mt-3 text-sm text-slate-800">{content.cta}</p>}
      {content.hashtags?.length > 0 && <p className="mt-3 text-sm text-brand-700">{hashtagLine(content.hashtags)}</p>}
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
            className={`flex aspect-[4/5] w-56 shrink-0 snap-start flex-col rounded-xl p-5 ring-1 ${
              index === 0 ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-900 ring-slate-200"
            }`}
          >
            <span className={`text-xs font-medium ${index === 0 ? "text-brand-100" : "text-slate-400"}`}>
              {slide.number} / {slides.length}
            </span>
            <p className={`mt-3 font-semibold leading-snug ${index === 0 ? "text-xl" : "text-base"}`}>{slide.heading}</p>
            <p className={`mt-2 text-sm leading-relaxed ${index === 0 ? "text-brand-50" : "text-slate-600"}`}>{slide.body}</p>
          </li>
        ))}
      </ol>
      <Section label="Caption" copyText={captionText(content)}>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{content.caption}</p>
        {content.cta && <p className="mt-2 text-sm font-medium text-slate-800">{content.cta}</p>}
        {content.hashtags?.length > 0 && <p className="mt-2 text-sm text-brand-700">{hashtagLine(content.hashtags)}</p>}
      </Section>
    </div>
  );
}

const VIEWS = { reel: ReelView, linkedin: LinkedInView, carousel: CarouselView };

export default function AssetView({ type, content }) {
  const View = VIEWS[type];
  return View ? <View content={content} /> : <pre className="text-xs">{JSON.stringify(content, null, 2)}</pre>;
}
