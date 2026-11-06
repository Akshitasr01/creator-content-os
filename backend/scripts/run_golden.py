"""Golden test set (PDF step 27): rerun fixed inputs after prompt/model changes.

Runs analyze -> ideas -> 1 Reel + 1 LinkedIn post + 1 carousel for every file in
golden/inputs using the provider in backend/.env (AI_PROVIDER). Nothing is saved
to the database. Results go to golden/outputs/<timestamp>/ for side-by-side review.

COST: with AI_PROVIDER=openai this makes 5 AI calls per input file (25 total).

Usage (from the backend folder, venv active):
    python scripts/run_golden.py                 # all inputs
    python scripts/run_golden.py 02_hinglish     # only files containing this text
"""

import json
import sys
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import content_analyzer, idea_generator  # noqa: E402
from services.content_service import GENERATORS  # noqa: E402
from services.generation_context import GenerationContext  # noqa: E402
from services.llm_service import LLMService  # noqa: E402

PROFILE = {
    "creator_name": "Golden Test Creator",
    "niche": "Education for students and young professionals",
    "audience": "Indian college students and early-career professionals",
    "language": "English",
    "tone": "Casual, educational",
    "style_description": "Short sentences, concrete examples, no fluff",
    "things_to_avoid": "Corporate phrasing, too many emojis, clickbait",
    "sample_posts": [],
    "target_platforms": ["instagram", "linkedin"],
    "platform_preferences": [],
}


def load_input(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    meta = {}
    while lines and ":" in lines[0] and lines[0].split(":")[0].isupper():
        key, value = lines.pop(0).split(":", 1)
        meta[key.strip().lower()] = value.strip()
    return {
        "id": path.stem,
        "title": meta.get("title", path.stem),
        "source_type": meta.get("source_type", "transcript"),
        "source_text": "\n".join(lines).strip(),
    }


def main(filter_text: str = "") -> None:
    llm = LLMService()
    inputs = sorted((BACKEND / "golden" / "inputs").glob("*.txt"))
    inputs = [p for p in inputs if filter_text in p.name]
    out_dir = BACKEND / "golden" / "outputs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Provider: {llm.provider} ({llm.model}) | {len(inputs)} input(s) -> {out_dir}")

    for path in inputs:
        project = load_input(path)
        record: dict = {"input": project["title"], "provider": llm.provider, "model": llm.model}
        try:
            analysis = content_analyzer.analyze(llm, project, PROFILE).data.model_dump()
            record["analysis"] = analysis
            ideas = idea_generator.generate_ideas(llm, project, PROFILE, analysis).data.ideas
            record["ideas"] = [idea.model_dump() for idea in ideas]
            project["content_ideas"] = {"ideas": record["ideas"]}
            record["assets"] = {}
            for index, content_type in enumerate(("reel", "linkedin", "carousel")):
                ctx = GenerationContext(project=project, profile=PROFILE, analysis=analysis,
                                        idea=record["ideas"][index % len(ideas)], idea_index=index)
                record["assets"][content_type] = GENERATORS[content_type](llm, ctx).data.model_dump()
            print(f"  ✓ {path.name}")
        except Exception as error:  # noqa: BLE001 - report and continue with the next input
            record["error"] = f"{type(error).__name__}: {error}"
            print(f"  ✗ {path.name}: {record['error']}")
        (out_dir / f"{path.stem}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nReview checklist: Reel sounds spoken (read it aloud)? LinkedIn differs from the Reel?"
          " Claims grounded in the source? Hinglish input handled? Messy transcript understood?")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
