import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllActiveColleges } from '@/lib/tenant/resolver';
import { CollegeGrid } from '@/components/public/CollegeGrid';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'CampusFlow | Institutions',
  description: 'Choose your institution to access institutional feedback, events, and campus management services.',
};

export default async function HomePage() {
  // Query only active colleges from public.colleges
  const colleges = await getAllActiveColleges();

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Responsive Navbar */}
      <RootPublicNavbar />

      {/* 2. Main Content (College selector grid) */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* 3. College Grid */}
        <CollegeGrid colleges={colleges} />
      </main>

      {/* 4. Minimal Platform Footer */}
      <footer className="bg-white dark:bg-[#120b07]/95 border-t border-slate-200 dark:border-amber-950/60 text-xs text-slate-500 dark:text-slate-400 py-4 px-2.5 sm:px-4 sm:py-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <Link
              href="/"
              className="font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-amber-400 hover:underline transition-colors block"
              title="CampusFlow Main Portal"
            >
              CampusFlow
            </Link>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Campus Management Platform</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Designed and developed by{' '}
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 dark:text-amber-400 hover:text-blue-800 dark:hover:text-amber-300 hover:underline transition-colors"
              >
                Mr. Aditya Kumar Sah
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
              {' '}(Assistant Professor; BCE, Bhagalpur){' '}
              <a
                href="https://drive.google.com/file/d/1UO0h626GIZf9KES1pGr7t1S-vnCu0eSo/view"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                title="Official Order - BCE Bhagalpur"
              >
                (Official Order)
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-[11px] text-slate-500">
            <Link href="/about" className="hover:text-slate-900 transition-colors">
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
