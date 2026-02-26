import DOMPurify from 'dompurify';

// Configure DOMPurify for AniList content
// AniList uses a subset of Markdown converted to HTML
const ANILIST_CONFIG: any = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'a',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'div',
    'img', 'video', 'source', 'iframe'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'src', 'alt', 'width',
    'height', 'controls', 'style', 'playing', 'allow', 'allowfullscreen', 'frameborder'
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'form', 'input', 'object', 'embed'],
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
 * Converts AniList specific markdown (like img(), video()) into standard HTML tags.
 */
function parseAniListMarkdown(text: string): string {
  if (!text) return '';

  return text
    // Images: img(url) or img400(url) Note: we handle widths in CSS but inject style just in case
    .replace(/img(?:(\d+))?\((https?:\/\/[^\)]+)\)/gi, (match, width, url) => {
      const widthStyle = width ? `max-width: ${width}px; width: 100%;` : `max-width: 100%;`;
      return `<img src="${url}" alt="User Image" style="${widthStyle} border-radius: 8px; margin: 8px 0;" />`;
    })
    // Videos: video(url)
    .replace(/video\((https?:\/\/[^\)]+)\)/gi, (match, url) => {
      return `<video controls style="max-width: 100%; border-radius: 8px; margin: 8px 0;"><source src="${url}" type="video/mp4"></video>`;
    })
    // YouTube: youtube(id)
    .replace(/youtube\(([a-zA-Z0-9_-]+)\)/gi, (match, id) => {
      return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${id}" style="border-radius: 8px; margin: 8px 0;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    })
    // Basic formatting that AniList API might return as markdown
    .replace(/__(.*?)__/g, '<b>$1</b>')
    .replace(/\+(.*?)\+/g, '<b>$1</b>') // Alternative bold
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/_([^_]+)_/g, '<i>$1</i>');
}

/**
 * Sanitize HTML from AniList API (descriptions, activity text, etc.)
 * Uses DOMPurify to remove dangerous elements while preserving safe formatting.
 *
 * @param dirty - Raw HTML or Markdown from AniList API
 * @returns Sanitized HTML safe to render
 */
export function sanitizeAniListHTML(dirty: string | null | undefined): string {
  if (!dirty) return '';
  const convertedHTML = parseAniListMarkdown(dirty);
  return DOMPurify.sanitize(convertedHTML, ANILIST_CONFIG) as unknown as string;
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
  }) as unknown as string;
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
