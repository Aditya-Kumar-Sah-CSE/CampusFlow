import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { redirect } from 'next/navigation';
import { getGoogleConfigStatus } from '@/lib/google/auth';
import {
  FileSpreadsheet,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Archive,
  Ban,
  Eye,
  AlertTriangle,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { FeedbackForm, FeedbackFormStatus, AcademicYear, Branch, Semester } from '@/types/database';
import { FormsFilterClient } from '@/components/admin/forms/FormsFilterClient';
import { DeleteFormButton } from '@/components/admin/forms/DeleteFormButton';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

export const dynamic = 'force-dynamic';

export default async function FeedbackFormsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    branch?: string;
    semester?: string;
    status?: string;
    search?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  const resolvedParams = await searchParams;
  const supabase = await createClient();
  const adminDb = createAdminClient() || supabase;
  const googleStatus = await getGoogleConfigStatus(session.activeCollegeId || undefined);

  // Pagination calculations
  const currentPage = resolvedParams.page ? Math.max(1, parseInt(resolvedParams.page, 10)) : 1;
  const pageSize = resolvedParams.pageSize ? Math.max(5, Math.min(100, parseInt(resolvedParams.pageSize, 10))) : 20;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const targetCollegeId = session.activeCollegeId || (!session.isPlatformSuperAdmin ? '00000000-0000-0000-0000-000000000000' : undefined);

  let yearsQuery = supabase.from('academic_years').select('id, name, is_active').order('name', { ascending: false });
  let branchesQuery = supabase.from('branches').select('id, name, code, is_active').eq('is_active', true).order('name', { ascending: true });
  let programmesQuery = supabase.from('academic_programmes').select('id, name, code, programme_type, is_active').order('name');
  let semestersQuery = supabase.from('semesters').select(`
    id, name, semester_number, year_number, level_type, level_number, display_name, programme_id, is_active,
    programme:academic_programmes(id, name, code, programme_type, is_active)
  `).order('semester_number', { ascending: true });

  if (targetCollegeId) {
    yearsQuery = yearsQuery.eq('college_id', targetCollegeId);
    branchesQuery = branchesQuery.eq('college_id', targetCollegeId);
    programmesQuery = programmesQuery.eq('college_id', targetCollegeId);
    semestersQuery = semestersQuery.eq('college_id', targetCollegeId);
  }

  let pubCountQuery = adminDb.from('feedback_forms').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED');
  let draftCountQuery = adminDb.from('feedback_forms').select('id', { count: 'exact', head: true }).eq('status', 'DRAFT');
  let closedCountQuery = adminDb.from('feedback_forms').select('id', { count: 'exact', head: true }).eq('status', 'CLOSED');

  if (targetCollegeId) {
    pubCountQuery = pubCountQuery.eq('college_id', targetCollegeId);
    draftCountQuery = draftCountQuery.eq('college_id', targetCollegeId);
    closedCountQuery = closedCountQuery.eq('college_id', targetCollegeId);
  }

  // Fetch academic masters and lifecycle status counts strictly scoped to institution
  const [
    { data: years },
    { data: branches },
    { data: rawProgrammes },
    { data: rawSemesters, error: semErr },
    { count: publishedCount },
    { count: draftCount },
    { count: closedCount },
  ] = await Promise.all([
    yearsQuery,
    branchesQuery,
    programmesQuery,
    semestersQuery,
    pubCountQuery,
    draftCountQuery,
    closedCountQuery,
  ]);

  let semesters: any[] = (rawSemesters as any[]) || [];
  if (semErr || semesters.length === 0) {
    let fallbackQuery = supabase
      .from('semesters')
      .select('id, name, semester_number, year_number, programme_id, display_name, is_active')
      .order('semester_number');
    if (targetCollegeId) {
      fallbackQuery = fallbackQuery.eq('college_id', targetCollegeId);
    }
    const { data: fallbackSems } = await fallbackQuery;
    if (fallbackSems && fallbackSems.length > 0) {
      semesters = fallbackSems;
    }
  }

  // Attach joined programme records if missing due to fallback query
  const progMap = new Map<string, any>((rawProgrammes || []).map((p: any) => [p.id, p]));
  semesters = semesters.map(s => ({
    ...s,
    programme: s.programme || (s.programme_id ? progMap.get(s.programme_id) : null),
  }));

  // Query forms with lean relational projections
  let query = adminDb
    .from('feedback_forms')
    .select(`
      id,
      title,
      description,
      academic_year_id,
      branch_id,
      semester_id,
      faculty_id,
      subject_id,
      form_type,
      status,
      slug,
      google_form_url,
      google_sheet_url,
      google_form_id,
      google_sheet_id,
      response_destination_type,
      response_count,
      created_at,
      published_at,
      closed_at,
      faculty:faculties(id, name, department),
      subject:subjects(id, name, code),
      academic_year:academic_years(id, name),
      branch:branches(id, name, code),
      semester:semesters(id, name),
      items:feedback_form_items(
        id,
        grid_title,
        order_index,
        faculty_id,
        subject_id,
        faculty:faculties(id, name, department),
        subject:subjects(id, name, code)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (targetCollegeId) {
    query = query.eq('college_id', targetCollegeId);
  }

  if (resolvedParams.year && resolvedParams.year !== 'ALL') {
    query = query.eq('academic_year_id', resolvedParams.year);
  }
  if (resolvedParams.branch && resolvedParams.branch !== 'ALL') {
    query = query.eq('branch_id', resolvedParams.branch);
  }
  if (resolvedParams.semester && resolvedParams.semester !== 'ALL') {
    query = query.eq('semester_id', resolvedParams.semester);
  }
  if (resolvedParams.status && resolvedParams.status !== 'ALL') {
    query = query.eq('status', resolvedParams.status);
  }
  if (resolvedParams.search && resolvedParams.search.trim()) {
    const q = resolvedParams.search.trim();
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  query = query.range(from, to);

  const { data: formsData, count, error: queryErr } = await query;
  let forms = (formsData || []) as unknown as FeedbackForm[];
  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Fallback: If relational nested query returned error or empty due to schema cache join mismatch, fetch base and join in memory
  if (queryErr) {
    console.warn('Nested relational join failed in forms catalog:', queryErr.message, 'Falling back to base query...');
    let facQuery = adminDb.from('faculties').select('id, name, department');
    let subQuery = adminDb.from('subjects').select('id, name, code');
    if (targetCollegeId) {
      facQuery = facQuery.eq('college_id', targetCollegeId);
      subQuery = subQuery.eq('college_id', targetCollegeId);
    }
    const [{ data: faculties }, { data: subjects }] = await Promise.all([
      facQuery,
      subQuery,
    ]);

    let baseQuery = adminDb
      .from('feedback_forms')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (targetCollegeId) {
      baseQuery = baseQuery.eq('college_id', targetCollegeId);
    }

    if (resolvedParams.year && resolvedParams.year !== 'ALL') {
      baseQuery = baseQuery.eq('academic_year_id', resolvedParams.year);
    }
    if (resolvedParams.branch && resolvedParams.branch !== 'ALL') {
      baseQuery = baseQuery.eq('branch_id', resolvedParams.branch);
    }
    if (resolvedParams.semester && resolvedParams.semester !== 'ALL') {
      baseQuery = baseQuery.eq('semester_id', resolvedParams.semester);
    }
    if (resolvedParams.status && resolvedParams.status !== 'ALL') {
      baseQuery = baseQuery.eq('status', resolvedParams.status);
    }
    if (resolvedParams.search && resolvedParams.search.trim()) {
      const q = resolvedParams.search.trim();
      baseQuery = baseQuery.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
    }

    baseQuery = baseQuery.range(from, to);

    const { data: baseForms } = await baseQuery;
    if (baseForms && baseForms.length > 0) {
      forms = baseForms.map((f: any) => ({
        ...f,
        faculty: faculties?.find((fac: any) => fac.id === f.faculty_id),
        subject: subjects?.find((sub: any) => sub.id === f.subject_id),
        academic_year: years?.find((y: any) => y.id === f.academic_year_id),
        branch: branches?.find((b: any) => b.id === f.branch_id),
        semester: semesters?.find((s: any) => s.id === f.semester_id),
      })) as FeedbackForm[];
    } else {
      forms = [];
    }
  }

  // Helper to construct pagination query URLs
  const createPageUrl = (targetPage: number, targetPageSize?: number) => {
    const params = new URLSearchParams();
    if (resolvedParams.year && resolvedParams.year !== 'ALL') params.set('year', resolvedParams.year);
    if (resolvedParams.branch && resolvedParams.branch !== 'ALL') params.set('branch', resolvedParams.branch);
    if (resolvedParams.semester && resolvedParams.semester !== 'ALL') params.set('semester', resolvedParams.semester);
    if (resolvedParams.status && resolvedParams.status !== 'ALL') params.set('status', resolvedParams.status);
    if (resolvedParams.search && resolvedParams.search.trim()) params.set('search', resolvedParams.search.trim());
    params.set('page', String(targetPage));
    if (targetPageSize || pageSize !== 20) params.set('pageSize', String(targetPageSize || pageSize));
    return `/admin/dashboard/forms?${params.toString()}`;
  };

  const statusBadge = (status: FeedbackFormStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
            <CheckCircle2 className="w-3.5 h-3.5" /> PUBLISHED
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
            <Clock className="w-3.5 h-3.5" /> DRAFT
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] text-[11px] font-bold bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700/60">
            <Ban className="w-3.5 h-3.5" /> CLOSED
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Archive className="w-3.5 h-3.5" /> ARCHIVED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header on Authentic Exam Pad Card */}
      <ExamPadCard
        variant="dashboard"
        title="Google Feedback Forms Management"
        subtitle={`Create standard 8-parameter ${session.activeCollege?.name ? `${session.activeCollege.name} ` : ''}Google Feedback Forms, manage connected response Google Sheets, and oversee form lifecycles.`}
        icon={<FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-bce-cobalt dark:text-amber-400" />}
        badge="FORMS CATALOG"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/dashboard?tab=forms"
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-[3px] border border-slate-300 dark:border-[#4d3817] text-slate-700 dark:text-[#faebd0] bg-slate-100 dark:bg-[#1a1309] text-xs font-semibold hover:bg-slate-200 dark:hover:bg-[#25180c] transition-colors cursor-pointer select-none"
            >
              ← Admin Console
            </Link>
            <Link
              href="/admin/dashboard/forms/create"
              className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-bce-cobalt to-bce-navy hover:from-bce-navy hover:to-slate-900 text-white text-xs font-bold rounded-[3px] transition-all shadow-md cursor-pointer select-none"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
              <span>Generate Google Form</span>
            </Link>
          </div>
        }
      />

      {/* Google Setup Status Banner */}
      {!googleStatus.isConfigured ? (
        <div className="p-3.5 sm:p-4 bg-amber-50 dark:bg-[#25180c] border border-amber-300 dark:border-amber-800 rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-300">Google API Setup Notice</p>
              <p className="text-amber-800 dark:text-amber-400/90">
                Google API credentials are not yet configured on the server. Connect your Google account to enable live Google Forms and Sheets provisioning.
              </p>
            </div>
          </div>
          <Link
            href={`/api/auth/google?collegeId=${encodeURIComponent(session.activeCollegeId || '')}&returnTo=/admin/dashboard/forms`}
            className="w-full sm:w-auto justify-center px-3.5 py-1.5 sm:px-4 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2 shrink-0 text-center"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Connect Google Account</span>
          </Link>
        </div>
      ) : (
        <div className="p-2.5 sm:p-3.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs text-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="break-words">
              <strong>Google API Connected:</strong> {googleStatus.message}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-[3px] text-[10.5px] sm:text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              {googleStatus.hasAppsScript ? 'Apps Script Web App Configured' : 'Application-Managed Sync Active'}
            </span>
            <Link
              href={`/api/auth/google?collegeId=${encodeURIComponent(session.activeCollegeId || '')}&returnTo=/admin/dashboard/forms`}
              className="px-2.5 sm:px-3 py-1 bg-white dark:bg-[#1a1309] border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 rounded-[3px] text-[10.5px] sm:text-[11px] font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span>Reconnect Google Account</span>
            </Link>
          </div>
        </div>
      )}

      {/* Interactive Filters Bar */}
      <FormsFilterClient
        academicYears={(years as unknown as AcademicYear[]) || []}
        branches={(branches as unknown as Branch[]) || []}
        semesters={(semesters as unknown as Semester[]) || []}
        selectedYear={resolvedParams.year || 'ALL'}
        selectedBranch={resolvedParams.branch || 'ALL'}
        selectedSemester={resolvedParams.semester || 'ALL'}
        selectedStatus={resolvedParams.status || 'ALL'}
        initialSearch={resolvedParams.search || ''}
      />

      {/* Forms Table */}
      <PinnedRosterBoard
        title="Feedback Forms Catalog"
        subtitle="Live lifecycle management & Google Workspace sync"
        badge={`${totalCount} FORMS`}
        icon={<FileSpreadsheet className="w-4 h-4 text-amber-500" />}
        action={
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-[#c4a97d]">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{publishedCount ?? forms.filter(f => f.status === 'PUBLISHED').length} Published</span>
            <span>•</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{draftCount ?? forms.filter(f => f.status === 'DRAFT').length} Drafts</span>
            <span>•</span>
            <span className="font-semibold text-rose-700 dark:text-rose-400">{closedCount ?? forms.filter(f => f.status === 'CLOSED').length} Closed</span>
          </div>
        }
      >
        {forms.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-[3px] bg-slate-100 dark:bg-[#1f150c] border border-slate-200 dark:border-[#382710] text-slate-400 dark:text-[#8c7453] mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-[#faebd0]">No Feedback Forms Found</p>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d] max-w-sm mx-auto">
              {resolvedParams.search || resolvedParams.status || resolvedParams.year
                ? 'Try adjusting your filters or search query.'
                : 'Get started by clicking "Generate Google Form" to create your first feedback form.'}
            </p>
            <Link
              href="/admin/dashboard/forms/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-bce-cobalt text-white text-xs font-bold rounded-[3px] hover:bg-bce-navy transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Generate First Form
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Form Cards (Visible only on screens below md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#2d1f11]">
              {forms.map(form => {
                const isNative = form.response_destination_type === 'NATIVE_SHEET';
                return (
                  <div key={form.id} className="p-3.5 sm:p-4 space-y-2.5 bg-white dark:bg-[#1a1208]">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/dashboard/forms/${form.id}`}
                        className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#faebd0] hover:text-bce-cobalt dark:hover:text-amber-400 transition-colors flex-1"
                      >
                        {form.title}
                      </Link>
                      <div className="shrink-0">{statusBadge(form.status)}</div>
                    </div>

                    {/* Academic Meta Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {form.branch && (
                        <span className="font-semibold px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#25180c] text-slate-800 dark:text-[#faebd0] border border-slate-200 dark:border-[#4d3817]">
                          {form.branch.name} ({form.branch.code})
                        </span>
                      )}
                      {form.semester && (
                        <span className="px-2 py-0.5 rounded-[2px] bg-amber-50 dark:bg-[#291b0e] text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 font-medium">
                          {form.semester.name}
                        </span>
                      )}
                      {form.academic_year && (
                        <span className="px-2 py-0.5 rounded-[2px] bg-amber-100/60 dark:bg-[#201509] text-amber-800 dark:text-amber-400 border border-amber-300/60 font-mono text-[10px]">
                          {form.academic_year.name}
                        </span>
                      )}
                    </div>

                    {/* Multi-Faculty / Faculty Info */}
                    {form.form_type === 'SEMESTER_FEEDBACK' || (form.items && form.items.length > 0) ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60">
                          Multi-Faculty ({form.items?.length || 0})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(
                            new Set(
                              form.items
                                ?.map((it: any) => it.faculty?.name || it.grid_title?.split(/—|-/)[1]?.trim())
                                .filter(Boolean)
                            )
                          ).slice(0, 4).map((name: any, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium bg-slate-100 dark:bg-[#25180c] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#4d3817]"
                            >
                              {name}
                            </span>
                          ))}
                          {(form.items?.length || 0) > 4 && (
                            <span className="text-[10px] text-slate-400 dark:text-[#8c7453] font-medium self-center">
                              +{(form.items?.length || 0) - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-700 dark:text-[#ebd5b3]">
                        {form.faculty?.name ? (
                          <span className="font-semibold">{form.faculty.name}</span>
                        ) : null}
                        {form.subject?.name ? (
                          <span className="text-slate-500 dark:text-[#8c7453] block text-[10px]">{form.subject.name}</span>
                        ) : null}
                      </div>
                    )}

                    {/* Responses & Destination Info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8c7453] pt-1">
                      <div className="flex items-center gap-1.5">
                        {isNative ? (
                          <span className="font-bold text-amber-700 dark:text-amber-400">⚡ Native Destination</span>
                        ) : (
                          <span className="font-medium text-slate-600 dark:text-[#c4a97d]">🔄 App-Managed</span>
                        )}
                        <span>•</span>
                        <span className="font-semibold text-slate-700 dark:text-[#faebd0]">{form.response_count || 0} response(s)</span>
                      </div>
                      <span className="text-[10px] font-mono">
                        {new Date(form.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Mobile Action Buttons Bar */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#2d1f11]">
                      <div className="flex items-center gap-2">
                        {form.google_form_url && (
                          <a
                            href={form.google_form_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800"
                          >
                            <FileCode2 className="w-3 h-3" />
                            <span>Form</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {(form.google_sheet_url || form.google_sheet_id) && (
                          <a
                            href={form.google_sheet_url || `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>Sheet</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/dashboard/forms/${form.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-[3px] text-xs font-bold text-slate-800 dark:text-[#faebd0] bg-slate-100 dark:bg-[#25180c] hover:bg-slate-200 border border-slate-200 dark:border-[#4d3817]"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Manage</span>
                        </Link>
                        <DeleteFormButton formId={form.id} formTitle={form.title} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 dark:bg-[#1f150c] text-slate-700 dark:text-[#c4a97d] font-bold border-b border-slate-200 dark:border-[#382710] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Form Details</th>
                  <th className="px-5 py-3">Faculty & Subject</th>
                  <th className="px-5 py-3">Branch & Sem</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Response Mode</th>
                  <th className="px-5 py-3">Google Links</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d1f11]">
                {forms.map(form => {
                  const faculty = form.faculty;
                  const subject = form.subject;
                  const branch = form.branch;
                  const semester = form.semester;
                  const isNative = form.response_destination_type === 'NATIVE_SHEET';

                  return (
                    <tr
                      key={form.id}
                      className="bg-white dark:bg-[#1a1208] hover:bg-amber-50/50 dark:hover:bg-[#25180c] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/dashboard/forms/${form.id}`}
                          className="font-bold text-slate-900 dark:text-[#faebd0] hover:text-bce-cobalt dark:hover:text-amber-400 transition-colors block"
                        >
                          {form.title}
                        </Link>
                        <span className="text-[10px] text-slate-400 dark:text-[#8c7453] block font-mono mt-0.5">
                          Created: {new Date(form.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {form.form_type === 'SEMESTER_FEEDBACK' || (form.items && form.items.length > 0) ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60">
                              Multi-Faculty ({form.items?.length || 0})
                            </span>
                            {form.items && form.items.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs mt-1">
                                {Array.from(
                                  new Set(
                                    form.items
                                      .map((it: any) => it.faculty?.name || it.grid_title?.split(/—|-/)[1]?.trim())
                                      .filter(Boolean)
                                  )
                                ).map((name: any, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10.5px] font-medium bg-slate-100 dark:bg-[#25180c] text-slate-800 dark:text-[#faebd0] border border-slate-200 dark:border-[#4d3817]"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-500 dark:text-[#c4a97d] text-[11px] mt-0.5">
                                All Semester Assigned Courses
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-[#faebd0]">
                              {faculty?.name || 'Faculty'}
                            </div>
                            <div className="text-slate-500 dark:text-[#c4a97d] text-[11px]">
                              {subject?.name || 'Subject'} {subject?.code ? `(${subject.code})` : ''}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-[#c4a97d]">
                        <div className="font-semibold text-slate-800 dark:text-[#faebd0]">{branch?.name || 'Branch'} ({branch?.code})</div>
                        <div className="text-[11px] text-slate-500 dark:text-[#c4a97d] mt-0.5">
                          {semester?.name || 'Sem'}
                        </div>
                        {form.academic_year?.name && (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-amber-50 dark:bg-[#2e1f10] text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-700/60 shadow-2xs">
                            <span>Session {form.academic_year.name}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        {statusBadge(form.status)}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold ${
                            isNative
                              ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60'
                              : 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60'
                          }`}
                        >
                          {isNative ? '⚡ Native Destination' : '🔄 App Managed Sync'}
                        </span>
                        {typeof form.response_count === 'number' && (
                          <span className="block text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">
                            {form.response_count} response(s)
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {form.google_form_url ? (
                            <a
                              href={form.google_form_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200 hover:underline"
                              title="Open Google Form Responder View"
                            >
                              <FileCode2 className="w-3.5 h-3.5" />
                              <span>Form</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-[#8c7453] text-[11px]">—</span>
                          )}

                          {form.google_sheet_url || form.google_sheet_id ? (
                            <a
                              href={
                                form.google_sheet_url ||
                                `https://docs.google.com/spreadsheets/d/${form.google_sheet_id}/edit`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:underline ml-2"
                              title="Open Google Responses Sheet"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Sheet</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-[#8c7453] text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/dashboard/forms/${form.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-xs font-semibold text-slate-700 dark:text-[#faebd0] hover:text-bce-cobalt dark:hover:text-amber-400 bg-slate-100 dark:bg-[#140e07] hover:bg-slate-200 dark:hover:bg-[#25180c] border border-slate-200 dark:border-[#382710] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Manage</span>
                          </Link>
                          <DeleteFormButton formId={form.id} formTitle={form.title} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-[#140e07] border-t border-slate-200 dark:border-[#382710] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#c4a97d]">
              <div>
                Showing <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{Math.min(from + 1, totalCount)}</strong>–
                <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{Math.min(to + 1, totalCount)}</strong> of{' '}
                <strong className="font-semibold text-slate-900 dark:text-[#faebd0]">{totalCount}</strong> feedback forms
              </div>

              <div className="flex items-center gap-1.5">
                {/* Previous button */}
                <Link
                  href={createPageUrl(Math.max(1, currentPage - 1))}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] border border-slate-200 dark:border-[#382710] bg-white dark:bg-[#1f150c] font-medium text-slate-700 dark:text-[#faebd0] transition-colors ${
                    currentPage <= 1
                      ? 'opacity-40 pointer-events-none cursor-not-allowed'
                      : 'hover:bg-slate-50 dark:hover:bg-[#2a1d10] hover:text-bce-cobalt dark:hover:text-amber-400'
                  }`}
                  aria-disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Previous</span>
                </Link>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && pageNum - prev > 1;
                      const isActive = pageNum === currentPage;

                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && <span className="px-1.5 text-slate-400 dark:text-[#8c7453]">…</span>}
                          <Link
                            href={createPageUrl(pageNum)}
                            className={`min-w-[28px] h-7 px-2 rounded-[3px] text-xs font-bold inline-flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-bce-navy dark:bg-[#2e1d0f] text-amber-400 border border-bce-cobalt dark:border-amber-500 shadow-2xs'
                                : 'text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#1f150c] border border-transparent'
                            }`}
                          >
                            {pageNum}
                          </Link>
                        </React.Fragment>
                      );
                    })}
                </div>

                {/* Next button */}
                <Link
                  href={createPageUrl(Math.min(totalPages, currentPage + 1))}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] border border-slate-200 dark:border-[#382710] bg-white dark:bg-[#1f150c] font-medium text-slate-700 dark:text-[#faebd0] transition-colors ${
                    currentPage >= totalPages
                      ? 'opacity-40 pointer-events-none cursor-not-allowed'
                      : 'hover:bg-slate-50 dark:hover:bg-[#2a1d10] hover:text-bce-cobalt dark:hover:text-amber-400'
                  }`}
                  aria-disabled={currentPage >= totalPages}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </PinnedRosterBoard>
  </div>
);
}
