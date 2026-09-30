import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEventRegistrationSpreadsheet } from '@/lib/google/event-registration-sheets';

export interface EventRegistrationContext {
  id: string;
  college_id: string;
  title: string;
  slug: string;
  status: string;
  registration_enabled: boolean;
  registration_start: string | null;
  registration_end: string | null;
  payment_required: boolean;
  payment_amount: number;
  registration_sheet_id: string | null;
}

/**
 * Canonical server-side event configuration and registration-sheet resolver.
 * This helper is read-only: it will reuse a configured sheet or discover the
 * existing college Drive spreadsheet, but never creates one.
 */
export async function getEventWithCollege(eventId: string): Promise<EventRegistrationContext> {
  const db = createAdminClient();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');

  const columnsWithSheet = 'id,college_id,title,slug,status,registration_enabled,registration_start,registration_end,payment_required,payment_amount,registration_sheet_id';
  const columnsWithoutSheet = 'id,college_id,title,slug,status,registration_enabled,registration_start,registration_end,payment_required,payment_amount';

  let { data, error } = await db.from('events').select(columnsWithSheet).eq('id', eventId).maybeSingle();
  if (error?.code === '42703') {
    ({ data, error } = await db.from('events').select(columnsWithoutSheet).eq('id', eventId).maybeSingle());
  }

  if (error) {
    console.error('[EventContext] Event query failed:', error.code, error.message);
    throw new Error(error.code === '42703' ? 'EVENT_SCHEMA_UNAVAILABLE' : 'EVENT_LOOKUP_FAILED');
  }
  if (!data) throw new Error('EVENT_NOT_FOUND');

  const event = data as Omit<EventRegistrationContext, 'registration_sheet_id'> & { registration_sheet_id?: string | null };
  let sheetId: string | null = null;
  try {
    sheetId = await resolveEventRegistrationSpreadsheet(
      event.college_id,
      event.id,
      event.title,
      { createIfMissing: false }
    );
  } catch (error) {
    console.warn('[EventContext] Existing registration spreadsheet could not be resolved:', error);
  }

  return { ...event, registration_sheet_id: sheetId };
}
