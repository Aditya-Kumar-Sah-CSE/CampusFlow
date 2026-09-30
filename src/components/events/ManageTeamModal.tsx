'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserCheck,
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
  Clock,
  Sparkles,
} from 'lucide-react';
import type { StudentProgramRegistrationItem, TeamMemberDetails } from '@/app/admin/events/event-registration-actions';
import {
  updateTeamNameAction,
  updateTeamMemberAction,
  removeTeamMemberAction,
  addMemberToExistingTeamAction,
  lookupTeamMemberAction,
} from '@/app/admin/events/event-registration-actions';
import { cancelTeamInvitationAction, createTeamMemberInvitationAction, getTeamInvitationsAction } from '@/app/events/invitations/actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  program: StudentProgramRegistrationItem;
  userRegistrationNumber: string;
  onTeamUpdated: () => Promise<void> | void;
}

export function ManageTeamModal({
  isOpen,
  onClose,
  eventId,
  program,
  userRegistrationNumber,
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteStudentId, setInviteStudentId] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invitations, setInvitations] = useState<{ id: string; invitedEmail: string; invitedName: string | null; status: string; expiresAt: string }[]>([]);
  const [capacityReserved, setCapacityReserved] = useState(program.teamMembers?.length || 0);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // Reset form when program prop changes
  useEffect(() => {
    setTeamName(program.teamName || '');
    setEditingTeamName(false);
    setEditingMemberRegNum(null);
    setConfirmRemoveRegNum(null);
    setShowAddForm(false);
    setShowInviteForm(false);
    setInviteLink('');
    setVerifiedMember(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [program]);

  useEffect(() => {
    if (!isOpen || program.participantRole !== 'TEAM LEADER') return;
    getTeamInvitationsAction(eventId, program.programId, program.teamId).then(res => {
      if (res.success) { setInvitations(res.invitations || []); setCapacityReserved(res.capacityReserved || 0); }
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
    setErrorMsg(error);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
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
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Team: {program.teamName}
              </h2>
            </div>
            <p className="text-xs text-slate-300">
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
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Feedback Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Registration Window Notice */}
          {!isRegistrationOpen && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Team Editing Locked</span>
              </div>
              <p>
                {program.registrationClosedReason ||
                  'Registration for this event or program has ended. Team members can no longer be edited or changed.'}
              </p>
            </div>
          )}

          {/* Team Name Editor */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
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
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-semibold"
                  placeholder="Enter new team name"
                  autoFocus
                />
                <button
                  onClick={handleSaveTeamName}
                  disabled={savingTeamName}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
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
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="text-sm font-bold text-slate-900">{program.teamName}</div>
            )}
          </div>

          {/* Team Capacity Tracker */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Current Members ({members.length})
              </h3>

              {canEdit && !showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Team Member</span>
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
                    className={`rounded-2xl border p-4 transition-all ${
                      isMemberLeader
                        ? 'bg-amber-50/50 border-amber-200 shadow-xs'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Edit Form */
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span>Edit Member Information</span>
                          <span className="font-mono text-slate-400 text-[10px]">{m.registrationNumber}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                      /* Display Member Card */
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {m.fullName}
                              </span>
                              {isMemberLeader ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <Crown className="w-3 h-3 text-amber-600" />
                                  <span>Team Leader</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  <span>Member</span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              Roll No: <span className="font-bold text-slate-700">{m.studentId}</span>
                              {m.branch ? ` • ${m.branch}` : ''}
                              {m.semester ? ` (${m.semester})` : ''}
                            </div>
                          </div>

                          {/* Leader Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEditMember(m)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit member details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
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
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Extra details */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="truncate max-w-[200px]">{m.email}</span>
                          <span className="font-mono text-slate-400 text-[10px]">{m.registrationNumber}</span>
                        </div>

                        {/* Removal Confirmation Dialog */}
                        {isConfirmingRemove && (
                          <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2 animate-in fade-in">
                            <p className="font-semibold text-red-800">
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
                                className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 flex items-center gap-1 shadow-xs"
                              >
                                {isCurrentRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
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
            <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-950">Invitations</h3>
                <span className="text-xs font-semibold text-violet-800">Team capacity reserved: {capacityReserved} / {maxTeam}</span>
              </div>
              {showInviteForm && canEdit && capacityReserved < maxTeam && (
                <form className="grid gap-3 rounded-xl border border-violet-100 bg-white p-3 sm:grid-cols-2" onSubmit={async e => {
                  e.preventDefault(); setCreatingInvite(true); setFeedback(null, null);
                  const res = await createTeamMemberInvitationAction({ eventId, programId: program.programId, teamId: program.teamId, email: inviteEmail, name: inviteName, studentId: inviteStudentId });
                  setCreatingInvite(false);
                  if (!res.success || !res.inviteUrl) { setFeedback(res.error || 'Could not create invitation.', null); return; }
                  setInviteLink(res.inviteUrl); setFeedback(null, 'Invitation created successfully.');
                  const fresh = await getTeamInvitationsAction(eventId, program.programId, program.teamId);
                  if (fresh.success) { setInvitations(fresh.invitations || []); setCapacityReserved(fresh.capacityReserved || 0); }
                }}>
                  <label className="space-y-1 text-xs font-semibold text-slate-700">Student Email *<input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-700">Student Name (optional)<input value={inviteName} onChange={e => setInviteName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-700">Student ID / Roll No (optional)<input value={inviteStudentId} onChange={e => setInviteStudentId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal uppercase" /></label>
                  <div className="flex items-end gap-2"><button disabled={creatingInvite} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{creatingInvite ? 'Creating…' : 'Create invitation'}</button><button type="button" onClick={() => setShowInviteForm(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">Cancel</button></div>
                  {inviteLink && <div className="sm:col-span-2 space-y-2"><label className="text-xs font-semibold text-slate-700">Invite link<input readOnly value={inviteLink} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs" /></label><button type="button" onClick={() => navigator.clipboard.writeText(inviteLink)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">Copy Link</button></div>}
                </form>
              )}
              <div className="space-y-2">
                {invitations.map(inv => <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs"><div><strong>{inv.invitedName || inv.invitedEmail}</strong>{inv.invitedName && <div className="text-slate-500">{inv.invitedEmail}</div>}</div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{inv.status}</span>{inv.status === 'PENDING' && canEdit && <button disabled={cancellingInvite === inv.id} onClick={async () => { setCancellingInvite(inv.id); const res = await cancelTeamInvitationAction(eventId, program.programId, program.teamId, inv.id); setCancellingInvite(null); if (res.success) { setInvitations(prev => prev.map(x => x.id === inv.id ? { ...x, status: 'CANCELLED' } : x)); setCapacityReserved(n => Math.max(0, n - 1)); } else setFeedback(res.error || 'Could not cancel invitation.', null); }} className="font-bold text-red-600">Cancel</button>}</div></div>)}
                {!invitations.length && <p className="text-xs text-slate-500">No invitations yet.</p>}
              </div>
            </section>
          )}

          {/* Add Team Member Section */}
          {canAddMore && showAddForm && (
            <div className="bg-indigo-50/60 rounded-2xl border border-indigo-200 p-5 space-y-4 animate-in fade-in">
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

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. UMANG27-E005"
                      value={searchRegNum}
                      onChange={(e) => setSearchRegNum(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchPass()}
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSearchPass}
                      disabled={searching || !searchRegNum.trim()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Verify Pass</span>
                    </button>
                  </div>

                  {/* Verified Member Preview */}
                  {verifiedMember && (
                    <div className="p-4 rounded-xl bg-white border border-emerald-200 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Verified Event Pass</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600">
                          {verifiedMember.registrationNumber}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-700">
                        <div className="font-bold text-sm text-slate-900">{verifiedMember.fullName}</div>
                        <div>Roll No: <span className="font-mono font-semibold">{verifiedMember.studentId}</span></div>
                        <div>Email: {verifiedMember.email}</div>
                        {verifiedMember.branch && (
                          <div className="text-slate-500">{verifiedMember.branch} ({verifiedMember.semester || 'Semester N/A'})</div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddVerifiedMember}
                        disabled={addingMember}
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        <span>Add {verifiedMember.fullName} to Team</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Direct Entry */}
              {addMode === 'manual' && (
                <form onSubmit={handleAddManualMember} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                      <label className="font-semibold text-slate-700">Branch</label>
                      <input
                        type="text"
                        value={manualForm.branch}
                        onChange={(e) => setManualForm({ ...manualForm, branch: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        placeholder="Computer Science"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Semester</label>
                      <input
                        type="text"
                        value={manualForm.semester}
                        onChange={(e) => setManualForm({ ...manualForm, semester: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        placeholder="4th Semester"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={addingMember}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Add Member to Team</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {canEdit ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> All edits are saved directly to official event records.
              </span>
            ) : (
              <span className="text-slate-500">View-only mode.</span>
            )}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
