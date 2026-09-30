import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  isUuid,
  formatOrdinal,
  formatSemesterDisplay,
  formatBranchDisplay,
} from './academic-formatter';

export {
  isUuid,
  formatOrdinal,
  formatSemesterDisplay,
  formatBranchDisplay,
};

// In-memory process cache to prevent repetitive DB queries
const branchCache = new Map<string, { name: string; code: string }>();
const semesterCache = new Map<string, { name: string; semester_number: number }>();

async function getDb() {
  const admin = createAdminClient();
  if (admin) return admin;
  return await createClient();
}

/**
 * Resolves raw branch and semester values (which may be internal PostgreSQL UUIDs)
 * into human-readable display values (e.g. 'CSE', '4th Semester').
 * Never returns a raw UUID to the caller.
 */
export async function resolveAcademicDisplayValues(
  collegeId: string,
  branchRaw?: string | null,
  semesterRaw?: string | null
): Promise<{
  branch: string;
  semester: string;
  semesterNumber?: number;
}> {
  let resolvedBranch = (branchRaw || '').trim();
  let resolvedSemester = (semesterRaw || '').trim();
  let resolvedSemesterNumber: number | undefined;

  const branchIsUuid = isUuid(resolvedBranch);
  const semesterIsUuid = isUuid(resolvedSemester);

  // 1. Resolve Branch if UUID
  if (branchIsUuid) {
    if (branchCache.has(resolvedBranch)) {
      const cached = branchCache.get(resolvedBranch)!;
      resolvedBranch = cached.code || cached.name || 'Branch not available';
    } else {
      try {
        const db = await getDb();
        let query = db.from('branches').select('name, code').eq('id', resolvedBranch);
        if (collegeId) {
          query = query.eq('college_id', collegeId);
        }
        const { data: b } = await query.maybeSingle();
        if (b) {
          branchCache.set(resolvedBranch, { name: b.name, code: b.code });
          resolvedBranch = b.code || b.name || 'Branch not available';
        } else {
          resolvedBranch = 'Branch not available';
        }
      } catch {
        resolvedBranch = 'Branch not available';
      }
    }
  }

  // 2. Resolve Semester if UUID
  if (semesterIsUuid) {
    if (semesterCache.has(resolvedSemester)) {
      const cached = semesterCache.get(resolvedSemester)!;
      resolvedSemesterNumber = cached.semester_number;
      resolvedSemester = cached.semester_number
        ? `${formatOrdinal(cached.semester_number)} Semester`
        : formatSemesterDisplay(cached.name);
    } else {
      try {
        const db = await getDb();
        let query = db.from('semesters').select('name, semester_number').eq('id', resolvedSemester);
        if (collegeId) {
          query = query.eq('college_id', collegeId);
        }
        const { data: s } = await query.maybeSingle();
        if (s) {
          semesterCache.set(resolvedSemester, {
            name: s.name,
            semester_number: s.semester_number,
          });
          resolvedSemesterNumber = s.semester_number;
          resolvedSemester = s.semester_number
            ? `${formatOrdinal(s.semester_number)} Semester`
            : formatSemesterDisplay(s.name);
        } else {
          resolvedSemester = 'Semester not available';
        }
      } catch {
        resolvedSemester = 'Semester not available';
      }
    }
  } else if (resolvedSemester) {
    resolvedSemester = formatSemesterDisplay(resolvedSemester);
    const numMatch = resolvedSemester.match(/^(\d+)/);
    if (numMatch) {
      resolvedSemesterNumber = parseInt(numMatch[1], 10);
    }
  }

  // 3. Absolute safety guard: NEVER let raw UUID leak
  if (isUuid(resolvedBranch)) {
    resolvedBranch = 'Branch not available';
  }
  if (isUuid(resolvedSemester)) {
    resolvedSemester = 'Semester not available';
  }

  return {
    branch: resolvedBranch,
    semester: resolvedSemester,
    semesterNumber: resolvedSemesterNumber,
  };
}

/**
 * Batch resolve academic display values for a list of records.
 * Queries unique unknown UUIDs in parallel.
 */
export async function batchResolveAcademicDisplayValues(
  collegeId: string,
  records: { branch?: string | null; semester?: string | null }[]
): Promise<Map<string, { branch: string; semester: string }>> {
  const result = new Map<string, { branch: string; semester: string }>();

  const branchUuidsToFetch = new Set<string>();
  const semesterUuidsToFetch = new Set<string>();

  for (const r of records) {
    const b = (r.branch || '').trim();
    const s = (r.semester || '').trim();
    if (isUuid(b) && !branchCache.has(b)) branchUuidsToFetch.add(b);
    if (isUuid(s) && !semesterCache.has(s)) semesterUuidsToFetch.add(s);
  }

  try {
    const db = await getDb();
    const promises: Promise<unknown>[] = [];

    if (branchUuidsToFetch.size > 0) {
      promises.push(
        Promise.resolve(
          db
            .from('branches')
            .select('id, name, code')
            .in('id', Array.from(branchUuidsToFetch))
        ).then(({ data }) => {
            for (const b of data || []) {
              branchCache.set(b.id, { name: b.name, code: b.code });
            }
          })
      );
    }

    if (semesterUuidsToFetch.size > 0) {
      promises.push(
        Promise.resolve(
          db
            .from('semesters')
            .select('id, name, semester_number')
            .in('id', Array.from(semesterUuidsToFetch))
        ).then(({ data }) => {
            for (const s of data || []) {
              semesterCache.set(s.id, {
                name: s.name,
                semester_number: s.semester_number,
              });
            }
          })
      );
    }

    await Promise.all(promises);
  } catch {
    // Non-fatal, fallback logic will handle individually
  }

  for (const r of records) {
    const key = `${r.branch || ''}__${r.semester || ''}`;
    if (!result.has(key)) {
      const res = await resolveAcademicDisplayValues(collegeId, r.branch, r.semester);
      result.set(key, { branch: res.branch, semester: res.semester });
    }
  }

  return result;
}
