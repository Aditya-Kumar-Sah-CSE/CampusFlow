/**
 * Event slug validation and normalization utilities.
 * Enforces multi-tenant safe slug rules:
 * - lowercase
 * - URL-safe alphanumeric and hyphens
 * - trimmed whitespace
 * - length between 2 and 80 characters
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks if a string conforms to standard UUID v4 format.
 */
export function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Normalizes a raw string into a clean, URL-safe slug.
 * - Decodes URL encoding if present
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces non-alphanumeric chars with hyphens
 * - Collapses consecutive hyphens and trims leading/trailing hyphens
 */
export function normalizeEventSlug(raw?: string | null): string {
  if (!raw) return '';
  let decoded = String(raw).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed URI sequence fallback
  }

  return decoded
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validates if an event slug satisfies URL routing standards.
 */
export function isValidEventSlug(slug: string): boolean {
  if (!slug) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 80;
}
