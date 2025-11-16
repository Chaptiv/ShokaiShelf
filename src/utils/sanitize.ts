import DOMPurify from "dompurify";

export function sanitizeHtml(input?: string): string {
  if (!input) return "Keine Beschreibung";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "br", "p", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}