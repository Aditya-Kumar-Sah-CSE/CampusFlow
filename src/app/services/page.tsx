import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { ServicesCatalogClient } from '@/components/services/ServicesCatalogClient';
import {
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  CreditCard,
  Lock,
  Calendar,
  GraduationCap,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Services & Capabilities | CampusFlow',
  description:
    'Core tools for feedback, events, registration, and institutional operations.',
  openGraph: {
    title: 'Services & Capabilities | CampusFlow',
    description:
      'Core tools for feedback, events, registration, and institutional operations.',
    url: `${APP_URL}/services`,
  },
};

export default function ServicesPage() {
  const FEEDBACK_WORKFLOW = [
    { step: '01', title: 'Create Form', desc: 'Define criteria & faculties' },
    { step: '02', title: 'Google Form Sync', desc: 'Generate linked survey' },
    { step: '03', title: 'Anonymous Responses', desc: 'Students evaluate securely' },
    { step: '04', title: 'Google Sheet Sync', desc: 'Pull responses automatically' },
    { step: '05', title: 'CampusFlow Analysis', desc: 'Calculate faculty scores' },
    { step: '06', title: 'Report / PDF', desc: 'Export departmental audits' },
  ];

  const EVENTS_WORKFLOW = [
    { step: '01', title: 'Create Event', desc: 'Set timeline & guidelines' },
    { step: '02', title: 'Publish Program', desc: 'Competitions & rules' },
    { step: '03', title: 'Registration', desc: 'Solo or team join codes' },
    { step: '04', title: 'Payment / UTR Verify', desc: 'Verify UPI transaction' },
    { step: '05', title: 'Digital Pass & QR', desc: 'Issue encrypted pass' },
    { step: '06', title: 'Gate Check-in', desc: 'Live scanner verification' },
    { step: '07', title: 'Export Roster', desc: 'PDF / CSV attendance' },
  ];

  const CAPABILITY_MATRIX = [
    { feature: 'Institutional Feedback Forms', available: true, detail: 'Branch & semester specific forms' },
    { feature: 'Faculty & Course Evaluation', available: true, detail: 'Standardized evaluation scorecards' },
    { feature: 'Google Forms Sync', available: true, detail: 'Automated form generation via API' },
    { feature: 'Google Sheets Response Sync', available: true, detail: 'Automated survey response pulling' },
    { feature: 'Google Drive Document Storage', available: true, detail: 'Centralized institutional assets' },
    { feature: 'Campus Events & Fests', available: true, detail: 'Multi-category college event publishing' },
    { feature: 'Sub-Program Competitions', available: true, detail: 'Solo and team competition slots' },
    { feature: 'Team Join / Invite Codes', available: true, detail: 'Dynamic join codes & roster control' },
    { feature: 'Payment Reference (UTR) Tracking', available: true, detail: 'UPI QR display and receipt check' },
    { feature: 'Digital Identity Passes (QR)', available: true, detail: 'Instant cryptographic attendee pass' },
    { feature: 'Gate Verification Scanner (/verify)', available: true, detail: 'Live web scanner for gate staff' },
    { feature: 'Server-Side PDF & CSV Exports', available: true, detail: 'PDFKit rosters & CSV data dumps' },
    { feature: 'Multi-Tenant Isolation (/[tenant])', available: true, detail: 'Slug routing & college branding' },
    { feature: 'Progressive Web App (PWA)', available: true, detail: 'Install prompts & offline app shell' },
    { feature: 'Role-Based Access Control', available: true, detail: 'Super Admin and College Admin roles' },
  ];

  const INTEGRATIONS = [
    {
      title: 'Google Forms',
      desc: 'Form creation and survey ingestion',
      icon: FileSpreadsheet,
    },
    {
      title: 'Google Sheets',
      desc: 'Bi-directional response synchronization',
      icon: FileSpreadsheet,
    },
    {
      title: 'Google Drive',
      desc: 'Institutional asset and document storage',
      icon: FileSpreadsheet,
    },
    {
      title: 'UPI Reference Verification',
      desc: '12-digit UTR and receipt capture',
      icon: CreditCard,
    },
  ];

  const SECURITY_TAGS = [
    'Role-Based Access (SUPER_ADMIN / ADMIN)',
    'Institution Isolation (Tenant Slugs)',
    'Admin Controls & Permissions',
    'Authenticated Access (Supabase Auth)',
    'Row Level Security (RLS)',
    'Anonymous Student Submissions',
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Header Navigation */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8 sm:space-y-12">
        {/* HERO SECTION */}
        <section aria-labelledby="services-hero-title" className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Platform Services</span>
          </div>

          <h1
            id="services-hero-title"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            Services &amp; Capabilities
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            Core tools for feedback, events, registration, and institutional operations.
          </p>
        </section>

        {/* INTERACTIVE SERVICE CATALOG (Category Pills & Verified Modules) */}
        <section aria-labelledby="catalog-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="catalog-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Operational Modules
            </h2>
            <p className="text-xs text-slate-500">Filter modules by functional domain.</p>
          </div>

          <ServicesCatalogClient />
        </section>

        {/* REAL IMPLEMENTED WORKFLOWS */}
        <section aria-labelledby="workflows-heading" className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="workflows-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Implemented Workflows
            </h2>
            <p className="text-xs text-slate-500">End-to-end operation pipelines supported by the repository.</p>
          </div>

          {/* Workflow A: Feedback */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                1. Institutional Feedback Lifecycle
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {FEEDBACK_WORKFLOW.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1 hover:bg-emerald-50/50 hover:border-emerald-200 transition-colors"
                >
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                    {step.step}
                  </span>
                  <p className="text-xs font-bold text-slate-900 leading-tight">{step.title}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow B: Events */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                2. Campus Events &amp; Passes Lifecycle
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {EVENTS_WORKFLOW.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1 hover:bg-violet-50/50 hover:border-violet-200 transition-colors"
                >
                  <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-100/70 px-1.5 py-0.2 rounded">
                    {step.step}
                  </span>
                  <p className="text-xs font-bold text-slate-900 leading-tight">{step.title}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTEGRATION SECTION */}
        <section aria-labelledby="integrations-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="integrations-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Supported Integrations
            </h2>
            <p className="text-xs text-slate-500">Native external tool connections built into CampusFlow.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {INTEGRATIONS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="text-xs font-bold text-slate-900 leading-tight">{item.title}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CAPABILITY MATRIX */}
        <section aria-labelledby="matrix-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="matrix-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Capability Matrix
            </h2>
            <p className="text-xs text-slate-500">Implemented features verified across the codebase.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-2.5 px-4">Capability</th>
                    <th scope="col" className="py-2.5 px-3 text-center">Status</th>
                    <th scope="col" className="py-2.5 px-4">Implementation Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CAPABILITY_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4 font-semibold text-slate-900">{row.feature}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                          ✓
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-600 text-[11px]">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECURITY & ACCESS */}
        <section aria-labelledby="security-heading" className="space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="security-heading" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Security &amp; Access Controls
            </h2>
            <p className="text-xs text-slate-500">Authentication and authorization boundaries.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Verified Security Features</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {SECURITY_TAGS.map((tag, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{tag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="p-5 sm:p-6 bg-slate-900 text-white rounded-2xl text-center space-y-3 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold">Access CampusFlow</h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Choose your college to browse active feedback forms or register for events.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Select Institution</span>
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Browse Events</span>
            </Link>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Feedback Portals</span>
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
              Designed &amp; Developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Aditya Kumar Sah
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
                Dr. Abhinav Kumar
              </a>{' '}
              (Assistant Professor)
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/about" className="hover:text-slate-900 transition-colors">
              About
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/services" className="font-bold text-slate-900">
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
