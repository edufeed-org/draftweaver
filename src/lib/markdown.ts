// Simple Markdown renderer to HTML for preview only.
// Supports a small subset: headings, bold/italic, code, lists, links.

export function markdownToHtml(md: string): string {
  if (!md) return "";

  let html = md;

  // Escape basic HTML first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code fences
  html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    return `<pre><code>${code.replace(/\n+$/, "").replace(/^\n+/, "")}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Lists
  html = html.replace(/^(?:-\s+.+\n?)+/gm, (block: string) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((line) => line.replace(/^-\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`) 
      .join("");
    return `<ul>${items}</ul>`;
  });

  html = html.replace(/^(?:\d+\.\s+.+\n?)+/gm, (block: string) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((line) => line.replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1<\/a>');

  // Paragraphs: wrap remaining text blocks
  html = html.replace(/(^|\n)([^<\n][^\n]*)/g, (match, prefix: string, line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return match;
    if (/^<\/?(h\d|ul|ol|li|pre|code|blockquote)/.test(trimmed)) return match;
    return `${prefix}<p>${trimmed}</p>`;
  });

  return html;
}
