import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getAttemptResult } from '@/lib/exams/exam-attempt-service';
import { StudentResultView } from '@/components/exams/StudentResultView';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    id: string;
    attemptId: string;
  }>;
}

export default async function PublicTenantExamResultPage({ params }: Props) {
  const { tenant: rawSlug, id, attemptId } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  let resultData;
  try {
    resultData = await getAttemptResult(attemptId);
  } catch (err) {
    notFound();
  }

  if (!resultData || resultData.attempt.college_id !== tenant.collegeId) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            <span className="truncate">{tenant.name} &bull; Examination Transcript</span>
          </div>
          <Link
            href={`/${tenant.slug}/exams`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> Examination Portal
          </Link>
        </div>
      </div>

      <PublicTenantNavbar tenant={tenant} currentPage="exam-detail" />

      <main className="flex-1 py-6">
        <StudentResultView resultData={resultData} tenantSlug={tenant.slug} />
      </main>

      <CollegePublicFooter
        collegeName={tenant.name}
        collegeShortName={tenant.shortName}
        collegeSlug={tenant.slug}
        websiteUrl={tenant.websiteUrl}
      />
    </div>
  );
}
