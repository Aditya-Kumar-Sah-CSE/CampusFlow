'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Users,
  Ticket,
  Trophy,
  Download,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  FolderPlus,
  ArrowLeft,
  ArrowRight,
  UsersRound,
  IndianRupee,
  Check,
  Layers,
  Settings2,
  FileText,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventCategory, EventProgram, EventProgramsStats, ProgramFormData } from '@/types/programs';
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createProgramAction,
  updateProgramAction,
  deleteProgramAction,
} from '@/app/admin/events/program-actions';
import { ExamPadClip } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  event: CollegeEvent;
  categories: EventCategory[];
  programs: EventProgram[];
  stats: EventProgramsStats;
  activeCollegeId: string;
  isSchemaReady?: boolean;
}

export function ProgramDashboard({
  event,
  categories: initialCats,
  programs: initialProgs,
  stats,
  activeCollegeId,
  isSchemaReady = true,
}: Props) {
  const [categories, setCategories] = useState(initialCats);
  const [programs, setPrograms] = useState(initialProgs);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [editingProgram, setEditingProgram] = useState<EventProgram | null>(null);
  const [toggleConfirmProgram, setToggleConfirmProgram] = useState<EventProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 2-Step Form State for Add / Edit Program
  const [programStep, setProgramStep] = useState<1 | 2>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Category form state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Program form state
  const [progName, setProgName] = useState('');
  const [progSlug, setProgSlug] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [progRules, setProgRules] = useState('');
  const [progType, setProgType] = useState<'INDIVIDUAL' | 'TEAM' | 'BOTH'>('INDIVIDUAL');
  const [progFee, setProgFee] = useState('0');
  const [progMinTeam, setProgMinTeam] = useState('');
  const [progMaxTeam, setProgMaxTeam] = useState('');
  const [progMaxParticipants, setProgMaxParticipants] = useState('');
  const [progMaxTeams, setProgMaxTeams] = useState('');
  const [progRegOpen, setProgRegOpen] = useState('');
  const [progRegClose, setProgRegClose] = useState('');
  const [progShowParticipants, setProgShowParticipants] = useState(false);
  const [progCategoryId, setProgCategoryId] = useState('');

  const showFeedbackMsg = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const autoSlug = (name: string) => {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const formatForInput = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch {
      return '';
    }
  };

  const formatToISO = (localDatetimeStr?: string) => {
    if (!localDatetimeStr || !localDatetimeStr.trim()) return undefined;
    try {
      const d = new Date(localDatetimeStr);
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString();
    } catch {
      return undefined;
    }
  };

  // STEP 1 VALIDATION FOR PROGRAM
  const handleNextProgramStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setStepError(null);

    if (!progName.trim()) {
      setStepError('Please enter the Program Name.');
      return;
    }
    if (!progSlug.trim()) {
      setStepError('Please enter a valid URL slug.');
      return;
    }
    if (!progCategoryId) {
      setStepError('Please select a Category for this program.');
      return;
    }

    setProgramStep(2);
  };

  // CATEGORY HANDLERS
  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    setLoading(true);
    const res = await createCategoryAction(event.id, { name: catName, description: catDesc }, activeCollegeId);
    if (res.success) {
      showFeedbackMsg('success', 'Category created successfully.');
      setShowCategoryForm(false);
      setCatName('');
      setCatDesc('');
      window.location.reload();
    } else {
      showFeedbackMsg('error', res.error || 'Failed to create category.');
    }
    setLoading(false);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !catName.trim()) return;
    setLoading(true);
    const res = await updateCategoryAction(editingCategory.id, { name: catName, description: catDesc }, activeCollegeId);
    if (res.success) {
      showFeedbackMsg('success', 'Category updated.');
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
      window.location.reload();
    } else {
      showFeedbackMsg('error', res.error || 'Failed to update category.');
    }
    setLoading(false);
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    setLoading(true);
    const res = await deleteCategoryAction(catId, activeCollegeId);
    if (res.success) {
      showFeedbackMsg('success', 'Category deleted.');
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } else {
      showFeedbackMsg('error', res.error || 'Failed to delete category.');
    }
    setLoading(false);
  };

  // PROGRAM HANDLERS
  const handleCreateProgram = async () => {
    if (!progName.trim() || !progSlug.trim() || !progCategoryId) {
      setStepError('Please complete required details in Step 1.');
      setProgramStep(1);
      return;
    }
    setLoading(true);
    const res = await createProgramAction(event.id, {
      name: progName,
      slug: progSlug,
      category_id: progCategoryId,
      description: progDesc,
      rules: progRules,
      participation_type: progType,
      registration_fee: Number(progFee) || 0,
      min_team_size: progMinTeam ? Number(progMinTeam) : null,
      max_team_size: progMaxTeam ? Number(progMaxTeam) : null,
      max_participants: progMaxParticipants ? Number(progMaxParticipants) : null,
      max_teams: progMaxTeams ? Number(progMaxTeams) : null,
      registration_open_at: formatToISO(progRegOpen),
      registration_close_at: formatToISO(progRegClose),
      show_public_participants: progShowParticipants,
    }, activeCollegeId);
    if (res.success) {
      showFeedbackMsg('success', 'Program created successfully.');
      setShowProgramForm(false);
      resetProgramForm();
      window.location.reload();
    } else {
      showFeedbackMsg('error', res.error || 'Failed to create program.');
    }
    setLoading(false);
  };

  const handleDeleteProgram = async (progId: string) => {
    if (!confirm('Are you sure? Programs with registrations cannot be deleted.')) return;
    setLoading(true);
    const res = await deleteProgramAction(progId, activeCollegeId);
    if (res.success) {
      showFeedbackMsg('success', 'Program deleted.');
      setPrograms((prev) => prev.filter((p) => p.id !== progId));
    } else {
      showFeedbackMsg('error', res.error || 'Failed to delete program.');
    }
    setLoading(false);
  };

  const handleToggleProgram = async (prog: EventProgram) => {
    setLoading(true);
    const nextStatus = !prog.is_active;
    const res = await updateProgramAction(prog.id, { is_active: nextStatus }, activeCollegeId);
    if (res.success) {
      setPrograms((prev) => prev.map((p) => p.id === prog.id ? { ...p, is_active: nextStatus } : p));
      showFeedbackMsg('success', `Program "${prog.name}" ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
    } else {
      showFeedbackMsg('error', res.error || 'Failed to toggle program.');
    }
    setLoading(false);
  };

  const startEditingProgram = (prog: EventProgram) => {
    setEditingCategory(null);
    setShowCategoryForm(false);
    setShowProgramForm(false);
    setEditingProgram(prog);
    setProgramStep(1);
    setStepError(null);
    setProgName(prog.name || '');
    setProgSlug(prog.slug || '');
    setProgCategoryId(prog.category_id || '');
    setProgDesc(prog.description || '');
    setProgRules(prog.rules || '');
    setProgType(prog.participation_type || 'INDIVIDUAL');
    setProgFee(String(prog.registration_fee ?? 0));
    setProgMinTeam(prog.min_team_size ? String(prog.min_team_size) : '');
    setProgMaxTeam(prog.max_team_size ? String(prog.max_team_size) : '');
    setProgMaxParticipants(prog.max_participants ? String(prog.max_participants) : '');
    setProgMaxTeams(prog.max_teams ? String(prog.max_teams) : '');
    setProgRegOpen(formatForInput(prog.registration_open_at));
    setProgRegClose(formatForInput(prog.registration_close_at));
    setProgShowParticipants(Boolean(prog.show_public_participants));

    // Scroll up smoothly to the form
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleUpdateProgram = async () => {
    if (!editingProgram || !progName.trim() || !progSlug.trim() || !progCategoryId) {
      setStepError('Please complete required details in Step 1.');
      setProgramStep(1);
      return;
    }
    setLoading(true);
    const updates: Partial<ProgramFormData> = {
      name: progName.trim(),
      slug: progSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
      category_id: progCategoryId,
      description: progDesc.trim() || undefined,
      rules: progRules.trim() || undefined,
      participation_type: progType,
      registration_fee: Number(progFee) || 0,
      min_team_size: (progType === 'TEAM' || progType === 'BOTH') && progMinTeam ? Number(progMinTeam) : null,
      max_team_size: (progType === 'TEAM' || progType === 'BOTH') && progMaxTeam ? Number(progMaxTeam) : null,
      max_participants: progMaxParticipants ? Number(progMaxParticipants) : null,
      max_teams: progMaxTeams ? Number(progMaxTeams) : null,
      registration_open_at: formatToISO(progRegOpen),
      registration_close_at: formatToISO(progRegClose),
      show_public_participants: progShowParticipants,
    };

    const res = await updateProgramAction(editingProgram.id, updates, activeCollegeId, event.id);
    if (res.success) {
      showFeedbackMsg('success', `Program "${progName}" updated successfully.`);
      const matchedCategory = categories.find((c) => c.id === progCategoryId);
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === editingProgram.id
            ? {
                ...p,
                ...updates,
                name: updates.name ?? p.name,
                slug: updates.slug ?? p.slug,
                category_id: updates.category_id ?? p.category_id,
                description: updates.description || null,
                rules: updates.rules || null,
                registration_open_at: updates.registration_open_at || null,
                registration_close_at: updates.registration_close_at || null,
                registration_fee: updates.registration_fee ?? p.registration_fee,
                show_public_participants: updates.show_public_participants ?? p.show_public_participants,
                category: matchedCategory || p.category,
              }
            : p
        )
      );
      setEditingProgram(null);
      resetProgramForm();
    } else {
      showFeedbackMsg('error', res.error || 'Failed to update program.');
    }
    setLoading(false);
  };

  const resetProgramForm = () => {
    setProgName('');
    setProgSlug('');
    setProgDesc('');
    setProgRules('');
    setProgType('INDIVIDUAL');
    setProgFee('0');
    setProgMinTeam('');
    setProgMaxTeam('');
    setProgMaxParticipants('');
    setProgMaxTeams('');
    setProgRegOpen('');
    setProgRegClose('');
    setProgShowParticipants(false);
    setProgCategoryId('');
    setEditingProgram(null);
    setProgramStep(1);
    setStepError(null);
  };

  const getParticipationLabel = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return 'Individual';
      case 'TEAM': return 'Team';
      case 'BOTH': return 'Individual / Team';
      default: return type;
    }
  };

  const getParticipationBadge = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'TEAM': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'BOTH': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  // Group programs by category
  const categorizedPrograms = categories.map((cat) => ({
    ...cat,
    programs: programs.filter((p) => p.category_id === cat.id),
  }));

  const statsConfig = [
    { label: 'Categories', value: stats.totalCategories, icon: FolderPlus, color: 'text-amber-700 dark:text-amber-400' },
    { label: 'Programs', value: stats.totalPrograms, icon: Trophy, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Registrations', value: stats.totalRegistrations, icon: Ticket, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Teams', value: stats.totalTeams, icon: UsersRound, color: 'text-amber-600 dark:text-amber-300' },
    { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header: High contrast over brick wall backdrop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-900/30 dark:border-[#4d3817]">
        <div>
          <Link
            href={`/admin/dashboard/events/${event.id}/edit`}
            className="text-xs font-semibold text-amber-200/80 hover:text-amber-100 flex items-center gap-1.5 mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-amber-100 dark:text-[#faebd0] drop-shadow-sm break-words flex items-center gap-2">
            <span>Programs — {event.title}</span>
          </h1>
          <p className="text-xs text-amber-200/80 mt-0.5">
            Manage categories, programs, registrations, and exports
          </p>
        </div>
        {event.registration_type !== 'google_form' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCategoryForm(true);
                setEditingCategory(null);
                setCatName('');
                setCatDesc('');
                setShowProgramForm(false);
                setEditingProgram(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300 rounded-lg shadow-sm border border-amber-300/80 transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-800" />
              <span>Add Category</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProgramForm(true);
                setShowCategoryForm(false);
                setEditingCategory(null);
                resetProgramForm();
              }}
              disabled={categories.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Program</span>
            </button>
          </div>
        ) : (
          <Link
            href={`/admin/dashboard/events/${event.id}/registrations`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Form Data &amp; PDF</span>
          </Link>
        )}
      </div>

      {/* Small Event Notice */}
      {event.registration_type === 'google_form' && (
        <div className="p-4 rounded-xl bg-blue-50/95 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-blue-950 dark:text-blue-200">Small Event • Direct Google Form Registration</p>
              <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                Categories and programs are not needed for this event. All submissions sync directly from Google Sheets with live PDF pass and roster generation.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/dashboard/events/${event.id}/registrations`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Open Form Responses &amp; PDF</span>
          </Link>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold border shadow-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
            : 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Database Schema Migration Warning */}
      {!isSchemaReady && (
        <div className="p-4 rounded-xl bg-amber-50/95 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 space-y-2 shadow-md">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-amber-950 dark:text-amber-100">Database Setup Required</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300 leading-relaxed">
                The program-wise event registration database tables (<code>event_categories</code>, <code>event_programs</code>, <code>program_registrations</code>) have not yet been created in your Supabase project.
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                Please run migration <code className="bg-amber-100/80 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono text-[11px]">20260930000003_event_programs_and_categories.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview: Notice Board Pinned Slips (As requested) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {statsConfig.map((s, i) => (
          <div
            key={i}
            className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden"
          >
            {/* Authentic miniature red pushpin at top center */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
            <div className="flex items-center gap-1.5 pt-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] font-bold text-amber-900/80 dark:text-amber-300/80 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-[#faebd0] break-words">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Event-wide Export Action Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <a
          href={`/api/admin/events/${event.id}/programs/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-300/80 dark:border-red-900/60 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Complete Event PDF
        </a>
        <a
          href={`/api/admin/events/${event.id}/programs/csv`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-300/80 dark:border-emerald-900/60 shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Complete Event CSV
        </a>
      </div>

      {/* ==================================================================== */}
      {/* EXAMPAD FORM 1: ADD / EDIT CATEGORY (Fill karne wala -> ExamPad)     */}
      {/* ==================================================================== */}
      {(showCategoryForm || editingCategory) && (
        <div className="exam-pad-board-dashboard rounded-2xl p-3 sm:p-4 md:p-5 pt-11 sm:pt-14 relative shadow-2xl border-2 border-[#8b6843] dark:border-[#422e1b] animate-in fade-in zoom-in-95 duration-150">
          <ExamPadClip label="EVENT CATEGORY" size="default" />
          
          {/* Brass Corner Accents */}
          <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500/70 pointer-events-none rounded-tl-xs" />
          <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500/70 pointer-events-none rounded-tr-xs" />
          <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500/70 pointer-events-none rounded-bl-xs" />
          <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500/70 pointer-events-none rounded-br-xs" />

          {/* Clamped Parchment Paper Form */}
          <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#4d3817] rounded-xl p-5 shadow-sm space-y-4 text-slate-800 dark:text-[#faebd0]">
            <div className="flex items-center justify-between pb-3 border-b border-amber-900/20 dark:border-[#4d3817]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{editingCategory ? 'Edit Event Category' : 'Create New Category'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
                  Organize and group stage events, athletics, esports, or competitions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#faebd0] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. CULTURAL, SPORTS, TECHNICAL"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Short overview for participants"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-amber-900/15 dark:border-[#4d3817]">
              <button
                type="button"
                onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-amber-200/80 hover:bg-slate-100 dark:hover:bg-[#2e2013] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                disabled={loading || !catName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EXAMPAD FORM 2: 2-STEP ADD / EDIT PROGRAM (As requested)            */}
      {/* ==================================================================== */}
      {(showProgramForm || Boolean(editingProgram)) && (
        <div className="exam-pad-board-dashboard rounded-2xl p-3 sm:p-4 md:p-5 pt-11 sm:pt-14 relative shadow-2xl border-2 border-[#8b6843] dark:border-[#422e1b] animate-in fade-in zoom-in-95 duration-150">
          <ExamPadClip label={editingProgram ? 'EDIT PROGRAM' : 'ADD PROGRAM'} size="default" />

          {/* Brass Corner Accents */}
          <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500/70 pointer-events-none rounded-tl-xs" />
          <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500/70 pointer-events-none rounded-tr-xs" />
          <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500/70 pointer-events-none rounded-bl-xs" />
          <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500/70 pointer-events-none rounded-br-xs" />

          {/* Clamped Parchment Paper Form */}
          <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#4d3817] rounded-xl p-5 shadow-sm space-y-4 text-slate-800 dark:text-[#faebd0]">
            {/* Header with Title and Mode */}
            <div className="flex items-center justify-between pb-3 border-b border-amber-900/20 dark:border-[#4d3817]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
                  {editingProgram ? (
                    <>
                      <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Edit Program: <span className="text-blue-600 dark:text-blue-400">{editingProgram.name}</span></span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Configure New Program</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-amber-200/60 mt-0.5">
                  Set up competition identity, team criteria, registration timeline &amp; rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProgramForm(false);
                  setEditingProgram(null);
                  resetProgramForm();
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-[#faebd0] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual 2-Step Stepper Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-amber-500/10 dark:bg-[#23180f] border border-amber-900/15 dark:border-[#422e1b]">
              <button
                type="button"
                onClick={() => setProgramStep(1)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  programStep === 1
                    ? 'bg-white dark:bg-[#181008] text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-900/60'
                    : 'text-slate-600 dark:text-amber-200/70 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  programStep === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-[#332214] text-slate-700 dark:text-[#faebd0]'
                }`}>
                  1
                </span>
                <span className="truncate">Core Identity &amp; Type</span>
              </button>

              <button
                type="button"
                onClick={handleNextProgramStep}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  programStep === 2
                    ? 'bg-white dark:bg-[#181008] text-blue-700 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-900/60'
                    : 'text-slate-600 dark:text-amber-200/70 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  programStep === 2
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-[#332214] text-slate-700 dark:text-[#faebd0]'
                }`}>
                  2
                </span>
                <span className="truncate">Limits, Schedule &amp; Rules</span>
              </button>
            </div>

            {/* Error Message */}
            {stepError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {/* STEP 1: Core Identity & Registration Type */}
            {programStep === 1 && (
              <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Program Name */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Program Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={progName}
                      onChange={(e) => {
                        setProgName(e.target.value);
                        if (!editingProgram && (!progSlug || progSlug === autoSlug(progName))) {
                          setProgSlug(autoSlug(e.target.value));
                        }
                      }}
                      placeholder="e.g. Cricket Tournament, Coding Hackathon"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  {/* URL Slug */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      URL Slug <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={progSlug}
                      onChange={(e) => setProgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="e.g. cricket-2026"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={progCategoryId}
                      onChange={(e) => setProgCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Participation Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Participation Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={progType}
                      onChange={(e) => setProgType(e.target.value as 'INDIVIDUAL' | 'TEAM' | 'BOTH')}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
                    >
                      <option value="INDIVIDUAL">Individual (Solo participants)</option>
                      <option value="TEAM">Team (Group roster)</option>
                      <option value="BOTH">Both (Allow Individual &amp; Teams)</option>
                    </select>
                  </div>

                  {/* Registration Fee */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Registration Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={progFee}
                      onChange={(e) => setProgFee(e.target.value)}
                      min="0"
                      step="1"
                      placeholder="0 for Free"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Step 1 configures the basic program identity. In Step 2, you will set member limits, registration window, and guidelines.
                  </span>
                </div>

                {/* Step 1 Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-amber-900/15 dark:border-[#4d3817]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProgramForm(false);
                      setEditingProgram(null);
                      resetProgramForm();
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-amber-200/80 hover:bg-slate-100 dark:hover:bg-[#2e2013] rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNextProgramStep}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <span>Next: Limits &amp; Rules</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Limits, Schedule, Description & Rules */}
            {programStep === 2 && (
              <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
                {/* Team Limits (if TEAM or BOTH) */}
                {(progType === 'TEAM' || progType === 'BOTH') && (
                  <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 space-y-2.5">
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Team Size &amp; Team Cap Settings</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#faebd0] mb-1">Min Team Size</label>
                        <input
                          type="number"
                          value={progMinTeam}
                          onChange={(e) => setProgMinTeam(e.target.value)}
                          min="1"
                          placeholder="e.g. 2"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#faebd0] mb-1">Max Team Size</label>
                        <input
                          type="number"
                          value={progMaxTeam}
                          onChange={(e) => setProgMaxTeam(e.target.value)}
                          min="1"
                          placeholder="e.g. 11"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#faebd0] mb-1">Max Teams Total</label>
                        <input
                          type="number"
                          value={progMaxTeams}
                          onChange={(e) => setProgMaxTeams(e.target.value)}
                          min="1"
                          placeholder="e.g. 32"
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Max Participants Total */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Max Total Participants <span className="text-slate-400 font-normal">(Cap)</span>
                    </label>
                    <input
                      type="number"
                      value={progMaxParticipants}
                      onChange={(e) => setProgMaxParticipants(e.target.value)}
                      min="1"
                      placeholder="e.g. 150"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Reg Open */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">Registration Opens</label>
                    <input
                      type="datetime-local"
                      value={progRegOpen}
                      onChange={(e) => setProgRegOpen(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Reg Close */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">Registration Closes</label>
                    <input
                      type="datetime-local"
                      value={progRegClose}
                      onChange={(e) => setProgRegClose(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">Description</label>
                  <textarea
                    value={progDesc}
                    onChange={(e) => setProgDesc(e.target.value)}
                    rows={2}
                    placeholder="Brief description of the program, venue, or schedule..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Rules */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">Rules &amp; Guidelines</label>
                  <textarea
                    value={progRules}
                    onChange={(e) => setProgRules(e.target.value)}
                    rows={2}
                    placeholder="Specific judging criteria, equipment needed, or event rules..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Public Participants Toggle */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-[#faebd0]">
                    <input
                      type="checkbox"
                      id="showParticipants"
                      checked={progShowParticipants}
                      onChange={(e) => setProgShowParticipants(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                    />
                    <span>Show participant roster publicly on event page</span>
                  </label>
                </div>

                {/* Step 2 Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-amber-900/15 dark:border-[#4d3817]">
                  <button
                    type="button"
                    onClick={() => setProgramStep(1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-amber-200/80 hover:bg-slate-100 dark:hover:bg-[#2e2013] rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back: Identity</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProgramForm(false);
                        setEditingProgram(null);
                        resetProgramForm();
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-slate-500 dark:text-amber-200/60 hover:bg-slate-100 dark:hover:bg-[#2e2013] rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={editingProgram ? handleUpdateProgram : handleCreateProgram}
                      disabled={loading || !progName.trim() || !progSlug.trim() || !progCategoryId}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{editingProgram ? 'Save Changes' : 'Create Program'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PROGRAM DIRECTORY & CATEGORIES: Notice Board (PinnedRosterBoard)      */}
      {/* ==================================================================== */}
      {categories.length === 0 ? (
        <div className="exam-pad-board-dashboard rounded-2xl p-8 text-center space-y-3 border-2 border-[#8b6843] dark:border-[#422e1b] shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <FolderPlus className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-amber-100 dark:text-[#faebd0] text-base">No Programs Configured Yet</h3>
          <p className="text-xs text-amber-200/80 max-w-md mx-auto">
            Start by creating categories (e.g. Sports, Cultural, Academic) and then add programs under each category.
          </p>
        </div>
      ) : (
        <PinnedRosterBoard
          title="EVENT PROGRAM DIRECTORY"
          subtitle="Categorized competition schedule, participant tallies & registration ledger"
          badge={
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-600/30">
              {programs.length} Active Items
            </span>
          }
        >
          <div className="p-4 sm:p-5 space-y-6">
            {categorizedPrograms.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-amber-900/25 dark:border-[#4d3817] bg-amber-500/5 dark:bg-[#181109]/70 overflow-hidden shadow-xs"
              >
                {/* Category Notice Ribbon Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-amber-100/90 via-amber-50/80 to-amber-100/60 dark:from-[#2e2013] dark:via-[#22170d] dark:to-[#1a1107] border-b border-amber-900/20 dark:border-[#4d3817] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Small authentic pushpin accent */}
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600 border border-red-800 shadow-xs shrink-0" />
                    <div>
                      <h2 className="text-sm font-black text-amber-950 dark:text-[#faebd0] uppercase tracking-wide flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>{cat.name}</span>
                        {!cat.is_active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full border border-red-200">
                            Inactive
                          </span>
                        )}
                        <span className="text-[11px] font-normal text-slate-500 dark:text-amber-200/60 normal-case">
                          ({cat.programs.length} program{cat.programs.length !== 1 ? 's' : ''})
                        </span>
                      </h2>
                      {cat.description && (
                        <p className="text-xs text-slate-600 dark:text-amber-200/70 mt-0.5">{cat.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(cat);
                        setCatName(cat.name);
                        setCatDesc(cat.description || '');
                        setShowCategoryForm(false);
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      className="p-1.5 rounded-lg hover:bg-amber-200/60 dark:hover:bg-[#382713] text-slate-600 dark:text-amber-200 transition-colors cursor-pointer"
                      title="Edit category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Programs Grid */}
                {cat.programs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 dark:text-amber-200/50">
                    No programs added to this category yet.
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.programs.map((prog) => (
                      <div
                        key={prog.id}
                        className={`pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1f1710]/95 p-4 space-y-3 rounded-lg border transition-all relative ${
                          editingProgram?.id === prog.id
                            ? 'border-blue-500 ring-2 ring-blue-400 shadow-md bg-blue-50/20'
                            : 'border-amber-900/25 dark:border-[#4d3817] hover:border-amber-500/60 hover:shadow-md'
                        } ${!prog.is_active ? 'opacity-65' : ''}`}
                      >
                        {/* Mini pin for realism */}
                        <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-red-500/80 pointer-events-none" />

                        {/* Title & Toggle */}
                        <div className="flex items-start justify-between gap-2 pl-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0] truncate">{prog.name}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-amber-200/60 font-mono">/{prog.slug}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setToggleConfirmProgram(prog)}
                              className="shrink-0 transition-opacity hover:opacity-80 cursor-pointer"
                              title={prog.is_active ? 'Deactivate program' : 'Activate program'}
                            >
                              {prog.is_active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getParticipationBadge(prog.participation_type)}`}>
                            {getParticipationLabel(prog.participation_type)}
                          </span>
                          {prog.registration_fee > 0 ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800">
                              ₹{prog.registration_fee}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              Free
                            </span>
                          )}
                          {(prog.participation_type === 'TEAM' || prog.participation_type === 'BOTH') && prog.min_team_size && prog.max_team_size && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              {prog.min_team_size}–{prog.max_team_size} members
                            </span>
                          )}
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-amber-500/5 dark:bg-[#140c06] border border-amber-900/10 dark:border-[#382713]">
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-[#faebd0]">{prog.registrations_count || 0}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-amber-200/60">Regs</p>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-[#faebd0]">{prog.participants_count || 0}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-amber-200/60">People</p>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-[#faebd0]">{prog.teams_count || 0}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-amber-200/60">Teams</p>
                          </div>
                        </div>

                        {/* Actions (Prominent View Registrations & Edit, as highlighted by user) */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-900/15 dark:border-[#4d3817]">
                          <Link
                            href={`/admin/dashboard/events/${event.id}/programs/${prog.id}`}
                            className="w-full sm:flex-1 text-center text-xs font-black px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all"
                          >
                            View Registrations
                          </Link>
                          <div className="flex items-center justify-between w-full sm:w-auto gap-1">
                            <button
                              type="button"
                              onClick={() => startEditingProgram(prog)}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-200 rounded-lg border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
                              title="Edit program details"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                              <span>Edit</span>
                            </button>
                            <a
                              href={`/api/admin/events/${event.id}/programs/${prog.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/40 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`/api/admin/events/${event.id}/programs/${prog.id}/csv`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 transition-colors"
                              title="Download CSV"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteProgram(prog.id)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete program"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </PinnedRosterBoard>
      )}

      {/* Confirmation Modal for Program Activate / Deactivate */}
      {toggleConfirmProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1a1208] rounded-2xl border border-slate-200 dark:border-[#4d3817] shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4 text-slate-900 dark:text-[#faebd0]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    toggleConfirmProgram.is_active
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {toggleConfirmProgram.is_active ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#faebd0]">
                    {toggleConfirmProgram.is_active ? 'Deactivate Program?' : 'Activate Program?'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-amber-200/60 font-medium mt-0.5">
                    {toggleConfirmProgram.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToggleConfirmProgram(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-[#faebd0] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-amber-200/80 leading-relaxed bg-slate-50 dark:bg-[#251b10] p-3.5 rounded-xl border border-slate-200 dark:border-[#4d3817]">
              {toggleConfirmProgram.is_active ? (
                <span>
                  Are you sure you want to deactivate <strong>{toggleConfirmProgram.name}</strong>? Students will no longer be able to register for this program while it is inactive.
                </span>
              ) : (
                <span>
                  Are you sure you want to activate <strong>{toggleConfirmProgram.name}</strong>? Students will be able to view and register for this program according to its schedule.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setToggleConfirmProgram(null)}
                className="px-3.5 py-2 border border-slate-300 dark:border-[#4d3817] hover:bg-slate-50 dark:hover:bg-[#2e2013] text-slate-700 dark:text-[#faebd0] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = toggleConfirmProgram;
                  setToggleConfirmProgram(null);
                  await handleToggleProgram(target);
                }}
                disabled={loading}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5 ${
                  toggleConfirmProgram.is_active
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {toggleConfirmProgram.is_active ? 'Yes, Deactivate' : 'Yes, Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
