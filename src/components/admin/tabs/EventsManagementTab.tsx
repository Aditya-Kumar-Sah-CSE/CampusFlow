'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Edit,
} from 'lucide-react';
import type { CollegeEvent, EventStatus } from '@/types/events';
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

  const fetchEvents = async () => {
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
  };

  useEffect(() => {
    if (!initialEvents) {
      fetchEvents();
    }
  }, [activeCollegeId, initialEvents]);

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

  const handleDelete = async (eventId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete/cancel the event "${title}"?`)) {
      return;
    }

    try {
      setUpdatingId(eventId);
      setFeedbackMsg(null);
      const res = await deleteEventAction(eventId, activeCollegeId || undefined);
      if (res.success) {
        if (res.actionTaken === 'CANCELLED') {
          setEvents((prev) =>
            prev.map((e) => (e.id === eventId ? { ...e, status: 'CANCELLED' } : e))
          );
          setFeedbackMsg({
            type: 'success',
            text: 'Event has active registrations, so it was marked as CANCELLED instead of deleting.',
          });
        } else {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
          setFeedbackMsg({ type: 'success', text: 'Event permanently deleted.' });
        }
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to delete event.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error deleting event.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const publishedCount = events.filter((e) => e.status === 'PUBLISHED').length;
  const totalRegistrations = events.reduce((sum, e) => sum + (e.active_registrations_count || 0), 0);
  const paidCount = events.filter((e) => e.payment_required).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-bce-cobalt" />
            <span>College Events &amp; Registration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize institutional workshops, seminars, and fests with capacity management and student enrollment.
          </p>
        </div>

        <Link
          href="/admin/dashboard/events/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
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
            className="text-xs underline ml-2 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Events</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{events.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Published</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Registrations</p>
          <p className="text-2xl font-bold text-bce-cobalt mt-1">{totalRegistrations}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid Events</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{paidCount}</p>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Events Directory</h3>
          <span className="text-xs text-slate-500">{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-bce-cobalt" />
            <p className="text-xs">Loading institutional events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center space-y-3">
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
                      <h4 className="text-base font-bold text-slate-900 truncate">
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
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {startDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {event.venue}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {event.active_registrations_count || 0}
                        {event.max_capacity ? ` / ${event.max_capacity} Seats` : ' Enrolled'}
                      </span>
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      href={`/admin/dashboard/events/${event.id}/registrations`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                    >
                      <Users className="w-3.5 h-3.5 text-bce-cobalt" />
                      <span>Registrations ({event.active_registrations_count || 0})</span>
                    </Link>

                    <Link
                      href={`/admin/dashboard/events/${event.id}/edit`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    {/* Status Toggle Actions */}
                    {event.status === 'DRAFT' && (
                      <button
                        onClick={() => handleStatusChange(event.id, 'PUBLISHED')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition-colors border border-emerald-200 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        <span>Publish</span>
                      </button>
                    )}

                    {event.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleStatusChange(event.id, 'CLOSED')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Close</span>
                      </button>
                    )}

                    {event.status === 'CLOSED' && (
                      <button
                        onClick={() => handleStatusChange(event.id, 'PUBLISHED')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition-colors border border-emerald-200 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        <span>Re-Open</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(event.id, event.title)}
                      disabled={isUpdating}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete or cancel event"
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
    </div>
  );
}
