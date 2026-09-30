import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { FileText } from 'lucide-react';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Terms of Service | CampusFlow',
  description: 'Terms of Service for CampusFlow governing institutional access, administrator responsibilities, Google Workspace integrations, and platform usage.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'September 23, 2026';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Header */}
      <RootPublicNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-14">
        {/* Title & Metadata Banner */}
        <div className="border-b border-slate-200 pb-4 sm:pb-6 mb-5 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Use</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500">
            Last Updated: <span className="font-semibold text-slate-700">{lastUpdated}</span>
          </p>
        </div>

        {/* Terms Body */}
        <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, or using the <strong>CampusFlow</strong> (&quot;CampusFlow&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;) hosted at{' '}
              <a href="https://feedback-management-system-kappa.vercel.app" className="text-blue-600 underline font-medium">
                https://feedback-management-system-kappa.vercel.app
              </a>, you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree with these Terms, you must not access or use the Platform.
            </p>
            <p>
              These Terms apply to all users of the Platform, including institutional administrators, faculty members, staff, students, and visitors.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              2. Description of the Service
            </h2>
            <p>
              CampusFlow is a multi-tenant web-based SaaS platform designed for higher education institutions, engineering colleges, and academic departments to manage, automate, and analyze institutional feedback. Core features include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>Academic hierarchy management (branches, semesters, subjects, faculties, and teaching assignments).</li>
              <li>Feedback form creation, scheduling, and distribution.</li>
              <li>Google Workspace automation (Google Forms, Google Sheets, and Google Drive folder synchronization).</li>
              <li>Statistical response aggregation, faculty performance metrics, and department reports.</li>
              <li>Multi-tenant role-based access control and audit logging.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              3. Institutional Accounts &amp; Administrator Responsibilities
            </h2>
            <p>
              Institutional accounts are created by or on behalf of recognized colleges and academic organizations. Administrator responsibilities include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>
                <strong>Authorization:</strong> Administrators must be authorized representatives of the college or university for which they request access.
              </li>
              <li>
                <strong>Credential Security:</strong> Administrators are responsible for safeguarding their login credentials and for all activities that occur under their account.
              </li>
              <li>
                <strong>Accurate Records:</strong> Administrators are responsible for the accuracy of faculty directories, courses, assignments, and survey configurations entered into their tenant portal.
              </li>
              <li>
                <strong>Access Management:</strong> Administrators must promptly review, approve, or revoke access requests for departmental administrators within their institution.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              4. Google Workspace Integrations &amp; Permissions
            </h2>
            <p>
              Institutions may optionally link an institutional Google Workspace account using Google OAuth 2.0 to enable automatic feedback form generation and response synchronization. By connecting a Google account, the institution agrees that:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>The connecting administrator has full authority to authorize CampusFlow to access the institution&apos;s Google Workspace services.</li>
              <li>CampusFlow will request access to Google Forms (to create forms and read responses), Google Sheets (to sync response spreadsheets), Google Drive (to manage CampusFlow-specific files and folders via <code>drive.file</code>), and basic profile information.</li>
              <li>CampusFlow strictly adheres to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline font-medium"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </li>
              <li>Institutions may disconnect their Google account at any time through the admin settings. Disconnecting revokes tokens and suspends automated Google synchronization.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              5. Institutional Data &amp; Content Ownership
            </h2>
            <p>
              The institution retains all ownership rights, title, and interest in and to its institutional data, including faculty lists, course catalogs, survey questionnaires, student evaluation responses, and generated reports.
            </p>
            <p>
              CampusFlow claims no intellectual property ownership over institutional content. By uploading or generating data on the Platform, the institution grants CampusFlow a limited, non-exclusive license strictly to host, process, store, and display the data as required to provide the Platform services.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              6. Acceptable Use Policy
            </h2>
            <p>You agree not to use the Platform to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>Violate any applicable local, state, national, or international law.</li>
              <li>Attempt to gain unauthorized access to any accounts, computer systems, or networks connected to CampusFlow or another institution&apos;s tenant data.</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform or third-party APIs.</li>
              <li>Distribute malware, spam, phishing links, or fraudulent surveys.</li>
              <li>Submit fabricated, fraudulent, or counterfeit payment verification records.</li>
              <li>Attempt to reverse engineer, decompile, or extract the source code of the Platform infrastructure without authorization.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              7. Subscription, Billing &amp; Plan Entitlements
            </h2>
            <p>
              CampusFlow offers institutional subscription tiers and trial periods for access to features such as advanced statistical analytics, extended response history, and automated syncing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>Subscription requests are submitted via manual UPI payment confirmation and reviewed by platform administrators.</li>
              <li>Subscriptions grant access for the specific duration and college tenancy authorized upon payment verification.</li>
              <li>Access may be locked or reverted to free/standard tier upon expiration of an active trial or subscription period.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              8. Service Availability &amp; Modifications
            </h2>
            <p>
              We strive to ensure continuous availability of the Platform. However, access may occasionally be interrupted or restricted for scheduled maintenance, system updates, server migrations, or external network failures beyond our control.
            </p>
            <p>
              We reserve the right to modify, enhance, or discontinue any feature of the Platform with reasonable notice where feasible.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              9. Account Suspension &amp; Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate access to the Platform for any administrator or institution that violates these Terms, submits fraudulent payment proofs, attempts cross-tenant unauthorized data access, or engages in unauthorized activity.
            </p>
            <p>
              Upon termination, institutional access to the admin dashboard is revoked, and any active Google Workspace synchronization will be halted.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              10. Disclaimers &amp; Limitation of Liability
            </h2>
            <p>
              THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, CAMPUSFLOW AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR ACADEMIC RECORDS ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE PLATFORM.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              11. Changes to these Terms
            </h2>
            <p>
              We may revise these Terms of Service periodically. When revisions occur, the &quot;Last Updated&quot; date at the top of this document will be updated. Your continued use of the Platform following any changes indicates your agreement to the new Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              12. Contact Information
            </h2>
            <p>
              For any questions, legal inquiries, or notices regarding these Terms of Service, please contact the administration team at:
            </p>
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
              <p className="font-semibold text-slate-900">CampusFlow</p>
              <p className="text-slate-600">Institutional Administration Team</p>
              <p className="text-slate-600">
                Email: <span className="font-mono text-slate-800">iambestadi@gmail.com</span>
              </p>
              <p className="text-slate-600">
                Platform:{' '}
                <a href="https://feedback-management-system-kappa.vercel.app" className="text-blue-600 underline">
                  https://feedback-management-system-kappa.vercel.app
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-6 px-4 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="font-semibold text-slate-700">CampusFlow</p>
            <p className="text-[11px] text-slate-500">Institutional Feedback Platform</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <Link href="/privacy-policy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/terms-of-service" className="font-bold text-slate-900">
              Terms of Service
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
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
