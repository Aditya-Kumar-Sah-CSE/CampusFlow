'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  School,
  User,
  Calendar,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Phone,
  FileText,
  Hash,
  GraduationCap,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import type { StudentProfile } from '@/types/student';
import { getCollegeAcademicMastersForStudentAction } from '@/app/auth/student/actions';
import { RedPushpin } from '@/components/ui/RedPushpin';
import { ExamPadClip } from '@/components/ui/ExamPadCard';

interface StudentCoordinatorApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  userEmail?: string;
  userName?: string;
}

const DEFAULT_BRANCHES = [
  'Computer Science & Engineering (CSE)',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical Engineering (EE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CE)',
  'Chemical Engineering',
  'Artificial Intelligence & Machine Learning (AI & ML)',
  'Data Science (DS)',
  'Biotechnology',
  'Aerospace Engineering',
  'Bachelor of Computer Applications (BCA)',
  'Master of Computer Applications (MCA)',
  'B.Sc Computer Science / IT',
  'BBA / MBA',
];

const DEFAULT_SEMESTERS = [
  '1st Semester (Sem 1)',
  '2nd Semester (Sem 2)',
  '3rd Semester (Sem 3)',
  '4th Semester (Sem 4)',
  '5th Semester (Sem 5)',
  '6th Semester (Sem 6)',
  '7th Semester (Sem 7)',
  '8th Semester (Sem 8)',
];

const DEFAULT_SESSIONS = [
  '2026-2030',
  '2025-2029',
  '2024-2028',
  '2023-2027',
  '2022-2026',
  '2021-2025',
  '2020-2024',
];

export function StudentCoordinatorApplyModal({
  isOpen,
  onClose,
  student,
  userEmail,
  userName,
}: StudentCoordinatorApplyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields - Step 1: Academic & Personal
  const [mobile, setMobile] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [isCustomBranch, setIsCustomBranch] = useState(false);
  const [customBranchName, setCustomBranchName] = useState('');
  const [semester, setSemester] = useState('');
  const [academicSession, setAcademicSession] = useState('');
  const [isCustomSession, setIsCustomSession] = useState(false);
  const [customSessionText, setCustomSessionText] = useState('');

  // Form Fields - Step 2: Role & Security
  const [eventDescription, setEventDescription] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Dynamic Data
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [availableBranches, setAvailableBranches] = useState<string[]>(DEFAULT_BRANCHES);
  const [availableSessions, setAvailableSessions] = useState<string[]>(DEFAULT_SESSIONS);

  const fullName = student?.fullName || userName || '';
  const email = student?.email || userEmail || '';
  const collegeId = student?.collegeId || '';
  const collegeName = student?.collegeName || 'Your College';
  const collegeCode = student?.collegeCode || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize and load college masters whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setRegistrationNumber(student?.registrationNumber || '');
      setMobile('');
      setRollNumber('');
      setBranch('');
      setIsCustomBranch(false);
      setCustomBranchName('');
      setSemester('');
      setAcademicSession('');
      setIsCustomSession(false);
      setCustomSessionText('');
      setEventDescription('');
      setPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);

      if (collegeId) {
        getCollegeAcademicMastersForStudentAction(collegeId)
          .then((res) => {
            if (res.success) {
              const collegeBranchNames = (res.branches || []).map(
                (b) => `${b.name}${b.code ? ` (${b.code})` : ''}`
              );
              const merged = Array.from(
                new Set([...collegeBranchNames, ...DEFAULT_BRANCHES])
              );
              if (merged.length > 0) setAvailableBranches(merged);

              if (res.academicYears && res.academicYears.length > 0) {
                const years = res.academicYears.map((y) => y.name);
                const mergedYears = Array.from(
                  new Set([...years, ...DEFAULT_SESSIONS])
                );
                setAvailableSessions(mergedYears);
              }
            }
          })
          .catch((err) => {
            console.warn('[CoordinatorModal] Could not fetch college masters:', err);
          });
      }
    }
  }, [isOpen, student, collegeId]);

  if (!isOpen || !mounted) return null;

  const handleNextStep = () => {
    setErrorMsg(null);

    const cleanMobile = mobile.trim();
    if (!cleanMobile) {
      setErrorMsg('Mobile number is required.');
      return;
    }
    const phoneDigits = cleanMobile.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    const cleanReg = registrationNumber.trim();
    if (!cleanReg) {
      setErrorMsg('University/College Registration Number is required.');
      return;
    }

    const cleanRoll = rollNumber.trim();
    if (!cleanRoll) {
      setErrorMsg('Class / College Roll Number is required.');
      return;
    }

    const resolvedBranch = isCustomBranch ? customBranchName.trim() : branch.trim();
    if (!resolvedBranch) {
      setErrorMsg('Please select or specify your department / branch.');
      return;
    }

    if (!semester.trim()) {
      setErrorMsg('Please select your current semester.');
      return;
    }

    const resolvedSession = isCustomSession ? customSessionText.trim() : academicSession.trim();
    if (!resolvedSession) {
      setErrorMsg('Please select or enter your academic session.');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!collegeId) {
      setErrorMsg('College identifier is missing. Please ensure your student profile is linked to an institution.');
      return;
    }

    const cleanDesc = eventDescription.trim();
    if (!cleanDesc) {
      setErrorMsg('Event experience and coordinator vision statement is required.');
      return;
    }
    if (cleanDesc.length < 15) {
      setErrorMsg('Please provide at least 15 characters describing your event experience and vision.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Please choose an admin login password of at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    const cleanMobile = mobile.trim();
    const cleanReg = registrationNumber.trim();
    const cleanRoll = rollNumber.trim();
    const resolvedBranch = isCustomBranch ? customBranchName.trim() : branch.trim();
    const resolvedSession = isCustomSession ? customSessionText.trim() : academicSession.trim();

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: email.trim().toLowerCase(),
          password,
          collegeId,
          role: 'EVENT_COORDINATOR',
          phone: cleanMobile,
          registrationNumber: cleanReg,
          rollNumber: cleanRoll,
          branch: resolvedBranch,
          semester: semester.trim(),
          academicSession: resolvedSession,
          eventDescription: cleanDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to submit coordinator application.');
      }

      setSuccessMsg(
        data?.message ||
          'Your application for Event Coordinator has been submitted! Your college’s Primary Admin will review your credentials and approve your coordinator access.'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      {/* Authentic ExamPad Wooden Clipboard Wrapper */}
      <div className="relative w-full max-w-xl exam-pad-board-dashboard rounded-lg shadow-2xl p-2 sm:p-3 pt-8 sm:pt-9 overflow-visible flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] animate-in zoom-in-95 duration-150">
        {/* Authentic Top Metal Exam Clip */}
        <ExamPadClip label="COORDINATOR" size="compact" />

        {/* Brass Corner Brackets */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/80 pointer-events-none rounded-tl-xs" />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/80 pointer-events-none rounded-tr-xs" />
        <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/80 pointer-events-none rounded-bl-xs" />
        <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/80 pointer-events-none rounded-br-xs" />

        {/* Pinned Paper Sheet */}
        <div className="relative z-10 w-full pinned-paper-sheet bg-[#fffdfa] dark:bg-[#191108] border border-amber-900/30 dark:border-[#422e17] rounded-[3px] shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Header Banner on Paper */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-amber-900/20 dark:border-[#382713] bg-amber-50/70 dark:bg-[#20150b]/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[3px] bg-amber-600/20 text-amber-900 dark:text-amber-300 border border-amber-600/30 flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="coordinator-modal-title" className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#faebd0] truncate">
                    Apply as Event Coordinator
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-amber-200/80 dark:bg-[#34220e] text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60">
                    Step {step} of 2
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-[#c4a97d] truncate">
                  {step === 1 ? 'Step 1: Academic & Identity Verification' : 'Step 2: Leadership Experience & Admin Security'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close dialog"
              className="p-1.5 rounded-[3px] text-slate-500 hover:text-slate-800 dark:text-amber-300/80 dark:hover:text-amber-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2-Step Progress Indicator */}
          <div className="px-4 pt-2.5 pb-2 border-b border-amber-900/15 dark:border-[#332311] bg-white/60 dark:bg-[#160f07]/60 shrink-0">
            <div className="flex items-center justify-between gap-2 max-w-sm mx-auto">
              <div
                className={`flex-1 flex items-center gap-2 p-1.5 rounded-[3px] border text-xs font-bold transition-all ${
                  step === 1
                    ? 'bg-amber-100/80 dark:bg-[#2e1d0c] text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#191108] text-slate-500 dark:text-[#9e835b] border-slate-200 dark:border-[#382613]'
                }`}
              >
                <span className="w-5 h-5 rounded-[2px] bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">
                  1
                </span>
                <span className="truncate">Academic Details</span>
              </div>

              <div className="w-4 h-0.5 bg-amber-300 dark:bg-amber-900 shrink-0" />

              <div
                className={`flex-1 flex items-center gap-2 p-1.5 rounded-[3px] border text-xs font-bold transition-all ${
                  step === 2
                    ? 'bg-amber-100/80 dark:bg-[#2e1d0c] text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 shadow-2xs'
                    : 'bg-slate-50 dark:bg-[#191108] text-slate-500 dark:text-[#9e835b] border-slate-200 dark:border-[#382613]'
                }`}
              >
                <span className="w-5 h-5 rounded-[2px] bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">
                  2
                </span>
                <span className="truncate">Role &amp; Password</span>
              </div>
            </div>
          </div>

          {/* Modal Body (Scrollable) */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 text-slate-900 dark:text-[#faebd0]">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 rounded-[3px] text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {successMsg ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-[3px] text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Application Submitted Successfully!</span>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                    {successMsg}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/50 dark:bg-[#1f150c] rounded-[3px] border border-amber-200/70 dark:border-[#3d2c18] text-xs space-y-1.5 text-slate-700 dark:text-[#c4a97d]">
                  <p className="font-bold text-slate-900 dark:text-[#faebd0]">Next Steps &amp; Portal Access:</p>
                  <p>1. Your college’s Primary Admin will review and verify your university registration and event vision statement.</p>
                  <p>2. Once verified, log in to the Institutional Admin Portal using your email and password to access the Events Management tab.</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* STEP 1: ACADEMIC & PERSONAL DETAILS */}
                {step === 1 && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    {/* Student Overview Card */}
                    <div className="p-3 bg-amber-50/60 dark:bg-[#22160d] rounded-[3px] border border-amber-200/80 dark:border-[#422e17] text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-[#a08255] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Student:
                        </span>
                        <span className="font-bold text-slate-900 dark:text-[#faebd0]">{fullName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-[#a08255]">Email:</span>
                        <span className="font-mono text-slate-800 dark:text-amber-200">{email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 dark:text-[#a08255] flex items-center gap-1.5">
                          <School className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> College:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-[#faebd0] truncate max-w-[200px]" title={collegeName}>
                          {collegeName} {collegeCode ? `(${collegeCode})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* 2-Column Responsive Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Mobile */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <input
                            type="tel"
                            required
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            placeholder="e.g. 9876543210"
                            className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Reg No */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Reg No (University) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <input
                            type="text"
                            required
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                            placeholder="e.g. 21105123001"
                            className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Roll No */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Class / College Roll No <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Hash className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <input
                            type="text"
                            required
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            placeholder="e.g. 21CS04 or 42"
                            className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Branch Dropdown */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Branch / Department <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          {!isCustomBranch ? (
                            <select
                              required
                              value={branch}
                              onChange={(e) => {
                                if (e.target.value === '__OTHER__') {
                                  setIsCustomBranch(true);
                                  setBranch('');
                                } else {
                                  setBranch(e.target.value);
                                }
                              }}
                              className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                            >
                              <option value="">Select Branch</option>
                              {availableBranches.map((bName) => (
                                <option key={bName} value={bName}>
                                  {bName}
                                </option>
                              ))}
                              <option value="__OTHER__">+ Other Branch (Type manually)</option>
                            </select>
                          ) : (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                required
                                value={customBranchName}
                                onChange={(e) => setCustomBranchName(e.target.value)}
                                placeholder="Type your branch name"
                                className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomBranch(false);
                                  setCustomBranchName('');
                                }}
                                className="px-2 py-1 text-[10px] text-slate-600 dark:text-amber-300 bg-slate-100 dark:bg-[#2b1f11] rounded-[3px] border border-slate-300 dark:border-[#4d3817]"
                              >
                                List
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Semester */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Semester <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <select
                            required
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          >
                            <option value="">Select Current Semester</option>
                            {DEFAULT_SEMESTERS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Academic Session */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Academic Session <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          {!isCustomSession ? (
                            <select
                              required
                              value={academicSession}
                              onChange={(e) => {
                                if (e.target.value === '__OTHER_SESSION__') {
                                  setIsCustomSession(true);
                                  setAcademicSession('');
                                } else {
                                  setAcademicSession(e.target.value);
                                }
                              }}
                              className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                            >
                              <option value="">Select Academic Session</option>
                              {availableSessions.map((sess) => (
                                <option key={sess} value={sess}>
                                  {sess}
                                </option>
                              ))}
                              <option value="__OTHER_SESSION__">+ Other Session</option>
                            </select>
                          ) : (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                required
                                value={customSessionText}
                                onChange={(e) => setCustomSessionText(e.target.value)}
                                placeholder="e.g. 2024-2028"
                                className="block w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomSession(false);
                                  setCustomSessionText('');
                                }}
                                className="px-2 py-1 text-[10px] text-slate-600 dark:text-amber-300 bg-slate-100 dark:bg-[#2b1f11] rounded-[3px] border border-slate-300 dark:border-[#4d3817]"
                              >
                                List
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-amber-900/15 dark:border-[#382713]">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#251a10] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
                      >
                        <span>Next: Role &amp; Security</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: ROLE & SECURITY DETAILS */}
                {step === 2 && (
                  <div className="space-y-3.5 animate-in fade-in duration-150">
                    {/* Event Description */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>
                          Event Experience &amp; Description <span className="text-rose-500">*</span>
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold normal-case">
                          Mandatory for Review
                        </span>
                      </label>
                      <div className="relative">
                        <textarea
                          required
                          rows={3}
                          minLength={15}
                          value={eventDescription}
                          onChange={(e) => setEventDescription(e.target.value)}
                          placeholder="Describe your past event experience, organizing skills, and your vision/plans for college fests, competitions & events..."
                          className="block w-full p-2.5 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs resize-none"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#a08255] mt-1">
                        Explain why you should be appointed as Event Coordinator and your past leadership or event participation experience.
                      </p>
                    </div>

                    {/* Password Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-amber-900/15 dark:border-[#382713]">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Create Login Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="block w-full pl-9 pr-9 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-amber-400/80 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider mb-1">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-[#9e835b]">
                            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="block w-full pl-9 pr-9 py-2 text-xs rounded-[3px] border border-slate-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1208] text-slate-900 dark:text-[#faebd0] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-amber-400/80 cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Verification info note */}
                    <div className="p-2.5 bg-amber-50/60 dark:bg-[#1f150c] rounded-[3px] border border-amber-200/70 dark:border-[#382713] text-[11px] text-slate-700 dark:text-[#c4a97d] flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Applications are verified by your college Primary Admin. Once approved, you can log in to manage campus events.
                      </span>
                    </div>

                    {/* Step 2 Actions */}
                    <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-amber-900/15 dark:border-[#382713]">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setStep(1);
                        }}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#251a10] transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onClose}
                          disabled={isSubmitting}
                          className="px-3 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:bg-slate-100 dark:hover:bg-[#251a10] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Application</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
