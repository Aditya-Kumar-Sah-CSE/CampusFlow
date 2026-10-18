'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Gift,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CreditCard,
  Phone,
  Save,
  Sparkles,
  TrendingUp,
  ShieldX,
  History,
  Search,
  X,
  Filter,
} from 'lucide-react';
import {
  getAdminBillingOverviewAction,
  approvePaymentAction,
  rejectPaymentAction,
  assignFreePlanAction,
  lockAdminAccessAction,
  unlockAdminAccessAction,
  revokeFormAccessAction,
  getPaymentProofUrlAction,
  updatePaymentSettingsAction,
  getPaymentSettingsAction,
} from '@/app/admin/billing/actions';
import { PlanManagementSection } from '@/components/admin/billing/PlanManagementSection';
import { GrantTrialModal } from '@/components/admin/billing/GrantTrialModal';
import { ExtendTrialModal } from '@/components/admin/billing/ExtendTrialModal';
import { RevokeTrialModal } from '@/components/admin/billing/RevokeTrialModal';
import { TrialHistoryModal } from '@/components/admin/billing/TrialHistoryModal';
import { ReplaceTrialModal } from '@/components/admin/billing/ReplaceTrialModal';
import { PaginationControl } from '@/components/ui/PaginationControl';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import type { PaymentSettings, Admin, AdminTrialEntitlement, BillingOverviewItem } from '@/types/database';

export function BillingManagementTab({ currentUserEmail: _currentUserEmail }: { currentUserEmail?: string }) {
  const [data, setData] = useState<BillingOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; adminId: string; adminEmail: string; requestId?: string } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [, setSettings] = useState<PaymentSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    upiId: '', accountName: '', bankName: '', accountNumber: '', ifscCode: '', supportPhone: '9470870830', paymentInstructions: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Free Trial Modal states
  const [trialModalAdmin, setTrialModalAdmin] = useState<Admin | null>(null);
  const [extendModalData, setExtendModalData] = useState<{ admin: Admin; trial: AdminTrialEntitlement } | null>(null);
  const [revokeModalData, setRevokeModalData] = useState<{ admin: Admin; trial: AdminTrialEntitlement } | null>(null);
  const [replaceModalData, setReplaceModalData] = useState<{ admin: Admin; currentTrial?: AdminTrialEntitlement | null } | null>(null);
  const [historyModalAdmin, setHistoryModalAdmin] = useState<Admin | null>(null);

  // Smart Search, Filtering & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'FREE' | 'TRIAL' | 'PAID' | 'EXPIRED_TRIAL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    return data.filter((item) => {
      // 1. Smart Text Search Filter (name, code, slug, admin email)
      if (q) {
        const name = (item.college?.name || '').toLowerCase();
        const code = (item.college?.code || '').toLowerCase();
        const codeClean = code.replace(/[^a-z0-9]/g, '');
        const slug = (item.college?.slug || '').toLowerCase();
        const slugClean = slug.replace(/[^a-z0-9]/g, '');
        const email = (item.admin?.email || '').toLowerCase();

        const matchesText =
          name.includes(q) ||
          code.includes(q) ||
          slug.includes(q) ||
          email.includes(q) ||
          (qClean && (codeClean.includes(qClean) || slugClean.includes(qClean)));

        if (!matchesText) return false;
      }

      // 2. Access Filter
      const accessStatus = item.billing?.access_status || 'LOCKED';
      if (accessFilter === 'UNLOCKED' && accessStatus !== 'UNLOCKED') return false;
      if (accessFilter === 'LOCKED' && accessStatus !== 'LOCKED') return false;

      // 3. Plan / Trial Filter
      const planType = item.billing?.plan_type || 'FREE';
      const hasActiveTrial = Boolean(item.activeTrial);
      if (planFilter === 'TRIAL' && !hasActiveTrial) return false;
      if (planFilter === 'FREE' && (planType !== 'FREE' || hasActiveTrial)) return false;
      if (planFilter === 'PAID' && (planType === 'FREE' || hasActiveTrial)) return false;
      if (planFilter === 'EXPIRED_TRIAL') {
        const latestTrial = item.trialHistory && item.trialHistory[0];
        if (!latestTrial || latestTrial.status !== 'EXPIRED') return false;
      }

      return true;
    });
  }, [data, searchQuery, accessFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleAccessFilterChange = (val: 'ALL' | 'UNLOCKED' | 'LOCKED') => {
    setAccessFilter(val);
    setCurrentPage(1);
  };

  const handlePlanFilterChange = (val: 'ALL' | 'FREE' | 'TRIAL' | 'PAID' | 'EXPIRED_TRIAL') => {
    setPlanFilter(val);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setAccessFilter('ALL');
    setPlanFilter('ALL');
    setCurrentPage(1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminBillingOverviewAction();
      if (res.success && res.data) {
        setData(res.data as BillingOverviewItem[]);
      } else if (res.error) {
        setMessage({ text: res.error, type: 'error' });
      }
    } catch (err: any) {
      console.error('[LOAD_BILLING_ERROR]', err);
      setMessage({ text: err?.message || 'Failed to load billing data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getPaymentSettingsAction().then(res => {
      if (res.success && res.settings) {
        setSettings(res.settings);
        setSettingsForm({
          upiId: res.settings.upi_id || '',
          accountName: res.settings.account_name || '',
          bankName: res.settings.bank_name || '',
          accountNumber: res.settings.account_number || '',
          ifscCode: res.settings.ifsc_code || '',
          supportPhone: res.settings.support_phone || '9470870830',
          paymentInstructions: res.settings.payment_instructions || '',
        });
      }
    });
  }, []);

  function openConfirmModal(action: { type: string; adminId: string; adminEmail: string; requestId?: string }) {
    setConfirmError(null);
    setRejectionReason('');
    setConfirmAction(action);
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      let res: { success: boolean; message?: string; error?: string } | undefined;
      if (confirmAction.type === 'APPROVE' && confirmAction.requestId) {
        res = await approvePaymentAction(confirmAction.requestId);
      } else if (confirmAction.type === 'REJECT' && confirmAction.requestId) {
        res = await rejectPaymentAction(confirmAction.requestId, rejectionReason);
      } else if (confirmAction.type === 'ASSIGN_FREE') {
        res = await assignFreePlanAction(confirmAction.adminId);
      } else if (confirmAction.type === 'LOCK') {
        res = await lockAdminAccessAction(confirmAction.adminId);
      } else if (confirmAction.type === 'UNLOCK') {
        res = await unlockAdminAccessAction(confirmAction.adminId);
      } else if (confirmAction.type === 'REVOKE') {
        res = await revokeFormAccessAction(confirmAction.adminId);
      }

      if (res?.success) {
        setMessage({
          text: res.message || `${confirmAction.type.replace(/_/g, ' ')} action completed successfully.`,
          type: 'success',
        });
        setConfirmAction(null);
        setRejectionReason('');
        setConfirmError(null);
        await loadData();
        setTimeout(() => setMessage(null), 5000);
      } else {
        setConfirmError(res?.error || 'Action failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[CONFIRM_ACTION_EXCEPTION]', err);
      setConfirmError(err?.message || 'An unexpected error occurred. Please refresh and try again.');
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleViewProof(proofPath: string) {
    const res = await getPaymentProofUrlAction(proofPath);
    if (res.success && res.url) {
      setProofUrl(res.url);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await updatePaymentSettingsAction(settingsForm);
      setMessage({ text: res.success ? 'Payment settings saved.' : (res.error || 'Save failed.'), type: res.success ? 'success' : 'error' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: err?.message || 'Failed to save settings.', type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      UNLOCKED: { label: 'Unlocked', cls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
      LOCKED: { label: 'Locked', cls: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' },
    };
    const cfg = map[status] || { label: status, cls: 'bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710]' };
    return <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase ${cfg.cls}`}>{cfg.label}</span>;
  };

  const getPlanBadge = (plan: string) => {
    const map: Record<string, string> = {
      FREE: 'bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710]',
      MONTHLY: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
      HALF_YEARLY: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
      YEARLY: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    };
    return <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase ${map[plan] || 'bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710]'}`}>{plan}</span>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const map: Record<string, { cls: string }> = {
      PENDING: { cls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
      APPROVED: { cls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
      REJECTED: { cls: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' },
    };
    const cfg = map[status] || { cls: 'bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710]' };
    return <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase ${cfg.cls}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1a1309] p-6 rounded-[3px] border border-amber-200/80 dark:border-[#382710] space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-[#20150b] rounded-[3px]" />
        <div className="h-64 bg-slate-50 dark:bg-[#140e07] rounded-[3px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <ExamPadCard
            variant="dashboard"
            title="Billing & Access Management"
            subtitle="Manage multi-tenant college subscription plans, free trials, and access locks."
            badge={
              filteredData.length === data.length
                ? `${data.length} COLLEGES`
                : `${filteredData.length} of ${data.length} MATCHED`
            }
            clipLabel="SUBSCRIPTION BILLING"
            icon={<CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:bg-slate-50 dark:hover:bg-[#20150b] transition cursor-pointer"
          >
            Payment Settings
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[3px] border border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:bg-slate-50 dark:hover:bg-[#20150b] transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-[3px] p-3 text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Database-Driven Plan Management */}
      <PlanManagementSection />

      {/* Payment Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-[#faebd0]">Payment Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">UPI ID</label>
              <input
                type="text"
                value={settingsForm.upiId}
                onChange={e => setSettingsForm(s => ({ ...s, upiId: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">Account Holder Name</label>
              <input
                type="text"
                value={settingsForm.accountName}
                onChange={e => setSettingsForm(s => ({ ...s, accountName: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">Bank Name</label>
              <input
                type="text"
                value={settingsForm.bankName}
                onChange={e => setSettingsForm(s => ({ ...s, bankName: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">Account Number</label>
              <input
                type="text"
                value={settingsForm.accountNumber}
                onChange={e => setSettingsForm(s => ({ ...s, accountNumber: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">IFSC Code</label>
              <input
                type="text"
                value={settingsForm.ifscCode}
                onChange={e => setSettingsForm(s => ({ ...s, ifscCode: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium flex items-center gap-1">
                <Phone className="w-3 h-3 text-amber-500" /> Support Phone
              </label>
              <input
                type="text"
                value={settingsForm.supportPhone}
                onChange={e => setSettingsForm(s => ({ ...s, supportPhone: e.target.value }))}
                className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">Payment Instructions</label>
            <textarea
              value={settingsForm.paymentInstructions}
              onChange={e => setSettingsForm(s => ({ ...s, paymentInstructions: e.target.value }))}
              className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 h-20 resize-none transition-all"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 text-xs sm:text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">Confirm Action</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#faebd0]">
              Are you sure you want to <strong>{confirmAction.type.replace(/_/g, ' ').toLowerCase()}</strong> for <strong>{confirmAction.adminEmail}</strong>?
            </p>
            {confirmAction.type === 'REJECT' && (
              <div>
                <label className="block text-xs text-slate-600 dark:text-[#faebd0] mb-1 font-medium">Rejection Reason (optional)</label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g., Invalid UTR, wrong amount..."
                  disabled={confirmLoading}
                  className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 transition-all"
                />
              </div>
            )}
            {confirmError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-[3px] text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{confirmError}</span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                disabled={confirmLoading}
                onClick={() => {
                  setConfirmAction(null);
                  setRejectionReason('');
                  setConfirmError(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-[3px] border border-amber-200/80 dark:border-[#382710] text-slate-600 dark:text-[#c4a97d] hover:bg-slate-50 dark:hover:bg-[#20150b] disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={confirmLoading}
                onClick={handleConfirmAction}
                aria-busy={confirmLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[3px] bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 disabled:opacity-50 cursor-pointer"
              >
                {confirmLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirmLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewer */}
      {proofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setProofUrl(null)}>
          <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-4 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-[#faebd0]">Payment Proof</h3>
              <button onClick={() => setProofUrl(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-[#faebd0] cursor-pointer">Close</button>
            </div>
            <Image src={proofUrl} alt="Payment proof" className="w-full rounded-[3px] border border-amber-200/80 dark:border-[#382710] max-h-96 object-contain" width={500} height={400} unoptimized />
          </div>
        </div>
      )}

      {/* Fast & Smart Search Bar + Filters */}
      <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Smart Search Bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#a08862] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by college name, code (e.g. 108, GP-157), slug, or admin email..."
              className="w-full pl-9 pr-9 py-2 bg-slate-50/70 dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] focus:bg-white dark:focus:bg-[#140e07] focus:border-amber-500 rounded-[3px] text-xs sm:text-sm text-slate-800 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8f754c] transition-all outline-hidden font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-[#faebd0] rounded-[2px] transition cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Access Filter */}
            <select
              value={accessFilter}
              onChange={(e) => handleAccessFilterChange(e.target.value as any)}
              className="px-3 py-2 bg-slate-50/80 dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] rounded-[3px] text-xs text-slate-700 dark:text-[#faebd0] font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Access</option>
              <option value="UNLOCKED">Unlocked Only</option>
              <option value="LOCKED">Locked Only</option>
            </select>

            {/* Plan / Trial Filter */}
            <select
              value={planFilter}
              onChange={(e) => handlePlanFilterChange(e.target.value as any)}
              className="px-3 py-2 bg-slate-50/80 dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] rounded-[3px] text-xs text-slate-700 dark:text-[#faebd0] font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Plans & Trials</option>
              <option value="TRIAL">Active Free Trial</option>
              <option value="FREE">Free Plan</option>
              <option value="PAID">Paid (Monthly/Yearly)</option>
              <option value="EXPIRED_TRIAL">Expired Trial</option>
            </select>

            {/* Active filter count / clear */}
            {(searchQuery || accessFilter !== 'ALL' || planFilter !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[3px] border border-rose-200 dark:border-rose-900/60 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Count summary & indicators */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#c4a97d] pt-0.5 px-0.5 border-t border-amber-100 dark:border-[#382710] flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Showing <strong className="text-slate-800 dark:text-[#faebd0] font-bold">{filteredData.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-[#faebd0] font-bold">{data.length}</strong> college tenants
            </span>
            {searchQuery && (
              <span className="px-2 py-0.5 rounded-[2px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold text-[10px]">
                Query: &quot;{searchQuery}&quot;
              </span>
            )}
            {accessFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] border border-amber-200/80 dark:border-[#382710] font-semibold text-[10px]">
                Access: {accessFilter}
              </span>
            )}
            {planFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-[2px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-[10px]">
                Filter: {planFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 dark:text-[#a08862]">Page {validPage} of {totalPages}</span>
          </div>
        </div>
      </div>

      {/* Admin Billing Table */}
      <PinnedRosterBoard
        title="College Tenant Billing & Access Directory"
        subtitle="Inspect and manage multi-tenant college subscription plans, free trials, and access locks."
        badge={`${filteredData.length} TENANTS`}
        action={
          <span className="text-xs font-semibold text-slate-500 dark:text-[#c4a97d]">
            Page {validPage} of {totalPages}
          </span>
        }
      >
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-xs min-w-[650px]">
            <thead className="bg-slate-50 dark:bg-[#140e07] border-b border-amber-200/80 dark:border-[#382710]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">College Tenant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Access</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Billing Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Trial</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Payment</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Valid Until</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-[#faebd0]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100/60 dark:divide-[#382710]/60">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-[3px] bg-slate-100 dark:bg-[#20150b] text-slate-400 dark:text-amber-500 mx-auto flex items-center justify-center">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-[#faebd0]">No college tenants match your criteria</p>
                      <p className="text-xs text-slate-500 dark:text-[#c4a97d]">
                        Try searching with a different college name, code, or clear active filters.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                const isExpanded = expandedAdmin === item.college.id;
                const accessStatus = item.billing?.access_status || 'LOCKED';
                const planType = item.billing?.plan_type || 'FREE';
                const latestReq = item.latestPaymentRequest;
                const activeTrial = item.activeTrial;
                const isOwnRow = false;
                const isSuperAdminRow = false;

                return (
                  <tr key={item.college.id} className={`${isExpanded ? 'bg-amber-500/10' : 'hover:bg-amber-500/5 dark:hover:bg-amber-500/10'} transition-colors`}>
                    {/* 1. College Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-[#faebd0] flex items-center gap-1.5">
                            <span>{item.college.name}</span>
                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] rounded-[2px] border border-amber-200/60 dark:border-[#382710]">
                              {item.college.code}
                            </span>
                          </p>
                          <p className="text-slate-400 dark:text-[#a08862] font-mono text-[10px]">
                            {item.membersCount || 0} admins · /c/{item.college.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Access Status */}
                    <td className="px-4 py-3">
                      {isSuperAdminRow ? (
                        <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Always Unlocked</span>
                      ) : (
                        getStatusBadge(accessStatus)
                      )}
                    </td>

                    {/* 3. Billing Plan */}
                    <td className="px-4 py-3">
                      {getPlanBadge(planType)}
                    </td>

                    {/* 4. Trial Entitlement Status */}
                    <td className="px-4 py-3">
                      {isSuperAdminRow ? (
                        <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                      ) : activeTrial ? (() => {
                        const diffMs = new Date(activeTrial.expires_at).getTime() - new Date().getTime();
                        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                        return (
                          <div className="space-y-0.5">
                            <span
                              title={`Valid until ${new Date(activeTrial.expires_at).toLocaleDateString('en-IN')}. Features: ${activeTrial.features?.join(', ')}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              TRIAL — {daysLeft}d left
                            </span>
                            <p className="text-[10px] text-slate-400 dark:text-[#a08862]">
                              Until {new Date(activeTrial.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                        );
                      })() : (() => {
                        const latestTrial = item.trialHistory && item.trialHistory[0];
                        if (latestTrial?.status === 'EXPIRED') {
                          return (
                            <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase bg-slate-100 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710]">
                              EXPIRED
                            </span>
                          );
                        }
                        if (latestTrial?.status === 'REVOKED') {
                          return (
                            <span className="px-2 py-0.5 rounded-[2px] text-[10px] font-semibold uppercase bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                              REVOKED
                            </span>
                          );
                        }
                        return <span className="text-slate-300 dark:text-slate-600">—</span>;
                      })()}
                    </td>

                    {/* 5. Payment Status */}
                    <td className="px-4 py-3">
                      {latestReq ? (
                        <div className="space-y-0.5">
                          {getPaymentStatusBadge(latestReq.status)}
                          <p className="text-[10px] text-slate-400 dark:text-[#a08862]">₹{latestReq.amount?.toLocaleString('en-IN')} • {latestReq.plan_type}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* 6. Valid Until */}
                    <td className="px-4 py-3">
                      {item.billing?.expires_at ? (
                        <span className={`text-[11px] ${new Date(item.billing.expires_at) < new Date() ? 'text-red-500 font-semibold' : 'text-slate-600 dark:text-[#c4a97d]'}`}>
                          {new Date(item.billing.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : planType === 'FREE' && accessStatus === 'UNLOCKED' ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">No Expiry</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* 7. Actions */}
                    <td className="px-4 py-3 text-right">
                      {isSuperAdminRow ? (
                        <span className="text-[10px] text-slate-400 dark:text-[#a08862] font-medium">Protected</span>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {/* Free Trial Actions */}
                          {!activeTrial ? (
                            <button
                              onClick={() => setTrialModalAdmin(item.admin)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 transition cursor-pointer shadow-2xs"
                            >
                              <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Grant Trial
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setExtendModalData({ admin: item.admin, trial: activeTrial })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                              >
                                <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Extend
                              </button>
                              <button
                                onClick={() => setRevokeModalData({ admin: item.admin, trial: activeTrial })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 transition cursor-pointer"
                              >
                                <ShieldX className="w-3 h-3 text-red-600 dark:text-red-400" /> Revoke
                              </button>
                            </>
                          )}

                          {/* View Trial History */}
                          <button
                            onClick={() => setHistoryModalAdmin(item.admin)}
                            title="View Free Trial History"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-slate-100 dark:bg-[#20150b] text-slate-700 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d0f] border border-amber-200/60 dark:border-[#382710] transition cursor-pointer"
                          >
                            <History className="w-3 h-3 text-slate-500 dark:text-amber-500" /> Trials
                          </button>

                          {/* Approve/Reject pending requests */}
                          {latestReq?.status === 'PENDING' && (
                            <>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'APPROVE', adminId: item.college.id, adminEmail: item.college.name, requestId: latestReq.id })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-200 dark:border-emerald-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'REJECT', adminId: item.college.id, adminEmail: item.college.name, requestId: latestReq.id })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 border border-red-200 dark:border-red-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </>
                          )}

                          {/* View proof */}
                          {latestReq?.payment_proof_url && (
                            <button
                               onClick={() => handleViewProof(latestReq.payment_proof_url!)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-slate-100 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d0f] border border-amber-200/60 dark:border-[#382710] transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> Proof
                            </button>
                          )}

                          {/* Quick access status toggle */}
                          {accessStatus === 'LOCKED' && !isOwnRow && (
                            <>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'UNLOCK', adminId: item.college.id, adminEmail: item.college.name })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-200 border border-blue-200 dark:border-blue-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" /> Unlock
                              </button>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'ASSIGN_FREE', adminId: item.college.id, adminEmail: item.college.name })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-200 dark:border-emerald-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <Gift className="w-3 h-3" /> Free
                              </button>
                            </>
                          )}

                          {accessStatus === 'UNLOCKED' && !isOwnRow && (
                            <>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'LOCK', adminId: item.college.id, adminEmail: item.college.name })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-200 border border-amber-200 dark:border-amber-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <Lock className="w-3 h-3" /> Lock
                              </button>
                              <button
                                disabled={confirmLoading}
                                onClick={() => openConfirmModal({ type: 'REVOKE', adminId: item.college.id, adminEmail: item.college.name })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 border border-red-200 dark:border-red-800 transition disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" /> Revoke
                              </button>
                            </>
                          )}

                          {/* Expand history */}
                          <button
                            onClick={() => setExpandedAdmin(isExpanded ? null : item.college.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-medium bg-slate-100 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] hover:bg-slate-200 dark:hover:bg-[#2a1d0f] border border-amber-200/60 dark:border-[#382710] transition cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Payments
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <PaginationControl
          currentPage={validPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          isLoading={loading}
        />

        {/* Expanded Payment History */}
        {expandedAdmin && (() => {
          const item = data.find(d => d.college.id === expandedAdmin || d.admin.id === expandedAdmin);
          if (!item || !item.paymentRequests.length) return (
            <div className="border-t border-amber-200/80 dark:border-[#382710] p-4 text-xs text-slate-400 dark:text-[#a08862]">No payment history recorded.</div>
          );
          return (
            <div className="border-t border-amber-200/80 dark:border-[#382710] bg-slate-50/50 dark:bg-[#140e07]/50 p-4">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-[#faebd0] mb-2">Payment Submissions — {item.admin.email}</h4>
              <div className="space-y-2">
                {item.paymentRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/60 dark:border-[#382710] px-3 py-2 text-[11px]">
                    <div className="flex items-center gap-3">
                      {getPaymentStatusBadge(req.status)}
                      <span className="text-slate-600 dark:text-[#faebd0]">{req.plan_type} • ₹{req.amount?.toLocaleString('en-IN')}</span>
                      <span className="text-slate-400 dark:text-[#a08862] font-mono">{req.payment_reference}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 dark:text-[#a08862]">{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                      {req.rejection_reason && <span className="text-red-500 italic">{req.rejection_reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </PinnedRosterBoard>

      {/* Trial Modals */}
      {trialModalAdmin && (
        <GrantTrialModal
          admin={trialModalAdmin}
          isOpen={!!trialModalAdmin}
          onClose={() => setTrialModalAdmin(null)}
          onSuccess={() => {
            setMessage({ text: `Free Trial granted to ${trialModalAdmin.email}.`, type: 'success' });
            loadData();
          }}
          onOpenReplaceModal={() => {
            const admin = trialModalAdmin;
            const overviewItem = data.find(d => d.admin.id === admin.id);
            setReplaceModalData({ admin, currentTrial: overviewItem?.activeTrial });
          }}
        />
      )}

      {extendModalData && (
        <ExtendTrialModal
          admin={extendModalData.admin}
          trial={extendModalData.trial}
          isOpen={!!extendModalData}
          onClose={() => setExtendModalData(null)}
          onSuccess={() => {
            setMessage({ text: `Trial extended for ${extendModalData.admin.email}.`, type: 'success' });
            loadData();
          }}
        />
      )}

      {revokeModalData && (
        <RevokeTrialModal
          admin={revokeModalData.admin}
          trial={revokeModalData.trial}
          isOpen={!!revokeModalData}
          onClose={() => setRevokeModalData(null)}
          onSuccess={() => {
            setMessage({ text: `Trial revoked for ${revokeModalData.admin.email}.`, type: 'success' });
            loadData();
          }}
        />
      )}

      {replaceModalData && (
        <ReplaceTrialModal
          admin={replaceModalData.admin}
          currentTrial={replaceModalData.currentTrial}
          isOpen={!!replaceModalData}
          onClose={() => setReplaceModalData(null)}
          onSuccess={() => {
            setMessage({ text: `Trial replaced for ${replaceModalData.admin.email}.`, type: 'success' });
            loadData();
          }}
        />
      )}

      {historyModalAdmin && (
        <TrialHistoryModal
          admin={historyModalAdmin}
          isOpen={!!historyModalAdmin}
          onClose={() => setHistoryModalAdmin(null)}
        />
      )}
    </div>
  );
}
