import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicEventBySlug } from '@/lib/events/service';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { PublicEventDetailClient } from '@/components/events/PublicEventDetailClient';
import { School, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    tenant: string;
    slug: string;
  }>;
}

export default async function PublicEventDetailPage({ params }: Props) {
  const { tenant: rawSlug, slug } = await params;
  const tenant = await resolveTenantOrNotFound(rawSlug);

  const [event, academic] = await Promise.all([
    getPublicEventBySlug(tenant.collegeId, slug),
    getCachedAcademicMasters(tenant.collegeId),
  ]);

  if (!event || event.status === 'DRAFT') {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <span>{tenant.name} &bull; Event Portal</span>
          <Link
            href={`/${tenant.slug}/events`}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" /> All Events
          </Link>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tenant.logo}
                alt={`${tenant.name} Logo`}
                className="w-10 h-10 object-contain rounded-lg"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: tenant.branding.primaryColor || '#0B192C' }}
              >
                <School className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-1">
                {tenant.name}
              </h2>
              <p className="text-[11px] text-slate-500">Student Event Registration</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 flex-1 w-full">
        <PublicEventDetailClient
          event={event}
          tenant={tenant}
          branches={academic.branches}
          semesters={academic.semesters}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
