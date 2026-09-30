import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getPublicProgramBySlug } from '@/lib/events/programs-service';
import { ProgramRegistrationForm } from '@/components/events/programs/ProgramRegistrationForm';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { ArrowLeft, Trophy, Users, User, IndianRupee, Clock, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
    programSlug: string;
  }>;
}

export default async function PublicProgramPage({ params }: Props) {
  const { tenant: rawSlug, slug, programSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const event = await getPublicEventBySlug(tenant.collegeId, slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const program = await getPublicProgramBySlug(event.id, tenant.collegeId, programSlug);
  if (!program) notFound();

  const now = new Date();
  const regOpen = program.registration_open_at ? new Date(program.registration_open_at) : null;
  const regClose = program.registration_close_at ? new Date(program.registration_close_at) : null;
  const isBeforeOpen = regOpen && now < regOpen;
  const isPastDeadline = regClose && now > regClose;
  const canRegister = program.is_active && !isBeforeOpen && !isPastDeadline && event.status === 'PUBLISHED';

  const getParticipationLabel = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return 'Individual';
      case 'TEAM': return 'Team';
      case 'BOTH': return 'Individual / Team';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <span>{tenant.name} &bull; Event Portal</span>
          <Link
            href={`/${tenant.slug}/events/${event.slug}`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Event
          </Link>
        </div>
      </div>

      <PublicTenantNavbar tenant={tenant} currentPage="event-detail" />

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 flex-1 w-full space-y-6">
        {/* Program Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <Link
              href={`/${tenant.slug}/events/${event.slug}`}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-3 h-3" /> {event.title}
            </Link>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-500" />
              {program.category && (
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  {(program.category as unknown as { name: string })?.name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{program.name}</h1>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              {program.participation_type === 'TEAM' ? <Users className="w-3.5 h-3.5 text-purple-500" /> : program.participation_type === 'BOTH' ? <Users className="w-3.5 h-3.5 text-amber-500" /> : <User className="w-3.5 h-3.5 text-blue-500" />}
              {getParticipationLabel(program.participation_type)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
              <IndianRupee className="w-3 h-3" />
              {program.registration_fee > 0 ? program.registration_fee : 'Free'}
            </span>
            {(program.participation_type === 'TEAM' || program.participation_type === 'BOTH') && program.min_team_size && program.max_team_size && (
              <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                {program.min_team_size}–{program.max_team_size} members per team
              </span>
            )}
            {regClose && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <Clock className="w-3 h-3" />
                Deadline: {new Date(regClose).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {(program.registrations_count || 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <Ticket className="w-3 h-3" />
                {program.registrations_count} registered
              </span>
            )}
          </div>

          {/* Description */}
          {program.description && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">About</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{program.description}</p>
            </div>
          )}

          {/* Rules */}
          {program.rules && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Rules & Guidelines</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{program.rules}</p>
            </div>
          )}
        </div>

        {/* Registration Form or Status */}
        {canRegister ? (
          <ProgramRegistrationForm event={event} program={program} tenant={tenant} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">
              {isBeforeOpen ? 'Registration has not opened yet.' :
               isPastDeadline ? 'Registration deadline has passed.' :
               !program.is_active ? 'This program is currently inactive.' :
               'Registration is not available.'}
            </p>
            {regOpen && isBeforeOpen && (
              <p className="text-xs text-slate-500">
                Opens: {new Date(regOpen).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
