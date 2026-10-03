'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Edit3,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Crown,
  Search,
  Check,
} from 'lucide-react';
import type { StudentProgramRegistrationItem, TeamMemberDetails } from '@/app/admin/events/event-registration-actions';
import type { Branch, Semester } from '@/types/database';
import { formatOrdinal } from '@/lib/events/academic-formatter';
import {
  updateTeamNameAction,
  updateTeamMemberAction,
  removeTeamMemberAction,
  addMemberToExistingTeamAction,
  lookupTeamMemberAction,
  getEventAcademicMastersByEventIdAction,
} from '@/app/admin/events/event-registration-actions';
import { cancelTeamInvitationAction, findTeamInvitationStudentAction, getTeamInvitationsAction, inviteTeamMemberAction } from '@/app/events/invitations/actions';
import {
  getTeamJoinRequestsAction,
  acceptJoinRequestAction,
  rejectJoinRequestAction,
  type JoinRequestItem,
} from '@/app/events/join-requests/actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  program: StudentProgramRegistrationItem;
  userRegistrationNumber: string;
  onTeamUpdated: () => Promise<void> | void;
}

function formatTeamManagementError(error: string): string {
  const messages: Record<string, string> = {
    EVENT_NOT_FOUND: 'Event not found. Refresh the page and try again.',
    REGISTRATION_SHEET_NOT_FOUND: 'The event registration sheet could not be found. Contact your college administrator.',
    GOOGLE_CONNECTION_REQUIRED: 'The college Google registration service is not connected.',
    TEAM_NOT_FOUND: 'This team could not be found in the event registration records.',
    PROGRAM_NOT_FOUND: 'This program could not be found for the event.',
    NOT_TEAM_LEADER: 'Only the verified team leader can manage this team.',
    REGISTRATION_CLOSED: 'Registration is closed. The team is now read only.',
    UNAUTHORIZED: 'Your event session is no longer valid. Sign in again.',
  };
  return messages[error] || error;
}

export function ManageTeamModal({
  isOpen,
  onClose,
  eventId,
  program,
  userRegistrationNumber: _userRegistrationNumber,
  onTeamUpdated,
}: Props) {
  // State
  const [teamName, setTeamName] = useState(program.teamName || '');
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [savingTeamName, setSavingTeamName] = useState(false);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editing existing member
  const [editingMemberRegNum, setEditingMemberRegNum] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    fullName: string;
    studentId: string;
    email: string;
    mobile: string;
    branch: string;
    semester: string;
    gender: string;
  }>({
    fullName: '',
    studentId: '',
    email: '',
    mobile: '',
    branch: '',
    semester: '',
    gender: '',
  });
  const [savingMember, setSavingMember] = useState(false);

  // Removing member
  const [removingRegNum, setRemovingRegNum] = useState<string | null>(null);
  const [confirmRemoveRegNum, setConfirmRemoveRegNum] = useState<string | null>(null);

  // Adding new member
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'search' | 'manual'>('search');
  const [searchRegNum, setSearchRegNum] = useState('');
  const [searching, setSearching] = useState(false);
  const [verifiedMember, setVerifiedMember] = useState<{
    fullName: string;
    registrationNumber: string;
    studentId: string;
    email: string;
    branch: string;
    semester: string;
    gender: string;
  } | null>(null);

  const [manualForm, setManualForm] = useState({
    fullName: '',
    studentId: '',
    email: '',
    mobile: '',
    branch: '',
    semester: '',
    gender: '',
  });
  const [addingMember, setAddingMember] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [invitePreview, setInvitePreview] = useState<{ fullName: string; registrationNumber: string; email: string; branch: string; semester: string } | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invitations, setInvitations] = useState<{ id: string; invitedName: string | null; invitedRegistrationNumber: string; status: string; expiresAt: string }[]>([]);
  const [capacityReserved, setCapacityReserved] = useState(program.teamMembers?.length || 0);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // Join Requests
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [processingJoinReqId, setProcessingJoinReqId] = useState<string | null>(null);

  // Academic master data for manual member add
  const [branches, setBranches] = useState<Branch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [customBranch, setCustomBranch] = useState(false);
  const [customSemester, setCustomSemester] = useState(false);

  useEffect(() => {
    if (isOpen && eventId) {
      getEventAcademicMastersByEventIdAction(eventId)
        .then((res) => {
          if (res.branches) setBranches(res.branches);
          if (res.semesters) setSemesters(res.semesters);
        })
        .catch(() => {});
    }
  }, [isOpen, eventId]);

  // Reset form when program prop changes
  useEffect(() => {
    setTeamName(program.teamName || '');
    setEditingTeamName(false);
    setEditingMemberRegNum(null);
    setConfirmRemoveRegNum(null);
    setShowAddForm(false);
    setShowInviteForm(false);
    setInvitePreview(null);
    setVerifiedMember(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [program]);

  useEffect(() => {
    if (!isOpen || program.participantRole !== 'TEAM LEADER') return;
    getTeamInvitationsAction(eventId, program.programId, program.teamId).then(res => {
      if (res.success) { setInvitations(res.invitations || []); setCapacityReserved(res.capacityReserved || 0); }
      else setErrorMsg(formatTeamManagementError(res.error || 'Could not load invitations.'));
    });
    // Load join requests
    setJoinRequestsLoading(true);
    getTeamJoinRequestsAction(eventId, program.programId, program.teamId).then(res => {
      if (res.success) setJoinRequests(res.requests || []);
      setJoinRequestsLoading(false);
    });
  }, [isOpen, eventId, program]);

  if (!isOpen) return null;

  const isLeader = program.participantRole === 'TEAM LEADER';
  const isRegistrationOpen = program.isRegistrationOpen;
  const canEdit = isLeader && isRegistrationOpen;

  const members = program.teamMembers || [];
  const minTeam = program.minTeamSize || 1;
  const maxTeam = program.maxTeamSize || 20;
  const currentCount = members.length;
  const canAddMore = canEdit && currentCount < maxTeam;
  const canRemove = canEdit && currentCount > minTeam;

  // Clear messages after 4 seconds
  const setFeedback = (error: string | null, success: string | null) => {
    setErrorMsg(error ? formatTeamManagementError(error) : null);
    setSuccessMsg(success);
    if (success) {
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // 1. Update Team Name
  const handleSaveTeamName = async () => {
    if (!teamName.trim()) {
      setFeedback('Team name cannot be empty.', null);
      return;
    }
    setSavingTeamName(true);
    setFeedback(null, null);

    try {
      const res = await updateTeamNameAction(
        eventId,
        program.programId,
        program.teamId,
        teamName.trim()
      );
      if (res.success) {
        setEditingTeamName(false);
        setFeedback(null, 'Team name updated successfully.');
        await onTeamUpdated();
      } else {
        setFeedback(res.error || 'Failed to update team name.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Failed to update team name.', null);
    } finally {
      setSavingTeamName(false);
    }
  };

  // 2. Start Editing Member
  const handleStartEditMember = (m: TeamMemberDetails) => {
    setEditingMemberRegNum(m.registrationNumber);
    setEditForm({
      fullName: m.fullName,
      studentId: m.studentId,
      email: m.email,
      mobile: m.mobile || '',
      branch: m.branch || '',
      semester: m.semester || '',
      gender: m.gender || '',
    });
    setConfirmRemoveRegNum(null);
    setFeedback(null, null);
  };

  // 3. Save Member Details
  const handleSaveMember = async (registrationNumber: string) => {
    if (!editForm.fullName.trim() || !editForm.studentId.trim() || !editForm.email.trim()) {
      setFeedback('Full Name, Student ID, and Email are required.', null);
      return;
    }

    setSavingMember(true);
    setFeedback(null, null);

    try {
      const res = await updateTeamMemberAction(
        eventId,
        program.programId,
        program.teamId,
        registrationNumber,
        editForm
      );

      if (res.success) {
        setEditingMemberRegNum(null);
        setFeedback(null, 'Member details updated successfully.');
        await onTeamUpdated();
      } else {
        setFeedback(res.error || 'Failed to update member.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Failed to update member.', null);
    } finally {
      setSavingMember(false);
    }
  };

  // 4. Remove Member
  const handleRemoveMember = async (registrationNumber: string) => {
    setRemovingRegNum(registrationNumber);
    setFeedback(null, null);

    try {
      const res = await removeTeamMemberAction(
        eventId,
        program.programId,
        program.teamId,
        registrationNumber
      );

      if (res.success) {
        setConfirmRemoveRegNum(null);
        setFeedback(null, 'Member removed from team.');
        await onTeamUpdated();
      } else {
        setFeedback(res.error || 'Failed to remove member.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Failed to remove member.', null);
    } finally {
      setRemovingRegNum(null);
    }
  };

  // 5. Search Member by Event Pass
  const handleSearchPass = async () => {
    const cleanReg = searchRegNum.trim().toUpperCase();
    if (!cleanReg) {
      setFeedback('Please enter an Event Registration Number.', null);
      return;
    }

    setSearching(true);
    setFeedback(null, null);
    setVerifiedMember(null);

    try {
      const res = await lookupTeamMemberAction(eventId, cleanReg);
      if (res.success && res.member) {
        // Check if already in this team
        if (members.some(m => m.studentId.toUpperCase() === res.member!.studentId.toUpperCase())) {
          setFeedback('This student is already a member of your team.', null);
          return;
        }
        setVerifiedMember(res.member);
      } else {
        setFeedback(res.error || 'No event registration found with this number.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Lookup failed.', null);
    } finally {
      setSearching(false);
    }
  };

  // 6. Add Verified Member to Team
  const handleAddVerifiedMember = async () => {
    if (!verifiedMember) return;
    setAddingMember(true);
    setFeedback(null, null);

    try {
      const res = await addMemberToExistingTeamAction(
        eventId,
        program.programId,
        program.teamId,
        {
          fullName: verifiedMember.fullName,
          studentId: verifiedMember.studentId,
          email: verifiedMember.email,
          mobile: '',
          branch: verifiedMember.branch,
          semester: verifiedMember.semester,
          gender: verifiedMember.gender,
          eventRegNumber: verifiedMember.registrationNumber,
        }
      );

      if (res.success) {
        setVerifiedMember(null);
        setSearchRegNum('');
        setShowAddForm(false);
        setFeedback(null, `${verifiedMember.fullName} has been added to the team!`);
        await onTeamUpdated();
      } else {
        setFeedback(res.error || 'Failed to add member to team.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Failed to add member.', null);
    } finally {
      setAddingMember(false);
    }
  };

  // 7. Add Manual Member to Team
  const handleAddManualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.fullName.trim() || !manualForm.studentId.trim() || !manualForm.email.trim()) {
      setFeedback('Full Name, Student ID, and Email are required.', null);
      return;
    }

    setAddingMember(true);
    setFeedback(null, null);

    try {
      const res = await addMemberToExistingTeamAction(
        eventId,
        program.programId,
        program.teamId,
        manualForm
      );

      if (res.success) {
        setManualForm({
          fullName: '',
          studentId: '',
          email: '',
          mobile: '',
          branch: '',
          semester: '',
          gender: '',
        });
        setShowAddForm(false);
        setFeedback(null, `${manualForm.fullName} has been added to the team!`);
        await onTeamUpdated();
      } else {
        setFeedback(res.error || 'Failed to add member to team.', null);
      }
    } catch (err: unknown) {
      setFeedback((err as Error).message || 'Failed to add member.', null);
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-[calc(100vw-16px)] sm:w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[calc(100vh-16px)] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-start justify-between gap-3 sm:gap-4 shrink-0">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15 text-indigo-200">
                {program.programName}
              </span>
              {isRegistrationOpen ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Registration Open (Edits Allowed)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  Registration Closed (Locked)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white break-words">
                Team: {program.teamName}
              </h2>
            </div>
            <p className="text-xs text-slate-300 break-all">
              Team Identifier: <span className="font-mono text-amber-300 font-bold">{program.teamId}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium break-words">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium break-words">{successMsg}</span>
            </div>
          )}

          {/* Registration Window Notice */}
          {!isRegistrationOpen && (
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Team Editing Locked</span>
              </div>
              <p className="break-words">
                {program.registrationClosedReason ||
                  'Registration for this event or program has ended. Team members can no longer be edited or changed.'}
              </p>
            </div>
          )}

          {/* Team Name Editor */}
          <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Team Name</span>
              {canEdit && !editingTeamName && (
                <button
                  onClick={() => setEditingTeamName(true)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename Team</span>
                </button>
              )}
            </div>

            {editingTeamName ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-semibold"
                  placeholder="Enter new team name"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTeamName}
                    disabled={savingTeamName}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {savingTeamName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      setTeamName(program.teamName);
                      setEditingTeamName(false);
                    }}
                    disabled={savingTeamName}
                    className="flex-1 sm:flex-none px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-slate-900 break-words">{program.teamName}</div>
            )}
          </div>

          {/* Team Capacity Tracker */}
          <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Team Roster ({currentCount} / {maxTeam} Members)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Min: {minTeam} • Max: {maxTeam}
              </span>
            </div>

            {/* Capacity Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  currentCount < minTeam
                    ? 'bg-amber-500'
                    : currentCount === maxTeam
                    ? 'bg-purple-600'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (currentCount / maxTeam) * 100)}%` }}
              />
            </div>
            {currentCount < minTeam && (
              <p className="text-[11px] text-amber-700 font-medium">
                ⚠️ Need at least {minTeam - currentCount} more member(s) to meet program minimum requirement.
              </p>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Current Members ({members.length})
              </h3>

              {canEdit && !showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Member</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {members.map((m) => {
                const isMemberLeader = m.participantRole === 'TEAM LEADER';
                const isEditing = editingMemberRegNum === m.registrationNumber;
                const isConfirmingRemove = confirmRemoveRegNum === m.registrationNumber;
                const isCurrentRemoving = removingRegNum === m.registrationNumber;

                return (
                  <div
                    key={m.registrationNumber}
                    className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
                      isMemberLeader
                        ? 'bg-amber-50/50 border-amber-200 shadow-xs'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Edit Form */
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between gap-2">
                          <span>Edit Member Information</span>
                          <span className="font-mono text-slate-400 text-[10px] break-all">{m.registrationNumber}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Full Name *</label>
                            <input
                              type="text"
                              value={editForm.fullName}
                              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Student ID / Roll No. *</label>
                            <input
                              type="text"
                              value={editForm.studentId}
                              onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 uppercase font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Email Address *</label>
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Mobile Number</label>
                            <input
                              type="tel"
                              value={editForm.mobile}
                              onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Branch</label>
                            <input
                              type="text"
                              value={editForm.branch}
                              onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                              placeholder="e.g. CSE, Civil"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-semibold text-slate-600">Semester</label>
                            <input
                              type="text"
                              value={editForm.semester}
                              onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                              placeholder="e.g. 4th, 6th"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingMemberRegNum(null)}
                            disabled={savingMember}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveMember(m.registrationNumber)}
                            disabled={savingMember}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                          >
                            {savingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Member Card - Stacking cleanly on mobile */
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="font-bold text-slate-900 text-sm sm:text-base break-words">
                                {m.fullName}
                              </span>
                              {isMemberLeader ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                  <Crown className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Team Leader</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  <span>Member</span>
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-600 font-mono flex flex-wrap items-center gap-1">
                              <span>Roll: <strong className="text-slate-800">{m.studentId}</strong></span>
                              {m.registrationNumber && (
                                <span className="text-[11px] text-slate-500 font-mono break-all">• Reg: {m.registrationNumber}</span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 break-all">
                              {m.email}
                            </div>

                            {(m.branch || m.semester) && (
                              <div className="text-xs text-slate-600 pt-0.5 flex flex-wrap items-center gap-1.5">
                                {m.branch && (
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                    {m.branch}
                                  </span>
                                )}
                                {m.semester && (
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                    {m.semester}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Leader Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <button
                                onClick={() => handleStartEditMember(m)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit member details"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {!isMemberLeader && (
                                <button
                                  onClick={() => setConfirmRemoveRegNum(m.registrationNumber)}
                                  disabled={!canRemove}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    canRemove
                                      ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                      : 'text-slate-300 cursor-not-allowed'
                                  }`}
                                  title={
                                    canRemove
                                      ? 'Remove member from team'
                                      : `Cannot remove: Minimum team size is ${minTeam}`
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Removal Confirmation Dialog */}
                        {isConfirmingRemove && (
                          <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2 animate-in fade-in">
                            <p className="font-semibold text-red-800 break-words">
                              Remove {m.fullName} from this team?
                            </p>
                            <p className="text-red-600 text-[11px]">
                              Their spot will be cancelled. You can add another member if registration remains open.
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setConfirmRemoveRegNum(null)}
                                className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 font-semibold text-[11px] hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRemoveMember(m.registrationNumber)}
                                disabled={isCurrentRemoving}
                                className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                {isCurrentRemoving ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3 shrink-0" />}
                                <span>Confirm Remove</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isLeader && (
            <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-950">Invitations</h3>
                <span className="text-xs font-semibold text-violet-800">Team capacity reserved: {capacityReserved} / {maxTeam}</span>
              </div>
              {showInviteForm && canEdit && capacityReserved < maxTeam && (
                <form className="grid gap-3 rounded-xl border border-violet-100 bg-white p-3 sm:grid-cols-2" onSubmit={async e => {
                  e.preventDefault(); setCreatingInvite(true); setFeedback(null, null);
                  const res = await findTeamInvitationStudentAction({ eventId, programId: program.programId, teamId: program.teamId, identifier: inviteIdentifier });
                  setCreatingInvite(false);
                  if (!res.success || !res.student) { setInvitePreview(null); setFeedback(res.error || 'Student not found.', null); return; }
                  setInvitePreview(res.student); setFeedback(null, null);
                }}>
                  <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">Event Registration Number or Registered Student Email<input required value={inviteIdentifier} onChange={e => { setInviteIdentifier(e.target.value); setInvitePreview(null); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="EVENT-E004 or student@example.com" /></label>
                  <div className="flex items-center gap-2"><button disabled={creatingInvite} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{creatingInvite ? 'Finding…' : 'Find Student'}</button><button type="button" onClick={() => setShowInviteForm(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">Cancel</button></div>
                  {invitePreview && <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs"><p className="font-bold text-emerald-900">Verified student</p><p className="mt-1"><strong>Name:</strong> {invitePreview.fullName}</p><p><strong>Registration:</strong> {invitePreview.registrationNumber}</p><p><strong>Email:</strong> {invitePreview.email}</p><p><strong>Branch:</strong> {invitePreview.branch || '—'} <strong>Semester:</strong> {invitePreview.semester || '—'}</p><p className="mt-2"><strong>Program:</strong> {program.programName} <strong>Team:</strong> {program.teamName}</p><button type="button" disabled={creatingInvite} onClick={async () => { setCreatingInvite(true); const sent = await inviteTeamMemberAction({ eventId, programId: program.programId, teamId: program.teamId, registrationNumber: invitePreview.registrationNumber }); setCreatingInvite(false); if (!sent.success) { setFeedback(sent.error || 'Could not send invitation.', null); return; } setFeedback(null, 'Invitation sent in the app.'); setInvitePreview(null); setInviteIdentifier(''); const fresh = await getTeamInvitationsAction(eventId, program.programId, program.teamId); if (fresh.success) { setInvitations(fresh.invitations || []); setCapacityReserved(fresh.capacityReserved || 0); } }} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">{creatingInvite ? 'Sending…' : 'Send Invitation'}</button></div>}
                </form>
              )}
              <div className="space-y-2">
                {invitations.map(inv => <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs"><div><strong>{inv.invitedName || 'Student'}</strong><div className="text-slate-500 break-all">{inv.invitedRegistrationNumber}</div></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{inv.status}</span>{inv.status === 'PENDING' && canEdit && <button disabled={cancellingInvite === inv.id} onClick={async () => { setCancellingInvite(inv.id); const res = await cancelTeamInvitationAction(eventId, program.programId, program.teamId, inv.id); setCancellingInvite(null); if (res.success) { setInvitations(prev => prev.map(x => x.id === inv.id ? { ...x, status: 'CANCELLED' } : x)); setCapacityReserved(n => Math.max(0, n - 1)); } else setFeedback(res.error || 'Could not cancel invitation.', null); }} className="font-bold text-red-600">Cancel</button>}</div></div>)}
                {!invitations.length && <p className="text-xs text-slate-500">No invitations yet.</p>}
              </div>
            </section>
          )}

          {/* Join Requests Section (for team leader) */}
          {isLeader && (
            <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Join Requests
                  {joinRequests.filter(r => r.status === 'PENDING').length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {joinRequests.filter(r => r.status === 'PENDING').length}
                    </span>
                  )}
                </h3>
                <span className="text-[10px] font-semibold text-amber-700">
                  {currentCount} / {maxTeam} members
                  {currentCount < maxTeam && ` • ${maxTeam - currentCount} slot${maxTeam - currentCount > 1 ? 's' : ''} available`}
                </span>
              </div>

              {joinRequestsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading join requests...</span>
                </div>
              ) : joinRequests.length === 0 ? (
                <p className="text-xs text-slate-500">No join requests yet. Students can find your team using &ldquo;Find a Team&rdquo; in the program page.</p>
              ) : (
                <div className="space-y-2">
                  {joinRequests.map(req => {
                    const isPending = req.status === 'PENDING';
                    const isProcessing = processingJoinReqId === req.id;
                    return (
                      <div key={req.id} className={`rounded-xl border bg-white px-3.5 sm:px-4 py-3 space-y-2 ${isPending ? 'border-amber-200' : 'border-slate-100'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-slate-900 break-words">{req.requesterName}</p>
                            <p className="text-[10px] text-slate-500">
                              {req.requesterStudentId && <span>Roll: {req.requesterStudentId}</span>}
                              {req.requesterBranch && <span> • {req.requesterBranch}</span>}
                              {req.requesterSemester && <span> • Sem {req.requesterSemester}</span>}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 break-all">Event Reg: {req.requesterRegistrationNumber}</p>
                            <p className="text-[10px] text-slate-400">
                              Requested {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            req.status === 'APPROVED' ? 'text-emerald-700 bg-emerald-100 border-emerald-300' :
                            req.status === 'REJECTED' ? 'text-red-700 bg-red-100 border-red-300' :
                            'text-amber-700 bg-amber-100 border-amber-300'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        {isPending && canEdit && currentCount < maxTeam && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            <button
                              disabled={isProcessing}
                              onClick={async () => {
                                setProcessingJoinReqId(req.id);
                                setFeedback(null, null);
                                const res = await acceptJoinRequestAction(eventId, program.programId, program.teamId, req.id);
                                setProcessingJoinReqId(null);
                                if (res.success) {
                                  setFeedback(null, `${req.requesterName} has been added to the team!`);
                                  setJoinRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'APPROVED' } : r));
                                  await onTeamUpdated();
                                } else {
                                  setFeedback(res.error || 'Could not accept request.', null);
                                }
                              }}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              {isProcessing ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                              <span>Accept</span>
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={async () => {
                                setProcessingJoinReqId(req.id);
                                setFeedback(null, null);
                                const res = await rejectJoinRequestAction(eventId, program.programId, program.teamId, req.id);
                                setProcessingJoinReqId(null);
                                if (res.success) {
                                  setJoinRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'REJECTED' } : r));
                                  setFeedback(null, 'Request rejected.');
                                } else {
                                  setFeedback(res.error || 'Could not reject request.', null);
                                }
                              }}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3 shrink-0" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}

                        {isPending && !canEdit && (
                          <p className="text-[10px] text-amber-600 font-medium pt-1 border-t border-slate-100">
                            Registration is closed. This request cannot be processed.
                          </p>
                        )}

                        {isPending && canEdit && currentCount >= maxTeam && (
                          <p className="text-[10px] text-red-600 font-medium pt-1 border-t border-slate-100">
                            Team is full. Remove a member before accepting.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Add Team Member Section */}
          {canAddMore && showAddForm && (
            <div className="bg-indigo-50/60 rounded-2xl border border-indigo-200 p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    Add Team Member
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setVerifiedMember(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex rounded-xl bg-white p-1 border border-indigo-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('search');
                    setVerifiedMember(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    addMode === 'search'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Quick Add (Event Pass)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('manual');
                    setVerifiedMember(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    addMode === 'manual'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direct Entry
                </button>
              </div>

              {/* Mode 1: Search by Event Pass */}
              {addMode === 'search' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Enter the student&apos;s Event Registration Number (e.g. from their Event Pass):
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. UMANG27-E005"
                      value={searchRegNum}
                      onChange={(e) => setSearchRegNum(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchPass()}
                      className="w-full sm:flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSearchPass}
                      disabled={searching || !searchRegNum.trim()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer text-center"
                    >
                      {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Search className="w-3.5 h-3.5 shrink-0" />}
                      <span>Verify Pass</span>
                    </button>
                  </div>

                  {/* Verified Member Preview */}
                  {verifiedMember && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-emerald-200 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Verified Event Pass</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600 break-all">
                          {verifiedMember.registrationNumber}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-700">
                        <div className="font-bold text-sm text-slate-900 break-words">{verifiedMember.fullName}</div>
                        <div>Roll No: <span className="font-mono font-semibold">{verifiedMember.studentId}</span></div>
                        <div className="break-all">Email: {verifiedMember.email}</div>
                        {verifiedMember.branch && (
                          <div className="text-slate-500">{verifiedMember.branch} ({verifiedMember.semester || 'Semester N/A'})</div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddVerifiedMember}
                        disabled={addingMember}
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer text-center"
                      >
                        {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <UserPlus className="w-3.5 h-3.5 shrink-0" />}
                        <span>Add {verifiedMember.fullName} to Team</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Direct Entry */}
              {addMode === 'manual' && (
                <form onSubmit={handleAddManualMember} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={manualForm.fullName}
                        onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Student ID / Roll No *</label>
                      <input
                        type="text"
                        required
                        value={manualForm.studentId}
                        onChange={(e) => setManualForm({ ...manualForm, studentId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 uppercase font-mono bg-white"
                        placeholder="22CSE045"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={manualForm.email}
                        onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        placeholder="student@college.ac.in"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Mobile Number</label>
                      <input
                        type="tel"
                        value={manualForm.mobile}
                        onChange={(e) => setManualForm({ ...manualForm, mobile: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        placeholder="9876543210"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-700">Branch</label>
                        {branches.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomBranch(!customBranch);
                              setManualForm({ ...manualForm, branch: '' });
                            }}
                            className="text-[11px] text-indigo-600 hover:underline cursor-pointer font-normal"
                          >
                            {customBranch ? 'Select from list' : 'Custom branch?'}
                          </button>
                        )}
                      </div>
                      {branches.length > 0 && !customBranch ? (
                        <select
                          value={manualForm.branch}
                          onChange={(e) => {
                            if (e.target.value === '__OTHER__') {
                              setCustomBranch(true);
                              setManualForm({ ...manualForm, branch: '' });
                            } else {
                              setManualForm({ ...manualForm, branch: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm cursor-pointer"
                        >
                          <option value="">Select Branch (e.g. CSE)</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.code || b.name}>
                              {b.name} {b.code ? `(${b.code})` : ''}
                            </option>
                          ))}
                          <option value="__OTHER__">Other / Custom Branch...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={manualForm.branch}
                          onChange={(e) => setManualForm({ ...manualForm, branch: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                          placeholder="e.g. Civil Engineering"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-700">Semester</label>
                        {semesters.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomSemester(!customSemester);
                              setManualForm({ ...manualForm, semester: '' });
                            }}
                            className="text-[11px] text-indigo-600 hover:underline cursor-pointer font-normal"
                          >
                            {customSemester ? 'Select from list' : 'Custom semester?'}
                          </button>
                        )}
                      </div>
                      {semesters.length > 0 && !customSemester ? (
                        <select
                          value={manualForm.semester}
                          onChange={(e) => {
                            if (e.target.value === '__OTHER__') {
                              setCustomSemester(true);
                              setManualForm({ ...manualForm, semester: '' });
                            } else {
                              setManualForm({ ...manualForm, semester: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm cursor-pointer"
                        >
                          <option value="">Select Semester (e.g. 4th Sem)</option>
                          {semesters.map((s) => {
                            const semLabel = s.name.toLowerCase().startsWith('semester')
                              ? `${formatOrdinal(s.semester_number)} Semester`
                              : `${s.name} (${formatOrdinal(s.semester_number)} Sem)`;
                            return (
                              <option key={s.id} value={semLabel}>
                                {semLabel}
                              </option>
                            );
                          })}
                          <option value="__OTHER__">Other / Custom Semester...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={manualForm.semester}
                          onChange={(e) => setManualForm({ ...manualForm, semester: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                          placeholder="e.g. 4th Semester"
                        />
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={addingMember}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer text-center"
                  >
                    {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <UserPlus className="w-3.5 h-3.5 shrink-0" />}
                    <span>Add Member to Team</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 shrink-0">
          <span className="text-center sm:text-left">
            {canEdit ? (
              <span className="text-emerald-700 font-semibold flex items-center justify-center sm:justify-start gap-1">
                <Check className="w-3.5 h-3.5 shrink-0" /> All edits are saved directly to official event records.
              </span>
            ) : (
              <span className="text-slate-500">View-only mode.</span>
            )}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer text-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
