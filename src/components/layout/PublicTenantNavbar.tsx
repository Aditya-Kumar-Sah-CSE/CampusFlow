'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  School,
  FileText,
  Ticket,
  UserCheck,
  ShieldCheck,
  Building2,
  ChevronRight,
  Home,
  GraduationCap,
} from 'lucide-react';
import type { TenantContext } from '@/types/tenant';
import { CollegeInstallButton } from '@/components/pwa/CollegeInstallButton';
import { getCampusFlowBrand } from '@/lib/tenant/campusflow-brand';

export interface PublicTenantNavbarProps {
  tenant: TenantContext;
  currentPage?: 'home' | 'feedback' | 'feedback-detail' | 'events' | 'event-detail' | 'exams' | 'exam-detail';
  backUrl?: string;
  backLabel?: string;
  hideAnonymousBadge?: boolean;
}

export function PublicTenantNavbar({
  tenant,
  currentPage = 'home',
}: PublicTenantNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const showFeedbacks = tenant.showFeedbacks !== false;
  const showEvents = tenant.showEvents !== false;

  const isFeedbackActive = currentPage === 'feedback' || currentPage === 'feedback-detail';
  const isEventsActive = currentPage === 'events' || currentPage === 'event-detail';
  const isExamsActive = currentPage === 'exams' || currentPage === 'exam-detail';
  const brand = getCampusFlowBrand(tenant);

  return (
    <>
      {/* Fixed Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left: Brand & Identity */}
          <Link
            href={`/${tenant.slug}`}
            className="flex items-center gap-2 sm:gap-3 min-w-0 group focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-xl"
            title={`${brand.displayName} · ${tenant.name} Home`}
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center font-bold text-base sm:text-xl shadow-xs border border-slate-200/90 shrink-0 overflow-hidden p-1 group-hover:border-slate-300 transition-colors">
              {tenant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logo}
                  alt={`${tenant.name} Logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className="w-full h-full rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: tenant.branding.primaryColor || '#0B192C' }}
                >
                  <School className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="text-xs sm:text-base font-bold tracking-tight text-slate-900 truncate max-w-[170px] xs:max-w-[210px] sm:max-w-[320px] md:max-w-[400px] lg:max-w-none group-hover:text-blue-700 transition-colors">
                {brand.displayName}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[170px] xs:max-w-[210px] sm:max-w-[320px] md:max-w-[400px] lg:max-w-none">
                <span className="hidden sm:inline">{tenant.name}</span>
              </p>
            </div>
          </Link>

          {/* Right: Desktop Navigation Items */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {showFeedbacks && (
              <Link
                href={`/${tenant.slug}/feedback`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  isFeedbackActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Browse All Forms</span>
              </Link>
            )}

            {showEvents && (
              <Link
                href={`/${tenant.slug}/events`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  isEventsActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200/80'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Events</span>
              </Link>
            )}

            <Link
              href={`/${tenant.slug}/exams`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                isExamsActive
                  ? 'bg-bce-navy text-amber-300 border-bce-navy shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
              <span>Exams</span>
            </Link>

            <Link
              href={`/${tenant.slug}/admin/login`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shrink-0 active:scale-98"
            >
              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Faculty / Admin</span>
            </Link>
          </div>

          {/* Right: Mobile Hamburger Trigger */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <Link
              href={`/${tenant.slug}/admin/login`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
              title="Faculty / Admin Login"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xs:inline">Login</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-public-nav"
            >
              {isOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer & Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            id="mobile-public-nav"
            className="fixed inset-y-0 right-0 w-full max-w-[310px] sm:max-w-sm bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 ease-out border-l border-slate-200"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200 p-0.5 shrink-0 flex items-center justify-center">
                  {tenant.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tenant.logo}
                      alt={tenant.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <School className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{brand.displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{tenant.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors focus:outline-hidden"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Navigation
                </p>

                {/* Home */}
                <Link
                  href={`/${tenant.slug}`}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    currentPage === 'home'
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Home className="w-4 h-4 text-blue-600" />
                    <span>Portal Home</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>

                {/* Feedback Forms */}
                {showFeedbacks && (
                  <Link
                    href={`/${tenant.slug}/feedback`}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isFeedbackActive
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Browse All Forms</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {/* Events */}
                {showEvents && (
                  <Link
                    href={`/${tenant.slug}/events`}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isEventsActive
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Ticket className="w-4 h-4 text-blue-600" />
                      <span>Upcoming Events</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                )}

                {/* Exams & Tests */}
                <Link
                  href={`/${tenant.slug}/exams`}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isExamsActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    <span>Examinations &amp; Tests</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>

              {/* Login Action Card */}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Staff &amp; Administration
                </p>
                <Link
                  href={`/${tenant.slug}/admin/login`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm hover:from-slate-800 hover:to-slate-700 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">Faculty &amp; Admin Login</p>
                      <p className="text-[10px] text-slate-300">Manage forms, results &amp; events</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>

              {/* Privacy & Utilities */}
              <div className="pt-2 space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Utilities
                </p>

                <div className="px-2">
                  <CollegeInstallButton tenant={tenant} className="w-full justify-center py-2 text-xs" />
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[11px]">100% Anonymous Feedback</p>
                    <p className="text-[10px] text-emerald-800 mt-0.5 leading-relaxed">
                      Student identity is never tracked, recorded, or tied to feedback submissions.
                    </p>
                  </div>
                </div>

                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select Another College</span>
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-400 text-center space-y-1">
              <p className="font-semibold text-slate-600">{brand.displayName}</p>
              <p>Secure Institutional Evaluation Platform</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
