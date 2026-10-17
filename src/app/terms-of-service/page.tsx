import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import {
  FileText,
  Shield,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Calendar,
  AlertTriangle,
  Scale,
  Building,
  Mail,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { APP_URL } from '@/lib/config/app';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { RedPushpin } from '@/components/ui/RedPushpin';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Terms of Service | CampusFlow',
  description:
    'Terms of Service for CampusFlow governing institutional access, administrator responsibilities, academic feedback, events, programs, registrations, Google Workspace integrations, and platform usage.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'September 23, 2026';

  const sections = [
    { id: 'acceptance', num: '01', title: 'Acceptance of Terms & Governance' },
    { id: 'services', num: '02', title: 'Description of CampusFlow Services' },
    { id: 'accounts', num: '03', title: 'Institutional Accounts & Admin Obligations' },
    { id: 'google', num: '04', title: 'Google Workspace Integrations & Permissions' },
    { id: 'data-ownership', num: '05', title: 'Data Ownership & Intellectual Property' },
    { id: 'acceptable-use', num: '06', title: 'Acceptable Use Policy & Restrictions' },
    { id: 'billing', num: '07', title: 'Subscriptions, Billing & Entitlements' },
    { id: 'availability', num: '08', title: 'Service Availability & SLA' },
    { id: 'suspension', num: '09', title: 'Suspension & Account Termination' },
    { id: 'disclaimers', num: '10', title: 'Disclaimers & Limitation of Liability' },
    { id: 'modifications', num: '11', title: 'Modifications to Terms' },
    { id: 'contact', num: '12', title: 'Contact Information & Official Notice' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0603] text-slate-900 dark:text-[#faebd0] transition-colors selection:bg-amber-200 selection:text-amber-950">
      {/* Top Header */}
      <RootPublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
        {/* Navigation Breadcrumb / Back button */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-200 transition-colors py-1 px-2.5 rounded-[3px] bg-amber-500/10 dark:bg-amber-950/40 border border-amber-600/20"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>CampusFlow Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/privacy-policy"
              className="text-slate-600 dark:text-[#c4a97d] hover:text-amber-800 dark:hover:text-amber-300 transition-colors font-medium"
            >
              Privacy Policy &rarr;
            </Link>
          </div>
        </div>

        {/* 1. ExamPad Header Hero Card */}
        <ExamPadCard variant="dashboard" clipLabel="LEGAL TERMS">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[3px] text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-[#2b1f11] text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shadow-xs">
                <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Institutional Terms of Use</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-[#faebd0] tracking-tight">
                Terms of Service
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] max-w-2xl leading-relaxed">
                Rules, guidelines, and obligations governing institutional administrators, faculty members, event coordinators, and students utilizing CampusFlow.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-amber-900/15 dark:border-[#382713] pt-3 md:pt-0 md:pl-5 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-[#9e835b]">
                Document Version
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-amber-950 dark:text-amber-300 bg-amber-100/70 dark:bg-[#2b1f11] px-2.5 py-1 rounded-[3px] border border-amber-300/70 dark:border-[#4d3817]">
                Effective {lastUpdated}
              </span>
            </div>
          </div>
        </ExamPadCard>

        {/* 2. Quick Navigation Index (Click to jump) */}
        <div className="exam-pad-board-dashboard rounded-lg p-3 sm:p-4 relative shadow-md">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-900/15 dark:border-[#332210]">
            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 dark:text-[#faebd0]">
              Table of Contents &amp; Quick Index
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 p-2 rounded-[3px] bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/20 dark:border-[#382713] hover:border-amber-500 dark:hover:border-amber-600 text-slate-800 dark:text-[#faebd0] hover:text-amber-900 dark:hover:text-amber-200 transition-colors group"
              >
                <span className="font-mono text-[10px] font-black text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-[#2b1f11] px-1.5 py-0.5 rounded-[2px] shrink-0">
                  {s.num}
                </span>
                <span className="truncate font-semibold group-hover:underline">{s.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 3. Detailed Sections Rendered as Pinned Paper Ledger Sheets */}
        <div className="space-y-5 sm:space-y-6">
          {/* Section 1 */}
          <section
            id="acceptance"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 01
              </span>
              <span>BINDING AGREEMENT</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              1. Acceptance of Terms
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              By accessing, browsing, registering for, or using <strong>CampusFlow</strong> (&quot;CampusFlow&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;) hosted at{' '}
              <a href={APP_URL} className="text-amber-700 dark:text-amber-400 underline font-semibold">
                {APP_URL}
              </a>, you agree to be legally bound by these Terms of Service (&quot;Terms&quot;). If you do not agree with any provision of these Terms, you must immediately discontinue use of the Platform.
            </p>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              These Terms apply to all users and stakeholders, including institutional super administrators, departmental heads, faculty members, student event coordinators, enrolled participants, and public visitors.
            </p>
          </section>

          {/* Section 2 */}
          <section
            id="services"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 02
              </span>
              <span>CORE CAPABILITIES</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              2. Description of the Service
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              CampusFlow is a multi-tenant institutional operating platform engineered to modernize academic workflows and extracurricular administration across colleges and universities. Core modules include:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-xs text-slate-700 dark:text-[#d6c29e]">
              <li className="p-2.5 rounded-[2px] bg-[#fcf9f2] dark:bg-[#22160d] border border-amber-900/15 dark:border-[#382713] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Academic Hierarchy:</strong> Automated management of degree programs (B.Tech, M.Tech), departments, sessions, and faculty course assignments.</span>
              </li>
              <li className="p-2.5 rounded-[2px] bg-[#fcf9f2] dark:bg-[#22160d] border border-amber-900/15 dark:border-[#382713] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Feedback Engine:</strong> Google Forms integration, multiple-choice grid evaluations, anonymous feedback collection, and PDF analytics.</span>
              </li>
              <li className="p-2.5 rounded-[2px] bg-[#fcf9f2] dark:bg-[#22160d] border border-amber-900/15 dark:border-[#382713] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Events &amp; Registrations:</strong> Multi-program fests, hackathons, team creation with invitation codes, and QR digital passes.</span>
              </li>
              <li className="p-2.5 rounded-[2px] bg-[#fcf9f2] dark:bg-[#22160d] border border-amber-900/15 dark:border-[#382713] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Tenancy &amp; Isolation:</strong> Separate tenant sub-paths, customizable branding, localized role permissions, and tamper-resistant audit logs.</span>
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section
            id="accounts"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 03
              </span>
              <span>ADMIN RESPONSIBILITIES</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              3. Institutional Accounts &amp; Administrator Responsibilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              Institutional administrator accounts are issued strictly to authorized faculty members or institutional delegates. Obligations include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] pl-2">
              <li><strong>Institutional Authorization:</strong> Administrators affirm they have official authorization from their college/university leadership.</li>
              <li><strong>Credential Confidentiality:</strong> Administrators are solely responsible for securing authentication credentials and any actions executed under their accounts.</li>
              <li><strong>Data Integrity:</strong> Ensuring all faculty lists, semester allocations, and survey questions accurately reflect university guidelines.</li>
              <li><strong>Access Auditing:</strong> Promptly provisioning and de-provisioning departmental access when staff roles or responsibilities change.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section
            id="google"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 04
              </span>
              <span>GOOGLE WORKSPACE COMPLIANCE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              4. Google Workspace Integrations &amp; Permissions
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              Colleges may link an official Google account using OAuth 2.0 to automate feedback form generation and response spreadsheet synchronization. By connecting a Google account:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] pl-2">
              <li>Access is requested strictly for Google Forms, Sheets, Drive (restricted to files created by CampusFlow via <code>drive.file</code>), and basic profile info.</li>
              <li>CampusFlow strictly complies with the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 dark:text-amber-400 underline font-semibold"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </li>
              <li>Administrators can disconnect and revoke permissions instantly at any time from the administration settings dashboard.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section
            id="data-ownership"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 05
              </span>
              <span>INTELLECTUAL PROPERTY</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              5. Institutional Data &amp; Content Ownership
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              Each educational institution retains 100% complete ownership, title, and intellectual property rights in and to its academic databases, faculty rosters, survey questionnaires, student submissions, team rosters, and exported PDF reports.
            </p>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              CampusFlow claims zero ownership over college data. We hold only a limited, non-exclusive license strictly to host, index, display, and process data for providing the services configured by the institution.
            </p>
          </section>

          {/* Section 6 */}
          <section
            id="acceptable-use"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 06
              </span>
              <span>PROHIBITIONS &amp; SECURITY</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              6. Acceptable Use Policy
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              All users agree NOT to engage in any of the following prohibited actions:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-[#d6c29e]">
              <div className="p-2.5 rounded-[2px] bg-rose-50/60 dark:bg-[#2a1310] border border-rose-200/60 dark:border-rose-900/40">
                <p className="font-bold text-rose-900 dark:text-rose-300">Unauthorized Cross-Tenant Access</p>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80 mt-0.5">Attempting to breach multi-tenant barriers or read another institution&apos;s records.</p>
              </div>
              <div className="p-2.5 rounded-[2px] bg-rose-50/60 dark:bg-[#2a1310] border border-rose-200/60 dark:border-rose-900/40">
                <p className="font-bold text-rose-900 dark:text-rose-300">Fraudulent Submissions</p>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80 mt-0.5">Uploading forged payment receipts or fabricating automated feedback responses.</p>
              </div>
              <div className="p-2.5 rounded-[2px] bg-rose-50/60 dark:bg-[#2a1310] border border-rose-200/60 dark:border-rose-900/40">
                <p className="font-bold text-rose-900 dark:text-rose-300">Denial of Service &amp; Abuse</p>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80 mt-0.5">Automated crawling, rate-limit bypassing, or attacking core platform endpoints.</p>
              </div>
              <div className="p-2.5 rounded-[2px] bg-rose-50/60 dark:bg-[#2a1310] border border-rose-200/60 dark:border-rose-900/40">
                <p className="font-bold text-rose-900 dark:text-rose-300">Impersonation &amp; Deception</p>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-400/80 mt-0.5">Falsely representing college authority or registering unauthorized events under college names.</p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section
            id="billing"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 07
              </span>
              <span>SUBSCRIPTION TERMS</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              7. Subscriptions, Billing &amp; Plan Entitlements
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              CampusFlow provides tiered plans (Standard, Pro, Enterprise) for colleges requiring higher form volumes, priority Google synchronization, and institutional analytics. Subscription terms:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] pl-2">
              <li>Plan upgrades are validated through verified UPI payment confirmations and administrator approval.</li>
              <li>Upon subscription expiration, tenant accounts retain read-only access to historical records while automated form synchronization is gracefully paused until renewal.</li>
              <li>No auto-debit without explicit authorization; all renewals are transparent and opt-in.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section
            id="availability"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 08
              </span>
              <span>RELIABILITY &amp; SLA</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              8. Service Availability &amp; Modifications
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              We strive to deliver 99.9% platform availability. Routine maintenance, security patching, and cloud infrastructure updates are scheduled during off-peak hours with advance administrator notifications. We are not liable for transient disruptions caused by upstream network failures or third-party outages (such as Google Cloud or Supabase).
            </p>
          </section>

          {/* Section 9 */}
          <section
            id="suspension"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 09
              </span>
              <span>TERMINATION CLAUSE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              9. Account Suspension &amp; Termination
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              CampusFlow reserves the right to suspend or revoke access for any account found in willful violation of these Terms, attempting malicious data manipulation, or distributing fraudulent content. Terminated tenants may request a one-time archive export of their legitimate institutional data within 30 days of account notice.
            </p>
          </section>

          {/* Section 10 */}
          <section
            id="disclaimers"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 10
              </span>
              <span>LEGAL LIMITATION</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              10. Disclaimers &amp; Limitation of Liability
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed uppercase font-semibold">
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAMPUSFLOW, ITS OPERATORS, AND AFFILIATED CONTRIBUTORS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OF OR INABILITY TO USE THE PLATFORM.
            </p>
          </section>

          {/* Section 11 */}
          <section
            id="modifications"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 11
              </span>
              <span>CONTINUOUS EVOLUTION</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              11. Modifications to these Terms
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              We may update these Terms periodically as platform features expand. Material revisions will be accompanied by an updated &quot;Last Updated&quot; date and in-app notice to registered administrators. Continued use constitutes explicit acceptance of revised terms.
            </p>
          </section>

          {/* Section 12 */}
          <section
            id="contact"
            className="relative pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-5 sm:p-7 shadow-sm text-slate-800 dark:text-[#faebd0] space-y-3 scroll-mt-28"
          >
            <RedPushpin className="-top-3" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-400">
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-100 dark:bg-[#2b1f11] border border-amber-300 dark:border-[#4d3817]">
                § 12
              </span>
              <span>COMMUNICATIONS</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-[#faebd0]">
              12. Contact Information &amp; Official Notice
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#d6c29e] leading-relaxed">
              For legal inquiries, institutional onboarding requests, compliance clarification, or formal communication, please contact the administration team:
            </p>
            <div className="p-4 rounded-[3px] bg-[#fcf9f2] dark:bg-[#20140a] border border-amber-900/25 dark:border-[#382713] text-xs sm:text-sm space-y-1.5 font-medium">
              <p className="font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>CampusFlow Institutional Administration</span>
              </p>
              <p className="text-slate-600 dark:text-[#c4a97d] flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Email: <a href="mailto:iambestadi@gmail.com" className="font-mono text-amber-800 dark:text-amber-300 underline">iambestadi@gmail.com</a></span>
              </p>
              <p className="text-slate-600 dark:text-[#c4a97d] flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Platform URL: <a href={APP_URL} className="text-amber-800 dark:text-amber-300 underline">{APP_URL}</a></span>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#120a05] border-t border-slate-200 dark:border-amber-950/60 text-xs text-slate-500 dark:text-[#9e835b] py-6 px-4 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <Link
              href="/"
              className="font-bold text-slate-800 dark:text-[#faebd0] hover:text-amber-700 dark:hover:text-amber-300 transition-colors block"
              title="CampusFlow Main Portal"
            >
              CampusFlow
            </Link>
            <p className="text-[11px] text-slate-500 dark:text-[#9e835b]">Campus Management Platform</p>
            <p className="text-[11px] text-slate-500 dark:text-[#9e835b] mt-1">
              Designed and developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-700 dark:text-amber-400 hover:underline transition-colors"
              >
                Mr. Aditya Kumar Sah
              </a>
              {' '}•{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 dark:text-amber-600/70 hover:underline transition-colors"
              >
                Developer Portfolio
              </a>
              {' '}under the guidance of{' '}
              <a
                href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-700 dark:text-amber-400 hover:underline transition-colors"
              >
                Dr. Abhinav Kumar
              </a>
              {' '}(Assistant Professor; BCE, Bhagalpur){' '}
              <a
                href="https://drive.google.com/file/d/1UO0h626GIZf9KES1pGr7t1S-vnCu0eSo/view"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-700 dark:text-amber-400 hover:underline transition-colors"
                title="Official Order - BCE Bhagalpur"
              >
                (Official Order)
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-[11px] text-slate-500 dark:text-[#9e835b]">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span className="text-slate-300 dark:text-amber-950">&bull;</span>
            <Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              About
            </Link>
            <span className="text-slate-300 dark:text-amber-950">&bull;</span>
            <Link href="/services" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Services
            </Link>
            <span className="text-slate-300 dark:text-amber-950">&bull;</span>
            <Link href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-300 dark:text-amber-950">&bull;</span>
            <Link href="/terms-of-service" className="font-bold text-amber-800 dark:text-amber-300">
              Terms of Service
            </Link>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-[#78613f]">
            &copy; {new Date().getFullYear()} CampusFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
