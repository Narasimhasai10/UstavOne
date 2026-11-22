import React, { useState, useRef } from 'react';
import { compressImage, savePhoto, getPhoto } from '../../shared/utils/photos.js';

export default function PhotoUploader({
  photos = [], // Array of { id, url?, caption?, isCover?: boolean }
  onChange,
  maxPhotos = 12
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [activeCaptionIdx, setActiveCaptionIdx] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError('');

    const files = Array.from(fileList);
    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setUploadError(`Maximum limit of ${maxPhotos} photos reached.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const newItems = [];
      for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) {
          setUploadError('Only image files (JPG, PNG, WebP) are supported.');
          continue;
        }

        if (file.size > 8 * 1024 * 1024) {
          setUploadError(`File ${file.name} exceeds 8 MB maximum limit before compression.`);
          continue;
        }

        // Compress image in browser canvas
        const compressedDataUrl = await compressImage(file, 1280, 0.8);
        const photoId = await savePhoto(compressedDataUrl);

        newItems.push({
          id: photoId,
          url: compressedDataUrl,
          caption: '',
          isCover: photos.length === 0 && newItems.length === 0
        });
      }

      if (newItems.length > 0) {
        onChange([...photos, ...newItems]);
      }
    } catch (err) {
      setUploadError('Failed to process image: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (index) => {
    const updated = photos.filter((_, i) => i !== index);
    // If cover was removed, assign first remaining as cover
    if (updated.length > 0 && !updated.some(p => p.isCover)) {
      updated[0].isCover = true;
    }
    onChange(updated);
  };

  const handleSetCover = (index) => {
    const updated = photos.map((p, i) => ({
      ...p,
      isCover: i === index
    }));
    onChange(updated);
  };

  const handleMove = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const updated = [...photos];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  const handleCaptionChange = (index, caption) => {
    const updated = photos.map((p, i) => i === index ? { ...p, caption } : p);
    onChange(updated);
  };

  return (
    <div className="photo-uploader-component" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Upload Zone / Action Bar */}
      <div
        className="upload-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: '2px dashed var(--line)',
          borderRadius: '16px',
          padding: '24px 16px',
          textAlign: 'center',
          background: 'var(--bg)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</div>
        <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text)', marginBottom: '4px' }}>
          Drag and drop photos here, or tap to choose files
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '14px' }}>
          Up to {maxPhotos} photos (max 8 MB each). Compressed in browser to 1280px.
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="pill"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: '0.85rem', padding: '6px 14px', minHeight: '38px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            Choose from gallery
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => cameraInputRef.current?.click()}
            style={{ fontSize: '0.85rem', padding: '6px 14px', minHeight: '38px', color: 'var(--text)', borderColor: 'var(--line)' }}
          >
            📷 Use Camera
          </button>
        </div>
      </div>

      {isUploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--gold)', fontWeight: 600 }}>
          <span>⏳ Compressing and saving photos…</span>
        </div>
      )}

      {uploadError && (
        <div style={{ color: 'var(--rose)', fontSize: '0.84rem', fontWeight: 500 }}>
          ⚠️ {uploadError}
        </div>
      )}

      {/* Thumbnails Grid */}
      {photos.length > 0 && (
        <div
          className="photo-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '8px'
          }}
        >
          {photos.map((item, index) => (
            <div
              key={item.id || index}
              className="photo-card-item"
              style={{
                position: 'relative',
                borderRadius: '14px',
                overflow: 'hidden',
                background: 'var(--card)',
                border: item.isCover ? '2px solid var(--gold)' : '1.5px solid var(--line)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Image Preview */}
              <div style={{ position: 'relative', height: '110px', background: '#0000000a' }}>
                <img
                  src={item.url || item.id}
                  alt={item.caption || `Photo ${index + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Cover Badge */}
                {item.isCover ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: 'var(--gold)',
                      color: '#3A0A1E',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                  >
                    ★ Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetCover(index)}
                    title="Make this photo the main cover photo"
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: '0.68rem',
                      border: 0,
                      borderRadius: '99px',
                      padding: '2px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Set Cover
                  </button>
                )}

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  title="Remove photo"
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    background: 'rgba(181, 23, 59, 0.85)',
                    color: '#fff',
                    border: 0,
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    lineHeight: '24px',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Controls bar: Reorder & Caption */}
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, index - 1)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.4 : 1
                      }}
                      title="Move left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={index === photos.length - 1}
                      onClick={() => handleMove(index, index + 1)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        cursor: index === photos.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === photos.length - 1 ? 0.4 : 1
                      }}
                      title="Move right"
                    >
                      →
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>#{index + 1}</span>
                </div>

                {/* Caption input */}
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={item.caption || ''}
                  onChange={(e) => handleCaptionChange(index, e.target.value)}
                  style={{
                    fontSize: '0.76rem',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
