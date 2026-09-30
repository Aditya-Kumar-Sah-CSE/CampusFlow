import { redirect, notFound } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getAdminEventById } from '@/lib/events/service';
import { getAdminProgramById, getProgramStats } from '@/lib/events/programs-service';
import { getAdminProgramRegistrations } from '@/lib/events/program-registrations-service';
import { ProgramRegistrationsClient } from '@/components/admin/events/programs/ProgramRegistrationsClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; programId: string }>;
}

export default async function ProgramRegistrationsPage({ params }: Props) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const { id, programId } = await params;
  const collegeId = session.activeCollegeId || session.colleges[0]?.collegeId;
  if (!collegeId) redirect('/admin/dashboard');

  const event = await getAdminEventById(id, collegeId);
  if (!event) notFound();

  const program = await getAdminProgramById(programId, collegeId);
  if (!program) notFound();

  const [registrations, stats] = await Promise.all([
    getAdminProgramRegistrations({ programId: program.id, collegeId }),
    getProgramStats(program.id, collegeId),
  ]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <ProgramRegistrationsClient
        event={event}
        program={program}
        registrations={registrations}
        stats={stats}
        activeCollegeId={collegeId}
      />
    </div>
  );
}
