import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEventWithCollege } from '@/lib/events/event-context';
import { isCollegeGoogleConfigured } from '@/lib/google/auth';

export async function getInvitationEvent(eventId: string) {
  const event = await getEventWithCollege(eventId);
  if (!event.registration_sheet_id) {
    const connected = await isCollegeGoogleConfigured(event.college_id).catch(() => false);
    throw new Error(connected ? 'REGISTRATION_SHEET_NOT_FOUND' : 'GOOGLE_CONNECTION_REQUIRED');
  }
  return event;
}

export async function getInvitationProgram(programId: string, collegeId: string) {
  const db = createAdminClient();
  if (!db) throw new Error('Database unavailable.');
  const { data, error } = await db.from('event_programs').select('*').eq('id', programId).eq('college_id', collegeId).maybeSingle();
  if (error) throw new Error('PROGRAM_LOOKUP_FAILED');
  if (!data) throw new Error('PROGRAM_NOT_FOUND');
  return data;
}
