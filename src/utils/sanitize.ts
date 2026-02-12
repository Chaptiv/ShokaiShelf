import DOMPurify from 'dompurify';

// Configure DOMPurify for AniList content
// AniList uses a subset of Markdown converted to HTML
const ANILIST_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'a',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'div'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

// Force all links to open in external browser with noopener
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitize HTML from AniList API (descriptions, activity text, etc.)
 * Uses DOMPurify to remove dangerous elements while preserving safe formatting.
 *
 * @param dirty - Raw HTML from AniList API
 * @returns Sanitized HTML safe to render
 */
export function sanitizeAniListHTML(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, ANILIST_CONFIG);
}

/**
 * Sanitize user-generated content (more restrictive)
 * Allows only basic formatting tags.
 *
 * @param dirty - Raw user input
 * @returns Sanitized HTML
 */
export function sanitizeUserContent(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'br', 'a', 'strong', 'em'],
    ALLOWED_ATTR: ['href'],
  });
}

/**
 * Escape text for preview (no HTML allowed)
 * Converts special characters to HTML entities and newlines to <br/> tags.
 *
 * @param text - Plain text to escape
 * @returns Escaped text safe to render with dangerouslySetInnerHTML
 */
export function escapeForPreview(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');
}
