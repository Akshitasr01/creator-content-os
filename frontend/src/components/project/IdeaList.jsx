import { CONTENT_TYPES } from "../../lib/constants";
import { Badge } from "../ui";

/** Selectable content angles (PDF step 13). Nothing selected = auto-select best ideas. */
export default function IdeaList({ ideas, selected, onToggle }) {
  return (
    <ol className="divide-y divide-line">
      {ideas.map((idea, index) => {
        const checked = selected.has(index);
        return (
          <li key={index}>
            <label className={`relative flex cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-canvas ${checked ? "bg-canvas before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ink" : ""}`}>
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-ink"
                checked={checked}
                onChange={() => onToggle(index)}
                aria-describedby={`idea-${index}-hook`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <p className="font-medium text-ink">{idea.title}</p>
                </div>
                <p id={`idea-${index}-hook`} className="mt-1 text-sm text-graphite">
                  <span className="font-medium text-muted">Hook: </span>
                  {idea.hook}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{idea.why_it_works}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(idea.platforms?.length ? idea.platforms : []).map((platform) => (
                    <Badge key={platform} tone="brand">
                      {CONTENT_TYPES[platform]?.label || platform}
                    </Badge>
                  ))}
                  {!idea.platforms?.length && idea.recommended_format && (
                    <Badge tone="brand">{idea.recommended_format}</Badge>
                  )}
                </div>
              </div>
            </label>
          </li>
        );
      })}
    </ol>
  );
}
