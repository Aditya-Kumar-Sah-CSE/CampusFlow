'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyEventSession } from '@/lib/events/event-session';
import { checkIsRegistrationOpen } from '@/lib/events/registration-status';
import { getInvitationEvent, getInvitationProgram } from '@/lib/events/invitation-context';
import {
  addTeamMember, findExistingProgramRegistration, getEventRegistrations,
} from '@/lib/google/event-registration-sheets';

const dbClient = () => createAdminClient();

function isTableMissing(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01');
}

// ============================================================
// 1. TEAM SEARCH (Student searching for teams to join)
// ============================================================

export interface TeamSearchResult {
  teamId: string;
  teamName: string;
  programName: string;
  leaderName: string;
  memberCount: number;
  maxTeamSize: number;
  hasCapacity: boolean;
}

export async function searchTeamsAction(input: {
  eventId: string;
  programId: string;
  query?: string;
}): Promise<{ success: boolean; error?: string; teams?: TeamSearchResult[] }> {
  try {
    const auth = await verifyEventSession(input.eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(input.eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
    const program = await getInvitationProgram(input.programId, event.college_id);
    if (program.event_id !== event.id || program.college_id !== event.college_id) throw new Error('PROGRAM_NOT_FOUND');
    if (program.participation_type !== 'TEAM' && program.participation_type !== 'BOTH') {
      throw new Error('This program does not support teams.');
    }

    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    // Get all program rows for this program
    const programRows = rows.filter(r =>
      r.eventId === event.id &&
      r.programId === program.id &&
      r.registrationStatus !== 'CANCELLED'
    );

    // Group by teamId
    const teamMap = new Map<string, typeof programRows>();
    for (const r of programRows) {
      if (!r.teamId) continue;
      const key = r.teamId.toUpperCase();
      if (!teamMap.has(key)) teamMap.set(key, []);
      teamMap.get(key)!.push(r);
    }

    const maxSize = program.max_team_size || 20;
    const query = (input.query || '').trim().toLowerCase();
    const teams: TeamSearchResult[] = [];

    for (const [, members] of teamMap) {
      const leader = members.find(r => r.participantRole === 'TEAM LEADER');
      if (!leader) continue;

      // Filter by search query
      if (query) {
        const matchName = leader.teamName.toLowerCase().includes(query);
        const matchId = leader.teamId.toLowerCase().includes(query);
        const matchLeader = leader.participantName.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchLeader) continue;
      }

      // Don't show teams the student is already in
      if (members.some(r =>
        r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
        r.email.toLowerCase() === session.email.toLowerCase() ||
        (session.studentId && r.studentId.toUpperCase() === session.studentId.toUpperCase())
      )) continue;

      teams.push({
        teamId: leader.teamId,
        teamName: leader.teamName || 'Team',
        programName: program.name,
        leaderName: leader.participantName,
        memberCount: members.length,
        maxTeamSize: maxSize,
        hasCapacity: members.length < maxSize,
      });
    }

    // Sort: teams with capacity first, then by name
    teams.sort((a, b) => {
      if (a.hasCapacity !== b.hasCapacity) return a.hasCapacity ? -1 : 1;
      return a.teamName.localeCompare(b.teamName);
    });

    return { success: true, teams };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 2. REQUEST TO JOIN
// ============================================================

export async function requestToJoinTeamAction(input: {
  eventId: string;
  programId: string;
  teamId: string;
}): Promise<{ success: boolean; error?: string; requestId?: string }> {
  try {
    const auth = await verifyEventSession(input.eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(input.eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
    const program = await getInvitationProgram(input.programId, event.college_id);
    if (program.event_id !== event.id) throw new Error('PROGRAM_NOT_FOUND');

    const open = checkIsRegistrationOpen(event, program);
    if (!open.isOpen) throw new Error(open.reason || 'Registration is closed.');

    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);

    // Verify student has event registration
    const studentEventReg = rows.find(r =>
      r.programId === '' &&
      r.eventId === event.id &&
      r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    if (!studentEventReg) throw new Error('Your event registration could not be verified.');

    // Verify team exists
    const teamRows = rows.filter(r =>
      r.eventId === event.id &&
      r.programId === program.id &&
      r.teamId.toUpperCase() === input.teamId.trim().toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader) throw new Error('Team not found.');

    // Check capacity
    const maxSize = program.max_team_size || 20;
    if (teamRows.length >= maxSize) throw new Error('This team is already full.');

    // Check student is not the team leader
    if (leader.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
        leader.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase()) {
      throw new Error('You are the team leader of this team.');
    }

    // Check student is not already in this team
    if (teamRows.some(r =>
      r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
      r.email.toLowerCase() === session.email.toLowerCase() ||
      (session.studentId && r.studentId.toUpperCase() === session.studentId.toUpperCase())
    )) throw new Error('You are already a member of this team.');

    // Check student not already registered for this program
    const existingProgramReg = await findExistingProgramRegistration(
      event.college_id, event.registration_sheet_id, event.id, program.id,
      { eventRegNumber: session.registrationNumber, studentId: session.studentId, email: session.email }
    );
    if (existingProgramReg) throw new Error('You are already registered for this program.');

    // Create join request in Supabase
    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    const { data: requestId, error } = await db.rpc('create_team_join_request', {
      p_college_id: event.college_id,
      p_event_id: event.id,
      p_program_id: program.id,
      p_team_id: leader.teamId,
      p_requester_registration_number: session.registrationNumber,
      p_requester_name: studentEventReg.participantName,
      p_requester_student_id: studentEventReg.studentId,
      p_requester_branch: studentEventReg.branch || '',
      p_requester_semester: studentEventReg.semester || '',
    });

    if (error) {
      if (isTableMissing(error)) throw new Error('Join request service is being set up. Please try again shortly.');
      if (error.message.includes('pending')) throw new Error('You already have a pending join request for this program.');
      console.error('[JoinRequest] RPC failed:', error.code, error.message);
      throw new Error('Could not create join request. Please try again.');
    }

    return { success: true, requestId: requestId || undefined };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 3. GET JOIN REQUESTS (Team Leader view)
// ============================================================

export interface JoinRequestItem {
  id: string;
  requesterName: string;
  requesterRegistrationNumber: string;
  requesterStudentId: string;
  requesterBranch: string;
  requesterSemester: string;
  status: string;
  createdAt: string;
  unread: boolean;
}

export async function getTeamJoinRequestsAction(
  eventId: string, programId: string, teamId: string
): Promise<{ success: boolean; error?: string; requests?: JoinRequestItem[]; unreadCount?: number }> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
    const program = await getInvitationProgram(programId, event.college_id);

    // Verify caller is team leader
    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    const teamRows = rows.filter(r =>
      r.eventId === event.id && r.programId === program.id &&
      r.teamId.toUpperCase() === teamId.trim().toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader) throw new Error('TEAM_NOT_FOUND');
    const isLeader = leader.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
                     leader.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase();
    if (!isLeader) throw new Error('NOT_TEAM_LEADER');

    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    const { data, error } = await db.from('team_join_requests')
      .select('id,requester_registration_number,requester_name,requester_student_id,requester_branch,requester_semester,status,created_at,leader_notification_read_at')
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('program_id', program.id)
      .eq('team_id', leader.teamId)
      .order('created_at', { ascending: false });

    if (error && !isTableMissing(error)) throw new Error('Could not load join requests.');
    if (isTableMissing(error)) return { success: true, requests: [], unreadCount: 0 };

    const requests: JoinRequestItem[] = (data || []).map(r => ({
      id: r.id,
      requesterName: r.requester_name || 'Student',
      requesterRegistrationNumber: r.requester_registration_number,
      requesterStudentId: r.requester_student_id || '',
      requesterBranch: r.requester_branch || '',
      requesterSemester: r.requester_semester || '',
      status: r.status,
      createdAt: r.created_at,
      unread: !r.leader_notification_read_at && r.status === 'PENDING',
    }));

    // Mark leader notifications as read
    if (requests.some(r => r.unread)) {
      await db.from('team_join_requests')
        .update({ leader_notification_read_at: new Date().toISOString() })
        .eq('college_id', event.college_id)
        .eq('event_id', event.id)
        .eq('program_id', program.id)
        .eq('team_id', leader.teamId)
        .eq('status', 'PENDING')
        .is('leader_notification_read_at', null);
    }

    return {
      success: true,
      requests,
      unreadCount: requests.filter(r => r.unread).length,
    };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 4. ACCEPT JOIN REQUEST (Team Leader)
// ============================================================

export async function acceptJoinRequestAction(
  eventId: string, programId: string, teamId: string, requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
    const program = await getInvitationProgram(programId, event.college_id);

    const open = checkIsRegistrationOpen(event, program);
    if (!open.isOpen) throw new Error(open.reason || 'Registration is closed. Pending requests cannot be accepted.');

    // Verify caller is team leader
    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    const teamRows = rows.filter(r =>
      r.eventId === event.id && r.programId === program.id &&
      r.teamId.toUpperCase() === teamId.trim().toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader) throw new Error('TEAM_NOT_FOUND');
    const isLeader = leader.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
                     leader.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase();
    if (!isLeader) throw new Error('Only the team leader can approve requests.');

    // Check capacity
    const maxSize = program.max_team_size || 20;
    if (teamRows.length >= maxSize) throw new Error('This team is already full.');

    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    // Fetch the request
    const { data: req, error: reqErr } = await db.from('team_join_requests')
      .select('*')
      .eq('id', requestId)
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('program_id', program.id)
      .eq('team_id', leader.teamId)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (reqErr && !isTableMissing(reqErr)) throw new Error('Could not verify request.');
    if (!req) throw new Error('Request not found or already processed.');

    // Re-verify requester's event registration
    const requesterReg = rows.find(r =>
      r.programId === '' &&
      r.eventId === event.id &&
      r.registrationNumber.toUpperCase() === req.requester_registration_number.toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    if (!requesterReg) throw new Error('The student\'s event registration could not be verified.');

    // Check student hasn't joined another team in the meantime
    const existingProgramReg = await findExistingProgramRegistration(
      event.college_id, event.registration_sheet_id, event.id, program.id,
      { eventRegNumber: req.requester_registration_number, studentId: requesterReg.studentId, email: requesterReg.email }
    );
    if (existingProgramReg) throw new Error('This student has already joined another team for this program.');

    // Re-check team capacity (authoritative from Sheets)
    if (teamRows.length >= maxSize) throw new Error('Team capacity is full.');

    // Add member to Google Sheets
    const paymentRequired = Boolean((event.payment_required || program.registration_fee > 0) && program.registration_fee > 0);
    await addTeamMember(event.college_id, event.registration_sheet_id, program.slug, {
      eventId: event.id, eventSlug: event.slug, programId: program.id, programName: program.name,
      teamId: leader.teamId, teamName: leader.teamName,
      member: {
        fullName: requesterReg.participantName,
        studentId: requesterReg.studentId,
        email: requesterReg.email,
        mobile: requesterReg.mobile,
        branch: requesterReg.branch,
        semester: requesterReg.semester,
        gender: requesterReg.gender,
        role: 'TEAM MEMBER',
        eventRegNumber: requesterReg.registrationNumber,
      },
      paymentRequired,
      paymentAmount: 0,
      paymentStatus: paymentRequired ? leader.paymentStatus || 'PENDING' : 'NOT_REQUIRED',
      paymentReference: leader.paymentReference || '',
      leaderEventRegNumber: leader.teamLeaderRegistrationNumber || leader.registrationNumber,
    });

    // Mark request as approved
    await db.from('team_join_requests')
      .update({
        status: 'APPROVED',
        responded_at: new Date().toISOString(),
        responded_by: session.registrationNumber.toUpperCase(),
        requester_notification_read_at: null, // Reset so student sees notification
      })
      .eq('id', requestId)
      .eq('status', 'PENDING');

    // Cancel any other pending requests from this student for this program
    await db.from('team_join_requests')
      .update({ status: 'CANCELLED', responded_at: new Date().toISOString() })
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('program_id', program.id)
      .eq('requester_registration_number', req.requester_registration_number)
      .eq('status', 'PENDING')
      .neq('id', requestId);

    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 5. REJECT JOIN REQUEST (Team Leader)
// ============================================================

export async function rejectJoinRequestAction(
  eventId: string, programId: string, teamId: string, requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');
    const program = await getInvitationProgram(programId, event.college_id);

    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    const teamRows = rows.filter(r =>
      r.eventId === event.id && r.programId === program.id &&
      r.teamId.toUpperCase() === teamId.trim().toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    const leader = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leader) throw new Error('TEAM_NOT_FOUND');
    const isLeader = leader.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
                     leader.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase();
    if (!isLeader) throw new Error('Only the team leader can manage requests.');

    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    const { data, error } = await db.from('team_join_requests')
      .update({
        status: 'REJECTED',
        responded_at: new Date().toISOString(),
        responded_by: session.registrationNumber.toUpperCase(),
        requester_notification_read_at: null,
      })
      .eq('id', requestId)
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('program_id', program.id)
      .eq('team_id', leader.teamId)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (error && !isTableMissing(error)) throw new Error('Could not process request.');
    if (!data) throw new Error('Request not found or already processed.');

    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 6. MY JOIN REQUESTS (Student view)
// ============================================================

export interface MyJoinRequest {
  id: string;
  teamId: string;
  teamName: string;
  programName: string;
  leaderName: string;
  status: string;
  createdAt: string;
  unread: boolean;
}

export async function getMyJoinRequestsAction(eventId: string): Promise<{
  success: boolean;
  error?: string;
  requests?: MyJoinRequest[];
  unreadCount?: number;
}> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');

    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    const { data, error } = await db.from('team_join_requests')
      .select('*')
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('requester_registration_number', session.registrationNumber.toUpperCase())
      .order('created_at', { ascending: false });

    if (error && !isTableMissing(error)) throw new Error('Could not load requests.');
    if (isTableMissing(error)) return { success: true, requests: [], unreadCount: 0 };

    const rows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
    const requests: MyJoinRequest[] = [];

    for (const req of data || []) {
      const program = await getInvitationProgram(req.program_id, event.college_id).catch(() => null);
      if (!program) continue;

      const teamMembers = rows.filter(r =>
        r.eventId === event.id && r.programId === req.program_id &&
        r.teamId.toUpperCase() === req.team_id.toUpperCase() &&
        r.registrationStatus !== 'CANCELLED'
      );
      const leader = teamMembers.find(r => r.participantRole === 'TEAM LEADER');

      requests.push({
        id: req.id,
        teamId: req.team_id,
        teamName: leader?.teamName || 'Team',
        programName: program.name,
        leaderName: leader?.participantName || 'Team Leader',
        status: req.status,
        createdAt: req.created_at,
        unread: !req.requester_notification_read_at && (req.status === 'APPROVED' || req.status === 'REJECTED'),
      });
    }

    // Mark requester notifications as read
    const unreadIds = (data || []).filter(r => !r.requester_notification_read_at && (r.status === 'APPROVED' || r.status === 'REJECTED')).map(r => r.id);
    if (unreadIds.length > 0) {
      for (const id of unreadIds) {
        await db.from('team_join_requests')
          .update({ requester_notification_read_at: new Date().toISOString() })
          .eq('id', id);
      }
    }

    return {
      success: true,
      requests,
      unreadCount: requests.filter(r => r.unread).length,
    };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 7. CANCEL JOIN REQUEST (Student)
// ============================================================

export async function cancelJoinRequestAction(
  eventId: string, requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) throw new Error('Sign in to your event pass first.');
    const session = auth.session;
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== session.collegeId) throw new Error('UNAUTHORIZED');

    const db = dbClient();
    if (!db) throw new Error('Request service unavailable.');

    const { data, error } = await db.from('team_join_requests')
      .update({ status: 'CANCELLED', responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('requester_registration_number', session.registrationNumber.toUpperCase())
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (error && !isTableMissing(error)) throw new Error('Could not cancel request.');
    if (!data) throw new Error('Request not found or already processed.');

    return { success: true };
  } catch (e) { return { success: false, error: (e as Error).message }; }
}

// ============================================================
// 8. GET PENDING JOIN REQUEST COUNT (for leader badge)
// ============================================================

export async function getPendingJoinRequestCountAction(
  eventId: string, programId: string, teamId: string
): Promise<{ success: boolean; count?: number }> {
  try {
    const auth = await verifyEventSession(eventId);
    if (!auth.isValid || !auth.session) return { success: true, count: 0 };
    const event = await getInvitationEvent(eventId);
    if (event.college_id !== auth.session.collegeId) return { success: true, count: 0 };

    const db = dbClient();
    if (!db) return { success: true, count: 0 };

    const { count, error } = await db.from('team_join_requests')
      .select('id', { count: 'exact', head: true })
      .eq('college_id', event.college_id)
      .eq('event_id', event.id)
      .eq('program_id', programId)
      .eq('team_id', teamId)
      .eq('status', 'PENDING');

    if (error || isTableMissing(error)) return { success: true, count: 0 };
    return { success: true, count: count || 0 };
  } catch { return { success: true, count: 0 }; }
}
