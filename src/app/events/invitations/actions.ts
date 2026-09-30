'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyEventSession } from '@/lib/events/event-session';
import { checkIsRegistrationOpen } from '@/lib/events/registration-status';
import { getInvitationEvent, getInvitationProgram } from '@/lib/events/invitation-context';
import {
  addTeamMember, findExistingProgramRegistration, getEventRegistrations,
} from '@/lib/google/event-registration-sheets';

const dbClient = () => createAdminClient();

/** Returns true when the error means the table hasn't been created yet (migration pending). */
function isTableMissing(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01');
}

async function verifiedLeader(eventId: string, programId: string, teamId: string) {
  const auth = await verifyEventSession(eventId);
  if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
  const session = auth.session;
  const event = await getInvitationEvent(eventId);
  if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
  if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
  const program = await getInvitationProgram(programId, event.college_id);
  if (program.event_id !== event.id || program.college_id !== event.college_id) throw new Error('PROGRAM_NOT_FOUND');
  const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
  const teamRows = rows.filter(r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED');
  const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
  if (!leader) throw new Error('TEAM_NOT_FOUND');
  const isLeader = leader.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() || leader.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase();
  if (!isLeader) throw new Error('NOT_TEAM_LEADER');
  return { session, event, program, rows, teamRows, leader };
}

async function findEligibleInvitee(eventId: string, programId: string, teamId: string, identifier: string) {
  const context = await verifiedLeader(eventId, programId, teamId);
  const { session, event, program, rows, teamRows, leader } = context;
  if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
  const open = checkIsRegistrationOpen(event, program);
  if (!open.isOpen) throw new Error(open.reason || 'Team registration is closed.');
  const maxSize = program.max_team_size || 20;
  const db = dbClient(); if (!db) throw new Error('Invitation service is unavailable.');
  const { count, error: capacityError } = await db.from('event_team_invitations').select('id', { count: 'exact', head: true }).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).eq('status', 'PENDING').gt('expires_at', new Date().toISOString());
  if (capacityError && !isTableMissing(capacityError)) {
    console.error('[TeamInvitations] Capacity check failed:', capacityError.code, capacityError.message);
    throw new Error('Could not verify team capacity. Please try again later.');
  }
  if (isTableMissing(capacityError)) console.warn('[TeamInvitations] Invitation table pending migration — treating pending count as 0.');
  if (teamRows.length + (count || 0) >= maxSize) throw new Error('Team capacity is full.');

  const value = identifier.trim();
  const target = rows.find(r => r.programId === '' && r.eventId === event.id && r.registrationStatus !== 'CANCELLED' && (value.includes('@') ? r.email.toLowerCase() === value.toLowerCase() : r.registrationNumber.toUpperCase() === value.toUpperCase()));
  if (!target || target.programId !== '') throw new Error('No event registration was found for that registration number or email.');
  if (target.eventId !== event.id || target.registrationStatus === 'CANCELLED') throw new Error('Student does not have an active registration for this event.');
  const registrationNumber = target.registrationNumber.trim().toUpperCase();
  if (registrationNumber === session.registrationNumber.toUpperCase() || registrationNumber === leader.teamLeaderRegistrationNumber.toUpperCase()) throw new Error('You cannot invite yourself.');
  if (teamRows.some(r => r.registrationNumber.toUpperCase() === registrationNumber || r.email.toLowerCase() === target.email.toLowerCase() || (target.studentId && r.studentId.toUpperCase() === target.studentId.toUpperCase()))) throw new Error('This student is already a member of this team.');
  const existingParticipation = await findExistingProgramRegistration(event.college_id, event.registration_sheet_id, event.id, program.id, { eventRegNumber: registrationNumber, studentId: target.studentId, email: target.email });
  if (existingParticipation) throw new Error('This student already participates in this program.');
  const { data: duplicate, error: duplicateError } = await db.from('event_team_invitations').select('id').eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('invited_registration_number', registrationNumber).eq('status', 'PENDING').gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
  if (duplicateError && !isTableMissing(duplicateError)) {
    console.error('[TeamInvitations] Duplicate check failed:', duplicateError.code, duplicateError.message);
    throw new Error('Could not verify existing invitations. Please try again later.');
  }
  if (duplicate) throw new Error('This student already has a pending invitation for this program.');
  return { ...context, target, registrationNumber };
}

export async function findTeamInvitationStudentAction(input: { eventId: string; programId: string; teamId: string; identifier: string }): Promise<{ success: boolean; error?: string; student?: { fullName: string; registrationNumber: string; email: string; branch: string; semester: string }; programName?: string; teamName?: string }> {
  try {
    const found = await findEligibleInvitee(input.eventId, input.programId, input.teamId, input.identifier);
    return { success: true, student: { fullName: found.target.participantName, registrationNumber: found.registrationNumber, email: found.target.email, branch: found.target.branch, semester: found.target.semester }, programName: found.program.name, teamName: found.leader.teamName };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function inviteTeamMemberAction(input: { eventId: string; programId: string; teamId: string; registrationNumber: string }): Promise<{ success: boolean; error?: string; invitationId?: string }> {
  try {
    const found = await findEligibleInvitee(input.eventId, input.programId, input.teamId, input.registrationNumber);
    const db = dbClient(); if (!db) throw new Error('Invitation service is unavailable.');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data: invitationId, error } = await db.rpc('create_team_member_invitation', {
      p_college_id: found.event.college_id, p_event_id: found.event.id, p_program_id: found.program.id,
      p_team_id: found.leader.teamId, p_invited_registration_number: found.registrationNumber,
      p_invited_name: found.target.participantName, p_leader_registration_number: found.leader.teamLeaderRegistrationNumber || found.session.registrationNumber,
      p_expires_at: expiresAt, p_current_member_count: found.teamRows.length,
      p_max_team_size: found.program.max_team_size || 20,
    });
    if (error) throw new Error(error.message.includes('capacity') ? 'Team capacity is full.' : 'Could not create invitation.');
    return { success: true, invitationId: invitationId || undefined };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function getTeamInvitationsAction(eventId: string, programId: string, teamId: string): Promise<{ success: boolean; error?: string; invitations?: { id: string; invitedName: string | null; invitedRegistrationNumber: string; status: string; expiresAt: string }[]; capacityReserved?: number; maxTeamSize?: number }> {
  try {
    const { event, program, leader, teamRows } = await verifiedLeader(eventId, programId, teamId);
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { data, error } = await db.from('event_team_invitations').select('id,invited_name,invited_registration_number,status,expires_at').eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).order('created_at', { ascending: false });
    if (error && !isTableMissing(error)) throw new Error('Could not load invitations.');
    if (isTableMissing(error)) return { success: true, invitations: [], capacityReserved: teamRows.length, maxTeamSize: program.max_team_size || 20 };
    const now = new Date().toISOString(); const isOpen = checkIsRegistrationOpen(event, program).isOpen;
    await db.from('event_team_invitations').update({ status: 'EXPIRED' }).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).eq('status', 'PENDING').is('acceptance_started_at', null).or(`expires_at.lte.${now}${isOpen ? '' : ',expires_at.gt.' + now}`);
    const pending = (data || []).filter(i => i.status === 'PENDING' && i.expires_at > now);
    return { success: true, capacityReserved: teamRows.length + (isOpen ? pending.length : 0), maxTeamSize: program.max_team_size || 20, invitations: (data || []).map(i => ({ id: i.id, invitedName: i.invited_name, invitedRegistrationNumber: i.invited_registration_number, status: i.status === 'PENDING' && (!isOpen || i.expires_at <= now) ? 'EXPIRED' : i.status, expiresAt: i.expires_at })) };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function cancelTeamInvitationAction(eventId: string, programId: string, teamId: string, invitationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { event, leader } = await verifiedLeader(eventId, programId, teamId);
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { data, error } = await db.from('event_team_invitations').update({ status: 'CANCELLED', responded_at: new Date().toISOString() }).eq('id', invitationId).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', programId).eq('team_id', leader.teamId).eq('invited_by_registration_number', leader.teamLeaderRegistrationNumber || leader.registrationNumber).eq('status', 'PENDING').is('acceptance_started_at', null).select('id').maybeSingle();
    if (error || !data) throw new Error('Pending invitation not found or already being processed.');
    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export type MyTeamInvitation = {
  id: string; eventId: string; eventSlug: string; eventName: string; programName: string; teamName: string;
  leaderName: string; leaderRegistrationNumber: string; invitedRegistrationNumber: string; status: string;
  expiresAt: string; unread: boolean; members: { name: string; role: string }[];
};

export async function getMyTeamInvitationsAction(eventId: string): Promise<{ success: boolean; error?: string; invitations?: MyTeamInvitation[]; unreadCount?: number }> {
  try {
    const auth = await verifyEventSession(eventId); if (!auth.isValid || !auth.session) throw new Error('Sign in with your Event Registration Number and email to view invitations.');
    const event = await getInvitationEvent(eventId);
    if (!event.registration_sheet_id || event.college_id !== auth.session.collegeId) throw new Error('Event registration data is unavailable.');
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { data, error } = await db.from('event_team_invitations').select('*').eq('college_id', event.college_id).eq('event_id', event.id).eq('invited_registration_number', auth.session.registrationNumber.toUpperCase()).order('created_at', { ascending: false });
    if (error && !isTableMissing(error)) throw new Error('Could not load invitations.');
    if (isTableMissing(error)) return { success: true, invitations: [], unreadCount: 0 };
    const now = new Date().toISOString(); const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    const invitations: MyTeamInvitation[] = [];
    for (const inv of data || []) {
      let status = inv.status;
      const program = await getInvitationProgram(inv.program_id, event.college_id);
      if (status === 'PENDING' && (inv.expires_at <= now || !checkIsRegistrationOpen(event, program).isOpen)) {
        await db.from('event_team_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING').is('acceptance_started_at', null); status = 'EXPIRED';
      }
      const team = rows.filter(r => r.eventId === event.id && r.programId === inv.program_id && r.teamId.toUpperCase() === inv.team_id.toUpperCase() && r.registrationStatus !== 'CANCELLED');
      const leader = team.find(r => r.participantRole === 'TEAM LEADER');
      if (!leader) continue;
      invitations.push({ id: inv.id, eventId: event.id, eventSlug: event.slug, eventName: event.title, programName: program.name, teamName: leader.teamName || 'Team', leaderName: leader.participantName, leaderRegistrationNumber: leader.teamLeaderRegistrationNumber || leader.registrationNumber, invitedRegistrationNumber: inv.invited_registration_number, status, expiresAt: inv.expires_at, unread: !inv.notification_read_at && status === 'PENDING', members: team.map(r => ({ name: r.participantName, role: r.participantRole === 'TEAM LEADER' ? 'Leader' : 'Member' })) });
    }
    return { success: true, invitations, unreadCount: invitations.filter(i => i.unread).length };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function markInvitationNotificationReadAction(eventId: string, invitationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyEventSession(eventId); if (!auth.isValid || !auth.session) throw new Error('Please sign in.');
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { error } = await db.from('event_team_invitations').update({ notification_read_at: new Date().toISOString() }).eq('id', invitationId).eq('event_id', eventId).eq('college_id', auth.session.collegeId).eq('invited_registration_number', auth.session.registrationNumber.toUpperCase());
    if (error && !isTableMissing(error)) throw new Error('Could not update notification.');
    if (isTableMissing(error)) return { success: true };
    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function respondToTeamInvitationAction(eventId: string, invitationId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<{ success: boolean; error?: string; eventRegistrationNumber?: string }> {
  const db = dbClient(); if (!db) return { success: false, error: 'Invitation service unavailable.' };
  let claimed = '';
  try {
    const auth = await verifyEventSession(eventId); if (!auth.isValid || !auth.session) throw new Error('Sign in to your Event Pass first.');
    const session = auth.session;
    const { data: inv } = await db.from('event_team_invitations').select('*').eq('id', invitationId).eq('event_id', eventId).eq('college_id', session.collegeId).eq('invited_registration_number', session.registrationNumber.toUpperCase()).maybeSingle();
    if (!inv) throw new Error('Invitation not found.');
    if (inv.status !== 'PENDING') throw new Error(inv.status === 'ACCEPTED' ? 'This invitation has already been accepted.' : `This invitation is ${inv.status.toLowerCase()}.`);
    const event = await getInvitationEvent(inv.event_id); const program = await getInvitationProgram(inv.program_id, inv.college_id);
    if (inv.expires_at <= new Date().toISOString() || !checkIsRegistrationOpen(event, program).isOpen) {
      await db.from('event_team_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING');
      throw new Error(inv.expires_at <= new Date().toISOString() ? 'This invitation has expired.' : 'Team registration is now closed.');
    }
    if (decision === 'DECLINE') {
      const { data, error } = await db.from('event_team_invitations').update({ status: 'DECLINED', responded_at: new Date().toISOString() }).eq('id', inv.id).eq('status', 'PENDING').is('acceptance_started_at', null).select('id').maybeSingle();
      if (error || !data) throw new Error('Invitation is already being processed.');
      return { success: true };
    }
    const stale = new Date(Date.now() - 120000).toISOString();
    const { data: lock } = await db.from('event_team_invitations').update({ acceptance_started_at: new Date().toISOString() }).eq('id', inv.id).eq('status', 'PENDING').or(`acceptance_started_at.is.null,acceptance_started_at.lt.${stale}`).select('id').maybeSingle();
    if (!lock) throw new Error('This invitation is already being processed.');
    claimed = inv.id;
    if (!event.registration_sheet_id) throw new Error('Google Sheets registration service is unavailable.');
    const rows = await getEventRegistrations(inv.college_id, event.registration_sheet_id);
    const student = rows.find(r => r.programId === '' && r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() && r.eventId === event.id && r.registrationStatus !== 'CANCELLED');
    if (!student) throw new Error('Your verified event registration was not found in Google Sheets.');
    if (inv.invited_by_registration_number.toUpperCase() === session.registrationNumber.toUpperCase()) throw new Error('Team leaders cannot accept invitations on behalf of students.');
    const teamRows = rows.filter(r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === inv.team_id.toUpperCase() && r.registrationStatus !== 'CANCELLED');
    const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader || (leader.teamLeaderRegistrationNumber || leader.registrationNumber).toUpperCase() !== inv.invited_by_registration_number.toUpperCase()) throw new Error('The team is no longer owned by the inviter.');
    if (teamRows.some(r => r.registrationNumber.toUpperCase() === student.registrationNumber.toUpperCase())) {
      const { error } = await db.from('event_team_invitations').update({ status: 'ACCEPTED', responded_at: new Date().toISOString(), acceptance_started_at: null }).eq('id', inv.id).eq('status', 'PENDING');
      if (error) throw new Error('Membership is recorded; invitation status could not be reconciled yet.');
      claimed = ''; return { success: true, eventRegistrationNumber: student.registrationNumber };
    }
    if (await findExistingProgramRegistration(inv.college_id, event.registration_sheet_id, event.id, program.id, { eventRegNumber: student.registrationNumber, studentId: student.studentId, email: student.email })) throw new Error('You are already participating in another team for this program.');
    const { count } = await db.from('event_team_invitations').select('id', { count: 'exact', head: true }).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', inv.team_id).eq('status', 'PENDING').gt('expires_at', new Date().toISOString());
    if (teamRows.length + (count || 0) > (program.max_team_size || 20)) throw new Error('Team capacity is full.');
    const paymentRequired = Boolean((event.payment_required || program.registration_fee > 0) && program.registration_fee > 0);
    await addTeamMember(inv.college_id, event.registration_sheet_id, program.slug, {
      eventId: event.id, eventSlug: event.slug, programId: program.id, programName: program.name, teamId: leader.teamId, teamName: leader.teamName,
      member: { fullName: student.participantName, studentId: student.studentId, email: student.email, mobile: student.mobile, branch: student.branch, semester: student.semester, gender: student.gender, role: 'TEAM MEMBER', eventRegNumber: student.registrationNumber },
      paymentRequired, paymentAmount: 0, paymentStatus: paymentRequired ? leader.paymentStatus || 'PENDING' : 'NOT_REQUIRED', paymentReference: leader.paymentReference || '', leaderEventRegNumber: leader.teamLeaderRegistrationNumber || leader.registrationNumber,
    });
    const { data: completed, error } = await db.from('event_team_invitations').update({ status: 'ACCEPTED', responded_at: new Date().toISOString(), acceptance_started_at: null, notification_read_at: new Date().toISOString() }).eq('id', inv.id).eq('status', 'PENDING').select('id').maybeSingle();
    if (error || !completed) throw new Error('Membership was written, but invitation status could not be finalized. Retry to reconcile.');
    claimed = '';
    return { success: true, eventRegistrationNumber: student.registrationNumber };
  } catch (e) { return { success: false, error: (e as Error).message }; }
  finally { if (claimed) await db.from('event_team_invitations').update({ acceptance_started_at: null }).eq('id', claimed).eq('status', 'PENDING'); }
}
