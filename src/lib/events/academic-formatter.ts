const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a string is a standard UUID.
 */
export function isUuid(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Converts a number to its ordinal representation (1st, 2nd, 3rd, 4th, etc.)
 */
export function formatOrdinal(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return `${num}st`;
  if (j === 2 && k !== 12) return `${num}nd`;
  if (j === 3 && k !== 13) return `${num}rd`;
  return `${num}th`;
}

/**
 * Normalizes semester display string (e.g., 4 -> '4th Semester', 'Semester 4' -> '4th Semester').
 * If a raw UUID is passed, safely returns 'Semester not available'.
 */
export function formatSemesterDisplay(semNumberOrName: number | string | null | undefined): string {
  if (semNumberOrName == null) return '';
  const str = String(semNumberOrName).trim();
  if (!str) return '';

  if (isUuid(str)) {
    return 'Semester not available';
  }

  // Pure digits: 4 -> "4th Semester"
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return `${formatOrdinal(num)} Semester`;
  }

  // "Semester 4" -> "4th Semester"
  const semMatch = str.match(/^semester\s*(\d+)$/i);
  if (semMatch) {
    const num = parseInt(semMatch[1], 10);
    return `${formatOrdinal(num)} Semester`;
  }

  // "4th", "4th Sem", "4th Semester" -> "4th Semester"
  const ordMatch = str.match(/^(\d+)(st|nd|rd|th)\s*(sem(ester)?)?$/i);
  if (ordMatch) {
    const num = parseInt(ordMatch[1], 10);
    return `${formatOrdinal(num)} Semester`;
  }

  return str;
}

/**
 * Normalizes branch display string. Never exposes a raw UUID.
 */
export function formatBranchDisplay(branchCodeOrName: string | null | undefined): string {
  if (!branchCodeOrName) return '';
  const str = branchCodeOrName.trim();
  if (isUuid(str)) {
    return 'Branch not available';
  }
  const lower = str.toLowerCase();
  if (lower === 'computer science and engineering' || lower === 'computer science & engineering') {
    return 'CSE (Computer Science)';
  }
  if (lower === 'electronics and communication engineering' || lower === 'electronics & communication engineering') {
    return 'ECE (Electronics & Comm)';
  }
  if (lower === 'electrical engineering' || lower === 'electrical and electronics engineering') {
    return 'EE (Electrical Engg)';
  }
  if (lower === 'mechanical engineering') {
    return 'ME (Mechanical Engg)';
  }
  if (lower === 'civil engineering') {
    return 'CE (Civil Engg)';
  }
  if (lower === 'information technology') {
    return 'IT (Info Technology)';
  }
  return str;
}
