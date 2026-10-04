/**
 * Validation and sanitization helpers for Google Forms URLs
 * Supports standard Google Forms links:
 * - https://docs.google.com/forms/d/e/.../viewform
 * - https://docs.google.com/forms/d/.../viewform
 * - https://forms.gle/...
 */

export function isValidGoogleFormUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    // Google Forms must always be https
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    // 1. Shortened Google Forms: https://forms.gle/<id>
    if (host === 'forms.gle') {
      const code = parsed.pathname.replace(/^\//, '');
      return /^[a-zA-Z0-9_-]+$/.test(code);
    }

    // 2. Full docs.google.com form URLs
    if (host === 'docs.google.com') {
      const path = parsed.pathname.toLowerCase();
      // Must start with /forms/
      if (!path.startsWith('/forms/')) {
        return false;
      }
      // Must match /forms/d/<id> or /forms/d/e/<id>
      return /\/forms\/d\/(?:e\/)?[a-zA-Z0-9_-]+/i.test(parsed.pathname);
    }

    return false;
  } catch {
    return false;
  }
}

export function sanitizeGoogleFormUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  return isValidGoogleFormUrl(trimmed) ? trimmed : null;
}
