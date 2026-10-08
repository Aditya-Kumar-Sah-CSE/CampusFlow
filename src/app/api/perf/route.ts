import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantOrNotFound } from '@/lib/tenant/resolver';
import { getPublicTenantEvents } from '@/lib/events/service';
import { getStudentAvailableExams } from '@/lib/exams/exam-attempt-service';
import { getPublicActiveFormsAction } from '@/app/feedback/actions';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { getPwaInstallCount } from '@/lib/pwa/installations';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseUrl } from '@/lib/supabase/env';

export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('tenant') || 'bce-bgp';

  const timings: Record<string, { duration_ms: number; success: boolean; error?: string }> = {};

  async function measure(name: string, fn: () => Promise<any>) {
    const start = performance.now();
    try {
      await fn();
      timings[name] = {
        duration_ms: parseFloat((performance.now() - start).toFixed(2)),
        success: true,
      };
    } catch (err: any) {
      timings[name] = {
        duration_ms: parseFloat((performance.now() - start).toFixed(2)),
        success: false,
        error: err?.message || 'unknown error',
      };
    }
  }

  // 1. Client creation timing
  await measure('1_supabase_client_creation', async () => {
    return await createClient();
  });

  // 2. Tenant lookup
  let tenant: any = null;
  await measure('2_tenant_lookup', async () => {
    tenant = await resolveTenantOrNotFound(tenantSlug);
  });

  if (tenant) {
    // 3. Events lookup
    await measure('3_events_lookup', async () => {
      return await getPublicTenantEvents(tenant.collegeId);
    });

    // 4. Exams lookup
    await measure('4_exams_lookup', async () => {
      return await getStudentAvailableExams({ collegeId: tenant.collegeId });
    });

    // 5. Active feedback forms lookup
    await measure('5_feedback_forms_lookup', async () => {
      return await getPublicActiveFormsAction({ collegeId: tenant.collegeId, page: 1, pageSize: 6 });
    });

    // 6. Academic masters lookup
    await measure('6_academic_masters_lookup', async () => {
      return await getCachedAcademicMasters(tenant.collegeId);
    });

    // 7. PWA install count RPC
    await measure('7_pwa_count_rpc', async () => {
      return await getPwaInstallCount(tenant.collegeId);
    });

    // 8. Parallel execution of all 5 tenant data queries
    const parallelStart = performance.now();
    await Promise.all([
      getPublicTenantEvents(tenant.collegeId),
      getStudentAvailableExams({ collegeId: tenant.collegeId }),
      getPublicActiveFormsAction({ collegeId: tenant.collegeId, page: 1, pageSize: 6 }),
      getCachedAcademicMasters(tenant.collegeId),
      getPwaInstallCount(tenant.collegeId),
    ]);
    timings['8_parallel_all_queries'] = {
      duration_ms: parseFloat((performance.now() - parallelStart).toFixed(2)),
      success: true,
    };
  }

  const vercelRegion = process.env.VERCEL_REGION || 'local';
  const vercelId = request.headers.get('x-vercel-id') || null;
  let computeRegion = vercelRegion;
  if (vercelId && vercelId.includes('::')) {
    const parts = vercelId.split('::');
    if (parts.length >= 2) {
      computeRegion = parts[1] || vercelRegion;
    }
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseHost = new URL(supabaseUrl).hostname;

  return NextResponse.json({
    status: 'ok',
    environment: 'staging',
    runtime: 'nodejs',
    region: vercelRegion,
    computeRegion,
    vercelId,
    supabaseRegion: 'ap-south-1',
    supabaseHost,
    tenant: tenantSlug,
    timings,
    server_time: new Date().toISOString(),
  });
}
