'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Stamp,
  Layers,
  Image as ImageIcon,
  Type,
  Shield,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Save,
  Loader2,
  Sparkles,
  LayoutGrid,
  Sliders,
  Eye,
  Info,
} from 'lucide-react';
import type { College } from '@/types/tenant';
import {
  type CollegeWatermarkConfig,
  type WatermarkFormat,
  type WatermarkContentType,
  type WatermarkPaymentPolicy,
  type WatermarkLogoSource,
  DEFAULT_WATERMARK_CONFIG,
} from '@/lib/pdf/watermark-types';
import {
  getCollegeWatermarkAction,
  saveCollegeWatermarkAction,
  resetCollegeWatermarkAction,
} from '@/app/admin/institutions/watermark-actions';
import { WatermarkLivePreview } from './WatermarkLivePreview';

interface WatermarkManagementModalProps {
  college: College | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedConfig: CollegeWatermarkConfig) => void;
}

const PRESET_TEXTS = [
  'CampusFlow provides FREE TRIAL to {college_name}',
  'FREE TRIAL — CampusFlow Verification',
  'CAMPUSFLOW TRIAL VERSION — UNPAID',
  'CONFIDENTIAL & PROPRIETARY EVALUATION',
  'OFFICIAL EVALUATION COPY ONLY',
];

const PRESET_COLORS = [
  { name: 'Slate Gray', hex: '#64748B' },
  { name: 'Cool Dark', hex: '#334155' },
  { name: 'Royal Blue', hex: '#2563EB' },
  { name: 'Crimson Red', hex: '#DC2626' },
  { name: 'Amber Warning', hex: '#D97706' },
  { name: 'Deep Violet', hex: '#7C3AED' },
];

export function WatermarkManagementModal({
  college,
  isOpen,
  onClose,
  onSaved,
}: WatermarkManagementModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [config, setConfig] = useState<CollegeWatermarkConfig>({
    collegeId: college?.id || '',
    ...DEFAULT_WATERMARK_CONFIG,
  });

  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');

  // Load watermark configuration when modal opens
  useEffect(() => {
    if (!isOpen || !college) return;

    let mounted = true;
    setLoading(true);
    setMessage(null);

    getCollegeWatermarkAction(college.id).then((res) => {
      if (!mounted) return;
      if (res.success && res.config) {
        setConfig(res.config);
        setIsPaid(Boolean(res.isPaid));
      } else {
        setMessage({
          text: res.error || 'Failed to load watermark configuration.',
          type: 'error',
        });
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, college]);

  if (!isOpen || !college) return null;

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const res = await saveCollegeWatermarkAction(config);
    setSaving(false);

    if (res.success && res.config) {
      showToast('Watermark configuration saved successfully!', 'success');
      if (onSaved) onSaved(res.config);
    } else {
      showToast(res.error || 'Failed to save watermark configuration.', 'error');
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset watermark settings to default?')) return;

    setResetting(true);
    const res = await resetCollegeWatermarkAction(college.id);
    setResetting(false);

    if (res.success && res.config) {
      setConfig(res.config);
      showToast('Watermark reset to default settings.', 'success');
      if (onSaved) onSaved(res.config);
    } else {
      showToast(res.error || 'Failed to reset settings.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* ========================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  PDF Watermark Management
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-indigo-950/60 text-indigo-300 border-indigo-800">
                  {college.code || 'CODE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {college.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Payment & Subscription Indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                isPaid
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>
                {isPaid ? 'Active Paid Subscription' : 'Free / Trial Subscription'}
              </span>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                Live Preview
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Toast */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
                : 'bg-red-950/90 text-red-200 border-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* MAIN BODY: SPLIT VIEW (SETTINGS + LIVE PREVIEW) */}
        {/* ========================================================= */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm">Loading watermark settings & billing state...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            {/* LEFT COLUMN: SETTINGS PANEL */}
            <div
              className={`lg:col-span-6 xl:col-span-5 p-6 overflow-y-auto max-h-[calc(94vh-140px)] space-y-6 ${
                activeTab === 'preview' ? 'hidden lg:block' : 'block'
              }`}
            >
              {/* 1. MASTER TOGGLE & PAYMENT POLICY CARD */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Enable Watermark</h3>
                      <p className="text-[11px] text-slate-400">
                        Master switch for this institution&apos;s PDFs
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Payment Logic Notice & Override */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-slate-300">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Payment Logic:</strong> Paid subscriptions automatically receive clean,
                      watermark-free PDFs. For unpaid or free trial institutions, Superadmins can
                      decide whether watermarks appear and customize their text, logo, and format.
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Superadmin Payment Policy Override:
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                      {[
                        {
                          val: 'auto',
                          label: 'Automatic (Default)',
                          desc: 'No watermark on Paid plans; Watermark rendered on Unpaid/Trial',
                        },
                        {
                          val: 'always_show',
                          label: 'Force Show Watermark',
                          desc: 'Always display watermark, even if the college has an active paid plan',
                        },
                        {
                          val: 'always_hide',
                          label: 'Waive Watermark (Exempt)',
                          desc: 'Never display watermark, even if the college is on a free/unpaid plan',
                        },
                      ].map((pol) => (
                        <label
                          key={pol.val}
                          className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            config.paymentPolicy === pol.val
                              ? 'bg-blue-950/40 border-blue-600 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentPolicy"
                            checked={config.paymentPolicy === pol.val}
                            onChange={() =>
                              setConfig((c) => ({
                                ...c,
                                paymentPolicy: pol.val as WatermarkPaymentPolicy,
                              }))
                            }
                            className="mt-0.5 text-blue-600"
                          />
                          <div>
                            <span className="font-semibold block text-slate-200">
                              {pol.label}
                            </span>
                            <span className="text-[10px] text-slate-400">{pol.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CONTENT TYPE (TEXT + LOGO / TEXT ONLY / LOGO ONLY) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Watermark Content Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'both', label: 'Text + Logo', icon: Layers },
                    { val: 'text_only', label: 'Text Only', icon: Type },
                    { val: 'logo_only', label: 'Logo Only', icon: ImageIcon },
                  ].map((ct) => {
                    const Icon = ct.icon;
                    return (
                      <button
                        key={ct.val}
                        type="button"
                        onClick={() =>
                          setConfig((c) => ({ ...c, contentType: ct.val as WatermarkContentType }))
                        }
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                          config.contentType === ct.val
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{ct.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. MULTIPLE FORMATS SELECTION */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Watermark Format / Preset
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      val: 'diagonal_bands',
                      title: 'Diagonal Bands',
                      desc: 'Multi-band repeating diagonal coverage with center logo',
                    },
                    {
                      val: 'center_prominent',
                      title: 'Center Stamp',
                      desc: 'Large prominent security seal in the middle of page',
                    },
                    {
                      val: 'full_grid',
                      title: 'Full Grid Matrix',
                      desc: 'Tiled anti-tamper watermark pattern across entire page',
                    },
                    {
                      val: 'top_bottom_banner',
                      title: 'Top & Bottom Bands',
                      desc: 'Prominent header & footer official security ribbons',
                    },
                  ].map((fmt) => (
                    <button
                      key={fmt.val}
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({ ...c, format: fmt.val as WatermarkFormat }))
                      }
                      className={`text-left p-3 rounded-xl border text-xs transition-all ${
                        config.format === fmt.val
                          ? 'bg-indigo-950/50 border-indigo-500 text-white ring-1 ring-indigo-500'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold block text-slate-200 mb-0.5">
                        {fmt.title}
                      </span>
                      <span className="text-[10.5px] text-slate-400 leading-snug block">
                        {fmt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. TEXT SETTINGS */}
              {config.contentType !== 'logo_only' && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Type className="w-4 h-4 text-blue-400" />
                    <span>Watermark Text Configuration</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Primary Watermark Text
                    </label>
                    <input
                      type="text"
                      value={config.text}
                      onChange={(e) => setConfig((c) => ({ ...c, text: e.target.value }))}
                      placeholder="e.g. CampusFlow provides FREE TRIAL to {college_name}"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Use <code className="text-blue-400">{'{college_name}'}</code> to dynamically
                      insert the institution&apos;s real name.
                    </p>
                  </div>

                  {/* Preset quick buttons */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Quick Preset Text:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TEXTS.map((txt) => (
                        <button
                          key={txt}
                          type="button"
                          onClick={() => setConfig((c) => ({ ...c, text: txt }))}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          {txt.replace('{college_name}', college.code || 'Institution')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Secondary Text / Brand URL
                    </label>
                    <input
                      type="text"
                      value={config.subText}
                      onChange={(e) => setConfig((c) => ({ ...c, subText: e.target.value }))}
                      placeholder="CampusFlow • 143campusflow.vercel.app"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Font Size & Colors */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                        <span>Font Size</span>
                        <span className="font-mono text-blue-400">{config.fontSize || 13}pt</span>
                      </div>
                      <input
                        type="range"
                        min="9"
                        max="26"
                        step="1"
                        value={config.fontSize || 13}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, fontSize: parseInt(e.target.value, 10) }))
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Watermark Color
                      </label>
                      <div className="flex items-center gap-1.5">
                        {PRESET_COLORS.map((pc) => (
                          <button
                            key={pc.hex}
                            type="button"
                            onClick={() => setConfig((c) => ({ ...c, textColor: pc.hex }))}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              config.textColor === pc.hex
                                ? 'scale-110 border-white ring-2 ring-blue-500'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: pc.hex }}
                            title={pc.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. LOGO SETTINGS */}
              {config.contentType !== 'text_only' && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Logo Configuration</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'campusflow', label: 'CampusFlow Logo' },
                      { val: 'college', label: 'College Logo' },
                      { val: 'custom', label: 'Custom URL' },
                    ].map((ls) => (
                      <button
                        key={ls.val}
                        type="button"
                        onClick={() =>
                          setConfig((c) => ({ ...c, logoSource: ls.val as WatermarkLogoSource }))
                        }
                        className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-all ${
                          config.logoSource === ls.val
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>

                  {config.logoSource === 'custom' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Custom Logo Image URL (PNG / JPG)
                      </label>
                      <input
                        type="url"
                        value={config.customLogoUrl || ''}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, customLogoUrl: e.target.value }))
                        }
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Logo Size (Center/Prominent)</span>
                      <span className="font-mono text-emerald-400">
                        {config.logoSize || 150}pt
                      </span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="240"
                      step="10"
                      value={config.logoSize || 150}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, logoSize: parseInt(e.target.value, 10) }))
                      }
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              )}

              {/* 6. OPACITY & ROTATION CONTROLS */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Opacity & Visual Angle</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Watermark Opacity</span>
                      <span className="font-mono text-amber-400">
                        {Math.round((config.opacity ?? 0.14) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.70"
                      step="0.01"
                      value={config.opacity ?? 0.14}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, opacity: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 px-0.5 mt-0.5">
                      <span>5% (Subtle)</span>
                      <span>14% (Default - Clear & Readable)</span>
                      <span>70% (Prominent)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span>Rotation Angle</span>
                      <span className="font-mono text-amber-400">
                        {config.rotationAngle ?? -24}°
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[-45, -30, -24, 0, 30, 45].map((ang) => (
                        <button
                          key={ang}
                          type="button"
                          onClick={() => setConfig((c) => ({ ...c, rotationAngle: ang }))}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                            config.rotationAngle === ang
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ang}°
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: INTERACTIVE LIVE PREVIEW CANVAS */}
            <div
              className={`lg:col-span-6 xl:col-span-7 p-4 lg:p-6 bg-slate-950/40 flex flex-col ${
                activeTab === 'settings' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <WatermarkLivePreview
                config={config}
                collegeName={college.name}
                collegeCode={college.code}
                collegeLogoUrl={college.logo_url || undefined}
                isPaid={isPaid}
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || resetting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs font-bold hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Watermark Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

