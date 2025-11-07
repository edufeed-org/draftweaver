// Minimal HTML -> Markdown converter tailored for DraftWeaver.
// Not full fidelity, but good enough for WordPress-style content.

export function htmlToMarkdown(html: string, baseUrl?: string): string {
  if (!html) return "";

  const { origin, basePath } = getBase(baseUrl);

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

  // Images: ![alt](src) with absolute URLs
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, src: string, alt: string) => {
    return `![${alt}](${absolutize(src, origin, basePath)})`;
  });
  md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, alt: string, src: string) => {
    return `![${alt}](${absolutize(src, origin, basePath)})`;
  });
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, src: string) => {
    return `![](${absolutize(src, origin, basePath)})`;
  });

  // Links: [text](href) with absolute URLs when needed
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
    return `[${text}](${absolutize(href, origin, basePath)})`;
  });

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

function getBase(baseUrl?: string): { origin?: string; basePath?: string } {
  try {
    if (!baseUrl) return {};
    const url = new URL(baseUrl);
    const origin = url.origin;
    const path = url.pathname || "/";
    const baseDir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
    return { origin, basePath: baseDir };
  } catch {
    return {};
  }
}

function absolutize(url: string, origin?: string, basePath?: string): string {
  if (!url) return url;
  // Already absolute (http, https, data, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;
  if (origin) {
    if (url.startsWith("/")) return origin + url;
    if (basePath) return origin + basePath + url;
    return origin.replace(/\/$/, "") + "/" + url;
  }
  return url;
}
