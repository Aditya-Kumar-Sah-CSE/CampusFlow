import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import {
  GraduationCap,
  Calendar,
  QrCode,
  Building2,
  Sliders,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Users,
  CreditCard,
  FileText,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Platform Services | CampusFlow',
  description:
    'Overview of institutional services provided by CampusFlow, including academic feedback management, campus events and programs, digital entry passes, and multi-tenant portals.',
  openGraph: {
    title: 'Platform Services | CampusFlow',
    description:
      'Overview of institutional services provided by CampusFlow, including academic feedback management, campus events and programs, digital entry passes, and multi-tenant portals.',
    url: `${APP_URL}/services`,
  },
};

export default function ServicesPage() {
  const serviceModules = [
    {
      id: 'service-feedback',
      title: 'Institutional Feedback Management',
      badge: 'Academic Operations',
      icon: GraduationCap,
      color: 'emerald',
      description:
        'Structured faculty and course evaluation system built to collect, aggregate, and analyze anonymous student feedback across colleges.',
      features: [
        'Academic mapping across branches, semesters, subjects, and teaching faculties',
        'Configurable evaluation forms with standardized rating metrics and question sets',
        'Anonymous student submission flow ensuring privacy and objective responses',
        'Direct Google Form integration with bi-directional Google Sheets sync',
        'Automated faculty performance metrics, departmental scorecards, and PDF export reports',
      ],
      linkText: 'Explore Feedback Forms',
      linkHref: '/feedback',
    },
    {
      id: 'service-events',
      title: 'Campus Events & Program Coordination',
      badge: 'Student Activities',
      icon: Calendar,
      color: 'violet',
      description:
        'End-to-end event management platform for college fests, technical seminars, cultural programs, and inter-college competitions.',
      features: [
        'Public and college-specific event publishing with guidelines, eligibility, and schedules',
        'Sub-program management for individual and team competitions',
        'Self-service team formation with shareable join codes and roster controls',
        'Registration fee processing with UPI QR display and UTR reference number capture',
        'Administrative dashboard for reviewing, approving, and rejecting registrations',
      ],
      linkText: 'Browse Active Events',
      linkHref: '/events',
    },
    {
      id: 'service-passes',
      title: 'Digital Passes & QR Verification',
      badge: 'Security & Access',
      icon: QrCode,
      color: 'amber',
      description:
        'Instant digital identity cards and event passes embedded with verified QR codes for on-site gate check-in and attendance control.',
      features: [
        'Automatic digital event pass generation upon registration verification',
        'Cryptographic QR code verification linking directly to platform records',
        'Dedicated mobile-friendly verification scanner interface for organizers (/verify)',
        'Live participation status tracking (verified, registered, check-in)',
        'Downloadable digital pass cards (PNG) and printable pass layouts',
      ],
      linkText: 'Learn About Verification',
      linkHref: '/events',
    },
    {
      id: 'service-tenants',
      title: 'Multi-Tenant Institution Portals',
      badge: 'Campus Identity',
      icon: Building2,
      color: 'blue',
      description:
        'Isolated college spaces allowing each educational institution to present branded portals for their students, faculty, and administration.',
      features: [
        'Dedicated institution URLs mapped via slug routing (/[tenant])',
        'Custom college identity: institutional crest, official logos, and color palettes',
        'Direct linking to official college web portals and university affiliations',
        'Isolated academic databases, faculty rosters, and survey records per institution',
        'Centralized institution directory enabling cross-campus visibility',
      ],
      linkText: 'Select Your Institution',
      linkHref: '/',
    },
    {
      id: 'service-admin',
      title: 'Administrative Console & Reporting',
      badge: 'Management',
      icon: Sliders,
      color: 'indigo',
      description:
        'Secure administrative dashboards offering institution managers and department heads complete control over data, forms, and event rosters.',
      features: [
        'Super Admin dashboard for institution onboarding and credential management',
        'College Admin console for faculty directory and feedback form lifecycle control',
        'Comprehensive participant management with search, filters, and status updates',
        'Server-side PDF generation for attendance sheets, team rosters, and audit reports',
        'Exportable CSV data sets for offline institutional analysis',
      ],
      linkText: 'Admin Portal Login',
      linkHref: '/admin/login',
    },
    {
      id: 'service-pwa',
      title: 'Progressive Web App & Android Distribution',
      badge: 'Mobile Access',
      icon: Smartphone,
      color: 'sky',
      description:
        'Mobile-optimized web application architecture supporting Progressive Web App (PWA) installation and native Android TWA packaging.',
      features: [
        'Installable Progressive Web App (PWA) directly from modern mobile browsers',
        'College-specific installation buttons and installation counter analytics',
        'Offline shell support with local asset caching',
        'Native Android build automation via Trusted Web Activity (TWA) multi-variant scripts',
        'Touch-optimized, responsive UI designed for student smartphones',
      ],
      linkText: 'Install Platform',
      linkHref: '/',
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200/80',
          text: 'text-emerald-700',
          iconBg: 'bg-emerald-100/70',
          iconText: 'text-emerald-600',
        };
      case 'violet':
        return {
          bg: 'bg-violet-50',
          border: 'border-violet-200/80',
          text: 'text-violet-700',
          iconBg: 'bg-violet-100/70',
          iconText: 'text-violet-600',
        };
      case 'amber':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200/80',
          text: 'text-amber-800',
          iconBg: 'bg-amber-100/70',
          iconText: 'text-amber-600',
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50',
          border: 'border-indigo-200/80',
          text: 'text-indigo-700',
          iconBg: 'bg-indigo-100/70',
          iconText: 'text-indigo-600',
        };
      case 'sky':
        return {
          bg: 'bg-sky-50',
          border: 'border-sky-200/80',
          text: 'text-sky-700',
          iconBg: 'bg-sky-100/70',
          iconText: 'text-sky-600',
        };
      case 'blue':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200/80',
          text: 'text-blue-700',
          iconBg: 'bg-blue-100/70',
          iconText: 'text-blue-600',
        };
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Top Navbar */}
      <RootPublicNavbar />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-14 space-y-8 sm:space-y-12">
        {/* Header Section */}
        <section aria-labelledby="services-heading" className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/70 shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Platform Services</span>
          </div>

          <h1
            id="services-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            Services &amp; Capabilities
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            CampusFlow provides a suite of purpose-built modules designed to streamline academic feedback, campus event operations, digital registration, and institutional reporting.
          </p>
        </section>

        {/* Services Grid */}
        <section aria-labelledby="modules-heading" className="space-y-6">
          <div className="border-b border-slate-200 pb-2">
            <h2 id="modules-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Operational Modules
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Each module is integrated directly into the multi-tenant architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {serviceModules.map((service) => {
              const Icon = service.icon;
              const colorClasses = getColorClasses(service.color);

              return (
                <article
                  key={service.id}
                  id={service.id}
                  className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-10 h-10 rounded-xl ${colorClasses.iconBg} flex items-center justify-center ${colorClasses.iconText} shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}>
                        {service.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {service.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Key Features
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={service.linkHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <span>{service.linkText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Integration Architecture */}
        <section aria-labelledby="integrations-heading" className="p-5 sm:p-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 id="integrations-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Supported Technologies &amp; Standards
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            All services on CampusFlow are built using vetted platform technologies natively supported by the codebase:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Google Workspace</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Bi-directional synchronization with Google Forms, Google Sheets, and Google Drive for automated feedback response collation.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>UPI Verification</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Standard UPI payment QR integration with 12-digit UTR transaction reference capture and screenshot receipt verification.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                <FileText className="w-4 h-4 text-violet-600" />
                <span>Document Exports</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Server-side generation of high-resolution PDF rosters, identity passes, and CSV spreadsheets for offline academic records.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Access Action Box */}
        <section className="p-6 sm:p-8 bg-slate-900 text-white rounded-2xl shadow-sm text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Ready to Access Your College Services?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Choose your college to browse active feedback forms, register for ongoing events, or access administrative tools.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link
              href="/"
              id="cta-select-institution"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors"
            >
              <Building2 className="w-4 h-4" />
              <span>Select Institution</span>
            </Link>
            <Link
              href="/about"
              id="cta-learn-about"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 transition-colors"
            >
              <span>About Platform</span>
              <ArrowRight className="w-4 h-4" />
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
