import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicEventBySlugGlobal, getMorePublishedEventsForCollege } from '@/lib/events/service';
import { getSmallEventById } from '@/config/events';
import { getCurrentEventSession } from '@/lib/events/event-session';
import {
  CompletionPage,
  SuccessState,
  MoreEvents,
} from '@/components/completion';
import { EventSuccessPassCard } from '@/components/events/EventSuccessPassCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reg?: string; team?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const smallEvent = getSmallEventById(slug);
  if (smallEvent) {
    return {
      title: `Registration Successful — ${smallEvent.title}`,
      description: `Your registration for ${smallEvent.title} is confirmed.`,
    };
  }

  const event = await getPublicEventBySlugGlobal(slug);
  return {
    title: event ? `Registration Successful — ${event.title}` : 'Registration Successful',
    description: event ? `Your registration for ${event.title} is confirmed.` : undefined,
  };
}

export default async function EventSuccessPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { reg: registrationNumber, team: teamId } = await searchParams;

  // 1. Check for Config-Driven Small Event
  const smallEvent = getSmallEventById(slug);
  if (smallEvent) {
    const institutionDisplayName =
      smallEvent.institutionId === 'bce-bgp'
        ? 'Bhagalpur College of Engineering'
        : smallEvent.institutionId === 'gec-gaya'
        ? 'Government Engineering College, Gaya'
        : smallEvent.organizer;

    return (
      <CompletionPage
        collegeName={institutionDisplayName}
        collegeSlug={smallEvent.institutionId}
        collegeCode={smallEvent.institutionId.toUpperCase()}
      >
        <SuccessState
          type="event"
          title="Registration Successful"
          subtitle={`Your registration for ${smallEvent.title} has been submitted successfully.`}
          entityTitle={smallEvent.title}
          collegeName={institutionDisplayName}
          collegeSlug={smallEvent.institutionId}
          collegeCode={smallEvent.institutionId.toUpperCase()}
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
            }}
            college={{
              name: institutionDisplayName,
              slug: smallEvent.institutionId,
              code: smallEvent.institutionId.toUpperCase(),
            }}
            initialSession={null}
            initialReg={registrationNumber}
            myRegistrationsPath="/events"
            moreActionHref="/events"
          />
        </SuccessState>
      </CompletionPage>
    );
  }

  // 2. Database Events
  const event = await getPublicEventBySlugGlobal(slug);
  if (!event || event.status === 'CANCELLED') {
    notFound();
  }

  const college = event.college;
  const [moreEvents, session] = await Promise.all([
    getMorePublishedEventsForCollege(event.college_id, event.id, 4),
    getCurrentEventSession(event.id),
  ]);

  const myRegistrationsPath = college?.slug
    ? `/${college.slug}/events/${event.slug}/my-registrations`
    : `/events/${event.slug}/my-registrations`;

  const moreActionHref = college?.slug
    ? `/${college.slug}/events`
    : '/events';

  return (
    <CompletionPage
      collegeName={college?.name}
      collegeSlug={college?.slug}
      collegeCode={college?.code}
      collegeLogoUrl={college?.logo_url}
    >
      <SuccessState
        type="event"
        title="Registration Successful"
        subtitle={`Your registration for ${event.title} has been submitted successfully.`}
        entityTitle={event.title}
        collegeName={college?.name}
        collegeSlug={college?.slug}
        collegeCode={college?.code}
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
          }}
          college={{
            name: college?.name || 'College Event',
            slug: college?.slug || 'events',
            code: college?.code,
            logoUrl: college?.logo_url,
          }}
          initialSession={session}
          initialReg={registrationNumber}
          myRegistrationsPath={myRegistrationsPath}
          moreActionHref={moreActionHref}
        />
      </SuccessState>

      <MoreEvents
        events={moreEvents}
        collegeSlug={college?.slug}
        collegeName={college?.name}
      />
    </CompletionPage>
  );
}
