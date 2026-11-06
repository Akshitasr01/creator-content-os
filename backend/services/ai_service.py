import os

from dotenv import load_dotenv
from openai import OpenAI

from schemas.analysis import (
    AnalyzeRequest,
    ContentAnalysis,
    GenerateIdeasRequest,
    ContentIdeasResponse,
    GenerateReelRequest,
    ReelContent,
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

def generate_content_ideas(
    request: GenerateIdeasRequest
) -> ContentIdeasResponse:
    sample_posts_text = (
        "\n\n---\n\n".join(request.sample_posts)
        if request.sample_posts
        else "No sample posts provided."
    )    

    prompt = f"""
You are the content strategy engine for a
creator content repurposing platform.

Your job is NOT to write complete social
media posts yet.

Your job is to identify the strongest
standalone content ideas that can be created
from the source material.

CREATOR PROFILE

Niche:
{request.niche or "Not provided"}

Audience:
{request.audience or "Not provided"}

Creator's preferred final-content language:
{request.language or "Not provided"}

Tone:
{request.tone or "Not provided"}


PROJECT TITLE

{request.title}


EXISTING CONTENT ANALYSIS

Main Topic:
{request.analysis.main_topic}

Target Audience:
{request.analysis.target_audience}

Summary:
{request.analysis.summary}

Key Points:
{request.analysis.key_points}

Potential Hooks:
{request.analysis.hooks}

Content Angles:
{request.analysis.content_angles}


ORIGINAL SOURCE CONTENT

{request.source_text}


Generate exactly 8 strong standalone
content ideas.

Each idea must contain:

1. A clear title.
2. The core message.
3. A strong hook.
4. The best recommended format.
5. Why this idea is likely to work.

Possible formats include:

- Instagram Reel
- YouTube Short
- LinkedIn Post
- Carousel
- X Post


IMPORTANT:

Write the content-strategy response in English.

All idea titles, core messages, hooks,
recommended formats, and explanations
must be written in English.

The creator's preferred language should only
be used later when generating the actual
social-media content.


Do not invent facts.

Avoid creating multiple ideas that say
essentially the same thing.

Prefer useful, specific ideas over generic
motivational content.
"""

    response = client.responses.parse(
        model=MODEL,

        input=[
            {
                "role": "user",
                "content": prompt,
            }
        ],

        text_format=ContentIdeasResponse,
    )

    ideas = response.output_parsed

    if ideas is None:
        raise ValueError(
            "AI did not return valid content ideas."
        )

    return ideas


def generate_reel(
    request: GenerateReelRequest
) -> ReelContent:

    sample_posts_text = (
        "\n\n---\n\n".join(request.sample_posts)
        if request.sample_posts
        else "No sample posts provided."
    )

    prompt = f"""
You are the short-form content writer for a
creator content repurposing platform.

Your job is to turn ONE approved content idea
into a publishable short-form Reel script.

CREATOR PROFILE

Niche:
{request.niche or "Not provided"}

Audience:
{request.audience or "Not provided"}

Preferred language:
{request.language or "English"}

Tone:
{request.tone or "Not provided"}

Creator style preferences:
{request.style_description or "Not provided"}

Things to avoid:
{request.things_to_avoid or "Not provided"}

Sample posts — style references only:
{sample_posts_text}

CREATOR VOICE INSTRUCTIONS

- Use sample posts only to infer writing style, such as formality,
  sentence length, rhythm, hooks, language mixing, and emoji usage.
- Do not copy or closely paraphrase their wording.
- Do not reuse their claims, examples, opinions, or factual content.
- Base the Reel content on the original source material and selected idea.
- Follow the creator's saved style preferences and things to avoid.
- Keep factual claims grounded in the original source content.
- Preserve the selected idea's core message.
- Follow the creator's preferred language and tone.

PROJECT

Title:
{request.title}

SELECTED CONTENT IDEA

Idea Title:
{request.idea.title}

Core Message:
{request.idea.core_message}

Suggested Hook:
{request.idea.hook}

Why It Works:
{request.idea.why_it_works}

ORIGINAL SOURCE MATERIAL

{request.source_text}

Create one strong short-form Reel.

The result must contain:
1. Hook
2. Reel script
3. Caption
4. CTA
5. Relevant hashtags
6. Estimated speaking duration in seconds

REQUIREMENTS

The hook should grab attention immediately.
The script should sound natural when spoken,
not like an article.

Keep the Reel approximately 30-60 seconds.

Do not invent facts that are not supported
by the original source.

Do not unnecessarily repeat the same idea.

Avoid generic AI phrases such as:
"In today's fast-paced world"
"Let's dive in"
"Unlock your potential"

LANGUAGE RULES

Write the FINAL content in the creator's
preferred language.

If the preferred language is English,
write naturally in English.

If the preferred language is Hindi,
write naturally in Hindi.

If the preferred language is Hinglish,
write natural conversational Hinglish using
English/Roman letters, not Devanagari.

The content should follow the creator's tone
and style preferences.
"""

    response = client.responses.parse(
        model=MODEL,
        input=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        text_format=ReelContent,
    )

    reel = response.output_parsed

    if reel is None:
        raise ValueError(
            "AI did not return a valid Reel."
        )

    return reel
