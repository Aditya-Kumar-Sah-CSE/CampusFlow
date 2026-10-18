'use client';

import React from 'react';
import {
  Calendar,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  Activity,
  ArrowRight,
  UserPlus,
  GitBranch,
  Pin,
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  AdminRequest,
  FeedbackForm,
  AuditLog,
} from '@/types/database';
import { useHydrated, formatTime } from '@/lib/hooks/use-hydrated';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import { RedPushpin } from '@/components/ui/RedPushpin';

export interface DashboardCounts {
  totalFaculties?: number;
  activeFaculties?: number;
  totalSubjects?: number;
  activeSubjects?: number;
  totalAssignments?: number;
  totalForms?: number;
  publishedForms?: number;
}

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  adminRequests: AdminRequest[];
  feedbackForms: FeedbackForm[];
  auditLogs: AuditLog[];
  isSuperAdmin: boolean;
  onNavigateTab: (tab: string, subtab?: string) => void;
  counts?: DashboardCounts;
}

export function OverviewTab({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
  adminRequests,
  feedbackForms,
  auditLogs,
  isSuperAdmin: _isSuperAdmin,
  onNavigateTab,
  counts,
}: Props) {
  const hydrated = useHydrated();
  const pendingRequestsCount = adminRequests.filter((r) => r.status === 'PENDING').length;
  const activeYearsCount = academicYears.filter((y) => y.is_active).length;
  const activeBranchesCount = branches.filter((b) => b.is_active).length;
  const activeSemestersCount = semesters.filter((s) => s.is_active).length;

  const totalFaculties = counts?.totalFaculties ?? faculties.length;
  const activeFacultiesCount = counts?.activeFaculties ?? faculties.filter((f) => f.is_active).length;

  const totalSubjects = counts?.totalSubjects ?? subjects.length;
  const activeSubjectsCount = counts?.activeSubjects ?? subjects.filter((s) => s.is_active).length;

  const totalAssignments = counts?.totalAssignments ?? assignments.length;

  const totalForms = counts?.totalForms ?? feedbackForms.length;
  const publishedFormsCount = counts?.publishedForms ?? feedbackForms.filter((f) => f.status === 'PUBLISHED').length;

  const stats = [
    {
      title: 'Faculties',
      value: totalFaculties,
      subtitle: `${activeFacultiesCount} active`,
      icon: Users,
      color: 'from-blue-600 to-indigo-600',
      tab: 'academic',
      subtab: 'faculties',
    },
    {
      title: 'Subjects',
      value: totalSubjects,
      subtitle: `${activeSubjectsCount} active`,
      icon: BookOpen,
      color: 'from-violet-600 to-purple-600',
      tab: 'academic',
      subtab: 'subjects',
    },
    {
      title: 'Branches',
      value: branches.length,
      subtitle: `${activeBranchesCount} active • ${activeSemestersCount} sem`,
      icon: Layers,
      color: 'from-emerald-600 to-teal-600',
      tab: 'academic',
      subtab: 'branches',
    },
    {
      title: 'Academic Years',
      value: academicYears.length,
      subtitle: `${activeYearsCount} active session`,
      icon: Calendar,
      color: 'from-amber-500 to-orange-600',
      tab: 'academic',
      subtab: 'years',
    },
    {
      title: 'Assignments',
      value: totalAssignments,
      subtitle: 'Faculty mapping',
      icon: GraduationCap,
      color: 'from-cyan-600 to-blue-600',
      tab: 'academic',
      subtab: 'assignments',
    },
    {
      title: 'Feedback Forms',
      value: totalForms,
      subtitle: `${publishedFormsCount} published`,
      icon: FileSpreadsheet,
      color: 'from-pink-600 to-rose-600',
      tab: 'forms',
      subtab: undefined,
    },
    {
      title: 'Admin Requests',
      value: pendingRequestsCount,
      subtitle: pendingRequestsCount > 0 ? 'Requires attention' : 'All reviewed',
      icon: Clock,
      color: pendingRequestsCount > 0 ? 'from-amber-500 to-red-500' : 'from-slate-600 to-slate-700',
      tab: 'admins',
      subtab: undefined,
      alert: pendingRequestsCount > 0,
    },
    {
      title: 'Audit Logs',
      value: auditLogs.length,
      subtitle: 'Tracked administrative actions',
      icon: Activity,
      color: 'from-slate-700 to-slate-800',
      tab: 'audit',
      subtab: undefined,
    },
  ];

  // Natural rotation and flutter offsets for authentic pinned memo cards
  const rotations = ['-0.8deg', '0.65deg', '-0.5deg', '0.75deg', '-0.6deg', '0.55deg', '-0.7deg', '0.6deg'];
  const delays = ['0s', '0.6s', '0.3s', '0.9s', '0.4s', '0.8s', '0.2s', '0.7s'];
  const durations = ['5.3s', '5.9s', '5.5s', '6.2s', '5.6s', '6.0s', '5.4s', '6.1s'];

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* ══════════════════════════════════════════════════════════════════
          LARGE CAMPUS NOTICE BOARD — PINNED INSTITUTIONAL METRICS & CENSUS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="notice-board-wood-frame p-2 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl relative overflow-visible border-2 sm:border-[3px] border-[#362013] dark:border-[#22130a] shadow-2xl w-full">
        {/* Brass Corner Brackets with Rivets */}
        <div className="absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500/90 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500/90 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500/90 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500/90 pointer-events-none rounded-br-xs" />

        {/* Top Polished Brass Header Plaque */}
        <div className="mx-auto max-w-xl text-center mb-3 sm:mb-4 pt-0.5 px-1">
          <div className="inline-flex items-center gap-1.5 xs:gap-2 px-3 sm:px-6 py-1.5 rounded-xs bg-gradient-to-r from-amber-800 via-amber-600 to-amber-900 text-amber-100 border border-amber-400/60 shadow-lg max-w-full">
            <Pin className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <span className="text-[10px] xs:text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest truncate">
              CAMPUS NOTICE BOARD • INSTITUTIONAL METRICS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5 sm:ml-1 shrink-0" />
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-200/80 font-medium mt-1 truncate">
            Official Live Census & Academic Department Ledgers
          </p>
        </div>

        {/* Dark Green Felt Bulletin Board Surface */}
        <div className="notice-board-felt-surface rounded-lg sm:rounded-xl p-2.5 sm:p-5 md:p-6 min-h-[320px] relative overflow-visible shadow-inner">
          {/* Administrator Urgent Bulletin if Pending Requests */}
          {pendingRequestsCount > 0 && (
            <div className="relative mb-4 sm:mb-5 bg-[#fffdfa] dark:bg-[#25180c] border border-amber-300 dark:border-amber-800/80 rounded-[2px] p-3 sm:p-4 text-xs shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-800 dark:text-[#faebd0]">
              <RedPushpin className="-top-3.5" />
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-[2px] bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/80 dark:border-amber-700/60">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-red-600 text-white shrink-0">
                      URGENT ACTION
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200 truncate">
                      {pendingRequestsCount} Pending Administrator {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                    </p>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-400/90 mt-0.5">
                    New administrator accounts are waiting for access authorization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => onNavigateTab('admins')}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-[2px] shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
              >
                Review Requests →
              </button>
            </div>
          )}

          {/* Grid of Pinned Statistics Paper Sheets with 3D Red Pushpins */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3.5 sm:gap-6 pt-3 pb-2 w-full min-w-0">
            {stats.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => onNavigateTab(item.tab, item.subtab)}
                  title={item.title}
                  className="notice-paper-card text-left p-2.5 xs:p-3 sm:p-4 rounded-[2px] shadow-md hover:shadow-2xl flex flex-col justify-between group w-full min-w-0 relative overflow-visible cursor-pointer select-none transition-all"
                  style={
                    {
                      '--notice-rot': rotations[idx % rotations.length],
                      '--notice-delay': delays[idx % delays.length],
                      '--notice-dur': durations[idx % durations.length],
                    } as React.CSSProperties
                  }
                >
                  {/* Authentic 3D Red Pushpin Pinning the Card */}
                  <RedPushpin className="-top-3.5 sm:-top-4" />

                  {/* Corner Accent Line */}
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-600/40 pointer-events-none" />

                  {/* Top Metric Header */}
                  <div className="flex items-start justify-between gap-1.5 min-w-0 w-full pt-1 sm:pt-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-[#c4a97d] uppercase tracking-wider truncate">
                        {item.title}
                      </p>
                      <p className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-[#faebd0] mt-0.5 sm:mt-1 truncate tracking-tight">
                        {item.value}
                      </p>
                    </div>
                    <div
                      className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-[2px] bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0`}
                    >
                      <Icon className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>

                  {/* Subtitle & Manage Action */}
                  <div className="mt-2 sm:mt-3.5 pt-1.5 sm:pt-2.5 border-t border-slate-200/80 dark:border-[#382713] flex items-center justify-between text-[9.5px] xs:text-[10px] sm:text-[11px] text-slate-600 dark:text-[#c4a97d] min-w-0 w-full">
                    <span className="truncate">{item.subtitle}</span>
                    <span className="text-amber-800 dark:text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline shrink-0">
                      Manage →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          QUICK LAUNCH & RECENT ACTIVITY GRID (EXAMPAD & PINNED ROSTER)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
        {/* Quick Launch Actions on Authentic Exam Pad Card */}
        <ExamPadCard
          variant="dashboard"
          title="Quick Administration"
          subtitle="Frequently performed foundation tasks."
          icon={<Activity className="w-4 h-4" />}
          badge="COMMAND"
          clipLabel="QUICK ACTIONS"
          className="min-w-0 w-full"
        >
          <div className="space-y-2.5 pt-1 text-slate-800 dark:text-[#faebd0]">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => onNavigateTab('academic', 'faculties')}
              className="w-full text-left p-2.5 sm:p-3 rounded-[3px] bg-slate-50 dark:bg-[#1a1309] hover:bg-amber-50/60 dark:hover:bg-[#2e1f10] border border-slate-200/80 dark:border-[#382713] transition-colors flex items-center justify-between gap-2 min-h-[44px] cursor-pointer group"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#faebd0] truncate">Add Faculty Member</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] truncate">Register new professors & lecturers</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            <button
              type="button"
              suppressHydrationWarning
              onClick={() => onNavigateTab('academic', 'assignments')}
              className="w-full text-left p-2.5 sm:p-3 rounded-[3px] bg-slate-50 dark:bg-[#1a1309] hover:bg-amber-50/60 dark:hover:bg-[#2e1f10] border border-slate-200/80 dark:border-[#382713] transition-colors flex items-center justify-between gap-2 min-h-[44px] cursor-pointer group"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#faebd0] truncate">Assign Subject to Faculty</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] truncate">Map faculty to session and branch</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            <button
              type="button"
              suppressHydrationWarning
              onClick={() => onNavigateTab('forms')}
              className="w-full text-left p-2.5 sm:p-3 rounded-[3px] bg-slate-50 dark:bg-[#1a1309] hover:bg-amber-50/60 dark:hover:bg-[#2e1f10] border border-slate-200/80 dark:border-[#382713] transition-colors flex items-center justify-between gap-2 min-h-[44px] cursor-pointer group"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#faebd0] truncate">Prepare Feedback Forms</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#c4a97d] truncate">View or toggle published status</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>
        </ExamPadCard>

        {/* Recent Audit Timeline Preview on Pinned Roster Board */}
        <div className="lg:col-span-2 min-w-0 w-full">
          <PinnedRosterBoard
            title="Recent Administrative Activity"
            subtitle="Real-time log of administrative changes"
            badge="LIVE ROSTER"
            icon={<Activity className="w-4 h-4" />}
            className="w-full"
          >
            <div className="p-3.5 sm:p-4 space-y-3 min-w-0 w-full">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-[#382713]">
                <span className="text-[11px] text-slate-500 dark:text-[#c4a97d]">
                  Showing last {Math.min(auditLogs.length, 5)} tracked operations
                </span>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => onNavigateTab('audit')}
                  className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline shrink-0 cursor-pointer"
                >
                  View Full Audit Log →
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-[#c4a97d]/60 text-xs">
                  No audit activities recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#382713] min-w-0">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="py-2.5 sm:py-3 space-y-1.5 text-xs min-w-0 w-full">
                      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-bold text-slate-900 dark:text-[#faebd0] break-all">{log.action}</span>
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#2e1f10] text-slate-600 dark:text-[#c4a97d] text-[10px] font-mono border border-slate-200/80 dark:border-[#4d3817] shrink-0">
                            {log.entity_type || 'system'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-[#c4a97d]/70 font-mono shrink-0 ml-auto sm:ml-0">
                          {formatTime(log.created_at, hydrated)}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-[#faebd0]/80 break-words [overflow-wrap:anywhere] leading-relaxed text-[11px] sm:text-xs">
                        {log.details}
                      </p>
                      <p className="text-[10.5px] text-slate-400 dark:text-[#c4a97d]/70 font-mono truncate">
                        By: {log.actor_email || 'System'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PinnedRosterBoard>
        </div>
      </div>
    </div>
  );
}
