'use client';

import React from 'react';

export interface ExamPadCardProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  clipLabel?: string;
  variant?: 'card' | 'dashboard' | 'compact';
  className?: string;
  paperClassName?: string;
  id?: string;
}

/**
 * High-fidelity SVG render of the vintage "ROYAL" metallic exam pad clip
 * matching the authentic Indian student examination clipboard.
 */
export function ExamPadClip({
  label = 'ROYAL',
  size = 'default',
  className = '',
}: {
  label?: string;
  size?: 'default' | 'compact';
  className?: string;
}) {
  const isCompact = size === 'compact';
  const width = isCompact ? 140 : 180;
  const height = isCompact ? 46 : 56;

  return (
    <div
      aria-hidden="true"
      className={`absolute top-1 sm:top-1.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.38)] ${className}`}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 190 58"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-9 sm:h-12 md:h-14 overflow-visible"
      >
        <defs>
          {/* Main Brushed Chrome Gradient */}
          <linearGradient id="chromeBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="18%" stopColor="#e2e8f0" />
            <stop offset="42%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#cbd5e1" />
            <stop offset="90%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Grip Bar Chrome Reflection */}
          <linearGradient id="chromeBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="12%" stopColor="#cbd5e1" />
            <stop offset="28%" stopColor="#ffffff" />
            <stop offset="48%" stopColor="#94a3b8" />
            <stop offset="68%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Stamped Recessed Brand Area */}
          <linearGradient id="recessGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="35%" stopColor="#64748b" />
            <stop offset="80%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          {/* Rivet / Fastener Radial Highlights */}
          <radialGradient id="rivetGrad1" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="80%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>

          {/* Spring Barrel Gradient */}
          <linearGradient id="springGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="20%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="75%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Drop shadow filter for clamp edge */}
          <filter id="clampShadow" x="-10%" y="0%" width="120%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1a0a03" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. TOP HANGING ARCH & HOLE (Mounted to board) */}
        <path
          d="M 80 18 C 80 4, 110 4, 110 18 Z"
          fill="url(#chromeBodyGrad)"
          stroke="#475569"
          strokeWidth="0.8"
        />
        {/* Arch inner highlight & border */}
        <path
          d="M 82 17 C 82 7, 108 7, 108 17"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="0.8"
          fill="none"
        />
        {/* Hanging Hole (allows board to be hung on wall hook/nail) */}
        <circle cx="95" cy="11.5" r="5.5" fill="#4a2209" stroke="#1e293b" strokeWidth="1" />
        <circle cx="95" cy="11.5" r="4.2" fill="#2d1304" />
        <circle cx="95" cy="11.5" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" fill="none" />

        {/* 2. MAIN SPRING MECHANISM BARREL (behind bracket) */}
        <rect
          x="77"
          y="15"
          width="36"
          height="8"
          rx="3"
          fill="url(#springGrad)"
          stroke="#334155"
          strokeWidth="0.8"
        />
        {/* Spring coil grooves */}
        <line x1="83" y1="15" x2="83" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="89" y1="15" x2="89" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="95" y1="15" x2="95" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="101" y1="15" x2="101" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="107" y1="15" x2="107" y2="23" stroke="#1e293b" strokeWidth="1" />

        {/* 3. BASE MOUNTING PLATE (with side wings and curved ears) */}
        <path
          d="M 16 26 C 16 20, 24 18, 32 18 L 158 18 C 166 18, 174 20, 174 26 L 176 38 C 176 43, 168 44, 160 44 L 30 44 C 22 44, 14 43, 14 38 Z"
          fill="url(#chromeBodyGrad)"
          stroke="#475569"
          strokeWidth="0.9"
        />
        {/* Top edge metallic gloss highlight */}
        <path
          d="M 22 19.5 L 168 19.5"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* 4. LEFT MOUNTING RIVET */}
        <circle cx="28" cy="30" r="5.5" fill="url(#rivetGrad1)" stroke="#334155" strokeWidth="0.8" />
        <circle cx="28" cy="30" r="4.2" stroke="rgba(255,255,255,0.6)" strokeWidth="0.6" fill="none" />
        <line x1="25.5" y1="30" x2="30.5" y2="30" stroke="#1e293b" strokeWidth="1" />

        {/* 5. RIGHT MOUNTING RIVET */}
        <circle cx="162" cy="30" r="5.5" fill="url(#rivetGrad1)" stroke="#334155" strokeWidth="0.8" />
        <circle cx="162" cy="30" r="4.2" stroke="rgba(255,255,255,0.6)" strokeWidth="0.6" fill="none" />
        <line x1="159.5" y1="30" x2="164.5" y2="30" stroke="#1e293b" strokeWidth="1" />

        {/* 6. EMBOSSED BRAND BADGE (Stamped "ROYAL" as in original exam board) */}
        <rect
          x="58"
          y="22"
          width="74"
          height="16"
          rx="3"
          fill="url(#recessGrad)"
          stroke="#334155"
          strokeWidth="0.8"
        />
        <rect
          x="59"
          y="23"
          width="72"
          height="14"
          rx="2"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.6"
          fill="none"
        />
        {/* Stamped Text with Authentic Chiseled Bevel Effect */}
        <text
          x="95"
          y="34"
          textAnchor="middle"
          fill="#1e293b"
          fontSize="10"
          fontWeight="900"
          letterSpacing="2.8"
          fontFamily="system-ui, -apple-system, sans-serif"
          className="select-none"
        >
          {label}
        </text>
        <text
          x="95"
          y="33.3"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="10"
          fontWeight="900"
          letterSpacing="2.8"
          fontFamily="system-ui, -apple-system, sans-serif"
          className="select-none opacity-80"
        >
          {label}
        </text>

        {/* 7. LOWER GRIPPING CLAMP BAR (Clamps down onto paper sheet) */}
        <g filter="url(#clampShadow)">
          {/* Main Grip Bar Cylinder */}
          <rect
            x="8"
            y="41"
            width="174"
            height="12"
            rx="4.5"
            fill="url(#chromeBarGrad)"
            stroke="#475569"
            strokeWidth="0.8"
          />
          {/* Gloss Specular Highlight Line on Grip Bar */}
          <line
            x1="14"
            y1="43.5"
            x2="176"
            y2="43.5"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Lower Contact Shadow Edge */}
          <line
            x1="12"
            y1="51.5"
            x2="178"
            y2="51.5"
            stroke="#1e293b"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * ExamPadCard:
 * A realistic, responsive Indian student exam writing board (exam pad) wrapper.
 * Renders the wooden hardboard base, top vintage metal spring clip, and paper sheet.
 */
export function ExamPadCard({
  children,
  title,
  subtitle,
  badge,
  icon,
  action,
  clipLabel = 'ROYAL',
  variant = 'card',
  className = '',
  paperClassName = '',
  id,
}: ExamPadCardProps) {
  const isDashboard = variant === 'dashboard';
  const isCompact = variant === 'compact';

  // Board style variations
  const boardClass = isDashboard || isCompact ? 'exam-pad-board-dashboard' : 'exam-pad-board';

  return (
    <div
      id={id}
      className={`relative w-full ${boardClass} ${
        isDashboard
          ? 'rounded-lg p-2 sm:p-3 md:p-3.5 pt-7 sm:pt-8 md:pt-9'
          : isCompact
          ? 'rounded-md p-2 sm:p-2.5 pt-6 sm:pt-7'
          : 'rounded-xl p-2.5 sm:p-4 md:p-5 pt-8 sm:pt-10 md:pt-12'
      } ${className}`}
    >
      {/* Authentic Top Metal Exam Clip */}
      <ExamPadClip
        label={clipLabel}
        size={isDashboard || isCompact ? 'compact' : 'default'}
      />

      {/* The Paper Sheet (Clamped beneath clip, holds the form content with crisp sharp paper corners) */}
      <div
        className={`relative z-10 w-full exam-pad-paper rounded-[3px] transition-all ${
          isDashboard
            ? 'p-3.5 sm:p-4 md:p-5'
            : isCompact
            ? 'p-3 sm:p-4'
            : 'p-4 sm:p-7 md:p-9'
        } ${paperClassName}`}
      >
        {/* Optional Header (for Add Faculty, Add Subject, Assignment, etc.) */}
        {(title || icon || badge || action) && (
          <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5 pb-3 border-b border-slate-200/80 dark:border-[#4d3817]">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-sm bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeof title === 'string' ? (
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#faebd0] tracking-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-slate-100 dark:bg-[#22170d] text-slate-600 dark:text-[#c4a97d] border border-slate-200 dark:border-[#4d3817]">
                      {badge}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-[#c4a97d] mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}

        {/* Paper Body Content (Form elements, inputs, buttons) */}
        {children}
      </div>
    </div>
  );
}

export default ExamPadCard;
