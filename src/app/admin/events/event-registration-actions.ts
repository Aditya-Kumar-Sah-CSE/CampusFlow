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
  findEventRegistrationByCredentials,
  lookupEventRegistrationByNumber,
  findExistingProgramRegistration,
  createTeam,
  addTeamMember,
  updateRegistration,
  updatePaymentStatus,
  getEventRegistrations,
  updateTeamNameInSheets,
  updateTeamMemberDetailsInSheet,
  removeTeamMemberFromSheet,
  updateStudentEventRegistrationInSheet,
  resolveEventRegistrationSpreadsheet,
} from '@/lib/google/event-registration-sheets';
import {
  createEventSession,
  verifyEventSession,
  destroyEventSession,
} from '@/lib/events/event-session';
import { isCollegeGoogleConfigured } from '@/lib/google/auth';
import {
  resolveAcademicDisplayValues,
  batchResolveAcademicDisplayValues,
} from '@/lib/events/academic-resolver';
import type { SheetEventRegistrationInput, EventLoginInput } from '@/types/events';
import type { Branch, Semester } from '@/types/database';
import { checkIsRegistrationOpen } from '@/lib/events/registration-status';
import { getEventWithCollege } from '@/lib/events/event-context';
import { getMorePublishedEventsForCollege } from '@/lib/events/service';
import { getStudentSession } from '@/lib/auth/student-auth';

// ============================================================
// HELPERS
// ============================================================

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

    // 5. Resolve branch and semester to clean display values
    let finalBranch = input.branch?.trim() || '';
    let finalSemester = input.semester?.trim() || '';
    try {
      const academic = await resolveAcademicDisplayValues(event.college_id, finalBranch, finalSemester);
      finalBranch = academic.branch;
      finalSemester = academic.semester;
    } catch {
      // non-fatal fallback
    }

    // Append registration (collision-safe, duplicate-checked)
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
        branch: finalBranch,
        semester: finalSemester,
        gender: input.gender || '',
      }
    );

    // 6. Create secure signed event session immediately
    await createEventSession({
      registrationNumber: result.registrationNumber,
      email: input.email.trim(),
      fullName: input.full_name.trim(),
      studentId: input.student_id.trim(),
      eventId: event.id,
      collegeId: event.college_id,
      mobile: input.mobile?.trim() || '',
      branch: finalBranch,
      semester: finalSemester,
      gender: input.gender?.trim() || '',
    });

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
// 2. EVENT LOGIN / CREDENTIAL VERIFICATION (Public)
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
    studentId?: string;
    mobile?: string;
    branch?: string;
    semester?: string;
    gender?: string;
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

    let registration: any = null;
    if (event.registration_sheet_id) {
      try {
        registration = await findEventRegistrationByCredentials(
          event.college_id,
          event.id,
          input.email.trim(),
          input.registration_number.trim(),
          event.registration_sheet_id
        );
      } catch (findErr) {
        console.warn('[EventLogin] findEventRegistrationByCredentials fallback:', findErr);
      }
    }

    // Fallback: Check Google Form automated responses if not found in EVENT_REGISTRATIONS sheet
    if (!registration) {
      try {
        const { fetchGoogleFormEventResponses } = await import('@/lib/google/event-registration-automated');
        const googleRes = await fetchGoogleFormEventResponses({
          collegeId: event.college_id,
          eventId: event.id,
          bypassCache: false,
        });

        const targetEmail = input.email.trim().toLowerCase();
        const targetReg = input.registration_number.trim().toLowerCase();

        const match = (googleRes.responses || []).find((r) => {
          const rEmail = r.email?.trim().toLowerCase();
          const rReg = r.registrationNumber?.trim().toLowerCase();
          const rRoll = r.rollNumber?.trim().toLowerCase();
          const rColReg = r.collegeRegistrationNumber?.trim().toLowerCase();

          const emailMatches = rEmail === targetEmail;
          const regMatches = rReg === targetReg || rRoll === targetReg || rColReg === targetReg;
          return emailMatches && regMatches;
        });

        if (match) {
          registration = {
            registrationNumber: match.registrationNumber || `REG-${match.rollNumber || '0001'}`,
            email: match.email,
            participantName: match.participantName,
            studentId: match.rollNumber || match.collegeRegistrationNumber || '',
            mobile: match.contactNumber || '',
            branch: match.branch || '',
            semester: match.year || '',
            gender: '',
            registrationStatus: 'REGISTERED',
          };
        }
      } catch (googleErr) {
        console.warn('[EventLogin] fetchGoogleFormEventResponses fallback error:', googleErr);
      }
    }

    if (!registration) {
      return { success: false, error: 'Registration number / Roll number and email combination not found.' };
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
      mobile: registration.mobile,
      branch: registration.branch,
      semester: registration.semester,
      gender: registration.gender,
    });

    return {
      success: true,
      session: {
        registrationNumber: registration.registrationNumber,
        fullName: registration.participantName,
        email: registration.email,
        studentId: registration.studentId,
        mobile: registration.mobile,
        branch: registration.branch,
        semester: registration.semester,
        gender: registration.gender,
      },
    };
  } catch (err: unknown) {
    console.error('[EVENT_LOGIN_ERROR]', err);
    return { success: false, error: 'Login failed. Please try again.' };
  }
}

/**
 * Server-side lookup: identifyStudentAction
 * Implements the architecture flow:
 * Student opens Event -> Identify Student (email / authenticated session / registration number)
 * -> Search EVENT_REGISTRATIONS Google Sheet -> Found / Not Found.
 * When found, sets session cookie and returns student details.
 */
export async function identifyStudentAction(input: {
  eventId: string;
  identifier: string; // email, registrationNumber, or roll number
}): Promise<{
  success: boolean;
  isRegistered: boolean;
  error?: string;
  participant?: {
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile: string;
    branch: string;
    semester: string;
    gender: string;
    totalPaidAmount?: number;
    isPaid?: boolean;
    specialEntryName?: string;
    hasPendingPayment?: boolean;
    pendingPaymentProgram?: string;
    pendingPaymentAmount?: number;
    canGeneratePass?: boolean;
  };
}> {
  try {
    const cleanId = input.identifier?.trim();
    if (!cleanId) {
      return { success: false, isRegistered: false, error: 'Please enter an Email Address or Event Registration Number.' };
    }

    const event = await getEventWithCollege(input.eventId);
    const googleConnected = await isCollegeGoogleConfigured(event.college_id);
    if (!googleConnected) {
      return {
        success: false,
        isRegistered: false,
        error: 'Registration service is temporarily unavailable because Google Drive connection is not configured.',
      };
    }

    console.log(`[EventVerification] eventId=${event.id} eventSlug=${event.slug} registrationSheetId=${event.registration_sheet_id}`);

    const isEmail = cleanId.includes('@');
    let registration: any = null;

    if (event.registration_sheet_id) {
      try {
        registration = await findEventRegistrationByCredentials(
          event.college_id,
          event.id,
          isEmail ? cleanId : undefined,
          !isEmail ? cleanId : undefined,
          event.registration_sheet_id
        );
      } catch (sheetLookupErr) {
        console.warn('[EventVerification] findEventRegistrationByCredentials fallback:', sheetLookupErr);
      }
    }

    // Fallback: Check Google Form responses (for Google Form / automated / small events)
    if (!registration) {
      try {
        const { fetchGoogleFormEventResponses } = await import('@/lib/google/event-registration-automated');
        const googleRes = await fetchGoogleFormEventResponses({
          collegeId: event.college_id,
          eventId: event.id,
          bypassCache: false,
        });

        const queryNorm = cleanId.toLowerCase();
        const digitsOnly = cleanId.replace(/\D/g, '');

        const found = (googleRes.responses || []).find((r) => {
          const rReg = r.registrationNumber?.trim().toLowerCase();
          const rRoll = r.rollNumber?.trim().toLowerCase();
          const rColReg = r.collegeRegistrationNumber?.trim().toLowerCase();
          const rEmail = r.email?.trim().toLowerCase();
          const rPhone = (r.contactNumber || '').replace(/\D/g, '');

          return (
            (rReg && rReg === queryNorm) ||
            (rRoll && rRoll === queryNorm) ||
            (rColReg && rColReg === queryNorm) ||
            (rEmail && rEmail === queryNorm) ||
            (digitsOnly && digitsOnly.length >= 7 && rPhone && rPhone === digitsOnly)
          );
        });

        if (found) {
          const academic = await resolveAcademicDisplayValues(
            event.college_id,
            found.branch || '',
            found.year || ''
          );

          const studentRegNo = found.registrationNumber || `REG-${found.rollNumber || '0001'}`;
          const studentId = found.rollNumber || found.collegeRegistrationNumber || '';

          // Create session cookie
          await createEventSession({
            registrationNumber: studentRegNo,
            email: found.email,
            fullName: found.participantName,
            studentId: studentId,
            eventId: event.id,
            collegeId: event.college_id,
            mobile: found.contactNumber || '',
            branch: academic.branch || found.branch || '',
            semester: academic.semester || found.year || '',
            gender: '',
          });

          return {
            success: true,
            isRegistered: true,
            participant: {
              fullName: found.participantName,
              registrationNumber: studentRegNo,
              email: found.email,
              studentId: studentId,
              mobile: found.contactNumber || '',
              branch: academic.branch || found.branch || '',
              semester: academic.semester || found.year || '',
              gender: '',
              totalPaidAmount: 0,
              isPaid: false,
              hasPendingPayment: false,
              canGeneratePass: true,
            },
          };
        }
      } catch (googleErr) {
        console.warn('[EventVerification] Google Form response search fallback error:', googleErr);
      }
    }

    if (!registration) {
      return {
        success: true,
        isRegistered: false,
        error: `No event registration found for "${cleanId}". Please register for the event first.`,
      };
    }

    const academic = await resolveAcademicDisplayValues(
      event.college_id,
      registration.branch,
      registration.semester
    );

    // Create session cookie
    await createEventSession({
      registrationNumber: registration.registrationNumber,
      email: registration.email,
      fullName: registration.participantName,
      studentId: registration.studentId,
      eventId: event.id,
      collegeId: event.college_id,
      mobile: registration.mobile,
      branch: academic.branch,
      semester: academic.semester,
      gender: registration.gender,
    });

    let totalPaid = 0;
    const specialEntryPrograms: string[] = [];
    const pendingPaymentPrograms: string[] = [];
    let pendingPaymentAmount = 0;
    let hasFreeAccess = false;

    try {
      if (event.registration_sheet_id) {
        const allRows = await getEventRegistrations(event.college_id, event.registration_sheet_id);
        const cleanReg = registration.registrationNumber.toUpperCase();
        const myRows = allRows.filter(
          (r) => r.registrationNumber.toUpperCase() === cleanReg && r.registrationStatus !== 'CANCELLED'
        );
        for (const row of myRows) {
          const isVerified = row.paymentStatus === 'PAID' || row.paymentStatus === 'VERIFIED';
          if (isVerified) {
            totalPaid += (row.paymentAmount || 0);
            if (row.programName && !specialEntryPrograms.includes(row.programName)) {
              specialEntryPrograms.push(row.programName);
            }
          } else if (
            (row.paymentAmount > 0 || row.paymentStatus === 'PENDING' || row.paymentStatus === 'SUBMITTED') &&
            row.paymentStatus !== 'REJECTED'
          ) {
            pendingPaymentAmount += (row.paymentAmount || 0);
            if (row.programName && !pendingPaymentPrograms.includes(row.programName)) {
              pendingPaymentPrograms.push(row.programName);
            }
          }

          if (
            row.programId === '' ||
            ((!row.paymentAmount || row.paymentAmount === 0) &&
              (row.paymentStatus === 'NOT_REQUIRED' || row.paymentStatus === 'FREE' || !row.paymentStatus))
          ) {
            hasFreeAccess = true;
          }
        }
      }
    } catch {
      // non-fatal
    }

    const hasPendingPayment = pendingPaymentPrograms.length > 0;
    const canGeneratePass = totalPaid > 0 || hasFreeAccess || !hasPendingPayment;

    return {
      success: true,
      isRegistered: true,
      participant: {
        fullName: registration.participantName,
        registrationNumber: registration.registrationNumber,
        email: registration.email,
        studentId: registration.studentId,
        mobile: registration.mobile,
        branch: academic.branch,
        semester: academic.semester,
        gender: registration.gender,
        totalPaidAmount: totalPaid,
        isPaid: totalPaid > 0,
        specialEntryName: specialEntryPrograms.length > 0 ? specialEntryPrograms.join(', ') : undefined,
        hasPendingPayment,
        pendingPaymentProgram: pendingPaymentPrograms.length > 0 ? pendingPaymentPrograms.join(', ') : undefined,
        pendingPaymentAmount,
        canGeneratePass,
      },
    };
  } catch (err: unknown) {
    console.error('[IDENTIFY_STUDENT_ERROR]', err);
    return {
      success: false,
      isRegistered: false,
      error: (err as Error).message || 'Failed to check registration. Please try again.',
    };
  }
}

export type StudentPassAuthStatus =
  | 'AUTHORIZED'
  | 'LOGIN_REQUIRED'
  | 'SIGNUP_REQUIRED'
  | 'ACCOUNT_MISMATCH'
  | 'EMAIL_NOT_VERIFIED';

export interface CheckStudentPassAuthResult {
  success: boolean;
  status: StudentPassAuthStatus;
  canDownload: boolean;
  isSignedUp: boolean;
  isLoggedIn: boolean;
  targetEmail: string;
  loggedInEmail?: string;
  studentName?: string;
  message: string;
  loginUrl?: string;
  signupUrl?: string;
}

/**
 * Validates if the current browser session has verified student rights to download an event pass.
 * - Prevents direct unauthorized pass downloads without student account verification.
 * - Checks if the target registration email has a registered student account in Supabase.
 * - Verifies if the currently authenticated student session matches the registration email.
 */
export async function checkStudentPassAuthStatusAction(input: {
  email: string;
  eventId?: string;
  returnUrl?: string;
}): Promise<CheckStudentPassAuthResult> {
  const targetEmail = (input.email || '').toLowerCase().trim();
  if (!targetEmail) {
    return {
      success: false,
      status: 'LOGIN_REQUIRED',
      canDownload: false,
      isSignedUp: false,
      isLoggedIn: false,
      targetEmail: '',
      message: 'A valid student email address is required to verify pass ownership.',
    };
  }

  const returnUrl = input.returnUrl || '';
  const encodedEmail = encodeURIComponent(targetEmail);
  const encodedNext = returnUrl ? `&next=${encodeURIComponent(returnUrl)}` : '';
  const loginUrl = `/auth/student/login?email=${encodedEmail}${encodedNext}`;
  const signupUrl = `/auth/student/signup?email=${encodedEmail}${encodedNext}`;

  // 1. Check current authenticated student session
  const studentSession = await getStudentSession();

  // 2. Query Supabase for student account existence
  const adminDb = createAdminClient();
  let isSignedUp = false;
  let studentName = '';
  let isDbEmailVerified = false;

  if (adminDb) {
    try {
      const { data: studentRecord } = await adminDb
        .from('students')
        .select('id, email, full_name, is_active, email_verified')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (studentRecord) {
        isSignedUp = true;
        studentName = studentRecord.full_name || '';
        isDbEmailVerified = Boolean(studentRecord.email_verified);
      } else {
        const { data: usersData } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 100 });
        const foundUser = usersData?.users?.find(
          (u) => (u.email || '').toLowerCase().trim() === targetEmail
        );
        if (foundUser) {
          isSignedUp = true;
          studentName = foundUser.user_metadata?.name || '';
          isDbEmailVerified = Boolean(foundUser.email_confirmed_at || foundUser.user_metadata?.email_verified);
        }
      }
    } catch (err) {
      console.warn('[checkStudentPassAuthStatusAction] Database check warning:', err);
    }
  }

  // 3. User is logged in
  if (studentSession.isAuthenticated && studentSession.user?.email) {
    const currentEmail = studentSession.user.email.toLowerCase().trim();

    // Check admin override privilege
    const userRole = studentSession.user?.user_metadata?.role;
    const isAdmin =
      userRole === 'SUPER_ADMIN' ||
      userRole === 'COLLEGE_SUPER_ADMIN' ||
      userRole === 'FACULTY_ADMIN';

    if (isAdmin) {
      return {
        success: true,
        status: 'AUTHORIZED',
        canDownload: true,
        isSignedUp: true,
        isLoggedIn: true,
        targetEmail,
        loggedInEmail: currentEmail,
        studentName: studentName || 'Admin User',
        message: 'Authorized via Administrator Privileges.',
        loginUrl,
        signupUrl,
      };
    }

    if (currentEmail === targetEmail) {
      const isVerified = Boolean(studentSession.emailVerified || isDbEmailVerified);
      if (isVerified) {
        return {
          success: true,
          status: 'AUTHORIZED',
          canDownload: true,
          isSignedUp: true,
          isLoggedIn: true,
          targetEmail,
          loggedInEmail: currentEmail,
          studentName: studentSession.student?.fullName || studentName || 'Student',
          message: 'Student account verified and authenticated.',
          loginUrl,
          signupUrl,
        };
      } else {
        return {
          success: true,
          status: 'EMAIL_NOT_VERIFIED',
          canDownload: false,
          isSignedUp: true,
          isLoggedIn: true,
          targetEmail,
          loggedInEmail: currentEmail,
          studentName: studentSession.student?.fullName || studentName || 'Student',
          message: `Your student email (${targetEmail}) is pending verification. Please verify your email before downloading the pass.`,
          loginUrl,
          signupUrl,
        };
      }
    } else {
      return {
        success: true,
        status: 'ACCOUNT_MISMATCH',
        canDownload: false,
        isSignedUp,
        isLoggedIn: true,
        targetEmail,
        loggedInEmail: currentEmail,
        studentName,
        message: `You are signed in as ${currentEmail}, but this pass is registered to ${targetEmail}. Please switch to the registered student account.`,
        loginUrl,
        signupUrl,
      };
    }
  }

  // 4. User is NOT logged in
  if (isSignedUp) {
    return {
      success: true,
      status: 'LOGIN_REQUIRED',
      canDownload: false,
      isSignedUp: true,
      isLoggedIn: false,
      targetEmail,
      studentName,
      message: `A student account exists for ${targetEmail}. Please sign in to verify your identity and download your official event pass.`,
      loginUrl,
      signupUrl,
    };
  } else {
    return {
      success: true,
      status: 'SIGNUP_REQUIRED',
      canDownload: false,
      isSignedUp: false,
      isLoggedIn: false,
      targetEmail,
      message: `No student account found for ${targetEmail}. Please create a student account using this email to activate and download your event pass.`,
      loginUrl,
      signupUrl,
    };
  }
}

/**
 * Server-side lookup: verifyEventRegistrationAction
 * Verifies eventId, registrationNumber, and/or registered email against Google Sheet.
 * Resolves college from validated event context (never trust client-provided collegeId).
 */
export async function verifyEventRegistrationAction(input: {
  eventId: string;
  email?: string;
  registrationNumber?: string;
  identifier?: string;
}): Promise<{
  success: boolean;
  error?: string;
  participant?: {
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile: string;
    branch: string;
    semester: string;
    gender: string;
  };
}> {
  try {
    const event = await getEventWithCollege(input.eventId);
    const googleConnected = await isCollegeGoogleConfigured(event.college_id);
    if (!googleConnected) {
      return {
        success: false,
        error: 'Registration service is temporarily unavailable because Google Drive connection is not configured.',
      };
    }

    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
    }

    console.log(`[EventVerification] eventId=${event.id} eventSlug=${event.slug} registrationSheetId=${event.registration_sheet_id}`);

    let searchEmail = input.email?.trim();
    let searchReg = input.registrationNumber?.trim();

    if (input.identifier?.trim()) {
      if (input.identifier.includes('@')) {
        searchEmail = searchEmail || input.identifier.trim();
      } else {
        searchReg = searchReg || input.identifier.trim();
      }
    }

    if (!searchEmail && !searchReg) {
      return { success: false, error: 'Please enter your Email or Event Registration Number.' };
    }

    const registration = await findEventRegistrationByCredentials(
      event.college_id,
      event.id,
      searchEmail,
      searchReg,
      event.registration_sheet_id
    );

    if (!registration) {
      return {
        success: false,
        error: 'No matching event registration found for this Registration Number and Email.',
      };
    }

    const academic = await resolveAcademicDisplayValues(
      event.college_id,
      registration.branch,
      registration.semester
    );

    // Create / refresh HTTP-only signed event session
    await createEventSession({
      registrationNumber: registration.registrationNumber,
      email: registration.email,
      fullName: registration.participantName,
      studentId: registration.studentId,
      eventId: event.id,
      collegeId: event.college_id,
      mobile: registration.mobile,
      branch: academic.branch,
      semester: academic.semester,
      gender: registration.gender,
    });

    return {
      success: true,
      participant: {
        fullName: registration.participantName,
        registrationNumber: registration.registrationNumber,
        email: registration.email,
        studentId: registration.studentId,
        mobile: registration.mobile,
        branch: academic.branch,
        semester: academic.semester,
        gender: registration.gender,
      },
    };
  } catch (err: unknown) {
    console.error('[VERIFY_EVENT_REG_ERROR]', err);
    return { success: false, error: (err as Error).message || 'Verification failed. Please try again.' };
  }
}

/**
 * Automatically resolve existing event registration from valid HTTP-only event session cookie.
 */
export async function resolveCurrentEventRegistrationAction(eventId: string): Promise<{
  isValid: boolean;
  error?: string;
  participant?: {
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile: string;
    branch: string;
    semester: string;
    gender: string;
    totalPaidAmount?: number;
    isPaid?: boolean;
    specialEntryName?: string;
    hasPendingPayment?: boolean;
    pendingPaymentProgram?: string;
    pendingPaymentAmount?: number;
    canGeneratePass?: boolean;
  };
}> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { isValid: false, error: sessionResult.error };
    }
    const s = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    let totalPaid = 0;
    const specialEntryPrograms: string[] = [];
    const pendingPaymentPrograms: string[] = [];
    let pendingPaymentAmount = 0;
    let hasFreeAccess = false;

    if (event.registration_sheet_id) {
      try {
        const allRows = await getEventRegistrations(s.collegeId, event.registration_sheet_id);
        const cleanReg = s.registrationNumber.toUpperCase();
        const myRows = allRows.filter(
          (r) => r.registrationNumber.toUpperCase() === cleanReg && r.registrationStatus !== 'CANCELLED'
        );
        for (const row of myRows) {
          const isVerified = row.paymentStatus === 'PAID' || row.paymentStatus === 'VERIFIED';
          if (isVerified) {
            totalPaid += (row.paymentAmount || 0);
            if (row.programName && !specialEntryPrograms.includes(row.programName)) {
              specialEntryPrograms.push(row.programName);
            }
          } else if (
            (row.paymentAmount > 0 || row.paymentStatus === 'PENDING' || row.paymentStatus === 'SUBMITTED') &&
            row.paymentStatus !== 'REJECTED'
          ) {
            pendingPaymentAmount += (row.paymentAmount || 0);
            if (row.programName && !pendingPaymentPrograms.includes(row.programName)) {
              pendingPaymentPrograms.push(row.programName);
            }
          }

          if (
            row.programId === '' ||
            ((!row.paymentAmount || row.paymentAmount === 0) &&
              (row.paymentStatus === 'NOT_REQUIRED' || row.paymentStatus === 'FREE' || !row.paymentStatus))
          ) {
            hasFreeAccess = true;
          }
        }
      } catch {
        // non-fatal
      }

      const hasPendingPayment = pendingPaymentPrograms.length > 0;
      const canGeneratePass = totalPaid > 0 || hasFreeAccess || !hasPendingPayment;

      try {
        const row = await findEventRegistrationByCredentials(
          s.collegeId,
          eventId,
          s.email,
          s.registrationNumber,
          event.registration_sheet_id
        );
        if (row) {
          const academic = await resolveAcademicDisplayValues(
            s.collegeId,
            row.branch,
            row.semester
          );
          return {
            isValid: true,
            participant: {
              fullName: row.participantName,
              registrationNumber: row.registrationNumber,
              email: row.email,
              studentId: row.studentId,
              mobile: row.mobile,
              branch: academic.branch,
              semester: academic.semester,
              gender: row.gender,
              totalPaidAmount: totalPaid,
              isPaid: totalPaid > 0,
              specialEntryName: specialEntryPrograms.length > 0 ? specialEntryPrograms.join(', ') : undefined,
              hasPendingPayment,
              pendingPaymentProgram: pendingPaymentPrograms.length > 0 ? pendingPaymentPrograms.join(', ') : undefined,
              pendingPaymentAmount,
              canGeneratePass,
            },
          };
        }
      } catch (sheetErr) {
        console.warn('[RESOLVE_REG_SHEET_WARN]', sheetErr);
      }
    }

    const fallbackAcademic = await resolveAcademicDisplayValues(
      s.collegeId,
      s.branch,
      s.semester
    );

    const hasPendingPayment = pendingPaymentPrograms.length > 0;
    const canGeneratePass = totalPaid > 0 || hasFreeAccess || !hasPendingPayment;

    return {
      isValid: true,
      participant: {
        fullName: s.fullName,
        registrationNumber: s.registrationNumber,
        email: s.email,
        studentId: s.studentId,
        mobile: s.mobile || '',
        branch: fallbackAcademic.branch,
        semester: fallbackAcademic.semester,
        gender: s.gender || '',
        totalPaidAmount: totalPaid,
        isPaid: totalPaid > 0,
        specialEntryName: specialEntryPrograms.length > 0 ? specialEntryPrograms.join(', ') : undefined,
        hasPendingPayment,
        pendingPaymentProgram: pendingPaymentPrograms.length > 0 ? pendingPaymentPrograms.join(', ') : undefined,
        pendingPaymentAmount,
        canGeneratePass,
      },
    };
  } catch (err) {
    return { isValid: false, error: (err as Error).message };
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
// ============================================================
// 4. CHECK PROGRAM REGISTRATION & MEMBER LOOKUP
// ============================================================

/**
 * Check if the currently verified student is already registered for a specific program.
 * Google Sheet is the source of truth.
 */
export async function checkProgramRegistrationAction(
  eventId: string,
  programId: string
): Promise<{
  isRegistered: boolean;
  registration?: {
    registrationNumber: string;
    programName: string;
    participationType: string;
    teamId: string;
    teamName: string;
    participantRole: string;
    paymentStatus: string;
    registeredAt: string;
  };
}> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { isRegistered: false };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (event.college_id !== session.collegeId) return { isRegistered: false };
    if (!event.registration_sheet_id) {
      // No sheet means no program registrations possible yet
      return { isRegistered: false };
    }

    const existing = await findExistingProgramRegistration(
      session.collegeId,
      event.registration_sheet_id,
      event.id,
      programId,
      {
        eventRegNumber: session.registrationNumber,
        studentId: session.studentId,
        email: session.email,
      }
    );

    if (existing) {
      return {
        isRegistered: true,
        registration: {
          registrationNumber: existing.registrationNumber,
          programName: existing.programName,
          participationType: existing.participationType,
          teamId: existing.teamId,
          teamName: existing.teamName,
          participantRole: existing.participantRole,
          paymentStatus: existing.paymentStatus,
          registeredAt: existing.registeredAt,
        },
      };
    }

    return { isRegistered: false };
  } catch {
    return { isRegistered: false };
  }
}

/**
 * Server-side lookup of an existing event registration by registration number for team member addition.
 * Returns only safe fields (Name, Registration Number, Student ID, Email, Branch, Semester).
 */
export async function lookupTeamMemberAction(
  eventId: string,
  registrationNumber: string
): Promise<{
  success: boolean;
  error?: string;
  member?: {
    fullName: string;
    registrationNumber: string;
    studentId: string;
    email: string;
    branch: string;
    semester: string;
    gender: string;
  };
}> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Event registration session is required to search team members.' };
    }

    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
    }

    const reg = await lookupEventRegistrationByNumber(
      sessionResult.session.collegeId,
      event.registration_sheet_id,
      event.id,
      registrationNumber.trim()
    );

    if (!reg) {
      return {
        success: false,
        error: `No event registration found with number "${registrationNumber.trim().toUpperCase()}".`,
      };
    }

    const academic = await resolveAcademicDisplayValues(
      sessionResult.session.collegeId,
      reg.branch,
      reg.semester
    );

    return {
      success: true,
      member: {
        fullName: reg.participantName,
        registrationNumber: reg.registrationNumber,
        studentId: reg.studentId,
        email: reg.email,
        branch: academic.branch,
        semester: academic.semester,
        gender: reg.gender,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to lookup member.' };
  }
}

// ============================================================
// 5. REGISTER FOR PROGRAM — INDIVIDUAL (Requires event session)
// ============================================================

export async function registerForProgramAction(
  eventId: string,
  programId: string
): Promise<{
  success: boolean;
  error?: string;
  isDuplicate?: boolean;
  registrationNumber?: string;
  paymentStatus?: string;
  existingRegistration?: {
    registrationNumber: string;
    programName: string;
    participationType: string;
    teamName: string;
    paymentStatus: string;
    registeredAt: string;
  };
}> {
  try {
    // 1. Verify event session
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: sessionResult.error || 'Please register for the event and verify your credentials first.' };
    }
    const session = sessionResult.session;

    // 2. Get event
    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
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

    // 4. Duplicate Program Protection: Check Google Sheets PROGRAM_REGISTRATIONS
    const existing = await findExistingProgramRegistration(
      session.collegeId,
      event.registration_sheet_id,
      event.id,
      program.id,
      {
        eventRegNumber: session.registrationNumber,
        studentId: session.studentId,
        email: session.email,
      }
    );

    if (existing) {
      return {
        success: false,
        error: 'You are already registered for this program.',
        isDuplicate: true,
        existingRegistration: {
          registrationNumber: existing.registrationNumber,
          programName: existing.programName,
          participationType: existing.participationType,
          teamName: existing.teamName,
          paymentStatus: existing.paymentStatus,
          registeredAt: existing.registeredAt,
        },
      };
    }

    // 5. Load full verified student details from Google Sheets / Session (read-only)
    let finalMobile = session.mobile || '';
    let finalBranch = session.branch || '';
    let finalSemester = session.semester || '';
    let finalGender = session.gender || '';

    try {
      const reg = await findEventRegistrationByCredentials(
        session.collegeId,
        event.id,
        session.email,
        session.registrationNumber,
        event.registration_sheet_id
      );
      if (reg) {
        finalMobile = reg.mobile || finalMobile;
        finalBranch = reg.branch || finalBranch;
        finalSemester = reg.semester || finalSemester;
        finalGender = reg.gender || finalGender;
      }
    } catch {
      // non-fatal
    }

    // Resolve academic values to human-readable names for program sheet
    const academic = await resolveAcademicDisplayValues(
      session.collegeId,
      finalBranch,
      finalSemester
    );
    finalBranch = academic.branch;
    finalSemester = academic.semester;

    // 6. Determine payment status
    const paymentRequired = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
    const paymentStatus = paymentRequired ? 'PENDING' : 'NOT_REQUIRED';

    // 7. Append to Google Sheets (Writes to PROGRAM_<slug> and program entry in EVENT_REGISTRATIONS; does NOT create another EVENT registration row)
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
        mobile: finalMobile,
        branch: finalBranch,
        semester: finalSemester,
        gender: finalGender,
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
// 6. REGISTER FOR PROGRAM — TEAM (Requires event session = Leader)
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
      gender?: string;
      eventRegNumber?: string;
    }[];
  }
): Promise<{
  success: boolean;
  error?: string;
  isDuplicate?: boolean;
  teamId?: string;
  leaderProgramRegNumber?: string;
  paymentStatus?: string;
}> {
  try {
    // 1. Verify event session (leader must be logged in)
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: sessionResult.error || 'Please register for the event and verify your credentials first.' };
    }
    const leader = sessionResult.session;

    // 2. Get event
    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
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
    const regNums = new Set<string>([leader.registrationNumber.toUpperCase()]);

    for (const m of teamData.members) {
      const sId = m.studentId.trim().toUpperCase();
      const mail = m.email.trim().toLowerCase();
      const rNum = m.eventRegNumber?.trim().toUpperCase();

      if (rNum && regNums.has(rNum)) {
        return { success: false, error: `Duplicate registration number in team: ${m.eventRegNumber}` };
      }
      if (sId && studentIds.has(sId)) {
        return { success: false, error: `Duplicate student ID in team: ${m.studentId}` };
      }
      if (mail && emails.has(mail)) {
        return { success: false, error: `Duplicate email in team: ${m.email}` };
      }

      if (rNum) regNums.add(rNum);
      if (sId) studentIds.add(sId);
      if (mail) emails.add(mail);
    }

    // Validate leader duplicate registration
    const leaderDuplicate = await findExistingProgramRegistration(
      leader.collegeId,
      event.registration_sheet_id,
      event.id,
      program.id,
      {
        eventRegNumber: leader.registrationNumber,
        studentId: leader.studentId,
        email: leader.email,
      }
    );
    if (leaderDuplicate) {
      return { success: false, error: 'Team leader is already registered for this program.', isDuplicate: true };
    }

    // Validate no member is already registered for this program
    for (const m of teamData.members) {
      const memberDuplicate = await findExistingProgramRegistration(
        leader.collegeId,
        event.registration_sheet_id,
        event.id,
        program.id,
        {
          eventRegNumber: m.eventRegNumber,
          studentId: m.studentId,
          email: m.email,
        }
      );
      if (memberDuplicate) {
        return {
          success: false,
          error: `Team member ${m.fullName} is already registered for this program.`,
          isDuplicate: true,
        };
      }
    }

    const spreadsheetId = event.registration_sheet_id;

    // 4. Create collision-safe Team ID
    const { teamId } = await createTeam(leader.collegeId, spreadsheetId, program.slug);

    const paymentRequired = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
    const paymentStatus = paymentRequired ? 'PENDING' : 'NOT_REQUIRED';

    // 5. Load full leader details from Google Sheet / session
    let leaderMobile = leader.mobile || '';
    let leaderBranch = leader.branch || '';
    let leaderSemester = leader.semester || '';
    let leaderGender = leader.gender || '';

    try {
      const leaderRow = await findEventRegistrationByCredentials(
        leader.collegeId,
        event.id,
        leader.email,
        leader.registrationNumber,
        spreadsheetId
      );
      if (leaderRow) {
        leaderMobile = leaderRow.mobile || leaderMobile;
        leaderBranch = leaderRow.branch || leaderBranch;
        leaderSemester = leaderRow.semester || leaderSemester;
        leaderGender = leaderRow.gender || leaderGender;
      }
    } catch {
      // non-fatal
    }

    // Resolve leader academic values to human-readable names
    const leaderAcademic = await resolveAcademicDisplayValues(
      leader.collegeId,
      leaderBranch,
      leaderSemester
    );
    leaderBranch = leaderAcademic.branch;
    leaderSemester = leaderAcademic.semester;

    // 6. Add Leader (Participant Role = TEAM LEADER)
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
        mobile: leaderMobile,
        branch: leaderBranch,
        semester: leaderSemester,
        gender: leaderGender,
        role: 'TEAM LEADER',
        eventRegNumber: leader.registrationNumber,
      },
      paymentRequired,
      paymentAmount: program.registration_fee || 0,
      paymentStatus,
      leaderEventRegNumber: leader.registrationNumber,
    });

    // 7. Add each member (re-uses existing event registration if found; otherwise auto-registers)
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
          mobile: member.mobile?.trim() || '',
          branch: member.branch?.trim() || '',
          semester: member.semester?.trim() || '',
          gender: member.gender?.trim() || '',
          role: 'TEAM MEMBER',
          eventRegNumber: member.eventRegNumber?.trim() || undefined,
        },
        paymentRequired,
        paymentAmount: 0, // fee charged once per team
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

    const sheetId = event.registration_sheet_id
      || await resolveEventRegistrationSpreadsheet(collegeId, event.id, event.title);

    if (!sheetId) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
    }

    const result = await updatePaymentStatus(
      collegeId,
      sheetId,
      registrationNumber,
      'VERIFIED',
      undefined,
      programSlug
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: `Registration "${registrationNumber}" not found in sheet.` };
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

    const sheetId = event.registration_sheet_id
      || await resolveEventRegistrationSpreadsheet(collegeId, event.id, event.title);

    if (!sheetId) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
    }

    const result = await updatePaymentStatus(
      collegeId,
      sheetId,
      registrationNumber,
      'REJECTED',
      undefined,
      programSlug
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: `Registration "${registrationNumber}" not found in sheet.` };
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

    const sheetId = event.registration_sheet_id
      || await resolveEventRegistrationSpreadsheet(collegeId, event.id, event.title);

    if (!sheetId) {
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
    }

    const result = await updateRegistration(
      collegeId,
      sheetId,
      registrationNumber,
      { registrationStatus: newStatus }
    );

    if (result) {
      revalidatePath('/admin/dashboard');
      return { success: true };
    }
    return { success: false, error: `Registration "${registrationNumber}" not found in sheet.` };
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
      return { success: false, error: 'Event registration data is temporarily unavailable. Please try again later.' };
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

export interface TeamMemberDetails {
  registrationNumber: string;
  fullName: string;
  studentId: string;
  email: string;
  mobile: string;
  branch: string;
  semester: string;
  gender?: string;
  participantRole: string;
  registeredAt?: string;
}

export interface StudentProgramRegistrationItem {
  registrationNumber: string;
  programId: string;
  programSlug: string;
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
  minTeamSize?: number;
  maxTeamSize?: number;
  isRegistrationOpen: boolean;
  registrationClosedReason?: string;
  teamMembers?: TeamMemberDetails[];
}

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
  programs?: StudentProgramRegistrationItem[];
}> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Please log in to view your registrations.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (event.college_id !== session.collegeId) return { success: false, error: 'UNAUTHORIZED' };
    let allRows: any[] = [];
    if (event.registration_sheet_id) {
      try {
        allRows = await getEventRegistrations(
          session.collegeId,
          event.registration_sheet_id
        );
      } catch (err) {
        console.warn('[GetStudentRegistrations] getEventRegistrations fallback for Google Form events:', err);
      }
    }

    // 1. Base event registration
    const baseReg = allRows.find(
      r =>
        r.programId === '' &&
        (r.registrationNumber === session.registrationNumber ||
          r.studentId.toUpperCase() === session.studentId.toUpperCase())
    ) || {
      registrationNumber: session.registrationNumber,
      participantName: session.fullName,
      studentId: session.studentId,
      email: session.email,
      registeredAt: '',
    };

    // 2. Program registrations for this student (their own participation row)
    const myProgramRows = allRows.filter(
      r =>
        r.programId !== '' &&
        r.registrationStatus !== 'CANCELLED' &&
        (r.studentId.toUpperCase() === session.studentId.toUpperCase() ||
          r.email.toLowerCase() === session.email.toLowerCase() ||
          r.registrationNumber.toUpperCase() === session.registrationNumber.toUpperCase() ||
          (r.participantRole === 'TEAM LEADER' && r.teamLeaderRegistrationNumber.toUpperCase() === session.registrationNumber.toUpperCase()))
    );

    // Fetch programs from DB to retrieve team limits, slugs, and deadlines
    const supabase = createAdminClient();
    let dbPrograms: any[] = [];
    if (supabase) {
      const { data: progs } = await supabase
        .from('event_programs')
        .select('id, name, slug, min_team_size, max_team_size, is_active, registration_open_at, registration_close_at')
        .eq('event_id', event.id)
        .eq('college_id', session.collegeId);
      dbPrograms = progs || [];
    }

    // Deduplicate by programId and teamId so each registration appears once
    const seenPrograms = new Set<string>();
    const uniquePrograms: typeof myProgramRows = [];
    for (const r of myProgramRows) {
      const key = `${r.programId}_${r.teamId || ''}`;
      if (!seenPrograms.has(key)) {
        seenPrograms.add(key);
        uniquePrograms.push(r);
      }
    }

    const enrichedPrograms: StudentProgramRegistrationItem[] = uniquePrograms.map(p => {
      const dbProg = dbPrograms.find(dp => dp.id === p.programId || dp.slug === p.programName);
      const openCheck = dbProg
        ? checkIsRegistrationOpen(event, dbProg)
        : { isOpen: false, reason: 'Program configuration is unavailable. Team management is locked.' };

      // If team program, get all members of this team
      let teamMembers: TeamMemberDetails[] = [];
      if (p.teamId) {
        teamMembers = allRows
          .filter(
            r => r.eventId === event.id && r.programId === p.programId && r.teamId.toUpperCase() === p.teamId.toUpperCase() && r.registrationStatus !== 'CANCELLED'
          )
          .map(m => ({
            registrationNumber: m.registrationNumber,
            fullName: m.participantName,
            studentId: m.studentId,
            email: m.email,
            mobile: m.mobile,
            branch: m.branch,
            semester: m.semester,
            gender: m.gender,
            participantRole: m.participantRole,
            registeredAt: m.registeredAt,
          }));

        // Sort so TEAM LEADER appears first
        teamMembers.sort((a, b) => {
          if (a.participantRole === 'TEAM LEADER') return -1;
          if (b.participantRole === 'TEAM LEADER') return 1;
          return a.fullName.localeCompare(b.fullName);
        });
      }

      return {
        registrationNumber: p.registrationNumber,
        programId: p.programId,
        programSlug: dbProg?.slug || '',
        programName: p.programName || dbProg?.name || '',
        participationType: p.participationType,
        teamId: p.teamId,
        teamName: p.teamName,
        participantRole: p.participantRole,
        paymentAmount: p.paymentAmount,
        paymentStatus: p.paymentStatus,
        paymentReference: p.paymentReference,
        registrationStatus: p.registrationStatus,
        registeredAt: p.registeredAt,
        minTeamSize: dbProg?.min_team_size || 1,
        maxTeamSize: dbProg?.max_team_size || 20,
        isRegistrationOpen: openCheck.isOpen,
        registrationClosedReason: openCheck.reason,
        teamMembers,
      };
    });

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
      programs: enrichedPrograms,
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to fetch registrations.' };
  }
}

// ============================================================
// 9B. TEAM LEADER: MANAGE TEAM MEMBERS (While Registration Is Open)
// ============================================================

export async function updateTeamNameAction(
  eventId: string,
  programId: string,
  teamId: string,
  newTeamName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Unauthorized. Please login.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (event.college_id !== session.collegeId) return { success: false, error: 'UNAUTHORIZED' };
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable.' };
    }

    const program = await getProgramWithEvent(programId, session.collegeId);
    if (program.event_id !== event.id) return { success: false, error: 'PROGRAM_NOT_FOUND' };

    // Check if registration is open
    const openCheck = checkIsRegistrationOpen(event, program);
    if (!openCheck.isOpen) {
      return { success: false, error: openCheck.reason || 'Registration is closed. Team details can no longer be edited.' };
    }

    const cleanName = newTeamName.trim();
    if (!cleanName) {
      return { success: false, error: 'Team name cannot be empty.' };
    }

    // Check caller is Team Leader
    const allRows = await getEventRegistrations(session.collegeId, event.registration_sheet_id);
    const teamRows = allRows.filter(
      r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED'
    );
    const leaderRow = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leaderRow) {
      return { success: false, error: 'Team leader record not found.' };
    }

    const isLeader =
      session.registrationNumber.toUpperCase() === leaderRow.registrationNumber.toUpperCase() ||
      session.registrationNumber.toUpperCase() === leaderRow.teamLeaderRegistrationNumber.toUpperCase() ||
      session.studentId.toUpperCase() === leaderRow.studentId.toUpperCase() ||
      session.email.toLowerCase() === leaderRow.email.toLowerCase();

    if (!isLeader) {
      return { success: false, error: 'Only the Team Leader has permission to edit team details.' };
    }

    const updated = await updateTeamNameInSheets(
      session.collegeId,
      event.registration_sheet_id,
      program.slug,
      teamId,
      cleanName
    );

    if (!updated) {
      return { success: false, error: 'Could not update team name in sheets.' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to update team name.' };
  }
}

export async function updateTeamMemberAction(
  eventId: string,
  programId: string,
  teamId: string,
  registrationNumber: string,
  memberData: {
    fullName: string;
    studentId: string;
    email: string;
    mobile: string;
    branch?: string;
    semester?: string;
    gender?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Unauthorized. Please login.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (event.college_id !== session.collegeId) return { success: false, error: 'UNAUTHORIZED' };
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable.' };
    }

    const program = await getProgramWithEvent(programId, session.collegeId);
    if (program.event_id !== event.id) return { success: false, error: 'PROGRAM_NOT_FOUND' };

    // Check if registration is open
    const openCheck = checkIsRegistrationOpen(event, program);
    if (!openCheck.isOpen) {
      return { success: false, error: openCheck.reason || 'Registration is closed. Team members can no longer be edited.' };
    }

    // Validate inputs
    if (!memberData.fullName?.trim()) {
      return { success: false, error: 'Full name is required.' };
    }
    if (!memberData.studentId?.trim()) {
      return { success: false, error: 'Student ID / Roll Number is required.' };
    }
    if (!memberData.email?.trim() || !memberData.email.includes('@')) {
      return { success: false, error: 'Valid email address is required.' };
    }

    // Check caller is Team Leader
    const allRows = await getEventRegistrations(session.collegeId, event.registration_sheet_id);
    const teamRows = allRows.filter(
      r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED'
    );
    const leaderRow = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leaderRow) {
      return { success: false, error: 'Team leader not found.' };
    }

    const isLeader =
      session.registrationNumber.toUpperCase() === leaderRow.registrationNumber.toUpperCase() ||
      session.registrationNumber.toUpperCase() === leaderRow.teamLeaderRegistrationNumber.toUpperCase() ||
      session.studentId.toUpperCase() === leaderRow.studentId.toUpperCase() ||
      session.email.toLowerCase() === leaderRow.email.toLowerCase();

    if (!isLeader) {
      return { success: false, error: 'Only the Team Leader has permission to edit team details.' };
    }

    // Verify member belongs to this team
    const targetMember = teamRows.find(
      r => r.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase()
    );
    if (!targetMember) {
      return { success: false, error: 'Member not found in this team.' };
    }

    // Check duplicates within the team (excluding the member being edited)
    const cleanStudentId = memberData.studentId.trim().toUpperCase();
    const cleanEmail = memberData.email.trim().toLowerCase();
    const otherMembers = teamRows.filter(
      r => r.registrationNumber.toUpperCase() !== registrationNumber.trim().toUpperCase()
    );

    if (otherMembers.some(m => m.studentId.toUpperCase() === cleanStudentId)) {
      return { success: false, error: `Student ID "${cleanStudentId}" is already used by another team member.` };
    }
    if (otherMembers.some(m => m.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Email "${cleanEmail}" is already used by another team member.` };
    }

    // Resolve academic values
    const academic = await resolveAcademicDisplayValues(
      session.collegeId,
      memberData.branch,
      memberData.semester
    );

    const updated = await updateTeamMemberDetailsInSheet(
      session.collegeId,
      event.registration_sheet_id,
      program.slug,
      registrationNumber,
      {
        fullName: memberData.fullName.trim(),
        studentId: cleanStudentId,
        email: cleanEmail,
        mobile: memberData.mobile?.trim() || '',
        branch: academic.branch,
        semester: academic.semester,
        gender: memberData.gender?.trim() || '',
      }
    );

    if (!updated) {
      return { success: false, error: 'Could not update member in sheets.' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to update team member.' };
  }
}

export async function removeTeamMemberAction(
  eventId: string,
  programId: string,
  teamId: string,
  registrationNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Unauthorized. Please login.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (event.college_id !== session.collegeId) return { success: false, error: 'UNAUTHORIZED' };
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable.' };
    }

    const program = await getProgramWithEvent(programId, session.collegeId);
    if (program.event_id !== event.id) return { success: false, error: 'PROGRAM_NOT_FOUND' };

    // Check if registration is open
    const openCheck = checkIsRegistrationOpen(event, program);
    if (!openCheck.isOpen) {
      return { success: false, error: openCheck.reason || 'Registration is closed. Team members can no longer be edited.' };
    }

    // Check caller is Team Leader
    const allRows = await getEventRegistrations(session.collegeId, event.registration_sheet_id);
    const teamRows = allRows.filter(
      r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED'
    );
    const leaderRow = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leaderRow) {
      return { success: false, error: 'Team leader not found.' };
    }

    const isLeader =
      session.registrationNumber.toUpperCase() === leaderRow.registrationNumber.toUpperCase() ||
      session.registrationNumber.toUpperCase() === leaderRow.teamLeaderRegistrationNumber.toUpperCase() ||
      session.studentId.toUpperCase() === leaderRow.studentId.toUpperCase() ||
      session.email.toLowerCase() === leaderRow.email.toLowerCase();

    if (!isLeader) {
      return { success: false, error: 'Only the Team Leader has permission to remove team members.' };
    }

    // Verify member belongs to this team
    const targetMember = teamRows.find(
      r => r.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase()
    );
    if (!targetMember) {
      return { success: false, error: 'Member not found in this team.' };
    }

    // Team Leader cannot be removed
    if (targetMember.participantRole === 'TEAM LEADER') {
      return { success: false, error: 'The Team Leader cannot be removed from the team.' };
    }

    // Validate min team size: (total remaining members) >= min_team_size
    const remainingCount = teamRows.length - 1;
    if (program.min_team_size != null && remainingCount < program.min_team_size) {
      return {
        success: false,
        error: `Cannot remove member. This program requires at least ${program.min_team_size} members (including leader).`,
      };
    }

    const removed = await removeTeamMemberFromSheet(
      session.collegeId,
      event.registration_sheet_id,
      program.slug,
      registrationNumber
    );

    if (!removed) {
      return { success: false, error: 'Could not remove member from sheets.' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to remove team member.' };
  }
}

export async function addMemberToExistingTeamAction(
  _eventId: string,
  _programId: string,
  _teamId: string,
  _memberData: {
    fullName: string;
    studentId: string;
    email: string;
    mobile: string;
    branch?: string;
    semester?: string;
    gender?: string;
    eventRegNumber?: string;
  }
): Promise<{ success: boolean; error?: string; registrationNumber?: string }> {
  // Team leaders may no longer finalize another student's membership from the browser.
  return { success: false, error: 'Team members must join through a secure invitation.' };
  /*
  // Legacy direct-write implementation is retained below for migration history only.
  try {
    const sessionResult = await verifyEventSession(eventId);
    if (!sessionResult.isValid || !sessionResult.session) {
      return { success: false, error: 'Unauthorized. Please login.' };
    }
    const session = sessionResult.session;

    const event = await getEventWithCollege(eventId);
    if (!event.registration_sheet_id) {
      return { success: false, error: 'Event registration data is temporarily unavailable.' };
    }

    const program = await getProgramWithEvent(programId, session.collegeId);

    // Check if registration is open
    const openCheck = checkIsRegistrationOpen(event, program);
    if (!openCheck.isOpen) {
      return { success: false, error: openCheck.reason || 'Registration is closed. Team members can no longer be edited.' };
    }

    // Validate input fields
    if (!memberData.fullName?.trim()) {
      return { success: false, error: 'Full name is required.' };
    }
    if (!memberData.studentId?.trim()) {
      return { success: false, error: 'Student ID / Roll Number is required.' };
    }
    if (!memberData.email?.trim() || !memberData.email.includes('@')) {
      return { success: false, error: 'Valid email address is required.' };
    }

    // Check caller is Team Leader
    const allRows = await getEventRegistrations(session.collegeId, event.registration_sheet_id);
    const teamRows = allRows.filter(
      r => r.eventId === event.id && r.programId === program.id && r.teamId.toUpperCase() === teamId.trim().toUpperCase() && r.registrationStatus !== 'CANCELLED'
    );
    const leaderRow = teamRows.find(r => r.participantRole === 'TEAM LEADER');
    if (!leaderRow) {
      return { success: false, error: 'Team leader not found.' };
    }

    const isLeader =
      session.registrationNumber.toUpperCase() === leaderRow.registrationNumber.toUpperCase() ||
      session.registrationNumber.toUpperCase() === leaderRow.teamLeaderRegistrationNumber.toUpperCase() ||
      session.studentId.toUpperCase() === leaderRow.studentId.toUpperCase() ||
      session.email.toLowerCase() === leaderRow.email.toLowerCase();

    if (!isLeader) {
      return { success: false, error: 'Only the Team Leader has permission to add team members.' };
    }

    // Validate max team size: (current + 1) <= max_team_size
    const newTotal = teamRows.length + 1;
    if (program.max_team_size != null && newTotal > program.max_team_size) {
      return {
        success: false,
        error: `Team can have at most ${program.max_team_size} members (including leader).`,
      };
    }

    const cleanStudentId = memberData.studentId.trim().toUpperCase();
    const cleanEmail = memberData.email.trim().toLowerCase();
    const cleanEventRegNum = memberData.eventRegNumber?.trim().toUpperCase();

    // Check duplicate within the current team
    if (teamRows.some(m => m.studentId.toUpperCase() === cleanStudentId)) {
      return { success: false, error: `Student ID "${cleanStudentId}" is already in this team.` };
    }
    if (teamRows.some(m => m.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Email "${cleanEmail}" is already in this team.` };
    }
    if (cleanEventRegNum && teamRows.some(m => m.registrationNumber.toUpperCase() === cleanEventRegNum)) {
      return { success: false, error: `Registration number "${cleanEventRegNum}" is already in this team.` };
    }

    // Check duplicate across the entire program (another team or individual)
    const existingProgReg = await findExistingProgramRegistration(
      session.collegeId,
      event.registration_sheet_id,
      event.id,
      program.id,
      {
        eventRegNumber: cleanEventRegNum,
        studentId: cleanStudentId,
        email: cleanEmail,
      }
    );
    if (existingProgReg) {
      return {
        success: false,
        error: `Student is already registered for this program (${existingProgReg.teamName ? `in team "${existingProgReg.teamName}"` : 'as Individual'}).`,
      };
    }

    // Resolve academic values
    const academic = await resolveAcademicDisplayValues(
      session.collegeId,
      memberData.branch,
      memberData.semester
    );

    const paymentRequired = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;
    const paymentStatus = paymentRequired ? (leaderRow.paymentStatus || 'PENDING') : 'NOT_REQUIRED';

    const addRes = await addTeamMember(session.collegeId, event.registration_sheet_id, program.slug, {
      eventId: event.id,
      eventSlug: event.slug,
      programId: program.id,
      programName: program.name,
      teamId: leaderRow.teamId,
      teamName: leaderRow.teamName,
      member: {
        fullName: memberData.fullName.trim(),
        studentId: cleanStudentId,
        email: cleanEmail,
        mobile: memberData.mobile?.trim() || '',
        branch: academic.branch,
        semester: academic.semester,
        gender: memberData.gender?.trim() || '',
        role: 'TEAM MEMBER',
        eventRegNumber: cleanEventRegNum,
      },
      paymentRequired,
      paymentAmount: 0, // fee charged once per team to leader
      paymentStatus,
      paymentReference: leaderRow.paymentReference || '',
      leaderEventRegNumber: leaderRow.teamLeaderRegistrationNumber || leaderRow.registrationNumber,
    });

    return {
      success: true,
      registrationNumber: addRes.programRegNumber,
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to add team member.' };
  }
  */
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
      return { success: true, participants: [] /* no sheet resolved */ };
    }

    const rows = await getEventRegistrations(collegeId, event.registration_sheet_id);
    const academicMap = await batchResolveAcademicDisplayValues(collegeId, rows);

    // Only return safe fields — NEVER return email, mobile, payment details or raw UUIDs!
    const safe = rows
      .filter(r => r.registrationStatus !== 'CANCELLED')
      .map(r => {
        const key = `${r.branch || ''}__${r.semester || ''}`;
        const academic = academicMap.get(key) || { branch: r.branch, semester: r.semester };
        return {
          registrationNumber: r.registrationNumber,
          participantName: r.participantName,
          branch: academic.branch,
          semester: academic.semester,
          programName: r.programName || 'General Event Registration',
          teamName: r.teamName,
          participationType: r.participationType,
        };
      });

    return { success: true, participants: safe };
  } catch {
    return { success: true, participants: [] };
  }
}

/**
  * Safely fetches active academic master records (branches and semesters)
  * for an event's college.
  */
export async function getEventAcademicMastersAction(collegeId: string): Promise<{
  branches: Branch[];
  semesters: Semester[];
}> {
  try {
    if (!collegeId) return { branches: [], semesters: [] };
    const { getCachedAcademicMasters } = await import('@/lib/supabase/academic-cache');
    const masters = await getCachedAcademicMasters(collegeId);
    return {
      branches: masters.branches || [],
      semesters: masters.semesters || [],
    };
  } catch (err) {
    console.error('Failed to get academic masters for event:', err);
    return { branches: [], semesters: [] };
  }
}

/**
 * Safely fetches active academic master records (branches and semesters)
 * given an event ID.
 */
export async function getEventAcademicMastersByEventIdAction(eventId: string): Promise<{
  branches: Branch[];
  semesters: Semester[];
}> {
  try {
    if (!eventId) return { branches: [], semesters: [] };
    const event = await getEventWithCollege(eventId);
    return await getEventAcademicMastersAction(event.college_id);
  } catch (err) {
    console.error('Failed to get academic masters by eventId:', err);
    return { branches: [], semesters: [] };
  }
}

/**
 * Updates a student's personal registration / pass details (Name, Roll, Branch, Semester, Mobile)
 * in Google Sheets and updates the active event session.
 */
export async function updateStudentEventRegistrationAction(input: {
  eventId: string;
  registrationNumber: string;
  fullName: string;
  studentId: string;
  email?: string;
  mobile?: string;
  branch?: string;
  semester?: string;
  gender?: string;
}): Promise<{
  success: boolean;
  error?: string;
  participant?: {
    fullName: string;
    registrationNumber: string;
    email: string;
    studentId: string;
    mobile: string;
    branch: string;
    semester: string;
    gender: string;
  };
}> {
  try {
    const cleanReg = input.registrationNumber?.trim().toUpperCase();
    if (!cleanReg) {
      return { success: false, error: 'Registration number is required.' };
    }
    const cleanName = input.fullName?.trim();
    if (!cleanName) {
      return { success: false, error: 'Full name is required.' };
    }
    const cleanStudentId = input.studentId?.trim().toUpperCase();
    if (!cleanStudentId) {
      return { success: false, error: 'Roll number / Student ID is required.' };
    }

    const event = await getEventWithCollege(input.eventId);
    const googleConnected = await isCollegeGoogleConfigured(event.college_id);
    if (!googleConnected) {
      return {
        success: false,
        error: 'College registration service is not connected to Google Drive.',
      };
    }

    if (!event.registration_sheet_id) {
      return {
        success: false,
        error: 'No registration sheet found for this event.',
      };
    }

    // Resolve branch and semester to clean display values
    let finalBranch = input.branch?.trim() || '';
    let finalSemester = input.semester?.trim() || '';
    try {
      const academic = await resolveAcademicDisplayValues(event.college_id, finalBranch, finalSemester);
      finalBranch = academic.branch;
      finalSemester = academic.semester;
    } catch {
      // non-fatal fallback
    }

    // Update in Google Sheet
    const ok = await updateStudentEventRegistrationInSheet(
      event.college_id,
      event.registration_sheet_id,
      cleanReg,
      {
        fullName: cleanName,
        studentId: cleanStudentId,
        mobile: input.mobile?.trim(),
        branch: finalBranch,
        semester: finalSemester,
        gender: input.gender?.trim(),
      }
    );

    if (!ok) {
      return { success: false, error: `Could not find registration ${cleanReg} to update.` };
    }

    // Update session cookie if active
    const sessionResult = await verifyEventSession(event.id);
    const currentSession = sessionResult.session;
    let email = input.email?.trim() || currentSession?.email || '';
    if (!email) {
      const reg = await lookupEventRegistrationByNumber(
        event.college_id,
        event.id,
        cleanReg,
        event.registration_sheet_id
      );
      if (reg?.email) {
        email = reg.email;
      }
    }

    if (sessionResult.isValid || email) {
      await createEventSession({
        registrationNumber: cleanReg,
        email: email,
        fullName: cleanName,
        studentId: cleanStudentId,
        eventId: event.id,
        collegeId: event.college_id,
        mobile: input.mobile?.trim() || currentSession?.mobile || '',
        branch: finalBranch,
        semester: finalSemester,
        gender: input.gender?.trim() || currentSession?.gender || '',
      });
    }

    revalidatePath(`/events/${event.slug}`);
    revalidatePath(`/events/${event.slug}/my-registrations`);
    revalidatePath(`/admin/events/${event.id}`);

    return {
      success: true,
      participant: {
        fullName: cleanName,
        registrationNumber: cleanReg,
        email: email,
        studentId: cleanStudentId,
        mobile: input.mobile?.trim() || currentSession?.mobile || '',
        branch: finalBranch,
        semester: finalSemester,
        gender: input.gender?.trim() || currentSession?.gender || '',
      },
    };
  } catch (err: unknown) {
    console.error('[UPDATE_EVENT_REGISTRATION_ERROR]', err);
    return {
      success: false,
      error: (err as Error).message || 'Failed to update pass details. Please try again.',
    };
  }
}

/**
 * Server action to fetch more published events for the current college.
 * Used by custom completion experience.
 */
export async function getMorePublishedEventsForCollegeAction(
  collegeId: string,
  excludeEventId?: string,
  limit: number = 4
) {
  try {
    return await getMorePublishedEventsForCollege(collegeId, excludeEventId, limit);
  } catch (err) {
    console.error('[GET_MORE_PUBLISHED_EVENTS_ACTION_ERROR]', err);
    return [];
  }
}


