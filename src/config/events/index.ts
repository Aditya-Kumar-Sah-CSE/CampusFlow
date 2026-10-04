import { bceEvents } from './bce-bgp';
import { gecEvents } from './gec-gaya';
import type { SmallEvent } from './types';

export * from './types';
export { bceEvents } from './bce-bgp';
export { gecEvents } from './gec-gaya';

export interface InstitutionEventGroup {
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  institutionCode: string;
  events: SmallEvent[];
}

const INSTITUTION_METADATA: Record<string, { name: string; slug: string; code: string }> = {
  'bce-bgp': {
    name: 'Bhagalpur College of Engineering',
    slug: 'bce-bgp',
    code: 'BCE-BGP',
  },
  'gec-gaya': {
    name: 'Government Engineering College, Gaya',
    slug: 'gec-gaya',
    code: 'GEC-GAYA',
  },
};

/**
 * Returns all small events configured for a given institution / tenant slug.
 * Example: 'bce-bgp' -> only BCE-BGP events. 'gec-gaya' -> only GEC-GAYA events.
 * Strictly guarantees tenant isolation.
 */
export function getEventsForTenant(tenantSlug: string): SmallEvent[] {
  const normalized = (tenantSlug || '').trim().toLowerCase();
  if (normalized === 'bce-bgp') {
    return bceEvents;
  }
  if (normalized === 'gec-gaya') {
    return gecEvents;
  }
  return [];
}

/**
 * Returns all configured small events across all institutions.
 */
export function getAllSmallEvents(): SmallEvent[] {
  return [...bceEvents, ...gecEvents];
}

/**
 * Finds a small event by its ID.
 * Optionally verifies institutionId to maintain strict tenant boundaries.
 */
export function getSmallEventById(id: string, institutionId?: string): SmallEvent | undefined {
  const all = getAllSmallEvents();
  const match = all.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!match) return undefined;
  if (institutionId) {
    const normalizedInst = institutionId.trim().toLowerCase();
    if (match.institutionId.toLowerCase() !== normalizedInst) {
      return undefined;
    }
  }
  return match;
}

/**
 * Returns small events grouped by active institution for the global directory page (/events).
 */
export function getSmallEventsGroupedByInstitution(): InstitutionEventGroup[] {
  return [
    {
      institutionId: 'bce-bgp',
      institutionName: INSTITUTION_METADATA['bce-bgp'].name,
      institutionSlug: INSTITUTION_METADATA['bce-bgp'].slug,
      institutionCode: INSTITUTION_METADATA['bce-bgp'].code,
      events: bceEvents,
    },
    {
      institutionId: 'gec-gaya',
      institutionName: INSTITUTION_METADATA['gec-gaya'].name,
      institutionSlug: INSTITUTION_METADATA['gec-gaya'].slug,
      institutionCode: INSTITUTION_METADATA['gec-gaya'].code,
      events: gecEvents,
    },
  ];
}
