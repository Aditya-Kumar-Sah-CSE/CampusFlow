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

function generateRegistrationNumber(
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

  let memberMap: Record<string, ProgramRegistrationMember[]> = {};
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

  // 7. Duplicate registration check (individual)
  if (regType === 'INDIVIDUAL' && cleanStudentId) {
    const { data: existingReg } = await db
      .from('program_registrations')
      .select('id')
      .eq('program_id', input.program_id)
      .eq('registration_type', 'INDIVIDUAL')
      .eq('registration_status', 'REGISTERED')
      .ilike('student_id', cleanStudentId)
      .maybeSingle();

    if (existingReg) {
      return { success: false, error: 'You are already registered for this program.' };
    }
  }

  // 8. Capacity check
  if (regType === 'INDIVIDUAL' && program.max_participants != null) {
    const { count: currentCount } = await db
      .from('program_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', input.program_id)
      .eq('registration_type', 'INDIVIDUAL')
      .eq('registration_status', 'REGISTERED');

    if ((currentCount || 0) >= program.max_participants) {
      return { success: false, error: 'Program capacity has been reached.' };
    }
  }

  if (regType === 'TEAM' && program.max_teams != null) {
    const { count: teamCount } = await db
      .from('program_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', input.program_id)
      .eq('registration_type', 'TEAM')
      .eq('registration_status', 'REGISTERED');

    if ((teamCount || 0) >= program.max_teams) {
      return { success: false, error: 'Maximum number of teams reached.' };
    }
  }

  // 9. Generate registration number
  const { count: seqCount } = await db
    .from('program_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', input.event_id);

  const regNumber = generateRegistrationNumber(
    event.slug,
    program.slug,
    (seqCount || 0) + 1
  );

  // 10. Determine payment status
  const paymentRequired = event.payment_required && program.registration_fee > 0;
  const paymentStatus: ProgramPaymentStatus = paymentRequired
    ? (input.payment_reference ? 'SUBMITTED' : 'PENDING')
    : 'NOT_REQUIRED';

  // 11. Insert registration
  const { data: inserted, error: insertErr } = await db
    .from('program_registrations')
    .insert({
      event_id: input.event_id,
      program_id: input.program_id,
      category_id: program.category_id,
      college_id: input.college_id,
      registration_number: regNumber,
      registration_type: regType,
      participant_name: cleanName,
      student_id: cleanStudentId || null,
      email: cleanEmail,
      mobile: cleanMobile || null,
      branch: input.branch?.trim() || null,
      semester: input.semester?.trim() || null,
      gender: input.gender?.trim() || null,
      team_name: regType === 'TEAM' ? input.team_name?.trim() : null,
      payment_status: paymentStatus,
      payment_reference: input.payment_reference?.trim() || null,
      payment_amount: paymentRequired ? program.registration_fee : null,
      payment_screenshot_url: input.payment_screenshot_url || null,
      registration_status: 'REGISTERED',
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { success: false, error: 'Duplicate registration detected.' };
    }
    console.error('[REGISTER_FOR_PROGRAM_ERROR]', insertErr);
    return { success: false, error: insertErr.message || 'Registration failed.' };
  }

  // 12. Insert team members
  if (regType === 'TEAM' && input.members && input.members.length > 0) {
    const memberRows = input.members.map((m, idx) => ({
      registration_id: inserted.id,
      program_id: input.program_id,
      college_id: input.college_id,
      member_name: m.member_name.trim(),
      student_id: m.student_id?.trim().toUpperCase() || null,
      email: m.email?.trim().toLowerCase() || null,
      mobile: m.mobile?.trim() || null,
      branch: m.branch?.trim() || null,
      semester: m.semester?.trim() || null,
      gender: m.gender?.trim() || null,
      is_leader: idx === 0,
      display_order: idx,
    }));

    const { error: membersErr } = await db
      .from('program_registration_members')
      .insert(memberRows);

    if (membersErr) {
      console.error('[INSERT_TEAM_MEMBERS_ERROR]', membersErr);
      // Don't fail the whole registration, members are supplementary
    }
  }

  return {
    success: true,
    registration_id: inserted.id,
    registration_number: regNumber,
    payment_status: paymentStatus,
  };
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

  // Check visibility setting
  const { data: program } = await db
    .from('event_programs')
    .select('show_public_participants, name, category:event_categories(name)')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (!program || !program.show_public_participants) return [];

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
  let memberMap: Record<string, { member_name: string; is_leader: boolean }[]> = {};

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

  const categoryName = (program.category as unknown as { name: string } | null)?.name || '';

  return regs.map((r) => {
    const base: PublicParticipant = {
      registration_number: r.registration_number,
      participant_name: r.participant_name,
      registration_type: r.registration_type,
      team_name: r.team_name,
      program_name: program.name,
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
