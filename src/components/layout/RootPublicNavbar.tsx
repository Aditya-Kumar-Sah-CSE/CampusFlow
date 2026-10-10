'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ArrowRight,
  Building2,
  ChevronRight,
  Bell,
  Info,
  Layers,
} from 'lucide-react';
import { getMyTeamInvitationsAction } from '@/app/events/invitations/actions';
import { getCampusFlowBrand } from '@/lib/tenant/campusflow-brand';
import { StudentStatusBadge } from '@/components/auth/StudentStatusBadge';
import { useStudentSession } from '@/lib/auth/use-student-session';

export function RootPublicNavbar({ eventId, tenantCode }: { eventId?: string; tenantCode?: string | null } = {}) {
  const brand = getCampusFlowBrand({ code: tenantCode });
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [unreadInvitations, setUnreadInvitations] = useState(0);
  const { isAuthenticated } = useStudentSession();

  useEffect(() => {
    if (!eventId) { setUnreadInvitations(0); return; }
    getMyTeamInvitationsAction(eventId).then(result => setUnreadInvitations(result.success ? result.unreadCount || 0 : 0));
  }, [eventId, pathname]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto w-full px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left: Platform Identity */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 group focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-xl"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-xs border border-slate-800/10 shrink-0 group-hover:scale-105 transition-transform bg-slate-900 flex items-center justify-center p-1">
              <img src="/icon-192.png" alt="CampusFlow Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <span className="block text-xs sm:text-base font-bold tracking-tight text-slate-900 truncate max-w-[190px] xs:max-w-[240px] sm:max-w-none group-hover:text-blue-700 transition-colors">
                {brand.displayName}
              </span>
              <span className="block text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[190px] xs:max-w-[240px] sm:max-w-none">
                Campus Management Platform
              </span>
            </div>
          </Link>

          {/* Right: Desktop Links */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
            <Link
              href="/about"
              className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                pathname === '/about'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              About
            </Link>
            <Link
              href="/services"
              className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                pathname === '/services'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Services
            </Link>
            {eventId && <Link href={`/events/invitations?eventId=${encodeURIComponent(eventId)}`} aria-label="Team invitation notifications" className="relative rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-800"><Bell className="h-4 w-4"/>{unreadInvitations > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-violet-700 px-1 text-center text-[9px] font-bold text-white">{unreadInvitations}</span>}</Link>}
            <StudentStatusBadge compact={true} adminLoginUrl="/admin/login" />
            {!isAuthenticated && (
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-full shadow-2xs transition-all shrink-0 active:scale-98"
              >
                <span>Super Admin Login</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            )}
          </div>

          {/* Right: Mobile Hamburger & Login */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {eventId && <Link href={`/events/invitations?eventId=${encodeURIComponent(eventId)}`} aria-label="Team invitation notifications" className="relative rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-800"><Bell className="h-4 w-4"/>{unreadInvitations > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-violet-700 px-1 text-center text-[9px] font-bold text-white">{unreadInvitations}</span>}</Link>}
            <StudentStatusBadge compact={true} adminLoginUrl="/admin/login" />
            {!isAuthenticated && (
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors"
              >
                <span>Admin</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <aside className="fixed inset-y-0 right-0 w-full max-w-[300px] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 ease-out border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center p-0.5">
                  <img src="/icon-192.png" alt="CampusFlow Logo" className="w-full h-full object-contain rounded-md" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{brand.displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">Institutional System</p>
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

            {/* Drawer Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Navigation
                </p>

                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Select Institution</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>

                <Link
                  href="/about"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    pathname === '/about' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>About CampusFlow</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>

                <Link
                  href="/services"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    pathname === '/services' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Platform Services</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>

              {/* Student Portal Card */}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Student Account
                </p>
                <StudentStatusBadge compact={false} />
              </div>

              {/* Super Admin Login Card */}
              <div className="pt-2">
                <Link
                  href="/admin/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm hover:from-slate-800 hover:to-slate-700 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center p-0.5">
                      <img src="/icon-192.png" alt="CampusFlow Logo" className="w-full h-full object-contain rounded-md" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">Super Admin Login</p>
                      <p className="text-[10px] text-slate-300">Access platform administration</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-400 text-center space-y-1">
              <p className="font-semibold text-slate-600">{brand.displayName}</p>
              <p>Designed and developed by Mr. Aditya Kumar Sah</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
