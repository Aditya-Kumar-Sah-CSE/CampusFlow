import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { APP_URL } from '@/lib/config/app';
import {
  Building2,
  GraduationCap,
  Calendar,
  CheckSquare,
  FileText,
  ShieldCheck,
  Layers,
  Network,
  Database,
  LineChart,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import { RedPushpin } from '@/components/ui/RedPushpin';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About CampusFlow | Digital Infrastructure for Institutions',
  description:
    'CampusFlow helps colleges and educational institutions manage academic structure, feedback, events, assessments and institutional operations from one secure platform.',
  openGraph: {
    title: 'About CampusFlow | Digital Infrastructure for Institutions',
    description:
      'CampusFlow helps colleges and educational institutions manage academic structure, feedback, events, assessments and institutional operations from one secure platform.',
    url: `${APP_URL}/about`,
  },
};

export default function AboutPage() {
  const TENANT_DATA_POINTS = [
    { label: 'Academic Data', desc: 'Curriculum sessions, courses & levels', icon: Layers },
    { label: 'Users & Roles', desc: 'Admins, coordinators & faculties', icon: ShieldCheck },
    { label: 'Branches', desc: 'Departmental divisions & codes', icon: Network },
    { label: 'Subjects', desc: 'Course mappings & theory/labs', icon: GraduationCap },
    { label: 'Faculty', desc: 'Staff directory & teaching assignments', icon: Building2 },
    { label: 'Feedback', desc: 'Standardized evaluation scorecards', icon: FileText },
    { label: 'Events', desc: 'Campus fests, symposiums & passes', icon: Calendar },
    { label: 'Assessments', desc: 'Timed online exams & MCQ builder', icon: CheckSquare },
    { label: 'Reports', desc: 'Departmental audits & verified PDFs', icon: LineChart },
  ];

  const PLATFORM_SCOPE = [
    {
      title: 'Academic Structure',
      items: 'Faculty • Subjects • Branches • Semesters/Classes • Assignments',
      desc: 'Hierarchical academic scaffolding adaptable for Higher Education (B.Tech, M.Tech, Diploma) and K-12 school class models.',
      icon: GraduationCap,
    },
    {
      title: 'Feedback',
      items: 'Forms • Responses • Faculty Reports • Analytics',
      desc: 'End-to-end feedback lifecycle with Google Forms ingestion, connected Google Sheets sync, and faculty performance summaries.',
      icon: FileText,
    },
    {
      title: 'Events',
      items: 'Events • Programs • Registrations • Teams • Passes',
      desc: 'Centralized event publishing, competition sub-programs, team invite codes, and gate entry scanner with cryptographic QR passes.',
      icon: Calendar,
    },
    {
      title: 'Exams',
      items: 'Tests • MCQs • Attempts • Evaluation • Results',
      desc: 'Full-featured examination engine with timed attempts, server-side anti-tamper answer validation, automated grading, and result PDFs.',
      icon: CheckSquare,
    },
    {
      title: 'Reports',
      items: 'Dashboards • PDFs • Institutional Reports',
      desc: 'Centralized institutional metrics, real-time response rates, examination rank sheets, and downloadable administrative reports.',
      icon: LineChart,
    },
  ];

  const CORE_PRINCIPLES = [
    {
      title: 'Secure',
      desc: 'Role-based access controls and strict multi-tenant Row Level Security (RLS) isolation at the database layer.',
      icon: Lock,
    },
    {
      title: 'Structured',
      desc: 'Academic and institutional data remains cleanly normalized, typed, and auditable across all modules.',
      icon: Layers,
    },
    {
      title: 'Connected',
      desc: 'Feedback, events, exams, and reports interoperate within one platform without disconnected data silos.',
      icon: Network,
    },
    {
      title: 'Data-driven',
      desc: 'Dashboards, analytics, and printable exports derive strictly from verified institutional activity and actual submissions.',
      icon: Database,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-[#faebd0]">
      {/* 1. Global Navigation */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
        {/* HERO SECTION IN EXAMPAD */}
        <ExamPadCard variant="dashboard" clipLabel="ABOUT CAMPUSFLOW">
          <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4 py-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] text-[11px] font-bold uppercase tracking-wider bg-amber-100/80 dark:bg-[#2b1f11] text-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60">
              <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Multi-Tenant Architecture</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-[#faebd0]">
              CampusFlow
            </h1>

            <p className="text-lg sm:text-xl font-bold text-amber-900 dark:text-amber-300 max-w-2xl mx-auto">
              Digital infrastructure for modern institutions.
            </p>

            <p className="text-sm sm:text-base text-slate-600 dark:text-[#c4a97d] leading-relaxed max-w-2xl mx-auto">
              CampusFlow helps colleges and educational institutions manage academic structure, feedback, events,
              assessments and institutional operations from one secure platform.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-[3px] shadow-xs transition-colors"
              >
                <span>Platform Services</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#281b0f] text-slate-800 dark:text-[#faebd0] font-bold text-xs sm:text-sm rounded-[3px] border border-slate-300 dark:border-[#4d3817] shadow-2xs transition-colors"
              >
                <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Select Institution</span>
              </Link>
            </div>
          </div>
        </ExamPadCard>

        {/* 1. BUILT FOR INSTITUTIONS (PINNED ROSTER BOARD) */}
        <PinnedRosterBoard
          title="Built for Institutions"
          subtitle="Engineered with dedicated multi-tenant architecture & cryptographic data boundaries"
          badge="Multi-Tenant RLS"
          icon={<ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
        >
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#c4a97d]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Isolated Per-Institution Data Domains</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TENANT_DATA_POINTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[3px] bg-amber-50/50 dark:bg-[#20150b] border border-amber-200/70 dark:border-[#3d2c18] space-y-1 hover:bg-amber-100/60 dark:hover:bg-[#2b1c0e] transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-900 dark:text-[#faebd0]">
                      <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-[#a08255] leading-snug">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </PinnedRosterBoard>

        {/* 2. REAL PLATFORM SCOPE */}
        <section aria-labelledby="scope-heading" className="space-y-4">
          <div className="border-b border-amber-900/20 dark:border-[#382713] pb-2.5">
            <h2 id="scope-heading" className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0] tracking-tight">
              Platform Scope
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d]">
              Real institutional systems implemented and active across the CampusFlow core:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORM_SCOPE.map((scope, idx) => {
              const Icon = scope.icon;
              return (
                <div
                  key={idx}
                  className="relative p-4 sm:p-5 pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] rounded-[3px] border border-amber-900/30 dark:border-[#422e17] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 overflow-visible"
                >
                  <RedPushpin className="-top-3" />
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#faebd0]">{scope.title}</h3>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-[#c4a97d] leading-relaxed">{scope.desc}</p>
                  </div>

                  <div className="pt-2.5 border-t border-dashed border-amber-900/15 dark:border-[#382713]">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#9e835b] tracking-tight block">
                      {scope.items}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. CORE PRINCIPLES */}
        <section aria-labelledby="principles-heading" className="space-y-4">
          <div className="border-b border-amber-900/20 dark:border-[#382713] pb-2.5">
            <h2 id="principles-heading" className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0] tracking-tight">
              Core Principles
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d]">
              Architectural pillars governing platform design and operations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CORE_PRINCIPLES.map((principle, idx) => {
              const Icon = principle.icon;
              return (
                <div
                  key={idx}
                  className="p-4 pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] rounded-[3px] border border-amber-900/30 dark:border-[#422e17] shadow-2xs space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#faebd0]">{principle.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#c4a97d] leading-relaxed">{principle.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. DEVELOPMENT & ACADEMIC MENTORSHIP */}
        <section className="p-4 sm:p-5 exam-pad-board-dashboard text-amber-100 rounded-lg shadow-md space-y-2 border border-amber-900/50">
          <div className="flex items-center gap-1.5 text-amber-300">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider">Engineering &amp; Institutional Mentorship</h2>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Designed &amp; Developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 hover:underline font-bold"
            >
              Mr. Aditya Kumar Sah
            </a>{' '}
            under the academic guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 hover:underline font-bold"
            >
              Dr. Abhinav Kumar
            </a>{' '}
            (Assistant Professor; BCE, Bhagalpur){' '}
            <a
              href="https://drive.google.com/file/d/1UO0h626GIZf9KES1pGr7t1S-vnCu0eSo/view"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 hover:underline font-bold"
              title="Official Order - BCE Bhagalpur"
            >
              (Official Order)
            </a>.
          </p>
        </section>

        {/* 5. CALL TO ACTION IN EXAMPAD */}
        <ExamPadCard variant="dashboard" clipLabel="GET STARTED">
          <div className="text-center space-y-3 py-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#faebd0]">Access Your Institution Portal</h2>
            <p className="text-xs text-slate-600 dark:text-[#c4a97d] max-w-md mx-auto">
              Select an institution or review detailed technical specifications across all modules.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-[3px] shadow-xs transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Select Institution</span>
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#281b0f] text-slate-800 dark:text-[#faebd0] font-bold text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] transition-colors"
              >
                <span>Platform Services</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#281b0f] text-slate-800 dark:text-[#faebd0] font-bold text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            </div>
          </div>
        </ExamPadCard>
      </main>

      {/* 3. Platform Footer */}
      <footer className="border-t border-amber-900/20 dark:border-[#382713] bg-[#fffdfa]/90 dark:bg-[#150e07]/90 text-xs text-slate-600 dark:text-[#c4a97d] py-5 px-4 sm:px-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <Link href="/" className="font-bold text-slate-900 dark:text-[#faebd0] hover:text-amber-600 transition-colors">
              CampusFlow
            </Link>
            <p className="text-[11px] text-slate-500 dark:text-[#9e835b]">Digital infrastructure for modern institutions.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px]">
            <Link href="/" className="hover:text-amber-600 transition-colors">
              Home
            </Link>
            <span className="text-amber-900/30">•</span>
            <Link href="/about" className="font-bold text-slate-900 dark:text-[#faebd0]">
              About
            </Link>
            <span className="text-amber-900/30">•</span>
            <Link href="/services" className="hover:text-amber-600 transition-colors">
              Platform Services
            </Link>
            <span className="text-amber-900/30">•</span>
            <Link href="/privacy-policy" className="hover:text-amber-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-amber-900/30">•</span>
            <Link href="/terms-of-service" className="hover:text-amber-600 transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#9e835b]">
            &copy; {new Date().getFullYear()} CampusFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
