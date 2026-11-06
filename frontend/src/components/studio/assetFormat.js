/** Turn structured asset JSON into ready-to-paste text (PDF step 23: no raw JSON). */

function hashtagLine(tags) {
  return (tags || []).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
}

export function assetToText(type, content) {
  if (type === "reel") {
    return [
      `HOOK\n${content.hook}`,
      `SCRIPT\n${content.script}`,
      `CAPTION\n${content.caption}\n\n${content.cta}\n\n${hashtagLine(content.hashtags)}`,
    ].join("\n\n");
  }
  if (type === "linkedin") {
    return [content.hook, content.body, content.cta, hashtagLine(content.hashtags)].filter(Boolean).join("\n\n");
  }
  if (type === "carousel") {
    const slides = (content.slides || []).map((slide) => `Slide ${slide.number}: ${slide.heading}\n${slide.body}`);
    return [content.title, ...slides, `CAPTION\n${content.caption}\n\n${content.cta}\n\n${hashtagLine(content.hashtags)}`].join("\n\n");
  }
  return JSON.stringify(content, null, 2);
}

export function captionText(content) {
  return [content.caption, content.cta, hashtagLine(content.hashtags)].filter(Boolean).join("\n\n");
}

export function assetTitle(type, content) {
  if (type === "carousel") return content.title;
  return content.hook;
}

export { hashtagLine };
