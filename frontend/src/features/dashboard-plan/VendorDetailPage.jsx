import React, { useState, useEffect } from 'react';
import { formatINR } from './engine/planner.js';
import BranchPhotoPlaceholder from './BranchPhotoPlaceholder.jsx';
import SafeImage from '../../shared/components/SafeImage.jsx';
import { resolvePhotoUrls } from '../../shared/utils/photos.js';
import { getVendorPreviousWorks, getCurrentUser } from '../../shared/data-service/index.js';
import { unreadCountForCustomer, subscribeChat } from '../booking-chat/chatStore.js';

async function resolveWorkImages(w) {
  let photos = [];
  if (Array.isArray(w.photos) && w.photos.length > 0) {
    photos = await resolvePhotoUrls(w.photos);
  } else if (w.coverPhoto) {
    photos = await resolvePhotoUrls([w.coverPhoto]);
  } else if (w.photoUrl || w.photo || w.image || w.url) {
    photos = await resolvePhotoUrls([w.photoUrl || w.photo || w.image || w.url]);
  }

  // Filter valid URLs
  const valid = photos.filter(p => p && Boolean(p.url));

  // Ensure cover photo is first
  let sortedPhotos = [];
  if (valid.length > 0) {
    const coverIdx = valid.findIndex(p => p.isCover || (w.coverPhoto && (p.url === w.coverPhoto || p.id === w.coverPhoto)));
    if (coverIdx > 0) {
      const [cover] = valid.splice(coverIdx, 1);
      sortedPhotos = [cover, ...valid];
    } else {
      sortedPhotos = valid;
    }
  }

  return {
    ...w,
    photos: sortedPhotos,
    coverPhotoUrl: sortedPhotos[0]?.url || null
  };
}

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

  // Vendor photos: only real photos uploaded by the vendor, never stock photos
  const rawPhotos = Array.isArray(vendor.photos)
    ? vendor.photos.map((p, i) => {
      const url = typeof p === 'string' ? p : (p.url || p.path || (p.fileId ? `/api/v1/files/${p.fileId}` : ''));
      return {
        id: p.id || i,
        url,
        caption: p.caption || `Photo ${i + 1}`
      };
    }).filter(p => Boolean(p.url))
    : [];

  const [displayPhotos, setDisplayPhotos] = useState(rawPhotos);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Past Works: only real past works, never fake hardcoded works
  const rawWorks = Array.isArray(vendor.pastWorks)
    ? vendor.pastWorks
    : (Array.isArray(vendor.works) ? vendor.works : []);
  const [displayWorks, setDisplayWorks] = useState(rawWorks);
  const [activeWorkGallery, setActiveWorkGallery] = useState(null); // { work, photos, currentIdx }
  const [touchStartX, setTouchStartX] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkUnread = () => {
      const u = getCurrentUser();
      const phone = u?.phone || '9390075877';
      const branchId = vendor.branchId || vendor.id;
      const count = unreadCountForCustomer(phone, branchId);
      if (isMounted) setHasUnread(count > 0);
    };

    checkUnread();
    const unsub = subscribeChat(() => {
      checkUnread();
    });

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [vendor]);

  // Asynchronously resolve photo URLs from IndexedDB if not already attached
  useEffect(() => {
    let isMounted = true;
    if (Array.isArray(vendor.photos) && vendor.photos.length > 0) {
      resolvePhotoUrls(vendor.photos).then(resolved => {
        if (isMounted) {
          const valid = resolved.filter(p => Boolean(p.url));
          setDisplayPhotos(valid);
        }
      });
    } else {
      setDisplayPhotos([]);
    }

    const loadWorks = async () => {
      let worksList = Array.isArray(vendor.pastWorks)
        ? vendor.pastWorks
        : (Array.isArray(vendor.works) ? vendor.works : []);

      if (worksList.length === 0 && vendor.vendorUsername) {
        try {
          const stored = await Promise.resolve(getVendorPreviousWorks(vendor.vendorUsername));
          worksList = (Array.isArray(stored) ? stored : []).filter(w => !w.branchId || w.branchId === vendor.id);
        } catch { }
      }

      if (worksList.length > 0) {
        const resolved = await Promise.all(worksList.map(resolveWorkImages));
        if (isMounted) setDisplayWorks(resolved);
      } else {
        if (isMounted) setDisplayWorks([]);
      }
    };

    loadWorks();

    const handleCatalogChanged = () => {
      loadWorks();
    };

    window.addEventListener('utsavora:catalog-changed', handleCatalogChanged);
    window.addEventListener('vedika:catalog-changed', handleCatalogChanged);

    return () => {
      isMounted = false;
      window.removeEventListener('utsavora:catalog-changed', handleCatalogChanged);
      window.removeEventListener('vedika:catalog-changed', handleCatalogChanged);
    };
  }, [vendor]);

  // Reviews: only real customer reviews from database/store
  const reviews = Array.isArray(vendor.reviews) ? vendor.reviews : [];

  const isNonRefundable = Boolean(
    vendor.description?.includes('non-refundable') ||
    (Array.isArray(vendor.amenities) && vendor.amenities.some(a => String(a).toLowerCase().includes('non-refundable'))) ||
    vendor.isNonRefundable ||
    vendor.cancellationPolicy === 'non-refundable'
  );

  const hasPlateRates = Boolean(
    (vendor.plateRates && (Array.isArray(vendor.plateRates) ? vendor.plateRates.length > 0 : Object.keys(vendor.plateRates).length > 0)) ||
    vendor.price != null ||
    vendor.effectivePrice != null
  );

  const isRatesOnRequest = isCaterer && (!hasPlateRates || vendor.priceDisplay === 'Rates on request');

  const priceDisplay = isCaterer
    ? (isRatesOnRequest ? 'Rates on request' : (vendor.price ? `₹${vendor.price} / plate (starts from)` : `₹${vendor.effectivePrice || 350} / plate (estimated)`))
    : `${formatINR(vendor.price)} / day`;

  const parkingText = vendor.parking || (vendor.parkingSpaces ? `${vendor.parkingSpaces}+ Cars` : 'Parking available');
  const roomsText = vendor.rooms ? `${vendor.rooms} Deluxe Rooms` : 'Changing rooms available';
  const ratingValue = vendor.ratingAvg || vendor.rating || 4.5;
  const reviewsCount = vendor.reviewsCount || vendor.ratingCount || 0;

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

      <div className="wrap" style={{ padding: '24px 0 100px' }}>
        {/* Photo Gallery: Always visible slot. Only vendor-uploaded photos; neutral placeholder if 0 photos */}
        <div style={{ marginBottom: '24px' }}>
          {displayPhotos.length > 0 ? (
            <>
              <div
                onClick={() => setLightboxOpen(true)}
                style={{
                  height: '320px',
                  borderRadius: '20px',
                  background: 'var(--card)',
                  border: '1.5px solid var(--line)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'zoom-in',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                <SafeImage
                  src={displayPhotos[activePhotoIdx]?.url}
                  alt={displayPhotos[activePhotoIdx]?.caption || vendor.name}
                  kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span style={{ position: 'absolute', bottom: '14px', right: '16px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.85rem', padding: '5px 12px', borderRadius: '99px' }}>
                  🔍 Tap to view photo {activePhotoIdx + 1}/{displayPhotos.length}
                </span>
                {vendor.isEstimated && (
                  <span style={{ position: 'absolute', top: '14px', left: '16px', background: 'var(--gold)', color: '#3A0A1E', fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: '99px' }}>
                    Price Estimated
                  </span>
                )}
              </div>

              {/* Thumbnails */}
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '12px' }}>
                {displayPhotos.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    style={{
                      width: '74px',
                      height: '74px',
                      borderRadius: '12px',
                      border: activePhotoIdx === idx ? '3px solid var(--gold)' : '2px solid var(--line)',
                      background: 'var(--card)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0
                    }}
                  >
                    <SafeImage
                      src={p.url}
                      alt={p.caption || `Thumbnail ${idx + 1}`}
                      kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <BranchPhotoPlaceholder kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')} height="320px" />
          )}
        </div>

        {/* Name, Type tag, Full address with 📍, Rating, Tier */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h1 style={{ fontFamily: 'Yatra One', fontSize: '2rem', color: '#f8ebd8' }}>
                {vendor.name}
              </h1>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--ink)', color: '#FFE7B0', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '99px', fontWeight: 600 }}>
                  {isHall ? 'Function Hall' : isCaterer ? 'Caterer' : 'Celebration Partner'}
                </span>
                <span style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '99px' }}>
                  {vendor.tier || 'Mid-range'}
                </span>
                {isNonRefundable && (
                  <span style={{ background: 'rgba(235, 87, 87, 0.22)', color: '#FFB4A2', border: '1px solid rgba(235, 87, 87, 0.45)', fontSize: '0.8rem', padding: '3px 10px', borderRadius: '99px', fontWeight: 600 }}>
                    Non-Refundable
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.15rem', color: '#D99A00', fontWeight: 700 }}>
                ★ {ratingValue}
                {reviewsCount > 0 ? (
                  <span style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 400 }}>
                    {' '}({reviewsCount} reviews)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginTop: '8px' }}>
            📍 {vendor.address || vendor.addressLine || `Near Rajiv Marg, ${vendor.city}, Andhra Pradesh`}
          </p>
        </div>

        {/* Price Block */}
        <div style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: '18px', padding: '18px 22px', margin: '20px 0' }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Starting from</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontFamily: 'Yatra One', fontSize: '2rem', color: '#f8ebd8' }}>
              {priceDisplay}
            </span>
            {vendor.isEstimated && (
              <span style={{ color: 'var(--rose)', fontSize: '0.85rem', fontWeight: 600 }}>
                (estimated based on city averages)
              </span>
            )}
          </div>
        </div>

        {/* Key Specifications */}
        <div style={{ margin: '24px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: '#f8ebd8' }}>
            Key Specifications
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {isHall && (
              <>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>👥</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Capacity</div>
                  <div style={{ fontWeight: 700 }}>{vendor.capacity || 500} Guests</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>{vendor.isAC ? '❄️' : '🌿'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Air Conditioning</div>
                  <div style={{ fontWeight: 700 }}>{vendor.isAC ? 'Central AC' : 'Non-AC Hall'}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🚗</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Car Parking</div>
                  <div style={{ fontWeight: 700 }}>{parkingText}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🚪</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Changing Rooms</div>
                  <div style={{ fontWeight: 700 }}>{roomsText}</div>
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
                  <div style={{ fontWeight: 700 }}>
                    {vendor.foodType === 'veg' || (Array.isArray(vendor.foodTypes) && vendor.foodTypes.length === 1 && vendor.foodTypes[0] === 'veg') ? 'Pure Veg Only' : 'Veg & Non-Veg'}
                  </div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🍃</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Serving Styles</div>
                  <div style={{ fontWeight: 700 }}>{(vendor.servingStyles || ['Banana Leaf', 'Buffet']).join(', ')}</div>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '1.4rem' }}>🍽️</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Minimum Plates</div>
                  <div style={{ fontWeight: 700 }}>{vendor.minPlates || 50} Plates</div>
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

        {/* Catering Packages & Plate Rates Section for Caterers */}
        {isCaterer && (
          <div style={{ margin: '28px 0' }}>
            <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: '#f8ebd8' }}>
              Catering Packages & Plate Rates
            </h2>

            {isRatesOnRequest ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px', color: 'var(--muted)' }}>
                Rates provided on request. Please contact the vendor or submit a booking request for custom menu and per-plate pricing.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {[
                  { key: 'basic', label: 'Basic Package', count: '10-15 dishes', defDishes: '1 sweet, 1 snack/hot, flavoured rice, plain rice, pappu, 1-2 curries, sambar/rasam, curd, papad, pickle & ghee.' },
                  { key: 'standard', label: 'Standard Package', count: '15-20 dishes', defDishes: '2 sweets, 1-2 starters, flavoured rice, plain rice, pappu, 2-3 curries, sambar, majjiga pulusu, curd, papad, vadiyalu, pickle & ghee.' },
                  { key: 'premium', label: 'Premium Package', count: '20-30 dishes', defDishes: 'Welcome drink, 2-3 sweets, 2 starters, poori/bobbatlu/garelu, 2 flavoured rices, 3-4 curries, curd vada, ice cream/paan, accompaniments.' },
                  { key: 'luxury', label: 'Luxury Grand Spread', count: '30+ dishes', defDishes: 'Grand wedding spread, welcome drinks, 3-4 sweets, live counters (chaat, dosa, jalebi), multiple starters, stuffed curries, desserts & paan.' }
                ].map(pkg => {
                  const tierData = vendor.plateRates?.[pkg.key];
                  const vegRate = tierData?.veg;
                  const nonVegRate = tierData?.nonveg || tierData?.nonVeg;
                  const nonVegPremRate = tierData?.nonvegPremium || tierData?.nonVegPremium;

                  return (
                    <div key={pkg.key} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ color: '#FFE7B0', fontSize: '1rem' }}>{pkg.label}</b>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{pkg.count}</span>
                      </div>

                      {/* Pricing: support 3 columns (veg, chicken, mutton/seafood), 2 columns (veg, nonveg), or single rate */}
                      <div style={{ margin: '10px 0 8px' }}>
                        {nonVegPremRate ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                            <div style={{ background: 'rgba(47, 158, 123, 0.15)', border: '1px solid rgba(47, 158, 123, 0.35)', borderRadius: '8px', padding: '6px 4px' }}>
                              <div style={{ fontSize: '0.72rem', color: '#5FD38D', fontWeight: 600 }}>Veg</div>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '1rem', color: '#f8ebd8' }}>₹{vegRate}</div>
                            </div>
                            <div style={{ background: 'rgba(232, 184, 74, 0.15)', border: '1px solid rgba(232, 184, 74, 0.35)', borderRadius: '8px', padding: '6px 4px' }}>
                              <div style={{ fontSize: '0.72rem', color: '#FFE7B0', fontWeight: 600 }}>Chicken</div>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '1rem', color: '#f8ebd8' }}>₹{nonVegRate}</div>
                            </div>
                            <div style={{ background: 'rgba(214, 37, 79, 0.15)', border: '1px solid rgba(214, 37, 79, 0.35)', borderRadius: '8px', padding: '6px 4px' }}>
                              <div style={{ fontSize: '0.72rem', color: '#FFB4A2', fontWeight: 600 }}>Mutton/Fish</div>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '1rem', color: '#f8ebd8' }}>₹{nonVegPremRate}</div>
                            </div>
                          </div>
                        ) : nonVegRate ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', textAlign: 'center' }}>
                            <div style={{ background: 'rgba(47, 158, 123, 0.15)', border: '1px solid rgba(47, 158, 123, 0.35)', borderRadius: '8px', padding: '6px 4px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#5FD38D', fontWeight: 600 }}>Veg</div>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '1.1rem', color: '#f8ebd8' }}>₹{vegRate}</div>
                            </div>
                            <div style={{ background: 'rgba(232, 184, 74, 0.15)', border: '1px solid rgba(232, 184, 74, 0.35)', borderRadius: '8px', padding: '6px 4px' }}>
                              <div style={{ fontSize: '0.75rem', color: '#FFE7B0', fontWeight: 600 }}>Non-Veg</div>
                              <div style={{ fontFamily: 'Yatra One', fontSize: '1.1rem', color: '#f8ebd8' }}>₹{nonVegRate}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '1.25rem', fontFamily: 'Yatra One', color: '#f8ebd8' }}>
                            {tierData?.range ? `₹${tierData.range}` : (vegRate ? `Starting ₹${vegRate}/plate` : 'Starting ₹250/plate')}
                          </div>
                        )}
                      </div>

                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                        {tierData?.dishes || pkg.defDishes}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Policies & Important Information Section */}
        <div style={{ margin: '28px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: '#f8ebd8' }}>
            Policies & Important Information
          </h2>

          {isNonRefundable && (
            <div style={{ background: 'rgba(235, 87, 87, 0.16)', border: '1.5px solid rgba(235, 87, 87, 0.5)', borderRadius: '14px', padding: '14px 18px', marginBottom: '14px', color: '#FFB4A2' }}>
              ⚠️ <b>Cancellation Policy:</b> Cancellations are non-refundable (0% refund).
            </div>
          )}

          {vendor.description && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '14px' }}>
              {vendor.description}
            </div>
          )}

          {Array.isArray(vendor.amenities) && vendor.amenities.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {vendor.amenities.map((a, i) => (
                <span key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', color: '#FFE7B0', fontSize: '0.82rem', padding: '4px 12px', borderRadius: '99px' }}>
                  ✓ {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Previous Works Section: Always render heading; if 0 works, show neutral placeholder */}
        <div style={{ margin: '30px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: '#f8ebd8' }}>
            Previous Works
          </h2>
          {displayWorks.length > 0 ? (
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '12px' }}>
              {displayWorks.map((work, idx) => {
                const hasPhotos = Array.isArray(work.photos) && work.photos.length > 0;
                const cover = work.coverPhotoUrl || (hasPhotos ? work.photos[0]?.url : null);

                if (hasPhotos && cover) {
                  return (
                    <div
                      key={work.id || idx}
                      onClick={() => setActiveWorkGallery({ work, photos: work.photos, currentIdx: 0 })}
                      style={{
                        minWidth: '260px',
                        maxWidth: '300px',
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', height: '140px' }}>
                        <SafeImage
                          src={cover}
                          alt={work.title || `Work ${idx + 1}`}
                          kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {work.photos.length > 1 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(0,0,0,0.72)',
                              color: '#FFE7B0',
                              padding: '2px 8px',
                              borderRadius: '99px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backdropFilter: 'blur(4px)'
                            }}
                          >
                            📷 {work.photos.length} photos
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8ebd8' }}>{work.title}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {work.eventType && <span>{work.eventType}</span>}
                          {work.date && <span>• {work.date}</span>}
                          {work.guests ? <span>• {work.guests} guests</span> : null}
                        </div>
                        {(work.caption || work.desc || work.description) && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginTop: '4px', lineHeight: 1.4 }}>
                            {work.caption || work.desc || work.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Text-only card: no empty image box, no fake image
                return (
                  <div
                    key={work.id || idx}
                    style={{
                      minWidth: '240px',
                      maxWidth: '300px',
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      borderRadius: '16px',
                      padding: '16px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8ebd8' }}>{work.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {work.eventType && <span>{work.eventType}</span>}
                      {work.date && <span>• {work.date}</span>}
                      {work.guests ? <span>• {work.guests} guests</span> : null}
                    </div>
                    {(work.caption || work.desc || work.description) && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginTop: '4px', lineHeight: 1.4 }}>
                        {work.caption || work.desc || work.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: '0.95rem'
              }}
            >
              No previous works
            </div>
          )}
        </div>

        {/* What Customers Say: Only genuine reviews, neutral empty state when none */}
        <div style={{ margin: '30px 0' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', marginBottom: '14px', color: '#f8ebd8' }}>
            What Customers Say
          </h2>
          {reviews.length > 0 ? (
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
          ) : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
              No customer reviews yet. Verified reviews appear here after completed events.
            </div>
          )}
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
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f8ebd8' }}>{priceDisplay}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="pill"
            onClick={() => onOpenChat(vendor)}
            style={{ position: 'relative', padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            💬 Contact
            {hasUnread && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  boxShadow: '0 0 4px rgba(234, 171, 80, 0.8)'
                }}
                title="Unread reply from vendor"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpenBook(vendor)}
            style={{
              padding: '10px 22px',
              borderRadius: '99px',
              border: 0,
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontFamily: 'Yatra One',
              fontSize: '1.05rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Book now →
          </button>
        </div>
      </div>

      {/* Lightbox Modal for photos */}
      {lightboxOpen && displayPhotos.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 90,
            display: 'grid',
            placeItems: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(700px, 94vw)',
              maxHeight: '80vh',
              background: 'var(--card)',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <SafeImage
              src={displayPhotos[activePhotoIdx]?.url}
              alt={displayPhotos[activePhotoIdx]?.caption || vendor.name}
              kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.65)',
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
            <div style={{ padding: '12px 16px', color: '#FFE7B0', fontWeight: 600, width: '100%', textAlign: 'center' }}>
              {displayPhotos[activePhotoIdx]?.caption}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for previous work photos */}
      {activeWorkGallery && activeWorkGallery.photos?.length > 0 && (
        <div
          onClick={() => setActiveWorkGallery(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 95,
            display: 'grid',
            placeItems: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null) return;
              const touchEndX = e.changedTouches[0].clientX;
              const diff = touchStartX - touchEndX;
              if (diff > 50) {
                // Swipe left -> next
                setActiveWorkGallery(prev => {
                  if (!prev) return null;
                  const nextIdx = (prev.currentIdx + 1) % prev.photos.length;
                  return { ...prev, currentIdx: nextIdx };
                });
              } else if (diff < -50) {
                // Swipe right -> prev
                setActiveWorkGallery(prev => {
                  if (!prev) return null;
                  const nextIdx = (prev.currentIdx - 1 + prev.photos.length) % prev.photos.length;
                  return { ...prev, currentIdx: nextIdx };
                });
              }
              setTouchStartX(null);
            }}
            style={{
              width: 'min(700px, 94vw)',
              maxHeight: '85vh',
              background: 'var(--card)',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <SafeImage
              src={activeWorkGallery.photos[activeWorkGallery.currentIdx]?.url}
              alt={activeWorkGallery.work?.title || 'Work photo'}
              kind={isHall ? 'hall' : (isCaterer ? 'caterer' : 'hall')}
              style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', background: '#000' }}
            />
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveWorkGallery(null)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                border: 0,
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              ×
            </button>

            {/* Prev Button */}
            {activeWorkGallery.photos.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveWorkGallery(prev => ({
                  ...prev,
                  currentIdx: (prev.currentIdx - 1 + prev.photos.length) % prev.photos.length
                }))}
                aria-label="Previous photo"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '12px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 0,
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                ‹
              </button>
            )}

            {/* Next Button */}
            {activeWorkGallery.photos.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveWorkGallery(prev => ({
                  ...prev,
                  currentIdx: (prev.currentIdx + 1) % prev.photos.length
                }))}
                aria-label="Next photo"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '12px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 0,
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                ›
              </button>
            )}

            {/* Title, Caption & Counter */}
            <div style={{ padding: '14px 18px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#f8ebd8', fontSize: '1rem' }}>
                  {activeWorkGallery.work?.title}
                </span>
                {activeWorkGallery.photos.length > 1 && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {activeWorkGallery.currentIdx + 1} of {activeWorkGallery.photos.length}
                  </span>
                )}
              </div>
              {(activeWorkGallery.photos[activeWorkGallery.currentIdx]?.caption || activeWorkGallery.work?.caption) && (
                <div style={{ fontSize: '0.88rem', color: '#FFE7B0' }}>
                  {activeWorkGallery.photos[activeWorkGallery.currentIdx]?.caption || activeWorkGallery.work?.caption}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
