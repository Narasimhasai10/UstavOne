import React, { useEffect, useState, useRef } from 'react';
import RealisticDiya from './RealisticDiya.jsx';

/**
 * DiyaLoader
 * A reusable festive loader for Utsavora with 3 realistic Indian terracotta oil lamps (diyas).
 *
 * Requirements fulfilled:
 * 1. Preserves underlying page view blurred under backdrop-filter: blur(14px) and rgba(58,10,30,0.45).
 * 2. 3 Diyas in a row (centre one bigger), sequentially lighting from left to right over ~2.4s.
 * 3. Realistic flicker with multi-axis sway and irregular timing.
 * 4. Staggered bouncing dot animation on caption: "Lighting the lamps for your function…"
 * 5. Accessible with role="status", aria-label="Loading", screen-reader live announcements.
 * 6. Supports prefers-reduced-motion.
 *
 * Props:
 * - isOpen: boolean (whether loader is displayed)
 * - onComplete: function (called after simulated API call & fade out finish)
 * - caption: string (caption displayed below lamps)
 * - duration: number (total duration in ms before starting fade out, default: 3200)
 */
export default function DiyaLoader({
  isOpen = false,
  onComplete,
  caption = "Lighting the lamps for your function…",
  duration = 3200
}) {
  // Lighting state flags for each of the 3 diyas
  const [diya1Lit, setDiya1Lit] = useState(false);
  const [diya1Igniting, setDiya1Igniting] = useState(false);
  const [diya1Smoke, setDiya1Smoke] = useState(false);

  const [diya2Lit, setDiya2Lit] = useState(false);
  const [diya2Igniting, setDiya2Igniting] = useState(false);
  const [diya2Smoke, setDiya2Smoke] = useState(false);

  const [diya3Lit, setDiya3Lit] = useState(false);
  const [diya3Igniting, setDiya3Igniting] = useState(false);
  const [diya3Smoke, setDiya3Smoke] = useState(false);

  const [isRendered, setIsRendered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const timersRef = useRef([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!isOpen) {
      if (isRendered && !isExiting) {
        // External trigger closed it: fade out
        setIsExiting(true);
        const exitTimer = setTimeout(() => {
          setIsRendered(false);
          setIsExiting(false);
          resetLamps();
        }, 600);
        timersRef.current.push(exitTimer);
      }
      return;
    }

    // When isOpen turns true:
    clearAllTimers();
    setIsRendered(true);
    setIsExiting(false);
    resetLamps();

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Light all immediately without animation delays
      setDiya1Lit(true);
      setDiya2Lit(true);
      setDiya3Lit(true);

      const finishTimer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setIsRendered(false);
          setIsExiting(false);
          if (onComplete) onComplete();
        }, 600);
      }, duration);
      timersRef.current.push(finishTimer);
      return;
    }

    // Realistic sequential lighting sequence over ~2.4s:
    // Diya 1 (Left): 180ms spark -> 420ms lights with smoke
    const t1 = setTimeout(() => setDiya1Igniting(true), 180);
    const t2 = setTimeout(() => {
      setDiya1Igniting(false);
      setDiya1Lit(true);
      setDiya1Smoke(true);
    }, 450);

    // Diya 2 (Centre, Larger): 980ms spark -> 1240ms lights with smoke
    const t3 = setTimeout(() => setDiya2Igniting(true), 980);
    const t4 = setTimeout(() => {
      setDiya2Igniting(false);
      setDiya2Lit(true);
      setDiya2Smoke(true);
    }, 1250);

    // Diya 3 (Right): 1780ms spark -> 2050ms lights with smoke
    const t5 = setTimeout(() => setDiya3Igniting(true), 1780);
    const t6 = setTimeout(() => {
      setDiya3Igniting(false);
      setDiya3Lit(true);
      setDiya3Smoke(true);
    }, 2080);

    // All lamps lit and flickering together by ~2.4s.
    // Overlay stays for approx 3.2s, then fades out smoothly over 0.6s
    const tFadeOut = setTimeout(() => {
      setIsExiting(true);
    }, duration);

    const tComplete = setTimeout(() => {
      setIsRendered(false);
      setIsExiting(false);
      resetLamps();
      if (onComplete) {
        onComplete();
      }
    }, duration + 600);

    timersRef.current.push(t1, t2, t3, t4, t5, t6, tFadeOut, tComplete);

    return () => clearAllTimers();
  }, [isOpen, duration, onComplete]);

  const resetLamps = () => {
    setDiya1Lit(false);
    setDiya1Igniting(false);
    setDiya1Smoke(false);

    setDiya2Lit(false);
    setDiya2Igniting(false);
    setDiya2Smoke(false);

    setDiya3Lit(false);
    setDiya3Igniting(false);
    setDiya3Smoke(false);
  };

  if (!isRendered) return null;

  return (
    <div
      className={`diya-loader-overlay is-visible ${isExiting ? 'is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="diya-loader-content">
        {/* 3 Diyas in a row - centre one is larger */}
        <div className="diyas-group" aria-hidden="true">
          {/* Diya 1: Left */}
          <RealisticDiya
            idPrefix="diya-left"
            className="diya-left"
            size="small"
            isLit={diya1Lit}
            isIgniting={diya1Igniting}
            showSmoke={diya1Smoke}
          />

          {/* Diya 2: Centre (Bigger) */}
          <RealisticDiya
            idPrefix="diya-center"
            className="diya-center"
            size="large"
            isLit={diya2Lit}
            isIgniting={diya2Igniting}
            showSmoke={diya2Smoke}
          />

          {/* Diya 3: Right */}
          <RealisticDiya
            idPrefix="diya-right"
            className="diya-right"
            size="small"
            isLit={diya3Lit}
            isIgniting={diya3Igniting}
            showSmoke={diya3Smoke}
          />
        </div>

        {/* Caption in Yatra One with 3 animated bouncing dots */}
        <p className="diya-caption-text">
          <span>Lighting the lamps for your function…</span>
          <span className="bouncing-dots" aria-hidden="true">
            <span className="dot-bounce">.</span>
            <span className="dot-bounce">.</span>
            <span className="dot-bounce">.</span>
          </span>
        </p>

        {/* Screen reader only announcement */}
        <span className="sr-only" style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0'
        }}>
          {caption}
        </span>
      </div>
    </div>
  );
}
