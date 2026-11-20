import React, { useState } from 'react';
import { formatINR } from '../engine/planner.js';

export default function VendorDetailPage({
  vendor,
  onBack,
  onOpenChat,
  onOpenBook
}) {
  if (!vendor) return null;

  const isHall = vendor.type === 'hall' || Boolean(vendor.capacity);
  const isCaterer = vendor.type === 'caterer' || Boolean(vendor.servingStyles);
  const isDecor = vendor.type === 'decor';

  // 4-5 photo tiles for gallery
  const photos = [
    { id: 1, emoji: isHall ? '🏛️' : isCaterer ? '🍽️' : isDecor ? '✨' : '📸', label: 'Main Venue / Setup' },
    { id: 2, emoji: '💐', label: 'Grand Floral Stage' },
    { id: 3, emoji: '💡', label: 'Crystal Chandeliers & Lighting' },
    { id: 4, emoji: '🍲', label: 'Live Gourmet Counters' },
    { id: 5, emoji: '🌿', label: 'Traditional Welcome Lawn' }
  ];

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 6+ previous works
  const pastWorks = vendor.pastWorks && vendor.pastWorks.length >= 6
    ? vendor.pastWorks
    : [
        { title: 'Ravi & Anu Wedding', desc: 'Floral mandap, 800 guests', emoji: '💍' },
        { title: 'Birthday Celebration', desc: 'Balloon theme, 150 guests', emoji: '🎂' },
        { title: 'Corporate Gala', desc: 'LED stage & acoustic AV, 400 delegates', emoji: '💼' },
        { title: 'Grand Reception', desc: 'Crystal lighting & red carpet, 600 guests', emoji: '🥂' },
        { title: 'Traditional Housewarming', desc: 'Brass lamps & marigold entrance', emoji: '🏡' },
        { title: 'Alumni Conclave', desc: 'Auditorium sound & awards dais, 500 attendees', emoji: '🎓' }
      ];

  // 3 Reviews
  const reviews = [
    { author: 'K. Ramakrishna Rao', rating: 5, text: 'The hospitality and mandap decoration were stunning. Every guest appreciated the arrangements.' },
    { author: 'Sravani & Karthik', rating: 5, text: 'Flawless coordination. The manager stayed with us throughout our reception ceremony.' },
    { author: 'M. Venkatesh', rating: 4.8, text: 'Very hygienic dining area, ample car parking, and prompt response for all custom requirements.' }
  ];

  const priceDisplay = isCaterer
    ? (vendor.price ? `₹${vendor.price} / plate` : `₹${vendor.effectivePrice || 350} / plate (estimated)`)
    : `${formatINR(vendor.price)} / day`;

  return (
    <div className="vendor-detail-page">
      {/* Sticky Top Header with Back Arrow and Vendor Name */}
      <nav className="top" style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4vw' }}>
        <button
          type="button"
          className="pill"
          onClick={onBack}
          aria-label="Back"
          style={{ cursor: 'pointer' }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: 'Yatra One', fontSize: '1.2rem', color: '#FFE7B0' }}>
          {vendor.name}
        </span>
        <div style={{ width: '60px' }} />
      </nav>

      <div className="wrap" style={{ padding: '24px 4vw 100px' }}>
        {/* Photo Gallery: Large Main Photo with 4-5 Thumbnails */}
        <div style={{ marginBottom: '24px' }}>
          <div
            onClick={() => setLightboxOpen(true)}
            style={{
              height: '320px',
              borderRadius: '20px',
              background: vendor.gradient || 'linear-gradient(135deg, var(--ink2), var(--acc))',
              display: 'grid',
              placeItems: 'center',
              cursor: 'zoom-in',
              position: 'relative',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}
          >
            <span style={{ fontSize: '6rem' }}>{photos[activePhotoIdx].emoji}</span>
            <span style={{ position: 'absolute', bottom: '14px', right: '16px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.85rem', padding: '5px 12px', borderRadius: '99px' }}>
              🔍 Tap to view photo {activePhotoIdx + 1}/5
            </span>
            {vendor.isEstimated && (
              <span style={{ position: 'absolute', top: '14px', left: '16px', background: 'var(--gold)', color: '#3A0A1E', fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: '99px' }}>
                Price Estimated
              </span>
            )}
          </div>

          {/* Thumbnails */}
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '12px' }}>
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePhotoIdx(idx)}
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '12px',
                  border: activePhotoIdx === idx ? '3px solid var(--gold)' : '2px solid var(--line)',
                  background: 'var(--card)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.8rem',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {p.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Name, Type tag, Full address with 📍, Rating, Tier */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h1 style={{ fontFamily: 'Yatra One', fontSize: '2rem', color: 'var(--ink)' }}>
                {vendor.name}
              </h1>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--ink)', color: '#FFE7B0', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '99px', fontWeight: 600 }}>
                  {isHall ? 'Function Hall' : isCaterer ? 'Caterer' : 'Celebration Partner'}
                </span>
                <span style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '99px' }}>
                  {vendor.tier || 'Mid-range'}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.15rem', color: '#D99A00', fontWeight: 700 }}>
                ★ {vendor.rating || 4.7} <span style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 400 }}>({vendor.reviewsCount || 128} reviews)</span>
              </div>
            </div>
          </div>

          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginTop: '8px' }}>
            📍 {vendor.address || `Near Rajiv Marg, ${vendor.city}, Andhra Pradesh`}
          </p>
        </div>

        {/* Price Block */}
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: '18px', padding: '18px 22px', margin: '20px 0' }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Starting from</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontFamily: 'Yatra One', fontSize: '2rem', color: 'var(--ink)' }}>
              {priceDisplay}
            </span>
            {vendor.isEstimated && (
              <span style={{ color: 'var(--rose)', fontSize: '0.85rem', fontWeight: 600 }}>
                (estimated based on city averages)
              </span>
            )}
          </div>
        </div>

        {/* Key Facts Row */}
        <div style={{ margin: '24px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: 'var(--ink)' }}>
            Key Specifications
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {isHall && (
              <>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>👥</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Capacity</div>
                  <div style={{ fontWeight: 700 }}>{vendor.capacity || 600} Guests</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>{vendor.isAC ? '❄️' : '🌿'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Air Conditioning</div>
                  <div style={{ fontWeight: 700 }}>{vendor.isAC ? 'Central AC' : 'Non-AC Hall'}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🚗</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Car Parking</div>
                  <div style={{ fontWeight: 700 }}>120+ Cars</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🚪</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Changing Rooms</div>
                  <div style={{ fontWeight: 700 }}>4 Deluxe Rooms</div>
                </div>
              </>
            )}

            {isCaterer && (
              <>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🍲</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Cuisines</div>
                  <div style={{ fontWeight: 700 }}>{(vendor.cuisines || ['Andhra', 'South Indian']).join(', ')}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🥗</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Dietary</div>
                  <div style={{ fontWeight: 700 }}>{vendor.foodType === 'veg' ? 'Pure Veg' : 'Veg & Non-Veg'}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🍃</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Serving Styles</div>
                  <div style={{ fontWeight: 700 }}>{(vendor.servingStyles || ['Banana Leaf', 'Buffet']).join(', ')}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🍽️</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Minimum Plates</div>
                  <div style={{ fontWeight: 700 }}>{vendor.minPlates || 100} Plates</div>
                </div>
              </>
            )}

            {!isHall && !isCaterer && (
              <>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>✨</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Service Scope</div>
                  <div style={{ fontWeight: 700 }}>Complete On-Site Setup</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>📦</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>What's Included</div>
                  <div style={{ fontWeight: 700 }}>Equipment, Crew & Transport</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Previous Works Section: Horizontal Gallery of 6+ Past Events */}
        <div style={{ margin: '30px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: 'var(--ink)' }}>
            Previous Works
          </h2>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '12px' }}>
            {pastWorks.map((work, idx) => (
              <div
                key={idx}
                style={{
                  minWidth: '240px',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    height: '130px',
                    background: 'linear-gradient(135deg, var(--ink2), var(--gold))',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '3rem'
                  }}
                >
                  {work.emoji || '✨'}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{work.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>{work.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What Customers Say (3 Reviews) */}
        <div style={{ margin: '30px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: 'var(--ink)' }}>
            What Customers Say
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {reviews.map((rev, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <b style={{ fontSize: '0.95rem' }}>{rev.author}</b>
                  <span style={{ color: '#D99A00', fontWeight: 700 }}>★ {rev.rating}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  "{rev.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar with 2 Buttons: Contact & Book now */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--card)',
          borderTop: '1px solid var(--line)',
          padding: '12px 4vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          zIndex: 40,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Indicative Price</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>{priceDisplay}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => onOpenChat(vendor)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '2px solid var(--ink)',
              background: 'transparent',
              color: 'var(--ink)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            💬 Contact
          </button>
          <button
            type="button"
            onClick={() => onOpenBook(vendor)}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 0,
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 0 3px rgba(232, 184, 74, 0.4)'
            }}
          >
            Book now
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 99,
            display: 'grid',
            placeItems: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(600px, 92vw)',
              height: '420px',
              background: vendor.gradient || 'linear-gradient(135deg, var(--ink2), var(--acc))',
              borderRadius: '24px',
              display: 'grid',
              placeItems: 'center',
              position: 'relative'
            }}
          >
            <span style={{ fontSize: '8rem' }}>{photos[activePhotoIdx].emoji}</span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: 0,
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '1.2rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            <div style={{ position: 'absolute', bottom: '16px', color: '#fff', fontWeight: 600 }}>
              {photos[activePhotoIdx].label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
