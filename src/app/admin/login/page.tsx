import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TenantLoginForm } from '@/components/admin/TenantLoginForm';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'CampusFlow | Platform Admin Login',
  description: 'Multi-tenant administrator sign-in portal for CampusFlow campus management, institutional feedback, and events.',
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950/40 backdrop-blur-xs text-slate-100 flex flex-col justify-center py-6 sm:py-12 px-2.5 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-1 sm:px-0">
        <Suspense
          fallback={
            <div className="bg-slate-800/90 py-12 px-6 rounded-[3px] border border-slate-700/60 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-slate-400">Loading admin portal...</p>
            </div>
          }
        >
          <TenantLoginForm isTenantSpecific={false} />
        </Suspense>

        <div className="mt-6 text-center text-xs text-amber-100/60 drop-shadow-xs">
          <span>Multi-tenant institutional system • Authorized access only</span>
        </div>
      </div>
    </div>
  );
}
