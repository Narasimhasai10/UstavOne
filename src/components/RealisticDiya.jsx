import React from 'react';

/**
 * RealisticDiya
 * Renders an authentic Indian terracotta oil lamp (diya) using layered SVG gradients:
 * - 3D terracotta clay bowl with hand-painted gold motif
 * - Golden-brown oil surface with animated gloss
 * - Twisted cotton wick with charred tip
 * - 3-tier layered teardrop flame (outer orange, middle yellow, pale blue/white core)
 * - Realistic flame flicker with independent multi-axis sway & scale
 * - Dynamic lighting transition from tiny wick spark to full flame
 * - Golden halo glow and surface reflections
 * - Rising golden sparks & ignition smoke wisp
 */
export default function RealisticDiya({
  isLit = false,
  isIgniting = false,
  showSmoke = false,
  className = '',
  size = 'medium', // 'small' | 'medium' | 'large'
  idPrefix = 'diya-1'
}) {
  return (
    <div
      className={`diya-unit ${isLit ? 'is-lit' : ''} ${isIgniting ? 'is-igniting' : ''} ${showSmoke ? 'show-smoke' : ''} ${className}`}
      data-size={size}
    >
      {/* Soft golden radial halo behind flame */}
      <div className="diya-halo" aria-hidden="true" />

      {/* Tiny spark at wick right before flame erupts */}
      <div className="wick-spark" aria-hidden="true" />

      {/* Smoke wisp rising when wick lights */}
      <div className="smoke-wisp" aria-hidden="true">
        <svg viewBox="0 0 20 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <path
            d="M10 38C8 30 14 24 11 16C8 9 13 4 8 2"
            stroke="rgba(255, 235, 210, 0.45)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="2 3"
          />
        </svg>
      </div>

      {/* Rising golden spark particles */}
      <div className="sparks-emitter" aria-hidden="true">
        <span className="spark-particle" />
        <span className="spark-particle" />
        <span className="spark-particle" />
        <span className="spark-particle" />
        <span className="spark-particle" />
      </div>

      {/* Main Diya SVG */}
      <svg
        className="diya-svg"
        viewBox="0 0 100 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Flame Blur Filter for Outer Glow */}
          <filter id={`${idPrefix}-outer-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>

          <filter id={`${idPrefix}-clay-shadow`} x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1a040d" floodOpacity="0.65" />
          </filter>

          {/* Clay Bowl 3D Terracotta Radial Gradient */}
          <radialGradient
            id={`${idPrefix}-clay-body`}
            cx="48%"
            cy="52%"
            r="48%"
            fx="42%"
            fy="44%"
          >
            <stop offset="0%" stopColor="#C86236" />
            <stop offset="35%" stopColor="#B5532A" />
            <stop offset="70%" stopColor="#8A3A1C" />
            <stop offset="100%" stopColor="#5E2410" />
          </radialGradient>

          {/* Top Rim Terracotta Gradient */}
          <linearGradient id={`${idPrefix}-clay-rim`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8A3A1C" />
            <stop offset="25%" stopColor="#D97543" />
            <stop offset="50%" stopColor="#E89063" />
            <stop offset="75%" stopColor="#D97543" />
            <stop offset="100%" stopColor="#5E2410" />
          </linearGradient>

          {/* Oil Pool Golden-Brown Gradient */}
          <radialGradient
            id={`${idPrefix}-oil-surface`}
            cx="50%"
            cy="46%"
            r="48%"
          >
            <stop offset="0%" stopColor="#8A5A1E" />
            <stop offset="45%" stopColor="#673F12" />
            <stop offset="85%" stopColor="#4A2A0C" />
            <stop offset="100%" stopColor="#301A06" />
          </radialGradient>

          {/* Oil Glossy Reflection */}
          <linearGradient id={`${idPrefix}-oil-gloss`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE7B0" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#E8B84A" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4A2A0C" stopOpacity="0" />
          </linearGradient>

          {/* Wick Gradient: cotton to charred black */}
          <linearGradient id={`${idPrefix}-wick-grad`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#8A5A1E" />
            <stop offset="30%" stopColor="#EFE8DD" />
            <stop offset="70%" stopColor="#6C594A" />
            <stop offset="100%" stopColor="#1E140E" />
          </linearGradient>

          {/* Outer Orange Flame Gradient */}
          <radialGradient
            id={`${idPrefix}-flame-outer-grad`}
            cx="48%"
            cy="65%"
            r="50%"
            fx="48%"
            fy="60%"
          >
            <stop offset="0%" stopColor="#FF8F1C" />
            <stop offset="55%" stopColor="#FF6014" />
            <stop offset="85%" stopColor="#D83705" />
            <stop offset="100%" stopColor="#B5173B" stopOpacity="0" />
          </radialGradient>

          {/* Middle Yellow Flame Gradient */}
          <radialGradient
            id={`${idPrefix}-flame-mid-grad`}
            cx="48%"
            cy="60%"
            r="48%"
            fx="48%"
            fy="55%"
          >
            <stop offset="0%" stopColor="#FFF199" />
            <stop offset="40%" stopColor="#FFD338" />
            <stop offset="80%" stopColor="#FF9F1A" />
            <stop offset="100%" stopColor="#FF6014" stopOpacity="0.3" />
          </radialGradient>

          {/* Inner Core Pale Blue/White Gradient */}
          <radialGradient
            id={`${idPrefix}-flame-core-grad`}
            cx="50%"
            cy="45%"
            r="45%"
            fx="50%"
            fy="40%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#FFF7D9" />
            <stop offset="80%" stopColor="#7BE0FF" />
            <stop offset="100%" stopColor="#4E9CFF" stopOpacity="0.8" />
          </radialGradient>

          {/* Warm Reflection On Rim Gradient */}
          <radialGradient id={`${idPrefix}-rim-glow`} cx="46%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#FFB03A" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#FF6014" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#B5532A" stopOpacity="0" />
          </radialGradient>

          {/* Under-diya Surface Warm Glow */}
          <radialGradient id={`${idPrefix}-ground-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF8F1C" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#E8B84A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3A0A1E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Ground Reflection & Shadow below the Diya */}
        <ellipse
          cx="50"
          cy="85"
          rx="38"
          ry="5.5"
          fill={`url(#${idPrefix}-ground-glow)`}
          opacity={isLit ? 1 : 0.2}
          style={{ transition: 'opacity 0.6s ease' }}
        />
        <ellipse
          cx="50"
          cy="85.5"
          rx="26"
          ry="3.5"
          fill="#250512"
          opacity="0.65"
        />

        {/* 2. Terracotta Clay Bowl Body (Deep 3D Curves) */}
        <path
          d="M 14 50 C 14 74 30 84 50 84 C 70 84 86 74 86 50 Z"
          fill={`url(#${idPrefix}-clay-body)`}
          filter={`url(#${idPrefix}-clay-shadow)`}
        />

        {/* Base dark shading for solid grounding */}
        <path
          d="M 28 75 C 36 82 64 82 72 75 C 64 85 36 85 28 75 Z"
          fill="#3D1609"
          opacity="0.85"
        />

        {/* Subtle Traditional Gold Painted Pattern on Clay Body */}
        <path
          d="M 22 58 Q 50 72 78 58"
          stroke="#E8B84A"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.7"
          fill="none"
        />
        <circle cx="32" cy="63" r="1.3" fill="#FFE7B0" opacity="0.85" />
        <circle cx="41" cy="66.5" r="1.5" fill="#FFE7B0" opacity="0.9" />
        <circle cx="50" cy="68" r="1.8" fill="#FFD778" opacity="0.95" />
        <circle cx="59" cy="66.5" r="1.5" fill="#FFE7B0" opacity="0.9" />
        <circle cx="68" cy="63" r="1.3" fill="#FFE7B0" opacity="0.85" />

        {/* 3. Diya Top Rim with Terracotta highlight */}
        <ellipse
          cx="50"
          cy="50"
          rx="36"
          ry="9.5"
          fill={`url(#${idPrefix}-clay-rim)`}
        />

        {/* 4. Oil Reservoir Pool */}
        <ellipse
          cx="50"
          cy="50"
          rx="32.5"
          ry="7.8"
          fill={`url(#${idPrefix}-oil-surface)`}
        />

        {/* Oil glossy liquid highlight */}
        <ellipse
          cx="45"
          cy="49.5"
          rx="18"
          ry="3.2"
          fill={`url(#${idPrefix}-oil-gloss)`}
        />

        {/* 5. Front-Left Curved Wick */}
        {/* Wick shadow on oil */}
        <path
          d="M 45 49 Q 43 46 41 45"
          stroke="#2A1607"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Cotton wick stem */}
        <path
          d="M 46 50 Q 44 43 45 37 Q 45.5 32 46.5 28"
          stroke={`url(#${idPrefix}-wick-grad)`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Warm reflection on the bowl's rim when lit */}
        <ellipse
          cx="46.5"
          cy="51"
          rx="17"
          ry="5.5"
          fill={`url(#${idPrefix}-rim-glow)`}
          opacity={isLit ? 0.9 : 0}
          style={{ transition: 'opacity 0.6s ease' }}
        />

        {/* 6. Realistic Layered Flame (Outer Orange, Mid Yellow, Core White-Blue) */}
        <g className="diya-flame-group">
          {/* Flame Outer Layer (Orange with soft blur) */}
          <path
            className="diya-flame-layer flame-outer"
            d="M 46.5 4 C 40 14 35 22 35 27.5 C 35 34 40.5 36.5 46.5 36.5 C 52.5 36.5 58 34 58 27.5 C 58 22 53 14 46.5 4 Z"
            fill={`url(#${idPrefix}-flame-outer-grad)`}
            filter={`url(#${idPrefix}-outer-blur)`}
          />

          {/* Flame Middle Layer (Warm Golden-Yellow) */}
          <path
            className="diya-flame-layer flame-middle"
            d="M 46.5 9 C 41.5 16 38.5 22 38.5 27 C 38.5 32.5 42 35 46.5 35 C 51 35 54.5 32.5 54.5 27 C 54.5 22 51.5 16 46.5 9 Z"
            fill={`url(#${idPrefix}-flame-mid-grad)`}
          />

          {/* Flame Inner Core (Pale White-Blue Core & faint blue at wick base) */}
          <path
            className="diya-flame-layer flame-core"
            d="M 46.5 16 C 43.5 21 42 24.5 42 28.5 C 42 32 44 33.5 46.5 33.5 C 49 33.5 51 32 51 28.5 C 51 24.5 49.5 21 46.5 16 Z"
            fill={`url(#${idPrefix}-flame-core-grad)`}
          />
        </g>
      </svg>
    </div>
  );
}
