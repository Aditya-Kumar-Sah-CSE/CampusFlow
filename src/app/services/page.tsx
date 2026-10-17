import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import {
  GraduationCap,
  FileText,
  Calendar,
  CheckSquare,
  LineChart,
  ShieldCheck,
  Building2,
  ArrowRight,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { RedPushpin } from '@/components/ui/RedPushpin';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Platform Services | CampusFlow',
  description:
    'Everything an institution needs to manage academic and engagement workflows in one place.',
  openGraph: {
    title: 'Platform Services | CampusFlow',
    description:
      'Everything an institution needs to manage academic and engagement workflows in one place.',
    url: `${APP_URL}/services`,
  },
};

export default function ServicesPage() {
  const SERVICES = [
    {
      id: 'academic',
      number: '01',
      title: 'Academic Management',
      badge: 'Core Curriculum',
      description:
        'Manage curriculum structures, departmental divisions, faculty rosters, and teaching assignments.',
      icon: GraduationCap,
      features: [
        'Academic sessions & terms',
        'Branches & departments',
        'Subjects & course codes',
        'Semesters / Classes (Higher Ed & K-12)',
        'Faculty directory & profiles',
        'Faculty-subject teaching assignments',
      ],
    },
    {
      id: 'feedback',
      number: '02',
      title: 'Feedback Management',
      badge: 'Evaluation & Quality',
      description:
        'Standardized institutional feedback forms with connected response ingestion and faculty summaries.',
      icon: FileText,
      features: [
        'Create feedback forms',
        'Collect anonymous student responses',
        'Faculty-wise performance reports',
        'Result dashboards & scorecards',
        'Departmental PDF reports',
        'Feedback analytics & response rates',
      ],
    },
    {
      id: 'events',
      number: '03',
      title: 'Event Management',
      badge: 'Campus Engagement',
      description:
        'Complete event workflows from competition category setup to registration, ticketing, and gate checks.',
      icon: Calendar,
      features: [
        'Events & symposium publishing',
        'Programs & competition rules',
        'Registrations (Solo & team)',
        'Team management & invite codes',
        'Participant records & payment tracking',
        'Passes with cryptographic QR codes',
        'Event reports & roster exports',
      ],
    },
    {
      id: 'exams',
      number: '04',
      title: 'Examination & Assessments',
      badge: 'Testing & Evaluation',
      description:
        'Secure online test administration with timed student sessions, server-side grading, and instant rank sheets.',
      icon: CheckSquare,
      features: [
        'Exam creation & duration controls',
        'MCQ question builder with explanations',
        'Server-side evaluation & anti-tamper checks',
        'Timed attempts with auto-submission',
        'Automatic results & scorecards',
        'Printable result PDFs',
        'Question analytics & accuracy metrics',
      ],
    },
    {
      id: 'reports',
      number: '05',
      title: 'Reports & Analytics',
      badge: 'Data Intelligence',
      description:
        'Real-time dashboards, departmental compliance audits, and server-side document generation.',
      icon: LineChart,
      features: [
        'Institutional overview dashboards',
        'Feedback analytics & score trends',
        'Exam results & candidate rankings',
        'Event reports & participation demographics',
        'Verified PDF exports',
        'Raw CSV data downloads',
      ],
    },
    {
      id: 'admin',
      number: '06',
      title: 'Institution Administration',
      badge: 'Governance & Security',
      description:
        'Multi-tenant boundaries, institution branding, and database-level Row Level Security controls.',
      icon: ShieldCheck,
      features: [
        'Institution profile & custom slug (/[tenant])',
        'Branding/logo & theme styling',
        'User/role management (Super Admin & College Admin)',
        'Access control & permission governance',
        'Tenant-specific configuration',
        'Database Row Level Security (RLS) isolation',
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-[#faebd0]">
      {/* 1. Global Navigation */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
        {/* HERO SECTION IN EXAMPAD */}
        <ExamPadCard variant="dashboard" clipLabel="SYSTEM SERVICES">
          <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4 py-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] text-[11px] font-bold uppercase tracking-wider bg-amber-100/80 dark:bg-[#2b1f11] text-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Verified System Capabilities</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-[#faebd0]">
              Platform Services
            </h1>

            <p className="text-lg sm:text-xl font-bold text-amber-900 dark:text-amber-300 max-w-2xl mx-auto">
              Everything an institution needs to manage academic and engagement workflows in one place.
            </p>

            <p className="text-sm sm:text-base text-slate-600 dark:text-[#c4a97d] leading-relaxed max-w-2xl mx-auto">
              CampusFlow provides dedicated modules for colleges and schools to govern academic records,
              conduct structured evaluations, host events, and administer online assessments.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-[3px] shadow-xs transition-colors"
              >
                <span>About Architecture</span>
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

        {/* 6 PINNED SERVICES */}
        <section aria-labelledby="services-list-heading" className="space-y-5">
          <div className="border-b border-amber-900/20 dark:border-[#382713] pb-2.5">
            <h2 id="services-list-heading" className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0] tracking-tight">
              Operational Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d]">
              Only real functionality implemented and active in the CampusFlow codebase:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="relative p-5 pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] rounded-[3px] border border-amber-900/30 dark:border-[#422e17] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 overflow-visible"
                >
                  <RedPushpin className="-top-3" />
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-8 h-8 rounded-[2px] bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] bg-amber-100/80 dark:bg-[#2b1f11] text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/60">
                        {service.number}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">{service.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-1 leading-relaxed">{service.description}</p>
                    </div>

                    <div className="pt-2 border-t border-dashed border-amber-900/15 dark:border-[#382713] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9e835b] block">
                        Included Features
                      </span>
                      <ul className="space-y-1">
                        {service.features.map((feat, fIdx) => (
                          <li key={fIdx} className="text-xs text-slate-700 dark:text-[#c4a97d] flex items-start gap-1.5 leading-snug">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-semibold text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-[#2b1f11] px-2.5 py-1 rounded-[2px] border border-amber-300/80 dark:border-[#4d3817]">
                      {service.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CALL TO ACTION IN EXAMPAD */}
        <ExamPadCard variant="dashboard" clipLabel="CONNECT INSTITUTION">
          <div className="text-center space-y-3 py-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#faebd0]">Ready to deploy CampusFlow for your College?</h2>
            <p className="text-xs text-slate-600 dark:text-[#c4a97d] max-w-md mx-auto">
              Secure institutional onboarding with verified administrative access and complete curriculum setup.
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
                href="/admin/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-[#1a1208] hover:bg-slate-100 dark:hover:bg-[#281b0f] text-slate-800 dark:text-[#faebd0] font-bold text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Institutional Portal</span>
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
            <Link href="/about" className="hover:text-amber-600 transition-colors">
              About
            </Link>
            <span className="text-amber-900/30">•</span>
            <Link href="/services" className="font-bold text-slate-900 dark:text-[#faebd0]">
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
