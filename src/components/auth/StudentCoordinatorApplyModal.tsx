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
  ShieldCheck,
  Eye,
  EyeOff,
  Phone,
  FileText,
  Hash,
  GraduationCap,
  Clock,
  Layers,
} from 'lucide-react';
import type { StudentProfile } from '@/types/student';
import { getCollegeAcademicMastersForStudentAction } from '@/app/auth/student/actions';

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

  // Form Fields
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
  const [eventDescription, setEventDescription] = useState('');

  // Password fields
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

      // Load dynamic academic branches & years if collegeId exists
      if (collegeId) {
        getCollegeAcademicMastersForStudentAction(collegeId)
          .then((res) => {
            if (res.success) {
              const collegeBranchNames = (res.branches || []).map(
                (b) => `${b.name}${b.code ? ` (${b.code})` : ''}`
              );
              // Merge distinct branches
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!collegeId) {
      setErrorMsg('College identifier is missing. Please ensure your student profile is linked to an institution.');
      return;
    }

    // 1. Mobile validation
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

    // 2. Registration number validation
    const cleanReg = registrationNumber.trim();
    if (!cleanReg) {
      setErrorMsg('University/College Registration Number is required.');
      return;
    }

    // 3. Roll number validation
    const cleanRoll = rollNumber.trim();
    if (!cleanRoll) {
      setErrorMsg('Class/College Roll Number is required.');
      return;
    }

    // 4. Branch validation
    const resolvedBranch = isCustomBranch ? customBranchName.trim() : branch.trim();
    if (!resolvedBranch) {
      setErrorMsg('Please select or specify your branch.');
      return;
    }

    // 5. Semester validation
    if (!semester.trim()) {
      setErrorMsg('Please select your current semester.');
      return;
    }

    // 6. Academic session validation
    const resolvedSession = isCustomSession ? customSessionText.trim() : academicSession.trim();
    if (!resolvedSession) {
      setErrorMsg('Please select or enter your academic session.');
      return;
    }

    // 7. Event description validation
    const cleanDesc = eventDescription.trim();
    if (!cleanDesc) {
      setErrorMsg('Event Coordinator description/vision statement is required.');
      return;
    }
    if (cleanDesc.length < 15) {
      setErrorMsg('Please provide at least 15 characters describing your event experience and plans.');
      return;
    }

    // 8. Password validations
    if (!password || password.length < 6) {
      setErrorMsg('Please choose an admin login password of at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      return;
    }

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
          'Your application for Event Coordinator has been submitted! Your college’s Primary Admin will review your application details and grant tab access.'
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] animate-in zoom-in-95 duration-150">
        {/* Header Banner (Always visible, shrink-0) */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-bce-navy p-4 sm:p-5 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-purple-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" /> Student Leadership
            </span>
          </div>

          <h3 id="coordinator-modal-title" className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-300 shrink-0" />
            Apply as Event Coordinator
          </h3>
          <p className="text-xs text-purple-200 mt-1 leading-snug">
            Organize campus fests, competitions, ticket passes, and manage student attendance.
          </p>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Application Submitted Successfully!</span>
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  {successMsg}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <p className="font-semibold text-slate-800">Review &amp; Access Details:</p>
                <p>1. Your college’s Primary Admin or Super Admin will verify your student credentials and event coordination details.</p>
                <p>2. Once approved, you can log in at the Admin Portal using your email and password to access the Events Tab.</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-bce-navy text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student Overview Card */}
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-600" /> Student:
                  </span>
                  <span className="font-bold text-slate-900">{fullName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-700">{email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-purple-600" /> College:
                  </span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={collegeName}>
                    {collegeName} {collegeCode ? `(${collegeCode})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-purple-200/50">
                  <span className="text-slate-500">Requested Role:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    <Calendar className="w-3 h-3" /> Event Coordinator (Events Tab)
                  </span>
                </div>
              </div>

              {/* 2-Column Responsive Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Mobile Number (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4 text-purple-600" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* 2. Registration Number (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reg No (University) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <FileText className="w-4 h-4 text-purple-600" />
                    </div>
                    <input
                      type="text"
                      required
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. 21105123001"
                      className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* 3. Roll Number (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Class / College Roll No <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4 text-purple-600" />
                    </div>
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. 21CS04 or 42"
                      className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* 4. Branch Dropdown (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Branch / Department <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
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
                        className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900 bg-white"
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
                          className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomBranch(false);
                            setCustomBranchName('');
                          }}
                          className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                          List
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Semester Dropdown (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4 text-purple-600" />
                    </div>
                    <select
                      required
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900 bg-white"
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

                {/* 6. Academic Session Dropdown (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Academic Session <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-4 h-4 text-purple-600" />
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
                        className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900 bg-white"
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
                          className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomSession(false);
                            setCustomSessionText('');
                          }}
                          className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                          List
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 7. Event Description / Coordinator Vision (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>
                    Event Experience &amp; Description <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-purple-600 font-semibold normal-case">
                    Mandatory for Coordinator Review
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    required
                    rows={3}
                    minLength={15}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Describe your past event experience, organizing skills, and your vision/plans for college fests, competitions &amp; events..."
                    className="block w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900 resize-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Explain why you should be appointed as Event Coordinator and your past leadership or event participation experience.
                </p>
              </div>

              {/* Password for admin login */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Create Login Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-purple-600" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="block w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-purple-600" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="block w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Institution verification notice */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/60 text-[11px] text-purple-900/80 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  Applications are verified by the college’s Primary Admin to maintain institutional integrity. All details are kept confidential.
                </span>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Coordinator Application</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
