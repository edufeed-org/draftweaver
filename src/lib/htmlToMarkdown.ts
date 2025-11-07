// Minimal HTML -> Markdown converter tailored for DraftWeaver.
// Not full fidelity, but good enough for WordPress-style content.

export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  // Normalize newlines
  let md = html.replace(/\r\n?/g, "\n");

  // Strong / bold
  md = md.replace(/<(b|strong)>([\s\S]*?)<\/(b|strong)>/gi, "**$2**");
  // Emphasis / italics
  md = md.replace(/<(i|em)>([\s\S]*?)<\/(i|em)>/gi, "*$2*");

  // Code blocks
  md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code: string) => {
    const inner = decodeHtml(code)
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");
    return "\n```\n" + inner + "\n```\n";
  });

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // Paragraphs -> blank-line separated
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text: string) => {
    const inner = text.trim();
    if (!inner) return "";
    return "\n" + inner + "\n";
  });

  // Line breaks
  md = md.replace(/<br\s*\/?>(\s*)/gi, "\n");

  // Unordered lists
  md = md.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, (match: string) => {
    return match
      .replace(/<\/?ul[^>]*>/gi, "")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item: string) => {
        const text = item.trim();
        return text ? `\n- ${text}` : "";
      }) + "\n";
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>[\s\S]*?<\/ol>/gi, (match: string) => {
    let index = 0;
    return match
      .replace(/<\/?ol[^>]*>/gi, "")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item: string) => {
        const text = item.trim();
        if (!text) return "";
        index += 1;
        return `\n${index}. ${text}`;
      }) + "\n";
  });

  // Images: ![alt](src)
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, "![$1]($2)");
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![]($1)");

  // Links: [text](href)
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities and tidy up
  md = decodeHtml(md);
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
