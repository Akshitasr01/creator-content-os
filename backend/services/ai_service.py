import os

from dotenv import load_dotenv
from openai import OpenAI

from schemas.analysis import (
    AnalyzeRequest,
    ContentAnalysis,
)


load_dotenv()


client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
)


def analyze_content(
    request: AnalyzeRequest
) -> ContentAnalysis:

    creator_context = f"""
Creator niche:
{request.niche or "Not provided"}

Creator's target audience:
{request.audience or "Not provided"}
"""

    source = f"""
PROJECT TITLE:
{request.title}

SOURCE TYPE:
{request.source_type}

SOURCE CONTENT:
{request.source_text}
"""

    response = client.responses.parse(
        model=MODEL,

        input=[
            {
                "role": "system",
                "content": """
You are the content intelligence engine
for a creator content repurposing platform.

Your task is to deeply understand the
creator's source content before any social
media content is generated.

Identify:

1. The main topic.
2. The most likely target audience.
3. A concise summary.
4. The most important ideas.
5. Strong potential hooks.
6. Useful content angles for repurposing.

Do not invent facts that are not supported
by the source.

Hooks should be concise and attention
grabbing while remaining faithful to the
source.
""",
            },

            {
                "role": "user",
                "content":
                    creator_context
                    + "\n"
                    + source,
            },
        ],

        text_format=ContentAnalysis,
    )

    analysis = response.output_parsed

    if analysis is None:
        raise ValueError(
            "AI did not return a valid analysis."
        )

    return analysis