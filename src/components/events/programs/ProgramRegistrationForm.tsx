'use client';

import React from 'react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram } from '@/types/programs';
import type { TenantContext } from '@/types/tenant';
import type { EventSessionPayload } from '@/lib/events/event-session';
import { ProgramRegistrationClient } from './ProgramRegistrationClient';

interface Props {
  event: CollegeEvent;
  program: EventProgram;
  tenant: TenantContext;
  initialSession?: EventSessionPayload | null;
}

/**
 * ProgramRegistrationForm (Delegates directly to verified, read-only ProgramRegistrationClient)
 * Enforces single event registration per student architecture.
 */
export function ProgramRegistrationForm({
  event,
  program,
  tenant,
  initialSession = null,
}: Props) {
  return (
    <ProgramRegistrationClient
      event={event}
      program={program}
      initialSession={initialSession}
      tenantSlug={tenant.slug}
    />
  );
}
