'use client';

import React from 'react';

interface PaperRollEndCapProps {
  side: 'left' | 'right';
  className?: string;
  spinDirection?: 'forward' | 'reverse' | 'none';
}

/**
 * High-fidelity 3D curled spiral paper end cap.
 * Recreates the physical side view of a rolled parchment / paper scroll
 * with concentric spiral turns, layered paper thickness, and ambient occlusion.
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
        width="22"
        height="56"
        viewBox="0 0 22 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-4 sm:w-5 h-11 sm:h-13 overflow-visible filter drop-shadow-[0_4px_6px_rgba(25,10,2,0.45)] ${spinClass}`}
      >
        <defs>
          {/* Outer Spiral Rim Gradient */}
          <linearGradient id={`outerRimGrad_${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#faf6ec" />
            <stop offset="35%" stopColor="#e5d9bf" />
            <stop offset="70%" stopColor="#bfa97f" />
            <stop offset="100%" stopColor="#7a623a" />
          </linearGradient>

          {/* Dark Mode Outer Rim Gradient */}
          <linearGradient id={`darkOuterRimGrad_${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5a4020" />
            <stop offset="40%" stopColor="#3d2a13" />
            <stop offset="75%" stopColor="#25170a" />
            <stop offset="100%" stopColor="#120a03" />
          </linearGradient>

          {/* Deep Core Cavity Gradient */}
          <radialGradient id={`coreShadow_${side}`} cx="45%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#241505" />
            <stop offset="70%" stopColor="#4d3215" />
            <stop offset="100%" stopColor="#7a5526" />
          </radialGradient>
        </defs>

        {/* Outer Cylinder End Profile (Ellipse) */}
        <ellipse
          cx="10.5"
          cy="28"
          rx="9"
          ry="25"
          className="fill-[#ecd9b8] dark:fill-[#2a1b0b] stroke-[#8a6a3b] dark:stroke-[#5a3f1c]"
          strokeWidth="1.2"
        />

        {/* Ambient inner shadow layer */}
        <ellipse
          cx="10"
          cy="28"
          rx="7.5"
          ry="22"
          className="fill-[#e0caa5]/70 dark:fill-[#1f1307]"
        />

        {/* Concentric Curled Paper Spiral Turn 1 (Outer Turn) */}
        <path
          d="M 17 28 C 17 41, 13.5 49, 9.5 49 C 5.5 49, 2.5 40, 2.5 28 C 2.5 16, 5.8 7, 10.5 7 C 15 7, 18 15, 18 26 C 18 36, 14.5 44, 10.5 44 C 6.5 44, 4.5 36, 4.5 28 C 4.5 20, 7 14, 10.5 14 C 13.8 14, 15.5 20, 15.5 27 C 15.5 33, 13 38, 10.5 38 C 8 38, 6.8 33, 6.8 28 C 6.8 23, 8.5 19, 10.5 19 C 12.2 19, 13.2 23, 13.2 28 C 13.2 31.5, 12 34, 10.5 34 C 9.2 34, 8.8 31, 8.8 28"
          fill="none"
          className="stroke-[#6d4f26] dark:stroke-[#a67c3b]"
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Paper Thickness Highlight Accent Line */}
        <path
          d="M 18 25 C 18 15, 14.8 7.5, 10.5 7.5 C 6 7.5, 3 16, 3 28 C 3 39.5, 5.8 48, 9.5 48"
          fill="none"
          className="stroke-white/80 dark:stroke-amber-300/40"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Hollow Dark Center Core */}
        <ellipse
          cx="10.2"
          cy="28"
          rx="1.6"
          ry="3.2"
          fill="#170c02"
        />
      </svg>
    </div>
  );
}
