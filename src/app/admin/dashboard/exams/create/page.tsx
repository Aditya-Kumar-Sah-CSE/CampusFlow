import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getExamDbClient } from '@/lib/exams/exam-permission';
import { CreateExamWizard } from '@/components/admin/exams/CreateExamWizard';

export const dynamic = 'force-dynamic';

export default async function AdminCreateExamPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const collegeId = session.activeCollegeId;
  if (!collegeId) {
    redirect('/admin/dashboard');
  }

  const db = await getExamDbClient();

  const [
    { data: sessions },
    { data: progs },
    { data: sems },
    { data: branches },
    { data: subjects },
  ] = await Promise.all([
    db
      .from('academic_years')
      .select('id, name, is_active')
      .eq('college_id', collegeId)
      .order('name', { ascending: false }),
    db
      .from('academic_programmes')
      .select('id, name, code, programme_type, duration_years, level_type, has_branches, is_active')
      .eq('college_id', collegeId)
      .order('name', { ascending: true }),
    db
      .from('semesters')
      .select(`
        id, name, semester_number, year_number, level_type, level_number, class_number, display_name, programme_id, is_active,
        programme:academic_programmes(id, name, code, programme_type, level_type, has_branches)
      `)
      .eq('college_id', collegeId)
      .order('level_number', { ascending: true }),
    db
      .from('branches')
      .select('id, name, code, is_active')
      .eq('college_id', collegeId)
      .order('name', { ascending: true }),
    db
      .from('subjects')
      .select('id, name, code, branch_id, semester_id, is_active')
      .eq('college_id', collegeId)
      .order('name', { ascending: true }),
  ]);

  let validSems: any[] = sems || [];
  if (validSems.length === 0) {
    const fallbackSems = await db
      .from('semesters')
      .select('id, name, semester_number, year_number, is_active')
      .eq('college_id', collegeId)
      .order('semester_number', { ascending: true });
    validSems = fallbackSems.data || [];
  }

  let validProgs: any[] = progs || [];
  if (validProgs.length === 0) {
    validProgs = [
      {
        id: 'prog-btech-fallback',
        name: 'B.Tech',
        code: 'BTECH',
        programme_type: 'UNDERGRADUATE',
        duration_years: 4,
        level_type: 'SEMESTER',
        has_branches: true,
        is_active: true,
      },
    ];
  }

  return (
    <div className="py-2">
      <CreateExamWizard
        collegeId={collegeId}
        academicSessions={(sessions || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          is_active: Boolean(s.is_active),
        }))}
        programmes={(validProgs || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          programme_type: p.programme_type,
          level_type: p.level_type,
          has_branches: Boolean(p.has_branches),
          is_active: Boolean(p.is_active),
        }))}
        semesters={(validSems || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          display_name: s.display_name || s.name,
          semester_number: s.semester_number,
          year_number: s.year_number,
          class_number: s.class_number,
          level_number: s.level_number || s.semester_number || s.class_number,
          level_type: s.level_type || (s.class_number ? 'CLASS' : 'SEMESTER'),
          programme_id: s.programme_id,
          programme: s.programme || null,
          is_active: Boolean(s.is_active),
        }))}
        branches={(branches || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          code: b.code || '',
          is_active: Boolean(b.is_active),
        }))}
        subjects={(subjects || []).map((sb: any) => ({
          id: sb.id,
          name: sb.name,
          code: sb.code || '',
          branch_id: sb.branch_id,
          semester_id: sb.semester_id,
          is_active: Boolean(sb.is_active),
        }))}
      />
    </div>
  );
}
