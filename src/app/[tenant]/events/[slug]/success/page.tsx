import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug, getMorePublishedEventsForCollege } from '@/lib/events/service';
import {
  CompletionPage,
  SuccessState,
  MoreEvents,
} from '@/components/completion';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ tenant: string; slug: string }>;
  searchParams: Promise<{ reg?: string; team?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);
  const event = await getPublicEventBySlug(tenant.collegeId, slug);
  return {
    title: event ? `Registration Successful — ${event.title}` : 'Registration Successful',
    description: event ? `Your registration for ${event.title} at ${tenant.name} is confirmed.` : undefined,
  };
}

export default async function TenantEventSuccessPage({ params, searchParams }: Props) {
  const { tenant: rawSlug, slug } = await params;
  const { reg: registrationNumber, team: teamId } = await searchParams;

  const tenant = await resolveTenantOrNotFound(rawSlug);
  const event = await getPublicEventBySlug(tenant.collegeId, slug);

  if (!event || event.status !== 'PUBLISHED') {
    notFound();
  }

  const moreEvents = await getMorePublishedEventsForCollege(tenant.collegeId, event.id, 4);

  const myRegistrationsPath = `/${tenant.slug}/events/${event.slug}/my-registrations`;
  const moreActionHref = `/${tenant.slug}/events`;

  return (
    <CompletionPage
      collegeName={tenant.name}
      collegeSlug={tenant.slug}
      collegeLogoUrl={tenant.logo}
    >
      <SuccessState
        type="event"
        title="Registration Successful"
        subtitle={`Your registration for ${event.title} has been submitted successfully.`}
        entityTitle={event.title}
        collegeName={tenant.name}
        collegeSlug={tenant.slug}
        registrationNumber={registrationNumber}
        teamId={teamId}
        myRegistrationsPath={myRegistrationsPath}
        moreActionHref={moreActionHref}
      />

      <MoreEvents
        events={moreEvents}
        collegeSlug={tenant.slug}
        collegeName={tenant.name}
      />
    </CompletionPage>
  );
}
