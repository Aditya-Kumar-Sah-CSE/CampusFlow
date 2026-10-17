'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllBillingPlansAction,
  createBillingPlanAction,
  updateBillingPlanAction,
  toggleBillingPlanAction,
  deleteBillingPlanAction,
} from '@/app/admin/billing/plan-actions';
import type { BillingPlan, BillingInterval } from '@/types/database';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Star,
} from 'lucide-react';

export function PlanManagementSection() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [durationDays, setDurationDays] = useState('30');
  const [featuresText, setFeaturesText] = useState('');
  const [isRecommended, setIsRecommended] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState('0');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllBillingPlansAction();
      if (res.success && res.plans) {
        setPlans(res.plans);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  function openCreateModal() {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setPrice('');
    setCurrency('INR');
    setBillingInterval('MONTHLY');
    setDurationDays('');
    setFeaturesText('');
    setIsRecommended(false);
    setIsActive(true);
    setDisplayOrder(String((plans.length + 1) * 10));
    setIsModalOpen(true);
  }

  function openEditModal(plan: BillingPlan) {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPrice(String(plan.price));
    setCurrency(plan.currency);
    setBillingInterval(plan.billing_interval);
    setDurationDays(plan.duration_days ? String(plan.duration_days) : '');
    setFeaturesText((plan.features || []).join('\n'));
    setIsRecommended(plan.is_recommended);
    setIsActive(plan.is_active);
    setDisplayOrder(String(plan.display_order));
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Plan name is required.' });
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setMessage({ type: 'error', text: 'Valid price is required.' });
      return;
    }
    const durationNum = durationDays ? parseInt(durationDays, 10) : undefined;
    if (durationNum !== undefined && (isNaN(durationNum) || durationNum < 1)) {
      setMessage({ type: 'error', text: 'Duration must be at least 1 day.' });
      return;
    }

    const features = featuresText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        currency: currency.trim() || 'INR',
        billingInterval,
        durationDays: durationNum,
        features,
        isRecommended,
        isActive,
        displayOrder: parseInt(displayOrder, 10) || 0,
      };

      let res;
      if (editingPlan) {
        res = await updateBillingPlanAction({ id: editingPlan.id, ...payload });
      } else {
        res = await createBillingPlanAction(payload);
      }

      if (res.success) {
        const msg = 'message' in res ? (res as any).message : undefined;
        setMessage({ type: 'success', text: msg || 'Plan saved successfully.' });
        setIsModalOpen(false);
        await loadPlans();
      } else {
        const err = 'error' in res ? (res as any).error : undefined;
        setMessage({ type: 'error', text: err || 'Failed to save plan.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save plan.' });
    } finally {
      setSaving(false);
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleToggle(plan: BillingPlan) {
    setTogglingId(plan.id);
    try {
      const res = await toggleBillingPlanAction(plan.id, !plan.is_active);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Status updated.' });
        await loadPlans();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to toggle status.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to toggle status.' });
    } finally {
      setTogglingId(null);
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleDelete(plan: BillingPlan) {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This cannot be undone.`)) return;

    setDeletingId(plan.id);
    try {
      const res = await deleteBillingPlanAction(plan.id);
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Plan deleted.' });
        await loadPlans();
      } else {
        setMessage({ type: 'error', text: res.error || 'Cannot delete plan.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Cannot delete plan.' });
    } finally {
      setDeletingId(null);
    }
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0] flex items-center gap-2">
            <Layers className="w-4 h-4 text-bce-cobalt dark:text-amber-400" />
            Billing Plan Management
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#c4a97d] mt-0.5">
            Database-driven pricing models & subscription features.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Plan
        </button>
      </div>

      {message && (
        <div
          className={`rounded-[3px] p-3 text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="h-32 bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-amber-200/50 dark:border-[#382710]/50 animate-pulse flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-400 dark:text-amber-500 animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 dark:text-[#c4a97d] bg-slate-50 dark:bg-[#140e07] rounded-[3px] border border-dashed border-amber-200/80 dark:border-[#382710]">
          No billing plans configured in database. Click &quot;Add New Plan&quot; to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-[3px] border p-4 flex flex-col justify-between transition ${
                plan.is_active
                  ? 'border-amber-200/80 dark:border-[#382710] bg-white dark:bg-[#140e07] shadow-xs'
                  : 'border-amber-200/50 dark:border-[#382710]/60 bg-slate-50 dark:bg-[#140e07]/60 opacity-60'
              }`}
            >
              {plan.is_recommended && (
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-xs flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" /> Recommended
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-slate-900 dark:text-[#faebd0] text-base">{plan.name}</h4>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-[2px] bg-slate-100 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] border border-amber-200/60 dark:border-[#382710] uppercase font-semibold">
                    {plan.billing_interval}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#c4a97d] mb-3 line-clamp-2">{plan.description || 'No description'}</p>

                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-[#faebd0]">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#c4a97d] font-medium">
                    {plan.duration_days ? `/ ${plan.duration_days} days` : '/ unlimited'}
                  </span>
                </div>

                <ul className="space-y-1 text-xs text-slate-600 dark:text-[#c4a97d] mb-4">
                  {plan.features?.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-amber-100 dark:border-[#382710] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggle(plan)}
                  disabled={togglingId === plan.id}
                  aria-busy={togglingId === plan.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[11px] font-medium transition disabled:opacity-50 cursor-pointer ${
                    plan.is_active
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                      : 'bg-slate-200 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] hover:bg-slate-300 dark:hover:bg-[#2a1d0f]'
                  }`}
                >
                  {togglingId === plan.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : plan.is_active ? (
                    <ToggleRight className="w-3.5 h-3.5" />
                  ) : (
                    <ToggleLeft className="w-3.5 h-3.5" />
                  )}
                  <span>{togglingId === plan.id ? 'Updating...' : plan.is_active ? 'Active' : 'Disabled'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1.5 rounded-[2px] text-slate-500 dark:text-[#c4a97d] hover:text-slate-800 dark:hover:text-[#faebd0] hover:bg-slate-100 dark:hover:bg-[#20150b] transition cursor-pointer"
                    title="Edit Plan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    disabled={deletingId === plan.id}
                    aria-busy={deletingId === plan.id}
                    className="p-1.5 rounded-[2px] text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50 cursor-pointer"
                    title="Delete Plan"
                  >
                    {deletingId === plan.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal (Add/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-amber-100 dark:border-[#382710]">
              <h3 className="font-bold text-slate-900 dark:text-[#faebd0] text-base">
                {editingPlan ? `Edit "${editingPlan.name}"` : 'Create New Billing Plan'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 dark:text-[#a08862] hover:text-slate-600 dark:hover:text-[#faebd0] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., MONTHLY, QUARTERLY, PRO"
                  className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short tagline or plan benefit"
                  className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Interval *</label>
                  <select
                    value={billingInterval}
                    onChange={e => setBillingInterval(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer transition-all"
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="ONETIME">ONETIME</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={e => setDurationDays(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={e => setDisplayOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-[#faebd0] font-semibold mb-1">
                  Features (One per line)
                </label>
                <textarea
                  value={featuresText}
                  onChange={e => setFeaturesText(e.target.value)}
                  placeholder="Google Form generation&#10;Google Sheet integration&#10;Priority Support"
                  className="w-full px-3 py-2 rounded-[3px] bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] text-slate-900 dark:text-[#faebd0] text-sm h-24 resize-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecommended}
                    onChange={e => setIsRecommended(e.target.checked)}
                    className="rounded-[2px] text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-slate-700 dark:text-[#faebd0]">Mark as Recommended</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded-[2px] text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-slate-700 dark:text-[#faebd0]">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-amber-100 dark:border-[#382710]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-[3px] border border-amber-200/80 dark:border-[#382710] text-slate-600 dark:text-[#c4a97d] hover:bg-slate-50 dark:hover:bg-[#20150b] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[3px] bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 transition disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? (editingPlan ? 'Updating Plan...' : 'Saving Plan...') : (editingPlan ? 'Update Plan' : 'Save Plan')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
