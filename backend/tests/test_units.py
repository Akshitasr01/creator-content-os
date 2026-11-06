"""Unit tests: schemas, prompt builders, asset planning."""

import pytest
from pydantic import ValidationError

from prompts import rewrite
from prompts.voice import creator_voice_block
from schemas.analysis import ContentAnalysis
from schemas.content import GenerateRequest, RewriteInstruction, validate_content
from services.project_service import plan_assets


def test_legacy_analysis_rows_still_validate():
    # Shape saved by the earlier version of the app (no examples/strong_claims).
    legacy = {"main_topic": "DP", "target_audience": "Students", "summary": "S",
              "key_points": ["a"], "hooks": ["h"], "content_angles": ["c"]}
    assert ContentAnalysis.model_validate(legacy).examples == []


def test_validate_content_rejects_malformed_assets():
    with pytest.raises(ValidationError):
        validate_content("reel", {"hook": "only hook"})
    ok = validate_content("carousel", {"title": "T", "slides": [{"number": 1, "heading": "H", "body": "B"}],
                                       "caption": "C", "cta": "Follow"})
    assert ok["hashtags"] == []


def test_voice_block_contains_constraints_and_samples():
    block = creator_voice_block(
        {"language": "Hinglish", "things_to_avoid": "too many emojis", "sample_posts": ["Bhai DP easy hai"]},
        {"preferred_length": "short", "cta_style": "Ask a question"},
    )
    assert "Hinglish" in block and "too many emojis" in block and "Bhai DP easy hai" in block
    assert "Ask a question" in block
    assert "Do not copy" in block


def test_every_rewrite_button_has_a_backend_instruction():
    keys = {i.value for i in RewriteInstruction} - {"regenerate"}
    assert keys == set(rewrite.INSTRUCTIONS)


def test_plan_prefers_matching_platforms_and_distinct_ideas():
    ideas = [{"platforms": ["linkedin"]}, {"platforms": ["reel"]}, {"platforms": ["reel", "carousel"]}]
    plan = plan_assets(ideas, GenerateRequest(outputs=[{"type": "reel", "count": 2},
                                                       {"type": "linkedin", "count": 1}]))
    assert plan == [("reel", 1), ("reel", 2), ("linkedin", 0)]


def test_plan_respects_selected_ideas():
    ideas = [{"platforms": ["reel"]}] * 5
    plan = plan_assets(ideas, GenerateRequest(outputs=[{"type": "reel", "count": 3}], idea_indexes=[4, 2]))
    assert plan == [("reel", 4), ("reel", 2), ("reel", 4)]
