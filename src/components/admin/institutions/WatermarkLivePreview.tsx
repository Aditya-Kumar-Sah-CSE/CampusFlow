'use client';

import React, { useState } from 'react';
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Shield,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { CollegeWatermarkConfig } from '@/lib/pdf/watermark-types';
import { formatWatermarkText } from '@/lib/pdf/watermark-types';

interface WatermarkLivePreviewProps {
  config: CollegeWatermarkConfig;
  collegeName: string;
  collegeCode: string;
  collegeLogoUrl?: string;
  isPaid?: boolean;
}

export function WatermarkLivePreview({
  config,
  collegeName,
  collegeCode,
  collegeLogoUrl,
  isPaid,
}: WatermarkLivePreviewProps) {
  const [sampleDocType, setSampleDocType] = useState<'report' | 'exam' | 'certificate'>('report');
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const effectiveCollege = collegeName || 'Bhagalpur College of Engineering';
  const effectiveCode = collegeCode || '108';

  const primaryText = formatWatermarkText(config.text, effectiveCollege, effectiveCode);
  const secondaryText = config.subText || 'CampusFlow • 143campusflow.vercel.app';
  const textColor = config.textColor || '#64748B';
  const opacity = Math.min(Math.max(config.opacity || 0.55, 0.05), 0.95);
  const rotationAngle = typeof config.rotationAngle === 'number' ? config.rotationAngle : -24;

  const showWatermark =
    config.enabled || config.paymentPolicy === 'always_show';

  const includeLogo = config.contentType !== 'text_only';
  const includeText = config.contentType !== 'logo_only';

  // Real PDF Preview Handler
  const handleOpenRealPdf = async () => {
    try {
      setGeneratingPdf(true);
      const res = await fetch('/api/admin/watermark/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          collegeName: effectiveCollege,
          collegeCode: effectiveCode,
          sampleType: sampleDocType,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate PDF: ${res.statusText}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err: any) {
      alert('Error previewing real PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
      {/* Top Bar with Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Interactive Live PDF Canvas</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-[11px] text-slate-400">
            {showWatermark ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Watermark Visible
              </span>
            ) : (
              <span className="text-slate-400 italic">Watermark Suppressed</span>
            )}
          </span>
        </div>

        {/* Document Type Selector & Zoom */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/50">
            <button
              type="button"
              onClick={() => setSampleDocType('report')}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                sampleDocType === 'report'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Academic Report
            </button>
            <button
              type="button"
              onClick={() => setSampleDocType('exam')}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                sampleDocType === 'exam'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exam Roster
            </button>
            <button
              type="button"
              onClick={() => setSampleDocType('certificate')}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                sampleDocType === 'certificate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Event Pass
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-400 font-mono px-1">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.2, z + 0.1))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenRealPdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold hover:from-blue-500 hover:to-indigo-500 shadow-md transition-all active:scale-95 disabled:opacity-50"
            title="Generate and view real PDFKit output"
          >
            {generatingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            <span>Live PDF View</span>
          </button>
        </div>
      </div>

      {/* Preview Viewport */}
      <div className="relative flex-1 overflow-auto p-6 flex justify-center items-start bg-slate-950/50 min-h-[500px]">
        {/* Simulated A4 Paper */}
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            width: '595px',
            minHeight: '842px',
          }}
          className="relative bg-white text-slate-900 rounded shadow-2xl overflow-hidden select-none transition-transform duration-150 border border-slate-300"
        >
          {/* Top Blue Accent */}
          <div className="h-1.5 bg-blue-600 w-full" />

          {/* Document Header */}
          <div className="px-8 pt-6 pb-4 border-b border-slate-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700">
                CF
              </div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase text-slate-900">
                {effectiveCollege}
              </h2>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Institution Code: {effectiveCode} • CampusFlow Academic Cloud Enterprise
            </p>
          </div>

          {/* Sample Title Badge */}
          <div className="px-8 py-3 bg-slate-100/80 text-center border-b border-slate-200">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              {sampleDocType === 'exam'
                ? 'Official Examination Merit Verification Report'
                : sampleDocType === 'certificate'
                ? 'Official Event Pass & Registration Record'
                : 'Student Performance & Semester Evaluation Sheet'}
            </span>
          </div>

          {/* Candidate / Record Details */}
          <div className="mx-8 my-4 p-3 bg-slate-50 rounded border border-slate-200 text-[10px] grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 font-semibold block text-[9px]">STUDENT NAME</span>
              <span className="font-bold text-slate-800">Aditya Kumar Sah</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[9px]">REGISTRATION NO.</span>
              <span className="font-bold text-slate-800">21108107001 (B.Tech)</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[9px]">ACADEMIC SESSION</span>
              <span className="font-bold text-slate-800">2026 - 2027</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[9px]">SECURITY VERIFICATION</span>
              <span className="font-mono text-blue-600 font-medium">SHA-256: 7f8a9e01...c4b2</span>
            </div>
          </div>

          {/* Mock Score Table */}
          <div className="mx-8 my-3">
            <table className="w-full text-left text-[9.5px] border border-slate-200">
              <thead className="bg-slate-800 text-white font-semibold">
                <tr>
                  <th className="p-1.5 text-center w-8">#</th>
                  <th className="p-1.5">Course / Module</th>
                  <th className="p-1.5 text-center">Score</th>
                  <th className="p-1.5">Grade</th>
                  <th className="p-1.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr className="bg-white">
                  <td className="p-1.5 text-center font-bold">1</td>
                  <td className="p-1.5 font-medium">Distributed Systems & Cloud Computing</td>
                  <td className="p-1.5 text-center font-mono">94/100</td>
                  <td className="p-1.5 font-bold text-blue-700">Grade A+</td>
                  <td className="p-1.5 text-right text-emerald-600 font-bold">VERIFIED</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-1.5 text-center font-bold">2</td>
                  <td className="p-1.5 font-medium">Machine Learning & Neural Architecture</td>
                  <td className="p-1.5 text-center font-mono">91/100</td>
                  <td className="p-1.5 font-bold text-blue-700">Grade A+</td>
                  <td className="p-1.5 text-right text-emerald-600 font-bold">VERIFIED</td>
                </tr>
                <tr className="bg-white">
                  <td className="p-1.5 text-center font-bold">3</td>
                  <td className="p-1.5 font-medium">Software Security & Cryptography</td>
                  <td className="p-1.5 text-center font-mono">88/100</td>
                  <td className="p-1.5 font-bold text-blue-700">Grade A</td>
                  <td className="p-1.5 text-right text-emerald-600 font-bold">VERIFIED</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="p-1.5 text-center font-bold">4</td>
                  <td className="p-1.5 font-medium">Autonomous Systems Capstone</td>
                  <td className="p-1.5 text-center font-mono">98/100</td>
                  <td className="p-1.5 font-bold text-amber-700">Grade O</td>
                  <td className="p-1.5 text-right text-emerald-600 font-bold">VERIFIED</td>
                </tr>
                <tr className="bg-white">
                  <td className="p-1.5 text-center font-bold">5</td>
                  <td className="p-1.5 font-medium">Faculty & Institutional Feedback</td>
                  <td className="p-1.5 text-center font-mono">4.92/5.0</td>
                  <td className="p-1.5 font-bold text-emerald-700">Top 1%</td>
                  <td className="p-1.5 text-right text-emerald-600 font-bold">VERIFIED</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Summary Box */}
          <div className="mx-8 my-4 p-2.5 bg-slate-100 rounded border border-slate-200 text-[9px] text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800 block text-[9.5px] mb-0.5">
              Cumulative Merit Evaluation:
            </span>
            CGPA: <strong className="text-slate-800">9.68 / 10.00</strong> • Classification: First Class with Distinction • Total Credits: 24.5. Validated by CampusFlow Security Authority.
          </div>

          {/* Signature Lines */}
          <div className="mx-8 mt-12 mb-8 flex justify-between items-end text-[9px] text-slate-500">
            <div className="text-center w-40">
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-700">
                Dean / Controller of Exams
              </div>
            </div>
            <div className="text-center w-40">
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-700">
                Institutional Verification Seal
              </div>
            </div>
          </div>

          {/* Single-Line Footer Attribution Line (The exact new attribution line!) */}
          <div className="absolute bottom-2 left-0 right-0 px-4 text-center border-t border-slate-200/80 pt-1.5">
            <p className="text-[7px] text-slate-500 leading-tight">
              Designed and developed by{' '}
              <span className="font-bold text-blue-600 underline">Mr. Aditya Kumar Sah</span>
              {' '}•{' '}
              <span className="font-bold text-blue-600 underline">Developer Portfolio</span>
              {' '}under the guidance of{' '}
              <span className="font-bold text-blue-600 underline">Dr. Abhinav Kumar</span>
              {' '}(Assistant Professor; BCE, Bhagalpur){' '}
              <span className="font-bold text-blue-600 underline">(Official Order)</span>
            </p>
          </div>

          {/* ======================================================== */}
          {/* WATERMARK OVERLAY LAYER */}
          {/* ======================================================== */}
          {showWatermark && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ opacity }}
            >
              {/* FORMAT 1: DIAGONAL BANDS */}
              {config.format === 'diagonal_bands' && (
                <div className="relative w-full h-full flex flex-col justify-around py-12">
                  {/* Center large logo */}
                  {includeLogo && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-70">
                      <div
                        style={{ width: `${config.logoSize || 150}px`, height: `${config.logoSize || 150}px` }}
                        className="rounded-full border-4 border-slate-400/40 flex items-center justify-center bg-slate-200/20 shadow-inner"
                      >
                        <Shield className="w-3/5 h-3/5 text-slate-500/70" />
                      </div>
                    </div>
                  )}

                  {/* Diagonal Bands */}
                  {[1, 2, 3, 4].map((bandIdx) => (
                    <div
                      key={bandIdx}
                      style={{
                        transform: `rotate(${rotationAngle}deg)`,
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2"
                    >
                      {includeLogo && (
                        <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">
                          CF
                        </div>
                      )}
                      {includeText && (
                        <div className="text-center font-bold tracking-tight" style={{ color: textColor }}>
                          <span style={{ fontSize: `${config.fontSize || 13}px` }}>
                            {primaryText}
                          </span>
                          {secondaryText && (
                            <span className="text-[9px] font-normal opacity-80 ml-2">
                              • {secondaryText}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FORMAT 2: CENTER PROMINENT */}
              {config.format === 'center_prominent' && (
                <div className="w-full h-full flex items-center justify-center p-8">
                  {/* Center large watermark stamp */}
                  <div
                    style={{
                      transform: `rotate(${rotationAngle}deg)`,
                      borderColor: textColor,
                      color: textColor,
                    }}
                    className="border-4 rounded-xl p-6 text-center max-w-[420px] shadow-sm bg-white/10 backdrop-blur-[0.5px]"
                  >
                    {includeLogo && (
                      <div className="mx-auto mb-2 w-16 h-16 rounded-full border-2 border-current flex items-center justify-center">
                        <Shield className="w-10 h-10 text-current" />
                      </div>
                    )}
                    {includeText && (
                      <>
                        <div
                          className="font-extrabold uppercase tracking-wide leading-tight"
                          style={{ fontSize: `${Math.max(16, (config.fontSize || 14) * 1.3)}px` }}
                        >
                          {primaryText}
                        </div>
                        {secondaryText && (
                          <div className="text-[10px] font-bold tracking-widest uppercase mt-1 border-t border-current/40 pt-1">
                            {secondaryText}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* FORMAT 3: FULL GRID */}
              {config.format === 'full_grid' && (
                <div className="w-full h-full grid grid-cols-3 grid-rows-4 p-4 gap-4">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        transform: `rotate(${rotationAngle}deg)`,
                        color: textColor,
                      }}
                      className="flex flex-col items-center justify-center text-center p-2"
                    >
                      {includeLogo && (
                        <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[6px] font-bold mb-0.5">
                          CF
                        </div>
                      )}
                      {includeText && (
                        <>
                          <div
                            className="font-bold tracking-tight text-[10px] leading-tight"
                            style={{ fontSize: `${Math.max(8, (config.fontSize || 12) * 0.75)}px` }}
                          >
                            {primaryText}
                          </div>
                          {secondaryText && (
                            <div className="text-[7px] opacity-75 font-mono">
                              {secondaryText}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FORMAT 4: TOP & BOTTOM BANNER */}
              {config.format === 'top_bottom_banner' && (
                <div className="w-full h-full flex flex-col justify-between p-4">
                  {/* Top Security Banner */}
                  <div
                    style={{ borderColor: textColor, color: textColor }}
                    className="border-2 rounded py-1 px-4 text-center font-bold text-[9px] uppercase tracking-wider bg-white/20"
                  >
                    {primaryText} • {secondaryText}
                  </div>

                  {/* Faint center logo */}
                  {includeLogo && (
                    <div className="flex items-center justify-center opacity-40">
                      <Shield className="w-32 h-32" style={{ color: textColor }} />
                    </div>
                  )}

                  {/* Bottom Security Banner */}
                  <div
                    style={{ borderColor: textColor, color: textColor }}
                    className="border-2 rounded py-1 px-4 text-center font-bold text-[9px] uppercase tracking-wider bg-white/20"
                  >
                    {primaryText} • {secondaryText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

