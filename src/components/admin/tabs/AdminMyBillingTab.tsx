'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Sparkles,
  Calendar,
  CheckCircle2,
  Lock,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { getMyBillingStatusAction } from '@/app/admin/billing/actions';
import { PaymentRequestForm } from '@/components/admin/billing/PaymentRequestForm';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import type { BillingStatus } from '@/lib/billing/constants';
import type { PaymentRequest } from '@/types/database';

export function AdminMyBillingTab() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [latestRequest, setLatestRequest] = useState<PaymentRequest | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getMyBillingStatusAction();
    if (res.success && res.billing) {
      setBilling(res.billing as BillingStatus);
      setLatestRequest(res.latestPaymentRequest || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded-md" />
        <div className="h-40 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  const hasActiveTrial = billing?.hasActiveTrial && billing.activeTrial;
  const isTrialExpired = !hasActiveTrial && billing?.trialStatus === 'EXPIRED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <ExamPadCard
            variant="dashboard"
            title="My Billing & Subscription"
            subtitle="View your institutional entitlement, trial status, and available subscription plans."
            badge={billing?.planType ? `${billing.planType} PLAN` : "BILLING"}
            icon={<CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-[3px] border border-amber-300 dark:border-[#4d3817] bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:bg-slate-50 dark:hover:bg-[#281b0f] transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 1. ACTIVE TRIAL HERO BANNER */}
      {hasActiveTrial && (
        <div className="relative overflow-hidden rounded-[3px] border border-emerald-300 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-[#0d2217] dark:via-[#0e2722] dark:to-[#0a1e26] p-6 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[2px] text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-xs font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Trial Active
                </span>
                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-[2px] font-mono border border-emerald-300/60 dark:border-emerald-700/60">
                  {billing.trialDaysRemaining ?? 0} days remaining
                </span>
              </div>
              <h3 className="text-base font-extrabold text-emerald-950 dark:text-emerald-200">
                Super Admin Granted Free Trial Access
              </h3>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed max-w-xl">
                You have temporary full access to granted features. When this trial expires, your account will smoothly fall back to the permanent FREE base plan.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-900 dark:text-emerald-300 pt-1">
                <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  Valid Until:{' '}
                  {billing.trialExpiresAt
                    ? new Date(billing.trialExpiresAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Active'}
                </span>
              </div>
            </div>

            {/* Trial Features Checklist */}
            <div className="bg-white/80 dark:bg-[#1a1309]/90 backdrop-blur-xs rounded-[3px] p-4 border border-emerald-200 dark:border-emerald-800 space-y-2 shrink-0 md:min-w-[260px]">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-900 dark:text-emerald-300 block">
                Trial Unlocked Features
              </span>
              <ul className="space-y-1.5 text-xs text-slate-800 dark:text-[#faebd0]">
                {billing.activeTrial?.features?.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. TRIAL EXPIRED CALLOUT */}
      {isTrialExpired && (
        <div className="rounded-[3px] border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-[#20150b] p-5 space-y-2 text-amber-900 dark:text-[#faebd0]">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-300">Trial Expired</h3>
          </div>
          <p className="text-xs text-amber-800 dark:text-[#c4a97d] leading-relaxed">
            Your free trial has ended. Your account has automatically reverted to the permanent <strong>FREE base plan</strong> (Basic Analytics). To unlock Google Form generation and Full Analytics access again, please select a subscription plan below.
          </p>
        </div>
      )}

      {/* 3. CURRENT PLAN SUMMARY CARD */}
      <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2a1d0f]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#a08862]">
              Current Base Plan
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#faebd0]">{billing?.planType} Plan</h3>
              <span className="px-2.5 py-0.5 rounded-[2px] text-[10px] font-bold uppercase bg-slate-100 dark:bg-[#281b0f] text-slate-700 dark:text-amber-300 font-mono border border-slate-200 dark:border-[#4d3817]">
                {billing?.accessStatus}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#a08862]">
              Validity
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-[#faebd0] mt-0.5">
              {billing?.expiresAt
                ? new Date(billing.expiresAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Permanent Base Access'}
            </p>
          </div>
        </div>

        {/* Effective Features List */}
        <div>
          <span className="text-xs font-bold text-slate-700 dark:text-[#c4a97d] block mb-2">
            Your Effective Entitlements:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-[3px] border border-slate-200 dark:border-[#382710] bg-slate-50/70 dark:bg-[#20150b] flex items-center gap-2 text-xs text-slate-800 dark:text-[#faebd0]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Basic Analytics (View authorized sheets)</span>
            </div>
            <div className={`p-2.5 rounded-[3px] border flex items-center gap-2 text-xs ${
              billing?.features?.includes('Google Form generation')
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-semibold'
                : 'border-slate-200 dark:border-[#382710] bg-slate-50 dark:bg-[#20150b] text-slate-400 dark:text-[#8f754c]'
            }`}>
              {billing?.features?.includes('Google Form generation') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400 dark:text-[#8f754c] shrink-0" />
              )}
              <span>Google Form generation</span>
            </div>
            <div className={`p-2.5 rounded-[3px] border flex items-center gap-2 text-xs ${
              billing?.hasFullAnalytics
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-semibold'
                : 'border-slate-200 dark:border-[#382710] bg-slate-50 dark:bg-[#20150b] text-slate-400 dark:text-[#8f754c]'
            }`}>
              {billing?.hasFullAnalytics ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400 dark:text-[#8f754c] shrink-0" />
              )}
              <span>Full Analytics Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. UPGRADE / PAID PLAN REQUEST SECTION */}
      <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
            <Zap className="w-5 h-5 text-bce-cobalt dark:text-amber-400" />
            Upgrade Subscription Plan
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#c4a97d] mt-1">
            Choose a paid plan to unlock Google Form generation and Full Analytics Access.
          </p>
        </div>

        <PaymentRequestForm
          latestRequest={latestRequest}
          onSuccess={loadData}
        />
      </div>
    </div>
  );
}
