import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  ProgramRegistration,
  ProgramRegistrationMember,
  ProgramRegistrationInput,
  ProgramPaymentStatus,
  ProgramRegistrationStatus,
  PublicParticipant,
  PublicTeamParticipant,
} from '@/types/programs';

async function getDb() {
  return createAdminClient() || await createClient();
}

// ============================================================
// REGISTRATION NUMBER GENERATION
// ============================================================

export function generateRegistrationNumber(
  eventSlug: string,
  programSlug: string,
  sequence: number
): string {
  const eventPrefix = eventSlug
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, 6);
  const programPrefix = programSlug
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, 4);
  const seq = String(sequence).padStart(4, '0');
  return `${eventPrefix}-${programPrefix}-${seq}`;
}

// ============================================================
// ADMIN: FETCH REGISTRATIONS
// ============================================================

/**
 * Fetch registrations for a specific program (admin, tenant-scoped)
 */
export async function getAdminProgramRegistrations(params: {
  programId: string;
  collegeId: string;
  search?: string;
  paymentStatus?: ProgramPaymentStatus | 'ALL';
  registrationStatus?: ProgramRegistrationStatus | 'ALL';
  registrationType?: 'INDIVIDUAL' | 'TEAM' | 'ALL';
}): Promise<ProgramRegistration[]> {
  const db = await getDb();

  // Check if event has registration_sheet_id (Google Sheets is source of truth)
  // Schema-safe: handle missing registration_sheet_id column (42703)
  let program: { id: string; name: string; slug: string; event_id: string; event?: unknown } | null = null;
  let sheetId: string | null = null;

  const { data: progWithSheet, error: progErr } = await db
    .from('event_programs')
    .select('id, name, slug, event_id, event:events(id, registration_sheet_id)')
    .eq('id', params.programId)
    .eq('college_id', params.collegeId)
    .maybeSingle();

  if (progErr && progErr.code === '42703') {
    const { data: progFallback } = await db
      .from('event_programs')
      .select('id, name, slug, event_id')
      .eq('id', params.programId)
      .eq('college_id', params.collegeId)
      .maybeSingle();
    if (progFallback) {
      program = progFallback;
      try {
        const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
        sheetId = await resolveEventRegistrationSpreadsheet(params.collegeId, progFallback.event_id);
      } catch { /* non-fatal */ }
    }
  } else if (progWithSheet) {
    program = progWithSheet;
    const eventRef = progWithSheet.event as unknown as { id: string; registration_sheet_id: string | null } | null;
    sheetId = eventRef?.registration_sheet_id || null;
    if (!sheetId && eventRef?.id) {
      try {
        const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
        sheetId = await resolveEventRegistrationSpreadsheet(params.collegeId, eventRef.id);
      } catch { /* non-fatal */ }
    }
  }

  const eventRef = program?.event ? (program.event as unknown as { id: string }) : (program ? { id: program.event_id } : null);
  if (sheetId && program?.slug) {
    try {
      const { getProgramRegistrations } = await import('@/lib/google/event-registration-sheets');
      const sheetRows = await getProgramRegistrations(
        params.collegeId,
        sheetId,
        program.slug
      );

      let registrations: ProgramRegistration[] = sheetRows.map((r, idx) => ({
        id: r.registrationNumber || `reg-${idx}`,
        event_id: eventRef?.id || '',
        program_id: params.programId,
        category_id: '',
        college_id: params.collegeId,
        registration_number: r.registrationNumber,
        registration_type: (r.participationType === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'),
        participant_name: r.studentName,
        student_id: r.studentId,
        email: r.email,
        mobile: r.mobile,
        branch: r.branch,
        semester: r.semester,
        gender: null,
        team_name: r.teamName || null,
        payment_status: (r.paymentStatus === 'PAID' ? 'VERIFIED' : r.paymentStatus as any) || 'NOT_REQUIRED',
        payment_reference: null,
        payment_method: null,
        payment_amount: r.paymentAmount,
        payment_screenshot_url: null,
        paid_at: null,
        verified_at: null,
        verified_by: null,
        registration_status: 'REGISTERED',
        registered_at: r.registeredAt,
        updated_at: r.registeredAt,
      }));

      // Search filter
      if (params.search?.trim()) {
        const s = params.search.trim().toLowerCase();
        registrations = registrations.filter(
          (r) =>
            r.participant_name?.toLowerCase().includes(s) ||
            r.registration_number?.toLowerCase().includes(s) ||
            r.email?.toLowerCase().includes(s) ||
            r.mobile?.includes(s) ||
            r.student_id?.toLowerCase().includes(s) ||
            r.team_name?.toLowerCase().includes(s)
        );
      }

      if (params.paymentStatus && params.paymentStatus !== 'ALL') {
        registrations = registrations.filter((r) => r.payment_status === params.paymentStatus);
      }
      if (params.registrationStatus && params.registrationStatus !== 'ALL') {
        registrations = registrations.filter((r) => r.registration_status === params.registrationStatus);
      }
      if (params.registrationType && params.registrationType !== 'ALL') {
        registrations = registrations.filter((r) => r.registration_type === params.registrationType);
      }

      return registrations;
    } catch (sheetErr) {
      console.warn('[GET_ADMIN_PROG_REGS_SHEET_ERROR]', sheetErr);
    }
  }

  let query = db
    .from('program_registrations')
    .select('*')
    .eq('program_id', params.programId)
    .eq('college_id', params.collegeId)
    .order('registered_at', { ascending: false });

  if (params.paymentStatus && params.paymentStatus !== 'ALL') {
    query = query.eq('payment_status', params.paymentStatus);
  }
  if (params.registrationStatus && params.registrationStatus !== 'ALL') {
    query = query.eq('registration_status', params.registrationStatus);
  }
  if (params.registrationType && params.registrationType !== 'ALL') {
    query = query.eq('registration_type', params.registrationType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET_ADMIN_PROGRAM_REGISTRATIONS_ERROR]', error.message);
    return [];
  }

  let registrations: ProgramRegistration[] = data || [];

  // Search filter (in-memory)
  if (params.search?.trim()) {
    const s = params.search.trim().toLowerCase();
    registrations = registrations.filter(
      (r) =>
        r.participant_name?.toLowerCase().includes(s) ||
        r.registration_number?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.mobile?.includes(s) ||
        r.student_id?.toLowerCase().includes(s) ||
        r.team_name?.toLowerCase().includes(s) ||
        r.payment_reference?.toLowerCase().includes(s)
    );
  }

  // Fetch team members for TEAM registrations
  const teamRegIds = registrations
    .filter((r) => r.registration_type === 'TEAM')
    .map((r) => r.id);

  if (teamRegIds.length > 0) {
    const { data: members } = await db
      .from('program_registration_members')
      .select('*')
      .in('registration_id', teamRegIds)
      .order('display_order', { ascending: true });

    const memberMap: Record<string, ProgramRegistrationMember[]> = {};
    for (const m of members || []) {
      if (!memberMap[m.registration_id]) memberMap[m.registration_id] = [];
      memberMap[m.registration_id].push(m);
    }

    registrations = registrations.map((r) => ({
      ...r,
      members: memberMap[r.id] || [],
    }));
  }

  return registrations;
}

/**
 * Fetch all registrations for an event across all programs (admin)
 */
export async function getAdminEventProgramRegistrations(
  eventId: string,
  collegeId: string
): Promise<ProgramRegistration[]> {
  const db = await getDb();

  // Check if event has registration_sheet_id
  // Schema-safe: handle missing column (42703)
  let eventSheetId: string | null = null;
  const { data: event, error: evtErr } = await db
    .from('events')
    .select('id, registration_sheet_id')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (evtErr && evtErr.code === '42703') {
    try {
      const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
      eventSheetId = await resolveEventRegistrationSpreadsheet(collegeId, eventId);
    } catch { /* non-fatal */ }
  } else {
    eventSheetId = event?.registration_sheet_id || null;
    if (!eventSheetId) {
      try {
        const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
        eventSheetId = await resolveEventRegistrationSpreadsheet(collegeId, eventId);
      } catch { /* non-fatal */ }
    }
  }

  if (eventSheetId) {
    try {
      const { getEventRegistrations } = await import('@/lib/google/event-registration-sheets');
      const sheetRows = await getEventRegistrations(collegeId, eventSheetId);

      const progRows = sheetRows.filter(r => r.programId !== '' && r.registrationStatus !== 'CANCELLED');
      return progRows.map((r, idx) => ({
        id: r.registrationNumber || `reg-${idx}`,
        event_id: eventId,
        program_id: r.programId,
        category_id: '',
        college_id: collegeId,
        registration_number: r.registrationNumber,
        registration_type: (r.participationType === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'),
        participant_name: r.participantName,
        student_id: r.studentId,
        email: r.email,
        mobile: r.mobile,
        branch: r.branch,
        semester: r.semester,
        gender: null,
        team_name: r.teamName || null,
        payment_status: (r.paymentStatus === 'PAID' ? 'VERIFIED' : r.paymentStatus as any) || 'NOT_REQUIRED',
        payment_reference: r.paymentReference,
        payment_method: null,
        payment_amount: r.paymentAmount,
        payment_screenshot_url: null,
        paid_at: null,
        verified_at: null,
        verified_by: null,
        registration_status: 'REGISTERED',
        registered_at: r.registeredAt,
        updated_at: r.registeredAt,
      }));
    } catch (sheetErr) {
      console.warn('[GET_ADMIN_EVENT_PROG_REGS_SHEET_ERROR]', sheetErr);
    }
  }

  const { data, error } = await db
    .from('program_registrations')
    .select('*, program:event_programs(id, name, slug, participation_type, registration_fee), category:event_categories(id, name)')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('[GET_ADMIN_EVENT_PROG_REGS_ERROR]', error.message);
    return [];
  }

  // Fetch members for team registrations
  const teamRegIds = (data || [])
    .filter((r: ProgramRegistration) => r.registration_type === 'TEAM')
    .map((r: ProgramRegistration) => r.id);

  const memberMap: Record<string, ProgramRegistrationMember[]> = {};
  if (teamRegIds.length > 0) {
    const { data: members } = await db
      .from('program_registration_members')
      .select('*')
      .in('registration_id', teamRegIds)
      .order('display_order', { ascending: true });

    for (const m of members || []) {
      if (!memberMap[m.registration_id]) memberMap[m.registration_id] = [];
      memberMap[m.registration_id].push(m);
    }
  }

  return (data || []).map((r: ProgramRegistration) => ({
    ...r,
    members: memberMap[r.id] || [],
  }));
}

// ============================================================
// PUBLIC: REGISTER FOR PROGRAM
// ============================================================

/**
 * Register a student/team for a program with full server-side validation
 */
export async function registerForProgram(
  input: ProgramRegistrationInput
): Promise<{ success: boolean; error?: string; registration_id?: string; registration_number?: string; payment_status?: string }> {
  const db = await getDb();

  // 1. Validate event
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('*')
    .eq('id', input.event_id)
    .eq('college_id', input.college_id)
    .maybeSingle();

  if (eventErr || !event) {
    return { success: false, error: 'Event not found.' };
  }

  if (event.status !== 'PUBLISHED') {
    return { success: false, error: 'Event is not currently accepting registrations.' };
  }

  // 2. Validate program
  const { data: program, error: progErr } = await db
    .from('event_programs')
    .select('*')
    .eq('id', input.program_id)
    .eq('event_id', input.event_id)
    .eq('college_id', input.college_id)
    .maybeSingle();

  if (progErr || !program) {
    return { success: false, error: 'Program not found.' };
  }

  if (!program.is_active) {
    return { success: false, error: 'This program is not currently active.' };
  }

  // 3. Validate registration window
  const now = new Date();
  if (program.registration_open_at && now < new Date(program.registration_open_at)) {
    return { success: false, error: 'Registration for this program has not opened yet.' };
  }
  if (program.registration_close_at && now > new Date(program.registration_close_at)) {
    return { success: false, error: 'Registration deadline for this program has passed.' };
  }

  // 4. Validate participation type
  const regType = input.registration_type;
  if (program.participation_type === 'INDIVIDUAL' && regType !== 'INDIVIDUAL') {
    return { success: false, error: 'This program only accepts individual registrations.' };
  }
  if (program.participation_type === 'TEAM' && regType !== 'TEAM') {
    return { success: false, error: 'This program only accepts team registrations.' };
  }

  // 5. Validate team members
  if (regType === 'TEAM') {
    if (!input.team_name?.trim()) {
      return { success: false, error: 'Team name is required for team registration.' };
    }
    const members = input.members || [];
    if (program.min_team_size != null && members.length < program.min_team_size) {
      return { success: false, error: `Team must have at least ${program.min_team_size} members.` };
    }
    if (program.max_team_size != null && members.length > program.max_team_size) {
      return { success: false, error: `Team can have at most ${program.max_team_size} members.` };
    }
  }

  // 6. Clean inputs
  const cleanStudentId = input.student_id?.trim().toUpperCase() || '';
  const cleanName = input.participant_name.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanMobile = input.mobile?.trim() || '';

  if (!cleanName || !cleanEmail) {
    return { success: false, error: 'Name and email are required.' };
  }

  // 7. GOOGLE SHEETS IS THE ONLY SOURCE OF TRUTH FOR REGISTRATION DATA
  const { isCollegeGoogleConfigured } = await import('@/lib/google/auth');
  const googleConnected = await isCollegeGoogleConfigured(input.college_id);
  if (!googleConnected) {
    return {
      success: false,
      error: 'Registration is temporarily unavailable because the college registration service is not connected.',
    };
  }

  try {
    const {
      getOrCreateEventRegistrationSpreadsheet,
      appendProgramRegistration,
      findRegistrationByStudentId,
      findRegistrationByNumber,
      createTeam,
      addTeamMember,
      checkDuplicateProgramRegistration,
    } = await import('@/lib/google/event-registration-sheets');

    const spreadsheetId = await getOrCreateEventRegistrationSpreadsheet(
      input.college_id,
      event.id,
      event.title
    );

    // Verify student is event-registered first (Mandatory requirement Section 7, 9)
    let eventReg = (input as any).event_registration_number || (input as any).registration_number
      ? await findRegistrationByNumber(input.college_id, spreadsheetId, (input as any).event_registration_number || (input as any).registration_number)
      : null;

    if (!eventReg && cleanStudentId) {
      eventReg = await findRegistrationByStudentId(input.college_id, spreadsheetId, cleanStudentId);
    }
    if (!eventReg && cleanEmail) {
      const allMaster = await (await import('@/lib/google/event-registration-sheets')).getEventRegistrations(input.college_id, spreadsheetId);
      eventReg = allMaster.find(r => r.programId === '' && r.email.toLowerCase() === cleanEmail) || null;
    }

    if (!eventReg) {
      return {
        success: false,
        error: 'Event registration is mandatory before joining any program. Please register for the event first.',
      };
    }

    // Reuse verified details from existing event registration
    const verifiedName = eventReg.participantName || cleanName;
    const verifiedStudentId = eventReg.studentId || cleanStudentId;
    const verifiedEmail = eventReg.email || cleanEmail;
    const verifiedMobile = eventReg.mobile || cleanMobile;
    const verifiedBranch = eventReg.branch || input.branch?.trim() || '';
    const verifiedSemester = eventReg.semester || input.semester?.trim() || '';
    const verifiedGender = eventReg.gender || input.gender?.trim() || '';

    const paymentRequired = event.payment_required && program.registration_fee > 0;
    const paymentStatus: ProgramPaymentStatus = paymentRequired
      ? (input.payment_reference ? 'SUBMITTED' : 'PENDING')
      : 'NOT_REQUIRED';

    if (regType === 'INDIVIDUAL') {
      const isDuplicate = await checkDuplicateProgramRegistration(
        input.college_id,
        spreadsheetId,
        program.id,
        verifiedStudentId,
        verifiedEmail,
        eventReg.registrationNumber,
        event.id
      );
      if (isDuplicate) {
        return { success: false, error: 'You are already registered for this program.' };
      }

      const result = await appendProgramRegistration(
        input.college_id,
        spreadsheetId,
        program.slug,
        {
          eventId: event.id,
          eventSlug: event.slug,
          programId: program.id,
          programName: program.name,
          participationType: 'INDIVIDUAL',
          participantRole: 'INDIVIDUAL',
          fullName: verifiedName,
          studentId: verifiedStudentId,
          email: verifiedEmail,
          mobile: verifiedMobile,
          branch: verifiedBranch,
          semester: verifiedSemester,
          gender: verifiedGender,
          paymentRequired,
          paymentAmount: program.registration_fee || 0,
          paymentStatus,
          paymentReference: input.payment_reference?.trim() || '',
          leaderEventRegNumber: eventReg.registrationNumber,
        }
      );

      return {
        success: true,
        registration_id: result.registrationNumber,
        registration_number: result.registrationNumber,
        payment_status: paymentStatus,
      };
    } else {
      // TEAM REGISTRATION
      const { teamId } = await createTeam(input.college_id, spreadsheetId, program.slug);

      // Add leader
      const leaderResult = await addTeamMember(input.college_id, spreadsheetId, program.slug, {
        eventId: event.id,
        eventSlug: event.slug,
        programId: program.id,
        programName: program.name,
        teamId,
        teamName: input.team_name?.trim() || 'Team',
        member: {
          fullName: verifiedName,
          studentId: verifiedStudentId,
          email: verifiedEmail,
          mobile: verifiedMobile,
          branch: verifiedBranch,
          semester: verifiedSemester,
          gender: verifiedGender,
          role: 'TEAM LEADER',
          eventRegNumber: eventReg.registrationNumber,
        },
        paymentRequired,
        paymentAmount: program.registration_fee || 0,
        paymentStatus,
        paymentReference: input.payment_reference?.trim() || '',
        leaderEventRegNumber: eventReg.registrationNumber,
      });

      // Add members (each member auto-registers for event if not yet registered)
      if (input.members && input.members.length > 0) {
        for (const m of input.members) {
          if (!m.member_name?.trim()) continue;
          await addTeamMember(input.college_id, spreadsheetId, program.slug, {
            eventId: event.id,
            eventSlug: event.slug,
            programId: program.id,
            programName: program.name,
            teamId,
            teamName: input.team_name?.trim() || 'Team',
            member: {
              fullName: m.member_name.trim(),
              studentId: m.student_id?.trim().toUpperCase() || '',
              email: m.email?.trim().toLowerCase() || '',
              mobile: m.mobile?.trim() || '',
              branch: m.branch?.trim() || '',
              semester: m.semester?.trim() || '',
              gender: m.gender?.trim() || '',
              role: 'TEAM MEMBER',
            },
            paymentRequired,
            paymentAmount: 0,
            paymentStatus,
            leaderEventRegNumber: eventReg.registrationNumber,
          });
        }
      }

      return {
        success: true,
        registration_id: leaderResult.programRegNumber,
        registration_number: leaderResult.programRegNumber,
        payment_status: paymentStatus,
      };
    }
  } catch (sheetErr: any) {
    console.error('[REGISTER_FOR_PROGRAM_SHEET_ERROR]', sheetErr);
    return {
      success: false,
      error: sheetErr.message || 'Registration is temporarily unavailable because the college registration service is not connected.',
    };
  }
}

// ============================================================
// ADMIN: PAYMENT / STATUS MANAGEMENT
// ============================================================

/**
 * Verify a program registration payment
 */
export async function verifyProgramPayment(
  registrationId: string,
  collegeId: string,
  verifiedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const { data: reg } = await db
    .from('program_registrations')
    .select('id, payment_status')
    .eq('id', registrationId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (!reg) return { success: false, error: 'Registration not found.' };

  const { error } = await db
    .from('program_registrations')
    .update({
      payment_status: 'VERIFIED',
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('college_id', collegeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Reject a program registration payment
 */
export async function rejectProgramPayment(
  registrationId: string,
  collegeId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const { error } = await db
    .from('program_registrations')
    .update({
      payment_status: 'REJECTED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('college_id', collegeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Update registration status
 */
export async function updateProgramRegistrationStatus(
  registrationId: string,
  collegeId: string,
  newStatus: ProgramRegistrationStatus
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const { error } = await db
    .from('program_registrations')
    .update({
      registration_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('college_id', collegeId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================
// PUBLIC: PARTICIPANTS LIST
// ============================================================

/**
 * Fetch public-safe participant list for a program (server-side visibility check)
 */
export async function getPublicProgramParticipants(
  programId: string,
  collegeId: string
): Promise<(PublicParticipant | PublicTeamParticipant)[]> {
  const db = await getDb();

  // Check visibility setting & event registration sheet
  // Schema-safe: handle missing registration_sheet_id column (42703)
  let pubProgram: { show_public_participants: boolean; name: string; slug: string; event_id?: string; event?: unknown; category?: unknown } | null = null;
  let pubSheetId: string | null = null;

  const { data: pubProgWithSheet, error: pubProgErr } = await db
    .from('event_programs')
    .select('show_public_participants, name, slug, event:events(id, registration_sheet_id), category:event_categories(name)')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (pubProgErr && pubProgErr.code === '42703') {
    const { data: pubProgFallback } = await db
      .from('event_programs')
      .select('show_public_participants, name, slug, event_id, category:event_categories(name)')
      .eq('id', programId)
      .eq('college_id', collegeId)
      .maybeSingle();
    if (pubProgFallback) {
      pubProgram = pubProgFallback;
      try {
        const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
        pubSheetId = await resolveEventRegistrationSpreadsheet(collegeId, pubProgFallback.event_id || '');
      } catch { /* non-fatal */ }
    }
  } else if (pubProgWithSheet) {
    pubProgram = pubProgWithSheet;
    const evtRef = pubProgWithSheet.event as unknown as { id: string; registration_sheet_id: string | null } | null;
    pubSheetId = evtRef?.registration_sheet_id || null;
    if (!pubSheetId && evtRef?.id) {
      try {
        const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
        pubSheetId = await resolveEventRegistrationSpreadsheet(collegeId, evtRef.id);
      } catch { /* non-fatal */ }
    }
  }

  if (!pubProgram || !pubProgram.show_public_participants) return [];

  const categoryName = (pubProgram.category as unknown as { name: string } | null)?.name || '';

  if (pubSheetId && pubProgram.slug) {
    try {
      const { getProgramRegistrations } = await import('@/lib/google/event-registration-sheets');
      const sheetRows = await getProgramRegistrations(collegeId, pubSheetId, pubProgram.slug);

      // Safe fields only — NEVER return email, mobile, payment info!
      return sheetRows.map((r) => ({
        registration_number: r.registrationNumber,
        participant_name: r.studentName,
        registration_type: (r.participationType === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'),
        team_name: r.teamName || null,
        program_name: pubProgram.name,
        category_name: categoryName,
      }));
    } catch (sheetErr) {
      console.warn('[GET_PUBLIC_PARTICIPANTS_SHEET_ERROR]', sheetErr);
    }
  }

  const { data: regs } = await db
    .from('program_registrations')
    .select('id, registration_number, participant_name, registration_type, team_name, registration_status')
    .eq('program_id', programId)
    .eq('college_id', collegeId)
    .eq('registration_status', 'REGISTERED')
    .order('registered_at', { ascending: true });

  if (!regs || regs.length === 0) return [];

  // Fetch team members
  const teamRegIds = regs.filter((r) => r.registration_type === 'TEAM').map((r) => r.id);
  const memberMap: Record<string, { member_name: string; is_leader: boolean }[]> = {};

  if (teamRegIds.length > 0) {
    const { data: members } = await db
      .from('program_registration_members')
      .select('registration_id, member_name, is_leader')
      .in('registration_id', teamRegIds)
      .order('display_order', { ascending: true });

    for (const m of members || []) {
      if (!memberMap[m.registration_id]) memberMap[m.registration_id] = [];
      memberMap[m.registration_id].push({ member_name: m.member_name, is_leader: m.is_leader });
    }
  }


  return regs.map((r) => {
    const base: PublicParticipant = {
      registration_number: r.registration_number,
      participant_name: r.participant_name,
      registration_type: r.registration_type,
      team_name: r.team_name,
      program_name: pubProgram.name,
      category_name: categoryName,
    };

    if (r.registration_type === 'TEAM') {
      return {
        ...base,
        members: memberMap[r.id] || [],
      } as PublicTeamParticipant;
    }

    return base;
  });
}

/**
 * Fetch public-safe participants for an entire event (grouped by program)
 */
export async function getPublicEventParticipants(
  eventId: string,
  collegeId: string
): Promise<{ programName: string; categoryName: string; participants: (PublicParticipant | PublicTeamParticipant)[] }[]> {
  const db = await getDb();

  // Check event-level visibility
  const { data: event } = await db
    .from('events')
    .select('show_public_participants')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (!event?.show_public_participants) return [];

  // Get programs that allow public participant display
  const { data: programs } = await db
    .from('event_programs')
    .select('id, name, show_public_participants, category:event_categories(name)')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('is_active', true);

  const results: { programName: string; categoryName: string; participants: (PublicParticipant | PublicTeamParticipant)[] }[] = [];

  for (const prog of programs || []) {
    if (!prog.show_public_participants) continue;

    const participants = await getPublicProgramParticipants(prog.id, collegeId);
    if (participants.length > 0) {
      results.push({
        programName: prog.name,
        categoryName: (prog.category as unknown as { name: string } | null)?.name || '',
        participants,
      });
    }
  }

  return results;
}
