import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  AcademicProgramme,
  AcademicProgrammeType,
  AcademicLevelType,
  Semester as AcademicLevel,
} from '@/types/database';

async function getAdminDb() {
  return createAdminClient() || (await createClient());
}

export interface ProgrammePreset {
  code: string;
  name: string;
  programme_type: AcademicProgrammeType;
  duration_years: number;
  level_type: AcademicLevelType;
  has_branches: boolean;
  badge: string;
  description: string;
  totalLevels: number;
}

export const PROGRAMME_PRESETS: Record<string, ProgrammePreset> = {
  BTECH: {
    code: 'BTECH',
    name: 'B.Tech',
    programme_type: 'UNDERGRADUATE',
    duration_years: 4,
    level_type: 'SEMESTER',
    has_branches: true,
    badge: '4 Years · 8 Semesters',
    description: 'Undergraduate Engineering (8 semesters over 4 years)',
    totalLevels: 8,
  },
  MTECH: {
    code: 'MTECH',
    name: 'M.Tech',
    programme_type: 'POSTGRADUATE',
    duration_years: 2,
    level_type: 'SEMESTER',
    has_branches: true,
    badge: '2 Years · 4 Semesters',
    description: 'Postgraduate Engineering (4 semesters over 2 years)',
    totalLevels: 4,
  },
  BE: {
    code: 'BE',
    name: 'B.E.',
    programme_type: 'UNDERGRADUATE',
    duration_years: 4,
    level_type: 'SEMESTER',
    has_branches: true,
    badge: '4 Years · 8 Semesters',
    description: 'Bachelor of Engineering (8 semesters over 4 years)',
    totalLevels: 8,
  },
  DIPLOMA: {
    code: 'DIPLOMA',
    name: 'Diploma',
    programme_type: 'DIPLOMA',
    duration_years: 3,
    level_type: 'SEMESTER',
    has_branches: true,
    badge: '3 Years · 6 Semesters',
    description: 'Polytechnic / Diploma (6 semesters over 3 years)',
    totalLevels: 6,
  },
  SCHOOL: {
    code: 'SCHOOL',
    name: 'School',
    programme_type: 'SCHOOL',
    duration_years: 12,
    level_type: 'CLASS',
    has_branches: false,
    badge: 'Classes 1–12',
    description: 'K-12 School Curriculum (Class 1 through Class 12, no branches)',
    totalLevels: 12,
  },
};

/**
 * Loads all academic programmes for an authorized college.
 */
export async function getCollegeAcademicProgrammes(
  collegeId: string
): Promise<AcademicProgramme[]> {
  const supabase = await getAdminDb();
  const { data, error } = await supabase
    .from('academic_programmes')
    .select('*')
    .eq('college_id', collegeId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching academic programmes:', error);
    return [];
  }
  return (data || []) as AcademicProgramme[];
}

/**
 * Loads all academic levels for an authorized college with joined programme details.
 */
export async function getCollegeAcademicLevels(
  collegeId: string
): Promise<AcademicLevel[]> {
  const supabase = await getAdminDb();
  const { data, error } = await supabase
    .from('semesters')
    .select(`
      id,
      college_id,
      programme_id,
      name,
      code,
      level_number,
      level_type,
      year_number,
      semester_number,
      class_number,
      display_name,
      is_active,
      created_at,
      updated_at,
      programme:academic_programmes(id, name, code, programme_type, duration_years, level_type, has_branches, is_active)
    `)
    .eq('college_id', collegeId)
    .order('level_number', { ascending: true });

  if (error) {
    console.error('Error fetching academic levels:', error);
    return [];
  }

  // Normalize and return
  return (data || []).map((row: any) => ({
    id: row.id,
    college_id: row.college_id,
    programme_id: row.programme_id,
    name: row.name,
    code: row.code,
    level_number: row.level_number || row.semester_number || row.class_number || 1,
    level_type: row.level_type || (row.programme?.level_type as AcademicLevelType) || 'SEMESTER',
    year_number: row.year_number,
    semester_number: row.semester_number,
    class_number: row.class_number,
    display_name: row.display_name || row.name,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    programme: row.programme || null,
  })) as AcademicLevel[];
}

/**
 * Multi-select Programme setup engine.
 * Generates all missing programmes and their academic levels in ONE operation.
 * Preserves existing records; zero duplication.
 */
export async function bulkSetupProgrammesAndLevels(
  collegeId: string,
  presetCodes: string[],
  customProgramme?: {
    name: string;
    code: string;
    programme_type: AcademicProgrammeType;
    duration_years: number;
    level_type: AcademicLevelType;
    has_branches: boolean;
    totalLevels: number;
  }
): Promise<{
  success: boolean;
  createdProgrammesCount: number;
  createdLevelsCount: number;
  programmes: AcademicProgramme[];
  levels: AcademicLevel[];
  error?: string;
}> {
  const supabase = await getAdminDb();

  // 1. Fetch existing programmes for this college
  const { data: existingProgs, error: progErr } = await supabase
    .from('academic_programmes')
    .select('*')
    .eq('college_id', collegeId);

  if (progErr) {
    return { success: false, createdProgrammesCount: 0, createdLevelsCount: 0, programmes: [], levels: [], error: progErr.message };
  }

  const progMap = new Map<string, AcademicProgramme>((existingProgs || []).map((p: any) => [p.code.toUpperCase(), p]));
  let createdProgsCount = 0;
  let createdLevelsCount = 0;

  // 2. Prepare list of targets to process
  const targets: Array<{
    code: string;
    name: string;
    programme_type: AcademicProgrammeType;
    duration_years: number;
    level_type: AcademicLevelType;
    has_branches: boolean;
    totalLevels: number;
  }> = [];

  for (const code of presetCodes) {
    const preset = PROGRAMME_PRESETS[code.toUpperCase()];
    if (preset) targets.push(preset);
  }

  if (customProgramme && customProgramme.code && customProgramme.name) {
    targets.push(customProgramme);
  }

  // 3. For each target, ensure programme exists and create missing levels
  for (const target of targets) {
    let prog = progMap.get(target.code.toUpperCase());

    // Create programme if it doesn't exist
    if (!prog) {
      const { data: newProg, error: insertProgErr } = await supabase
        .from('academic_programmes')
        .insert({
          college_id: collegeId,
          name: target.name.trim(),
          code: target.code.trim().toUpperCase(),
          programme_type: target.programme_type,
          duration_years: target.duration_years,
          level_type: target.level_type,
          has_branches: target.has_branches,
          is_active: true,
        })
        .select('*')
        .single();

      if (insertProgErr) {
        console.error(`Failed to create programme ${target.code}:`, insertProgErr);
        continue;
      }
      prog = newProg as AcademicProgramme;
      progMap.set(prog.code.toUpperCase(), prog);
      createdProgsCount++;
    }

    // Fetch existing levels for this programme
    const { data: existingLevels, error: fetchLevErr } = await supabase
      .from('semesters')
      .select('id, level_number, semester_number, class_number, name')
      .eq('college_id', collegeId)
      .eq('programme_id', prog.id);

    if (fetchLevErr) {
      console.error(`Failed to fetch levels for programme ${prog.name}:`, fetchLevErr);
      continue;
    }

    const existingLevelNumbers = new Set<number>(
      (existingLevels || []).map((l: any) => l.level_number || l.semester_number || l.class_number || 0)
    );

    const levelsToInsert: any[] = [];

    if (prog.level_type === 'CLASS') {
      // School Classes 1 to totalLevels (default 12)
      for (let c = 1; c <= target.totalLevels; c++) {
        if (!existingLevelNumbers.has(c)) {
          levelsToInsert.push({
            college_id: collegeId,
            programme_id: prog.id,
            name: `Class ${c}`,
            display_name: `Class ${c}`,
            code: `CLS-${c}`,
            level_number: c,
            class_number: c,
            year_number: c,
            semester_number: null,
            level_type: 'CLASS',
            is_active: true,
          });
        }
      }
    } else {
      // Semester-based programme (B.Tech, M.Tech, Diploma, B.E.)
      for (let s = 1; s <= target.totalLevels; s++) {
        if (!existingLevelNumbers.has(s)) {
          levelsToInsert.push({
            college_id: collegeId,
            programme_id: prog.id,
            name: `Semester ${s}`,
            display_name: `Semester ${s}`,
            code: `SEM-${s}`,
            level_number: s,
            semester_number: s,
            class_number: null,
            year_number: Math.ceil(s / 2),
            level_type: 'SEMESTER',
            is_active: true,
          });
        }
      }
    }

    if (levelsToInsert.length > 0) {
      const { error: insertLevErr } = await supabase
        .from('semesters')
        .insert(levelsToInsert);

      if (insertLevErr) {
        console.error(`Failed to insert levels for ${prog.name}:`, insertLevErr);
      } else {
        createdLevelsCount += levelsToInsert.length;
      }
    }
  }

  // 4. Return refreshed lists
  const [refreshedProgs, refreshedLevels] = await Promise.all([
    getCollegeAcademicProgrammes(collegeId),
    getCollegeAcademicLevels(collegeId),
  ]);

  return {
    success: true,
    createdProgrammesCount: createdProgsCount,
    createdLevelsCount: createdLevelsCount,
    programmes: refreshedProgs,
    levels: refreshedLevels,
  };
}
