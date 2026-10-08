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
      color: 'blue',
    },
    {
      title: 'Feedback',
      items: 'Forms • Responses • Faculty Reports • Analytics',
      desc: 'End-to-end feedback lifecycle with Google Forms ingestion, connected Google Sheets sync, and faculty performance summaries.',
      icon: FileText,
      color: 'emerald',
    },
    {
      title: 'Events',
      items: 'Events • Programs • Registrations • Teams • Passes',
      desc: 'Centralized event publishing, competition sub-programs, team invite codes, and gate entry scanner with cryptographic QR passes.',
      icon: Calendar,
      color: 'violet',
    },
    {
      title: 'Exams',
      items: 'Tests • MCQs • Attempts • Evaluation • Results',
      desc: 'Full-featured examination engine with timed attempts, server-side anti-tamper answer validation, automated grading, and result PDFs.',
      icon: CheckSquare,
      color: 'amber',
    },
    {
      title: 'Reports',
      items: 'Dashboards • PDFs • Institutional Reports',
      desc: 'Centralized institutional metrics, real-time response rates, examination rank sheets, and downloadable administrative reports.',
      icon: LineChart,
      color: 'indigo',
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Global Navigation */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14">
        {/* HERO SECTION */}
        <section aria-labelledby="about-hero-title" className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Multi-Tenant Architecture</span>
          </div>

          <h1
            id="about-hero-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900"
          >
            CampusFlow
          </h1>

          <p className="text-lg sm:text-xl font-medium text-slate-700 max-w-2xl mx-auto">
            Digital infrastructure for modern institutions.
          </p>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            CampusFlow helps colleges and educational institutions manage academic structure, feedback, events,
            assessments and institutional operations from one secure platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors"
            >
              <span>Platform Services</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 shadow-2xs transition-colors"
            >
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>Select Institution</span>
            </Link>
          </div>
        </section>

        {/* 1. BUILT FOR INSTITUTIONS (MULTI-TENANT ARCHITECTURE) */}
        <section aria-labelledby="multi-tenant-heading" className="space-y-4">
          <div className="border-b border-slate-200 pb-2.5">
            <h2 id="multi-tenant-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Built for Institutions
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Engineered with dedicated multi-tenant architecture. Every institution operates within its own cryptographic data boundary with zero inter-tenant leakage.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Isolated Per-Institution Data Domains</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TENANT_DATA_POINTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-900">
                      <Icon className="w-4 h-4 text-slate-700 shrink-0" />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. REAL PLATFORM SCOPE */}
        <section aria-labelledby="scope-heading" className="space-y-4">
          <div className="border-b border-slate-200 pb-2.5">
            <h2 id="scope-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Platform Scope
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Real institutional systems implemented and active across the CampusFlow core:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {PLATFORM_SCOPE.map((scope, idx) => {
              const Icon = scope.icon;
              return (
                <div
                  key={idx}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{scope.title}</h3>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{scope.desc}</p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 tracking-tight block">
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
          <div className="border-b border-slate-200 pb-2.5">
            <h2 id="principles-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Core Principles
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">Architectural pillars governing platform design and operations.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CORE_PRINCIPLES.map((principle, idx) => {
              const Icon = principle.icon;
              return (
                <div
                  key={idx}
                  className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">{principle.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{principle.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. DEVELOPMENT & ACADEMIC MENTORSHIP */}
        <section className="p-4 sm:p-5 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider">Engineering &amp; Institutional Mentorship</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Designed &amp; Developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              Mr. Aditya Kumar Sah
            </a>{' '}
            under the academic guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              Dr. Avinav
            </a>{' '}
            (Assistant Professor, Bhagalpur College of Engineering).
          </p>
        </section>

        {/* 5. CALL TO ACTION */}
        <section className="p-6 bg-white border border-slate-200/90 rounded-2xl text-center space-y-3 shadow-2xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Access Your Institution Portal</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Select an institution or review detailed technical specifications across all modules.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Select Institution</span>
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              <span>Platform Services</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </Link>
          </div>
        </section>
      </main>

      {/* 3. Platform Footer */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-5 px-4 sm:px-8 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <Link href="/" className="font-bold text-slate-900 hover:text-blue-600 transition-colors">
              CampusFlow
            </Link>
            <p className="text-[11px] text-slate-500">Digital infrastructure for modern institutions.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/about" className="font-bold text-slate-900">
              About
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/services" className="hover:text-slate-900 transition-colors">
              Platform Services
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/privacy-policy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/terms-of-service" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} CampusFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
