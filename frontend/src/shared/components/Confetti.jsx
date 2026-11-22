import React, { useMemo, useState, useEffect } from 'react';

/**
 * Confetti
 * Renders slow floating confetti pieces drifting down the page.
 * Specifications:
 * - 13px rounded squares, diamonds and circles
 * - 60% opacity
 * - Colours: #E8B84A, #FF5C8A, #3DD6C6, #5AA2FF, #A57BFF, #FFA62B
 * - Supports one-shot 'burst' mode for customer event selection (~4s duration, unmounts automatically)
 */
export default function Confetti({ count = 28, burst = false, duration = 4000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (burst && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [burst, duration]);

  const pieces = useMemo(() => {
    const colors = ['#E8B84A', '#FF5C8A', '#3DD6C6', '#5AA2FF', '#A57BFF', '#FFA62B'];
    const items = [];

    const effectiveCount = burst ? Math.max(count, 32) : count;

    for (let i = 0; i < effectiveCount; i++) {
      const isCircle = i % 3 === 0;
      const isDiamond = i % 3 === 1;
      const color = colors[i % colors.length];
      const left = ((i * 3.7 + (i * 11) % 87) % 98) + 1; // 1% to 99%
      // In burst mode: pieces fall once from top to bottom over 2.8s - 3.8s
      const animDuration = burst ? (2.8 + ((i * 1.7) % 1.2)) : (9 + ((i * 2.3) % 8));
      const delay = burst ? ((i * 0.08) % 0.8) : -((i * 1.8) % 15);
      const size = burst ? (11 + (i % 5)) : 13;
      const rotation = (i * 47) % 360;

      items.push({
        id: i,
        color,
        left: `${left}%`,
        isCircle,
        isDiamond,
        duration: `${animDuration.toFixed(2)}s`,
        delay: `${delay.toFixed(2)}s`,
        size: `${size}px`,
        initialRotation: `${rotation}deg`
      });
    }

    return items;
  }, [count, burst]);

  if (!visible) return null;

  return (
    <div
      className={`confetti-container ${burst ? 'confetti-burst-container' : ''}`}
      aria-hidden="true"
      style={{
        position: burst ? 'fixed' : 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: burst ? 9999 : 1
      }}
    >
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            borderRadius: piece.isCircle ? '50%' : piece.isDiamond ? '2px' : '3.5px',
            animationDuration: piece.duration,
            animationDelay: piece.delay,
            animationIterationCount: burst ? '1' : 'infinite',
            animationFillMode: burst ? 'forwards' : 'none',
            transform: `rotate(${piece.initialRotation})`,
            width: piece.size,
            height: piece.size
          }}
        />
      ))}
    </div>
  );
}
