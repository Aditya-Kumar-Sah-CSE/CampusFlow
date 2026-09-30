import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminProgramById, getProgramStats } from '@/lib/events/programs-service';
import { getAdminProgramRegistrations } from '@/lib/events/program-registrations-service';
import { ArrowLeft, Download, Users, UserCheck, IndianRupee, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; programId: string }>;
}

export default async function AdminProgramRegistrationsPage({ params }: Props) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const { id: eventId, programId } = await params;
  const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
  if (!collegeId) redirect('/admin/dashboard');

  const event = await getAdminEventById(eventId, collegeId);
  if (!event) notFound();

  const program = await getAdminProgramById(programId, collegeId);
  if (!program) notFound();

  const [registrations, stats] = await Promise.all([
    getAdminProgramRegistrations({ programId: program.id, collegeId }),
    getProgramStats(program.id, collegeId),
  ]);

  const isPaid = event.payment_required && program.registration_fee > 0;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={`/admin/dashboard/events/${event.id}/registrations`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Event Registrations
          </Link>
          <h1 className="text-lg font-bold text-slate-900">{program.name} — Registrations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {event.title} • {program.participation_type} • {isPaid ? `₹${program.registration_fee}` : 'Free'}
          </p>
        </div>

        <a
          href={`/api/admin/events/${event.id}/programs/${program.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Total Registrations</p>
          <p className="text-xl font-bold text-slate-900">{stats.totalRegistrations}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Participants</p>
          <p className="text-xl font-bold text-slate-900">{stats.totalParticipants}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Teams</p>
          <p className="text-xl font-bold text-slate-900">{stats.totalTeams}</p>
        </div>
        {isPaid && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-bold text-emerald-700">₹{stats.totalRevenue.toLocaleString('en-IN')}</p>
          </div>
        )}
      </div>

      {/* Registrations Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">#</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Reg No.</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Student ID</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Type</th>
                {program.participation_type === 'TEAM' && (
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Team</th>
                )}
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Branch</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Semester</th>
                {isPaid && (
                  <>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Payment</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Ref</th>
                  </>
                )}
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-400 font-medium"
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No registrations yet
                  </td>
                </tr>
              ) : (
                registrations.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono font-medium text-slate-800">
                      {r.registration_number}
                    </td>
                    <td className="px-3 py-2 text-slate-900 font-medium">
                      {r.participant_name}
                      {r.team_role === 'LEADER' && (
                        <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-semibold">
                          LEADER
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{r.student_id || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        r.registration_type === 'TEAM'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {r.registration_type}
                      </span>
                    </td>
                    {program.participation_type === 'TEAM' && (
                      <td className="px-3 py-2 text-slate-600">{r.team_name || '—'}</td>
                    )}
                    <td className="px-3 py-2 text-slate-600">{r.branch || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.semester || '—'}</td>
                    {isPaid && (
                      <>
                        <td className="px-3 py-2">
                          {r.payment_status === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          ) : r.payment_status === 'SUBMITTED' ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3" /> Submitted
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {r.payment_status || 'Pending'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">
                          {r.payment_reference || '—'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        r.registration_status === 'REGISTERED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.registration_status === 'CANCELLED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.registration_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
