'use client';

import React, { useEffect, useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  Mail,
  ArrowLeft,
  FileCheck2,
  Building2,
  GraduationCap,
  Clock,
  Search,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getConfirmationByTokenAction,
  verifyStudentSubmissionAction,
  resendConfirmationEmailAction,
  getFormContextAction,
  VerifiedConfirmationData,
} from './actions';
import { getMorePublishedFormsForCollegeAction, PublicFormSummary } from '@/app/feedback/actions';
import { downloadPdfFile } from '@/lib/utils/pdf-download';
import {
  CompletionPage,
  SuccessState,
  MoreFeedbackForms,
} from '@/components/completion';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const formIdParam = searchParams.get('formId') || searchParams.get('form');

  const [confirmationData, setConfirmationData] = useState<VerifiedConfirmationData | null>(null);
  const [formContext, setFormContext] = useState<{
    formId: string;
    formTitle: string;
    collegeId: string;
    collegeName: string;
    collegeSlug: string;
    collegeLogoUrl: string | null;
  } | null>(null);
  const [moreForms, setMoreForms] = useState<PublicFormSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual lookup state
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupFormId, setLookupFormId] = useState(formIdParam || '');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showLookupBox, setShowLookupBox] = useState(false);

  // Email & PDF actions
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();

  const handleDownloadPdf = async () => {
    if (!confirmationData?.downloadUrl || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadPdfFile({
        url: confirmationData.downloadUrl,
        defaultFilename: 'feedback-confirmation-receipt.pdf',
        onError: (err) => {
          setEmailStatusMsg(typeof err === 'string' ? err : err.message);
        },
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setLoading(true);
      try {
        if (token) {
          const verified = await getConfirmationByTokenAction(token);
          if (isMounted && verified) {
            setConfirmationData(verified);
            if (verified.collegeId) {
              const forms = await getMorePublishedFormsForCollegeAction(
                verified.collegeId,
                verified.formId,
                4
              );
              if (isMounted) setMoreForms(forms);
            }
          }
        } else if (formIdParam) {
          const ctx = await getFormContextAction(formIdParam);
          if (isMounted && ctx) {
            setFormContext(ctx);
            if (ctx.collegeId) {
              const forms = await getMorePublishedFormsForCollegeAction(
                ctx.collegeId,
                ctx.formId,
                4
              );
              if (isMounted) setMoreForms(forms);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load feedback confirmation data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [token, formIdParam]);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupEmail || !lookupFormId) {
      setLookupError('Please enter both the Feedback Form ID and your registered email address.');
      return;
    }

    setLookupError(null);
    startTransition(async () => {
      const res = await verifyStudentSubmissionAction({
        formId: lookupFormId.trim(),
        email: lookupEmail.trim(),
      });

      if (res.success && res.data) {
        setConfirmationData(res.data);
        if (res.data.collegeId) {
          const forms = await getMorePublishedFormsForCollegeAction(
            res.data.collegeId,
            res.data.formId,
            4
          );
          setMoreForms(forms);
        }
      } else {
        setLookupError(res.message);
      }
    });
  };

  const handleResendEmail = () => {
    if (!confirmationData) return;
    setEmailStatusMsg(null);

    startEmailTransition(async () => {
      const res = await resendConfirmationEmailAction({
        formId: confirmationData.formId || confirmationData.formTitle,
        email: confirmationData.studentEmail,
      });

      setEmailStatusMsg(res.message);
    });
  };

  const activeCollegeName = confirmationData?.collegeName || formContext?.collegeName;
  const activeCollegeSlug = confirmationData?.collegeSlug || formContext?.collegeSlug;
  const activeCollegeLogo = confirmationData?.collegeLogoUrl || formContext?.collegeLogoUrl;
  const activeFormTitle = confirmationData?.formTitle || formContext?.formTitle;

  return (
    <CompletionPage
      collegeName={activeCollegeName}
      collegeSlug={activeCollegeSlug}
      collegeLogoUrl={activeCollegeLogo}
    >
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Verifying submission status...
          </p>
        </div>
      ) : confirmationData || formContext ? (
        /* SUCCESS COMPLETION EXPERIENCE */
        <div className="space-y-8">
          <SuccessState
            type="feedback"
            title="Thank You for Your Feedback"
            subtitle="Your feedback has been submitted successfully."
            entityTitle={activeFormTitle}
            collegeName={activeCollegeName}
            collegeSlug={activeCollegeSlug}
            registrationNumber={confirmationData?.registrationNumber || undefined}
            submittedAt={confirmationData?.submittedAt || undefined}
            onDownloadPdf={confirmationData?.downloadUrl ? handleDownloadPdf : undefined}
            isDownloadingPdf={isDownloadingPdf}
            hasDownloadUrl={Boolean(confirmationData?.downloadUrl)}
          />

          {/* Official Verification Details (When Verified Record is Loaded) */}
          {confirmationData && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 sm:p-5 text-left text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Officially Verified Submission</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {confirmationData.academicYear}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Department</span>
                    <span className="font-semibold text-slate-900">{confirmationData.branch}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Semester Level</span>
                    <span className="font-semibold text-slate-900">{confirmationData.semester}</span>
                  </div>
                </div>

                {confirmationData.studentName && (
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Student Name</span>
                      <span className="font-semibold text-slate-900">{confirmationData.studentName}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Submitted At</span>
                    <span className="font-semibold text-slate-900">
                      {confirmationData.submittedAt
                        ? new Date(confirmationData.submittedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Recorded'}
                    </span>
                  </div>
                </div>
              </div>

              {emailStatusMsg && (
                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                  {emailStatusMsg}
                </div>
              )}

              {/* Action buttons for PDF & Email */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Download Response Receipt (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isEmailPending}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isEmailPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Email My Receipt</span>
                </button>
              </div>
            </div>
          )}

          {/* Expandable Manual PDF Receipt Lookup if not yet verified */}
          {!confirmationData && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLookupBox(!showLookupBox)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mx-auto cursor-pointer"
              >
                <span>Need an official PDF copy of your response?</span>
                {showLookupBox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showLookupBox && (
                <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
                  <div className="text-xs font-bold text-slate-800">
                    Verify & Download Official PDF Receipt
                  </div>
                  {lookupError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                  <form onSubmit={handleManualLookup} className="space-y-3">
                    <input
                      type="hidden"
                      value={lookupFormId}
                    />
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Registered Student Email
                      </label>
                      <input
                        type="email"
                        placeholder="your.email@institution.edu"
                        value={lookupEmail}
                        onChange={(e) => setLookupEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Retrieve Response Receipt</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* More Feedback Forms (Real Published Forms for the College) */}
          <MoreFeedbackForms
            forms={moreForms}
            collegeSlug={activeCollegeSlug}
            collegeName={activeCollegeName}
          />
        </div>
      ) : (
        /* MANUAL RETRIEVAL FORM (NO TOKEN OR PARAM SUPPLIED) */
        <div className="space-y-6 text-left">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
              <Search className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Retrieve Feedback Receipt
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Look up your officially recorded feedback submission to download your PDF receipt.
            </p>
          </div>

          {lookupError && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          <form onSubmit={handleManualLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Feedback Form Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. 1a2b3c4d-..."
                value={lookupFormId}
                onChange={(e) => setLookupFormId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Found on the feedback form link or portal.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registered Student Email
              </label>
              <input
                type="email"
                placeholder="student.email@institution.edu"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Must match the email address recorded during submission.
              </span>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Verify & Retrieve Confirmation</span>
            </button>
          </form>

          <div className="text-center pt-4 border-t border-slate-100">
            <Link
              href="/feedback"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Feedback Forms</span>
            </Link>
          </div>
        </div>
      )}
    </CompletionPage>
  );
}

export default function FeedbackConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading confirmation...</span>
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
