import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEventRegistrationSpreadsheet } from '@/lib/google/event-registration-sheets';

export async function getInvitationEvent(eventId: string) {
  const db = createAdminClient();
  if (!db) throw new Error('Database unavailable.');
  const { data, error } = await db.from('events').select('id,college_id,title,slug,status,registration_enabled,registration_start,registration_end,payment_required,payment_amount,registration_sheet_id').eq('id', eventId).maybeSingle();
  if (error || !data) throw new Error('Event not found.');
  if (!data.registration_sheet_id) {
    data.registration_sheet_id = await resolveEventRegistrationSpreadsheet(data.college_id, data.id, data.title).catch(() => null);
  }
  return data;
}

export async function getInvitationProgram(programId: string, collegeId: string) {
  const db = createAdminClient();
  if (!db) throw new Error('Database unavailable.');
  const { data, error } = await db.from('event_programs').select('*').eq('id', programId).eq('college_id', collegeId).maybeSingle();
  if (error || !data) throw new Error('Program not found.');
  return data;
}
