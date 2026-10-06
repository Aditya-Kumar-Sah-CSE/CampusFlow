'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, User, ArrowRight, Sparkles } from 'lucide-react';
import type { PublicFormSummary } from '@/app/feedback/actions';

interface Props {
  forms: PublicFormSummary[];
  collegeSlug?: string;
  collegeName?: string;
}

export function MoreFeedbackForms({ forms, collegeSlug, collegeName }: Props) {
  if (!forms || forms.length === 0) {
    return null; // Zero fake recommendations: strictly hide when no additional forms exist
  }

  const allFeedbackPath = collegeSlug ? `/${collegeSlug}/feedback` : '/feedback';

  return (
    <section id="more-forms" className="w-full space-y-4 pt-8 border-t border-slate-200/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 tracking-tight uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>More Feedback Forms</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active curriculum evaluations available for {collegeName || 'your institution'}.
          </p>
        </div>

        <Link
          href={allFeedbackPath}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors self-start sm:self-auto"
        >
          <span>View All Forms</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {forms.slice(0, 4).map((form) => {
          const directFormLink = collegeSlug
            ? `/${collegeSlug}/feedback/${form.id}`
            : `/feedback/${form.id}`;

          return (
            <div
              key={form.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between group"
            >
              <div className="space-y-2.5">
                {/* Faculty badge */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {form.faculty?.name || form.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      {form.faculty?.designation || 'Faculty Member'}
                    </p>
                  </div>
                </div>

                {/* Subject & Class details */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">
                      {form.subject?.name || form.title}
                    </span>
                    {form.subject?.code && (
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200 shrink-0">
                        {form.subject.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {form.branch?.name || 'Department'} • {form.semester?.name || 'Semester'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Active Form
                </span>
                <Link
                  href={directFormLink}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <span>Give Feedback</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
