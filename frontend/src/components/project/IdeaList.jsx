import { CONTENT_TYPES } from "../../lib/constants";
import { Badge } from "../ui";

/** Selectable content angles (PDF step 13). Nothing selected = auto-select best ideas. */
export default function IdeaList({ ideas, selected, onToggle }) {
  return (
    <ol className="divide-y divide-slate-100">
      {ideas.map((idea, index) => {
        const checked = selected.has(index);
        return (
          <li key={index}>
            <label className={`flex cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-slate-50 ${checked ? "bg-brand-50/60" : ""}`}>
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-brand-600"
                checked={checked}
                onChange={() => onToggle(index)}
                aria-describedby={`idea-${index}-hook`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                  <p className="font-medium text-slate-900">{idea.title}</p>
                </div>
                <p id={`idea-${index}-hook`} className="mt-1 text-sm text-slate-700">
                  <span className="font-medium text-slate-500">Hook: </span>
                  {idea.hook}
                </p>
                <p className="mt-1 text-sm text-slate-500">{idea.why_it_works}</p>
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
