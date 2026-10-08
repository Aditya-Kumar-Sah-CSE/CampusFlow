import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getExamResultsDashboard } from '@/lib/exams/exam-service';
import { ExamResultsConsole } from '@/components/admin/exams/ExamResultsConsole';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminExamResultsPage({ params }: Props) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const collegeId = session.activeCollegeId;
  if (!collegeId) {
    redirect('/admin/dashboard');
  }

  const dashboardData = await getExamResultsDashboard(id, collegeId);

  return (
    <div className="py-2">
      <ExamResultsConsole data={dashboardData as any} collegeId={collegeId} />
    </div>
  );
}
