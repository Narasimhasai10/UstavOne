import React, { useState, useEffect } from 'react';
import BranchPhotoPlaceholder from '../../features/dashboard-plan/BranchPhotoPlaceholder.jsx';
import { formatPhotoUrl } from '../utils/photos.js';

/**
 * Universal SafeImage Component
 * - Wraps <img> with error resilience and loading="lazy"
 * - Automatically falls back to BranchPhotoPlaceholder on empty or broken src
 * - Resolves relative /uploads URLs with API origin when on file://
 * - Prevents any broken image icons or raw image errors across the app
 */
export default function SafeImage({
  src,
  alt = '',
  className = '',
  style = {},
  kind = 'hall',
  fallback = null,
  loading = 'lazy',
  onClick,
  onError,
  onLoad,
  ...rest
}) {
  const [hasError, setHasError] = useState(false);
  const formattedSrc = src ? formatPhotoUrl(src) : '';

  useEffect(() => {
    setHasError(false);
  }, [src]);

  // If no source is provided or the image failed to load, render placeholder
  if (!formattedSrc || hasError) {
    if (fallback) {
      return fallback;
    }
    return (
      <div
        className={`safe-image-placeholder-wrapper ${className}`}
        style={{
          width: '100%',
          height: '100%',
          minHeight: style.height || '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: style.borderRadius || '12px',
          ...style
        }}
        onClick={onClick}
      >
        <BranchPhotoPlaceholder kind={kind} compact={true} style={{ width: '100%', height: '100%' }} />
      </div>
    );
  }

  return (
    <img
      src={formattedSrc}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      onClick={onClick}
      onLoad={onLoad}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      {...rest}
    />
  );
}
