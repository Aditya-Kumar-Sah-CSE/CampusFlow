import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { AdminHeaderSignOut } from '@/components/admin/AdminHeaderSignOut';
import { TenantSwitcher } from '@/components/admin/TenantSwitcher';
import { AdminTitleSync } from '@/components/admin/AdminTitleSync';
import { School, ShieldCheck, UserCheck, Globe } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateViewport(): Promise<Viewport> {
  const session = await getAdminSession();
  const college = session.activeCollege;
  const themeColor = college?.code === 'GEC-GAYA' ? '#1a5276' : '#0B192C';

  return {
    themeColor,
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getAdminSession();
  const college = session.activeCollege;
  const collegeName = college ? college.name : 'Institutional';
  const collegeCode = college ? college.code : 'FMS';
  const slug = college?.slug;

  const appTitle = college ? `${collegeCode} Feedback` : 'Feedback Management System';

  return {
    title: college
      ? {
          default: `${collegeCode} Feedback | Admin Dashboard`,
          template: `%s | ${collegeCode} Feedback Admin`,
        }
      : {
          absolute: 'Feedback Management System',
        },
    description: college
      ? `Administrative Console for ${collegeName} (${collegeCode}) Faculty Feedback & Evaluation Management System.`
      : 'Multi-Tenant Institutional Faculty Feedback & Evaluation Management System.',
    manifest: slug ? `/manifest.webmanifest?college=${slug}` : '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: appTitle,
    },
    applicationName: appTitle,
    icons: {
      icon: slug
        ? [
            ...(college?.logoUrl ? [{ url: college.logoUrl, sizes: 'any' }] : []),
            { url: `/api/tenant/${slug}/icon?size=192`, sizes: '192x192', type: 'image/png' },
            { url: `/api/tenant/${slug}/icon?size=512`, sizes: '512x512', type: 'image/png' },
          ]
        : [
            { url: '/favicon.ico', sizes: '32x32' },
            { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          ],
      apple: slug
        ? [
            ...(college?.logoUrl ? [{ url: college.logoUrl, sizes: '180x180' }] : []),
            { url: `/api/tenant/${slug}/icon?size=180&apple=1`, sizes: '180x180', type: 'image/png' },
          ]
        : [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session.isAuthenticated) {
    redirect('/admin/login');
  }

  if (session.isPending) {
    redirect('/admin/pending');
  }

  if (!session.isActive) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-red-800/80 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-900/50 text-red-400 mx-auto flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-xs text-slate-300">
            Your administrator account is currently marked as <strong>INACTIVE</strong> or has no institutional memberships. Please contact the Super Admin for activation.
          </p>
          <div className="pt-2">
            <AdminHeaderSignOut />
          </div>
        </div>
      </div>
    );
  }

  const isSuper = session.isPlatformSuperAdmin;
  const adminName = session.name || 'Administrator';
  const adminEmail = session.email || '';
  const activeCollege = session.activeCollege;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 w-full max-w-full overflow-x-hidden">
      <AdminTitleSync college={activeCollege} />
      {/* Admin Top Header */}
      <header className="bg-bce-navy text-white border-b border-bce-cobalt/60 shadow-md sticky top-0 z-40 w-full min-w-0">
        <div className="max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center font-bold text-sm sm:text-lg shadow-sm border border-slate-200 shrink-0 overflow-hidden p-1">
              {activeCollege?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeCollege.logoUrl}
                  alt={`${activeCollege.name} Logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-bce-cobalt to-amber-500 rounded-lg flex items-center justify-center text-amber-300">
                  <School className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-xs sm:text-base tracking-tight text-white truncate max-w-[100px] xs:max-w-[140px] sm:max-w-none">
                  {activeCollege ? activeCollege.code : 'FMS'} Feedback
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  Admin
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
                Active College: {activeCollege ? activeCollege.name : 'Select Institution'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Multi-Tenant Switcher — Super Admin only */}
            {isSuper && (
              <TenantSwitcher
                colleges={session.colleges}
                activeCollegeId={session.activeCollegeId}
                isPlatformSuperAdmin={session.isPlatformSuperAdmin}
              />
            )}
            {/* User Profile Badge */}
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">{adminName}</span>
                {isSuper ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                    <ShieldCheck className="w-3 h-3" /> Super Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500 text-white">
                    <UserCheck className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{adminEmail}</span>
            </div>

            <Link
              href={activeCollege ? `/${activeCollege.slug}` : '/'}
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700 transition-colors shrink-0"
              title="View Public Portal"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Public Portal</span>
            </Link>

            <AdminHeaderSignOut />
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 min-w-0">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-2.5 sm:px-4 sm:py-4 text-center text-xs text-slate-500 mt-auto w-full min-w-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Institutional Feedback Management System • Designed & Developed by{' '}
            <a
              href="https://portfolio-two-ashen-zseywond41.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-bce-cobalt hover:underline"
            >
              Aditya Kumar Sah
            </a>
            {' '}under the guidance of{' '}
            <a
              href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-bce-cobalt hover:underline"
            >
              Dr. Abhinav Kumar
            </a>
            {' '}(Assistant Professor)
          </span>
          <span className="truncate max-w-full">Authenticated as: <strong className="text-slate-700 font-mono">{adminEmail}</strong></span>
        </div>
      </footer>
    </div>
  );
}
