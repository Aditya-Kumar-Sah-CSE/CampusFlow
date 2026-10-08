import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getCollegeExams } from '@/lib/exams/exam-service';
import { ExamsManagementTab } from '@/components/admin/tabs/ExamsManagementTab';

export const dynamic = 'force-dynamic';

export default async function AdminExamsPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    redirect('/admin/login');
  }

  const collegeId = session.activeCollegeId;
  if (!collegeId) {
    redirect('/admin/dashboard');
  }

  const { exams } = await getCollegeExams(collegeId);

  return (
    <div className="space-y-6">
      <ExamsManagementTab initialExams={exams} collegeId={collegeId} />
    </div>
  );
}
