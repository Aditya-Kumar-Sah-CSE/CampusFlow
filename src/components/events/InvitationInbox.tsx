'use client';

import { useState } from 'react';
import { Bell, Check, CheckCircle2, Clock, X } from 'lucide-react';
import { markInvitationNotificationReadAction, respondToTeamInvitationAction, type MyTeamInvitation } from '@/app/events/invitations/actions';

export function InvitationInbox({ eventId, initialInvitations, initialUnreadCount }: { eventId: string; initialInvitations: MyTeamInvitation[]; initialUnreadCount: number }) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const act = async (id: string, decision: 'ACCEPT' | 'DECLINE') => {
    setBusy(id); setMessage('');
    const result = await respondToTeamInvitationAction(eventId, id, decision);
    setBusy(null);
    if (!result.success) { setMessage(result.error || 'Could not process invitation.'); return; }
    setInvitations(items => items.map(i => i.id === id ? { ...i, status: decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED', unread: false } : i));
    setUnreadCount(n => Math.max(0, n - (invitations.find(i => i.id === id)?.unread ? 1 : 0)));
    setMessage(decision === 'ACCEPT' ? `Invitation accepted. Event Registration: ${result.eventRegistrationNumber || 'verified'}.` : 'Invitation declined.');
  };
  const view = async (inv: MyTeamInvitation) => {
    setExpanded(expanded === inv.id ? null : inv.id);
    if (inv.unread) {
      const result = await markInvitationNotificationReadAction(eventId, inv.id);
      if (result.success) { setInvitations(items => items.map(i => i.id === inv.id ? { ...i, unread: false } : i)); setUnreadCount(n => Math.max(0, n - 1)); }
    }
  };
  const tabs = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'];
  return <div className="space-y-5">
    <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><Bell className="h-5 w-5 text-violet-700"/><div><h2 className="font-bold text-slate-900">Team Invitations</h2><p className="text-xs text-slate-600">{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Your invitation notifications'}</p></div>{unreadCount > 0 && <span className="ml-auto rounded-full bg-violet-700 px-2.5 py-1 text-xs font-bold text-white">{unreadCount}</span>}</div>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {tabs.map(status => {
      const items = invitations.filter(i => i.status === status);
      if (!items.length) return null;
      return <section key={status} className="space-y-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{status === 'PENDING' ? 'Pending' : status.charAt(0) + status.slice(1).toLowerCase()}</h3>
        {items.map(inv => <article key={inv.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${inv.unread ? 'border-violet-300' : 'border-slate-200'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-900">{inv.eventName}</h4>{inv.unread && <span className="h-2 w-2 rounded-full bg-violet-600"/>}</div><p className="text-sm text-slate-700">{inv.programName} · {inv.teamName}</p><p className="mt-1 text-xs text-slate-500">Invited by {inv.leaderName} · {inv.leaderRegistrationNumber}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{status}</span></div>
          <button onClick={() => view(inv)} className="mt-3 text-xs font-bold text-violet-700 hover:underline">{expanded === inv.id ? 'Hide invitation' : 'View invitation'}</button>
          {expanded === inv.id && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3"><p className="text-sm text-slate-600">You are invited to join this team.</p><div><p className="mb-1 text-xs font-bold text-slate-600">Team Members</p><ol className="list-inside list-decimal text-xs text-slate-700">{inv.members.map((member, idx) => <li key={`${member.name}-${idx}`}>{member.name} — {member.role}</li>)}</ol></div>{status === 'PENDING' && <div className="flex flex-wrap gap-2"><button disabled={busy === inv.id} onClick={() => act(inv.id, 'ACCEPT')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5"/>{busy === inv.id ? 'Working…' : 'Accept Invitation'}</button><button disabled={busy === inv.id} onClick={() => act(inv.id, 'DECLINE')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><X className="h-3.5 w-3.5"/>Decline</button><span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500"><Clock className="h-3 w-3"/>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span></div>}{status === 'CANCELLED' && <p className="text-xs text-slate-500">Invitation cancelled.</p>}{status === 'ACCEPTED' && <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5"/>Invitation accepted.</p>}</div>}
        </article>)}
      </section>;
    })}
    {!invitations.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">You don&apos;t have any team invitations.</div>}
  </div>;
}
