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
import { isUuid, normalizeEventSlug } from '@/lib/events/slug';
import { computeCanonicalStatsFromRows, getCanonicalEventStats } from '@/lib/events/canonical-stats';
import { enrichEventWithGoogleMetadata } from '@/lib/google/event-registration-automated';

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
    console.error('[GET_ADMIN_EVENTS_ERROR]', error.message || error);
    return [];
  }

  // Google Sheets is the source of truth for registrations.
  // We do not query the deprecated Supabase event_registrations table.
  return (events || []).map(enrichEventWithGoogleMetadata);
}

/**
 * Fetch single event by ID or SLUG for an admin (guarantees collegeId scoping).
 * Safely handles both UUID and slug identifiers without Postgres type errors.
 */
export async function getAdminEventById(
  idOrSlug: string,
  collegeId: string
): Promise<CollegeEvent | null> {
  if (!idOrSlug || !collegeId) return null;
  const db = await getDb();

  let clean = idOrSlug.trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Malformed URI sequence fallback
  }

  const isIdentifierUuid = isUuid(clean);

  let data: any = null;
  let error: any = null;

  if (isIdentifierUuid) {
    // Primary query by UUID
    const res = await db
      .from('events')
      .select('*, college:colleges(id, name, slug, code, logo_url)')
      .eq('id', clean)
      .eq('college_id', collegeId)
      .maybeSingle();

    data = res.data;
    error = res.error;

    // Fallback: in rare case an event slug equals this string
    if (!data && !error) {
      const fallbackRes = await db
        .from('events')
        .select('*, college:colleges(id, name, slug, code, logo_url)')
        .eq('slug', clean.toLowerCase())
        .eq('college_id', collegeId)
        .maybeSingle();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }
  } else {
    // Query strictly by slug within the tenant college
    const normalized = normalizeEventSlug(clean);
    const res = await db
      .from('events')
      .select('*, college:colleges(id, name, slug, code, logo_url)')
      .eq('slug', normalized)
      .eq('college_id', collegeId)
      .maybeSingle();

    data = res.data;
    error = res.error;
  }

  if (error || !data) {
    if (error) console.error('[GET_ADMIN_EVENT_BY_ID_ERROR]', error);
    return null;
  }

  const enriched = enrichEventWithGoogleMetadata(data);

  try {
    const stats = await getCanonicalEventStats(collegeId, enriched.id, enriched);
    return {
      ...enriched,
      active_registrations_count: stats.available ? stats.totalEnrolled : undefined,
    };
  } catch {
    return enriched;
  }
}

/**
 * Re-export alias for getAdminEventById to make slug/id dual resolution explicit.
 */
export const getAdminEventByIdOrSlug = getAdminEventById;

import { unstable_cache } from 'next/cache';

/**
 * Fetch published events for public tenant portal (direct lookup).
 */
async function fetchPublicTenantEventsDirect(collegeId: string): Promise<CollegeEvent[]> {
  const db = await getDb();

  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('college_id', collegeId)
    .eq('status', 'PUBLISHED')
    .order('start_at', { ascending: true });

  if (error) {
    console.error('[GET_PUBLIC_EVENTS_ERROR]', error.message || error);
    return [];
  }

  return (data || []).map(enrichEventWithGoogleMetadata);
}

const getCachedPublicTenantEvents = unstable_cache(
  async (collegeId: string): Promise<CollegeEvent[]> => {
    return fetchPublicTenantEventsDirect(collegeId);
  },
  ['public_tenant_events_cache'],
  {
    revalidate: 60,
    tags: ['events'],
  }
);

/**
 * Fetch published events for public tenant portal with 60s cache.
 */
export async function getPublicTenantEvents(collegeId: string): Promise<CollegeEvent[]> {
  try {
    return await getCachedPublicTenantEvents(collegeId);
  } catch {
    return fetchPublicTenantEventsDirect(collegeId);
  }
}

/**
 * Fetch single published event by slug for public tenant portal.
 * Multi-tenant safe: strictly scoped by (college_id, slug).
 */
export async function getPublicEventBySlug(
  collegeId: string,
  slugOrId: string
): Promise<CollegeEvent | null> {
  if (!collegeId || !slugOrId) return null;
  const db = await getDb();

  const clean = normalizeEventSlug(slugOrId);

  let { data, error } = await db
    .from('events')
    .select('*, college:colleges(id, name, slug, code, logo_url)')
    .eq('college_id', collegeId)
    .eq('slug', clean)
    .maybeSingle();

  // If not found by slug and slugOrId looks like a UUID, fallback to lookup by UUID
  if (!data && isUuid(slugOrId)) {
    const res = await db
      .from('events')
      .select('*, college:colleges(id, name, slug, code, logo_url)')
      .eq('college_id', collegeId)
      .eq('id', slugOrId.trim())
      .maybeSingle();
    data = res.data;
    error = res.error;
  }

  if (error || !data) {
    return null;
  }

  const enriched = enrichEventWithGoogleMetadata(data);

  try {
    const stats = await getCanonicalEventStats(collegeId, enriched.id, enriched);
    return {
      ...enriched,
      active_registrations_count: stats.available ? stats.totalEnrolled : undefined,
    };
  } catch {
    return enriched;
  }
}

/**
 * Fetch a public event by its slug (without collegeId in URL).
 * Used by root /events/[slug] routes to resolve event and its owning college.
 */
export async function getPublicEventBySlugGlobal(
  slugOrId: string
): Promise<(CollegeEvent & { college: { id: string; name: string; slug: string; code?: string; logo_url?: string | null; website_url?: string | null } }) | null> {
  if (!slugOrId) return null;
  const db = await getDb();
  const clean = normalizeEventSlug(slugOrId);

  let { data, error } = await db
    .from('events')
    .select('*, college:colleges(id, name, slug, code, logo_url, website_url)')
    .eq('slug', clean)
    .maybeSingle();

  if (!data && isUuid(slugOrId)) {
    const res = await db
      .from('events')
      .select('*, college:colleges(id, name, slug, code, logo_url, website_url)')
      .eq('id', slugOrId.trim())
      .maybeSingle();
    data = res.data;
    error = res.error;
  }

  if (error || !data) return null;
  return enrichEventWithGoogleMetadata(data) as any;
}

/**
 * Fetch more published events for the given college (excluding current event).
 * Used by custom completion experience to show real upcoming campus events.
 */
export async function getMorePublishedEventsForCollege(
  collegeId: string,
  excludeEventId?: string,
  limit: number = 4
): Promise<CollegeEvent[]> {
  if (!collegeId) return [];
  const db = await getDb();

  let query = db
    .from('events')
    .select('id, college_id, title, slug, description, venue, start_at, end_at, registration_deadline, registration_label, payment_required, payment_amount, college:colleges(id, name, slug, code, logo_url)')
    .eq('college_id', collegeId)
    .eq('status', 'PUBLISHED')
    .order('start_at', { ascending: true })
    .limit(limit);

  if (excludeEventId) {
    query = query.neq('id', excludeEventId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error('[GET_MORE_PUBLISHED_EVENTS_ERROR]', error);
    return [];
  }

  return (data || []).map(enrichEventWithGoogleMetadata);
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

  // First verify event belongs to this college (resolves either UUID or slug)
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

  // GOOGLE SHEETS IS SOURCE OF TRUTH FOR REGISTRATION DATA
  // Auto-discover spreadsheet if registration_sheet_id is null/missing
  let resolvedSheetId: string | null = event.registration_sheet_id || null;
  if (!resolvedSheetId) {
    try {
      const { resolveEventRegistrationSpreadsheet } = await import('@/lib/google/event-registration-sheets');
      resolvedSheetId = await resolveEventRegistrationSpreadsheet(params.collegeId, event.id, event.title);
    } catch { /* non-fatal */ }
  }

  if (resolvedSheetId) {
    try {
      const { getEventRegistrations: getSheetEventRegistrations } = await import('@/lib/google/event-registration-sheets');
      const sheetRows = await getSheetEventRegistrations(params.collegeId, resolvedSheetId);

      const { batchResolveAcademicDisplayValues } = await import('@/lib/events/academic-resolver');
      const academicMap = await batchResolveAcademicDisplayValues(params.collegeId, sheetRows);

      let registrations: EventRegistration[] = sheetRows.map((r, idx) => {
        const key = `${r.branch || ''}__${r.semester || ''}`;
        const academic = academicMap.get(key) || { branch: r.branch || '', semester: r.semester || '' };
        const semNum = academic.semester.match(/^(\d+)/)?.[1];
        return {
          id: r.registrationNumber || `reg-${idx}`,
          event_id: event.id,
          college_id: params.collegeId,
          registration_number: r.registrationNumber,
          student_name: r.participantName,
          email: r.email,
          mobile: r.mobile,
          branch_id: null,
          branch: academic.branch ? { id: '', name: academic.branch, code: academic.branch } : null,
          semester_id: null,
          semester: academic.semester ? { id: '', name: academic.semester, semester_number: semNum ? parseInt(semNum, 10) : 1 } : null,
          transaction_id: r.paymentReference,
          payment_status: (r.paymentStatus === 'PAID' ? 'VERIFIED' : r.paymentStatus as any) || 'NOT_REQUIRED',
          payment_screenshot_url: null,
          registration_status: (r.registrationStatus as any) || 'REGISTERED',
          registered_at: r.registeredAt,
          updated_at: r.registeredAt,
        };
      });

      // Search filter
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

      if (params.paymentStatus && params.paymentStatus !== 'ALL') {
        registrations = registrations.filter((r) => r.payment_status === params.paymentStatus);
      }
      if (params.registrationStatus && params.registrationStatus !== 'ALL') {
        registrations = registrations.filter((r) => r.registration_status === params.registrationStatus);
      }

      // Compute stats directly from Google Sheets using canonical logic
      const canonical = computeCanonicalStatsFromRows(sheetRows, event.max_capacity);

      return {
        registrations,
        stats: {
          totalEnrolled: canonical.totalEnrolled,
          paymentPending: canonical.paymentPending,
          paymentVerified: canonical.paymentVerified,
          paymentRejected: canonical.paymentRejected,
          availableSeats: canonical.availableSeats,
          maxCapacity: event.max_capacity,
        },
      };
    } catch (sheetErr) {
      console.warn('[GET_EVENT_REGS_SHEET_ERROR]', sheetErr);
    }
  }

  // Fallback: Build query with joins - ALWAYS use canonical UUID (event.id)
  let query = db
    .from('event_registrations')
    .select(`
      *,
      branch:branches(id, name, code),
      semester:semesters(id, name, semester_number)
    `)
    .eq('event_id', event.id)
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
    console.error('[GET_EVENT_REGISTRATIONS_ERROR]', error.message || error);
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
    .eq('event_id', event.id)
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

  // 5. ATOMIC POSTGRESQL TRANSACTION (AUTHORITATIVE SOURCE OF TRUTH)
  let registrationId: string | undefined;
  let paymentStatus: EventPaymentStatus = event.payment_required ? 'PENDING' : 'NOT_REQUIRED';

  const { data: rpcRes, error: rpcErr } = await db.rpc('register_for_event', {
    p_event_id: event.id,
    p_registration_number: cleanRegNum,
    p_student_name: cleanName,
    p_email: cleanEmail,
    p_mobile: cleanMobile,
    p_branch_id: input.branch_id || null,
    p_semester_id: input.semester_id || null,
    p_transaction_id: input.transaction_id || null,
    p_payment_screenshot_url: input.payment_screenshot_url || null,
  });

  if (rpcErr) {
    console.warn('[EVENT_REG_RPC_NOTICE]', rpcErr.message);
    // Safe fallback to direct insert if RPC is unavailable or returns an error
    const { data: directInsert, error: insertErr } = await db
      .from('event_registrations')
      .insert({
        event_id: event.id,
        college_id: input.college_id,
        registration_number: cleanRegNum,
        student_name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        branch_id: input.branch_id || null,
        semester_id: input.semester_id || null,
        transaction_id: input.transaction_id || null,
        payment_screenshot_url: input.payment_screenshot_url || null,
        payment_status: paymentStatus,
        registration_status: 'REGISTERED',
      })
      .select('id')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return { success: false, error: 'You are already registered for this event.' };
      }
      return { success: false, error: insertErr.message || 'Failed to complete registration.' };
    }
    registrationId = directInsert?.id;
  } else {
    const resObj = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
    if (!resObj.success) {
      return { success: false, error: resObj.error || 'Registration failed.' };
    }
    registrationId = resObj.registration_id;
    if (resObj.payment_status) {
      paymentStatus = resObj.payment_status;
    }
  }

  // 6. ASYNCHRONOUS / RESILIENT GOOGLE SHEETS SYNCHRONIZATION
  // Google Sheets serves as an institutional projection; PostgreSQL is the transactional source of truth.
  // Sheets sync failure will NOT cause a valid student registration to fail.
  try {
    const { isCollegeGoogleConfigured } = await import('@/lib/google/auth');
    const googleConnected = await isCollegeGoogleConfigured(input.college_id);
    if (googleConnected) {
      const {
        getOrCreateEventRegistrationSpreadsheet,
        appendEventRegistration,
      } = await import('@/lib/google/event-registration-sheets');

      const spreadsheetId = await getOrCreateEventRegistrationSpreadsheet(
        input.college_id,
        event.id,
        event.title
      );

      let finalBranch = input.branch_id || '';
      let finalSemester = input.semester_id || '';
      try {
        const { resolveAcademicDisplayValues } = await import('@/lib/events/academic-resolver');
        const academic = await resolveAcademicDisplayValues(input.college_id, finalBranch, finalSemester);
        finalBranch = academic.branch;
        finalSemester = academic.semester;
      } catch {
        // non-fatal
      }

      await appendEventRegistration(
        input.college_id,
        spreadsheetId,
        event.slug,
        {
          eventId: event.id,
          fullName: cleanName,
          studentId: cleanRegNum,
          email: cleanEmail,
          mobile: cleanMobile,
          branch: finalBranch,
          semester: finalSemester,
          gender: '',
        }
      );
    }
  } catch (sheetErr: any) {
    // Non-fatal notice: Logged, but does not abort the valid student registration
    console.warn('[EVENT_REG_SHEET_SYNC_NOTICE]', sheetErr?.message || sheetErr);
  }

  return {
    success: true,
    registration_id: registrationId || cleanRegNum,
    payment_status: paymentStatus,
  };
}
