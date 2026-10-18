'use client';

import React, { useState, useEffect } from 'react';
import {
  School,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { ExamPadClip } from '@/components/ui/ExamPadCard';
import type { College } from '@/types/tenant';
import type { CreateCollegeInput } from '@/lib/validation';

interface InstitutionModalProps {
  isOpen: boolean;
  isEdit: boolean;
  editingCollege: College | null;
  formData: CreateCollegeInput;
  setFormData: React.Dispatch<React.SetStateAction<CreateCollegeInput>>;
  formError: string | null;
  setFormError: (err: string | null) => void;
  submitting: boolean;
  handleNameChange: (val: string) => void;
  setIsSlugManuallyEdited: (val: boolean) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function InstitutionModal({
  isOpen,
  isEdit,
  editingCollege,
  formData,
  setFormData,
  formError,
  setFormError,
  submitting,
  handleNameChange,
  setIsSlugManuallyEdited,
  onClose,
  onSubmit,
}: InstitutionModalProps) {
  const [instStep, setInstStep] = useState<1 | 2>(1);

  // Reset to step 1 whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setInstStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNextStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!formData.name?.trim()) {
      setFormError('Please enter the College Name.');
      return;
    }
    if (!formData.code?.trim()) {
      setFormError('Please enter the College Code / Short Name.');
      return;
    }
    if (!formData.slug?.trim()) {
      setFormError('Please enter a valid Public Slug.');
      return;
    }
    setFormError(null);
    setInstStep(2);
  };

  const handlePrevStep = () => {
    setFormError(null);
    setInstStep(1);
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instStep === 1) {
      handleNextStep();
    } else {
      onSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="exam-pad-board-dashboard max-w-2xl w-full rounded-lg p-2.5 sm:p-3.5 pt-10 sm:pt-12 relative overflow-visible shadow-2xl my-auto">
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip
          label={isEdit ? 'EDIT INSTITUTION' : 'NEW INSTITUTION'}
          size="default"
        />

        {/* Brass Corner Brackets */}
        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Pinned Paper Sheet Container */}
        <div className="pinned-paper-sheet bg-[#fffdfa] dark:bg-[#1a1208] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] p-4 sm:p-6 text-slate-800 dark:text-[#faebd0] shadow-sm flex flex-col max-h-[85vh] overflow-hidden">
          {/* 1. Modal Top Bar */}
          <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-amber-900/20 dark:border-[#382713] shrink-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
                <School className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{isEdit ? 'Edit Institution' : 'Register New Institution'}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#c4a97d] mt-0.5 font-medium">
                {isEdit
                  ? 'Modify institution identity, portal access, campus contact, and module visibility.'
                  : 'Register a new college tenant and configure its public feedback & events portal.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-[#faebd0] p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Stepper Header Tabs */}
          <div className="py-3 border-b border-amber-900/15 dark:border-[#2d1e0e] shrink-0">
            <div className="flex items-center justify-between text-xs font-bold gap-2">
              <button
                type="button"
                onClick={handlePrevStep}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[3px] border transition-all cursor-pointer ${
                  instStep === 1
                    ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-900 dark:text-amber-300 border-amber-500/50 shadow-2xs font-extrabold'
                    : 'bg-slate-100 dark:bg-[#20140a] text-slate-600 dark:text-[#a8906c] border-slate-200 dark:border-[#382713] font-semibold'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    instStep === 1
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-300 dark:bg-[#382713] text-slate-700 dark:text-[#faebd0]'
                  }`}
                >
                  1
                </span>
                <span>1. Core Identity &amp; Portal</span>
              </button>

              <div className="h-0.5 w-4 sm:w-8 bg-amber-900/20 dark:bg-[#382713] shrink-0" />

              <button
                type="button"
                onClick={handleNextStep}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[3px] border transition-all cursor-pointer ${
                  instStep === 2
                    ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-900 dark:text-amber-300 border-amber-500/50 shadow-2xs font-extrabold'
                    : 'bg-slate-100 dark:bg-[#20140a] text-slate-600 dark:text-[#a8906c] border-slate-200 dark:border-[#382713] font-semibold'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                    instStep === 2
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-300 dark:bg-[#382713] text-slate-700 dark:text-[#faebd0]'
                  }`}
                >
                  2
                </span>
                <span>2. Campus &amp; Modules</span>
              </button>
            </div>
          </div>

          {/* 3. Form Body */}
          <form onSubmit={onFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="py-4 space-y-4 overflow-y-auto flex-1 overscroll-contain pr-1">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-[3px] text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: Core Identity & Portal Access */}
              {instStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* College Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      College Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Munger College of Engineering"
                      value={formData.name}
                      onChange={(e) => {
                        if (isEdit) {
                          setFormData({ ...formData, name: e.target.value });
                        } else {
                          handleNameChange(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* College Code */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        College Code / Short Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MCE-MUNGER"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                      />
                    </div>

                    {/* Slug */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Public Slug <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-2 text-xs bg-slate-100 dark:bg-[#281b0f] border border-r-0 border-slate-300 dark:border-[#4d3817] text-slate-500 dark:text-[#c4a97d] rounded-l-[3px] font-mono">
                          /
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="mce-munger"
                          value={formData.slug}
                          onChange={(e) => {
                            setIsSlugManuallyEdited(true);
                            setFormData({
                              ...formData,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                            });
                          }}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-r-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo Image URL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Logo Image URL <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={formData.logoUrl || ''}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Institutional Tagline <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Excellence in Technical Education & Research"
                      value={formData.tagline || ''}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Campus Details & Landing Modules */}
              {instStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Address / City */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                      Campus Address / City <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Munger, Bihar - 811201"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Contact Email <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="principal@mce.ac.in"
                        value={formData.contactEmail || ''}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Contact Phone <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="+91 94708 70830"
                        value={formData.contactPhone || ''}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Official Website <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://mcemunger.ac.in"
                        value={formData.websiteUrl || ''}
                        onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Affiliated University */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Affiliated University <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bihar Engineering University"
                        value={formData.affiliatedUniversity || ''}
                        onChange={(e) => setFormData({ ...formData, affiliatedUniversity: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Established Year */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-[#faebd0] mb-1">
                        Established Year <span className="text-slate-400 dark:text-[#8a7251] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="number"
                        min="1800"
                        max="2100"
                        placeholder="2019"
                        value={formData.establishedYear || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            establishedYear: e.target.value ? parseInt(e.target.value, 10) : null,
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] text-slate-900 dark:text-[#faebd0] focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Public Landing Page Display Modules */}
                  <div className="p-3.5 rounded-[3px] bg-slate-50/90 dark:bg-[#140e08] border border-slate-200 dark:border-[#382713] space-y-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-[#faebd0]">Public Portal Modules</h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#c4a97d]">
                        Control visible sections on institution landing page.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <label className="flex items-start gap-2.5 p-2.5 rounded-[3px] bg-white dark:bg-[#1f150c] border border-slate-200 dark:border-[#4d3817] hover:border-amber-400 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.showFeedbacks !== false}
                          onChange={(e) => setFormData({ ...formData, showFeedbacks: e.target.checked })}
                          className="w-4 h-4 text-amber-600 rounded-[2px] border-slate-300 focus:ring-amber-500 mt-0.5"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0] block">
                            Feedback Module
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-[#c4a97d] block leading-tight">
                            Student forms &amp; cascading discovery
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2.5 rounded-[3px] bg-white dark:bg-[#1f150c] border border-slate-200 dark:border-[#4d3817] hover:border-amber-400 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.showEvents !== false}
                          onChange={(e) => setFormData({ ...formData, showEvents: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 rounded-[2px] border-slate-300 focus:ring-emerald-500 mt-0.5"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0] block">
                            Events Module
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-[#c4a97d] block leading-tight">
                            Campus fests, workshops &amp; passes
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Status Toggle */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-[#faebd0]">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 text-amber-600 rounded-[2px] border-slate-300 focus:ring-amber-500"
                      />
                      <span>Active (Available on public portal &amp; institution switcher)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Action Buttons (Footer) */}
            <div className="pt-3 border-t border-amber-900/20 dark:border-[#382713] flex items-center justify-between gap-2.5 shrink-0">
              {instStep === 2 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-[#c4a97d] hover:text-slate-900 dark:hover:text-[#faebd0] border border-slate-300 dark:border-[#4d3817] rounded-[3px] hover:bg-slate-100 dark:hover:bg-[#20150b] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Step 1</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-[#a8906c] hover:text-slate-900 dark:hover:text-[#faebd0] rounded-[3px] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <div className="flex items-center gap-2">
                {instStep === 2 && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-[#a8906c] hover:text-slate-900 dark:hover:text-[#faebd0] rounded-[3px] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                {instStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-bce-cobalt hover:bg-slate-900 text-white rounded-[3px] text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <span>Next: Campus Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-bce-cobalt hover:bg-slate-900 disabled:opacity-50 text-white rounded-[3px] text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isEdit ? 'Save Changes' : 'Create Institution'}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
