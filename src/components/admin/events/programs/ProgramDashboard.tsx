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
  ChevronRight,
  Edit3,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  FolderPlus,
  ArrowLeft,
  UserPlus,
  UsersRound,
  IndianRupee,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      // Refresh by reloading
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
    if (!progName.trim() || !progSlug.trim() || !progCategoryId) return;
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
    const res = await updateProgramAction(prog.id, { is_active: !prog.is_active }, activeCollegeId);
    if (res.success) {
      setPrograms((prev) => prev.map((p) => p.id === prog.id ? { ...p, is_active: !p.is_active } : p));
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
    if (!editingProgram || !progName.trim() || !progSlug.trim() || !progCategoryId) return;
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
      case 'INDIVIDUAL': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'TEAM': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'BOTH': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Group programs by category
  const categorizedPrograms = categories.map((cat) => ({
    ...cat,
    programs: programs.filter((p) => p.category_id === cat.id),
  }));

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <Link
            href={`/admin/dashboard/events/${event.id}/edit`}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Event
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Programs — {event.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage categories, programs, registrations, and exports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCategoryForm(true); setEditingCategory(null); setCatName(''); setCatDesc(''); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-200 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Add Category
          </button>
          <button
            onClick={() => { setShowProgramForm(true); resetProgramForm(); }}
            disabled={categories.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Add Program
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-medium border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Database Schema Migration Warning */}
      {!isSchemaReady && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-amber-950">Database Setup Required</p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                The program-wise event registration database tables (<code>event_categories</code>, <code>event_programs</code>, <code>program_registrations</code>) have not yet been created in your Supabase project.
              </p>
              <p className="mt-1 text-amber-700">
                Please run migration <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">20260930000003_event_programs_and_categories.sql</code> in your Supabase SQL Editor to enable creating categories and programs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Categories', value: stats.totalCategories, icon: FolderPlus, color: 'text-slate-600' },
          { label: 'Programs', value: stats.totalPrograms, icon: Trophy, color: 'text-blue-600' },
          { label: 'Registrations', value: stats.totalRegistrations, icon: Ticket, color: 'text-emerald-600' },
          { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-purple-600' },
          { label: 'Teams', value: stats.totalTeams, icon: UsersRound, color: 'text-amber-600' },
          { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-green-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Event-wide Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={`/api/admin/events/${event.id}/programs/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Complete Event PDF
        </a>
        <a
          href={`/api/admin/events/${event.id}/programs/csv`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Complete Event CSV
        </a>
      </div>

      {/* Category Form Modal */}
      {(showCategoryForm || editingCategory) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. SPORTS, CULTURAL"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={loading || !catName.trim()}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCategory ? 'Update Category' : 'Create Category'}
            </button>
            <button
              onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Program Form Modal (Create or Edit) */}
      {(showProgramForm || Boolean(editingProgram)) && (
        <div className={`bg-white rounded-2xl border ${editingProgram ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-slate-200'} p-5 shadow-sm space-y-4`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {editingProgram ? (
                  <>
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Edit Program: <span className="text-blue-600">{editingProgram.name}</span></span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Add New Program</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingProgram
                  ? 'Modify program configuration, participation rules, limits, and fees.'
                  : 'Configure a new competition, match, or stage activity under an event category.'}
              </p>
            </div>
            {editingProgram && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full shrink-0">
                Editing Mode
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Program Name *</label>
              <input
                type="text"
                value={progName}
                onChange={(e) => {
                  setProgName(e.target.value);
                  if (!editingProgram && (!progSlug || progSlug === autoSlug(progName))) {
                    setProgSlug(autoSlug(e.target.value));
                  }
                }}
                placeholder="e.g. Cricket, Debate"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug *</label>
              <input
                type="text"
                value={progSlug}
                onChange={(e) => setProgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. cricket"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={progCategoryId}
                onChange={(e) => setProgCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Participation Type *</label>
              <select
                value={progType}
                onChange={(e) => setProgType(e.target.value as 'INDIVIDUAL' | 'TEAM' | 'BOTH')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="TEAM">Team</option>
                <option value="BOTH">Both (Individual & Team)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Fee (₹)</label>
              <input
                type="number"
                value={progFee}
                onChange={(e) => setProgFee(e.target.value)}
                min="0"
                step="1"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(progType === 'TEAM' || progType === 'BOTH') && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Team Size</label>
                  <input type="number" value={progMinTeam} onChange={(e) => setProgMinTeam(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Team Size</label>
                  <input type="number" value={progMaxTeam} onChange={(e) => setProgMaxTeam(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Teams</label>
                  <input type="number" value={progMaxTeams} onChange={(e) => setProgMaxTeams(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Participants</label>
              <input type="number" value={progMaxParticipants} onChange={(e) => setProgMaxParticipants(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Opens</label>
              <input type="datetime-local" value={progRegOpen} onChange={(e) => setProgRegOpen(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Closes</label>
              <input type="datetime-local" value={progRegClose} onChange={(e) => setProgRegClose(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea value={progDesc} onChange={(e) => setProgDesc(e.target.value)} rows={2} placeholder="Brief description of the program" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rules</label>
              <textarea value={progRules} onChange={(e) => setProgRules(e.target.value)} rows={2} placeholder="Program rules and guidelines" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="showParticipants" checked={progShowParticipants} onChange={(e) => setProgShowParticipants(e.target.checked)} className="rounded" />
              <label htmlFor="showParticipants" className="text-xs font-semibold text-slate-700">Show participants publicly</label>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={editingProgram ? handleUpdateProgram : handleCreateProgram}
              disabled={loading || !progName.trim() || !progSlug.trim() || !progCategoryId}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : editingProgram ? (
                'Save Changes'
              ) : (
                'Create Program'
              )}
            </button>
            <button
              onClick={() => {
                setShowProgramForm(false);
                setEditingProgram(null);
                resetProgramForm();
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <FolderPlus className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-900">No Programs Configured Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Start by creating categories (e.g. Sports, Cultural) and then add programs under each category.
          </p>
        </div>
      )}

      {/* Categories + Programs */}
      {categorizedPrograms.map((cat) => (
        <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Category Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                {cat.name}
                {!cat.is_active && <span className="text-[10px] font-medium px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Inactive</span>}
              </h2>
              {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setEditingCategory(cat); setCatName(cat.name); setCatDesc(cat.description || ''); setShowCategoryForm(false); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                title="Edit category"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                title="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Programs Grid */}
          {cat.programs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No programs in this category yet.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
              {cat.programs.map((prog) => (
                <div
                  key={prog.id}
                  className={`bg-white p-4 space-y-3 rounded-xl border transition-all ${
                    editingProgram?.id === prog.id
                      ? 'border-blue-500 ring-2 ring-blue-400 shadow-md bg-blue-50/20'
                      : 'border-slate-100 hover:border-slate-200'
                  } ${!prog.is_active ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{prog.name}</h3>
                      <p className="text-[10px] text-slate-400 font-mono">/{prog.slug}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEditingProgram(prog)}
                        className="p-1 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit program"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleProgram(prog)}
                        className="shrink-0"
                        title={prog.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {prog.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getParticipationBadge(prog.participation_type)}`}>
                      {getParticipationLabel(prog.participation_type)}
                    </span>
                    {prog.registration_fee > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        ₹{prog.registration_fee}
                      </span>
                    )}
                    {prog.registration_fee === 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                        Free
                      </span>
                    )}
                    {(prog.participation_type === 'TEAM' || prog.participation_type === 'BOTH') && prog.min_team_size && prog.max_team_size && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                        {prog.min_team_size}–{prog.max_team_size} members
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{prog.registrations_count || 0}</p>
                      <p className="text-[10px] text-slate-500">Regs</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{prog.participants_count || 0}</p>
                      <p className="text-[10px] text-slate-500">People</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{prog.teams_count || 0}</p>
                      <p className="text-[10px] text-slate-500">Teams</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <Link
                      href={`/admin/dashboard/events/${event.id}/programs/${prog.id}`}
                      className="flex-1 text-center text-[10px] font-semibold px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                    >
                      View Registrations
                    </Link>
                    <button
                      onClick={() => startEditingProgram(prog)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
                      title="Edit program details"
                    >
                      <Edit3 className="w-3 h-3 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <a
                      href={`/api/admin/events/${event.id}/programs/${prog.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                    <a
                      href={`/api/admin/events/${event.id}/programs/${prog.id}/csv`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                      title="Download CSV"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => handleDeleteProgram(prog.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete program"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
