import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { AboutWorkflowClient } from '@/components/about/AboutWorkflowClient';
import {
  Building2,
  Calendar,
  GraduationCap,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Layers,
  Users,
  Sliders,
  FileSpreadsheet,
  FileText,
  GitBranch,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'About CampusFlow | Campus Management Platform',
  description:
    'Unified platform for institutional feedback, campus events, digital registration, and student participation.',
  openGraph: {
    title: 'About CampusFlow | Campus Management Platform',
    description:
      'Unified platform for institutional feedback, campus events, digital registration, and student participation.',
    url: `${APP_URL}/about`,
  },
};

export default function AboutPage() {
  const CAPABILITY_CHIPS = [
    'Feedback',
    'Events',
    'Registration',
    'Student Participation',
    'Institutional Portals',
    'Reports',
  ];

  const SNAPSHOT_CARDS = [
    { label: 'Multi-Institution', caption: 'Tenant-based portals (/[tenant])', icon: Building2 },
    { label: 'Feedback', caption: 'Structured academic evaluation', icon: GraduationCap },
    { label: 'Events', caption: 'College event publishing', icon: Calendar },
    { label: 'Registration', caption: 'Digital student registration', icon: Users },
    { label: 'Verification', caption: 'Cryptographic QR passes', icon: QrCode },
    { label: 'Reports', caption: 'PDF & CSV data exports', icon: FileText },
  ];

  const CORE_PILLARS = [
    {
      title: 'Institutional Feedback',
      icon: GraduationCap,
      color: 'emerald',
      sentence: 'Collect and analyze structured academic evaluations across branches, semesters, and faculties.',
      keywords: [
        'Feedback Forms',
        'Faculty Evaluation',
        'Course Evaluation',
        'Anonymous Responses',
        'Google Forms',
        'Google Sheets',
        'Reports',
      ],
    },
    {
      title: 'Campus Events',
      icon: Calendar,
      color: 'violet',
      sentence: 'Publish college events, manage competition categories, and track registrations.',
      keywords: [
        'Event Publishing',
        'Registration',
        'Student Passes',
        'Team Events',
        'Cultural Programs',
        'Technical Events',
      ],
    },
    {
      title: 'Student Participation',
      icon: Users,
      color: 'blue',
      sentence: 'Self-service registration with team invite codes, digital passes, and gate verification.',
      keywords: [
        'Registration',
        'Event Pass',
        'Identity Verification',
        'Team Formation',
        'Join Codes',
        'Participation',
      ],
    },
    {
      title: 'Institutional Management',
      icon: Sliders,
      color: 'amber',
      sentence: 'Configure college profiles, academic departments, faculties, and role-based permissions.',
      keywords: [
        'College Profiles',
        'Branding',
        'Branches',
        'Faculty',
        'Academic Structure',
        'Admin Controls',
      ],
    },
  ];

  const ARCH_BLOCKS = [
    { step: '01', title: 'CampusFlow', desc: 'Central Router & Platform Core', icon: Layers },
    { step: '02', title: 'Institution Portal', desc: 'Custom Tenant Space (/[tenant])', icon: Building2 },
    { step: '03', title: 'Operations', desc: 'Feedback · Events · Registration', icon: Sliders },
    { step: '04', title: 'Google APIs', desc: 'Forms · Sheets · Drive Sync', icon: FileSpreadsheet },
    { step: '05', title: 'Outputs', desc: 'Reports · PDFs · Digital Passes', icon: FileText },
  ];

  const TECH_STACK = [
    { name: 'Next.js', role: 'Full-Stack Framework' },
    { name: 'React', role: 'UI Library' },
    { name: 'TypeScript', role: 'Type Safety' },
    { name: 'Supabase', role: 'Backend & Auth' },
    { name: 'PostgreSQL', role: 'Relational Database (RLS)' },
    { name: 'Google Forms', role: 'Survey Ingestion API' },
    { name: 'Google Sheets', role: 'Response Sync' },
    { name: 'Google Drive', role: 'Document Storage' },
    { name: 'Vercel', role: 'Edge Deployment' },
    { name: 'Tailwind CSS', role: 'Responsive Styling' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Navigation Header */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8 sm:space-y-12">
        {/* HERO SECTION */}
        <section aria-labelledby="hero-title" className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Platform Overview</span>
          </div>

          <h1
            id="hero-title"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            About CampusFlow
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Unified platform for institutional feedback, campus events, digital registration, and student participation.
          </p>

          {/* Capability Chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {CAPABILITY_CHIPS.map((chip, idx) => (
              <span
                key={idx}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
              >
                {chip}
              </span>
            ))}
          </div>
        </section>

        {/* PLATFORM SNAPSHOT */}
        <section aria-labelledby="snapshot-heading" className="space-y-3">
          <h2 id="snapshot-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Platform Snapshot
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {SNAPSHOT_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all text-center space-y-1 group"
                >
                  <div className="w-7 h-7 mx-auto rounded-lg bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-600 flex items-center justify-center transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 leading-tight">{card.label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{card.caption}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* WHAT CAMPUSFLOW DOES (4 Compact Cards) */}
        <section aria-labelledby="pillars-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="pillars-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              What CampusFlow Does
            </h2>
            <p className="text-xs text-slate-500">Core operational areas managed within the platform.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {CORE_PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <article
                  key={i}
                  className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md motion-safe:hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-700 flex items-center justify-center transition-colors shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {pillar.title}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {pillar.sentence}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {pillar.keywords.map((kw, kwIdx) => (
                      <span
                        key={kwIdx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/70 font-medium group-hover:border-slate-300 transition-colors"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS (Visual Workflow) */}
        <section aria-labelledby="workflow-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="workflow-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              How It Works
            </h2>
            <p className="text-xs text-slate-500">Step-by-step lifecycle from institutional configuration to reports.</p>
          </div>

          <AboutWorkflowClient />
        </section>

        {/* PLATFORM ARCHITECTURE */}
        <section aria-labelledby="arch-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="arch-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Platform Architecture
            </h2>
            <p className="text-xs text-slate-500">Data and operation flow across system components.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
              {ARCH_BLOCKS.map((block, idx) => {
                const Icon = block.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-center space-y-1.5 hover:bg-blue-50/50 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{block.step}</span>
                      <Icon className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">{block.title}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">{block.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* MULTI-INSTITUTION MODEL */}
        <section aria-labelledby="tenant-model-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="tenant-model-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Multi-Institution Model
            </h2>
            <p className="text-xs text-slate-500">Tenant-based hierarchy powering individual colleges.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <GitBranch className="w-4 h-4 text-blue-600" />
              <span>CampusFlow Platform Node</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                  Tenant Structure
                </span>
                <p className="text-xs font-bold text-slate-900">Dedicated Portal (/[slug])</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {['Branding', 'Logo', 'Colors', 'Website Link'].map((t, idx) => (
                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                  Operations
                </span>
                <p className="text-xs font-bold text-slate-900">Academic &amp; Event Modules</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {['Feedback', 'Events', 'Sub-Programs', 'Passes'].map((t, idx) => (
                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100/70 px-1.5 py-0.5 rounded">
                  Access &amp; RLS
                </span>
                <p className="text-xs font-bold text-slate-900">Role-Based Controls</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {['Super Admin', 'College Admin', 'RLS Isolation'].map((t, idx) => (
                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TECHNOLOGY STACK */}
        <section aria-labelledby="tech-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="tech-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Technology &amp; Integrations
            </h2>
            <p className="text-xs text-slate-500">Core software and external APIs implemented in this repository.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
            {TECH_STACK.map((tech, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors space-y-0.5"
              >
                <p className="text-xs font-bold text-slate-900 leading-tight">{tech.name}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{tech.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ACADEMIC MENTORSHIP NOTE */}
        <section className="p-4 sm:p-5 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider">Development &amp; Institutional Mentorship</h2>
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

        {/* CTA */}
        <section className="p-5 sm:p-6 bg-white border border-slate-200/90 rounded-2xl text-center space-y-3 shadow-2xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Explore CampusFlow</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Browse platform modules or access your college&apos;s dedicated portal.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <span>View Services</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Select Institution</span>
            </Link>
          </div>
        </section>
      </main>

      {/* 3. Platform Footer */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-4 px-2.5 sm:px-4 sm:py-6 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <Link
              href="/"
              className="font-bold text-slate-800 hover:text-blue-600 hover:underline transition-colors block"
              title="CampusFlow Main Portal"
            >
              CampusFlow
            </Link>
            <p className="text-[11px] text-slate-500">Campus Management Platform</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Designed and developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Mr. Aditya Kumar Sah
              </a>{' '}
              •{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 hover:underline transition-colors"
              >
                Developer Portfolio
              </a>{' '}
              under the guidance of{' '}
              <a
                href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Dr. Avinav
              </a>{' '}
              (Assistant Professor)
            </p>
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
              Services
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
