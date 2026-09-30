'use server';

import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyEventSession } from '@/lib/events/event-session';
import { checkIsRegistrationOpen } from '@/lib/events/registration-status';
import { getInvitationEvent as getEventWithCollege, getInvitationProgram as getProgramWithEvent } from '@/lib/events/invitation-context';
import { sendTeamInvitationEmail } from '@/lib/email/service';
import {
  addTeamMember, findExistingProgramRegistration, getEventRegistrations,
} from '@/lib/google/event-registration-sheets';

const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const dbClient = () => createAdminClient();

async function teamForLeader(eventId: string, programId: string, teamId: string) {
  const auth = await verifyEventSession(eventId);
  if (!auth.isValid || !auth.session) throw new Error('Please log in to your event account.');
  const event = await getEventWithCollege(eventId);
  const session = auth.session;
  if (event.college_id !== session.collegeId || !event.registration_sheet_id) throw new Error('Event registration data is unavailable.');
  const program = await getProgramWithEvent(programId, event.college_id);
  if (program.event_id !== event.id || program.college_id !== event.college_id) throw new Error('Program is not part of this event.');
  const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
  const teamRows = rows.filter(r => r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED');
  const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
  if (!leader) throw new Error('Team not found for this program.');
  const isLeader = [leader.registrationNumber, leader.teamLeaderRegistrationNumber].some(x => x?.toUpperCase() === session.registrationNumber.toUpperCase()) || leader.email.toLowerCase() === session.email.toLowerCase() || leader.studentId.toUpperCase() === session.studentId.toUpperCase();
  if (!isLeader) throw new Error('Only the Team Leader can manage invitations.');
  return { auth, session, event, program, teamRows, leader };
}

export async function createTeamMemberInvitationAction(input: { eventId: string; programId: string; teamId: string; email: string; name?: string; studentId?: string }): Promise<{ success: boolean; error?: string; inviteUrl?: string; expiresAt?: string }> {
  try {
    const { session, event, program, teamRows, leader } = await teamForLeader(input.eventId, input.programId, input.teamId);
    const open = checkIsRegistrationOpen(event, program);
    if (!open.isOpen) throw new Error(open.reason || 'Registration is closed.');
    const email = input.email.trim().toLowerCase();
    const studentId = input.studentId?.trim().toUpperCase() || '';
    const name = input.name?.trim() || '';
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid student email.');
    if (email === session.email.toLowerCase()) throw new Error('You are already the Team Leader.');
    const db = dbClient(); if (!db) throw new Error('Invitation service is unavailable.');
    const alreadyInProgram = await findExistingProgramRegistration(event.college_id, event.registration_sheet_id, event.id, program.id, { email, studentId });
    if (alreadyInProgram) throw new Error('This student is already participating in this program.');
    if (teamRows.some(r => r.email.toLowerCase() === email || (studentId && r.studentId.toUpperCase() === studentId))) throw new Error('This student is already a member of this team.');
    const { data: duplicate } = await db.from('team_member_invitations').select('id').eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('invited_email', email).eq('status', 'PENDING').gt('expires_at', new Date().toISOString()).maybeSingle();
    if (duplicate) throw new Error('An active invitation already exists for this email.');
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const { error } = await db.rpc('create_team_member_invitation', {
      p_college_id: event.college_id, p_event_id: event.id, p_program_id: program.id, p_team_id: leader.teamId,
      p_invited_email: email, p_invited_student_id: studentId, p_invited_name: name,
      p_leader_registration_number: leader.registrationNumber, p_token_hash: digest(token), p_expires_at: expiresAt,
      p_current_member_count: teamRows.length, p_max_team_size: program.max_team_size || 20,
    });
    if (error) throw new Error(error.message.includes('capacity') ? 'Team capacity is full.' : error.message.includes('uq_team_invite_email_pending') ? 'An active invitation already exists for this email.' : 'Could not create invitation.');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://feedback-management-system-kappa.vercel.app';
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/events/${encodeURIComponent(event.slug)}/invitations/${token}`;
    await sendTeamInvitationEmail({ studentEmail: email, teamName: leader.teamName || 'Team', programName: program.name, eventName: event.title, leaderName: leader.participantName, inviteUrl });
    return { success: true, inviteUrl, expiresAt };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function getTeamInvitationsAction(eventId: string, programId: string, teamId: string): Promise<{ success: boolean; error?: string; invitations?: { id: string; invitedEmail: string; invitedName: string | null; status: string; expiresAt: string }[]; capacityReserved?: number; maxTeamSize?: number }> {
  try {
    const { event, program, leader, teamRows } = await teamForLeader(eventId, programId, teamId);
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { data, error } = await db.from('team_member_invitations').select('id,invited_email,invited_name,status,expires_at').eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).order('created_at', { ascending: false });
    if (error) throw new Error('Could not load invitations.');
    const now = new Date().toISOString();
    const registrationOpen = checkIsRegistrationOpen(event, program).isOpen;
    if (!registrationOpen) {
      await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).eq('status', 'PENDING');
    } else {
      await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('college_id', event.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', leader.teamId).eq('status', 'PENDING').lte('expires_at', now);
    }
    const pending = (data || []).filter(i => i.status === 'PENDING' && i.expires_at > now);
    return { success: true, capacityReserved: teamRows.length + (registrationOpen ? pending.length : 0), maxTeamSize: program.max_team_size || 20, invitations: (data || []).map(i => ({ id: i.id, invitedEmail: i.invited_email, invitedName: i.invited_name, status: i.status === 'PENDING' && (!registrationOpen || i.expires_at <= now) ? 'EXPIRED' : i.status, expiresAt: i.expires_at })) };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function cancelTeamInvitationAction(eventId: string, programId: string, teamId: string, invitationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { event, leader } = await teamForLeader(eventId, programId, teamId);
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { error } = await db.from('team_member_invitations').update({ status: 'CANCELLED' }).eq('id', invitationId).eq('event_id', event.id).eq('college_id', event.college_id).eq('program_id', programId).eq('team_id', leader.teamId).eq('status', 'PENDING');
    if (error) throw new Error('Could not cancel invitation.');
    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function getInvitationDetailsAction(token: string): Promise<{ success: boolean; error?: string; state?: string; event?: string; eventSlug?: string; program?: string; team?: string; leader?: string; invitedEmail?: string }> {
  try {
    const db = dbClient(); if (!db) throw new Error('Invitation service unavailable.');
    const { data: inv } = await db.from('team_member_invitations').select('*').eq('token_hash', digest(token)).maybeSingle();
    if (!inv) throw new Error('This invitation is invalid.');
    const event = await getEventWithCollege(inv.event_id); const program = await getProgramWithEvent(inv.program_id, inv.college_id);
    let state = inv.status;
    if (state === 'PENDING' && Date.now() > new Date(inv.expires_at).getTime()) { await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING'); state = 'EXPIRED'; }
    const open = checkIsRegistrationOpen(event, program);
    if (state === 'PENDING' && !open.isOpen) { await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING'); state = 'CLOSED'; }
    let leaderName = 'Team Leader'; let teamName = 'Team';
    if (event.registration_sheet_id) {
      const rows = await getEventRegistrations(inv.college_id, event.registration_sheet_id);
      const leader = rows.find(r => r.programId === inv.program_id && r.teamId.toUpperCase() === inv.team_id.toUpperCase() && r.participantRole === 'TEAM LEADER');
      if (leader) { leaderName = leader.participantName; teamName = leader.teamName || 'Team'; }
    }
    return { success: true, state, event: event.title, eventSlug: event.slug, program: program.name, team: teamName, leader: leaderName, invitedEmail: inv.invited_email };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

export async function respondToTeamInvitationAction(token: string, decision: 'ACCEPT' | 'REJECT'): Promise<{ success: boolean; error?: string; state?: string }> {
  const db = dbClient(); if (!db) return { success: false, error: 'Invitation service unavailable.' };
  let claimed = '';
  try {
    const { data: inv } = await db.from('team_member_invitations').select('*').eq('token_hash', digest(token)).maybeSingle();
    if (!inv) throw new Error('This invitation is invalid.');
    const auth = await verifyEventSession(inv.event_id);
    if (!auth.isValid || !auth.session || auth.session.collegeId !== inv.college_id || auth.session.email.toLowerCase() !== inv.invited_email.toLowerCase()) throw new Error('Verify your identity by logging in to this event with the invited email.');
    if (inv.status !== 'PENDING') throw new Error(inv.status === 'ACCEPTED' ? 'This invitation has already been accepted.' : `This invitation is ${inv.status.toLowerCase()}.`);
    if (Date.now() > new Date(inv.expires_at).getTime()) { await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING'); throw new Error('This invitation has expired.'); }
    const event = await getEventWithCollege(inv.event_id); const program = await getProgramWithEvent(inv.program_id, inv.college_id);
    if (event.college_id !== inv.college_id || program.event_id !== event.id || program.college_id !== event.college_id) throw new Error('Invitation scope is invalid.');
    const open = checkIsRegistrationOpen(event, program);
    if (!open.isOpen) { await db.from('team_member_invitations').update({ status: 'EXPIRED' }).eq('id', inv.id).eq('status', 'PENDING'); throw new Error('Team registration is now closed.'); }
    if (decision === 'REJECT') {
      const { error } = await db.from('team_member_invitations').update({ status: 'REJECTED', rejected_at: new Date().toISOString() }).eq('id', inv.id).eq('status', 'PENDING');
      if (error) throw new Error('Could not reject invitation.');
      return { success: true, state: 'REJECTED' };
    }
    const staleBefore = new Date(Date.now() - 120000).toISOString();
    const { data: lock } = await db.from('team_member_invitations').update({ acceptance_started_at: new Date().toISOString() }).eq('id', inv.id).eq('status', 'PENDING').or(`acceptance_started_at.is.null,acceptance_started_at.lt.${staleBefore}`).select('id').maybeSingle();
    if (!lock) throw new Error('This invitation is already being processed.');
    claimed = inv.id;
    if (!event.registration_sheet_id) throw new Error('Google Sheets registration service is unavailable.');
    const session = auth.session;
    if (inv.invited_student_id && session.studentId.toUpperCase() !== inv.invited_student_id.toUpperCase()) throw new Error('Logged in student does not match the invited Student ID.');
    const rows = await getEventRegistrations(inv.college_id, event.registration_sheet_id);
    const members = rows.filter(r => r.programId === inv.program_id && r.teamId.toUpperCase() === inv.team_id.toUpperCase() && r.registrationStatus !== 'CANCELLED');
    const leader = members.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader) throw new Error('The invited team no longer exists.');
    const alreadyOnThisTeam = members.some(r => r.email.toLowerCase() === session.email.toLowerCase() || r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase());
    if (alreadyOnThisTeam) {
      const { error } = await db.from('team_member_invitations').update({ status: 'ACCEPTED', accepted_at: new Date().toISOString(), acceptance_started_at: null }).eq('id', inv.id).eq('status', 'PENDING');
      if (error) throw new Error('Your team membership is recorded. Invitation status will be reconciled when the service is available.');
      claimed = '';
      return { success: true, state: 'ACCEPTED' };
    }
    if (members.some(r => r.email.toLowerCase() === session.email.toLowerCase() || (session.studentId && r.studentId.toUpperCase() === session.studentId.toUpperCase()))) throw new Error('You are already a member of this team.');
    const existing = await findExistingProgramRegistration(inv.college_id, event.registration_sheet_id, event.id, program.id, { eventRegNumber: session.registrationNumber, studentId: session.studentId, email: session.email });
    if (existing) throw new Error('You are already participating in another team for this program.');
    const { count } = await db.from('team_member_invitations').select('id', { count: 'exact', head: true }).eq('college_id', inv.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('team_id', inv.team_id).eq('status', 'PENDING').gt('expires_at', new Date().toISOString());
    if (members.length + (count || 0) > (program.max_team_size || 20)) throw new Error('Team capacity is full.');
    const paymentRequired = Boolean((event.payment_required || program.registration_fee > 0) && program.registration_fee > 0);
    // Session email has just been checked against the invite. addTeamMember reuses their existing event registration number.
    await addTeamMember(inv.college_id, event.registration_sheet_id, program.slug, {
      eventId: event.id, eventSlug: event.slug, programId: program.id, programName: program.name,
      teamId: leader.teamId, teamName: leader.teamName,
      member: { fullName: session.fullName || inv.invited_name || session.email, studentId: session.studentId || inv.invited_student_id || '', email: session.email, mobile: session.mobile || '', branch: session.branch || '', semester: session.semester || '', gender: session.gender || '', role: 'TEAM MEMBER', eventRegNumber: session.registrationNumber },
      paymentRequired, paymentAmount: 0, paymentStatus: paymentRequired ? leader.paymentStatus || 'PENDING' : 'NOT_REQUIRED', paymentReference: leader.paymentReference || '', leaderEventRegNumber: leader.teamLeaderRegistrationNumber || leader.registrationNumber,
    });
    const { error } = await db.from('team_member_invitations').update({ status: 'ACCEPTED', accepted_at: new Date().toISOString(), acceptance_started_at: null }).eq('id', inv.id).eq('status', 'PENDING');
    if (error) throw new Error('Membership was written, but invitation status could not be finalized. Contact event support.');
    await db.from('team_member_invitations').update({ status: 'CANCELLED' }).eq('college_id', inv.college_id).eq('event_id', event.id).eq('program_id', program.id).eq('invited_email', inv.invited_email).eq('status', 'PENDING').neq('id', inv.id);
    claimed = '';
    return { success: true, state: 'ACCEPTED' };
  } catch (e) { return { success: false, error: (e as Error).message || 'Could not process invitation.' }; }
  finally { if (claimed) await db.from('team_member_invitations').update({ acceptance_started_at: null }).eq('id', claimed).eq('status', 'PENDING'); }
}
