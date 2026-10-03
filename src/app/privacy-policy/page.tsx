import type { Metadata } from 'next';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { Shield, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Privacy Policy | CampusFlow',
  description: 'Privacy Policy for CampusFlow detailing data collection, processing, multi-tenant isolation, event registrations, academic feedback, and Google Workspace API usage.',
};

export default function PrivacyPolicyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            <span>Legal Documentation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500">
            Last Updated: <span className="font-semibold text-slate-700">{lastUpdated}</span>
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              1. Introduction
            </h2>
            <p>
              This Privacy Policy explains how <strong>CampusFlow</strong> (&quot;CampusFlow&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;the Platform&quot;) collects, processes, stores, and protects information when administrators, faculty members, institutional staff, students, event organizers, participants, and visitors access and use our campus management platform available at{' '}
              <a href="https://143campusflow.vercel.app" className="text-blue-600 underline font-medium">
                https://143campusflow.vercel.app
              </a>.
            </p>
            <p>
              CampusFlow is a campus management platform designed for educational institutions to manage academic feedback, events, programs, registrations, participants, teams, and related institutional operations. We are committed to transparency and processing only the minimum data required to deliver these services.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              2. Information We Collect
            </h2>
            <p>
              We collect information strictly necessary for the operation of the platform. The categories of information processed include:
            </p>

            <div className="space-y-3 pl-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  A. Account & Authentication Information
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  When administrators register or sign in through Supabase Authentication, we collect:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Email address</li>
                  <li>Password (stored as a one-way cryptographic hash managed securely by Supabase Auth)</li>
                  <li>Full name or display name</li>
                  <li>Account verification timestamp and status</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  B. Institutional Membership & Role Data
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  To enforce multi-tenant authorization, we maintain records in <code>college_memberships</code>, <code>platform_admins</code>, and <code>college_admin_requests</code>, including:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Assigned institution (College ID)</li>
                  <li>Administrative role (e.g., Platform Super Admin, College Admin)</li>
                  <li>Access request submission details (applicant name, institutional email, review timestamp, approving administrator ID)</li>
                  <li>Membership state (ACTIVE, PENDING, REJECTED, INACTIVE)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  C. Academic Structure & Evaluation Records
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  To administer academic evaluations, institutions configure:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Academic years, department branches, and semesters</li>
                  <li>Faculty directory data (faculty name, employee ID, designation, department)</li>
                  <li>Subject and course catalog entries (subject name, course code)</li>
                  <li>Faculty-subject teaching assignments</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  D. Feedback Forms and Response Data
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  When feedback forms are generated and published:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Survey criteria, rating scales, and question prompts</li>
                  <li>Submission timestamps, evaluation ratings, and textual comments submitted by respondents</li>
                  <li>Associated Google Form ID, Google Sheet response destination, and Drive folder identifiers</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  E. Event &amp; Program Registration Records
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  When institutions host events, hackathons, or workshops and participants or teams register:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Participant profile and contact data (full name, email address, phone number, college registration or roll number, department/branch, and semester)</li>
                  <li>Event registration records, registration status (confirmed, pending, checked-in, waitlisted), and attendance check-in timestamps</li>
                  <li>Team registration details: team name, team leader contact information, member rosters, join request records, and invite codes</li>
                  <li>Custom registration form responses, program-specific questionnaire submissions, and payment references where applicable</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  F. Audit Logs &amp; System Activity
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  For platform integrity and accountability, administrative actions are recorded in <code>audit_logs</code>:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Action performed (e.g., user approval, access revocation, form publishing, plan changes)</li>
                  <li>Actor identity (administrator email and user ID)</li>
                  <li>Entity affected (entity type, target ID, modification summary)</li>
                  <li>Timestamp of execution</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  G. Billing &amp; Payment Information
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  When institutions purchase or renew access:
                </p>
                <ul className="list-disc list-inside text-xs sm:text-sm text-slate-600 mt-1 space-y-1">
                  <li>Requested plan, tier duration, and transaction amount</li>
                  <li>UPI transaction reference numbers submitted by the administrator</li>
                  <li>Payment confirmation screenshots uploaded by administrators to Supabase Storage</li>
                  <li>Review status and verification notes recorded by platform super administrators</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 - Google Workspace API Integration */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              3. Google Account & Google API Data
            </h2>
            <p>
              Institutions have the option to connect an institutional Google Workspace account using Google OAuth 2.0 to automate feedback form generation, response spreadsheet creation, and Drive storage.
            </p>

            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
              <p className="font-bold text-slate-900">Exact Scopes Requested by CampusFlow:</p>
              <ul className="space-y-1.5 text-slate-700">
                <li>
                  <code className="text-blue-700 font-mono text-xs">https://www.googleapis.com/auth/forms.body</code>:
                  <span className="block text-slate-600 ml-4">Used exclusively to create and configure feedback survey forms on behalf of the institution.</span>
                </li>
                <li>
                  <code className="text-blue-700 font-mono text-xs">https://www.googleapis.com/auth/forms.responses.readonly</code>:
                  <span className="block text-slate-600 ml-4">Used exclusively to read and synchronize feedback responses submitted through Google Forms back to the CampusFlow analytical database.</span>
                </li>
                <li>
                  <code className="text-blue-700 font-mono text-xs">https://www.googleapis.com/auth/spreadsheets</code>:
                  <span className="block text-slate-600 ml-4">Used to generate linked institutional response spreadsheets and record aggregated feedback data in Google Sheets.</span>
                </li>
                <li>
                  <code className="text-blue-700 font-mono text-xs">https://www.googleapis.com/auth/drive.file</code>:
                  <span className="block text-slate-600 ml-4">Used strictly to create and organize institution-specific folders and manage files specifically created by CampusFlow in Google Drive. This does NOT give access to other unrelated files in your Drive.</span>
                </li>
                <li>
                  <code className="text-blue-700 font-mono text-xs">https://www.googleapis.com/auth/userinfo.email</code> &amp; <code className="text-blue-700 font-mono text-xs">userinfo.profile</code>:
                  <span className="block text-slate-600 ml-4">Used solely to display the connected institutional account email and name in the admin console.</span>
                </li>
              </ul>
            </div>

            {/* Google Limited Use Callout */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs sm:text-sm text-amber-950">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Google API Services User Data Policy Compliance (Limited Use)</span>
              </div>
              <p>
                CampusFlow&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline font-semibold"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                <li>We do NOT sell Google user data under any circumstances.</li>
                <li>We do NOT use Google user data for serving advertisements.</li>
                <li>We do NOT use or transfer Google user data for training generalized machine learning or artificial intelligence models.</li>
                <li>Google access and refresh tokens are stored securely server-side in our database and are never transmitted to client browsers, public APIs, or third parties.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              4. How We Use Information
            </h2>
            <p>The information we collect is used strictly for the following operational purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>Authenticating administrators, faculty, and participants, and enforcing multi-tenant role permissions.</li>
              <li>Generating, publishing, and distributing institutional feedback questionnaires.</li>
              <li>Calculating statistical faculty ratings, attendance correlations, and department-level analytics.</li>
              <li>Syncing feedback responses between Google Forms/Sheets and the institutional database.</li>
              <li>Publishing and administering institutional events, hackathons, seminars, workshops, and student programs.</li>
              <li>Processing individual and team event registrations, managing team invitations and join requests, and maintaining participant rosters.</li>
              <li>Facilitating event coordination, attendee check-in verification, and registration reporting.</li>
              <li>Maintaining a tamper-evident audit trail of administrative modifications.</li>
              <li>Verifying subscription entitlements and processing manual institutional payment requests.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              5. Multi-Tenant Data Isolation &amp; Storage
            </h2>
            <p>
              CampusFlow operates as a multi-tenant platform. Data belonging to different institutions—including feedback responses, event details, participant registrations, and team records—is strictly segregated at the database layer using PostgreSQL Row Level Security (RLS) policies scoped by <code>college_id</code>.
            </p>
            <p>
              Administrators and users of Institution A cannot access, query, or view data belonging to Institution B. Google OAuth connections and credentials are saved per-institution (<code>college_google_connections</code>) and are never shared across tenants.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              6. Third-Party Service Providers
            </h2>
            <p>
              To host and deliver the platform, we utilize established cloud infrastructure providers:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>
                <strong>Supabase Inc.</strong>: Hosted PostgreSQL database, user authentication (Supabase Auth), and secure object storage for payment proofs.
              </li>
              <li>
                <strong>Vercel Inc.</strong>: Web application hosting, serverless functions, and edge delivery.
              </li>
              <li>
                <strong>Google Cloud Platform / Google Workspace APIs</strong>: OAuth 2.0 authentication, Google Forms API, Google Sheets API, and Google Drive API for form generation and response sync.
              </li>
            </ul>
            <p className="text-xs sm:text-sm text-slate-600">
              These providers process data solely on our behalf to deliver infrastructure services in accordance with their respective privacy and security agreements.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              7. Cookies and Session Technologies
            </h2>
            <p>
              CampusFlow uses essential, strictly functional cookies to manage authenticated sessions and multi-tenant routing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>
                <code>sb-*-auth-token</code>: Essential session cookies issued by Supabase Auth to maintain encrypted administrator authentication state.
              </li>
              <li>
                <code>fms_active_tenant_id</code>: Functional routing cookie storing the active college identifier selected by administrators during multi-tenant navigation.
              </li>
            </ul>
            <p className="text-xs sm:text-sm text-slate-600">
              We do not use tracking cookies, behavioral profiling cookies, or third-party advertising cookies.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              8. Data Security
            </h2>
            <p>
              We implement industry-standard technical safeguards to protect institutional records:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 pl-2">
              <li>All web traffic is transmitted via HTTPS (TLS encryption).</li>
              <li>Google OAuth state parameters are cryptographically signed with HMAC-SHA256, expire in 15 minutes, and use random cryptographic nonces to prevent CSRF and replay attacks.</li>
              <li>Sensitive Google OAuth refresh tokens and API secrets are stored exclusively server-side and never exposed to the browser.</li>
              <li>Database access is enforced through PostgreSQL Row Level Security (RLS) policies.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              9. Data Retention & Disconnection
            </h2>
            <p>
              Institutional records, forms, and responses are retained for as long as the institution maintains an active tenancy on the platform or as required for institutional accreditation and record-keeping.
            </p>
            <p>
              College administrators can disconnect their institutional Google account at any time via the <strong>Settings &rarr; Google Workspace</strong> console. Disconnecting revokes access tokens and marks the connection inactive, stopping any automated synchronization.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              10. User &amp; Administrator Rights
            </h2>
            <p>
              Institutional administrators, faculty members, students, and event participants may request information about data held by their institution. Because CampusFlow processes data under the direction of educational institutions, requests regarding academic records, survey questions, faculty data, or event registrations should be directed to the respective institution&apos;s administrative office.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              11. Changes to this Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect operational or regulatory changes. The &quot;Last Updated&quot; date at the top of this page indicates when the latest modifications were made. Continued use of the platform after updates constitutes acknowledgment of the revised policy.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              12. Contact Information
            </h2>
            <p>
              If you have any questions, concerns, or inquiries regarding this Privacy Policy or our data handling practices, you may contact the system administration team at:
            </p>
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
              <p className="font-semibold text-slate-900">CampusFlow</p>
              <p className="text-slate-600">Institutional Administration Support</p>
              <p className="text-slate-600">
                Email: <span className="font-mono text-slate-800">iambestadi@gmail.com</span>
              </p>
              <p className="text-slate-600">
                Website:{' '}
                <a href="https://143campusflow.vercel.app" className="text-blue-600 underline">
                  https://143campusflow.vercel.app
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
            <p className="text-[11px] text-slate-500">Campus Management Platform</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <Link href="/privacy-policy" className="font-bold text-slate-900">
              Privacy Policy
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/terms-of-service" className="hover:text-slate-900 transition-colors">
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
