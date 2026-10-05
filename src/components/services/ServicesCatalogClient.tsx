'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  QrCode,
  Building2,
  Sliders,
  Smartphone,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Users,
  Search,
  Send,
  Lock,
} from 'lucide-react';

export type ServiceCategory =
  | 'All'
  | 'Feedback'
  | 'Events'
  | 'Registration'
  | 'Institution'
  | 'Integrations';

export interface ServiceItem {
  id: string;
  title: string;
  category: 'Feedback' | 'Events' | 'Registration' | 'Institution' | 'Integrations';
  description: string;
  keywords: string[];
  route: string;
  actionText: string;
  icon: React.ElementType;
}

const SERVICES: ServiceItem[] = [
  {
    id: 'feedback-core',
    title: 'Institutional Feedback',
    category: 'Feedback',
    description: 'Structured course and faculty feedback collection across academic branches.',
    keywords: ['Feedback Forms', 'Faculty Evaluation', 'Course Evaluation', 'Reports'],
    route: '/feedback',
    actionText: 'Explore Feedback',
    icon: GraduationCap,
  },
  {
    id: 'feedback-lifecycle',
    title: 'Feedback Forms Lifecycle',
    category: 'Feedback',
    description: 'Create, schedule, publish, and close feedback forms with rating questions.',
    keywords: ['Draft Forms', 'Published Forms', 'Closed Window', 'Active Surveys'],
    route: '/feedback',
    actionText: 'Browse Active Forms',
    icon: Send,
  },
  {
    id: 'faculty-eval',
    title: 'Faculty & Academic Evaluation',
    category: 'Feedback',
    description: 'Map evaluations directly to faculty members, subjects, and semesters.',
    keywords: ['Faculties', 'Subjects', 'Semesters', 'Performance Scores'],
    route: '/feedback',
    actionText: 'View Evaluation Portals',
    icon: Users,
  },
  {
    id: 'google-forms-api',
    title: 'Google Forms Integration',
    category: 'Integrations',
    description: 'Automated form generation through Google Workspace Forms API.',
    keywords: ['Google Forms', 'API Sync', 'Question Builder', 'Survey Automation'],
    route: '/about',
    actionText: 'Read Integration Details',
    icon: FileSpreadsheet,
  },
  {
    id: 'google-sheets-sync',
    title: 'Google Sheets Synchronization',
    category: 'Integrations',
    description: 'Sync responses directly from linked Google Sheets into CampusFlow.',
    keywords: ['Google Sheets', 'Response Ingestion', 'Sheet ID Linking', 'Data Collation'],
    route: '/about',
    actionText: 'View Sync Specifications',
    icon: FileSpreadsheet,
  },
  {
    id: 'google-drive-sync',
    title: 'Google Drive Storage',
    category: 'Integrations',
    description: 'Centralized document storage and folder permission management.',
    keywords: ['Google Drive', 'Folder Permissions', 'Document Storage', 'Workspace Service'],
    route: '/about',
    actionText: 'Read Drive Setup',
    icon: FileSpreadsheet,
  },
  {
    id: 'events-fests',
    title: 'Campus Events & Fests',
    category: 'Events',
    description: 'Publish institutional events, fests, and technical workshops with schedules.',
    keywords: ['Event Publishing', 'Categories', 'Guidelines', 'Schedule Timelines'],
    route: '/events',
    actionText: 'Browse Events Hub',
    icon: Calendar,
  },
  {
    id: 'sub-programs',
    title: 'Competitions & Sub-Programs',
    category: 'Events',
    description: 'Manage distinct programs within an event with specific rules and fees.',
    keywords: ['Sub-Programs', 'Solo & Team', 'Competition Rules', 'Fee Tracking'],
    route: '/events',
    actionText: 'View Program Schedules',
    icon: Calendar,
  },
  {
    id: 'student-registration',
    title: 'Student Event Registration',
    category: 'Registration',
    description: 'Self-service student registration with academic validation and payment tracking.',
    keywords: ['Registration', 'Roll Number', 'Branch & Semester', 'Payment Status'],
    route: '/events',
    actionText: 'Open Event Registration',
    icon: Users,
  },
  {
    id: 'team-registration',
    title: 'Team & Group Registration',
    category: 'Registration',
    description: 'Create teams, generate shareable join codes, and manage rosters.',
    keywords: ['Team Formation', 'Join Codes', 'Team Leader', 'Max Team Size'],
    route: '/events',
    actionText: 'Inspect Team Enrollment',
    icon: Users,
  },
  {
    id: 'digital-passes',
    title: 'Digital Passes & ID Cards',
    category: 'Registration',
    description: 'Instant digital passes generated upon registration verification.',
    keywords: ['Pass Card', 'PNG Download', 'Identity Pass', 'Attendee QR'],
    route: '/events',
    actionText: 'Check Pass Formats',
    icon: QrCode,
  },
  {
    id: 'qr-verification',
    title: 'QR Gate Verification',
    category: 'Registration',
    description: 'Live on-site verification portal for gate security and organizers.',
    keywords: ['QR Verification', 'Live Scanner', 'Status Check', 'Gate Check-in'],
    route: '/events',
    actionText: 'View Gate Scanner',
    icon: QrCode,
  },
  {
    id: 'event-reports',
    title: 'Event Reports & Data Exports',
    category: 'Events',
    description: 'Server-side PDF reports and CSV exports for participant rosters and attendance.',
    keywords: ['PDFKit', 'CSV Export', 'Attendance Sheet', 'Roster PDF'],
    route: '/events',
    actionText: 'See Export Capabilities',
    icon: FileText,
  },
  {
    id: 'college-portals',
    title: 'Institution Profiles & Portals',
    category: 'Institution',
    description: 'Dedicated slug-based portals with customized college crest and links.',
    keywords: ['College Portal', 'Slug Routing', 'Website Link', 'Institution Directory'],
    route: '/',
    actionText: 'Select Institution',
    icon: Building2,
  },
  {
    id: 'college-branding',
    title: 'College Branding & Colors',
    category: 'Institution',
    description: 'College logos, custom primary/secondary branding, and contact metadata.',
    keywords: ['Branding', 'Official Logos', 'University Affiliation', 'Theme Colors'],
    route: '/',
    actionText: 'Explore Brand Profiles',
    icon: Building2,
  },
  {
    id: 'academic-hierarchy',
    title: 'Academic Hierarchy Management',
    category: 'Institution',
    description: 'Manage branches, semesters, subjects, and teaching faculty assignments.',
    keywords: ['Branches', 'Semesters', 'Subjects', 'Teaching Assignments'],
    route: '/admin/login',
    actionText: 'Admin Governance',
    icon: Sliders,
  },
  {
    id: 'admin-governance',
    title: 'Super Admin & College Admin',
    category: 'Institution',
    description: 'Role-based administrative dashboards for institutional governance.',
    keywords: ['Admin Login', 'Role-Based Access', 'Access Requests', 'Management'],
    route: '/admin/login',
    actionText: 'Open Admin Console',
    icon: Lock,
  },
  {
    id: 'pwa-twa',
    title: 'Progressive Web App (PWA)',
    category: 'Integrations',
    description: 'Installable mobile web app with per-college shortcuts and TWA packages.',
    keywords: ['PWA', 'Install Prompt', 'TWA Android', 'Offline Shell'],
    route: '/',
    actionText: 'PWA Distribution',
    icon: Smartphone,
  },
];

const CATEGORIES: ServiceCategory[] = [
  'All',
  'Feedback',
  'Events',
  'Registration',
  'Institution',
  'Integrations',
];

export function ServicesCatalogClient() {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    return SERVICES.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Category Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Category Pills */}
        <div
          role="tablist"
          aria-label="Filter services by category"
          className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'All'
                ? SERVICES.length
                : SERVICES.filter((s) => s.category === cat).length;

            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 shrink-0 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:max-w-xs shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search modules or keywords..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-blue-500 transition-colors"
            aria-label="Search modules or keywords"
          />
        </div>
      </div>

      {/* Services Count Banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-900 font-semibold">{filteredServices.length}</strong> of {SERVICES.length} verified modules
        </span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-blue-600 hover:underline"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Services Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredServices.map((service) => {
          const Icon = service.icon;
          const isExpanded = expandedCardId === service.id;

          return (
            <article
              key={service.id}
              id={service.id}
              onClick={() => setExpandedCardId(isExpanded ? null : service.id)}
              className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer"
            >
              <div className="space-y-2.5">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {service.category}
                  </span>
                </div>

                {/* Title & 1-line description */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                {/* Keywords Chips */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {service.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/70 font-medium group-hover:border-slate-300 transition-colors"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Action Link */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={service.route}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors focus:outline-hidden focus:underline"
                >
                  <span>{service.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <span className="text-[10px] text-slate-400 font-mono">Module</span>
              </div>
            </article>
          );
        })}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12 p-6 bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <p className="font-semibold text-slate-800 text-sm">No modules matched your filter</p>
          <p className="text-xs">Try selecting a different category or clearing the search query.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
