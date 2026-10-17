import React from 'react';

interface RedPushpinProps {
  className?: string;
}

export function RedPushpin({ className = '' }: RedPushpinProps) {
  return (
    <div
      aria-hidden="true"
      className={`absolute -top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none flex flex-col items-center ${className}`}
    >
      {/* 3D Pushpin with authentic plastic grip, metallic pin and realistic cast shadow */}
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pushpin-3d drop-shadow-[0_3px_5px_rgba(0,0,0,0.55)]"
      >
        <defs>
          {/* Main Pin Dome Gradient */}
          <radialGradient id="pinHeadGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ff7b7b" />
            <stop offset="25%" stopColor="#ef4444" />
            <stop offset="65%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>

          {/* Pin Rim Highlight */}
          <linearGradient id="pinRimGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="45%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>

          {/* Metallic Pin Shaft */}
          <linearGradient id="metalPinGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="35%" stopColor="#e2e8f0" />
            <stop offset="65%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        {/* Needle contact shadow onto paper */}
        <ellipse cx="14" cy="33.5" rx="4" ry="1.5" fill="rgba(0,0,0,0.45)" />

        {/* Silver metallic needle piercing through paper */}
        <polygon points="13,20 15,20 14.3,31.5 13.7,31.5" fill="url(#metalPinGrad)" />

        {/* Lower collar of pushpin */}
        <ellipse cx="14" cy="20" rx="5.5" ry="2.4" fill="url(#pinRimGrad)" />
        <ellipse cx="14" cy="19.2" rx="5" ry="2" fill="#991b1b" />

        {/* Pushpin waist & body */}
        <path
          d="M10 13.5C10 15.5 11.2 19 14 19C16.8 19 18 15.5 18 13.5C18 10.5 19.5 9 20 7.8H8C8.5 9 10 10.5 10 13.5Z"
          fill="url(#pinHeadGrad)"
        />

        {/* Main spherical top grip button */}
        <circle cx="14" cy="7.5" r="6" fill="url(#pinHeadGrad)" />

        {/* Specular gloss highlight reflection */}
        <ellipse cx="12" cy="5.2" rx="2.4" ry="1.4" fill="rgba(255,255,255,0.75)" transform="rotate(-25 12 5.2)" />
      </svg>
    </div>
  );
}
