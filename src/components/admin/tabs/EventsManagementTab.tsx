'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Users,
  MapPin,
  Loader2,
  Edit,
  Trophy,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Trash2,
  X,
} from 'lucide-react';
import type { CollegeEvent, EventStatus } from '@/types/events';
import type { CanonicalEventStats } from '@/lib/events/canonical-stats';
import { updateEventStatusAction, deleteEventAction } from '@/app/admin/events/actions';

interface Props {
  activeCollegeId?: string | null;
  initialEvents?: CollegeEvent[];
}

export function EventsManagementTab({ activeCollegeId, initialEvents }: Props) {
  const [events, setEvents] = useState<CollegeEvent[]>(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Canonical Google Sheets stats per event
  const [statsMap, setStatsMap] = useState<Record<string, CanonicalEventStats>>({});
  const [statsLoading, setStatsLoading] = useState(true);

  // Confirmation modal for CLOSED and CANCELLED states
  const [confirmModal, setConfirmModal] = useState<{
    eventId: string;
    eventTitle: string;
    targetStatus: 'CLOSED' | 'CANCELLED';
  } | null>(null);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    eventId: string;
    eventTitle: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/admin/events/stats');
      if (res.ok) {
        const data = await res.json();
        setStatsMap(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to load event registration stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialEvents) {
      fetchEvents();
    }
    fetchStats();
  }, [activeCollegeId, initialEvents, fetchEvents, fetchStats]);

  const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
    try {
      setUpdatingId(eventId);
      setFeedbackMsg(null);
      const res = await updateEventStatusAction(eventId, newStatus, activeCollegeId || undefined);
      if (res.success) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, status: newStatus } : e))
        );
        setFeedbackMsg({ type: 'success', text: `Event status updated to ${newStatus}.` });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update status.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error updating status.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const onStatusSelect = (event: CollegeEvent, targetStatus: EventStatus) => {
    if (targetStatus === event.status) return;

    if (targetStatus === 'CLOSED' || targetStatus === 'CANCELLED') {
      setConfirmModal({
        eventId: event.id,
        eventTitle: event.title,
        targetStatus,
      });
    } else {
      // DRAFT or PUBLISHED can change without confirmation
      handleStatusChange(event.id, targetStatus);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!confirmModal) return;
    const { eventId, targetStatus } = confirmModal;
    setConfirmModal(null);
    await handleStatusChange(eventId, targetStatus);
  };

  const handleDeleteEvent = async () => {
    if (!deleteModal) return;
    const { eventId, eventTitle } = deleteModal;
    if (deleteConfirmText.trim().toLowerCase() !== eventTitle.trim().toLowerCase()) return;

    try {
      setDeleting(true);
      setFeedbackMsg(null);
      const res = await deleteEventAction(eventId, activeCollegeId || undefined, true);
      if (res.success) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setFeedbackMsg({
          type: 'success',
          text: `"${eventTitle}" permanently deleted. ${res.googleCleanup ? `Google: ${res.googleCleanup}` : ''}`,
        });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to delete event.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error deleting event.' });
    } finally {
      setDeleting(false);
      setDeleteModal(null);
      setDeleteConfirmText('');
    }
  };

  const publishedCount = events.filter((e) => e.status === 'PUBLISHED').length;
  const paidCount = events.filter((e) => e.payment_required).length;

  // Real aggregate registrations from canonical Google Sheets
  const totalRegistrations = Object.values(statsMap).reduce((sum, s) => {
    return s.available ? sum + (s.totalRegistrations || 0) : sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 sm:gap-2.5">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-bce-cobalt shrink-0" />
            <span>College Events &amp; Registration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize institutional workshops, seminars, and fests with capacity management and student enrollment.
          </p>
        </div>

        <Link
          href="/admin/dashboard/events/create"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </Link>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs underline ml-2 opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Events</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{events.length}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Published</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Registrations</p>
          {statsLoading && Object.keys(statsMap).length === 0 ? (
            <div className="w-16 h-7 bg-slate-200 animate-pulse rounded-md mt-1" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-bce-cobalt mt-1">{totalRegistrations}</p>
          )}
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid Events</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{paidCount}</p>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900">Events Directory</h3>
          <span className="text-xs text-slate-500">{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-bce-cobalt" />
            <p className="text-xs">Loading institutional events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No events found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Get started by creating your first college event. You can configure free or paid registrations, venues, and capacity limits.
            </p>
            <Link
              href="/admin/dashboard/events/create"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bce-cobalt text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-2xs mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => {
              const isUpdating = updatingId === event.id;
              const eventStats = statsMap[event.id];
              const isStatsLoading = statsLoading && !eventStats;

              const startDate = new Date(event.start_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={event.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                        {event.title}
                      </h4>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          event.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : event.status === 'CLOSED'
                            ? 'bg-slate-100 text-slate-700'
                            : event.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {event.status}
                      </span>

                      {/* Payment Badge */}
                      {event.payment_required ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                          ₹{event.payment_amount} Paid
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          Free
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {startDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="break-words">{event.venue}</span>
                      </span>

                      {/* Enrolled Count (Real Google Sheets participants count) */}
                      {isStatsLoading ? (
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="inline-block w-16 h-3.5 bg-slate-200 animate-pulse rounded-md" />
                        </span>
                      ) : eventStats && !eventStats.available ? (
                        <span
                          className="flex items-center gap-1 text-xs text-amber-600 font-medium"
                          title={eventStats.error || 'Google Sheets data unavailable'}
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Registration data unavailable</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {eventStats ? eventStats.totalEnrolled : 0}
                            {event.max_capacity ? ` / ${event.max_capacity} Seats` : ' Enrolled'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <Link
                      href={`/admin/dashboard/events/${event.id}/programs`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg transition-colors border border-amber-200"
                      title="Manage Categories and Programs for this event"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      <span>Manage Programs</span>
                    </Link>

                    {/* Registrations Button (Dynamic real count from Google Sheets) */}
                    {isStatsLoading ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-semibold rounded-lg border border-slate-200">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="inline-block w-20 h-3.5 bg-slate-200 animate-pulse rounded-md" />
                      </div>
                    ) : eventStats && !eventStats.available ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 text-xs font-semibold rounded-lg border border-slate-200 opacity-60 cursor-not-allowed"
                        title="Registration data unavailable from Google Sheets"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Registrations (Unavailable)</span>
                      </button>
                    ) : (
                      <Link
                        href={`/admin/dashboard/events/${event.id}/registrations`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                      >
                        <Users className="w-3.5 h-3.5 text-bce-cobalt" />
                        <span>Registrations ({eventStats ? eventStats.totalRegistrations : 0})</span>
                      </Link>
                    )}

                    <Link
                      href={`/admin/dashboard/events/${event.id}/edit`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    {/* Unified Status Dropdown */}
                    <div className="relative inline-flex items-center">
                      <select
                        id={`event-status-${event.id}`}
                        aria-label={`Status for ${event.title}`}
                        value={event.status}
                        disabled={isUpdating}
                        onChange={(e) => onStatusSelect(event, e.target.value as EventStatus)}
                        className="appearance-none text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 bg-white border border-slate-300 text-slate-800 hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition-colors"
                      >
                        <option value="DRAFT">DRAFT (Hidden from public)</option>
                        <option value="PUBLISHED">PUBLISHED (Visible to students)</option>
                        <option value="CLOSED">CLOSED (Registration stopped)</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-bce-cobalt" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteModal({ eventId: event.id, eventTitle: event.title })}
                      title="Permanently delete this event and all associated data"
                      className="inline-flex items-center justify-center p-1.5 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all border border-transparent hover:border-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for CLOSED or CANCELLED status changes */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    confirmModal.targetStatus === 'CANCELLED'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {confirmModal.targetStatus === 'CANCELLED' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {confirmModal.targetStatus === 'CANCELLED'
                      ? 'Cancel this event?'
                      : 'Close this event?'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {confirmModal.eventTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {confirmModal.targetStatus === 'CANCELLED' ? (
                <span>
                  Students will no longer be able to register. Existing registrations, teams, payments, and event records will be preserved.
                </span>
              ) : (
                <span>
                  New registrations will stop, but existing registrations and program records will remain intact.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Keep Current Status
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs ${
                  confirmModal.targetStatus === 'CANCELLED'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {confirmModal.targetStatus === 'CANCELLED'
                  ? 'Confirm & Cancel Event'
                  : 'Confirm & Close Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Permanently Delete Event?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {deleteModal.eventTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setDeleteModal(null); setDeleteConfirmText(''); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-red-700 leading-relaxed bg-red-50 p-3.5 rounded-xl border border-red-200 space-y-2">
              <p className="font-semibold">⚠️ This action is irreversible and will permanently delete:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-600">
                <li>All event data and settings from the database</li>
                <li>All student registrations and team records</li>
                <li>All event programs and category records</li>
                <li>Google Form (if created)</li>
                <li>Google Sheet / Registration data (if created)</li>
                <li>Google Drive folder and all its contents</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Type <span className="font-bold text-red-600">&quot;{deleteModal.eventTitle}&quot;</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteModal.eventTitle}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteModal(null); setDeleteConfirmText(''); }}
                className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={
                  deleting ||
                  deleteConfirmText.trim().toLowerCase() !== deleteModal.eventTitle.trim().toLowerCase()
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Everything Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
