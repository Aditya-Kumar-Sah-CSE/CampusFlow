'use client';

import React, { useState } from 'react';
import {
  Building2,
  Sliders,
  Send,
  Users,
  Database,
  FileCheck2,
  ChevronRight,
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  stepNumber: string;
  title: string;
  action: string;
  detail: string;
  icon: React.ElementType;
}

const STEPS: WorkflowStep[] = [
  {
    id: 'step-1',
    stepNumber: '01',
    title: 'Institution',
    action: 'Select or register college',
    detail: 'Navigate to tenant portal (/[tenant]) with custom college identity.',
    icon: Building2,
  },
  {
    id: 'step-2',
    stepNumber: '02',
    title: 'Configure',
    action: 'Set academic & event criteria',
    detail: 'Map branches, faculties, subjects, or competition categories and rules.',
    icon: Sliders,
  },
  {
    id: 'step-3',
    stepNumber: '03',
    title: 'Publish',
    action: 'Open portal to students',
    detail: 'Activate feedback window or open event registration with timelines.',
    icon: Send,
  },
  {
    id: 'step-4',
    stepNumber: '04',
    title: 'Student Participation',
    action: 'Submit or register',
    detail: 'Students submit anonymous evaluations or enroll with team invite codes.',
    icon: Users,
  },
  {
    id: 'step-5',
    stepNumber: '05',
    title: 'Collect Responses',
    action: 'Sync responses & verify fees',
    detail: 'Sync Google Sheets data automatically or verify UPI UTR references.',
    icon: Database,
  },
  {
    id: 'step-6',
    stepNumber: '06',
    title: 'Reports & Passes',
    action: 'Generate passes & analytics',
    detail: 'Issue digital QR passes, verify at gates, and export PDF/CSV rosters.',
    icon: FileCheck2,
  },
];

export function AboutWorkflowClient() {
  const [activeStepId, setActiveStepId] = useState<string>('step-1');

  return (
    <div className="space-y-4">
      {/* Step Buttons / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStepId === step.id;

          return (
            <div key={step.id} className="relative flex flex-col">
              <button
                type="button"
                onClick={() => setActiveStepId(step.id)}
                onMouseEnter={() => setActiveStepId(step.id)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between h-full group focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-50/80 border-blue-300 shadow-sm translate-y-[-2px]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
                aria-pressed={isActive}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}
                    >
                      {step.stepNumber}
                    </span>
                    <Icon
                      className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                    {step.action}
                  </p>
                </div>

                {/* Micro Active Indicator */}
                <div
                  className={`mt-3 h-1 w-full rounded-full transition-colors ${
                    isActive ? 'bg-blue-600' : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}
                />
              </button>

              {/* Desktop Horizontal Arrow indicator (between cards) */}
              {idx < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-300">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Step Highlight Card */}
      {(() => {
        const current = STEPS.find((s) => s.id === activeStepId) || STEPS[0];
        const CurrentIcon = current.icon;
        return (
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-blue-100 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <CurrentIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Workflow Step {current.stepNumber} · {current.title}
                </span>
                <p className="font-semibold text-slate-900">{current.detail}</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline shrink-0">
              Hover or tap any step to inspect workflow
            </span>
          </div>
        );
      })()}
    </div>
  );
}
