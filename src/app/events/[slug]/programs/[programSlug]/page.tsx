import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicEventBySlugGlobal } from '@/lib/events/service';
import { getPublicProgramBySlug } from '@/lib/events/programs-service';
import { getCurrentEventSession } from '@/lib/events/event-session';
import { RootPublicNavbar } from '@/components/layout/RootPublicNavbar';
import { ProgramRegistrationClient } from '@/components/events/programs/ProgramRegistrationClient';
import {
  ArrowLeft,
  Users,
  User,
  Clock,
  CheckCircle,
  QrCode,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    slug: string;
    programSlug: string;
  }>;
}

export default async function PublicProgramDetailsPage({ params }: Props) {
  const { slug, programSlug } = await params;
  const event = await getPublicEventBySlugGlobal(slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  const program = await getPublicProgramBySlug(event.id, event.college_id, programSlug);
  if (!program) notFound();

  const session = await getCurrentEventSession(event.id);

  const now = new Date();
  const regOpen = program.registration_open_at ? new Date(program.registration_open_at) : null;
  const regClose = program.registration_close_at ? new Date(program.registration_close_at) : null;
  const isBeforeOpen = regOpen && now < regOpen;
  const isPastDeadline = regClose && now > regClose;
  const canRegister = program.is_active && !isBeforeOpen && !isPastDeadline && event.status === 'PUBLISHED';

  const isPaid = (event.payment_required || program.registration_fee > 0) && program.registration_fee > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <RootPublicNavbar />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event.title}</span>
          </Link>
        </div>

        {/* Program Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {(program.category as unknown as { name: string })?.name || 'Competition'}
              </span>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {program.participation_type === 'TEAM' ? 'Team Participation' : 'Individual Participation'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {program.name}
            </h1>

            {program.description && (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {program.description}
              </p>
            )}
          </div>

          {/* Key Program Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Participation Type</div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {program.participation_type === 'TEAM' ? (
                  <>
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Team ({program.min_team_size || 1}–{program.max_team_size || 'N/A'} members)</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Individual Entry</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Program Fee</div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                {isPaid ? (
                  <span className="text-emerald-700 font-extrabold">₹{program.registration_fee}</span>
                ) : (
                  <span className="text-emerald-700 font-extrabold">Free Registration</span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-1 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Registration Status</div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {canRegister ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Open
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Closed / Ended
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rules Section */}
          {program.rules && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Program Rules &amp; Guidelines</h2>
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {program.rules}
              </div>
            </div>
          )}

          {/* Payment Info Section (If Paid & Configured) */}
          {isPaid && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Payment Information</span>
              </h2>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Participation Fee:</span>
                  <span className="font-bold text-slate-900">₹{program.registration_fee}</span>
                </div>
                {event.payment_upi_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">College UPI ID:</span>
                    <span className="font-mono font-bold text-blue-700">{event.payment_upi_id}</span>
                  </div>
                )}
                {event.payment_instructions && (
                  <div className="pt-1 text-slate-600">
                    {event.payment_instructions}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Program Registration Entry Section */}
        {canRegister ? (
          <section id="register" className="pt-2">
            <ProgramRegistrationClient
              event={event}
              program={program}
              initialSession={session}
            />
          </section>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">
              {isBeforeOpen
                ? 'Registration has not opened yet.'
                : isPastDeadline
                ? 'Registration deadline has passed.'
                : !program.is_active
                ? 'This program is currently inactive.'
                : 'Registration is not available.'}
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
        <div className="max-w-4xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {event.college?.name || 'College'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
