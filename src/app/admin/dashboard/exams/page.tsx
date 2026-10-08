import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin-auth';
import { getCollegeExams } from '@/lib/exams/exam-service';
import { ExamsManagementTab } from '@/components/admin/tabs/ExamsManagementTab';

export const dynamic = 'force-dynamic';

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    subtab?: string;
    status?: string;
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const rawSubTab = typeof resolvedParams.subtab === 'string'
    ? resolvedParams.subtab
    : typeof resolvedParams.status === 'string'
      ? resolvedParams.status
      : undefined;

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
      <ExamsManagementTab
        initialExams={exams}
        collegeId={collegeId}
        initialSubTab={rawSubTab}
      />
    </div>
  );
}
