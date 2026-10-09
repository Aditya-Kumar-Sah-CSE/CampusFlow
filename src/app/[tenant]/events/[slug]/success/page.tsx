import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug, getMorePublishedEventsForCollege } from '@/lib/events/service';
import { getSmallEventById } from '@/config/events';
import { getCurrentEventSession } from '@/lib/events/event-session';
import {
  CompletionPage,
  SuccessState,
  MoreEvents,
} from '@/components/completion';
import { getStudentSession } from '@/lib/auth/student-auth';
import { EventSuccessPassCard } from '@/components/events/EventSuccessPassCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ tenant: string; slug: string }>;
  searchParams: Promise<{ reg?: string; team?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const smallEvent = getSmallEventById(slug, tenant.slug);
  if (smallEvent) {
    return {
      title: `Registration Successful — ${smallEvent.title}`,
      description: `Your registration for ${smallEvent.title} at ${tenant.name} is confirmed.`,
    };
  }

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

  // 1. Check for Config-Driven Small Event (Google Forms registration)
  const smallEvent = getSmallEventById(slug, tenant.slug);
  if (smallEvent) {
    return (
      <CompletionPage
        collegeName={tenant.name}
        collegeSlug={tenant.slug}
        collegeCode={tenant.shortName || tenant.code}
        collegeLogoUrl={tenant.logo}
      >
        <SuccessState
          type="event"
          title="Registration Successful"
          subtitle={`Your registration for ${smallEvent.title} has been submitted successfully.`}
          entityTitle={smallEvent.title}
          collegeName={tenant.name}
          collegeSlug={tenant.slug}
          collegeCode={tenant.shortName || tenant.code}
          registrationNumber={registrationNumber}
          teamId={teamId}
          hideDefaultActions
        >
          <EventSuccessPassCard
            event={{
              id: smallEvent.id,
              title: smallEvent.title,
              slug: smallEvent.id,
              venue: smallEvent.venue,
              payment_required: (smallEvent as any).payment_required,
              payment_amount: (smallEvent as any).payment_amount,
            }}
            college={{
              name: tenant.name,
              slug: tenant.slug,
              code: tenant.shortName || tenant.code,
              logoUrl: tenant.logo,
            }}
            initialSession={null}
            initialReg={registrationNumber}
            myRegistrationsPath={`/${tenant.slug}/events`}
            moreActionHref={`/${tenant.slug}/events`}
          />
        </SuccessState>
      </CompletionPage>
    );
  }

  // 2. Database Events
  const event = await getPublicEventBySlug(tenant.collegeId, slug);

  // On the success confirmation page, the student has already registered.
  // We only 404 if the event does not exist at all or has been explicitly cancelled.
  if (!event || event.status === 'CANCELLED') {
    notFound();
  }

  const [moreEvents, session, studentSession] = await Promise.all([
    getMorePublishedEventsForCollege(tenant.collegeId, event.id, 4),
    getCurrentEventSession(event.id),
    getStudentSession(),
  ]);

  const myRegistrationsPath = `/${tenant.slug}/events/${event.slug}/my-registrations`;
  const moreActionHref = `/${tenant.slug}/events`;

  return (
    <CompletionPage
      collegeName={tenant.name}
      collegeSlug={tenant.slug}
      collegeCode={tenant.shortName || tenant.code}
      collegeLogoUrl={tenant.logo}
    >
      <SuccessState
        type="event"
        title="Registration Successful"
        subtitle={`Your registration for ${event.title} has been submitted successfully.`}
        entityTitle={event.title}
        collegeName={tenant.name}
        collegeSlug={tenant.slug}
        collegeCode={tenant.shortName || tenant.code}
        registrationNumber={session?.registrationNumber || registrationNumber}
        teamId={teamId}
        hideDefaultActions
      >
        <EventSuccessPassCard
          event={{
            id: event.id,
            title: event.title,
            slug: event.slug,
            venue: event.venue,
            payment_required: event.payment_required,
            payment_amount: event.payment_amount,
          }}
          college={{
            name: tenant.name,
            slug: tenant.slug,
            code: tenant.shortName || tenant.code,
            logoUrl: tenant.logo,
          }}
          initialSession={session}
          initialStudentSession={studentSession}
          initialReg={registrationNumber}
          myRegistrationsPath={myRegistrationsPath}
          moreActionHref={moreActionHref}
        />
      </SuccessState>

      <MoreEvents
        events={moreEvents}
        collegeSlug={tenant.slug}
        collegeName={tenant.name}
      />
    </CompletionPage>
  );
}
