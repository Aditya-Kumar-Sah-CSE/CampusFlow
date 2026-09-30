'use client';

import { useState } from 'react';
import { respondToTeamInvitationAction } from '@/app/events/invitations/actions';

export function InvitationResponse({ token, eventSlug, invitedEmail, state }: { token: string; eventSlug: string; invitedEmail: string; state: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(state !== 'PENDING');
  const respond = async (decision: 'ACCEPT' | 'REJECT') => {
    setBusy(true); setMessage('');
    const result = await respondToTeamInvitationAction(token, decision);
    setBusy(false);
    if (result.success) { setFinished(true); setMessage(decision === 'ACCEPT' ? 'Invitation accepted. You have joined the team.' : 'Invitation rejected successfully.'); }
    else setMessage(result.error || 'Could not process invitation.');
  };
  if (state === 'EXPIRED') return <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">This invitation has expired.</p>;
  if (state === 'ACCEPTED') return <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">This invitation has already been accepted.</p>;
  if (state === 'REJECTED') return <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">This invitation was rejected.</p>;
  if (state === 'CANCELLED') return <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">This invitation is no longer active.</p>;
  return <div className="space-y-3">
    <p className="text-sm text-slate-600">Accept using the event account registered to <strong>{invitedEmail}</strong>. If you are not registered for the event yet, complete event registration and sign in first.</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy || finished} onClick={() => respond('ACCEPT')} className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Working…' : 'Accept Invitation'}</button><button disabled={busy || finished} onClick={() => respond('REJECT')} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Reject Invitation</button></div>
    {message && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">{message}</p>}
    {!finished && <p className="text-xs text-slate-500">Verify your event registration here: <a className="font-semibold text-violet-700 underline" href={`/events/${eventSlug}/my-registrations`}>My event registrations</a></p>}
  </div>;
}
