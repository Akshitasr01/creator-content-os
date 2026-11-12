import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { CONTENT_TYPES, MAX_ASSETS_PER_REQUEST } from "../../lib/constants";
import { Alert, Button, Card, CardHeader } from "../ui";

function defaultCounts(targetPlatforms) {
  const wantsInstagram = !targetPlatforms?.length || targetPlatforms.includes("instagram");
  const wantsLinkedIn = !targetPlatforms?.length || targetPlatforms.includes("linkedin");
  return { reel: wantsInstagram ? 3 : 0, linkedin: wantsLinkedIn ? 2 : 0, carousel: wantsInstagram ? 1 : 0 };
}

function Stepper({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 transition-colors hover:bg-canvas">
      <span className="text-sm font-medium text-graphite">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" aria-label={`Fewer ${label}`} disabled={value <= 0} className="w-8 px-0" onClick={() => onChange(value - 1)}>
          <Minus className="size-3.5" aria-hidden="true" />
        </Button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button variant="secondary" size="sm" aria-label={`More ${label}`} disabled={value >= 5} className="w-8 px-0" onClick={() => onChange(value + 1)}>
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Choose how many of each asset to generate (PDF API: outputs[{type,count}]). */
export default function GeneratePanel({ targetPlatforms, selectedCount, onGenerate, generating }) {
  const [counts, setCounts] = useState(() => defaultCounts(targetPlatforms));
  const total = counts.reel + counts.linkedin + counts.carousel;
  const tooMany = total > MAX_ASSETS_PER_REQUEST;

  function handleGenerate() {
    const outputs = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));
    onGenerate(outputs);
  }

  return (
    <Card id="generate">
      <CardHeader
        title="Generate content"
        description={
          selectedCount > 0
            ? `Using your ${selectedCount} selected idea${selectedCount === 1 ? "" : "s"}.`
            : "No ideas selected: the best-fitting ideas are picked for each platform."
        }
      />
      <div className="space-y-3 p-5">
        {Object.entries(CONTENT_TYPES).map(([type, config]) => (
          <Stepper
            key={type}
            label={config.plural}
            value={counts[type]}
            onChange={(value) => setCounts((current) => ({ ...current, [type]: value }))}
          />
        ))}

        {tooMany && (
          <Alert tone="warning">Generate up to {MAX_ASSETS_PER_REQUEST} assets at a time.</Alert>
        )}
        {generating && (
          <Alert tone="info">
            Writing {total} asset{total === 1 ? "" : "s"} in your voice. This can take a minute; please keep this tab open.
          </Alert>
        )}

        <Button className="w-full" size="lg" onClick={handleGenerate} loading={generating} disabled={total === 0 || tooMany}>
          {generating ? "Generating…" : `Generate ${total} asset${total === 1 ? "" : "s"}`}
        </Button>
      </div>
    </Card>
  );
}
