import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { getCachedOverallAnalytics } from '@/lib/analytics/service';
import { ResultsDashboardClient } from '@/components/admin/results/ResultsDashboardClient';
import { AnalyticsAccessGate } from '@/components/admin/billing/AnalyticsAccessGate';
import { assertAnalyticsAccess } from '@/lib/billing/access-control';
import {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FeedbackForm,
} from '@/types/database';
import type { AggregatedAnalyticsReport } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';

export default async function AdminResultsHubPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  // Authoritative server-side analytics access check BEFORE any query/fetch
  const access = await assertAnalyticsAccess(session);

  if (!access.allowed) {
    return (
      <div className="space-y-6">
        <AnalyticsAccessGate isSuperAdmin={session.isSuperAdmin} returnUrl="/admin/dashboard" />
      </div>
    );
  }

  const supabase = await createClient();

  let formsQuery = supabase
    .from('feedback_forms')
    .select(`
      id, title, status, form_type, response_count, slug, published_at, closed_at, created_at, academic_year_id, branch_id, semester_id, faculty_id, subject_id, college_id,
      faculty:faculties(id, name, department),
      subject:subjects(id, name, code),
      academic_year:academic_years(id, name),
      branch:branches(id, name, code),
      semester:semesters(id, name, semester_number),
      items:feedback_form_items(
        id,
        grid_title,
        order_index,
        faculty_id,
        subject_id,
        faculty:faculties(id, name, department),
        subject:subjects(id, name, code)
      )
    `)
    .order('created_at', { ascending: false });

  let yearQuery = supabase.from('academic_years').select('id, name, is_active').order('name', { ascending: false });
  let branchQuery = supabase.from('branches').select('id, name, code, is_active').eq('is_active', true).order('name', { ascending: true });
  let programmesQuery = supabase.from('academic_programmes').select('id, name, code, programme_type, is_active').order('name');
  let semesterQuery = supabase.from('semesters').select(`
    id, name, year_number, semester_number, programme_id, is_active,
    programme:academic_programmes(id, name, code, programme_type, is_active)
  `).order('semester_number', { ascending: true });
  let facultyQuery = supabase.from('faculties').select('id, name, employee_id, department, designation, is_active').order('name', { ascending: true });
  let subjectQuery = supabase.from('subjects').select('id, name, code, branch_id, semester_id, is_active').order('name', { ascending: true });

  if (session.activeCollegeId) {
    formsQuery = formsQuery.eq('college_id', session.activeCollegeId);
    yearQuery = yearQuery.eq('college_id', session.activeCollegeId);
    branchQuery = branchQuery.eq('college_id', session.activeCollegeId);
    programmesQuery = programmesQuery.eq('college_id', session.activeCollegeId);
    semesterQuery = semesterQuery.eq('college_id', session.activeCollegeId);
    facultyQuery = facultyQuery.eq('college_id', session.activeCollegeId);
    subjectQuery = subjectQuery.eq('college_id', session.activeCollegeId);
  }

  // 1. Fetch Academic Entities for Filters in fast concurrent DB queries (<50ms)
  const [
    { data: academicYears },
    { data: branches },
    { data: rawProgrammes },
    { data: rawSemesters },
    { data: faculties },
    { data: subjects },
    { data: forms },
  ] = await Promise.all([
    yearQuery,
    branchQuery,
    programmesQuery,
    semesterQuery,
    facultyQuery,
    subjectQuery,
    formsQuery,
  ]);

  const progMap = new Map<string, any>((rawProgrammes || []).map((p: any) => [p.id, p]));
  const semesters = (rawSemesters || []).map((s: any) => ({
    ...s,
    programme: s.programme || (s.programme_id ? progMap.get(s.programme_id) : null),
  }));

  // 2. Resolve Initial Aggregated Analytics Report:
  // If warm in memory cache, return immediately with full chart data.
  // Otherwise serve instantaneous DB-backed shell (<50ms) and hydrate live calculations in background.
  const cachedReport = getCachedOverallAnalytics(session.activeCollegeId || undefined);

  const formsList = (forms || []) as unknown as FeedbackForm[];
  const formsWithResponsesCount = formsList.filter(f => (f.response_count || 0) > 0).length;
  const totalResponsesCount = formsList.reduce((sum, f) => sum + (f.response_count || 0), 0);

  const initialReport: AggregatedAnalyticsReport = cachedReport || {
    scopeTitle: 'Institution-Wide (All Active Feedback)',
    collegeId: session.activeCollegeId || undefined,
    filters: {},
    totalForms: formsList.length,
    formsWithResponses: formsWithResponsesCount,
    totalResponses: totalResponsesCount,
    validResponses: totalResponsesCount,
    parameterAverageScore: 0,
    averageOverallScore: 0,
    compositeAverageScore: 0,
    performanceGrade: 'NO DATA' as const,
    parameters: [],
    distribution: {
      excellentCount: 0,
      veryGoodCount: 0,
      goodCount: 0,
      satisfactoryCount: 0,
      unsatisfactoryCount: 0,
      totalValidRatings: 0,
      excellentPct: 0,
      veryGoodPct: 0,
      goodPct: 0,
      satisfactoryPct: 0,
      unsatisfactoryPct: 0,
      positivePct: 0,
    },
    facultyComparisons: [],
    hasData: false,
    generatedAt: new Date().toISOString(),
  };

  if (initialReport) {
    if (!initialReport.collegeId && session.activeCollegeId) {
      initialReport.collegeId = session.activeCollegeId;
    }
    if ((initialReport.formsWithResponses === 0 || initialReport.totalResponses === 0) && totalResponsesCount > 0) {
      initialReport.formsWithResponses = Math.max(initialReport.formsWithResponses || 0, formsWithResponsesCount);
      initialReport.totalResponses = Math.max(initialReport.totalResponses || 0, totalResponsesCount);
      initialReport.validResponses = Math.max(initialReport.validResponses || 0, totalResponsesCount);
    }
  }

  return (
    <ResultsDashboardClient
      initialReport={initialReport}
      academicYears={(academicYears || []) as AcademicYear[]}
      branches={(branches || []) as Branch[]}
      semesters={(semesters || []) as Semester[]}
      faculties={(faculties || []) as Faculty[]}
      subjects={(subjects || []) as Subject[]}
      forms={formsList}
    />
  );
}
