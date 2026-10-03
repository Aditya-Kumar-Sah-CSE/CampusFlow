import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { InvitationInbox } from '@/components/events/InvitationInbox';
import { getMyTeamInvitationsAction } from './actions';
import { getInvitationEvent } from '@/lib/events/invitation-context';

export const dynamic = 'force-dynamic';

export default async function MyInvitationsPage({ searchParams }: { searchParams: Promise<{ eventId?: string }> }) {
  const { eventId } = await searchParams;
  if (!eventId) notFound();
  let event;
  try { event = await getInvitationEvent(eventId); } catch { notFound(); }
  const result = await getMyTeamInvitationsAction(eventId);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <RootPublicNavbar eventId={eventId} />
      <main className="mx-auto max-w-3xl space-y-4 sm:space-y-5 px-3 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/events/${event.slug}/my-registrations`} className="text-xs font-semibold text-slate-500 hover:text-slate-800 shrink-0">
            ← My Event
          </Link>
          <span className="text-xs text-slate-500 truncate">{event.title}</span>
        </div>
        {result.success && result.invitations ? (
          <InvitationInbox eventId={eventId} initialInvitations={result.invitations} initialUnreadCount={result.unreadCount || 0} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 text-xs sm:text-sm text-amber-900">
            {result.error || 'Sign in to your Event Pass to view invitations.'}
            <p className="mt-3">
              <Link className="font-bold underline" href={`/events/${event.slug}/my-registrations`}>
                Verify your Event Registration Number
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
