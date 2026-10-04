'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  GraduationCap,
  Calendar,
  Phone,
  Hash,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import {
  updateStudentEventRegistrationAction,
  getEventAcademicMastersByEventIdAction,
} from '@/app/admin/events/event-registration-actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: CollegeEvent;
  participant: {
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile?: string;
    branch?: string;
    semester?: string;
  };
  onSuccess: (updated: {
    fullName: string;
    studentId: string;
    mobile?: string;
    branch?: string;
    semester?: string;
  }) => void;
}

export function EditEventPassModal({
  isOpen,
  onClose,
  event,
  participant,
  onSuccess,
}: Props) {
  const [fullName, setFullName] = useState(participant.fullName || '');
  const [studentId, setStudentId] = useState(participant.studentId || '');
  const [mobile, setMobile] = useState(participant.mobile || '');
  const [branch, setBranch] = useState(participant.branch || '');
  const [semester, setSemester] = useState(participant.semester || '');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [customBranch, setCustomBranch] = useState(false);
  const [customSemester, setCustomSemester] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state when participant props change
  useEffect(() => {
    if (isOpen) {
      setFullName(participant.fullName || '');
      setStudentId(participant.studentId || '');
      setMobile(participant.mobile || '');
      setBranch(participant.branch || '');
      setSemester(participant.semester || '');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, participant]);

  // Load college branches and semesters
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadMasters() {
      try {
        const data = await getEventAcademicMastersByEventIdAction(event.id);
        if (isMounted) {
          setBranches(data.branches || []);
          setSemesters(data.semesters || []);

          // Check if current branch/semester matches any master
          if (participant.branch && data.branches.length > 0) {
            const hasBranch = data.branches.some(
              (b) => b.name === participant.branch || b.code === participant.branch
            );
            if (!hasBranch) setCustomBranch(true);
          }
          if (participant.semester && data.semesters.length > 0) {
            const hasSem = data.semesters.some(
              (s) => s.name === participant.semester || String(s.semester_number) === participant.semester
            );
            if (!hasSem) setCustomSemester(true);
          }
        }
      } catch {
        // non-fatal
      }
    }
    loadMasters();
    return () => {
      isMounted = false;
    };
  }, [isOpen, event.id, participant.branch, participant.semester]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }

    const cleanStudentId = studentId.trim();
    if (!cleanStudentId) {
      setErrorMsg('Roll Number / Student ID cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateStudentEventRegistrationAction({
        eventId: event.id,
        registrationNumber: participant.registrationNumber,
        fullName: cleanName,
        studentId: cleanStudentId,
        mobile: mobile.trim(),
        branch: branch.trim(),
        semester: semester.trim(),
      });

      if (res.success && res.participant) {
        setSuccessMsg('Event pass updated successfully!');
        onSuccess({
          fullName: res.participant.fullName,
          studentId: res.participant.studentId,
          mobile: res.participant.mobile,
          branch: res.participant.branch,
          semester: res.participant.semester,
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Failed to update registration details.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-white relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Edit Event Pass</h3>
              <p className="text-xs text-slate-400">Update your participant and academic details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Locked Badges: Registration # & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Event Pass / Reg #
              </span>
              <span className="font-mono font-bold text-amber-400 break-all">
                {participant.registrationNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Verified Email
              </span>
              <span className="text-slate-300 break-all flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {participant.email}
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Full Name *</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 outline-hidden transition-all"
            />
          </div>

          {/* Roll Number / Student ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>College Roll Number / Student ID *</span>
            </label>
            <input
              type="text"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. 234 or 24533"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-mono text-white placeholder-slate-500 outline-hidden transition-all"
            />
          </div>

          {/* Branch & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Branch */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>Branch</span>
                </span>
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomBranch(!customBranch)}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    {customBranch ? 'Select from list' : 'Custom'}
                  </button>
                )}
              </label>

              {customBranch || branches.length === 0 ? (
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. CSE, ECE, ME"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 text-sm text-white placeholder-slate-500 outline-hidden transition-all"
                />
              ) : (
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 text-sm text-white outline-hidden transition-all"
                >
                  <option value="">Select Department</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Semester */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Semester</span>
                </span>
                {semesters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomSemester(!customSemester)}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    {customSemester ? 'Select from list' : 'Custom'}
                  </button>
                )}
              </label>

              {customSemester || semesters.length === 0 ? (
                <input
                  type="text"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="e.g. 3rd Semester, 1st Year"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 text-sm text-white placeholder-slate-500 outline-hidden transition-all"
                />
              ) : (
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 text-sm text-white outline-hidden transition-all"
                >
                  <option value="">Select Semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>Mobile Number</span>
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 outline-hidden transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Google Sheet...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
