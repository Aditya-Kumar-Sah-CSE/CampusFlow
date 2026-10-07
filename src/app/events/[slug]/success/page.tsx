import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicEventBySlugGlobal, getMorePublishedEventsForCollege } from '@/lib/events/service';
import {
  CompletionPage,
  SuccessState,
  MoreEvents,
} from '@/components/completion';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reg?: string; team?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
  return {
    title: event ? `Registration Successful — ${event.title}` : 'Registration Successful',
    description: event ? `Your registration for ${event.title} is confirmed.` : undefined,
  };
}

export default async function EventSuccessPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { reg: registrationNumber, team: teamId } = await searchParams;

  const event = await getPublicEventBySlugGlobal(slug);
  if (!event || event.status !== 'PUBLISHED') {
    notFound();
  }

  const college = event.college;
  const moreEvents = await getMorePublishedEventsForCollege(event.college_id, event.id, 4);

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
        registrationNumber={registrationNumber}
        teamId={teamId}
        myRegistrationsPath={myRegistrationsPath}
        moreActionHref={moreActionHref}
      />

      <MoreEvents
        events={moreEvents}
        collegeSlug={college?.slug}
        collegeName={college?.name}
      />
    </CompletionPage>
  );
}
