/**
 * Shared isomorphic academic level resolution helper.
 * Safe for both Client and Server components (zero Node.js fs/pdfkit dependencies).
 *
 * Evaluation order:
 * 1. Explicit level value passed from DB (e.g. programme name, programme code).
 * 2. Text inspection of combined contextual strings (form title, branch, semester name).
 * 3. Default fallback: 'B.Tech' (standard undergraduate engineering degree).
 */

export function resolveAcademicLevel(
  level?: string | null,
  fallbackContext?: string | null
): string {
  if (level && level.trim()) {
    const clean = level.trim();
    const upper = clean.toUpperCase();
    if (upper === 'BTECH' || upper === 'B.TECH') return 'B.Tech';
    if (upper === 'MTECH' || upper === 'M.TECH') return 'M.Tech';
    if (upper === 'BE' || upper === 'B.E.') return 'B.E.';
    if (upper === 'DIPLOMA') return 'Diploma';
    if (upper === 'BCA') return 'BCA';
    if (upper === 'MCA') return 'MCA';
    if (upper === 'MBA') return 'MBA';
    if (upper === 'PHD' || upper === 'PH.D.') return 'Ph.D.';
    if (upper === 'UNDERGRADUATE') return 'B.Tech';
    if (upper === 'POSTGRADUATE') return 'M.Tech';
    return clean;
  }

  if (fallbackContext) {
    const lower = fallbackContext.toLowerCase();
    if (
      lower.includes('m.tech') ||
      lower.includes('mtech') ||
      lower.includes('postgraduate') ||
      lower.includes('m. tech') ||
      lower.includes('master of technology')
    ) {
      return 'M.Tech';
    }
    if (lower.includes('diploma') || lower.includes('polytechnic')) {
      return 'Diploma';
    }
    if (lower.includes('b.e.') || lower.includes('bachelor of engineering')) {
      return 'B.E.';
    }
    if (lower.includes('mca')) {
      return 'MCA';
    }
    if (lower.includes('bca')) {
      return 'BCA';
    }
    if (lower.includes('mba')) {
      return 'MBA';
    }
    if (lower.includes('phd') || lower.includes('ph.d')) {
      return 'Ph.D.';
    }
    if (
      lower.includes('b.tech') ||
      lower.includes('btech') ||
      lower.includes('undergraduate') ||
      lower.includes('b. tech') ||
      lower.includes('bachelor of technology')
    ) {
      return 'B.Tech';
    }
  }

  return 'B.Tech';
}
