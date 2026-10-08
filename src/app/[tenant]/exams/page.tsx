import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getStudentAvailableExams } from '@/lib/exams/exam-attempt-service';
import { PublicExamDiscovery } from '@/components/exams/PublicExamDiscovery';
import { PublicTenantNavbar } from '@/components/layout/PublicTenantNavbar';
import { CollegePublicFooter } from '@/components/layout/CollegePublicFooter';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function PublicTenantExamsPage({ params }: Props) {
  const { tenant: rawSlug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const exams = await getStudentAvailableExams({ collegeId: tenant.collegeId }).catch(() => []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Online Examination Portal &bull; {tenant.name}</span>
          </div>
          <Link
            href={`/${tenant.slug}`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> {tenant.shortName} Portal
          </Link>
        </div>
      </div>

      <PublicTenantNavbar tenant={tenant} currentPage="exams" />

      <main className="flex-1">
        <PublicExamDiscovery
          exams={exams}
          collegeName={tenant.name}
          collegeLogo={tenant.logo}
          tenantSlug={tenant.slug}
        />
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
