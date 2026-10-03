import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { MasterRegistrationRow } from '@/lib/google/event-registration-sheets';

async function getDb() {
  return createAdminClient() || (await createClient());
}

export interface CanonicalEventStats {
  available: boolean;
  error?: string;
  totalEnrolled: number; // Real number of registered participants for that event (including team members)
  totalRegistrations: number; // Real registration count (each team = 1 registration, each individual = 1 registration)
  teamsCount: number;
  individualCount: number;
  paymentPending: number;
  paymentVerified: number;
  paymentRejected: number;
  availableSeats: number | null;
  maxCapacity: number | null;
}

/**
 * Pure counting function to compute canonical event registration statistics from Google Sheet rows.
 * Reused across Events Directory, registration dashboard, PDF exports, and stats APIs.
 *
 * Rules:
 * 1. Cancelled/rejected registrations are excluded.
 * 2. Team registrations:
 *    - Each distinct team in a program counts as 1 registration.
 *    - Each team member row represents an enrolled participant.
 *    - Participants are counted accurately, never accidentally counting only teams as participants.
 * 3. Individual registrations count as 1 registration and 1 enrolled participant.
 * 4. Standalone event registrations (without program assignment) are properly aggregated.
 */
export function computeCanonicalStatsFromRows(
  sheetRows: MasterRegistrationRow[],
  maxCapacity: number | null
): CanonicalEventStats {
  // 1. Filter out cancelled or rejected registrations
  const validRows = sheetRows.filter(
    (r) => r.registrationStatus !== 'CANCELLED' && r.registrationStatus !== 'REJECTED'
  );

  // 2. Separate program rows vs base event rows
  const progRows = validRows.filter((r) => Boolean(r.programId || r.programName));
  const baseRows = validRows.filter((r) => !r.programId && !r.programName);

  let totalEnrolled = 0;
  let totalRegistrations = 0;
  let teamsCount = 0;
  let individualCount = 0;
  let paymentPending = 0;
  let paymentVerified = 0;
  let paymentRejected = 0;

  if (progRows.length > 0) {
    // Event has program registrations (e.g. competitions, hackathons, workshops)
    const uniqueTeams = new Set<string>();
    let progIndividualCount = 0;

    for (const r of progRows) {
      const isTeam = r.participationType === 'TEAM' || Boolean(r.teamId);
      if (isTeam) {
        const progIdentifier = (r.programId || r.programName || 'PROG').trim().toUpperCase();
        const teamIdentifier = (r.teamId || r.teamName || 'TEAM').trim().toUpperCase();
        uniqueTeams.add(`${progIdentifier}__${teamIdentifier}`);
      } else {
        progIndividualCount++;
      }

      // Payment counts
      if (r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED') paymentPending++;
      if (r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'PAID') paymentVerified++;
      if (r.paymentStatus === 'REJECTED') paymentRejected++;
    }

    teamsCount = uniqueTeams.size;
    individualCount = progIndividualCount;

    // Detect standalone base event registrations that are not linked to any program
    const progStudentEmails = new Set(
      progRows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean)
    );
    const progStudentIds = new Set(
      progRows.map((r) => r.studentId?.trim().toUpperCase()).filter(Boolean)
    );

    const standaloneBaseRows = baseRows.filter(
      (r) =>
        !progStudentEmails.has(r.email?.trim().toLowerCase()) &&
        !progStudentIds.has(r.studentId?.trim().toUpperCase())
    );

    for (const r of standaloneBaseRows) {
      if (r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED') paymentPending++;
      if (r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'PAID') paymentVerified++;
      if (r.paymentStatus === 'REJECTED') paymentRejected++;
    }

    individualCount += standaloneBaseRows.length;

    // Real number of registered participants for that event:
    // Every member in every team + every individual program participant + standalone base participants
    totalEnrolled = progRows.length + standaloneBaseRows.length;

    // Real registration count:
    // Number of teams + number of individual program registrations + standalone base registrations
    totalRegistrations = uniqueTeams.size + progIndividualCount + standaloneBaseRows.length;
  } else {
    // Event without programs (direct event-level registrations):
    const uniqueBaseTeams = new Set<string>();
    let baseIndividualCount = 0;

    for (const r of baseRows) {
      const isTeam = r.participationType === 'TEAM' || Boolean(r.teamId);
      if (isTeam) {
        const teamIdentifier = (r.teamId || r.teamName || 'TEAM').trim().toUpperCase();
        uniqueBaseTeams.add(teamIdentifier);
      } else {
        baseIndividualCount++;
      }

      if (r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED') paymentPending++;
      if (r.paymentStatus === 'VERIFIED' || r.paymentStatus === 'PAID') paymentVerified++;
      if (r.paymentStatus === 'REJECTED') paymentRejected++;
    }

    teamsCount = uniqueBaseTeams.size;
    individualCount = baseIndividualCount;
    totalEnrolled = baseRows.length;
    totalRegistrations = uniqueBaseTeams.size + baseIndividualCount;
  }

  const availableSeats =
    maxCapacity !== null ? Math.max(0, maxCapacity - totalEnrolled) : null;

  return {
    available: true,
    totalEnrolled,
    totalRegistrations,
    teamsCount,
    individualCount,
    paymentPending,
    paymentVerified,
    paymentRejected,
    availableSeats,
    maxCapacity,
  };
}

/**
 * Fetch and compute canonical statistics for a single event directly from Google Sheets.
 * Strictly verifies collegeId ownership. Never returns fake static 0 if Google Sheets is unavailable.
 */
export async function getCanonicalEventStats(
  collegeId: string,
  eventId: string,
  preloadedEvent?: {
    id: string;
    title: string;
    max_capacity: number | null;
    registration_sheet_id: string | null;
  }
): Promise<CanonicalEventStats> {
  try {
    let event = preloadedEvent;
    if (!event) {
      const db = await getDb();
      const { data, error } = await db
        .from('events')
        .select('id, title, max_capacity, registration_sheet_id')
        .eq('id', eventId)
        .eq('college_id', collegeId)
        .maybeSingle();

      if (error || !data) {
        return {
          available: false,
          error: 'Event not found or unauthorized for this institution.',
          totalEnrolled: 0,
          totalRegistrations: 0,
          teamsCount: 0,
          individualCount: 0,
          paymentPending: 0,
          paymentVerified: 0,
          paymentRejected: 0,
          availableSeats: null,
          maxCapacity: null,
        };
      }
      event = data;
    }

    // Google Sheets is the source of truth for registrations
    let resolvedSheetId: string | null = event.registration_sheet_id || null;
    if (!resolvedSheetId) {
      try {
        const { resolveEventRegistrationSpreadsheet } = await import(
          '@/lib/google/event-registration-sheets'
        );
        resolvedSheetId = await resolveEventRegistrationSpreadsheet(
          collegeId,
          event.id,
          event.title
        );
      } catch (err: any) {
        console.warn(`[getCanonicalEventStats] Failed to resolve spreadsheet for event ${event.id}:`, err?.message || err);
      }
    }

    if (!resolvedSheetId) {
      return {
        available: false,
        error: 'Registration spreadsheet not connected.',
        totalEnrolled: 0,
        totalRegistrations: 0,
        teamsCount: 0,
        individualCount: 0,
        paymentPending: 0,
        paymentVerified: 0,
        paymentRejected: 0,
        availableSeats: event.max_capacity ?? null,
        maxCapacity: event.max_capacity ?? null,
      };
    }

    const { getEventRegistrations } = await import(
      '@/lib/google/event-registration-sheets'
    );
    const sheetRows = await getEventRegistrations(collegeId, resolvedSheetId);

    return computeCanonicalStatsFromRows(sheetRows, event.max_capacity);
  } catch (err: any) {
    console.warn(`[getCanonicalEventStats] Google Sheets error for event ${eventId}:`, err?.message || err);
    return {
      available: false,
      error: err?.message || 'Registration data unavailable',
      totalEnrolled: 0,
      totalRegistrations: 0,
      teamsCount: 0,
      individualCount: 0,
      paymentPending: 0,
      paymentVerified: 0,
      paymentRejected: 0,
      availableSeats: preloadedEvent?.max_capacity ?? null,
      maxCapacity: preloadedEvent?.max_capacity ?? null,
    };
  }
}

/**
 * Batch resolve canonical registration statistics for multiple events in parallel.
 * Tolerant to individual Google Sheet errors so one failing sheet doesn't break the entire list.
 */
export async function getCanonicalEventsBatchStats(
  collegeId: string,
  events: Array<{
    id: string;
    title: string;
    max_capacity: number | null;
    registration_sheet_id: string | null;
  }>
): Promise<Record<string, CanonicalEventStats>> {
  const results: Record<string, CanonicalEventStats> = {};

  const settled = await Promise.allSettled(
    events.map(async (ev) => {
      const stats = await getCanonicalEventStats(collegeId, ev.id, ev);
      return { id: ev.id, stats };
    })
  );

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results[ev.id] = outcome.value.stats;
    } else {
      results[ev.id] = {
        available: false,
        error: outcome.reason?.message || 'Registration data unavailable',
        totalEnrolled: 0,
        totalRegistrations: 0,
        teamsCount: 0,
        individualCount: 0,
        paymentPending: 0,
        paymentVerified: 0,
        paymentRejected: 0,
        availableSeats: ev.max_capacity ?? null,
        maxCapacity: ev.max_capacity ?? null,
      };
    }
  }

  return results;
}
