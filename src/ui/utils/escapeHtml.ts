// Canonical HTML-entity escape used by every UI module that
// interpolates untrusted strings into innerHTML. Covers the five
// metacharacters that matter for HTML attribute and text contexts:
// `&`, `<`, `>`, `"`, `'`. Consolidated from three duplicates
// (MarkerListPanel, replayLoadDialog, postGameSummary) where one
// copy was silently missing the apostrophe escape.

const HTML_ESCAPE_RE = /[&<>"']/g;

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

export function escapeHtml(text: string): string {
  return text.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}
