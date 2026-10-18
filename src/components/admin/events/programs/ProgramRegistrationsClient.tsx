'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Users,
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  IndianRupee,
  Ticket,
  UsersRound,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram, ProgramRegistration, ProgramStats, ProgramPaymentStatus, ProgramRegistrationStatus } from '@/types/programs';
import {
  verifyProgramPaymentAction,
  rejectProgramPaymentAction,
  updateProgramRegistrationStatusAction,
} from '@/app/admin/events/program-actions';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  event: CollegeEvent;
  program: EventProgram;
  registrations: ProgramRegistration[];
  stats: ProgramStats;
  activeCollegeId: string;
}

export function ProgramRegistrationsClient({ event, program, registrations: initialRegs, stats, activeCollegeId }: Props) {
  const [registrations, setRegistrations] = useState(initialRegs);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<ProgramPaymentStatus | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ProgramRegistrationStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'INDIVIDUAL' | 'TEAM' | 'ALL'>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'VERIFY' | 'REJECT'; regId: string } | null>(null);

  const isPaid = event.payment_required && program.registration_fee > 0;

  const showFeedbackMsg = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filter
  const filtered = registrations.filter((r) => {
    if (paymentFilter !== 'ALL' && r.payment_status !== paymentFilter) return false;
    if (statusFilter !== 'ALL' && r.registration_status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && r.registration_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.participant_name?.toLowerCase().includes(q) ||
        r.registration_number?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.student_id?.toLowerCase().includes(q) ||
        r.team_name?.toLowerCase().includes(q) ||
        r.mobile?.includes(q) ||
        r.payment_reference?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleVerify = async (regId: string) => {
    setActionLoadingId(regId);
    const res = await verifyProgramPaymentAction(regId, activeCollegeId);
    if (res.success) {
      setRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, payment_status: 'VERIFIED' as ProgramPaymentStatus } : r));
      showFeedbackMsg('success', 'Payment verified.');
    } else {
      showFeedbackMsg('error', res.error || 'Failed to verify.');
    }
    setActionLoadingId(null);
    setConfirmAction(null);
  };

  const handleReject = async (regId: string) => {
    setActionLoadingId(regId);
    const res = await rejectProgramPaymentAction(regId, activeCollegeId);
    if (res.success) {
      setRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, payment_status: 'REJECTED' as ProgramPaymentStatus } : r));
      showFeedbackMsg('success', 'Payment rejected.');
    } else {
      showFeedbackMsg('error', res.error || 'Failed to reject.');
    }
    setActionLoadingId(null);
    setConfirmAction(null);
  };

  const handleCancelRegistration = async (regId: string) => {
    if (!confirm('Are you sure you want to cancel this registration?')) return;
    setActionLoadingId(regId);
    const res = await updateProgramRegistrationStatusAction(regId, 'CANCELLED', activeCollegeId);
    if (res.success) {
      setRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, registration_status: 'CANCELLED' as ProgramRegistrationStatus } : r));
      showFeedbackMsg('success', 'Registration cancelled.');
    } else {
      showFeedbackMsg('error', res.error || 'Failed to cancel.');
    }
    setActionLoadingId(null);
  };

  const paymentBadge = (status: ProgramPaymentStatus) => {
    switch (status) {
      case 'VERIFIED': return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'SUBMITTED': return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'PENDING': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'REJECTED': return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default: return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const statsConfig = [
    { label: 'Registrations', value: stats.totalRegistrations, icon: Ticket, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Teams', value: stats.totalTeams, icon: UsersRound, color: 'text-amber-600 dark:text-amber-300' },
    { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header: High contrast over stone wall */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-900/30 dark:border-[#4d3817]">
        <div>
          <Link
            href={`/admin/dashboard/events/${event.id}/programs`}
            className="text-xs font-semibold text-amber-200/80 hover:text-amber-100 flex items-center gap-1.5 mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Programs
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-amber-100 dark:text-[#faebd0] drop-shadow-sm break-words flex items-center gap-2">
            <span>{program.name} — Registrations</span>
          </h1>
          <p className="text-xs text-amber-200/80 mt-0.5">
            {program.participation_type === 'TEAM' ? 'Team Competition' : program.participation_type === 'BOTH' ? 'Individual / Team' : 'Individual Participation'}
            {isPaid ? ` • ₹${program.registration_fee} Fee` : ' • Free Entry'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-300/80 dark:border-red-900/60 shadow-sm transition-all"
            title="Download Complete Participants Report (Consolidated)"
          >
            <Download className="w-3.5 h-3.5" /> All Participants PDF
          </a>
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/teams/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-300/80 dark:border-indigo-900/60 shadow-sm transition-all"
            title="Download All Teams Roster"
          >
            <Users className="w-3.5 h-3.5" /> All Teams PDF
          </a>
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/individuals/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-lg border border-sky-300/80 dark:border-sky-900/60 shadow-sm transition-all"
            title="Download Individual Participants Only"
          >
            <User className="w-3.5 h-3.5" /> Individuals PDF
          </a>
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/csv`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#fffdfa]/90 dark:bg-[#1f1710] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-300/80 dark:border-emerald-900/60 shadow-sm transition-all"
            title="Export CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </a>
        </div>
      </div>

      {/* Stats Overview: Notice Board Pinned Slips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {statsConfig.map((s, i) => (
          <div
            key={i}
            className="pinned-paper-sheet bg-[#fffdfa]/95 dark:bg-[#1a1208]/95 border border-amber-900/30 dark:border-[#4d3817] rounded-[4px] p-3 space-y-1 relative shadow-sm hover:shadow-md transition-all group overflow-hidden"
          >
            {/* Authentic miniature red pushpin */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 border border-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.4)] pointer-events-none" />
            <div className="flex items-center gap-1.5 pt-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] font-bold text-amber-900/80 dark:text-amber-300/80 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-[#faebd0] break-words">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold border shadow-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
            : 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="bg-[#fffdfa] dark:bg-[#1f1710] rounded-xl border-2 border-amber-400 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-lg text-slate-800 dark:text-[#faebd0]">
          <p className="text-xs font-bold">
            {confirmAction.type === 'VERIFY' ? '✅ Confirm payment verification for this participant?' : '❌ Confirm payment rejection?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmAction.type === 'VERIFY' ? handleVerify(confirmAction.regId) : handleReject(confirmAction.regId)}
              disabled={actionLoadingId === confirmAction.regId}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg text-white cursor-pointer shadow-xs ${
                confirmAction.type === 'VERIFY' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {actionLoadingId === confirmAction.regId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 dark:bg-[#2e2013] text-slate-700 dark:text-[#faebd0] hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Registrations Roster: Notice Board Table */}
      <PinnedRosterBoard
        title={`${program.name} — REGISTRATION ROSTER`}
        subtitle="Verified student participant list, team compositions, payment references and pass status"
        badge={
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-600/30">
            {filtered.length} of {registrations.length} Records
          </span>
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID, email, team..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#251b10] border border-slate-300 dark:border-[#4d3817] rounded-lg text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isPaid && (
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as ProgramPaymentStatus | 'ALL')}
                  className="flex-1 sm:flex-none text-xs border border-slate-300 dark:border-[#4d3817] rounded-lg px-2.5 py-2 bg-white dark:bg-[#251b10] text-slate-900 dark:text-[#faebd0] font-semibold cursor-pointer"
                >
                  <option value="ALL">All Payments</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              )}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProgramRegistrationStatus | 'ALL')}
                className="flex-1 sm:flex-none text-xs border border-slate-300 dark:border-[#4d3817] rounded-lg px-2.5 py-2 bg-white dark:bg-[#251b10] text-slate-900 dark:text-[#faebd0] font-semibold cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="REGISTERED">Registered</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REJECTED">Rejected</option>
              </select>
              {program.participation_type === 'BOTH' && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'INDIVIDUAL' | 'TEAM' | 'ALL')}
                  className="flex-1 sm:flex-none text-xs border border-slate-300 dark:border-[#4d3817] rounded-lg px-2.5 py-2 bg-white dark:bg-[#251b10] text-slate-900 dark:text-[#faebd0] font-semibold cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="TEAM">Team</option>
                </select>
              )}
            </div>
          </div>

          {/* Registrations Table */}
          <div className="rounded-xl border border-amber-900/20 dark:border-[#4d3817] overflow-hidden bg-white dark:bg-[#1f1710] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="bg-amber-500/10 dark:bg-[#281b10] border-b border-amber-900/20 dark:border-[#4d3817]">
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Reg #</th>
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Type</th>
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Name / Team</th>
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Student ID</th>
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Contact</th>
                    {isPaid && <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Payment</th>}
                    <th className="text-left px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Status</th>
                    <th className="text-right px-3.5 py-3 font-bold text-amber-950 dark:text-[#faebd0]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/10 dark:divide-[#382713]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isPaid ? 8 : 7} className="px-4 py-8 text-center text-slate-400 dark:text-amber-200/50">
                        No registrations matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg) => (
                      <React.Fragment key={reg.id}>
                        <tr className="hover:bg-amber-500/5 dark:hover:bg-[#261b11] transition-colors">
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-800 dark:text-[#faebd0] whitespace-nowrap">
                            {reg.registration_number}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="inline-flex items-center gap-1.5 font-bold">
                              {reg.registration_type === 'TEAM' ? (
                                <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              )}
                              <span className="text-slate-700 dark:text-slate-300">{reg.registration_type}</span>
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-[#faebd0] truncate">{reg.participant_name}</p>
                                {reg.team_name && (
                                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Team: {reg.team_name}</p>
                                )}
                              </div>
                              {reg.registration_type === 'TEAM' && reg.members && reg.members.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedRegId(expandedRegId === reg.id ? null : reg.id)}
                                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#382713] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                  title="Show team members"
                                >
                                  {expandedRegId === reg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300 font-medium">{reg.student_id || '—'}</td>
                          <td className="px-3.5 py-3">
                            <p className="text-slate-800 dark:text-slate-200 truncate max-w-[150px] font-medium">{reg.email}</p>
                            {reg.mobile && <p className="text-[11px] text-slate-400 dark:text-amber-200/50">{reg.mobile}</p>}
                          </td>
                          {isPaid && (
                            <td className="px-3.5 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${paymentBadge(reg.payment_status)}`}>
                                {reg.payment_status}
                              </span>
                              {reg.payment_reference && (
                                <p className="text-[10px] text-slate-400 dark:text-amber-200/50 mt-0.5 font-mono">Ref: {reg.payment_reference}</p>
                              )}
                            </td>
                          )}
                          <td className="px-3.5 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              reg.registration_status === 'REGISTERED' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                              reg.registration_status === 'CANCELLED' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' :
                              'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}>
                              {reg.registration_status}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {reg.registration_type === 'TEAM' && (
                                <a
                                  href={`/api/admin/events/${event.id}/programs/${program.id}/pdf?teamId=${encodeURIComponent(reg.team_name || reg.registration_number)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800 transition-colors"
                                  title={`Download Team PDF for ${reg.team_name || 'Team'}`}
                                >
                                  <FileText className="w-3 h-3" />
                                  <span className="hidden sm:inline">Team PDF</span>
                                </a>
                              )}
                              {isPaid && (reg.payment_status === 'PENDING' || reg.payment_status === 'SUBMITTED') && reg.registration_status === 'REGISTERED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'VERIFY', regId: reg.id })}
                                    disabled={actionLoadingId === reg.id}
                                    className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-600 transition-colors cursor-pointer"
                                    title="Verify payment"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'REJECT', regId: reg.id })}
                                    disabled={actionLoadingId === reg.id}
                                    className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-950/60 text-red-500 transition-colors cursor-pointer"
                                    title="Reject payment"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {reg.registration_status === 'REGISTERED' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRegistration(reg.id)}
                                  disabled={actionLoadingId === reg.id}
                                  className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-500 transition-colors cursor-pointer"
                                  title="Cancel registration"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Team Members Drawer */}
                        {expandedRegId === reg.id && reg.members && reg.members.length > 0 && (
                          <tr>
                            <td colSpan={isPaid ? 8 : 7} className="bg-purple-50/40 dark:bg-purple-950/20 px-6 py-3 border-t border-purple-100 dark:border-purple-900/40">
                              <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                                Team Members ({reg.members.length})
                              </p>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {reg.members.map((m, idx) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-[#faebd0] bg-white dark:bg-[#251b10] rounded-lg px-3 py-1.5 border border-purple-100 dark:border-purple-900/50 shadow-xs"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[10px] font-black shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="font-bold">{m.member_name}</span>
                                    {m.is_leader && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700">
                                        LEADER
                                      </span>
                                    )}
                                    {m.student_id && <span className="text-slate-400 dark:text-amber-200/50 text-[11px]">ID: {m.student_id}</span>}
                                    {m.branch && <span className="text-slate-400 dark:text-amber-200/50 text-[11px]">({m.branch})</span>}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PinnedRosterBoard>
    </div>
  );
}
