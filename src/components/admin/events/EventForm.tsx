'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  DollarSign,
  QrCode,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Upload,
  Ticket,
  FileSpreadsheet,
  ExternalLink,
  FolderOpen,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Check,
  X,
  Plus,
} from 'lucide-react';
import type { CollegeEvent, EventFormData, EventStatus, EventRegistrationType } from '@/types/events';
import { createEventAction, updateEventAction, resyncEventGoogleResourcesAction } from '@/app/admin/events/actions';

interface Props {
  initialEvent?: CollegeEvent | null;
  activeCollegeId?: string | null;
  isEdit?: boolean;
}

export function EventForm({ initialEvent, activeCollegeId, isEdit = false }: Props) {
  const router = useRouter();

  // Format date-time for datetime-local input
  const formatForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch {
      return '';
    }
  };

  const defaultStart = new Date(Date.now() + 86400000 * 7).toISOString();
  const defaultEnd = new Date(Date.now() + 86400000 * 7 + 3600000 * 3).toISOString();
  const defaultRegStart = new Date().toISOString();
  const defaultRegEnd = new Date(Date.now() + 86400000 * 6).toISOString();

  const [title, setTitle] = useState(initialEvent?.title || '');
  const [slug, setSlug] = useState(initialEvent?.slug || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [venue, setVenue] = useState(initialEvent?.venue || '');
  const [startAt, setStartAt] = useState(formatForInput(initialEvent?.start_at || defaultStart));
  const [endAt, setEndAt] = useState(formatForInput(initialEvent?.end_at || defaultEnd));
  const [regStart, setRegStart] = useState(formatForInput(initialEvent?.registration_start || defaultRegStart));
  const [regEnd, setRegEnd] = useState(formatForInput(initialEvent?.registration_end || defaultRegEnd));
  const [maxCapacity, setMaxCapacity] = useState<string>(
    initialEvent?.max_capacity ? String(initialEvent.max_capacity) : ''
  );
  const [status, setStatus] = useState<EventStatus>(initialEvent?.status || 'DRAFT');
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initialEvent?.registration_enabled ?? true
  );
  const [registrationType, setRegistrationType] = useState<EventRegistrationType>(
    initialEvent?.registration_type || (initialEvent?.google_form_url ? 'google_form' : 'internal')
  );
  const [googleFormUrl, setGoogleFormUrl] = useState(initialEvent?.google_form_url || '');
  const [registrationDeadline, setRegistrationDeadline] = useState(
    formatForInput(initialEvent?.registration_deadline || initialEvent?.registration_end || defaultRegEnd)
  );
  const [registrationLabel, setRegistrationLabel] = useState(
    initialEvent?.registration_label || 'Register Now'
  );

  // Performance categories (admin-configured per event; Solo/Duet/Team mode is hardcoded in Google Form)
  const [performanceCategories, setPerformanceCategories] = useState<string[]>(
    initialEvent?.performance_categories || []
  );
  const [newCategory, setNewCategory] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCategory = () => {
    const val = newCategory.trim();
    if (!val) return;

    if (editingCategoryIndex !== null) {
      const updated = [...performanceCategories];
      updated[editingCategoryIndex] = val;
      setPerformanceCategories(updated);
      setEditingCategoryIndex(null);
      setNewCategory('');
    } else {
      if (!performanceCategories.includes(val)) {
        setPerformanceCategories([...performanceCategories, val]);
      }
      setNewCategory('');
    }
  };

  const handleTagClick = (cat: string, index: number) => {
    if (editingCategoryIndex === index) {
      setEditingCategoryIndex(null);
      setNewCategory('');
      return;
    }
    setNewCategory(cat);
    setEditingCategoryIndex(index);
    setTimeout(() => {
      categoryInputRef.current?.focus();
      categoryInputRef.current?.select();
    }, 0);
  };

  const cancelEditingCategory = () => {
    setEditingCategoryIndex(null);
    setNewCategory('');
  };

  const removeCategory = (idx: number) => {
    setPerformanceCategories(performanceCategories.filter((_, i) => i !== idx));
    if (editingCategoryIndex === idx) {
      setEditingCategoryIndex(null);
      setNewCategory('');
    } else if (editingCategoryIndex !== null && editingCategoryIndex > idx) {
      setEditingCategoryIndex(editingCategoryIndex - 1);
    }
  };

  const CATEGORY_PRESETS: Record<string, string[]> = {
    cultural: ['Singing', 'Dance', 'Drama / Skit', 'Poetry / Shayari', 'Music / Instrumental', 'Mono Acting'],
    tech: ['Coding / Hackathon', 'Web Development', 'AI / ML', 'Mobile App Dev', 'UI / UX Design', 'Tech Quiz'],
    sports: ['Cricket', 'Football', 'Badminton', 'Table Tennis', 'Chess', 'Esports / Gaming'],
    academic: ['Paper Presentation', 'Debate', 'Quiz / Trivia', 'Elocution', 'Poster Making'],
  };

  const applyCategoryPreset = (preset: 'cultural' | 'tech' | 'sports' | 'academic' | 'clear') => {
    setEditingCategoryIndex(null);
    setNewCategory('');
    if (preset === 'clear') {
      setPerformanceCategories([]);
      return;
    }
    const items = CATEGORY_PRESETS[preset] || [];
    const allPresent = items.every((item) => performanceCategories.includes(item));
    if (allPresent) {
      // Toggle off: remove all items of this preset
      setPerformanceCategories(performanceCategories.filter((c) => !items.includes(c)));
    } else {
      // Add missing items
      setPerformanceCategories(Array.from(new Set([...performanceCategories, ...items])));
    }
  };

  // Payment states
  const [paymentRequired, setPaymentRequired] = useState(
    Boolean(initialEvent?.payment_required)
  );
  const [paymentAmount, setPaymentAmount] = useState<string>(
    initialEvent?.payment_amount ? String(initialEvent.payment_amount) : '100'
  );
  const [paymentUpiId, setPaymentUpiId] = useState(initialEvent?.payment_upi_id || '');
  const [paymentQrUrl] = useState(initialEvent?.payment_qr_url || '');
  const [paymentInstructions, setPaymentInstructions] = useState(
    initialEvent?.payment_instructions ||
      'Pay the registration fee using the UPI ID or QR code and enter your transaction ID below.'
  );

  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(initialEvent?.payment_qr_url || null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automated Google Registration sync state
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleFeedback, setGoogleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [createdGoogleResources, setCreatedGoogleResources] = useState<{
    eventId: string;
    formUrl?: string | null;
    spreadsheetUrl?: string | null;
    driveFolderUrl?: string | null;
  } | null>(null);

  const handleResyncGoogleResources = async () => {
    if (!initialEvent?.id) return;
    setSyncingGoogle(true);
    setGoogleFeedback(null);
    try {
      const res = await resyncEventGoogleResourcesAction(initialEvent.id, activeCollegeId || undefined);
      if (res.success) {
        setGoogleFeedback({ type: 'success', message: res.message || 'Google registration resources synchronized successfully.' });
        router.refresh();
      } else {
        setGoogleFeedback({ type: 'error', message: res.error || 'Failed to sync Google resources.' });
      }
    } catch (err: any) {
      setGoogleFeedback({ type: 'error', message: err.message || 'Error syncing Google resources.' });
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isEdit && !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      );
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('QR code image file must be under 5MB.');
        return;
      }
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      let finalQrUrl = paymentQrUrl;

      // If user uploaded a new QR file, upload via storage route or FormData
      if (paymentRequired && qrFile) {
        const formData = new FormData();
        formData.append('file', qrFile);
        formData.append('collegeId', activeCollegeId || '');
        formData.append('eventId', initialEvent?.id || 'temp');
        formData.append('folder', 'payment-qr');

        const uploadRes = await fetch('/api/admin/events/upload-asset', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const uData = await uploadRes.json();
          if (uData.url) {
            finalQrUrl = uData.url;
          }
        }
      }

      const payload: EventFormData = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || undefined,
        venue: venue.trim(),
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        registration_start: new Date(regStart).toISOString(),
        registration_end: new Date(regEnd).toISOString(),
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        status,
        registration_enabled: registrationEnabled,
        registration_type: registrationType,
        google_form_url: registrationType === 'google_form' ? googleFormUrl.trim() : undefined,
        registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : undefined,
        registration_label: registrationLabel.trim() || 'Register Now',
        performance_categories: performanceCategories.length > 0 ? performanceCategories : undefined,
        payment_required: paymentRequired,
        payment_amount: paymentRequired ? parseFloat(paymentAmount) || 0 : null,
        payment_upi_id: paymentRequired ? paymentUpiId.trim() : undefined,
        payment_qr_url: paymentRequired ? finalQrUrl : undefined,
        payment_instructions: paymentRequired ? paymentInstructions.trim() : undefined,
      };

      if (isEdit && initialEvent) {
        const res = await updateEventAction(initialEvent.id, payload, activeCollegeId || undefined);
        if (res.success) {
          router.push('/admin/dashboard?tab=events');
          router.refresh();
        } else {
          setErrorMsg(res.error || 'Failed to update event.');
        }
      } else {
        const res = await createEventAction(payload, activeCollegeId || undefined);
        if (res.success) {
          if (registrationType === 'google_form' && res.resources) {
            setCreatedGoogleResources({
              eventId: res.eventId || '',
              formUrl: res.resources.googleFormUrl || undefined,
              spreadsheetUrl: res.resources.googleSpreadsheetUrl || undefined,
              driveFolderUrl: res.resources.googleDriveFolderUrl || undefined,
            });
          } else {
            router.push('/admin/dashboard?tab=events');
            router.refresh();
          }
        } else {
          setErrorMsg(res.error || 'Failed to create event.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/dashboard?tab=events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Events</span>
        </Link>
        <span className="text-xs font-medium text-slate-400">
          {isEdit ? 'Editing Existing Event' : 'New Event Setup'}
        </span>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Basic Event Information */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-bce-cobalt shrink-0" />
          <span>Basic Event Information</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Event Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Annual Tech Symposium 2026"
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">URL Slug *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="tech-symposium-2026"
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Venue / Location *</label>
          <input
            type="text"
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Main Auditorium, Ground Floor"
            className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Event Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Overview of the event, itinerary, guest speakers, eligibility, etc."
            className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt resize-y"
          />
        </div>
      </div>

      {/* Dates & Schedule */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-bce-cobalt shrink-0" />
          <span>Dates &amp; Schedule</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Event Starts At *</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Event Ends At *</label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Registration Opens At *</label>
            <input
              type="datetime-local"
              required
              value={regStart}
              onChange={(e) => setRegStart(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Registration Deadline *</label>
            <input
              type="datetime-local"
              required
              value={regEnd}
              onChange={(e) => setRegEnd(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>
        </div>
      </div>

      {/* Registration Section */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-bce-cobalt shrink-0" />
              <span>Registration Settings</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Configure how students register for this event (Google Form or CampusFlow portal).
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-bce-cobalt border-slate-300 focus:ring-bce-cobalt"
            />
            <span>Enable Registration</span>
          </label>
        </div>

        {registrationEnabled ? (
          <div className="space-y-4 pt-1">
            {/* Registration Method Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Registration Method</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    registrationType === 'google_form'
                      ? 'border-bce-cobalt bg-blue-50/60 ring-1 ring-bce-cobalt/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="registrationType"
                    value="google_form"
                    checked={registrationType === 'google_form'}
                    onChange={() => setRegistrationType('google_form')}
                    className="mt-0.5 text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Google Form</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                        Small / Cultural Events
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px] leading-tight block mt-1">
                      Automatically creates Google Form + Response Sheet + Drive folder.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    registrationType === 'internal'
                      ? 'border-bce-cobalt bg-blue-50/60 ring-1 ring-bce-cobalt/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="registrationType"
                    value="internal"
                    checked={registrationType === 'internal'}
                    onChange={() => setRegistrationType('internal')}
                    className="mt-0.5 text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span>Big Event</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
                        Big / Flagship Events
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px] leading-tight block mt-1">
                      CampusFlow registration portal + Drive-organized registration sheets.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Automated Google Registration Pipeline UI */}
            {registrationType === 'google_form' && (
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-4">
                {/* Header & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Google Registration Resources
                    </span>
                  </div>

                  <div>
                    {initialEvent?.google_registration_status === 'READY' || initialEvent?.google_form_url ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    ) : initialEvent?.google_registration_status === 'ERROR' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                        <AlertCircle className="w-3 h-3" />
                        <span>Error</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Sparkles className="w-3 h-3" />
                        <span>Not Connected (Created on Save)</span>
                      </span>
                    )}
                  </div>
                </div>

                {googleFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      googleFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {googleFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    )}
                    <span>{googleFeedback.message}</span>
                  </div>
                )}

                {/* Resource Actions / Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Google Form */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Google Form
                      </span>
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        {initialEvent?.title ? `${initialEvent.title} - Form` : 'Registration Form'}
                      </span>
                    </div>
                    {initialEvent?.google_form_url ? (
                      <a
                        href={initialEvent.google_form_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Form</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Created upon save</span>
                    )}
                  </div>

                  {/* Response Sheet */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Responses (Source of Truth)
                      </span>
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        {initialEvent?.title ? `${initialEvent.title} - Responses` : 'Master Ledger'}
                      </span>
                    </div>
                    {initialEvent?.google_spreadsheet_url ? (
                      <a
                        href={initialEvent.google_spreadsheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Open Responses</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Linked upon save</span>
                    )}
                  </div>

                  {/* Google Drive Folder */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Google Drive Folder
                      </span>
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        CampusFlow / Events / Small Events
                      </span>
                    </div>
                    {initialEvent?.google_drive_folder_url ? (
                      <a
                        href={initialEvent.google_drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open Folder</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Organized upon save</span>
                    )}
                  </div>
                </div>

                {/* Editable Google Form URL override */}
                <div className="space-y-1.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Google Form Registration URL</span>
                      <span className="text-[10px] font-normal text-slate-500">(Automated / Editable)</span>
                    </label>
                    {googleFormUrl && (
                      <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <span>Test Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={googleFormUrl}
                    onChange={(e) => setGoogleFormUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white text-slate-800 font-mono text-[11px] sm:text-xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    Auto-generated and managed by CampusFlow. You can also paste your own custom Google Form link here.
                  </p>
                </div>

                {/* Explanatory Banner & Recreate / Repair Resources */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-2 max-w-xl">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <strong>Zero manual setup:</strong> CampusFlow automatically creates the Google Form with custom questions tailored to your active branches, generates the linked response Google Sheet, and stores everything in your institution&apos;s connected Google Drive.
                    </p>
                  </div>

                  {isEdit && initialEvent && (
                    <button
                      type="button"
                      onClick={handleResyncGoogleResources}
                      disabled={syncingGoogle}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0 disabled:opacity-60 cursor-pointer"
                    >
                      {syncingGoogle ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Recreate / Repair Resources</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Event Categories Configuration (Participation Modes: Solo/Duet/Group are hardcoded in Google Form) */}
                <div className="space-y-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        Event Categories / Tracks
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Add the competition categories, performance types, or tracks for this event. Click any tag to edit in textbox.
                      </p>
                    </div>
                    {performanceCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => applyCategoryPreset('clear')}
                        className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400 font-medium text-[10px]">Quick Presets:</span>
                    {([
                      { key: 'cultural' as const, emoji: '🎭', label: 'Cultural', colors: { bg: 'bg-pink-50', hoverBg: 'hover:bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', activeBg: 'bg-pink-600', activeHoverBg: 'hover:bg-pink-700', activeText: 'text-white', activeBorder: 'border-pink-700', partialBg: 'bg-pink-100', partialBorder: 'border-pink-300' } },
                      { key: 'tech' as const, emoji: '💻', label: 'Tech / Coding', colors: { bg: 'bg-cyan-50', hoverBg: 'hover:bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', activeBg: 'bg-cyan-600', activeHoverBg: 'hover:bg-cyan-700', activeText: 'text-white', activeBorder: 'border-cyan-700', partialBg: 'bg-cyan-100', partialBorder: 'border-cyan-300' } },
                      { key: 'sports' as const, emoji: '🏆', label: 'Sports', colors: { bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-600', activeHoverBg: 'hover:bg-emerald-700', activeText: 'text-white', activeBorder: 'border-emerald-700', partialBg: 'bg-emerald-100', partialBorder: 'border-emerald-300' } },
                      { key: 'academic' as const, emoji: '📚', label: 'Academic', colors: { bg: 'bg-indigo-50', hoverBg: 'hover:bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', activeBg: 'bg-indigo-600', activeHoverBg: 'hover:bg-indigo-700', activeText: 'text-white', activeBorder: 'border-indigo-700', partialBg: 'bg-indigo-100', partialBorder: 'border-indigo-300' } },
                    ]).map((preset) => {
                      const presetItems = CATEGORY_PRESETS[preset.key] || [];
                      const matchCount = presetItems.filter((item) => performanceCategories.includes(item)).length;
                      const isFullySelected = matchCount === presetItems.length;
                      const isPartial = matchCount > 0 && !isFullySelected;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyCategoryPreset(preset.key)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all duration-200 cursor-pointer text-xs border whitespace-nowrap ${
                            isFullySelected
                              ? `${preset.colors.activeBg} ${preset.colors.activeHoverBg} ${preset.colors.activeText} ${preset.colors.activeBorder} shadow-md ring-2 ring-offset-1 ring-${preset.key === 'cultural' ? 'pink' : preset.key === 'tech' ? 'cyan' : preset.key === 'sports' ? 'emerald' : 'indigo'}-300`
                              : isPartial
                                ? `${preset.colors.partialBg} ${preset.colors.text} ${preset.colors.partialBorder} border-dashed ${preset.colors.hoverBg}`
                                : `${preset.colors.bg} ${preset.colors.hoverBg} ${preset.colors.text} ${preset.colors.border}`
                          }`}
                          title={isFullySelected ? `Click to remove ${preset.label} categories` : isPartial ? `${matchCount}/${presetItems.length} added — click to complete` : `Click to add ${preset.label} categories`}
                        >
                          <span className="text-sm leading-none">{preset.emoji}</span>
                          <span>{preset.label}</span>
                          {isFullySelected && <span className="text-[10px] font-bold">✓</span>}
                          {isPartial && <span className="text-[9px] opacity-80 font-bold">{matchCount}/{presetItems.length}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Category Chips (Clickable to edit in textbox) */}
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {performanceCategories.map((cat, i) => {
                      const isEditing = editingCategoryIndex === i;
                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            isEditing
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                              : 'bg-blue-100/90 hover:bg-blue-200 text-blue-800 border-blue-200 hover:border-blue-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleTagClick(cat, i)}
                            className="cursor-pointer hover:underline flex items-center text-left"
                            title="Click to edit category in textbox"
                          >
                            {cat}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCategory(i);
                            }}
                            title="Remove category"
                            className={`rounded-full p-0.5 transition-colors cursor-pointer ${
                              isEditing
                                ? 'hover:bg-blue-700 text-white'
                                : 'hover:bg-blue-300 text-blue-700'
                            }`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {performanceCategories.length === 0 && (
                      <span className="text-xs text-slate-400 italic flex items-center gap-1.5 py-0.5">
                        <span>No custom categories added — standard cultural categories will be used in the Google Form.</span>
                      </span>
                    )}
                  </div>

                  {/* Add / Edit Input */}
                  <div className="flex gap-2">
                    <input
                      ref={categoryInputRef}
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCategory();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEditingCategory();
                        }
                      }}
                      placeholder={
                        editingCategoryIndex !== null
                          ? `Edit "${performanceCategories[editingCategoryIndex]}" (Enter to save, Esc to cancel)...`
                          : "Type a category and press Enter (or click any tag above to edit)..."
                      }
                      className={`flex-1 px-3.5 py-2 text-xs sm:text-sm border rounded-xl focus:outline-hidden focus:ring-2 bg-white transition-all ${
                        editingCategoryIndex !== null
                          ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-medium'
                          : 'border-slate-200 focus:ring-bce-cobalt/20 focus:border-bce-cobalt'
                      }`}
                    />
                    {editingCategoryIndex !== null ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleSaveCategory}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingCategory}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveCategory}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-bce-cobalt hover:bg-bce-cobalt/90 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Category
                      </button>
                    )}
                  </div>

                  {/* Informative Note about hardcoded participation modes */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Participation modes (<strong>Solo</strong>, <strong>Duet</strong>, and <strong>Group Performance</strong>) are automatically included in the Google Form.</span>
                  </div>
                </div>

                {/* Button Label & Registration Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Button Label</label>
                    <input
                      type="text"
                      value={registrationLabel}
                      onChange={(e) => setRegistrationLabel(e.target.value)}
                      placeholder="Register Now"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
                    />
                    <p className="text-[11px] text-slate-400">Label shown on the public event page (e.g. &apos;Register Now&apos;)</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Registration Deadline</label>
                    <input
                      type="datetime-local"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
                    />
                    <p className="text-[11px] text-slate-400">After this date, the registration button will be closed.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Big Event (internal) Drive Resources Panel */}
            {registrationType === 'internal' && (
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-200">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Big Event — Drive Resources
                    </span>
                  </div>

                  <div>
                    {initialEvent?.google_drive_folder_id ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Organized</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Sparkles className="w-3 h-3" />
                        <span>Organized on Save</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Resource Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Registration Sheet */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Registration Sheet (Source of Truth)
                      </span>
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        {initialEvent?.title ? `${initialEvent.title} — Event Registrations` : 'Master Ledger'}
                      </span>
                    </div>
                    {initialEvent?.google_spreadsheet_url || (initialEvent?.registration_sheet_id && `https://docs.google.com/spreadsheets/d/${initialEvent.registration_sheet_id}`) ? (
                      <a
                        href={initialEvent?.google_spreadsheet_url || `https://docs.google.com/spreadsheets/d/${initialEvent?.registration_sheet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Open Sheet</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Created upon save</span>
                    )}
                  </div>

                  {/* Google Drive Folder */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Google Drive Folder
                      </span>
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        CampusFlow / Events / Big Events
                      </span>
                    </div>
                    {initialEvent?.google_drive_folder_url ? (
                      <a
                        href={initialEvent.google_drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open Folder</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Organized upon save</span>
                    )}
                  </div>
                </div>

                {/* Explainer */}
                <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-slate-600">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Auto-organized:</strong> CampusFlow creates the registration spreadsheet and stores it in your institution&apos;s Google Drive under <code className="text-purple-700 bg-purple-100 px-1 py-0.5 rounded text-[10px]">Events / Big Events / {title || 'Event Name'} / Registration</code>.
                  </p>
                </div>

                {/* Button Label & Registration Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Button Label</label>
                    <input
                      type="text"
                      value={registrationLabel}
                      onChange={(e) => setRegistrationLabel(e.target.value)}
                      placeholder="Register Now"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
                    />
                    <p className="text-[11px] text-slate-400">Label shown on the public event page (e.g. &apos;Register Now&apos;)</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Registration Deadline</label>
                    <input
                      type="datetime-local"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
                    />
                    <p className="text-[11px] text-slate-400">After this date, the registration button will be closed.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
            Registration is currently disabled. Students viewing this event will not see a registration CTA.
          </div>
        )}
      </div>

      {/* Capacity & Lifecycle Status */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-bce-cobalt shrink-0" />
          <span>Capacity &amp; Availability</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Maximum Capacity <span className="text-slate-400 font-normal">(Leave empty for unlimited)</span>
            </label>
            <input
              type="number"
              min="1"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              placeholder="e.g. 150"
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Event Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
            >
              <option value="DRAFT">DRAFT (Hidden from public)</option>
              <option value="PUBLISHED">PUBLISHED (Visible to students)</option>
              <option value="CLOSED">CLOSED (Registration stopped)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment Configuration */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-bce-cobalt shrink-0" />
            <span>Registration Fee &amp; Payment Options</span>
          </h3>

          {/* Free vs Paid Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPaymentRequired(false)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !paymentRequired
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Free Event
            </button>
            <button
              type="button"
              onClick={() => setPaymentRequired(true)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                paymentRequired
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Paid Event
            </button>
          </div>
        </div>

        {paymentRequired ? (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Fee Amount (INR ₹) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required={paymentRequired}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full pl-8 pr-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Receiving UPI ID</label>
                <input
                  type="text"
                  value={paymentUpiId}
                  onChange={(e) => setPaymentUpiId(e.target.value)}
                  placeholder="e.g. collegeevents@upi"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Upload Payment QR Code Image</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrUpload}
                    id="qr-upload-input"
                    className="hidden"
                  />
                  <label
                    htmlFor="qr-upload-input"
                    className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Choose QR Image</span>
                  </label>
                  {qrFile && <span className="text-xs text-slate-500 truncate max-w-[200px]">{qrFile.name}</span>}
                </div>
                {qrPreview && (
                  <div className="mt-2 p-2 border border-slate-200 rounded-xl inline-block bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrPreview}
                      alt="Payment QR Preview"
                      className="w-28 h-28 object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Payment Instructions</label>
                <textarea
                  rows={3}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="Instructions for students on how to pay and submit UTR/transaction ID."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt resize-y"
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            This event is configured as free. Students can register immediately with zero payment verification.
          </p>
        )}
      </div>

      {/* Submit Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2">
        <Link
          href="/admin/dashboard?tab=events"
          className="w-full sm:w-auto text-center px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-bce-cobalt hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isEdit ? 'Save Changes' : 'Create Event'}</span>
        </button>
      </div>
      {/* Google Registration Created Success Modal (Requirement 7) */}
      {createdGoogleResources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Google registration form created successfully.
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your event&apos;s Google Form, response Google Sheet, and dedicated Drive folder have been automatically generated and connected.
                </p>
              </div>
            </div>

            {/* Resources Links Grid */}
            <div className="space-y-2.5">
              {createdGoogleResources.formUrl && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                      Google Form URL
                    </span>
                    <span className="text-xs font-mono text-slate-600 truncate block">
                      {createdGoogleResources.formUrl}
                    </span>
                  </div>
                  <a
                    href={createdGoogleResources.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-2xs transition-colors"
                  >
                    <span>Open Form</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {createdGoogleResources.spreadsheetUrl && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Response Sheet URL (Source of Truth)
                    </span>
                    <span className="text-xs font-mono text-slate-600 truncate block">
                      {createdGoogleResources.spreadsheetUrl}
                    </span>
                  </div>
                  <a
                    href={createdGoogleResources.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 shadow-2xs transition-colors"
                  >
                    <span>Open Responses</span>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {createdGoogleResources.driveFolderUrl && (
                <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                      Google Drive Folder
                    </span>
                    <span className="text-xs font-mono text-slate-600 truncate block">
                      {createdGoogleResources.driveFolderUrl}
                    </span>
                  </div>
                  <a
                    href={createdGoogleResources.driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shrink-0 shadow-2xs transition-colors"
                  >
                    <span>Open Drive Folder</span>
                    <FolderOpen className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Link
                href="/admin/dashboard?tab=events"
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 text-center transition-colors"
              >
                Go to Events Dashboard
              </Link>
              <Link
                href={`/admin/dashboard/events/${createdGoogleResources.eventId}/registrations`}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-bce-cobalt hover:bg-blue-800 rounded-xl text-center shadow-xs transition-colors"
              >
                View Event Registrations
              </Link>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
