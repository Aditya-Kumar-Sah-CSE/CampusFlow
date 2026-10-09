'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PublicFormSummary } from '@/app/feedback/actions';
import {
  ExternalLink,
  Ban,
  Copy,
  Check,
  GraduationCap,
  BookOpen,
  User,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { ExternalActionLink } from '@/components/ui/ExternalActionLink';
import { checkStudentFormEligibilityAction } from '@/app/auth/student/actions';
import type { StudentFormEligibility } from '@/types/student';

interface Props {
  form: PublicFormSummary;
  isClosed?: boolean;
}

export function PublicFeedbackCard({ form, isClosed }: Props) {
  const [copied, setCopied] = useState(false);
  const [hasOpenedForm, setHasOpenedForm] = useState(false);
  const [eligibility, setEligibility] = useState<StudentFormEligibility | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);

  const directLink = typeof window !== 'undefined'
    ? `${window.location.origin}/feedback/${form.id}`
    : `/feedback/${form.id}`;

  useEffect(() => {
    let isMounted = true;
    async function check() {
      try {
        const res = await checkStudentFormEligibilityAction(form.id);
        if (isMounted) {
          setEligibility(res);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoadingEligibility(false);
      }
    }
    check();
    return () => {
      isMounted = false;
    };
  }, [form.id]);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(directLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closed = isClosed || form.status === 'CLOSED';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-bce-cobalt/40 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Top Banner Accent */}
      <div className={`h-2.5 w-full ${closed ? 'bg-amber-500' : 'bg-gradient-to-r from-bce-navy via-bce-cobalt to-indigo-600'}`} />

      <div className="p-3.5 sm:p-7 space-y-3.5 sm:space-y-6">
        {/* Status & Privacy Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {closed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Ban className="w-3.5 h-3.5 text-amber-700" />
                Submissions Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Published & Active
              </span>
            )}
            <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-100 text-slate-600">
              {form.form_type === 'FACULTY_SPECIFIC' ? 'Faculty Evaluation' : 'Department Course Feedback'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Anonymous Evaluation</span>
          </div>
        </div>

        {/* Institution Badge if available */}
        {form.college && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 font-normal">Institution:</span>
            <span className="text-slate-900">{form.college.name}</span>
            {form.college.code && (
              <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-mono text-[10px]">
                {form.college.code}
              </span>
            )}
          </div>
        )}

        {/* Faculty & Subject Details */}
        <div className="space-y-3 sm:space-y-4">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Faculty Member
            </span>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 text-bce-cobalt flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-bce-cobalt" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-xl leading-tight">
                  {form.faculty?.name || 'Faculty Member'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {form.faculty?.designation || 'Faculty'} • Department of {form.faculty?.department || form.branch?.name || 'Engineering'}
                </p>
              </div>
            </div>
          </div>

          {/* Academic Scope Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
            <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 sm:gap-3">
              <BookOpen className="w-4 h-4 text-bce-cobalt shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">Course Subject</span>
                <span className="font-bold text-xs text-slate-900 block">
                  {form.subject?.name || 'Subject'}
                </span>
                {form.subject?.code && (
                  <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200 inline-block mt-0.5">
                    {form.subject.code}
                  </span>
                )}
              </div>
            </div>

            <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 sm:gap-3">
              <GraduationCap className="w-4 h-4 text-bce-cobalt shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">Department & Cohort</span>
                <span className="font-bold text-xs text-slate-900 block">
                  {form.branch?.name || 'Branch'} ({form.branch?.code || ''})
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 block">
                  {form.semester?.name || 'Semester'} • {form.academic_year?.name || 'Session'}
                </span>
              </div>
            </div>
          </div>

          {/* Academic 8-Parameter Info Pill */}
          <div className="p-2.5 sm:p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-bce-cobalt shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-[11px] sm:text-[12px]">Standard 8-Parameter Academic Evaluation</p>
              <p className="text-[10.5px] sm:text-[11px] text-blue-900/80 leading-relaxed">
                Includes syllabus covered, communication skills, teaching effectiveness, teacher accessibility, willingness to help, evaluation fairness, and overall rating.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Action Area */}
        <div className="pt-2 sm:pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors w-full sm:w-auto justify-center"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Link Copied' : 'Share Direct Form Link'}</span>
          </button>

          {closed ? (
            <div className="w-full sm:w-auto text-center sm:text-right">
              <span className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-slate-200 text-slate-500 rounded-xl font-bold text-xs sm:text-sm cursor-not-allowed">
                <Ban className="w-4 h-4" />
                Submissions Closed
              </span>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">This feedback form has concluded.</p>
            </div>
          ) : eligibility?.reason === 'CROSS_COLLEGE_RESTRICTED' ? (
            <div className="w-full sm:w-auto p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Restricted Institution Access</span>
              </div>
              <p className="text-[11px] text-red-700">{eligibility.message}</p>
            </div>
          ) : eligibility?.reason === 'EMAIL_NOT_VERIFIED' ? (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
              <span className="text-amber-800 font-medium">Please verify your email address to access forms.</span>
              <Link
                href="/auth/student/verify"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors shrink-0"
              >
                Verify Email
              </Link>
            </div>
          ) : !eligibility?.isAuthenticated && !loadingEligibility ? (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <Link
                href={`/auth/student/login?redirect=${encodeURIComponent(directLink)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-to-r from-bce-cobalt to-indigo-600 hover:from-bce-navy hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-98"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Sign In to Open Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : eligibility?.alreadySubmitted ? (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Already Submitted
              </span>
              <Link
                href={`/feedback/confirmation?formId=${form.id}${form.college?.slug ? `&tenant=${form.college.slug}` : ''}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 p-1"
              >
                <span>View Receipt</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : form.google_form_url ? (
            <ExternalActionLink
              href={form.google_form_url}
              openingText="Opening Form..."
              onClick={() => setHasOpenedForm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-to-r from-bce-cobalt to-indigo-600 hover:from-bce-navy hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-98"
            >
              <span>Open Feedback Form</span>
              <ExternalLink className="w-4 h-4" />
            </ExternalActionLink>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
              Google Form responder URL is not available. Please contact administration.
            </div>
          )}
        </div>

        {/* Dynamic banner after opening form */}
        {hasOpenedForm && (
          <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs text-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-ping" />
              <span className="font-medium text-slate-700">Form opened in new tab. Finished submitting your response?</span>
            </div>
            <Link
              href={`/feedback/confirmation?formId=${form.id}${form.college?.slug ? `&tenant=${form.college.slug}` : ''}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shrink-0 shadow-sm active:scale-[0.98]"
            >
              <span>View Confirmation & More Forms</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Post-submission helper to return to custom completion experience */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span className="text-center sm:text-left">Finished submitting your response on Google Forms?</span>
          <Link
            href={`/feedback/confirmation?formId=${form.id}${form.college?.slug ? `&tenant=${form.college.slug}` : ''}`}
            className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <span>View Submission Receipt & More Forms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
