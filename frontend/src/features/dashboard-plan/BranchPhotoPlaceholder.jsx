import React from 'react';

/**
 * Neutral Branch Photo Placeholder
 * Renders a clean themed pavilion SVG for halls or dining cloche SVG for caterers.
 * Shows text "Photos not uploaded yet" without using fake/stock/emoji images.
 */
export default function BranchPhotoPlaceholder({
  kind = 'hall', // 'hall' | 'catering' | 'caterer'
  height = '320px',
  compact = false,
  style = {}
}) {
  const isCaterer = kind === 'catering' || kind === 'caterer';

  if (compact) {
    return (
      <div
        className="branch-photo-placeholder compact"
        style={{
          width: '100%',
          height: height || '100%',
          minHeight: '80px',
          background: 'var(--card, #2D0818)',
          border: '1px solid var(--line, rgba(234, 171, 80, 0.2))',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: 'var(--muted, rgba(248, 235, 216, 0.65))',
          padding: '8px',
          ...style
        }}
      >
        {isCaterer ? (
          // Cloche / Dining Icon
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 18h16" />
            <path d="M4 18a8 8 0 0 1 16 0" />
            <circle cx="12" cy="7" r="1.5" />
          </svg>
        ) : (
          // Pavilion / Hall Icon
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V10" />
            <path d="M19 21V10" />
            <path d="M9 21V13" />
            <path d="M15 21V13" />
            <path d="M2 10l10-7 10 7" />
          </svg>
        )}
        <span style={{ fontSize: '0.75rem', fontWeight: 500, textAlign: 'center' }}>
          Photos not uploaded yet
        </span>
      </div>
    );
  }

  return (
    <div
      className="branch-photo-placeholder full"
      style={{
        width: '100%',
        height: height || '320px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(37, 7, 20, 0.8), rgba(58, 10, 30, 0.9))',
        border: '1.5px solid var(--line, rgba(234, 171, 80, 0.25))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: 'var(--muted, #f8ebd8)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        ...style
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(234, 171, 80, 0.12)',
          border: '1.5px solid rgba(234, 171, 80, 0.3)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--gold, #E8B84A)'
        }}
      >
        {isCaterer ? (
          // Food cloche / platter icon
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 19h18" />
            <path d="M4 19a8 8 0 0 1 16 0" />
            <circle cx="12" cy="7" r="1.5" />
            <path d="M12 4v1.5" />
          </svg>
        ) : (
          // Function hall / pavilion icon
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M6 21V10" />
            <path d="M18 21V10" />
            <path d="M10 21V13" />
            <path d="M14 21V13" />
            <path d="M2 10l10-7 10 7" />
            <path d="M12 3v3" />
          </svg>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--vendor-btn-text, #f8ebd8)', letterSpacing: '0.3px' }}>
          Photos not uploaded yet
        </div>
        <div style={{ fontSize: '0.84rem', color: 'rgba(248, 235, 216, 0.65)', marginTop: '4px' }}>
          {isCaterer
            ? 'Vendor has not added food or catering presentation photos'
            : 'Vendor has not added stage, banquet hall or exterior photos'}
        </div>
      </div>
    </div>
  );
}
