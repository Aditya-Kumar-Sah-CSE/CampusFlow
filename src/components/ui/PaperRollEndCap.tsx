'use client';

import React from 'react';

interface PaperRollEndCapProps {
  side: 'left' | 'right';
  className?: string;
  spinDirection?: 'forward' | 'reverse' | 'none';
}

/**
 * High-fidelity 3D curled spiral paper end cap.
 * Recreates the physical side/end view of a rolled paper scroll
 * with concentric spiral turns, layered white paper thickness,
 * cylindrical shading, hollow dark center core, and realistic ambient occlusion.
 * Matches realistic paper roll aesthetics.
 */
export function PaperRollEndCap({
  side,
  className = '',
  spinDirection = 'none',
}: PaperRollEndCapProps) {
  const isLeft = side === 'left';

  const spinClass =
    spinDirection === 'forward'
      ? isLeft
        ? 'animate-spin-spiral-forward-left'
        : 'animate-spin-spiral-forward-right'
      : spinDirection === 'reverse'
      ? isLeft
        ? 'animate-spin-spiral-reverse-left'
        : 'animate-spin-spiral-reverse-right'
      : '';

  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 select-none pointer-events-none ${className}`}
      style={{
        transform: isLeft ? 'scaleX(-1)' : 'none',
      }}
    >
      <svg
        width="24"
        height="56"
        viewBox="0 0 24 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-4 sm:w-5.5 h-11 sm:h-13 overflow-visible filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.22)] ${spinClass}`}
      >
        <defs>
          {/* Light Mode Outer Rim Paper Gradient */}
          <linearGradient id={`outerRimGrad_${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f3f4f6" />
            <stop offset="70%" stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>

          {/* Dark Mode Outer Rim Paper Gradient */}
          <linearGradient id={`darkOuterRimGrad_${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="40%" stopColor="#374151" />
            <stop offset="75%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>

          {/* Inner Cavity Radial Shadow */}
          <radialGradient id={`coreShadow_${side}`} cx="45%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="70%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#4b5563" />
          </radialGradient>
        </defs>

        {/* Outer Cylinder End Profile (Ellipse) */}
        <ellipse
          cx="11.5"
          cy="28"
          rx="10"
          ry="25"
          className="fill-[#f9fafb] dark:fill-[#1f2937] stroke-[#9ca3af] dark:stroke-[#4b5563]"
          strokeWidth="1.2"
        />

        {/* Ambient inner paper layer */}
        <ellipse
          cx="11"
          cy="28"
          rx="8.2"
          ry="22"
          className="fill-[#f3f4f6] dark:fill-[#111827]"
        />

        {/* Concentric Curled Paper Spiral Turn 1 (Outer Turn) */}
        <path
          d="M 18.5 28 C 18.5 41.5, 14.8 50, 10.5 50 C 6 50, 2.5 40.5, 2.5 28 C 2.5 15.5, 6.2 6, 11.5 6 C 16.5 6, 19.8 14.5, 19.8 26 C 19.8 36.5, 15.8 45, 11.5 45 C 7.2 45, 4.8 36.5, 4.8 28 C 4.8 19.5, 7.8 13, 11.5 13 C 15 13, 17 19.5, 17 27 C 17 33.5, 14.2 39, 11.5 39 C 8.8 39, 7.2 33.5, 7.2 28 C 7.2 22.5, 9.2 18, 11.5 18 C 13.5 18, 14.5 22.5, 14.5 28 C 14.5 31.8, 13.2 34.5, 11.5 34.5 C 10 34.5, 9.2 31.5, 9.2 28"
          fill="none"
          className="stroke-[#6b7280] dark:stroke-[#9ca3af]"
          strokeWidth="1.15"
          strokeLinecap="round"
        />

        {/* Paper Thickness Highlight Accent Line */}
        <path
          d="M 19.8 25 C 19.8 14.5, 16 6.5, 11.5 6.5 C 6.5 6.5, 3.2 15.5, 3.2 28 C 3.2 40, 6.5 49, 10.5 49"
          fill="none"
          className="stroke-white dark:stroke-slate-400/40"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Hollow Dark Center Core */}
        <ellipse
          cx="11.2"
          cy="28"
          rx="2"
          ry="3.8"
          fill="#111827"
          className="dark:fill-[#030712]"
        />
      </svg>
    </div>
  );
}

