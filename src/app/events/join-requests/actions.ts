'use server';

import { verifyEventSession } from '@/lib/events/event-session';
import { checkIsRegistrationOpen } from '@/lib/events/registration-status';
import { getInvitationEvent, getInvitationProgram } from '@/lib/events/invitation-context';
import {
  addTeamMember,
  findExistingProgramRegistration,
  getEventRegistrations,
  createTeamJoinRequestInSheet,
  getTeamJoinRequestsFromSheet,
  updateTeamJoinRequestStatusInSheet,
} from '@/lib/google/event-registration-sheets';

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
    if (program.participation_type !== 'TEAM' && program.participation_type !== 'BOTH') {
      throw new Error('This program does not support teams.');
    }

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

    // Write join request directly to Google Sheets (single source of truth)
    const requestId = await createTeamJoinRequestInSheet(
      event.college_id,
      event.registration_sheet_id,
      {
        eventId: event.id,
        programId: program.id,
        programName: program.name,
        teamId: leader.teamId,
        teamName: leader.teamName,
        requesterRegistrationNumber: session.registrationNumber,
        requesterName: studentEventReg.participantName,
        requesterStudentId: studentEventReg.studentId,
        requesterEmail: studentEventReg.email,
        requesterBranch: studentEventReg.branch,
        requesterSemester: studentEventReg.semester,
        requesterMobile: studentEventReg.mobile,
      }
    );

    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
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

    const allRequests = await getTeamJoinRequestsFromSheet(
      event.college_id,
      event.registration_sheet_id,
      event.id
    );

    const teamRequests = allRequests.filter(
      r =>
        r.programId === program.id &&
        r.teamId.toUpperCase() === leader.teamId.toUpperCase()
    );

    const requests: JoinRequestItem[] = teamRequests.map(r => ({
      id: r.requestId,
      requesterName: r.requesterName || 'Student',
      requesterRegistrationNumber: r.requesterRegistrationNumber,
      requesterStudentId: r.requesterStudentId || '',
      requesterBranch: r.requesterBranch || '',
      requesterSemester: r.requesterSemester || '',
      status: r.status,
      createdAt: r.createdAt,
      unread: r.status === 'PENDING',
    }));

    return {
      success: true,
      requests,
      unreadCount: requests.filter(r => r.status === 'PENDING').length,
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

    // Fetch the request from Google Sheets
    const allRequests = await getTeamJoinRequestsFromSheet(
      event.college_id,
      event.registration_sheet_id,
      event.id
    );

    const req = allRequests.find(
      r =>
        r.requestId.toUpperCase() === requestId.trim().toUpperCase() &&
        r.teamId.toUpperCase() === leader.teamId.toUpperCase() &&
        r.status === 'PENDING'
    );
    if (!req) throw new Error('Request not found or already processed.');

    // Re-verify requester's event registration
    const requesterReg = rows.find(r =>
      r.programId === '' &&
      r.eventId === event.id &&
      r.registrationNumber.toUpperCase() === req.requesterRegistrationNumber.toUpperCase() &&
      r.registrationStatus !== 'CANCELLED'
    );
    if (!requesterReg) throw new Error('The student\'s event registration could not be verified.');

    // Check student hasn't joined another team in the meantime
    const existingProgramReg = await findExistingProgramRegistration(
      event.college_id, event.registration_sheet_id, event.id, program.id,
      { eventRegNumber: req.requesterRegistrationNumber, studentId: requesterReg.studentId, email: requesterReg.email }
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

    // Mark request as approved in Google Sheets
    await updateTeamJoinRequestStatusInSheet(
      event.college_id,
      event.registration_sheet_id,
      requestId,
      'APPROVED',
      session.registrationNumber.toUpperCase()
    );

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

    await updateTeamJoinRequestStatusInSheet(
      event.college_id,
      event.registration_sheet_id,
      requestId,
      'REJECTED',
      session.registrationNumber.toUpperCase()
    );

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

    const allRequests = await getTeamJoinRequestsFromSheet(
      event.college_id,
      event.registration_sheet_id,
      event.id
    );

    const myReqs = allRequests.filter(
      r => r.requesterRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase()
    );

    const requests: MyJoinRequest[] = myReqs.map(r => ({
      id: r.requestId,
      teamId: r.teamId,
      teamName: r.teamName || 'Team',
      programName: r.programName || 'Program',
      leaderName: 'Team Leader',
      status: r.status,
      createdAt: r.createdAt,
      unread: r.status === 'APPROVED' || r.status === 'REJECTED',
    }));

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
    if (!event.registration_sheet_id) throw new Error('REGISTRATION_SHEET_NOT_FOUND');

    await updateTeamJoinRequestStatusInSheet(
      event.college_id,
      event.registration_sheet_id,
      requestId,
      'CANCELLED',
      session.registrationNumber.toUpperCase()
    );

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
    if (!event.registration_sheet_id) return { success: true, count: 0 };

    const allRequests = await getTeamJoinRequestsFromSheet(
      event.college_id,
      event.registration_sheet_id,
      eventId
    );

    const count = allRequests.filter(
      r =>
        r.programId === programId &&
        r.teamId.toUpperCase() === teamId.toUpperCase() &&
        r.status === 'PENDING'
    ).length;

    return { success: true, count };
  } catch { return { success: true, count: 0 }; }
}
