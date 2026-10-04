'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  FileSpreadsheet,
  Eye,
  Loader2,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { CollegeEvent, EventRegistration, EventStats, EventPaymentStatus, EventRegistrationStatus } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import {
  verifyProgramPaymentSheetAction,
  rejectProgramPaymentSheetAction,
  updateProgramRegStatusSheetAction,
} from '@/app/admin/events/event-registration-actions';

interface Props {
  event: CollegeEvent;
  initialRegistrations: EventRegistration[];
  initialStats: EventStats;
  branches: Branch[];
  semesters: Semester[];
  activeCollegeId?: string;
}

export function EventRegistrationsClient({
  event,
  initialRegistrations,
  initialStats,
  branches,
  semesters,
  activeCollegeId,
}: Props) {
  const [registrations, setRegistrations] = useState<EventRegistration[]>(initialRegistrations);
  const [stats, setStats] = useState<EventStats>(initialStats);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState<EventPaymentStatus | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<EventRegistrationStatus | 'ALL'>('ALL');

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedReg, setSelectedReg] = useState<EventRegistration | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'VERIFY' | 'REJECT';
    reg: EventRegistration;
  } | null>(null);

  const isPaid = event.payment_required;

  // Filter registrations locally
  const filteredRegistrations = registrations.filter((r) => {
    if (branchFilter !== 'ALL' && r.branch_id !== branchFilter) return false;
    if (semesterFilter !== 'ALL' && r.semester_id !== semesterFilter) return false;
    if (paymentFilter !== 'ALL' && r.payment_status !== paymentFilter) return false;
    if (statusFilter !== 'ALL' && r.registration_status !== statusFilter) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = r.student_name?.toLowerCase().includes(q);
      const matchReg = r.registration_number?.toLowerCase().includes(q);
      const matchEmail = r.email?.toLowerCase().includes(q);
      const matchMobile = r.mobile?.includes(q);
      const matchTx = r.transaction_id?.toLowerCase().includes(q);
      if (!matchName && !matchReg && !matchEmail && !matchMobile && !matchTx) {
        return false;
      }
    }
    return true;
  });

  const handleVerifyPayment = async (regId: string, registrationNumber?: string) => {
    const regNum = registrationNumber || registrations.find(r => r.id === regId)?.registration_number;
    try {
      setActionLoadingId(regId);
      setFeedback(null);
      const res = await verifyProgramPaymentSheetAction(
        event.id,
        regNum || regId,
        activeCollegeId
      );
      if (res.success) {
        setRegistrations((prev) =>
          prev.map((r) => (r.id === regId ? { ...r, payment_status: 'VERIFIED' } : r))
        );
        setSelectedReg((prev) => (prev && prev.id === regId ? { ...prev, payment_status: 'VERIFIED' } : prev));
        setStats((prev) => ({
          ...prev,
          paymentVerified: prev.paymentVerified + 1,
          paymentPending: Math.max(0, prev.paymentPending - 1),
        }));
        setFeedback({ type: 'success', message: 'Payment verified successfully in Google Sheet.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to verify payment.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error verifying payment.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectPayment = async (regId: string, registrationNumber?: string) => {
    const regNum = registrationNumber || registrations.find(r => r.id === regId)?.registration_number;
    try {
      setActionLoadingId(regId);
      setFeedback(null);
      const res = await rejectProgramPaymentSheetAction(
        event.id,
        regNum || regId,
        activeCollegeId
      );
      if (res.success) {
        setRegistrations((prev) =>
          prev.map((r) => (r.id === regId ? { ...r, payment_status: 'REJECTED' } : r))
        );
        setSelectedReg((prev) => (prev && prev.id === regId ? { ...prev, payment_status: 'REJECTED' } : prev));
        setStats((prev) => ({
          ...prev,
          paymentRejected: prev.paymentRejected + 1,
          paymentPending: Math.max(0, prev.paymentPending - 1),
        }));
        setFeedback({ type: 'success', message: 'Payment rejected in Google Sheet.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to reject payment.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error rejecting payment.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusChange = async (regId: string, newStatus: EventRegistrationStatus) => {
    const regNum = registrations.find(r => r.id === regId)?.registration_number;
    try {
      setActionLoadingId(regId);
      setFeedback(null);
      const res = await updateProgramRegStatusSheetAction(
        event.id,
        regNum || regId,
        newStatus,
        activeCollegeId
      );
      if (res.success) {
        setRegistrations((prev) =>
          prev.map((r) => (r.id === regId ? { ...r, registration_status: newStatus } : r))
        );
        setFeedback({ type: 'success', message: `Registration status updated to ${newStatus}.` });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update status.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Build query string for PDF and CSV export links reflecting active filters
  const exportQuery = new URLSearchParams();
  if (search.trim()) exportQuery.set('search', search.trim());
  if (branchFilter !== 'ALL') exportQuery.set('branchId', branchFilter);
  if (semesterFilter !== 'ALL') exportQuery.set('semesterId', semesterFilter);
  if (paymentFilter !== 'ALL') exportQuery.set('paymentStatus', paymentFilter);
  if (statusFilter !== 'ALL') exportQuery.set('registrationStatus', statusFilter);
  const queryString = exportQuery.toString() ? `?${exportQuery.toString()}` : '';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard?tab=events"
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Events</span>
            </Link>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 flex flex-wrap items-center gap-2">
            <span className="break-words">{event.title}</span>
            <span className="text-xs font-normal text-slate-500">
              ({stats.totalEnrolled} Registered)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5" suppressHydrationWarning>
            Venue: {event.venue} &bull; Starts: {new Date(event.start_at).toLocaleDateString('en-IN')}
          </p>
        </div>

        {/* Export & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <a
            href={`/api/admin/events/${event.id}/pdf${queryString}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-bce-cobalt hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Enrollment PDF</span>
          </a>

          <a
            href={`/api/admin/events/${event.id}/csv${queryString}`}
            download
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {event.registration_type === 'google_form' && event.google_form_url && (
        <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-blue-950">Google Form Registration Active</p>
              <p className="text-blue-800 text-[11px]">
                Student registrations for this event are collected directly via Google Forms.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={event.google_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-xs"
            >
              <span>Open Google Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {event.registration_sheet_id && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${event.registration_sheet_id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all"
              >
                <span>Responses Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className={`grid gap-2.5 sm:gap-3 ${isPaid ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase">Total Enrolled</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.totalEnrolled}</p>
        </div>

        {isPaid && (
          <>
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] sm:text-[11px] font-semibold text-amber-600 uppercase">Payment Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{stats.paymentPending}</p>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 uppercase">Payment Verified</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{stats.paymentVerified}</p>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] sm:text-[11px] font-semibold text-red-600 uppercase">Payment Rejected</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{stats.paymentRejected}</p>
            </div>
          </>
        )}

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase">Available Seats</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-700 mt-1">
            {stats.availableSeats !== null ? stats.availableSeats : 'Unlimited'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3" suppressHydrationWarning>
        {/* Search */}
        <div className="relative flex-1 w-full min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, reg number, email, mobile, UTR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            suppressHydrationWarning
            className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            suppressHydrationWarning
            className="flex-1 sm:flex-none text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} ({b.name})
              </option>
            ))}
          </select>

          {/* Semester Filter */}
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            suppressHydrationWarning
            className="flex-1 sm:flex-none text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Semester {s.semester_number}
              </option>
            ))}
          </select>

          {/* Payment Status Filter (if paid) */}
          {isPaid && (
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              suppressHydrationWarning
              className="flex-1 sm:flex-none text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
            >
              <option value="ALL">All Payments</option>
              <option value="PENDING">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}

          {/* Registration Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            suppressHydrationWarning
            className="flex-1 sm:flex-none text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20"
          >
            <option value="ALL">All Reg Status</option>
            <option value="REGISTERED">Active Registered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3 text-center">S.No</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Reg. Number</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Branch &bull; Sem</th>
                <th className="py-3 px-3 text-center">Registered Date</th>
                {isPaid && <th className="py-3 px-3 text-center">Payment</th>}
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={isPaid ? 9 : 8} className="py-12 text-center text-slate-400">
                    No registrations match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg, idx) => {
                  const isLoading = actionLoadingId === reg.id;
                  const regDate = new Date(reg.registered_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {reg.student_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {reg.registration_number}
                      </td>
                      <td className="py-2.5 px-3 space-y-0.5">
                        <div className="text-slate-800">{reg.email}</div>
                        <div className="text-[11px] text-slate-400">{reg.mobile}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">
                          {reg.branch?.code || reg.branch?.name || '-'}
                        </span>
                        {reg.semester?.semester_number && (
                          <span className="text-[11px] text-slate-500 ml-1">
                            (Sem {reg.semester.semester_number})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500" suppressHydrationWarning>{regDate}</td>

                      {/* Payment Status (if paid) */}
                      {isPaid && (
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                              reg.payment_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : reg.payment_status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {reg.payment_status}
                          </span>
                          {reg.transaction_id && (
                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[100px] mx-auto mt-0.5" title={reg.transaction_id}>
                              {reg.transaction_id}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Registration Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            reg.registration_status === 'REGISTERED'
                              ? 'bg-slate-100 text-slate-800'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {reg.registration_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right" suppressHydrationWarning>
                        <div className="inline-flex items-center gap-1 justify-end" suppressHydrationWarning>
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setSelectedReg(reg)}
                            suppressHydrationWarning
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="View Registration Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Payment Actions */}
                          {isPaid && (reg.payment_status === 'PENDING' || reg.payment_status === 'SUBMITTED') && (
                            <>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setConfirmAction({ type: 'VERIFY', reg: reg })}
                                suppressHydrationWarning
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-bold transition-colors disabled:opacity-50"
                                title="Verify Payment"
                              >
                                {isLoading && actionLoadingId === reg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                              </button>

                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setConfirmAction({ type: 'REJECT', reg })}
                                suppressHydrationWarning
                                className="px-1.5 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[11px] font-bold transition-colors disabled:opacity-50"
                                title="Reject Payment"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* Cancel / Restore registration */}
                          {reg.registration_status === 'REGISTERED' ? (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleStatusChange(reg.id, 'CANCELLED')}
                              suppressHydrationWarning
                              className="px-1.5 py-0.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded text-[10px] transition-colors"
                              title="Cancel Registration"
                            >
                              Cancel
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleStatusChange(reg.id, 'REGISTERED')}
                              suppressHydrationWarning
                              className="px-1.5 py-0.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded text-[10px] transition-colors font-semibold"
                              title="Restore Registration"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-[calc(100vw-16px)] sm:w-full max-w-lg max-h-[calc(100vh-24px)] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Registration Details</h3>
              <button
                onClick={() => setSelectedReg(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Student Name:</span>
                  <p className="font-bold text-slate-900 text-sm break-words">{selectedReg.student_name}</p>
                </div>
                <div>
                  <span className="text-slate-400">Registration No:</span>
                  <p className="font-mono font-bold text-slate-900 text-sm break-all">{selectedReg.registration_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Email:</span>
                  <p className="text-slate-800 break-all">{selectedReg.email}</p>
                </div>
                <div>
                  <span className="text-slate-400">Mobile:</span>
                  <p className="text-slate-800 break-all">{selectedReg.mobile}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Branch:</span>
                  <p className="text-slate-800 font-semibold">{selectedReg.branch?.name || selectedReg.branch?.code || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Semester:</span>
                  <p className="text-slate-800">{selectedReg.semester ? `Semester ${selectedReg.semester.semester_number}` : '-'}</p>
                </div>
              </div>

              {isPaid && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Payment Status:</span>
                    <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {selectedReg.payment_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Transaction ID / UTR:</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5 break-all">
                      {selectedReg.transaction_id || 'Not provided'}
                    </p>
                  </div>
                  {selectedReg.payment_screenshot_url && (
                    <div>
                      <span className="text-slate-400">Payment Proof Screenshot:</span>
                      <div className="mt-1">
                        <a
                          href={selectedReg.payment_screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-bce-cobalt font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Full Size Screenshot</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {isPaid && (selectedReg.payment_status === 'PENDING' || selectedReg.payment_status === 'SUBMITTED') ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedReg.id}
                    onClick={() => setConfirmAction({ type: 'VERIFY', reg: selectedReg })}
                    suppressHydrationWarning
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedReg.id}
                    onClick={() => setConfirmAction({ type: 'REJECT', reg: selectedReg })}
                    suppressHydrationWarning
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedReg(null)}
                suppressHydrationWarning
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Verify & Reject */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
          onClick={() => !actionLoadingId && setConfirmAction(null)}
        >
          <div
            className="bg-white rounded-2xl w-[calc(100vw-16px)] sm:w-full max-w-md max-h-[calc(100vh-24px)] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmAction.type === 'VERIFY' ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Verify Payment?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to verify this payment? This will confirm the registration and enrollment for the student.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-1">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Reject Payment?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to reject this payment? The payment status will be marked as REJECTED.
                  </p>
                </div>
              </>
            )}

            {/* Registration Summary Box */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-semibold text-slate-900">{confirmAction.reg.student_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Registration No:</span>
                <span className="font-mono font-medium text-slate-700">{confirmAction.reg.registration_number}</span>
              </div>
              {event.payment_required && event.payment_amount !== null && event.payment_amount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Fee Amount:</span>
                  <span className="font-bold text-emerald-700">₹{event.payment_amount}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Transaction ID / UTR:</span>
                <span
                  className="font-mono font-bold text-slate-900 truncate max-w-[200px]"
                  title={confirmAction.reg.transaction_id || ''}
                >
                  {confirmAction.reg.transaction_id || 'Not provided'}
                </span>
              </div>
            </div>

            {/* Confirmation Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionLoadingId !== null}
                onClick={() => setConfirmAction(null)}
                suppressHydrationWarning
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {confirmAction.type === 'VERIFY' ? (
                <button
                  type="button"
                  disabled={actionLoadingId !== null}
                  onClick={async () => {
                    await handleVerifyPayment(confirmAction.reg.id, confirmAction.reg.registration_number);
                    setConfirmAction(null);
                  }}
                  suppressHydrationWarning
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoadingId === confirmAction.reg.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Yes, Verify Payment</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionLoadingId !== null}
                  onClick={async () => {
                    await handleRejectPayment(confirmAction.reg.id, confirmAction.reg.registration_number);
                    setConfirmAction(null);
                  }}
                  suppressHydrationWarning
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoadingId === confirmAction.reg.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Yes, Reject Payment</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
