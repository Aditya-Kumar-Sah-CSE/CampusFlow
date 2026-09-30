import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { EventProgram, ProgramFormData, ProgramStats, EventProgramsStats, EventCategory } from '@/types/programs';

async function getDb() {
  return createAdminClient() || await createClient();
}

/**
 * Fetch all programs for an event (admin — includes inactive)
 */
export async function getAdminEventPrograms(
  eventId: string,
  collegeId: string
): Promise<EventProgram[]> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_programs')
    .select('*, category:event_categories(id, name, display_order)')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GET_ADMIN_EVENT_PROGRAMS_ERROR]', error.message);
    return [];
  }

  // Enrich with registration counts
  const programIds = (data || []).map((p: EventProgram) => p.id);
  if (programIds.length === 0) return data || [];

  const { data: regCounts } = await db
    .from('program_registrations')
    .select('program_id, registration_type, registration_status')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .in('program_id', programIds);

  // Count members for team registrations
  const { data: memberCounts } = await db
    .from('program_registration_members')
    .select('registration_id')
    .eq('college_id', collegeId)
    .in('program_id', programIds);

  const regMap: Record<string, { total: number; teams: number; individual: number; members: number }> = {};
  for (const r of regCounts || []) {
    if (!regMap[r.program_id]) regMap[r.program_id] = { total: 0, teams: 0, individual: 0, members: 0 };
    if (r.registration_status === 'REGISTERED') {
      regMap[r.program_id].total++;
      if (r.registration_type === 'TEAM') regMap[r.program_id].teams++;
      else regMap[r.program_id].individual++;
    }
  }

  // Count members per program by gathering registration IDs
  const regToProgram: Record<string, string> = {};
  for (const r of regCounts || []) {
    // We need registration IDs mapped to program IDs
  }
  // Re-fetch registrations with IDs for member mapping
  const { data: regsWithIds } = await db
    .from('program_registrations')
    .select('id, program_id')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .in('program_id', programIds);

  for (const r of regsWithIds || []) {
    regToProgram[r.id] = r.program_id;
  }

  for (const m of memberCounts || []) {
    const progId = regToProgram[m.registration_id];
    if (progId && regMap[progId]) {
      regMap[progId].members++;
    }
  }

  return (data || []).map((p: EventProgram) => ({
    ...p,
    registrations_count: regMap[p.id]?.total || 0,
    teams_count: regMap[p.id]?.teams || 0,
    individual_count: regMap[p.id]?.individual || 0,
    participants_count: (regMap[p.id]?.individual || 0) + (regMap[p.id]?.members || 0),
  }));
}

/**
 * Fetch active programs for public view, grouped by category
 */
export async function getPublicEventPrograms(
  eventId: string,
  collegeId: string
): Promise<{ categories: (EventCategory & { programs: EventProgram[] })[] }> {
  const db = await getDb();

  const { data: categories } = await db
    .from('event_categories')
    .select('*')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  const { data: programs } = await db
    .from('event_programs')
    .select('*')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // Enrich programs with registration counts for display
  const programIds = (programs || []).map((p: EventProgram) => p.id);
  let regCounts: Record<string, { total: number; teams: number; individual: number; members: number }> = {};

  if (programIds.length > 0) {
    const { data: regs } = await db
      .from('program_registrations')
      .select('program_id, registration_type, registration_status')
      .eq('event_id', eventId)
      .in('program_id', programIds)
      .eq('registration_status', 'REGISTERED');

    for (const r of regs || []) {
      if (!regCounts[r.program_id]) regCounts[r.program_id] = { total: 0, teams: 0, individual: 0, members: 0 };
      regCounts[r.program_id].total++;
      if (r.registration_type === 'TEAM') regCounts[r.program_id].teams++;
      else regCounts[r.program_id].individual++;
    }
  }

  const enrichedPrograms = (programs || []).map((p: EventProgram) => ({
    ...p,
    registrations_count: regCounts[p.id]?.total || 0,
    teams_count: regCounts[p.id]?.teams || 0,
    individual_count: regCounts[p.id]?.individual || 0,
  }));

  const grouped = (categories || []).map((cat: EventCategory) => ({
    ...cat,
    programs: enrichedPrograms.filter((p: EventProgram) => p.category_id === cat.id),
  }));

  return { categories: grouped };
}

/**
 * Get a single program by ID (admin, tenant-scoped)
 */
export async function getAdminProgramById(
  programId: string,
  collegeId: string
): Promise<EventProgram | null> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_programs')
    .select('*, category:event_categories(id, name)')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Get a program by slug within an event (public)
 */
export async function getPublicProgramBySlug(
  eventId: string,
  collegeId: string,
  slug: string
): Promise<EventProgram | null> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_programs')
    .select('*, category:event_categories(id, name)')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('slug', slug.trim().toLowerCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  // Enrich with counts
  const { count: regCount } = await db
    .from('program_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', data.id)
    .eq('registration_status', 'REGISTERED');

  return {
    ...data,
    registrations_count: regCount || 0,
  };
}

/**
 * Create a new program
 */
export async function createProgram(
  eventId: string,
  collegeId: string,
  formData: ProgramFormData
): Promise<{ success: boolean; error?: string; program?: EventProgram }> {
  const db = await getDb();

  const cleanName = formData.name.trim();
  const cleanSlug = formData.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  if (!cleanName || !cleanSlug) {
    return { success: false, error: 'Program name and slug are required.' };
  }

  // Verify category belongs to this event
  const { data: cat } = await db
    .from('event_categories')
    .select('id')
    .eq('id', formData.category_id)
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (!cat) {
    return { success: false, error: 'Invalid category for this event.' };
  }

  // Get next display order
  const { data: existing } = await db
    .from('event_programs')
    .select('display_order')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await db
    .from('event_programs')
    .insert({
      event_id: eventId,
      category_id: formData.category_id,
      college_id: collegeId,
      name: cleanName,
      slug: cleanSlug,
      description: formData.description?.trim() || null,
      rules: formData.rules?.trim() || null,
      participation_type: formData.participation_type,
      registration_fee: formData.registration_fee || 0,
      currency: formData.currency || 'INR',
      min_team_size: formData.min_team_size || null,
      max_team_size: formData.max_team_size || null,
      max_participants: formData.max_participants || null,
      max_teams: formData.max_teams || null,
      registration_open_at: formData.registration_open_at || null,
      registration_close_at: formData.registration_close_at || null,
      show_public_participants: formData.show_public_participants ?? false,
      is_active: formData.is_active ?? true,
      display_order: formData.display_order ?? nextOrder,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A program with this slug already exists for this event.' };
    }
    console.error('[CREATE_PROGRAM_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true, program: data };
}

/**
 * Update a program
 */
export async function updateProgram(
  programId: string,
  collegeId: string,
  formData: Partial<ProgramFormData>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (formData.name !== undefined) updates.name = formData.name.trim();
  if (formData.slug !== undefined) {
    updates.slug = formData.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (formData.category_id !== undefined) updates.category_id = formData.category_id;
  if (formData.description !== undefined) updates.description = formData.description?.trim() || null;
  if (formData.rules !== undefined) updates.rules = formData.rules?.trim() || null;
  if (formData.participation_type !== undefined) updates.participation_type = formData.participation_type;
  if (formData.registration_fee !== undefined) updates.registration_fee = formData.registration_fee;
  if (formData.currency !== undefined) updates.currency = formData.currency;
  if (formData.min_team_size !== undefined) updates.min_team_size = formData.min_team_size || null;
  if (formData.max_team_size !== undefined) updates.max_team_size = formData.max_team_size || null;
  if (formData.max_participants !== undefined) updates.max_participants = formData.max_participants || null;
  if (formData.max_teams !== undefined) updates.max_teams = formData.max_teams || null;
  if (formData.registration_open_at !== undefined) updates.registration_open_at = formData.registration_open_at || null;
  if (formData.registration_close_at !== undefined) updates.registration_close_at = formData.registration_close_at || null;
  if (formData.show_public_participants !== undefined) updates.show_public_participants = formData.show_public_participants;
  if (formData.is_active !== undefined) updates.is_active = formData.is_active;
  if (formData.display_order !== undefined) updates.display_order = formData.display_order;

  const { error } = await db
    .from('event_programs')
    .update(updates)
    .eq('id', programId)
    .eq('college_id', collegeId);

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Slug already in use by another program.' };
    }
    console.error('[UPDATE_PROGRAM_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a program (safe: checks for existing registrations)
 */
export async function deleteProgram(
  programId: string,
  collegeId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const { count: regCount } = await db
    .from('program_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .eq('college_id', collegeId);

  if ((regCount || 0) > 0) {
    return {
      success: false,
      error: `Cannot delete program: it has ${regCount} registration(s). Deactivate the program instead.`,
    };
  }

  const { error } = await db
    .from('event_programs')
    .delete()
    .eq('id', programId)
    .eq('college_id', collegeId);

  if (error) {
    console.error('[DELETE_PROGRAM_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get aggregate stats for all programs in an event
 */
export async function getEventProgramsStats(
  eventId: string,
  collegeId: string
): Promise<EventProgramsStats> {
  const db = await getDb();

  const { count: totalPrograms } = await db
    .from('event_programs')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('college_id', collegeId);

  const { count: totalCategories } = await db
    .from('event_categories')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('college_id', collegeId);

  const { data: regs } = await db
    .from('program_registrations')
    .select('registration_type, payment_status, payment_amount, registration_status')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('registration_status', 'REGISTERED');

  let totalRegistrations = 0;
  let totalTeams = 0;
  let totalIndividual = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let totalRevenue = 0;

  for (const r of regs || []) {
    totalRegistrations++;
    if (r.registration_type === 'TEAM') totalTeams++;
    else totalIndividual++;
    if (r.payment_status === 'VERIFIED') {
      totalPaid++;
      totalRevenue += Number(r.payment_amount || 0);
    }
    if (r.payment_status === 'PENDING' || r.payment_status === 'SUBMITTED') totalPending++;
  }

  // Count total participants (individual regs + team members)
  const { count: memberCount } = await db
    .from('program_registration_members')
    .select('id', { count: 'exact', head: true })
    .eq('college_id', collegeId);

  const totalParticipants = totalIndividual + (memberCount || 0);

  return {
    totalPrograms: totalPrograms || 0,
    totalCategories: totalCategories || 0,
    totalRegistrations,
    totalParticipants,
    totalTeams,
    totalIndividual,
    totalPaid,
    totalPending,
    totalRevenue,
  };
}

/**
 * Get stats for a single program
 */
export async function getProgramStats(
  programId: string,
  collegeId: string
): Promise<ProgramStats> {
  const db = await getDb();

  const { data: regs } = await db
    .from('program_registrations')
    .select('id, registration_type, payment_status, payment_amount, registration_status')
    .eq('program_id', programId)
    .eq('college_id', collegeId);

  let totalRegistrations = 0;
  let totalTeams = 0;
  let totalIndividual = 0;
  let paymentPending = 0;
  let paymentVerified = 0;
  let paymentRejected = 0;
  let paymentSubmitted = 0;
  let totalRevenue = 0;
  const activeRegIds: string[] = [];

  for (const r of regs || []) {
    if (r.registration_status === 'REGISTERED') {
      totalRegistrations++;
      if (r.registration_type === 'TEAM') {
        totalTeams++;
        activeRegIds.push(r.id);
      } else {
        totalIndividual++;
      }
      if (r.payment_status === 'PENDING') paymentPending++;
      if (r.payment_status === 'SUBMITTED') paymentSubmitted++;
      if (r.payment_status === 'VERIFIED') {
        paymentVerified++;
        totalRevenue += Number(r.payment_amount || 0);
      }
      if (r.payment_status === 'REJECTED') paymentRejected++;
    }
  }

  // Count team members
  let memberCount = 0;
  if (activeRegIds.length > 0) {
    const { count } = await db
      .from('program_registration_members')
      .select('id', { count: 'exact', head: true })
      .in('registration_id', activeRegIds);
    memberCount = count || 0;
  }

  const totalParticipants = totalIndividual + memberCount;

  // Get program limits
  const { data: program } = await db
    .from('event_programs')
    .select('max_participants, max_teams')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  return {
    totalRegistrations,
    totalParticipants,
    totalTeams,
    totalIndividual,
    paymentPending,
    paymentVerified,
    paymentRejected,
    paymentSubmitted,
    totalRevenue,
    availableSlots: program?.max_participants != null ? Math.max(0, program.max_participants - totalParticipants) : null,
    maxParticipants: program?.max_participants ?? null,
    maxTeams: program?.max_teams ?? null,
  };
}
