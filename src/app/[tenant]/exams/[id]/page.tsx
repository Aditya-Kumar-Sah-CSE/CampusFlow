import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicExamDetails } from '@/lib/exams/exam-attempt-service';
import { StudentExamPortal } from '@/components/exams/StudentExamPortal';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    id: string;
  }>;
}

export default async function PublicTenantExamTakingPage({ params }: Props) {
  const { tenant: rawSlug, id } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  let exam;
  try {
    exam = await getPublicExamDetails(id);
  } catch (err) {
    notFound();
  }

  if (!exam || exam.college_id !== tenant.collegeId) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{tenant.name} &bull; Examination Session</span>
          </div>
          <Link
            href={`/${tenant.slug}/exams`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> All Examinations
          </Link>
        </div>
      </div>

      <PublicTenantNavbar tenant={tenant} currentPage="exam-detail" />

      <main className="flex-1 py-6">
        <StudentExamPortal exam={exam} tenantSlug={tenant.slug} />
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
