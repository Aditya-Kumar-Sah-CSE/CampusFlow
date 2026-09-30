'use server';

/**
 * Server Actions for Google Sheets-backed Event Registration System.
 * 
 * Flows:
 *   1. registerForEventAction → EVENT_REGISTRATIONS (Google Sheet)
 *   2. loginToEventAction → verify against EVENT_REGISTRATIONS → event session (HttpOnly cookie)
 *   3. registerForProgramAction → verify session → EVENT_REGISTRATIONS + PROGRAM_<slug>
 *   4. registerForTeamProgramAction → verify session → auto-register members → PROGRAM_<slug>
 *   5. Payment verification and admin status updates → updates Google Sheet directly
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getOrCreateEventRegistrationSpreadsheet,
  appendEventRegistration,
  appendProgramRegistration,
  findRegistrationByNumber,
  findRegistrationByStudentId,
  checkDuplicateProgramRegistration,
  createTeam,
  addTeamMember,
  getTeamMembers,
  updateRegistration,
  updatePaymentStatus,
  getEventRegistrations,
  getProgramRegistrations,
  getEventStats,
  getProgramStats,
} from '@/lib/google/event-registration-sheets';
import {
  createEventSession,
  verifyEventSession,
  destroyEventSession,
} from '@/lib/events/event-session';
import { isCollegeGoogleConfigured } from '@/lib/google/auth';
import type { SheetEventRegistrationInput, EventLoginInput } from '@/types/events';

// ============================================================
// HELPERS
// ============================================================

async function getEventWithCollege(eventId: string) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Database unavailable.');

  const { data, error } = await supabase
    .from('events')
    .select('id, college_id, title, slug, status, registration_enabled, registration_start, registration_end, payment_required, payment_amount, registration_sheet_id')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !data) throw new Error('Event not found.');
  return data;
}

async function getProgramWithEvent(programId: string, collegeId: string) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('Database unavailable.');

  const { data, error } = await supabase
    .from('event_programs')
    .select('*, category:event_categories(id, name)')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (error || !data) throw new Error('Program not found.');
  return data;
}

// ============================================================
// 1. EVENT REGISTRATION (Public — Student registers for event first)
// ============================================================

export async function registerForEventAction(
  input: SheetEventRegistrationInput
): Promise<{
  success: boolean;
  error?: string;
  registrationNumber?: string;
}> {
  try {
    // 1. Validate event
    const event = await getEventWithCollege(input.event_id);
    if (event.college_id !== input.college_id) {
      return { success: false, error: 'Event does not belong to this institution.' };
    }
    if (event.status !== 'PUBLISHED') {
      return { success: false, error: 'Event is not currently accepting registrations.' };
    }
    if (!event.registration_enabled) {
      return { success: false, error: 'Registration is disabled for this event.' };
    }

    // Validate registration window
    const now = new Date();
    if (event.registration_start && now < new Date(event.registration_start)) {
      return { success: false, error: 'Registration has not opened yet.' };
    }
    if (event.registration_end && now > new Date(event.registration_end)) {
      return { success: false, error: 'Registration deadline has passed.' };
    }

    // 2. Validate inputs
    if (!input.full_name?.trim()) {
      return { success: false, error: 'Full name is required.' };
    }
    if (!input.email?.trim() || !input.email.includes('@')) {
      return { success: false, error: 'Valid email is required.' };
    }
    if (!input.student_id?.trim()) {
      return { success: false, error: 'Student ID / Roll Number is required.' };
    }

    // 3. Check Google connection (FAIL CLOSED)
    const googleConnected = await isCollegeGoogleConfigured(event.college_id);
    if (!googleConnected) {
      return {
        success: false,
        error: 'Registration is temporarily unavailable because the college registration service is not connected.',
      };
    }

    // 4. Get or create registration spreadsheet
    const spreadsheetId = await getOrCreateEventRegistrationSpreadsheet(
      event.college_id,
      event.id,
      event.title
    );

    // 5. Append registration (collision-safe, duplicate-checked)
    const result = await appendEventRegistration(
      event.college_id,
      spreadsheetId,
      event.slug,
      {
        eventId: event.id,
        fullName: input.full_name,
        studentId: input.student_id,
        email: input.email,
        mobile: input.mobile || '',
        branch: input.branch || '',
        semester: input.semester || '',
        gender: input.gender || '',
      }
    );

    return {
      success: true,
      registrationNumber: result.registrationNumber,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed.';
    if (msg.includes('already registered')) {
      return { success: false, error: msg };
    }
    console.error('[REGISTER_FOR_EVENT_ERROR]', err);
    return { success: false, error: msg };
  }
}

// ============================================================
// 2. EVENT LOGIN (Public — Creates secure session)
// ============================================================

export async function loginToEventAction(
  input: EventLoginInput
): Promise<{
  success: boolean;
  error?: string;
  session?: {
    registrationNumber: string;
    fullName: string;
    email: string;
  };
}> {
  try {
    // 1. Validate event
    const event = await getEventWithCollege(input.event_id);
    if (event.college_id !== input.college_id) {
      return { success: false, error: 'Invalid event.' };
    }

    // 2. Check Google connection (FAIL CLOSED)
    const googleConnected = await isCollegeGoogleConfigured(event.college_id);
    if (!googleConnected) {
      return {
        success: false,
        error: 'Registration is temporarily unavailable because the college registration service is not connected.',
      };
    }

    if (!event.registration_sheet_id) {
      return { success: false, error: 'No registrations exist for this event yet.' };
    }

    // 3. Look up registration in Google Sheet
    const registration = await findRegistrationByNumber(
      event.college_id,
      event.registration_sheet_id,
      input.registration_number.trim()
    );

    if (!registration) {
      return { success: false, error: 'Registration number not found.' };
    }

    // Verify email matches
    if (registration.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      return { success: false, error: 'Email does not match registration.' };
    }

    if (registration.registrationStatus === 'CANCELLED') {
      return { success: false, error: 'Registration is cancelled or inactive.' };
    }

    // 4. Create secure server-side session
    await createEventSession({
      registrationNumber: registration.registrationNumber,
      email: registration.email,
      fullName: registration.participantName,
      studentId: registration.studentId,
      eventId: event.id,
      collegeId: event.college_id,
    });

    return {
      success: true,
      session: {
        registrationNumber: registration.registrationNumber,
        fullName: registration.participantName,
        email: registration.email,
      },
    };
  } catch (err: unknown) {
    console.error('[EVENT_LOGIN_ERROR]', err);
    return { success: false, error: 'Login failed. Please try again.' };
  }
}

// ============================================================
// 3. EVENT LOGOUT
// ============================================================

export async function logoutFromEventAction(
  eventId: string
): Promise<{ success: boolean }> {
  try {
    await destroyEventSession(eventId);
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ============================================================
// 4. REGISTER FOR PROGRAM — INDIVIDUAL (Requires event session)
// ============================================================

export async function registerForProgramAction(
  eventId: string,
  programId: string
): Promise<{
  success: boolean;
  error?: string;
  registrationNumber?: string;
  paymentStatus?: string;
}> {
  try {
    // 1. Verify event session
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: sessionResult.error || 'Please register for the event and log in first.' };
    }
    const session = sessionResult.session;

    // 2. Get event
    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration sheet not found.' };
    }

    // 3. Get program from Supabase (config)
    const program = await getProgramWithEvent(programId, session.collegeId);
    if (!program.is_active) {
      return { success: false, error: 'This program is not currently active.' };
    }

    // Validate registration window
    const now = new Date();
    if (program.registration_open_at && now < new Date(program.registration_open_at)) {
      return { success: false, error: 'Registration for this program has not opened yet.' };
    }
    if (program.registration_close_at && now > new Date(program.registration_close_at)) {
      return { success: false, error: 'Registration deadline for this program has passed.' };
    }

    // Validate participation type
    if (program.participation_type === 'TEAM') {
      return { success: false, error: 'This program requires team registration.' };
    }

    // 4. Check duplicate registration for this program
    const isDuplicate = await checkDuplicateProgramRegistration(
      session.collegeId,
      event.registration_sheet_id,
      program.id,
      session.studentId,
      session.email
    );
    if (isDuplicate) {
      return { success: false, error: 'You are already registered for this program.' };
    }

    // 5. Determine payment status
    const paymentRequired = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
    const paymentStatus = paymentRequired ? 'PENDING' : 'NOT_REQUIRED';

    // 6. Append to Google Sheets (EVENT_REGISTRATIONS + PROGRAM_<slug>)
    const result = await appendProgramRegistration(
      session.collegeId,
      event.registration_sheet_id,
      program.slug,
      {
        eventId: event.id,
        eventSlug: event.slug,
        programId: program.id,
        programName: program.name,
        participationType: 'INDIVIDUAL',
        participantRole: 'INDIVIDUAL',
        fullName: session.fullName,
        studentId: session.studentId,
        email: session.email,
        mobile: '',
        branch: '',
        semester: '',
        paymentRequired,
        paymentAmount: program.registration_fee || 0,
        paymentStatus,
        leaderEventRegNumber: session.registrationNumber,
      }
    );

    return {
      success: true,
      registrationNumber: result.registrationNumber,
      paymentStatus,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Program registration failed.';
    console.error('[REGISTER_FOR_PROGRAM_ERROR]', err);
    return { success: false, error: msg };
  }
}

// ============================================================
// 5. REGISTER FOR PROGRAM — TEAM (Requires event session = Leader)
// ============================================================

export async function registerForTeamProgramAction(
  eventId: string,
  programId: string,
  teamData: {
    teamName: string;
    members: {
      fullName: string;
      studentId: string;
      email: string;
      mobile: string;
      branch: string;
      semester: string;
    }[];
  }
): Promise<{
  success: boolean;
  error?: string;
  teamId?: string;
  leaderProgramRegNumber?: string;
  paymentStatus?: string;
}> {
  try {
    // 1. Verify event session (leader must be logged in)
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: sessionResult.error || 'Please register for the event and log in first.' };
    }
    const leader = sessionResult.session;

    // 2. Get event
    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration sheet not found.' };
    }

    // 3. Get program from Supabase
    const program = await getProgramWithEvent(programId, leader.collegeId);
    if (!program.is_active) {
      return { success: false, error: 'This program is not currently active.' };
    }
    if (program.participation_type === 'INDIVIDUAL') {
      return { success: false, error: 'This program only accepts individual registrations.' };
    }

    // Validate team name
    if (!teamData.teamName?.trim()) {
      return { success: false, error: 'Team name is required.' };
    }

    // Validate team size (leader + members)
    const totalMembers = teamData.members.length + 1;
    if (program.min_team_size != null && totalMembers < program.min_team_size) {
      return { success: false, error: `Team must have at least ${program.min_team_size} members (including leader).` };
    }
    if (program.max_team_size != null && totalMembers > program.max_team_size) {
      return { success: false, error: `Team can have at most ${program.max_team_size} members (including leader).` };
    }

    // Validate no duplicates within submitted team members
    const studentIds = new Set<string>([leader.studentId.toUpperCase()]);
    const emails = new Set<string>([leader.email.toLowerCase()]);

    for (const m of teamData.members) {
      const sId = m.studentId.trim().toUpperCase();
      const mail = m.email.trim().toLowerCase();

      if (studentIds.has(sId)) {
        return { success: false, error: `Duplicate student ID in team: ${m.studentId}` };
      }
      if (emails.has(mail)) {
        return { success: false, error: `Duplicate email in team: ${m.email}` };
      }
      studentIds.add(sId);
      emails.add(mail);
    }

    // Validate leader is not already registered for this program
    const leaderDuplicate = await checkDuplicateProgramRegistration(
      leader.collegeId,
      event.registration_sheet_id,
      program.id,
      leader.studentId,
      leader.email
    );
    if (leaderDuplicate) {
      return { success: false, error: 'Team leader is already registered for this program.' };
    }

    // Validate no member is already registered for this program
    for (const m of teamData.members) {
      const memberDuplicate = await checkDuplicateProgramRegistration(
        leader.collegeId,
        event.registration_sheet_id,
        program.id,
        m.studentId,
        m.email
      );
      if (memberDuplicate) {
        return { success: false, error: `Team member ${m.fullName} is already registered for this program.` };
      }
    }

    const spreadsheetId = event.registration_sheet_id;

    // 4. Create collision-safe Team ID
    const { teamId } = await createTeam(leader.collegeId, spreadsheetId, program.slug);

    const paymentRequired = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
    const paymentStatus = paymentRequired ? 'PENDING' : 'NOT_REQUIRED';

    // 5. Add Leader
    const leaderResult = await addTeamMember(leader.collegeId, spreadsheetId, program.slug, {
      eventId: event.id,
      eventSlug: event.slug,
      programId: program.id,
      programName: program.name,
      teamId,
      teamName: teamData.teamName.trim(),
      member: {
        fullName: leader.fullName,
        studentId: leader.studentId,
        email: leader.email,
        mobile: '',
        branch: '',
        semester: '',
        role: 'TEAM LEADER',
      },
      paymentRequired,
      paymentAmount: program.registration_fee || 0,
      paymentStatus,
      leaderEventRegNumber: leader.registrationNumber,
    });

    // 6. Add each member (Auto-registers for event if not yet registered)
    for (const member of teamData.members) {
      await addTeamMember(leader.collegeId, spreadsheetId, program.slug, {
        eventId: event.id,
        eventSlug: event.slug,
        programId: program.id,
        programName: program.name,
        teamId,
        teamName: teamData.teamName.trim(),
        member: {
          fullName: member.fullName.trim(),
          studentId: member.studentId.trim(),
          email: member.email.trim(),
          mobile: member.mobile.trim(),
          branch: member.branch.trim(),
          semester: member.semester.trim(),
          role: 'TEAM MEMBER',
        },
        paymentRequired,
        paymentAmount: 0, // fee charged once per team or per registration
        paymentStatus,
        leaderEventRegNumber: leader.registrationNumber,
      });
    }

    return {
      success: true,
      teamId,
      leaderProgramRegNumber: leaderResult.programRegNumber,
      paymentStatus,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Team registration failed.';
    console.error('[REGISTER_FOR_TEAM_PROGRAM_ERROR]', err);
    return { success: false, error: msg };
  }
}

// ============================================================
// 6. ADMIN: PAYMENT VERIFICATION (Updates Google Sheet directly)
// ============================================================

export async function verifyProgramPaymentSheetAction(
  eventId: string,
  registrationNumber: string,
  adminCollegeId?: string,
  programSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await getEventWithCollege(eventId);
    const collegeId = adminCollegeId || event.college_id;

    if (!event.registration_sheet_id) {
      return { success: false, error: 'No registration sheet for this event.' };
    }

    const result = await updatePaymentStatus(
      collegeId,
      event.registration_sheet_id,
      registrationNumber,
      'VERIFIED',
      undefined,
      programSlug
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: 'Registration not found in sheet.' };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Payment verification failed.' };
  }
}

export async function rejectProgramPaymentSheetAction(
  eventId: string,
  registrationNumber: string,
  adminCollegeId?: string,
  programSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await getEventWithCollege(eventId);
    const collegeId = adminCollegeId || event.college_id;

    if (!event.registration_sheet_id) {
      return { success: false, error: 'No registration sheet for this event.' };
    }

    const result = await updatePaymentStatus(
      collegeId,
      event.registration_sheet_id,
      registrationNumber,
      'REJECTED',
      undefined,
      programSlug
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: 'Registration not found in sheet.' };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Payment rejection failed.' };
  }
}

// ============================================================
// 7. ADMIN: UPDATE REGISTRATION STATUS
// ============================================================

export async function updateProgramRegStatusSheetAction(
  eventId: string,
  registrationNumber: string,
  newStatus: string,
  adminCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await getEventWithCollege(eventId);
    const collegeId = adminCollegeId || event.college_id;

    if (!event.registration_sheet_id) {
      return { success: false, error: 'No registration sheet.' };
    }

    const result = await updateRegistration(
      collegeId,
      event.registration_sheet_id,
      registrationNumber,
      { registrationStatus: newStatus }
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: 'Registration not found in sheet.' };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Status update failed.' };
  }
}

// ============================================================
// 8. SUBMIT PAYMENT REFERENCE
// ============================================================

export async function submitPaymentReferenceAction(
  eventId: string,
  registrationNumber: string,
  paymentReference: string,
  programSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Please log in first.' };
    }

    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Registration sheet not found.' };
    }

    const updated = await updatePaymentStatus(
      sessionResult.session.collegeId,
      event.registration_sheet_id,
      registrationNumber,
      'SUBMITTED',
      paymentReference.trim(),
      programSlug
    );

    if (!updated) {
      return { success: false, error: 'Could not update payment record in sheet.' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to submit payment.' };
  }
}

// ============================================================
// 9. STUDENT: GET OWN REGISTRATIONS (From Google Sheet)
// ============================================================

export async function getStudentRegistrationsAction(
  eventId: string
): Promise<{
  success: boolean;
  error?: string;
  eventRegistration?: {
    registrationNumber: string;
    fullName: string;
    studentId: string;
    email: string;
    registeredAt: string;
  };
  programs?: {
    registrationNumber: string;
    programName: string;
    participationType: string;
    teamId: string;
    teamName: string;
    participantRole: string;
    paymentAmount: number;
    paymentStatus: string;
    paymentReference: string;
    registrationStatus: string;
    registeredAt: string;
  }[];
}> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Please log in to view your registrations.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: true, programs: [] };
    }

    const allRows = await getEventRegistrations(
      session.collegeId,
      event.registration_sheet_id
    );

    // 1. Base event registration
    const baseReg = allRows.find(
      r =>
        r.programId === '' &&
        (r.registrationNumber === session.registrationNumber ||
          r.studentId.toUpperCase() === session.studentId.toUpperCase())
    );

    // 2. Program registrations for this student (either directly or via team leader)
    const myPrograms = allRows.filter(
      r =>
        r.programId !== '' &&
        (r.studentId.toUpperCase() === session.studentId.toUpperCase() ||
          r.email.toLowerCase() === session.email.toLowerCase() ||
          r.teamLeaderRegistrationNumber === session.registrationNumber)
    );

    return {
      success: true,
      eventRegistration: baseReg
        ? {
            registrationNumber: baseReg.registrationNumber,
            fullName: baseReg.participantName,
            studentId: baseReg.studentId,
            email: baseReg.email,
            registeredAt: baseReg.registeredAt,
          }
        : {
            registrationNumber: session.registrationNumber,
            fullName: session.fullName,
            studentId: session.studentId,
            email: session.email,
            registeredAt: '',
          },
      programs: myPrograms.map(p => ({
        registrationNumber: p.registrationNumber,
        programName: p.programName,
        participationType: p.participationType,
        teamId: p.teamId,
        teamName: p.teamName,
        participantRole: p.participantRole,
        paymentAmount: p.paymentAmount,
        paymentStatus: p.paymentStatus,
        paymentReference: p.paymentReference,
        registrationStatus: p.registrationStatus,
        registeredAt: p.registeredAt,
      })),
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to fetch registrations.' };
  }
}

// ============================================================
// 10. PUBLIC: GET SAFE PARTICIPANTS (Privacy-Preserving)
// ============================================================

export async function getSafePublicParticipantsAction(
  eventId: string,
  collegeId: string
): Promise<{
  success: boolean;
  participants: {
    registrationNumber: string;
    participantName: string;
    branch: string;
    semester: string;
    programName: string;
    teamName: string;
    participationType: string;
  }[];
}> {
  try {
    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: true, participants: [] };
    }

    const rows = await getEventRegistrations(collegeId, event.registration_sheet_id);

    // Only return safe fields — NEVER return email, mobile, payment details!
    const safe = rows
      .filter(r => r.registrationStatus !== 'CANCELLED')
      .map(r => ({
        registrationNumber: r.registrationNumber,
        participantName: r.participantName,
        branch: r.branch,
        semester: r.semester,
        programName: r.programName || 'General Event Registration',
        teamName: r.teamName,
        participationType: r.participationType,
      }));

    return { success: true, participants: safe };
  } catch {
    return { success: true, participants: [] };
  }
}
