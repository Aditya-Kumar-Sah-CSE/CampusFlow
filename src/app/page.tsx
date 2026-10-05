import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllActiveColleges } from '@/lib/tenant/resolver';
import { CollegeGrid } from '@/components/public/CollegeGrid';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'CampusFlow | Select Your College',
  description: 'Choose your institution to access institutional feedback, events, and campus management services.',
};

export default async function HomePage() {
  // Query only active colleges from public.colleges
  const colleges = await getAllActiveColleges();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. Responsive Navbar */}
      <RootPublicNavbar />

      {/* 2. Main Content (Centered, generous whitespace, college selector) */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-14">
          <span className="inline-block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/60 rounded-full px-3 py-1 mb-3">
            Institution Portal
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            Select Your College
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600">
            Choose your institution to access institutional feedback, events, and campus management portals.
          </p>
        </div>

        {/* 3. College Grid */}
        <CollegeGrid colleges={colleges} />
      </main>

      {/* 4. Minimal Platform Footer */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-4 px-2.5 sm:px-4 sm:py-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
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
              Designed & Developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Aditya Kumar Sah
              </a>
              {' '}•{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 hover:underline transition-colors"
              >
                Developer Portfolio
              </a>
              {' '}under the guidance of{' '}
              <a
                href="https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Dr. Abhinav Kumar
              </a>
              {' '}(Assistant Professor)
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
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
