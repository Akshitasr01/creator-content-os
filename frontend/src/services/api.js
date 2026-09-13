const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;


export async function getBackendHealth() {
  const response = await fetch(
    `${API_BASE_URL}/api/health`
  );

  if (!response.ok) {
    throw new Error(
      "Backend request failed"
    );
  }

  return await response.json();
}


export async function analyzeContent({
  title,
  sourceType,
  sourceText,
  niche,
  audience,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/analyze`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        title,
        source_type: sourceType,
        source_text: sourceText,
        niche,
        audience,
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `AI analysis failed: ${errorText}`
    );
  }

  return await response.json();
}

export async function generateContentIdeas({
  title,
  sourceText,
  niche,
  audience,
  language,
  tone,
  analysis,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/generate-ideas`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        title: title,
        source_text: sourceText,
        niche: niche,
        audience: audience,
        language: language,
        tone: tone,
        analysis: analysis,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Content idea generation failed: ${errorText}`
    );
  }

  return await response.json();
}

export async function generateReel({
  title,
  sourceText,
  idea,
  niche,
  audience,
  language,
  tone,
  styleDescription,
  thingsToAvoid,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/generate-reel`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        title: title,

        source_text: sourceText,

        idea: idea,

        niche: niche,

        audience: audience,

        language: language,

        tone: tone,

        style_description:
          styleDescription,

        things_to_avoid:
          thingsToAvoid,
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Reel generation failed: ${errorText}`
    );
  }

  return await response.json();
}