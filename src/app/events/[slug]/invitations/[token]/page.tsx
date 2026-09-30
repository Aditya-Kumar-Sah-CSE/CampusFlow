import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { InvitationResponse } from '@/components/events/InvitationResponse';
import { getInvitationDetailsAction } from '@/app/events/invitations/actions';

export const dynamic = 'force-dynamic';

export default async function TeamInvitationPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const invitation = await getInvitationDetailsAction(token);
  if (!invitation.success) notFound();
  if (invitation.eventSlug !== slug) notFound();
  return <div className="min-h-screen bg-slate-50 text-slate-800"><RootPublicNavbar /><main className="mx-auto max-w-xl px-4 py-12">
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div><p className="text-xs font-bold uppercase tracking-widest text-violet-700">Team invitation</p><h1 className="mt-2 text-2xl font-bold text-slate-950">You have been invited to join</h1></div>
      <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><dt className="text-xs text-slate-500">Event</dt><dd className="font-semibold">{invitation.event}</dd></div><div><dt className="text-xs text-slate-500">Program</dt><dd className="font-semibold">{invitation.program}</dd></div><div><dt className="text-xs text-slate-500">Team</dt><dd className="font-semibold">{invitation.team}</dd></div><div><dt className="text-xs text-slate-500">Invited by</dt><dd className="font-semibold">{invitation.leader}</dd></div></dl>
      {invitation.state === 'CLOSED' ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Team registration is now closed.</p> : <InvitationResponse token={token} eventSlug={slug} invitedEmail={invitation.invitedEmail || ''} state={invitation.state || 'PENDING'} />}
      <p className="text-center text-xs text-slate-500">Invitation links are single-use and expire after seven days.</p>
    </div><div className="mt-5 text-center"><Link className="text-sm font-semibold text-violet-700 hover:underline" href={`/events/${slug}/my-registrations`}>Open event registration and identity verification</Link></div>
  </main></div>;
}
