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
  Eye,
  Users,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram, ProgramRegistration, ProgramStats, ProgramPaymentStatus, ProgramRegistrationStatus } from '@/types/programs';
import {
  verifyProgramPaymentAction,
  rejectProgramPaymentAction,
  updateProgramRegistrationStatusAction,
} from '@/app/admin/events/program-actions';

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
    if (!confirm('Cancel this registration?')) return;
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

  const paymentBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SUBMITTED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REJECTED': return 'bg-red-50 text-red-700 border-red-200';
      case 'NOT_REQUIRED': return 'bg-slate-50 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <Link
            href={`/admin/dashboard/events/${event.id}/programs`}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Programs
          </Link>
          <h1 className="text-lg font-bold text-slate-900">{program.name} — Registrations</h1>
          <p className="text-xs text-slate-500">
            {program.participation_type === 'TEAM' ? 'Team' : program.participation_type === 'BOTH' ? 'Individual / Team' : 'Individual'}
            {isPaid ? ` • ₹${program.registration_fee}` : ' • Free'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          <a
            href={`/api/admin/events/${event.id}/programs/${program.id}/csv`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Registrations</p>
          <p className="text-lg font-bold text-slate-900">{stats.totalRegistrations}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Participants</p>
          <p className="text-lg font-bold text-slate-900">{stats.totalParticipants}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Teams</p>
          <p className="text-lg font-bold text-slate-900">{stats.totalTeams}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Revenue</p>
          <p className="text-lg font-bold text-green-700">₹{stats.totalRevenue.toLocaleString('en-IN')}</p>
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

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="bg-white rounded-xl border-2 border-amber-300 p-4 flex items-center justify-between gap-4">
          <p className="text-xs font-semibold text-slate-700">
            {confirmAction.type === 'VERIFY' ? '✅ Confirm payment verification?' : '❌ Confirm payment rejection?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmAction.type === 'VERIFY' ? handleVerify(confirmAction.regId) : handleReject(confirmAction.regId)}
              disabled={actionLoadingId === confirmAction.regId}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${confirmAction.type === 'VERIFY' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {actionLoadingId === confirmAction.regId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </button>
            <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, email, team..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isPaid && (
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as ProgramPaymentStatus | 'ALL')} className="text-xs border border-slate-300 rounded-lg px-2 py-2">
            <option value="ALL">All Payments</option>
            <option value="PENDING">Pending</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProgramRegistrationStatus | 'ALL')} className="text-xs border border-slate-300 rounded-lg px-2 py-2">
          <option value="ALL">All Status</option>
          <option value="REGISTERED">Registered</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {(program.participation_type === 'BOTH') && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'INDIVIDUAL' | 'TEAM' | 'ALL')} className="text-xs border border-slate-300 rounded-lg px-2 py-2">
            <option value="ALL">All Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="TEAM">Team</option>
          </select>
        )}
        <span className="text-xs text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Registrations Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Reg #</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Name / Team</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Student ID</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Contact</th>
                {isPaid && <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Payment</th>}
                <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isPaid ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                    No registrations found.
                  </td>
                </tr>
              ) : (
                filtered.map((reg) => (
                  <React.Fragment key={reg.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-medium text-slate-700 whitespace-nowrap">{reg.registration_number}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {reg.registration_type === 'TEAM' ? <Users className="w-3 h-3 text-purple-500" /> : <User className="w-3 h-3 text-blue-500" />}
                          <span className="text-slate-600">{reg.registration_type}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{reg.participant_name}</p>
                            {reg.team_name && (
                              <p className="text-[10px] text-purple-600 font-medium">Team: {reg.team_name}</p>
                            )}
                          </div>
                          {reg.registration_type === 'TEAM' && reg.members && reg.members.length > 0 && (
                            <button
                              onClick={() => setExpandedRegId(expandedRegId === reg.id ? null : reg.id)}
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                              title="Show team members"
                            >
                              {expandedRegId === reg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{reg.student_id || '—'}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-slate-700 truncate max-w-[150px]">{reg.email}</p>
                        {reg.mobile && <p className="text-slate-400">{reg.mobile}</p>}
                      </td>
                      {isPaid && (
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${paymentBadge(reg.payment_status)}`}>
                            {reg.payment_status}
                          </span>
                          {reg.payment_reference && <p className="text-[10px] text-slate-400 mt-0.5">Ref: {reg.payment_reference}</p>}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          reg.registration_status === 'REGISTERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          reg.registration_status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {reg.registration_status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPaid && (reg.payment_status === 'PENDING' || reg.payment_status === 'SUBMITTED') && reg.registration_status === 'REGISTERED' && (
                            <>
                              <button
                                onClick={() => setConfirmAction({ type: 'VERIFY', regId: reg.id })}
                                disabled={actionLoadingId === reg.id}
                                className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                                title="Verify payment"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'REJECT', regId: reg.id })}
                                disabled={actionLoadingId === reg.id}
                                className="p-1 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                                title="Reject payment"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {reg.registration_status === 'REGISTERED' && (
                            <button
                              onClick={() => handleCancelRegistration(reg.id)}
                              disabled={actionLoadingId === reg.id}
                              className="p-1 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
                              title="Cancel registration"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Team Members */}
                    {expandedRegId === reg.id && reg.members && reg.members.length > 0 && (
                      <tr>
                        <td colSpan={isPaid ? 8 : 7} className="bg-purple-50/50 px-6 py-3">
                          <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-2">Team Members ({reg.members.length})</p>
                          <div className="grid gap-1.5">
                            {reg.members.map((m, idx) => (
                              <div key={m.id} className="flex items-center gap-3 text-xs text-slate-700 bg-white rounded-lg px-3 py-1.5 border border-purple-100">
                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                <span className="font-semibold">{m.member_name}</span>
                                {m.is_leader && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">LEADER</span>}
                                {m.student_id && <span className="text-slate-400">ID: {m.student_id}</span>}
                                {m.branch && <span className="text-slate-400">{m.branch}</span>}
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
  );
}
