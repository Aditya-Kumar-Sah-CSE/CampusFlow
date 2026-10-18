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
 * High-fidelity SVG render of the vintage metallic exam pad clip
 * matching the authentic Indian student examination clipboard.
 * Features an authentic brushed chrome clamp, spring mechanism, and embossed label badge.
 */
export function ExamPadClip({
  label = 'CAMPUSFLOW',
  size = 'default',
  className = '',
}: {
  label?: string;
  size?: 'default' | 'compact';
  className?: string;
}) {
  const isCompact = size === 'compact';
  const cleanLabel = (label || 'CAMPUSFLOW').trim();

  // Dynamic badge width: scales smoothly with text length to ensure text never touches rivets
  const badgeWidth = Math.max(120, Math.min(236, cleanLabel.length * 11.5 + 24));
  const badgeX = 170 - badgeWidth / 2;

  // Dynamic typography so text always fits cleanly inside the embossed badge
  let fontSize = 10;
  let letterSpacing = 2.4;
  if (cleanLabel.length > 18) {
    fontSize = 8.2;
    letterSpacing = 1.1;
  } else if (cleanLabel.length > 14) {
    fontSize = 9;
    letterSpacing = 1.5;
  } else if (cleanLabel.length > 10) {
    fontSize = 9.5;
    letterSpacing = 2.0;
  }

  const width = isCompact ? 240 : 320;
  const height = isCompact ? 44 : 54;

  return (
    <div
      aria-hidden="true"
      className={`absolute top-1 sm:top-1.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.38)] max-w-[94%] sm:max-w-[88%] ${className}`}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 340 58"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-9 sm:h-11 md:h-13 overflow-visible"
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
          d="M 152 18 C 152 4, 188 4, 188 18 Z"
          fill="url(#chromeBodyGrad)"
          stroke="#475569"
          strokeWidth="0.8"
        />
        {/* Arch inner highlight & border */}
        <path
          d="M 154 17 C 154 7, 186 7, 186 17"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="0.8"
          fill="none"
        />
        {/* Hanging Hole (allows board to be hung on wall hook/nail) */}
        <circle cx="170" cy="11.5" r="5.5" fill="#4a2209" stroke="#1e293b" strokeWidth="1" />
        <circle cx="170" cy="11.5" r="4.2" fill="#2d1304" />
        <circle cx="170" cy="11.5" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6" fill="none" />

        {/* 2. MAIN SPRING MECHANISM BARREL (behind bracket) */}
        <rect
          x="146"
          y="15"
          width="48"
          height="8"
          rx="3"
          fill="url(#springGrad)"
          stroke="#334155"
          strokeWidth="0.8"
        />
        {/* Spring coil grooves */}
        <line x1="152" y1="15" x2="152" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="158" y1="15" x2="158" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="164" y1="15" x2="164" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="170" y1="15" x2="170" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="176" y1="15" x2="176" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="182" y1="15" x2="182" y2="23" stroke="#1e293b" strokeWidth="1" />
        <line x1="188" y1="15" x2="188" y2="23" stroke="#1e293b" strokeWidth="1" />

        {/* 3. BASE MOUNTING PLATE (Extended wings spanning across the clipboard) */}
        <path
          d="M 22 26 C 22 19, 32 17, 44 17 L 296 17 C 308 17, 318 19, 318 26 L 322 38 C 322 43, 312 44, 298 44 L 42 44 C 28 44, 18 43, 18 38 Z"
          fill="url(#chromeBodyGrad)"
          stroke="#475569"
          strokeWidth="0.9"
        />
        {/* Top edge metallic gloss highlight */}
        <path
          d="M 28 18.5 L 312 18.5"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* 4. LEFT MOUNTING RIVET */}
        <circle cx="36" cy="30" r="5.5" fill="url(#rivetGrad1)" stroke="#334155" strokeWidth="0.8" />
        <circle cx="36" cy="30" r="4.2" stroke="rgba(255,255,255,0.6)" strokeWidth="0.6" fill="none" />
        <line x1="33.5" y1="30" x2="38.5" y2="30" stroke="#1e293b" strokeWidth="1" />

        {/* 5. RIGHT MOUNTING RIVET */}
        <circle cx="304" cy="30" r="5.5" fill="url(#rivetGrad1)" stroke="#334155" strokeWidth="0.8" />
        <circle cx="304" cy="30" r="4.2" stroke="rgba(255,255,255,0.6)" strokeWidth="0.6" fill="none" />
        <line x1="301.5" y1="30" x2="306.5" y2="30" stroke="#1e293b" strokeWidth="1" />

        {/* 6. EMBOSSED BRAND BADGE (Stamped recessed plate, dynamically sized) */}
        <rect
          x={badgeX}
          y="22"
          width={badgeWidth}
          height="16"
          rx="3"
          fill="url(#recessGrad)"
          stroke="#334155"
          strokeWidth="0.8"
        />
        <rect
          x={badgeX + 1}
          y="23"
          width={badgeWidth - 2}
          height="14"
          rx="2"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.6"
          fill="none"
        />
        {/* Stamped Text with Authentic Chiseled Bevel Effect */}
        <text
          x="170"
          y="34"
          textAnchor="middle"
          fill="#1e293b"
          fontSize={fontSize}
          fontWeight="900"
          letterSpacing={letterSpacing}
          fontFamily="system-ui, -apple-system, sans-serif"
          className="select-none"
        >
          {cleanLabel}
        </text>
        <text
          x="170"
          y="33.3"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize={fontSize}
          fontWeight="900"
          letterSpacing={letterSpacing}
          fontFamily="system-ui, -apple-system, sans-serif"
          className="select-none opacity-85"
        >
          {cleanLabel}
        </text>

        {/* 7. LOWER GRIPPING CLAMP BAR (Clamps down onto paper sheet) */}
        <g filter="url(#clampShadow)">
          {/* Main Grip Bar Cylinder */}
          <rect
            x="10"
            y="41"
            width="320"
            height="12"
            rx="4.5"
            fill="url(#chromeBarGrad)"
            stroke="#475569"
            strokeWidth="0.8"
          />
          {/* Gloss Specular Highlight Line on Grip Bar */}
          <line
            x1="18"
            y1="43.5"
            x2="322"
            y2="43.5"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Lower Contact Shadow Edge */}
          <line
            x1="16"
            y1="51.5"
            x2="324"
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
  clipLabel,
  variant = 'card',
  className = '',
  paperClassName = '',
  id,
}: ExamPadCardProps) {
  const isDashboard = variant === 'dashboard';
  const isCompact = variant === 'compact';

  // Board style variations
  const boardClass = isDashboard || isCompact ? 'exam-pad-board-dashboard' : 'exam-pad-board';

  // Derive meaningful clip label if not explicitly provided or if legacy 'ROYAL' was passed
  const resolvedClipLabel = (
    clipLabel && clipLabel !== 'ROYAL'
      ? clipLabel
      : typeof badge === 'string' && badge.trim()
      ? badge.replace(/\s*card$/i, '').trim().toUpperCase()
      : typeof title === 'string' && title.trim()
      ? title.replace(/^(add|create|manage|new)\s+/i, '').trim().toUpperCase()
      : 'CAMPUSFLOW'
  );

  return (
    <div
      id={id}
      className={`relative w-full ${boardClass} ${
        isDashboard
          ? 'rounded-lg p-2 sm:p-3 md:p-3.5 pt-8 sm:pt-10 md:pt-11'
          : isCompact
          ? 'rounded-md p-2 sm:p-2.5 pt-7 sm:pt-8'
          : 'rounded-xl p-2.5 sm:p-4 md:p-5 pt-9 sm:pt-11 md:pt-13'
      } ${className}`}
    >
      {/* Authentic Top Metal Exam Clip */}
      <ExamPadClip
        label={resolvedClipLabel}
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
