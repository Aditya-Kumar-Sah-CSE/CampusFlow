'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Menu,
  X,
  School,
  ShieldCheck,
  UserCheck,
  LayoutDashboard,
  GraduationCap,
  FileSpreadsheet,
  Activity,
  BarChart3,
  LogOut,
  CreditCard,
  Building2,
  Settings,
  Globe,
  Calendar,
  FileCheck,
  BookOpen,
} from 'lucide-react';
import type { AdminTab } from './AdminDashboardTabs';

interface Props {
  adminName: string;
  adminEmail: string;
  isSuperAdmin: boolean;
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  pendingRequestsCount?: number;
  onSignOut: () => void;
  activeCollegeName?: string;
  publicSlug?: string;
  logoUrl?: string | null;
  allowedTabs?: AdminTab[];
}

export function AdminMobileNav({
  adminName,
  adminEmail,
  isSuperAdmin,
  activeTab,
  onSelectTab,
  pendingRequestsCount = 0,
  onSignOut,
  activeCollegeName,
  publicSlug,
  logoUrl,
  allowedTabs,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer on path or search param change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, searchParams]);

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

  const rawSections: {
    title: string;
    items: {
      id: AdminTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
    }[];
  }[] = [
    {
      title: 'Core Workflows',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'academic', label: 'Academic Structure', icon: GraduationCap },
        { id: 'forms', label: 'Feedback Forms', icon: FileSpreadsheet },
        { id: 'events', label: 'Events', icon: Calendar },
        { id: 'exams', label: 'Exams & Tests', icon: FileCheck },
        { id: 'library', label: 'Library', icon: BookOpen },
      ],
    },
    {
      title: 'Admin & Audit',
      items: [
        {
          id: 'admins',
          label: 'Admin Management',
          icon: ShieldCheck,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
        },
        { id: 'audit', label: 'Audit Trail', icon: Activity },
      ],
    },
    {
      title: 'Billing & Institution',
      items: [
        {
          id: 'billing',
          label: isSuperAdmin ? 'Billing & Access' : 'Billing & Plan',
          icon: CreditCard,
        },
        ...(isSuperAdmin
          ? [
              { id: 'institutions' as AdminTab, label: 'Campuses & Colleges', icon: Building2 },
              { id: 'google' as AdminTab, label: 'Google Workspace', icon: Globe },
            ]
          : []),
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'settings', label: 'Settings & Profile', icon: Settings },
      ],
    },
  ];

  const sections = rawSections
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => (allowedTabs ? allowedTabs.includes(item.id) : true)),
    }))
    .filter((s) => s.items.length > 0);

  const handleTabClick = (tabId: AdminTab) => {
    onSelectTab(tabId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Hamburger Trigger Button */}
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setIsOpen(true)}
        className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] bg-bce-navy text-amber-300 hover:bg-slate-900 border border-amber-400/40 shadow-xs focus:outline-hidden transition-all active:scale-95 cursor-pointer text-xs font-bold"
        aria-label="Open mobile admin navigation"
        aria-expanded={isOpen}
      >
        <Menu className="w-4 h-4 text-amber-400" />
        <span className="hidden xs:inline">Menu</span>
        {pendingRequestsCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>

      {/* Portalled Mobile Drawer Overlay */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[9999] md:hidden transition-all duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'
          }`}
          aria-hidden={!isOpen}
        >
          {/* Drawer Overlay Backdrop */}
          <div
            className={`fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation overlay"
          />

          {/* Mobile Slide-Over Drawer */}
          <aside
            id="admin-mobile-drawer"
            className={`fixed top-0 left-0 bottom-0 h-full w-[310px] max-w-[85vw] bg-bce-navy text-white z-[10000] shadow-2xl flex flex-col border-r border-bce-cobalt/60 transition-transform duration-300 ease-in-out ${
              isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ height: '100dvh' }}
          >
            {/* Drawer Header */}
            <div className="p-3.5 sm:p-4 border-b border-bce-cobalt/60 flex items-center justify-between bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-bold shadow-xs overflow-hidden p-1 shrink-0">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="College Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-bce-cobalt to-amber-500 rounded-lg flex items-center justify-center text-amber-300">
                      <School className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-xs sm:text-sm tracking-tight text-white truncate max-w-[190px]">
                    {activeCollegeName || 'Feedback Portal'}
                  </h2>
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                    Admin Console
                  </p>
                </div>
              </div>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Card inside Mobile Drawer */}
            <div className="p-3.5 sm:p-4 bg-slate-900/75 border-b border-bce-cobalt/40 space-y-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white truncate max-w-[170px]">{adminName}</span>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase bg-amber-400 text-slate-950 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> Super Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[9px] font-extrabold uppercase bg-blue-500 text-white shrink-0">
                    <UserCheck className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">{adminEmail}</p>
              {activeCollegeName && (
                <p className="text-[10px] text-amber-300/90 font-medium truncate">
                  {activeCollegeName}
                </p>
              )}
            </div>

            {/* Primary Navigation Sections */}
            <nav className="flex-1 p-3 space-y-3.5 overflow-y-auto overscroll-contain">
              {sections.map((section, sIdx) => (
                <div key={section.title || sIdx} className="space-y-1">
                  <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-amber-400/80">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          suppressHydrationWarning
                          onClick={() => handleTabClick(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-bce-cobalt text-amber-300 shadow-sm border border-amber-400/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 shrink-0 ml-2">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1.5 pb-4">
                <Link
                  href="/admin/dashboard/results"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Results &amp; Analytics Hub</span>
                  </div>
                </Link>

                <Link
                  href={publicSlug ? `/${publicSlug}` : '/'}
                  target="_blank"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>View Public Portal</span>
                </Link>
              </div>
            </nav>

            {/* Drawer Footer Actions */}
            <div className="p-3.5 sm:p-4 border-t border-bce-cobalt/60 bg-slate-950/80 shrink-0">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setIsOpen(false);
                  onSignOut();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
