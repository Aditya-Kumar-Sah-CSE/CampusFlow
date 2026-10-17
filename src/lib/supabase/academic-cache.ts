import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { AcademicYear, Branch, Semester } from '@/types/database';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

export const ACADEMIC_CACHE_TAG = 'academic_masters';

const publicClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Lean select schemas for reference tables
 */
export const LEAN_YEAR_COLUMNS = 'id, name, is_active';
export const LEAN_BRANCH_COLUMNS = 'id, name, code, is_active';
export const LEAN_SEMESTER_COLUMNS =
  'id, name, year_number, semester_number, level_number, programme_id, is_active, programme:academic_programmes(id, name, code, programme_type)';
export const LEAN_FACULTY_COLUMNS = 'id, name, department, designation, employee_id, is_active';
export const LEAN_SUBJECT_COLUMNS = 'id, name, code, branch_id, semester_id, is_active';

/**
 * Fetch active academic master records, strictly scoped by college_id.
 * Cached for 60s, invalidated on mutation.
 * Never allows un-scoped global fallback.
 */
export function getCachedAcademicMasters(collegeId?: string) {
  if (!collegeId) {
    return Promise.resolve({
      academicYears: [] as AcademicYear[],
      branches: [] as Branch[],
      semesters: [] as Semester[],
    });
  }

  const cacheKey = `academic_masters_${collegeId}`;
  const cacheTag = `academic_masters_${collegeId}`;

  return unstable_cache(
    async () => {
      const supabase = publicClient;

      const [
        { data: years },
        { data: branches },
        { data: semesters, error: semesterError },
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select(LEAN_YEAR_COLUMNS)
          .eq('college_id', collegeId)
          .eq('is_active', true)
          .order('name', { ascending: false }),
        supabase
          .from('branches')
          .select(LEAN_BRANCH_COLUMNS)
          .eq('college_id', collegeId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('semesters')
          .select(LEAN_SEMESTER_COLUMNS)
          .eq('college_id', collegeId)
          .eq('is_active', true)
          .order('semester_number', { ascending: true }),
      ]);

      let finalSemesters: any[] | null = semesters;
      if (!finalSemesters || semesterError) {
        // Fallback to basic columns if relation failed
        const { data: fallbackSems } = await supabase
          .from('semesters')
          .select('id, name, year_number, semester_number, is_active')
          .eq('college_id', collegeId)
          .eq('is_active', true)
          .order('semester_number', { ascending: true });
        finalSemesters = fallbackSems;
      }

      const activeSemesters = ((finalSemesters || []) as unknown as Semester[]).slice();
      // Sort semesters: Undergraduate (e.g. B.Tech) first, then Postgraduate (e.g. M.Tech), then by semester/level number
      activeSemesters.sort((a, b) => {
        const progA = a.programme?.name || '';
        const progB = b.programme?.name || '';
        if (progA !== progB) {
          const typeA = a.programme?.programme_type || '';
          const typeB = b.programme?.programme_type || '';
          if (typeA === 'UNDERGRADUATE' && typeB !== 'UNDERGRADUATE') return -1;
          if (typeB === 'UNDERGRADUATE' && typeA !== 'UNDERGRADUATE') return 1;
          if (progA.toLowerCase().includes('b.tech') || progA.toLowerCase().includes('btech')) return -1;
          if (progB.toLowerCase().includes('b.tech') || progB.toLowerCase().includes('btech')) return 1;
          return progA.localeCompare(progB);
        }
        const semA = a.semester_number ?? a.level_number ?? 0;
        const semB = b.semester_number ?? b.level_number ?? 0;
        return semA - semB;
      });

      return {
        academicYears: (years || []) as AcademicYear[],
        branches: (branches || []) as Branch[],
        semesters: activeSemesters,
      };
    },
    [cacheKey],
    {
      revalidate: 300,
      tags: [cacheTag, ACADEMIC_CACHE_TAG],
    }
  )();
}

