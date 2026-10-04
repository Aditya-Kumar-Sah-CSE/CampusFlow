'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/auth/admin-auth';
import type {
  EventStatus,
  EventRegistrationStatus,
  EventFormData,
  GoogleRegistrationResources,
} from '@/types/events';
import { normalizeEventSlug, isValidEventSlug } from '@/lib/events/slug';
import { isCollegeGoogleConfigured } from '@/lib/google/auth';
import {
  setupAutomatedEventRegistration,
  fetchGoogleFormEventResponses,
  enrichEventWithGoogleMetadata,
} from '@/lib/google/event-registration-automated';

async function getAdminDb() {
  return createAdminClient() || await createClient();
}

function isSchemaCacheOrColumnError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    (msg.includes('column') && (msg.includes('could not find') || msg.includes('not found') || msg.includes('unknown')))
  );
}

/**
 * Safely inserts an event record, falling back gracefully if newly migrated
 * columns have not yet been applied by the database administrator.
 */
async function safeInsertEvent(db: any, payload: Record<string, any>): Promise<{ data: any; error: any }> {
  const { data, error } = await db.from('events').insert(payload).select('id').single();
  if (!error) return { data, error: null };

  if (isSchemaCacheOrColumnError(error)) {
    const {
      registration_type,
      google_form_id,
      google_form_url,
      google_spreadsheet_id,
      google_spreadsheet_url,
      google_drive_folder_id,
      google_drive_folder_url,
      google_registration_status,
      google_registration_error,
      google_resources_created_at,
      google_resources_updated_at,
      registration_deadline,
      registration_label,
      ...corePayload
    } = payload;

    const metaTag = `\n\n<!--CAMPUSFLOW_GOOGLE_META:${JSON.stringify({
      registration_type,
      google_form_id,
      google_form_url,
      google_spreadsheet_id,
      google_spreadsheet_url,
      google_drive_folder_id,
      google_drive_folder_url,
      google_registration_status,
      google_registration_error,
      google_resources_created_at,
      google_resources_updated_at,
      registration_deadline,
      registration_label,
    })}-->`;

    corePayload.description = (corePayload.description || '') + metaTag;
    if (google_spreadsheet_id) {
      corePayload.registration_sheet_id = google_spreadsheet_id;
    }

    const { data: fallbackData, error: fallbackErr } = await db
      .from('events')
      .insert(corePayload)
      .select('id')
      .single();

    if (!fallbackErr) {
      return { data: fallbackData, error: null };
    }

    // Fallback if registration_sheet_id is also unmigrated
    if (isSchemaCacheOrColumnError(fallbackErr) && corePayload.registration_sheet_id) {
      delete corePayload.registration_sheet_id;
      return await db.from('events').insert(corePayload).select('id').single();
    }

    return { data: null, error: fallbackErr };
  }

  return { data: null, error };
}

/**
 * Safely updates an event record with forward-compatible fallback.
 */
async function safeUpdateEvent(
  db: any,
  eventId: string,
  collegeId: string,
  updates: Record<string, any>
): Promise<{ error: any }> {
  const { error } = await db.from('events').update(updates).eq('id', eventId).eq('college_id', collegeId);
  if (!error) return { error: null };

  if (isSchemaCacheOrColumnError(error)) {
    const {
      registration_type,
      google_form_id,
      google_form_url,
      google_spreadsheet_id,
      google_spreadsheet_url,
      google_drive_folder_id,
      google_drive_folder_url,
      google_registration_status,
      google_registration_error,
      google_resources_created_at,
      google_resources_updated_at,
      registration_deadline,
      registration_label,
      ...coreUpdates
    } = updates;

    const { data: cur } = await db.from('events').select('description').eq('id', eventId).eq('college_id', collegeId).maybeSingle();
    const cleanDesc = (cur?.description || '').replace(/<!--CAMPUSFLOW_GOOGLE_META:[\s\S]*?-->/g, '').trim();

    const metaTag = `\n\n<!--CAMPUSFLOW_GOOGLE_META:${JSON.stringify({
      registration_type,
      google_form_id,
      google_form_url,
      google_spreadsheet_id,
      google_spreadsheet_url,
      google_drive_folder_id,
      google_drive_folder_url,
      google_registration_status,
      google_registration_error,
      google_resources_created_at,
      google_resources_updated_at,
      registration_deadline,
      registration_label,
    })}-->`;

    coreUpdates.description = (coreUpdates.description !== undefined ? coreUpdates.description : cleanDesc) + metaTag;
    if (google_spreadsheet_id) {
      coreUpdates.registration_sheet_id = google_spreadsheet_id;
    }

    const { error: updateFallbackErr } = await db
      .from('events')
      .update(coreUpdates)
      .eq('id', eventId)
      .eq('college_id', collegeId);

    if (!updateFallbackErr) {
      return { error: null };
    }

    // Fallback if registration_sheet_id is also unmigrated
    if (isSchemaCacheOrColumnError(updateFallbackErr) && coreUpdates.registration_sheet_id) {
      delete coreUpdates.registration_sheet_id;
      return await db.from('events').update(coreUpdates).eq('id', eventId).eq('college_id', collegeId);
    }

    return { error: updateFallbackErr };
  }

  return { error };
}

async function logAudit(
  db: any,
  actor: { userId?: string | null; email?: string | null },
  collegeId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string
) {
  try {
    await db.from('audit_logs').insert({
      college_id: collegeId,
      actor_user_id: actor.userId || null,
      actor_email: actor.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (e) {
    console.error('[EVENT_AUDIT_LOG_ERROR]', e);
  }
}

/**
 * Asserts active admin authorization for the current institution.
 */
async function assertAdminCollegeAuth(targetCollegeId?: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    throw new Error('Authentication required.');
  }

  const collegeId = targetCollegeId || session.activeCollegeId;
  if (!collegeId) {
    throw new Error('Active institution context is required.');
  }

  // Super Admin has rights across colleges; College Admin must have an ACTIVE membership for that college
  if (!session.isPlatformSuperAdmin) {
    const isMember = session.colleges.some(
      (c) => c.collegeId === collegeId && c.status === 'ACTIVE'
    );
    if (!isMember) {
      throw new Error('Forbidden: You do not possess administrative permissions for this institution.');
    }
  }

  return { session, collegeId };
}

/**
 * Create a new event
 */
export async function createEventAction(
  data: EventFormData,
  targetCollegeId?: string
): Promise<{
  success: boolean;
  error?: string;
  eventId?: string;
  resources?: GoogleRegistrationResources;
  message?: string;
}> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    // Validation
    const cleanTitle = data.title.trim();
    const cleanSlug = normalizeEventSlug(data.slug);
    const cleanVenue = data.venue.trim();

    if (!cleanTitle || !cleanSlug || !cleanVenue) {
      return { success: false, error: 'Title, slug, and venue are required.' };
    }

    if (!isValidEventSlug(cleanSlug)) {
      return {
        success: false,
        error: 'Event URL slug must be lowercase alphanumeric with hyphens (e.g. "techfest-2026").',
      };
    }

    if (new Date(data.end_at) < new Date(data.start_at)) {
      return { success: false, error: 'Event end time must be after start time.' };
    }

    if (new Date(data.registration_end) < new Date(data.registration_start)) {
      return { success: false, error: 'Registration end time must be after registration start time.' };
    }

    if (data.payment_required) {
      if (!data.payment_amount || data.payment_amount <= 0) {
        return { success: false, error: 'Payment amount must be greater than zero for paid events.' };
      }
      if (!data.payment_upi_id && !data.payment_qr_url) {
        return { success: false, error: 'At least one payment method (UPI ID or Payment QR) must be provided for paid events.' };
      }
    }

    // Slug collision check within this college
    const { data: existingSlug } = await db
      .from('events')
      .select('id')
      .eq('college_id', collegeId)
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existingSlug) {
      return { success: false, error: 'An event with this URL slug already exists in this institution.' };
    }

    const registrationEnabled = data.registration_enabled ?? true;
    let registrationType = data.registration_type;
    if (!registrationType) {
      registrationType = data.google_form_url?.trim() ? 'google_form' : 'internal';
    }

    // Automated Google Registration: Validate institutional Google OAuth upfront
    if (registrationType === 'google_form' && registrationEnabled) {
      const isGoogleConnected = await isCollegeGoogleConfigured(collegeId);
      if (!isGoogleConnected) {
        return {
          success: false,
          error:
            'Google Drive access is required to automatically create event registration resources. Please connect your institutional Google Workspace account in Admin Settings.',
        };
      }
    }

    let sanitizedDeadline: string | null = null;
    if (data.registration_deadline) {
      const d = new Date(data.registration_deadline);
      if (isNaN(d.getTime())) {
        return { success: false, error: 'Invalid registration deadline format.' };
      }
      sanitizedDeadline = d.toISOString();
    } else if (data.registration_end) {
      sanitizedDeadline = data.registration_end;
    }

    const registrationLabel = data.registration_label?.trim() || 'Register Now';

    const { data: newEvent, error: insertError } = await safeInsertEvent(db, {
      college_id: collegeId,
      title: cleanTitle,
      slug: cleanSlug,
      description: data.description?.trim() || null,
      venue: cleanVenue,
      start_at: data.start_at,
      end_at: data.end_at,
      registration_start: data.registration_start,
      registration_end: data.registration_end,
      max_capacity: data.max_capacity && data.max_capacity > 0 ? data.max_capacity : null,
      status: data.status || 'DRAFT',
      registration_enabled: registrationEnabled,
      registration_type: registrationType,
      google_form_url: null, // Populated via automated pipeline
      registration_deadline: sanitizedDeadline,
      registration_label: registrationLabel,
      payment_required: Boolean(data.payment_required),
      payment_amount: data.payment_required ? data.payment_amount : null,
      payment_upi_id: data.payment_required ? (data.payment_upi_id?.trim() || null) : null,
      payment_qr_url: data.payment_required ? (data.payment_qr_url?.trim() || null) : null,
      payment_instructions: data.payment_required ? (data.payment_instructions?.trim() || null) : null,
      created_by: session.userId,
    });

    if (insertError || !newEvent?.id) {
      console.error('[CREATE_EVENT_ERROR]', insertError);
      return { success: false, error: insertError?.message || 'Failed to insert event record.' };
    }

    let googleResources: any = null;

    // Automated Google Registration Pipeline: Automatically create Drive folder, Form, and Sheet
    if (registrationType === 'google_form' && registrationEnabled) {
      const setupRes = await setupAutomatedEventRegistration({
        collegeId,
        eventId: newEvent.id,
        eventTitle: cleanTitle,
        eventDescription: data.description?.trim() || undefined,
        startAt: data.start_at,
        endAt: data.end_at,
        venue: cleanVenue,
        registrationDeadline: sanitizedDeadline || undefined,
        eventSlug: cleanSlug,
      });

      if (!setupRes.success) {
        return {
          success: false,
          error: setupRes.message || 'Failed to initialize Google registration resources.',
          eventId: newEvent.id,
        };
      }

      googleResources = setupRes.resources;
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      'CREATE_EVENT',
      'events',
      newEvent.id,
      `Created event "${cleanTitle}" with status ${data.status} (Registration: ${registrationType})`
    );

    revalidatePath('/admin/dashboard');
    return {
      success: true,
      eventId: newEvent.id,
      resources: googleResources,
      message: googleResources ? 'Google registration form created successfully.' : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create event.' };
  }
}

/**
 * Edit an existing event
 */
export async function updateEventAction(
  eventId: string,
  data: Partial<EventFormData>,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    // Verify event ownership
    const { data: rawExisting, error: findError } = await db
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (findError || !rawExisting) {
      return { success: false, error: 'Event not found or unauthorized.' };
    }

    const existing = enrichEventWithGoogleMetadata(rawExisting);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.venue !== undefined) updates.venue = data.venue.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.start_at !== undefined) updates.start_at = data.start_at;
    if (data.end_at !== undefined) updates.end_at = data.end_at;
    if (data.registration_start !== undefined) updates.registration_start = data.registration_start;
    if (data.registration_end !== undefined) updates.registration_end = data.registration_end;
    if (data.max_capacity !== undefined) {
      updates.max_capacity = data.max_capacity && data.max_capacity > 0 ? data.max_capacity : null;
    }
    if (data.status !== undefined) updates.status = data.status;
    if (data.registration_enabled !== undefined) updates.registration_enabled = data.registration_enabled;

    const targetRegistrationEnabled =
      data.registration_enabled !== undefined ? data.registration_enabled : existing.registration_enabled;

    let targetRegistrationType = data.registration_type !== undefined
      ? data.registration_type
      : existing.registration_type;

    if (!targetRegistrationType) {
      targetRegistrationType = existing.google_form_id || existing.google_form_url ? 'google_form' : 'internal';
    }

    if (data.registration_type !== undefined) {
      updates.registration_type = data.registration_type;
    }

    // Automated Google Registration: Validate institutional Google OAuth upfront
    if (targetRegistrationType === 'google_form' && targetRegistrationEnabled) {
      const isGoogleConnected = await isCollegeGoogleConfigured(collegeId);
      if (!isGoogleConnected) {
        return {
          success: false,
          error:
            'Google Drive access is required to automatically create event registration resources. Please connect your institutional Google Workspace account in Admin Settings.',
        };
      }
    }

    if (data.registration_deadline !== undefined) {
      if (data.registration_deadline) {
        const d = new Date(data.registration_deadline);
        if (isNaN(d.getTime())) {
          return { success: false, error: 'Invalid registration deadline format.' };
        }
        updates.registration_deadline = d.toISOString();
      } else {
        updates.registration_deadline = null;
      }
    }

    if (data.registration_label !== undefined) {
      updates.registration_label = data.registration_label.trim() || 'Register Now';
    }

    if (data.payment_required !== undefined) {
      updates.payment_required = Boolean(data.payment_required);
      if (updates.payment_required) {
        updates.payment_amount = data.payment_amount || existing.payment_amount;
        updates.payment_upi_id = data.payment_upi_id?.trim() || existing.payment_upi_id;
        updates.payment_qr_url = data.payment_qr_url?.trim() || existing.payment_qr_url;
        updates.payment_instructions = data.payment_instructions?.trim() || existing.payment_instructions;
      } else {
        updates.payment_amount = null;
        updates.payment_upi_id = null;
        updates.payment_qr_url = null;
        updates.payment_instructions = null;
      }
    }

    if (data.slug !== undefined) {
      const cleanSlug = normalizeEventSlug(data.slug);
      if (!cleanSlug) {
        return { success: false, error: 'Event URL slug cannot be empty.' };
      }
      if (!isValidEventSlug(cleanSlug)) {
        return {
          success: false,
          error: 'Event URL slug must be lowercase alphanumeric with hyphens (e.g. "techfest-2026").',
        };
      }
      if (cleanSlug !== existing.slug) {
        const { data: collision } = await db
          .from('events')
          .select('id')
          .eq('college_id', collegeId)
          .eq('slug', cleanSlug)
          .neq('id', eventId)
          .maybeSingle();

        if (collision) {
          return { success: false, error: 'URL slug is already in use by another event in this institution.' };
        }
        updates.slug = cleanSlug;
      }
    }

    const { error: updateError } = await safeUpdateEvent(db, eventId, collegeId, updates);

    if (updateError) {
      console.error('[UPDATE_EVENT_ERROR]', updateError);
      return { success: false, error: updateError.message };
    }

    // Automated Google Registration Maintenance:
    // If event uses Google Form, synchronize/update Form info and Drive folder seamlessly (idempotent, preserves responses)
    if (targetRegistrationType === 'google_form' && targetRegistrationEnabled) {
      const finalTitle = updates.title || existing.title;
      const finalDesc = updates.description !== undefined ? updates.description : existing.description;
      const finalVenue = updates.venue || existing.venue;
      const finalStart = updates.start_at || existing.start_at;
      const finalEnd = updates.end_at || existing.end_at;
      const finalDeadline = updates.registration_deadline !== undefined ? updates.registration_deadline : existing.registration_deadline;
      const finalSlug = updates.slug || existing.slug;

      await setupAutomatedEventRegistration({
        collegeId,
        eventId,
        eventTitle: finalTitle,
        eventDescription: finalDesc || undefined,
        startAt: finalStart,
        endAt: finalEnd,
        venue: finalVenue,
        registrationDeadline: finalDeadline || undefined,
        eventSlug: finalSlug,
      });
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      'UPDATE_EVENT',
      'events',
      eventId,
      `Updated event "${existing.title}"`
    );

    revalidatePath('/admin/dashboard');
    revalidatePath(`/admin/dashboard/events/${eventId}`);
    revalidatePath(`/admin/dashboard/events/${eventId}/edit`);
    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    if (existing.slug) {
      revalidatePath(`/admin/dashboard/events/${existing.slug}`);
      revalidatePath(`/admin/dashboard/events/${existing.slug}/edit`);
      revalidatePath(`/admin/dashboard/events/${existing.slug}/registrations`);
    }
    if (updates.slug && updates.slug !== existing.slug) {
      revalidatePath(`/admin/dashboard/events/${updates.slug}`);
      revalidatePath(`/admin/dashboard/events/${updates.slug}/edit`);
      revalidatePath(`/admin/dashboard/events/${updates.slug}/registrations`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update event.' };
  }
}

/**
 * Change event lifecycle status (PUBLISH, CLOSE, CANCEL)
 */
export async function updateEventStatusAction(
  eventId: string,
  newStatus: EventStatus,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    const validStatuses: EventStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: 'Invalid event status.' };
    }

    const { data: existing, error: findError } = await db
      .from('events')
      .select('id, title, slug, status')
      .eq('id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (findError || !existing) {
      return { success: false, error: 'Event not found or unauthorized.' };
    }

    const { error: updateError } = await db
      .from('events')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('college_id', collegeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      `EVENT_${newStatus}`,
      'events',
      eventId,
      `Changed status of event "${existing.title}" from ${existing.status} to ${newStatus}`
    );

    revalidatePath('/admin/dashboard');
    revalidatePath('/events');
    revalidatePath(`/admin/dashboard/events/${eventId}`);
    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    if (existing.slug) {
      revalidatePath(`/events/${existing.slug}`);
      revalidatePath(`/admin/dashboard/events/${existing.slug}`);
      revalidatePath(`/admin/dashboard/events/${existing.slug}/registrations`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to change event status.' };
  }
}

/**
 * Safely delete an event.
 * If the event is NOT CANCELLED and has active registrations, it is marked as CANCELLED first to prevent accidental loss.
 * If the event is ALREADY CANCELLED (or forceDelete is requested), it is PERMANENTLY DELETED along with associated records.
 */
export async function deleteEventAction(
  eventId: string,
  targetCollegeId?: string,
  forceDelete?: boolean
): Promise<{ success: boolean; error?: string; actionTaken?: 'DELETED' | 'CANCELLED' }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    const { data: existing, error: findError } = await db
      .from('events')
      .select('id, title, status')
      .eq('id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (findError || !existing) {
      return { success: false, error: 'Event not found.' };
    }

    const isAlreadyCancelled = existing.status === 'CANCELLED';

    // If not yet cancelled and forceDelete is false, check if registrations exist
    if (!isAlreadyCancelled && !forceDelete) {
      const { count: regCount } = await db
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);

      if ((regCount || 0) > 0) {
        // Archive / cancel rather than deleting
        await db
          .from('events')
          .update({ status: 'CANCELLED', registration_enabled: false })
          .eq('id', eventId)
          .eq('college_id', collegeId);

        await logAudit(
          db,
          { userId: session.userId, email: session.email },
          collegeId,
          'CANCEL_EVENT_ON_DELETE_ATTEMPT',
          'events',
          eventId,
          `Marked event "${existing.title}" as CANCELLED because it already has ${regCount} registration(s). Click delete again to permanently remove.`
        );

        revalidatePath('/admin/dashboard');
        revalidatePath('/admin/dashboard/events');
        return {
          success: true,
          actionTaken: 'CANCELLED',
        };
      }
    }

    // Permanently delete event:
    // First safely clean up child rows if any to ensure no foreign key constraints block deletion
    try {
      await db.from('program_registrations').delete().eq('event_id', eventId).eq('college_id', collegeId);
      await db.from('event_programs').delete().eq('event_id', eventId).eq('college_id', collegeId);
      await db.from('event_categories').delete().eq('event_id', eventId).eq('college_id', collegeId);
      await db.from('event_registrations').delete().eq('event_id', eventId).eq('college_id', collegeId);
    } catch (cleanErr) {
      console.warn('[DELETE_EVENT_CHILD_CLEANUP_WARNING]', cleanErr);
    }

    const { error: delError } = await db
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('college_id', collegeId);

    if (delError) {
      return { success: false, error: delError.message };
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      'DELETE_EVENT',
      'events',
      eventId,
      `Permanently deleted event "${existing.title}".`
    );

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/dashboard/events');
    return { success: true, actionTaken: 'DELETED' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete event.' };
  }
}

/**
 * Verify a student registration payment
 */
export async function verifyRegistrationPaymentAction(
  registrationId: string,
  eventId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    // Verify registration belongs to this event and college
    const { data: reg, error: regError } = await db
      .from('event_registrations')
      .select('id, registration_number, student_name, payment_status')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (regError || !reg) {
      return { success: false, error: 'Registration record not found.' };
    }

    const { error: updateError } = await db
      .from('event_registrations')
      .update({
        payment_status: 'VERIFIED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('college_id', collegeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      'VERIFY_EVENT_PAYMENT',
      'event_registrations',
      registrationId,
      `Verified payment for ${reg.student_name} (${reg.registration_number})`
    );

    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to verify payment.' };
  }
}

/**
 * Reject a student registration payment
 */
export async function rejectRegistrationPaymentAction(
  registrationId: string,
  eventId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    const { data: reg, error: regError } = await db
      .from('event_registrations')
      .select('id, registration_number, student_name')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (regError || !reg) {
      return { success: false, error: 'Registration record not found.' };
    }

    const { error: updateError } = await db
      .from('event_registrations')
      .update({
        payment_status: 'REJECTED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('college_id', collegeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      'REJECT_EVENT_PAYMENT',
      'event_registrations',
      registrationId,
      `Rejected payment for ${reg.student_name} (${reg.registration_number})`
    );

    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reject payment.' };
  }
}

/**
 * Cancel or restore student registration
 */
export async function updateRegistrationStatusAction(
  registrationId: string,
  eventId: string,
  newStatus: EventRegistrationStatus,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    const { data: reg, error: regError } = await db
      .from('event_registrations')
      .select('id, registration_number, student_name, registration_status')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (regError || !reg) {
      return { success: false, error: 'Registration record not found.' };
    }

    const { error: updateError } = await db
      .from('event_registrations')
      .update({
        registration_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('college_id', collegeId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await logAudit(
      db,
      { userId: session.userId, email: session.email },
      collegeId,
      `REGISTRATION_${newStatus}`,
      'event_registrations',
      registrationId,
      `Changed registration status for ${reg.student_name} (${reg.registration_number}) to ${newStatus}`
    );

    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update registration status.' };
  }
}

/**
 * Re-sync / repair Google registration resources for a Small/Cultural Event.
 */
export async function resyncEventGoogleResourcesAction(
  eventId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string; message?: string; resources?: any }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const db = await getAdminDb();

    const { data: rawEvent, error } = await db
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('college_id', collegeId)
      .single();

    if (error || !rawEvent) {
      return { success: false, error: 'Event not found or unauthorized.' };
    }

    const event = enrichEventWithGoogleMetadata(rawEvent);
    const res = await setupAutomatedEventRegistration({
      collegeId,
      eventId,
      eventTitle: event.title,
      eventDescription: event.description || undefined,
      startAt: event.start_at,
      endAt: event.end_at,
      venue: event.venue,
      registrationDeadline: event.registration_deadline || undefined,
      eventSlug: event.slug,
      forceRecreate: false,
    });

    if (!res.success) {
      return { success: false, error: res.message || res.error };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath(`/admin/dashboard/events/${eventId}`);
    revalidatePath(`/admin/dashboard/events/${eventId}/edit`);
    revalidatePath(`/admin/dashboard/events/${eventId}/registrations`);
    return { success: true, message: res.message, resources: res.resources };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resync Google resources.' };
  }
}

/**
 * Fetch live Google Form / Google Sheets participant registrations.
 * Zero database persistence: Google Sheets is the source of truth.
 */
export async function getEventGoogleRegistrationsAction(
  eventId: string,
  bypassCache = false,
  targetCollegeId?: string
): Promise<{
  success: boolean;
  error?: string;
  data?: any[];
  totalCount?: number;
  syncedAt?: string;
  source?: string;
}> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await fetchGoogleFormEventResponses({
      collegeId,
      eventId,
      bypassCache,
    });

    return {
      success: true,
      data: result.responses,
      totalCount: result.totalCount,
      syncedAt: result.syncedAt,
      source: result.source,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch registrations from Google.' };
  }
}
