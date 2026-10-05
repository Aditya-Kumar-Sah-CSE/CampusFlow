import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import {
  Building2,
  Calendar,
  GraduationCap,
  QrCode,
  Smartphone,
  ShieldCheck,
  Code2,
  ArrowRight,
  ExternalLink,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'About CampusFlow | Campus Management Platform',
  description:
    'CampusFlow is a multi-tenant campus management platform designed for educational institutions to coordinate academic feedback, events, programs, and digital registrations.',
  openGraph: {
    title: 'About CampusFlow | Campus Management Platform',
    description:
      'CampusFlow is a multi-tenant campus management platform designed for educational institutions to coordinate academic feedback, events, programs, and digital registrations.',
    url: `${APP_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Navigation Header */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-14 space-y-8 sm:space-y-12">
        {/* Hero Section */}
        <section aria-labelledby="about-heading" className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/70 shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Platform Overview</span>
          </div>

          <h1
            id="about-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            About CampusFlow
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            CampusFlow is a unified campus management platform designed to centralize core academic feedback, campus events, competitive programs, and digital student participation across participating educational institutions.
          </p>
        </section>

        {/* Core Architecture Pillars */}
        <section aria-labelledby="pillars-heading" className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="pillars-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Platform Architecture &amp; Key Pillars
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              How CampusFlow coordinates institutional workflows across multiple colleges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Pillar 1: Multi-Tenant Architecture */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Tenant Institutional Isolation</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                CampusFlow provides individual institution spaces mapped via tenant slugs (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">/[tenant]</code>). Each participating college has isolated branding, logo metadata, faculty records, and separate academic feedback sessions.
              </p>
            </div>

            {/* Pillar 2: Academic Feedback System */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Institutional Feedback System</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Enables structured student evaluation of faculty and courses structured across academic branches, semesters, and subjects. Submissions are anonymous, with optional automated synchronization with Google Forms and Google Sheets.
              </p>
            </div>

            {/* Pillar 3: Events & Program Management */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Events &amp; Program Registrations</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Complete event lifecycles supporting college fests, technical seminars, and competitive programs. Features individual and team registrations with dynamic join codes, payment reference tracking (UTR/UPI), and participant rosters.
              </p>
            </div>

            {/* Pillar 4: Digital Passes & Verification */}
            <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Digital Passes &amp; QR Check-in</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Registered students receive digital identity cards and event passes embedded with verified QR codes. Organizers and gate coordinators verify registration validity on-site using the built-in verification scanner.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Architecture */}
        <section aria-labelledby="technology-heading" className="p-5 sm:p-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            <h2 id="technology-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Technical Implementation
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            CampusFlow is engineered as a modern web application utilizing reliable web standards and cloud infrastructure:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-slate-900">Next.js &amp; React:</strong> Built on Next.js App Router with Server Actions, server-side data fetching, and dynamic streaming.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-slate-900">Database &amp; Security:</strong> PostgreSQL powered by Supabase with Row Level Security (RLS) enforcing tenant isolation.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-slate-900">Google Workspace APIs:</strong> Automated generation of Google Forms and bi-directional response synchronization via Google Sheets and Drive.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-slate-900">PWA &amp; Android TWA:</strong> Progressive Web App installability across devices with Android Trusted Web Activity distribution scripts.
              </div>
            </div>
          </div>
        </section>

        {/* Academic Guidance & Development */}
        <section aria-labelledby="academic-heading" className="p-5 sm:p-6 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
            <h2 id="academic-heading" className="text-base sm:text-lg font-bold text-white tracking-tight">
              Development &amp; Institutional Mentorship
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            CampusFlow was designed and developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              Aditya Kumar Sah
            </a>{' '}
            under the academic guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              Dr. Abhinav Kumar
            </a>{' '}
            (Assistant Professor, Bhagalpur College of Engineering).
          </p>

          <p className="text-xs text-slate-400">
            The platform is tailored for colleges and polytechnics under the Department of Science, Technology &amp; Technical Education, Government of Bihar and affiliated with Bihar Engineering University (BEU).
          </p>
        </section>

        {/* Call to Action Section */}
        <section className="p-6 sm:p-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Explore CampusFlow Services
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto">
            Review detailed capabilities across academic evaluations, event coordination, and digital verification passes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              href="/services"
              id="cta-view-services"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors"
            >
              <span>Explore Platform Services</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              id="cta-select-college"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl border border-blue-400/30 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              <span>Select Your College</span>
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
