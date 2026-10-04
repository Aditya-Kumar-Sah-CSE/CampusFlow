'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import type { CollegeEvent, EventFormData, EventStatus, EventRegistrationType } from '@/types/events';
import { createEventAction, updateEventAction } from '@/app/admin/events/actions';
import { isValidGoogleFormUrl } from '@/lib/validation/google-forms';

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

      if (registrationEnabled && registrationType === 'google_form') {
        if (!googleFormUrl.trim()) {
          setErrorMsg('Google Form URL is required when Google Form registration is enabled.');
          setSubmitting(false);
          return;
        }
        if (!isValidGoogleFormUrl(googleFormUrl)) {
          setErrorMsg('Please enter a valid Google Form URL (e.g. https://docs.google.com/forms/d/... or https://forms.gle/...)');
          setSubmitting(false);
          return;
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
          router.push('/admin/dashboard?tab=events');
          router.refresh();
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
                      Direct students to an external Google Form (e.g. Open Mic, Seminars, Workshops, Club events).
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
                      <Users className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>Internal CampusFlow Portal</span>
                    </span>
                    <span className="text-slate-500 text-[11px] leading-tight block mt-1">
                      Multi-competition events with student ID verification, teams, and Google Sheets master ledger.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Google Form Specific Configuration */}
            {registrationType === 'google_form' && (
              <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>Google Form URL *</span>
                    </label>
                    {googleFormUrl && isValidGoogleFormUrl(googleFormUrl) && (
                      <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-bce-cobalt hover:underline inline-flex items-center gap-1"
                      >
                        <span>Test Form URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    required={registrationEnabled && registrationType === 'google_form'}
                    value={googleFormUrl}
                    onChange={(e) => setGoogleFormUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform or https://forms.gle/..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Accepts official Google Forms URLs (<code className="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded">docs.google.com/forms/...</code> or <code className="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded">forms.gle/...</code>).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </form>
  );
}
