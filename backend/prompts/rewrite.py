"""Controlled rewrite instructions (PDF step 24).

The browser only sends an instruction *key*; the prompt text lives here so raw
prompt construction is never exposed to the client.
"""

INSTRUCTIONS: dict[str, str] = {
    "shorter": "Make it noticeably shorter (about 30-40% fewer words) while keeping the core message.",
    "more_conversational": "Make it more conversational and casual, like the creator is talking to a friend.",
    "more_professional": "Make it more professional and polished while keeping the creator's personality.",
    "stronger_hook": "Rewrite ONLY the hook / opening to be much stronger and more specific. Keep the rest almost unchanged.",
    "simplify": "Simplify the language so a beginner understands it. Shorter words, no jargon.",
    "more_storytelling": "Restructure it as a short story or personal-style narrative while staying grounded in the source.",
    "hinglish": "Convert it to natural conversational Hinglish written in Roman (English) letters, not Devanagari.",
}

SYSTEM = """You are an editor for a creator content repurposing platform. You
revise ONE existing social media asset according to a specific instruction,
while preserving the creator's voice, the source facts and the platform rules.
Return the complete revised asset in the same structure.
"""


def instruction_block(instruction: str) -> str:
    return f"REWRITE INSTRUCTION\n\n{INSTRUCTIONS[instruction]}\n"
