import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CollegeEvent,
  EventRegistration,
  EventStats,
  EventPaymentStatus,
  EventRegistrationStatus,
  PublicEventRegistrationInput,
} from '@/types/events';

async function getDb() {
  return createAdminClient() || await createClient();
}

/**
 * Fetch all events for an institution (Admin scope: includes DRAFT, PUBLISHED, CLOSED, CANCELLED)
 */
export async function getAdminEvents(collegeId: string): Promise<CollegeEvent[]> {
  const db = await getDb();

  const { data: events, error } = await db
    .from('events')
    .select('*')
    .eq('college_id', collegeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET_ADMIN_EVENTS_ERROR]', error);
    return [];
  }

  // Get active registration counts per event
  const { data: regCounts, error: regError } = await db
    .from('event_registrations')
    .select('event_id, registration_status')
    .eq('college_id', collegeId);

  const countMap: Record<string, { total: number; active: number }> = {};
  if (!regError && regCounts) {
    for (const r of regCounts) {
      if (!countMap[r.event_id]) {
        countMap[r.event_id] = { total: 0, active: 0 };
      }
      countMap[r.event_id].total++;
      if (r.registration_status === 'REGISTERED') {
        countMap[r.event_id].active++;
      }
    }
  }

  return (events || []).map((ev: any) => ({
    ...ev,
    registrations_count: countMap[ev.id]?.total || 0,
    active_registrations_count: countMap[ev.id]?.active || 0,
  }));
}

/**
 * Fetch single event by ID for an admin (guarantees collegeId scoping)
 */
export async function getAdminEventById(
  eventId: string,
  collegeId: string
): Promise<CollegeEvent | null> {
  const db = await getDb();

  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[GET_ADMIN_EVENT_BY_ID_ERROR]', error);
    return null;
  }

  const { count: activeCount } = await db
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('registration_status', 'REGISTERED');

  return {
    ...data,
    active_registrations_count: activeCount || 0,
  };
}

/**
 * Fetch published events for public tenant portal
 */
export async function getPublicTenantEvents(collegeId: string): Promise<CollegeEvent[]> {
  const db = await getDb();

  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('college_id', collegeId)
    .eq('status', 'PUBLISHED')
    .order('start_at', { ascending: true });

  if (error) {
    console.error('[GET_PUBLIC_EVENTS_ERROR]', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch single published event by slug for public tenant portal
 */
export async function getPublicEventBySlug(
  collegeId: string,
  slug: string
): Promise<CollegeEvent | null> {
  const db = await getDb();

  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('college_id', collegeId)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Fetch active registration count for capacity display
  const { count: activeCount } = await db
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', data.id)
    .eq('registration_status', 'REGISTERED');

  return {
    ...data,
    active_registrations_count: activeCount || 0,
  };
}

/**
 * Fetch registrations for an event with comprehensive filters
 */
export async function getEventRegistrations(params: {
  eventId: string;
  collegeId: string;
  search?: string;
  branchId?: string;
  semesterId?: string;
  paymentStatus?: EventPaymentStatus | 'ALL';
  registrationStatus?: EventRegistrationStatus | 'ALL';
}): Promise<{ registrations: EventRegistration[]; stats: EventStats }> {
  const db = await getDb();

  // First verify event belongs to this college
  const event = await getAdminEventById(params.eventId, params.collegeId);
  if (!event) {
    return {
      registrations: [],
      stats: {
        totalEnrolled: 0,
        paymentPending: 0,
        paymentVerified: 0,
        paymentRejected: 0,
        availableSeats: null,
        maxCapacity: null,
      },
    };
  }

  // Build query with joins
  let query = db
    .from('event_registrations')
    .select(`
      *,
      branch:branches(id, name, code),
      semester:semesters(id, name, semester_number)
    `)
    .eq('event_id', params.eventId)
    .eq('college_id', params.collegeId)
    .order('registered_at', { ascending: false });

  if (params.branchId && params.branchId !== 'ALL') {
    query = query.eq('branch_id', params.branchId);
  }

  if (params.semesterId && params.semesterId !== 'ALL') {
    query = query.eq('semester_id', params.semesterId);
  }

  if (params.paymentStatus && params.paymentStatus !== 'ALL') {
    query = query.eq('payment_status', params.paymentStatus);
  }

  if (params.registrationStatus && params.registrationStatus !== 'ALL') {
    query = query.eq('registration_status', params.registrationStatus);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET_EVENT_REGISTRATIONS_ERROR]', error);
    return {
      registrations: [],
      stats: {
        totalEnrolled: 0,
        paymentPending: 0,
        paymentVerified: 0,
        paymentRejected: 0,
        availableSeats: null,
        maxCapacity: event.max_capacity,
      },
    };
  }

  let registrations: EventRegistration[] = data || [];

  // Filter in-memory if search string is provided (name, reg number, email, mobile, transaction_id)
  if (params.search && params.search.trim()) {
    const s = params.search.trim().toLowerCase();
    registrations = registrations.filter(
      (r) =>
        r.student_name?.toLowerCase().includes(s) ||
        r.registration_number?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.mobile?.includes(s) ||
        r.transaction_id?.toLowerCase().includes(s)
    );
  }

  // Calculate statistics across all registrations for this event
  const { data: allRegs } = await db
    .from('event_registrations')
    .select('payment_status, registration_status')
    .eq('event_id', params.eventId)
    .eq('college_id', params.collegeId);

  let totalEnrolled = 0;
  let paymentPending = 0;
  let paymentVerified = 0;
  let paymentRejected = 0;

  for (const r of allRegs || []) {
    if (r.registration_status === 'REGISTERED') {
      totalEnrolled++;
      if (r.payment_status === 'PENDING') paymentPending++;
      if (r.payment_status === 'VERIFIED') paymentVerified++;
      if (r.payment_status === 'REJECTED') paymentRejected++;
    }
  }

  const availableSeats =
    event.max_capacity !== null
      ? Math.max(0, event.max_capacity - totalEnrolled)
      : null;

  return {
    registrations,
    stats: {
      totalEnrolled,
      paymentPending,
      paymentVerified,
      paymentRejected,
      availableSeats,
      maxCapacity: event.max_capacity,
    },
  };
}

/**
 * Register a student for an event with strict server-side validation.
 * Uses atomic RPC `register_for_event` if present, with rock-solid server fallback.
 */
export async function registerStudentForEvent(
  input: PublicEventRegistrationInput
): Promise<{ success: boolean; error?: string; registration_id?: string; payment_status?: string }> {
  const db = await getDb();

  // 1. Fetch Event and verify it belongs to specified college
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('*')
    .eq('id', input.event_id)
    .eq('college_id', input.college_id)
    .maybeSingle();

  if (eventErr || !event) {
    return { success: false, error: 'Event not found or does not belong to this institution.' };
  }

  // 2. Lifecycle & status checks
  if (event.status !== 'PUBLISHED') {
    return { success: false, error: 'Registration is not available for this event.' };
  }

  if (!event.registration_enabled) {
    return { success: false, error: 'Registration is currently disabled for this event.' };
  }

  const now = new Date();
  const regStart = new Date(event.registration_start);
  const regEnd = new Date(event.registration_end);

  if (now < regStart) {
    return { success: false, error: 'Registration for this event has not opened yet.' };
  }

  if (now > regEnd) {
    return { success: false, error: 'Registration deadline for this event has passed.' };
  }

  // 3. Clean student inputs
  const cleanRegNum = input.registration_number.trim().toUpperCase();
  const cleanName = input.student_name.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanMobile = input.mobile.trim();

  if (!cleanRegNum || !cleanName || !cleanEmail || !cleanMobile) {
    return { success: false, error: 'Please provide all required fields.' };
  }

  // 4. Validate branch & semester belong to this college
  if (input.branch_id) {
    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('id', input.branch_id)
      .eq('college_id', input.college_id)
      .maybeSingle();

    if (!branch) {
      return { success: false, error: 'Selected branch is invalid for this institution.' };
    }
  }

  if (input.semester_id) {
    const { data: sem } = await db
      .from('semesters')
      .select('id')
      .eq('id', input.semester_id)
      .eq('college_id', input.college_id)
      .maybeSingle();

    if (!sem) {
      return { success: false, error: 'Selected semester is invalid for this institution.' };
    }
  }

  // 5. Try calling atomic RPC procedure first
  try {
    const { data: rpcData, error: rpcError } = await db.rpc('register_for_event', {
      p_event_id: input.event_id,
      p_registration_number: cleanRegNum,
      p_student_name: cleanName,
      p_email: cleanEmail,
      p_mobile: cleanMobile,
      p_branch_id: input.branch_id || null,
      p_semester_id: input.semester_id || null,
      p_transaction_id: input.transaction_id || null,
      p_payment_screenshot_url: input.payment_screenshot_url || null,
    });

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        return {
          success: true,
          registration_id: rpcData.registration_id,
          payment_status: rpcData.payment_status,
        };
      } else {
        return {
          success: false,
          error: rpcData.error || 'Registration failed.',
        };
      }
    }
  } catch (rpcEx) {
    console.warn('[REGISTER_RPC_FALLBACK]', rpcEx);
  }

  // 6. Server fallback if RPC not yet deployed:
  // Duplicate registration check
  const { data: existingReg } = await db
    .from('event_registrations')
    .select('id')
    .eq('event_id', input.event_id)
    .eq('registration_number', cleanRegNum)
    .maybeSingle();

  if (existingReg) {
    return { success: false, error: 'You are already registered for this event.' };
  }

  // Capacity check
  if (event.max_capacity !== null) {
    const { count: activeCount } = await db
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', input.event_id)
      .eq('registration_status', 'REGISTERED');

    if ((activeCount || 0) >= event.max_capacity) {
      return { success: false, error: 'Event capacity has been reached. No seats available.' };
    }
  }

  const paymentStatus: EventPaymentStatus = event.payment_required ? 'PENDING' : 'NOT_REQUIRED';

  const { data: inserted, error: insertErr } = await db
    .from('event_registrations')
    .insert({
      event_id: input.event_id,
      college_id: input.college_id,
      registration_number: cleanRegNum,
      student_name: cleanName,
      email: cleanEmail,
      mobile: cleanMobile,
      branch_id: input.branch_id || null,
      semester_id: input.semester_id || null,
      transaction_id: input.transaction_id ? input.transaction_id.trim() : null,
      payment_status: paymentStatus,
      payment_screenshot_url: input.payment_screenshot_url || null,
      registration_status: 'REGISTERED',
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { success: false, error: 'You are already registered for this event.' };
    }
    console.error('[EVENT_REG_INSERT_ERROR]', insertErr);
    return { success: false, error: insertErr.message || 'Failed to submit registration.' };
  }

  return {
    success: true,
    registration_id: inserted.id,
    payment_status: paymentStatus,
  };
}
