'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppRouter as useRouter } from '@/lib/hooks/use-app-router';
import { createClient } from '@/lib/supabase/client';
import { OverviewTab, type DashboardCounts } from './tabs/OverviewTab';
import { AdminMobileNav } from './AdminMobileNav';
import { GoogleConnectionCard } from './GoogleConnectionCard';
import { LandingPageSettingsCard } from './LandingPageSettingsCard';
import { DataBackupCard } from './DataBackupCard';
import { AdminSessionsCard } from './AdminSessionsCard';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldCheck,
  GraduationCap,
  FileSpreadsheet,
  Activity,
  BarChart3,
  AlertCircle,
  CreditCard,
  Building2,
  Lock,
  Loader2,
  ChevronDown,
  Settings,
  Globe,
  Sliders,
  CheckCircle2,
  Calendar,
  FileCheck,
  BookOpen,
} from 'lucide-react';
import type {
  AcademicYear,
  Branch,
  Semester,
  Faculty,
  Subject,
  FacultySubjectAssignment,
  Admin,
  AdminRequest,
  FeedbackForm,
  AuditLog
} from '@/types/database';

function TabLoadingSkeleton({ title: _title }: { title?: string }) {
  return (
    <div className="bg-white dark:bg-[#1a1309] p-6 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-slate-200 dark:bg-[#20150b] rounded-[3px]" />
        <div className="h-8 w-28 bg-slate-200 dark:bg-[#20150b] rounded-[3px]" />
      </div>
      <div className="h-4 w-72 bg-slate-100 dark:bg-[#140e07] rounded-[3px]" />
      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-20 bg-slate-100 dark:bg-[#140e07] border border-amber-200/40 dark:border-[#382710] rounded-[3px]" />
        <div className="h-20 bg-slate-100 dark:bg-[#140e07] border border-amber-200/40 dark:border-[#382710] rounded-[3px]" />
        <div className="h-20 bg-slate-100 dark:bg-[#140e07] border border-amber-200/40 dark:border-[#382710] rounded-[3px]" />
      </div>
      <div className="h-64 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-amber-200/40 dark:border-[#382710]" />
    </div>
  );
}

const AcademicManagementTab = dynamic(
  () => import('./tabs/AcademicManagementTab').then((mod) => mod.AcademicManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Academic Management" />,
  }
);
const FeedbackFormsTab = dynamic(
  () => import('./tabs/FeedbackFormsTab').then((mod) => mod.FeedbackFormsTab),
  {
    loading: () => <TabLoadingSkeleton title="Feedback Forms" />,
  }
);
const AdminManagementTab = dynamic(
  () => import('./tabs/AdminManagementTab').then((mod) => mod.AdminManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Admin Management" />,
  }
);
const AuditLogsTab = dynamic(
  () => import('./tabs/AuditLogsTab').then((mod) => mod.AuditLogsTab),
  {
    loading: () => <TabLoadingSkeleton title="Audit Trail" />,
  }
);
const BillingManagementTab = dynamic(
  () => import('./tabs/BillingManagementTab').then((mod) => mod.BillingManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Billing & Access" />,
  }
);
const AdminMyBillingTab = dynamic(
  () => import('./tabs/AdminMyBillingTab').then((mod) => mod.AdminMyBillingTab),
  {
    loading: () => <TabLoadingSkeleton title="Billing & Subscription" />,
  }
);
const InstitutionsManagementTab = dynamic(
  () => import('./tabs/InstitutionsManagementTab').then((mod) => mod.InstitutionsManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Institutions" />,
  }
);
const EventsManagementTab = dynamic(
  () => import('./tabs/EventsManagementTab').then((mod) => mod.EventsManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Events Management" />,
  }
);
const ExamsTab = dynamic(
  () => import('./tabs/ExamsTab').then((mod) => mod.ExamsTab),
  {
    loading: () => <TabLoadingSkeleton title="Examinations Management" />,
  }
);
const LibraryManagementTab = dynamic(
  () => import('./tabs/LibraryManagementTab').then((mod) => mod.LibraryManagementTab),
  {
    loading: () => <TabLoadingSkeleton title="Library Management" />,
  }
);

export type AdminTab =
  | 'overview'
  | 'admins'
  | 'academic'
  | 'forms'
  | 'events'
  | 'exams'
  | 'library'
  | 'audit'
  | 'billing'
  | 'institutions'
  | 'google'
  | 'settings';

const VALID_TABS: AdminTab[] = [
  'overview',
  'admins',
  'academic',
  'forms',
  'events',
  'exams',
  'library',
  'audit',
  'billing',
  'institutions',
  'google',
  'settings',
];

interface DropdownItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  isActive?: boolean;
  onClick: () => void;
}

interface NavDropdownProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: DropdownItem[];
}

function NavDropdown({
  label,
  icon: Icon,
  badge,
  isActive,
  isOpen,
  onToggle,
  onClose,
  items,
}: NavDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        suppressHydrationWarning
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-[3px] text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer select-none active:scale-95 border ${
          isActive
            ? 'bg-bce-navy text-amber-400 border-bce-navy dark:border-amber-600/50 shadow-sm hover:bg-slate-900'
            : isOpen
            ? 'bg-slate-100 dark:bg-[#281b0f] text-slate-900 dark:text-[#faebd0] border-amber-300 dark:border-[#4d3817]'
            : 'text-slate-700 dark:text-[#faebd0] border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#22170d] hover:-translate-y-0.5'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110 text-amber-400' : 'text-slate-500 dark:text-[#c4a97d]'}`} />
        <span>{label}</span>
        {badge !== undefined && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-[2px] text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-2xs font-mono">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 ml-0.5 opacity-70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-2 min-w-[240px] sm:min-w-[260px] bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                suppressHydrationWarning
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[3px] text-xs font-semibold transition-colors text-left cursor-pointer ${
                  item.isActive
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border border-amber-200/80 dark:border-amber-700/60'
                    : 'text-slate-700 dark:text-[#faebd0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#24170c]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ItemIcon
                    className={`w-4 h-4 shrink-0 ${
                      item.isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-[#a08862]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-[2px] text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-2xs shrink-0 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  academicYears: AcademicYear[];
  branches: Branch[];
  semesters: Semester[];
  faculties: Faculty[];
  subjects: Subject[];
  assignments: FacultySubjectAssignment[];
  adminRequests: AdminRequest[];
  adminsList: Admin[];
  feedbackForms: FeedbackForm[];
  auditLogs: AuditLog[];
  isSuperAdmin: boolean;
  hasFullAnalytics?: boolean;
  currentUserEmail: string;
  currentUserName?: string;
  counts?: DashboardCounts;
  adminReqError?: string | null;
  activeCollegeId?: string;
  activeCollegeName?: string;
  activeCollegeCode?: string;
  activeCollegeSlug?: string;
  activeCollegeLogoUrl?: string | null;
  googleStatus?: {
    connected: boolean;
    status: string;
    accountEmail?: string | null;
    accountName?: string | null;
    connectedAt?: string | null;
  } | null;
  initialTab?: string;
  initialSubTab?: string;
  initialStudents?: any[];
  allColleges?: any[];
  currentUserRole?: string;
  isPrimaryAdmin?: boolean;
}

export function AdminDashboardTabs({
  academicYears,
  branches,
  semesters,
  faculties,
  subjects,
  assignments,
  adminRequests,
  adminsList,
  feedbackForms,
  auditLogs,
  isSuperAdmin,
  hasFullAnalytics = false,
  currentUserEmail,
  currentUserName,
  counts,
  adminReqError,
  activeCollegeId,
  activeCollegeName = 'Your Institution',
  activeCollegeCode,
  activeCollegeSlug,
  activeCollegeLogoUrl,
  googleStatus,
  initialTab,
  initialSubTab,
  initialStudents,
  allColleges,
  currentUserRole = 'COLLEGE_ADMIN',
  isPrimaryAdmin = false,
}: Props) {
  const searchParams = useSearchParams();

  // Granular Tab Permissions based on Admin Role
  const allowedTabs: AdminTab[] = (() => {
    if (isSuperAdmin || isPrimaryAdmin || currentUserRole === 'PRIMARY_ADMIN' || currentUserRole === 'COLLEGE_ADMIN') {
      return VALID_TABS;
    }
    if (currentUserRole === 'EVENT_COORDINATOR') {
      return ['overview', 'events', 'settings'];
    }
    if (currentUserRole === 'LIBRARIAN') {
      return ['overview', 'library', 'settings'];
    }
    if (currentUserRole === 'FEEDBACK_EXAM_COORDINATOR') {
      return ['overview', 'forms', 'exams', 'academic', 'settings'];
    }
    return ['overview', 'settings'];
  })();

  const resolveTab = useCallback((): AdminTab => {
    const param = searchParams?.get('tab');
    if (param && allowedTabs.includes(param as AdminTab)) {
      return param as AdminTab;
    }
    if (initialTab && allowedTabs.includes(initialTab as AdminTab)) {
      return initialTab as AdminTab;
    }
    return allowedTabs.includes('overview') ? 'overview' : allowedTabs[0] || 'overview';
  }, [searchParams, initialTab, allowedTabs]);

  const [activeTab, setActiveTab] = useState<AdminTab>(() => resolveTab());

  const handleSelectTab = useCallback((nextTab: AdminTab, nextSubTab?: string) => {
    if (!allowedTabs.includes(nextTab)) return;
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextTab === 'overview') {
        url.searchParams.set('tab', 'overview');
        url.searchParams.delete('subtab');
      } else {
        url.searchParams.set('tab', nextTab);
        if (nextSubTab) {
          url.searchParams.set('subtab', nextSubTab);
        } else {
          url.searchParams.delete('subtab');
        }
      }
      window.history.pushState(null, '', url.toString());
    }
  }, [allowedTabs]);

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && allowedTabs.includes(tabParam as AdminTab)) {
        setActiveTab(tabParam as AdminTab);
      } else {
        setActiveTab(resolveTab());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resolveTab, allowedTabs]);

  // Sync when searchParams change or on client navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const targetTab = (tabParam && allowedTabs.includes(tabParam as AdminTab))
      ? (tabParam as AdminTab)
      : resolveTab();

    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [resolveTab, activeTab, searchParams, allowedTabs]);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isNavigatingToResults, setIsNavigatingToResults] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
      await supabase.auth.signOut();
      router.push('/admin/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const pendingRequestsCount = adminRequests.filter((r) => r.status === 'PENDING').length;

  const directTabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'academic' as const, label: 'Academic Structure', icon: GraduationCap },
    { id: 'forms' as const, label: 'Feedback Forms', icon: FileSpreadsheet },
    { id: 'events' as const, label: 'Events', icon: Calendar },
    { id: 'exams' as const, label: 'Exams & Tests', icon: FileCheck },
    { id: 'library' as const, label: 'Library', icon: BookOpen },
  ];

  const visibleDirectTabs = directTabs.filter((tab) => allowedTabs.includes(tab.id));

  const isSettingsActive = [
    'admins',
    'audit',
    'billing',
    'institutions',
    'google',
    'settings',
  ].includes(activeTab);

  const settingsSubTabs: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    description: string;
  }[] = [
    {
      id: 'admins',
      label: 'Admin Management',
      icon: ShieldCheck,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
      description: 'Admins & access requests',
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: Activity,
      description: 'Security & activity logs',
    },
    {
      id: 'billing',
      label: isSuperAdmin ? 'Billing & Access' : 'Billing & Plan',
      icon: CreditCard,
      description: isSuperAdmin ? 'Invoices, usage & plan control' : 'Current plan & quota limits',
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'institutions' as AdminTab,
            label: 'Institutions',
            icon: Building2,
            description: 'Campuses & tenant registry',
          },
          {
            id: 'google' as AdminTab,
            label: 'Google Workspace',
            icon: Globe,
            badge: googleStatus?.connected ? 'Connected' : undefined,
            description: 'Forms & Drive integration',
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Profile & Preferences',
      icon: Settings,
      description: 'Administrator details & system info',
    },
  ];

  const visibleSettingsSubTabs = settingsSubTabs.filter((sub) => allowedTabs.includes(sub.id));

  const settingsDropdownItems: DropdownItem[] = visibleSettingsSubTabs.map((sub) => ({
    id: `settings-${sub.id}`,
    label: sub.label,
    icon: sub.icon,
    badge: sub.badge,
    isActive: activeTab === sub.id,
    onClick: () => handleSelectTab(sub.id),
  }));

  const getActiveTabTitle = (tab: AdminTab): string => {
    switch (tab) {
      case 'overview':
        return 'Overview';
      case 'academic':
        return 'Academic Structure';
      case 'forms':
        return 'Feedback Forms';
      case 'events':
        return 'Events';
      case 'exams':
        return 'Exams & Tests';
      case 'library':
        return 'Library';
      case 'admins':
        return 'Settings: Admins';
      case 'audit':
        return 'Settings: Audit';
      case 'billing':
        return isSuperAdmin ? 'Settings: Billing' : 'Settings: Plan';
      case 'institutions':
        return 'Settings: Institutions';
      case 'google':
        return 'Settings: Google';
      case 'settings':
        return 'Settings: Profile';
      default:
        return 'Overview';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {adminReqError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Failed to fetch administrator access requests</p>
            <p className="text-red-600 mt-0.5">{adminReqError}</p>
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar with Drawer Trigger */}
      <div className="md:hidden flex items-center justify-between bg-white/90 dark:bg-[#18110b]/90 backdrop-blur-md px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] shadow-sm min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold text-slate-400 dark:text-[#a08862] uppercase tracking-wider shrink-0">Tab:</span>
          <span className="text-xs font-bold text-bce-navy dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-700/60 px-2 py-0.5 rounded-[2px] truncate">
            {getActiveTabTitle(activeTab)}
          </span>
        </div>
        <AdminMobileNav
          adminName={currentUserName || currentUserEmail.split('@')[0]}
          adminEmail={currentUserEmail}
          isSuperAdmin={isSuperAdmin}
          activeTab={activeTab}
          onSelectTab={(tab) => handleSelectTab(tab)}
          pendingRequestsCount={pendingRequestsCount}
          onSignOut={handleSignOut}
          activeCollegeName={activeCollegeName}
          publicSlug={activeCollegeSlug}
          logoUrl={activeCollegeLogoUrl}
          allowedTabs={allowedTabs}
        />
      </div>

      {/* Primary Navigation Tabs (Desktop only; mobile uses the AdminMobileNav drawer above) */}
      <div className="hidden md:flex relative z-30 bg-white/90 dark:bg-[#18110b]/90 backdrop-blur-md p-1 sm:p-1.5 rounded-[3px] border border-amber-300/80 dark:border-[#4d3817] shadow-sm flex-wrap items-center gap-1 sm:gap-1.5 w-full max-w-full min-w-0 overflow-visible">
        {/* Direct Tabs: Overview, Academic Structure, Feedback Forms, Events, Exams, Library */}
        {visibleDirectTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              suppressHydrationWarning
              onClick={() => {
                handleSelectTab(tab.id);
                setOpenDropdown(null);
              }}
              className={`relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-[3px] text-xs sm:text-sm font-bold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'bg-bce-navy text-amber-400 dark:bg-amber-500 dark:text-slate-950 shadow-sm hover:bg-slate-900 dark:hover:bg-amber-400'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:-translate-y-0.5'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Settings Dropdown: Wraps Admin Management, Audit, Billing, Institution, Google, Preferences */}
        {visibleSettingsSubTabs.length > 0 && (
          <NavDropdown
            label="Settings"
            icon={Settings}
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            isActive={isSettingsActive}
            isOpen={openDropdown === 'settings'}
            onToggle={() => setOpenDropdown(openDropdown === 'settings' ? null : 'settings')}
            onClose={() => setOpenDropdown(null)}
            items={settingsDropdownItems}
          />
        )}

        {/* Results & Analytics Button: Full Access vs Locked Gate */}
        {hasFullAnalytics || isSuperAdmin ? (
          <Link
            href="/admin/dashboard/results"
            onClick={() => setIsNavigatingToResults(true)}
            className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-[3px] text-xs sm:text-sm font-bold text-slate-800 dark:text-[#faebd0] hover:text-slate-950 dark:hover:text-white bg-gradient-to-r from-amber-50 to-amber-100/80 hover:from-amber-100 hover:to-amber-200/90 dark:from-[#2a1c0e] dark:to-[#382613] dark:hover:from-[#352312] dark:hover:to-[#442e18] border border-amber-300/80 dark:border-[#5a3f1a] shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-200 shrink-0 whitespace-nowrap md:ml-auto cursor-pointer select-none"
          >
            {isNavigatingToResults ? (
              <Loader2 className="w-4 h-4 text-bce-cobalt dark:text-amber-400 animate-spin shrink-0" />
            ) : (
              <BarChart3 className="w-4 h-4 text-bce-cobalt dark:text-amber-400 group-hover:scale-110 transition-transform duration-200 shrink-0" />
            )}
            <span>{isNavigatingToResults ? 'Opening Hub...' : 'PDF & Analysis'}</span>
          </Link>
        ) : (
          <Link
            href="/admin/dashboard/results"
            onClick={() => setIsNavigatingToResults(true)}
            title="Full Analytics Access Required - Click to upgrade your plan"
            className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-[3px] text-xs sm:text-sm font-bold text-slate-600 dark:text-[#c4a97d] hover:text-slate-900 dark:hover:text-[#faebd0] bg-slate-100 dark:bg-[#1f150c] hover:bg-slate-200/80 dark:hover:bg-[#281b0f] border border-amber-400/50 dark:border-[#4d3817] hover:border-amber-400 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-200 shrink-0 whitespace-nowrap md:ml-auto cursor-pointer select-none"
          >
            <Lock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
            {isNavigatingToResults ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
            ) : (
              <BarChart3 className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span>{isNavigatingToResults ? 'Opening Hub...' : 'PDF & Analysis'}</span>
            <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-[2px] ml-0.5 uppercase tracking-wider">
              Locked
            </span>
          </Link>
        )}
      </div>

      {/* Sub-Navigation Pill Bar when inside Settings */}
      {isSettingsActive && (
        <div className="relative z-20 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar bg-slate-100/90 dark:bg-[#1a1309] p-1.5 rounded-[3px] border border-slate-200/80 dark:border-[#382710] shadow-xs w-full max-w-full">
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
            {settingsSubTabs.map((sub) => {
              const SubIcon = sub.icon;
              const isCurrent = activeTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => handleSelectTab(sub.id)}
                  className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer select-none ${
                    isCurrent
                      ? 'bg-white dark:bg-[#281b0f] text-bce-navy dark:text-amber-300 shadow-xs border border-slate-200/80 dark:border-amber-600/50'
                      : 'text-slate-600 dark:text-[#c4a97d] hover:text-slate-900 dark:hover:text-[#faebd0] hover:bg-white/60 dark:hover:bg-[#20150b]'
                  }`}
                >
                  <SubIcon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isCurrent ? 'text-bce-cobalt dark:text-amber-400 font-extrabold' : 'text-slate-400 dark:text-[#8f754c]'
                    }`}
                  />
                  <span>{sub.label}</span>
                  {sub.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-[2px] text-[9px] font-extrabold bg-amber-500 text-slate-950 shadow-2xs font-mono">
                      {sub.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 pr-2 text-[11px] text-slate-500 dark:text-[#a08862] font-semibold">
            <span>Settings Section</span>
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <div className="relative w-full max-w-full min-w-0">
        {activeTab === 'overview' && (
          <OverviewTab
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
            assignments={assignments}
            adminRequests={adminRequests}
            feedbackForms={feedbackForms}
            auditLogs={auditLogs}
            isSuperAdmin={isSuperAdmin}
            onNavigateTab={(tab, subtab) => handleSelectTab(tab as AdminTab, subtab)}
            counts={counts}
          />
        )}

        {activeTab === 'admins' && (
          <AdminManagementTab
            adminRequests={adminRequests}
            adminsList={adminsList}
            isSuperAdmin={isSuperAdmin}
            isPrimaryAdmin={isPrimaryAdmin}
            currentUserRole={currentUserRole}
            currentUserEmail={currentUserEmail}
            initialSubTab={initialSubTab}
            initialStudents={initialStudents}
            allColleges={allColleges}
            activeCollegeId={activeCollegeId}
            activeCollegeName={activeCollegeName}
          />
        )}

        {activeTab === 'academic' && (
          <AcademicManagementTab
            key={activeCollegeId || 'no-tenant'}
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
            assignments={assignments}
            initialFacultyTotal={counts?.totalFaculties}
            initialSubjectTotal={counts?.totalSubjects}
            initialAssignmentTotal={counts?.totalAssignments}
            activeCollegeId={activeCollegeId}
            initialSubTab={initialSubTab}
          />
        )}

        {activeTab === 'forms' && (
          <FeedbackFormsTab
            feedbackForms={feedbackForms}
            academicYears={academicYears}
            branches={branches}
            semesters={semesters}
            faculties={faculties}
            subjects={subjects}
            initialSubTab={initialSubTab}
          />
        )}

        {activeTab === 'events' && (
          <EventsManagementTab activeCollegeId={activeCollegeId} />
        )}

        {activeTab === 'exams' && (
          <ExamsTab activeCollegeId={activeCollegeId} initialSubTab={initialSubTab} />
        )}

        {activeTab === 'library' && (
          <LibraryManagementTab activeCollegeId={activeCollegeId} />
        )}

        {activeTab === 'audit' && (
          <AuditLogsTab auditLogs={auditLogs} />
        )}

        {activeTab === 'billing' && (
          isSuperAdmin ? (
            <BillingManagementTab currentUserEmail={currentUserEmail} />
          ) : (
            <AdminMyBillingTab />
          )
        )}

        {activeTab === 'institutions' && isSuperAdmin && (
          <InstitutionsManagementTab />
        )}

        {activeTab === 'google' && isSuperAdmin && (
          <div className="space-y-6">
            <ExamPadCard
              variant="dashboard"
              title="Google Workspace Integration"
              subtitle="Connect your institutional Google account for automatic Google Form generation, Drive folder synchronization, and real-time response ingestion."
              badge={activeCollegeName || 'All Institutions'}
              icon={<Globe className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            />

            {activeCollegeId ? (
              <div className="space-y-6">
                <GoogleConnectionCard
                  collegeId={activeCollegeId}
                  collegeName={activeCollegeName || 'Your Institution'}
                  status={{
                    connected: Boolean(googleStatus?.connected),
                    status: googleStatus?.status || 'NOT_CONNECTED',
                    accountEmail: googleStatus?.accountEmail,
                    accountName: googleStatus?.accountName,
                    connectedAt: googleStatus?.connectedAt,
                  }}
                />
                <DataBackupCard
                  collegeId={activeCollegeId}
                  collegeName={activeCollegeName || 'Your Institution'}
                  isSuperAdmin={isSuperAdmin}
                  googleConnected={Boolean(googleStatus?.connected)}
                  googleAccountEmail={googleStatus?.accountEmail}
                />
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-[#20150b] border border-amber-200 dark:border-amber-700/60 p-6 rounded-[3px] text-amber-900 dark:text-[#faebd0] text-xs space-y-2">
                <p className="font-bold text-sm text-amber-950 dark:text-amber-300">No Active Institution Selected</p>
                <p className="text-amber-800 dark:text-[#c4a97d]">
                  Google Workspace integrations are scoped to individual institutions. Please switch to a specific college using the tenant switcher in the top navigation bar to configure or review its Google Workspace connection.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 w-full max-w-4xl">
            {/* Settings Header */}
            <ExamPadCard
              variant="dashboard"
              title="System & Account Settings"
              subtitle="View configuration details, administrator profile, and active tenant context."
              badge="PREFERENCES"
              icon={<Settings className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            />

            <PinnedRosterBoard
              title="Institutional Administrator & Context Roster"
              subtitle="Current operational credentials, tenant scoping, and authorization level."
              badge="AUTHENTICATED"
              icon={<ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />}
            >
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Admin Profile */}
                <div className="bg-white dark:bg-[#1a1309] p-5 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#a08862] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Administrator Profile
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">Name</span>
                      <span className="font-semibold text-slate-900 dark:text-[#faebd0]">{currentUserName || currentUserEmail.split('@')[0] || 'System Administrator'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">Email</span>
                      <span className="font-mono text-slate-900 dark:text-[#faebd0]">{currentUserEmail}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">System Role</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-[2px] text-[11px] ${
                          isSuperAdmin
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-700/60'
                            : currentUserRole === 'PRIMARY_ADMIN' || isPrimaryAdmin
                            ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : currentUserRole === 'EVENT_COORDINATOR'
                            ? 'bg-pink-100 text-pink-900 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800'
                            : currentUserRole === 'LIBRARIAN'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : currentUserRole === 'FEEDBACK_EXAM_COORDINATOR'
                            ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800'
                        }`}
                      >
                        {isSuperAdmin
                          ? 'Platform Super Admin'
                          : currentUserRole === 'PRIMARY_ADMIN' || isPrimaryAdmin
                          ? 'Primary College Admin'
                          : currentUserRole === 'EVENT_COORDINATOR'
                          ? 'Event Coordinator'
                          : currentUserRole === 'LIBRARIAN'
                          ? 'Librarian'
                          : currentUserRole === 'FEEDBACK_EXAM_COORDINATOR'
                          ? 'Feedback & Exam Coordinator'
                          : 'College Admin'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500 dark:text-[#a08862]">Account Status</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Active &amp; Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tenant Context */}
                <div className="bg-white dark:bg-[#1a1309] p-5 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#a08862] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Active Tenant Context
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">Current College</span>
                      <span className="font-semibold text-slate-900 dark:text-[#faebd0] text-right">{activeCollegeName || 'None Selected'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">College Code</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-[#faebd0]">{activeCollegeCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-amber-100 dark:border-[#2a1d0f]">
                      <span className="text-slate-500 dark:text-[#a08862]">Tenant Isolation</span>
                      <span className="font-semibold text-slate-900 dark:text-[#faebd0]">PostgreSQL RLS Scoped</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500 dark:text-[#a08862]">Google Sync</span>
                      <span className="font-semibold text-slate-900 dark:text-[#faebd0]">
                        {googleStatus?.connected ? (
                          <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Connected
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-[#a08862]">Not Configured</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </PinnedRosterBoard>

            {/* Active Platform & Device Sessions Section */}
            <AdminSessionsCard />

            {/* Production Data Backup Section */}
            {activeCollegeId && (
              <DataBackupCard
                collegeId={activeCollegeId}
                collegeName={activeCollegeName || 'Active Institution'}
                isSuperAdmin={isSuperAdmin}
                googleConnected={Boolean(googleStatus?.connected)}
                googleAccountEmail={googleStatus?.accountEmail}
              />
            )}

            {/* Public Landing Page Display Management for Super Admin */}
            {isSuperAdmin && activeCollegeId && activeCollegeSlug && (
              <LandingPageSettingsCard
                collegeId={activeCollegeId}
                collegeName={activeCollegeName || 'Active Institution'}
                collegeSlug={activeCollegeSlug}
                isSuperAdmin={isSuperAdmin}
              />
            )}

            {/* Platform Information */}
            <div className="bg-white dark:bg-[#1a1309] p-5 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#a08862] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
                System Architecture &amp; Preferences
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#20150b] rounded-[3px] border border-slate-200/80 dark:border-[#382710]">
                  <p className="text-[10px] text-slate-500 dark:text-[#a08862] font-bold uppercase">Multi-Tenant Engine</p>
                  <p className="font-bold text-slate-800 dark:text-[#faebd0] mt-1">Tenant Scoped RLS</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">Strict schema-level security</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#20150b] rounded-[3px] border border-slate-200/80 dark:border-[#382710]">
                  <p className="text-[10px] text-slate-500 dark:text-[#a08862] font-bold uppercase">Analytics Engine</p>
                  <p className="font-bold text-slate-800 dark:text-[#faebd0] mt-1">{hasFullAnalytics ? 'Unlocked (Full)' : 'Tier Restricted'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">Statistical processing</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#20150b] rounded-[3px] border border-slate-200/80 dark:border-[#382710]">
                  <p className="text-[10px] text-slate-500 dark:text-[#a08862] font-bold uppercase">Platform Version</p>
                  <p className="font-bold text-slate-800 dark:text-[#faebd0] mt-1">CampusFlow</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#c4a97d] mt-0.5">Next.js 15 + Supabase</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
