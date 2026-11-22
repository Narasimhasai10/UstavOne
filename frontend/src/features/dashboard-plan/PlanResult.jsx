import React, { useState } from 'react';
import { formatINR, formatLakhCrore } from './engine/budgetEngine.js';
import dummyVendors from '../../shared/data/dummyVendors.json' with { type: 'json' };

export default function PlanResult({
  planData,
  rawInput,
  onEditAnswers,
  onIncreaseBudget,
  onSwitchCity
}) {
  const {
    floor,
    ceiling,
    split,
    packages,
    notes,
    isUnderFloor,
    isOverCeiling,
    suggestedCities,
    event,
    city,
    budget,
    plates
  } = planData;

  // Selected package tab: default 'Best Value' (or 'Premium' if over ceiling)
  const [selectedPkgName, setSelectedPkgName] = useState(() => {
    if (isOverCeiling) return 'Premium';
    return 'Best Value';
  });

  // Current package object
  const activePackage = packages.find(p => p.name === selectedPkgName) || packages[0];

  // Local state for swapped vendors and active add-ons to allow live dynamic updates
  const [currentVendors, setCurrentVendors] = useState(() => ({ ...activePackage?.vendors }));
  const [activeAddOns, setActiveAddOns] = useState([]);
  
  // Swap Modal State
  const [swapCategory, setSwapCategory] = useState(null); // 'hall' | 'catering' | 'decor' | 'band' | 'photography'
  const [viewDetailsVendor, setViewDetailsVendor] = useState(null);

  // Booking Modal State
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // Expandable "Why this plan?"
  const [whyExpanded, setWhyExpanded] = useState(false);

  // Toast notice for share
  const [shareToast, setShareToast] = useState(false);

  // If user switches tab, reset local customized vendors to that package's defaults
  const handleTabSwitch = (pkgName) => {
    setSelectedPkgName(pkgName);
    const target = packages.find(p => p.name === pkgName);
    if (target) {
      setCurrentVendors({ ...target.vendors });
    }
  };

  // Educational Add-on toggle
  const toggleAddOn = (addOn) => {
    if (activeAddOns.some(a => a.id === addOn.id)) {
      setActiveAddOns(activeAddOns.filter(a => a.id !== addOn.id));
    } else {
      setActiveAddOns([...activeAddOns, addOn]);
    }
  };

  // Calculate live total cost from current vendors + add-ons
  const addOnsTotal = activeAddOns.reduce((sum, a) => sum + a.price, 0);
  const baseVendorsCost = Object.entries(currentVendors).reduce((sum, [cat, v]) => {
    if (!v) return sum;
    if (cat === 'catering') return sum + (v.totalCalculatedPrice || v.price || 0);
    return sum + (v.price || 0);
  }, 0);
  const liveTotalCost = baseVendorsCost + addOnsTotal;
  const liveLeftOver = Math.max(0, budget - liveTotalCost);

  // Format capitalized event name
  const eventDisplayName = event.charAt(0).toUpperCase() + event.slice(1);

  // Swap vendor handler
  const handleSwapSelect = (newVendor) => {
    if (!swapCategory) return;
    const updated = { ...currentVendors };
    if (swapCategory === 'catering') {
      const dishMultiplier = 1 + Math.max(0, (rawInput.dishesPerPlate - 4)) * 0.08;
      const factor = event === 'educational' && rawInput.educationalFoodType === 'snacks' ? 0.65 : 1.0;
      const calcPrice = Math.round(plates * newVendor.price * dishMultiplier * factor);
      updated.catering = {
        ...newVendor,
        totalCalculatedPrice: calcPrice,
        dishes: rawInput.dishesPerPlate,
        plates: plates
      };
    } else {
      updated[swapCategory] = newVendor;
    }
    setCurrentVendors(updated);
    setSwapCategory(null);
  };

  // Available alternatives for swapping
  const getAlternatives = () => {
    if (!swapCategory) return [];
    if (swapCategory === 'hall') {
      return dummyVendors.halls.filter(h => h.city.toLowerCase() === city.toLowerCase() || h.city === 'All');
    }
    if (swapCategory === 'catering') {
      return dummyVendors.caterers.filter(c => c.city.toLowerCase() === city.toLowerCase() || c.city === 'All');
    }
    if (swapCategory === 'band') {
      return dummyVendors.bands;
    }
    if (swapCategory === 'photography') {
      return dummyVendors.photography;
    }
    return [];
  };

  // Share handler
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    }
  };

  return (
    <div className="plan-result-container">
      {/* =====================================================================
          TOP HEADER
          ===================================================================== */}
      <div className="plan-result-header">
        <h1 className="plan-result-title">
          {eventDisplayName} plan for {city}
        </h1>
        <p className="plan-result-sub">
          Your budget, split by AI
        </p>

        {/* Big Budget Number in Yatra One */}
        <div className="plan-result-budget-number">
          {formatINR(budget)}
        </div>
        <div style={{ marginTop: '6px', fontSize: '0.92rem', color: 'var(--muted)' }}>
          Usable budget: <strong style={{ color: 'var(--text)' }}>{formatINR(planData.usableBudget || budget * 0.9)}</strong> (90%) &middot; Reserve buffer: <strong style={{ color: 'var(--leaf)' }}>{formatINR(planData.contingencyBuffer || budget * 0.1)}</strong> (10%)
        </div>

        {/* 34px Segmented Split Bar with Legend */}
        <div className="result-segmented-bar" role="img" aria-label="Budget split bar">
          {split.catering > 0 && (
            <div className="bar-segment seg-catering" style={{ width: `${split.catering}%` }}>
              <span>{split.catering}%</span>
            </div>
          )}
          {split.hall > 0 && (
            <div className="bar-segment seg-hall" style={{ width: `${split.hall}%` }}>
              <span>{split.hall}%</span>
            </div>
          )}
          {split.decor > 0 && (
            <div className="bar-segment seg-decor" style={{ width: `${split.decor}%` }}>
              <span>{split.decor}%</span>
            </div>
          )}
          {split.extras > 0 && (
            <div className="bar-segment seg-extras" style={{ width: `${split.extras}%` }}>
              <span>{split.extras}%</span>
            </div>
          )}
        </div>

        {/* 2-Column Legend */}
        <div className="result-legend-row" aria-hidden="true">
          {split.catering > 0 && (
            <div className="legend-item"><span className="legend-dot dot-catering" /><span>Catering</span></div>
          )}
          {split.hall > 0 && (
            <div className="legend-item"><span className="legend-dot dot-hall" /><span>Hall</span></div>
          )}
          {split.decor > 0 && (
            <div className="legend-item"><span className="legend-dot dot-decor" /><span>Decor</span></div>
          )}
          {split.extras > 0 && (
            <div className="legend-item"><span className="legend-dot dot-extras" /><span>Extras</span></div>
          )}
        </div>

        {/* Green Tint Box with one-sentence summary */}
        <div className="result-ai-pill">
          🤖 AI matched the best options in {city} for {plates} guests.
        </div>
      </div>

      {/* =====================================================================
          EDGE STATE: UNDER-FLOOR
          ===================================================================== */}
      {isUnderFloor && (
        <div className="edge-state-card under-floor-card">
          <div className="edge-state-icon" aria-hidden="true">💡</div>
          <h3>Budget below minimum for {city}</h3>
          <p>
            Your budget is a little below the minimum for {city}. The least you need is <strong>{formatINR(floor)}</strong>.
          </p>
          <div className="edge-btn-row">
            <button
              type="button"
              className="cta"
              onClick={() => onIncreaseBudget(floor)}
            >
              Increase budget to {formatINR(floor)}
            </button>
            <button
              type="button"
              className="cta ghost"
              onClick={onEditAnswers}
            >
              Change my answers
            </button>
          </div>

          {suggestedCities.length > 0 && (
            <div className="suggested-cities-box">
              <span>Or try in these nearby cities where your budget fits:</span>
              <div className="suggested-cities-pills">
                {suggestedCities.map((sc) => (
                  <button
                    type="button"
                    key={sc.city}
                    className="pill g"
                    onClick={() => onSwitchCity(sc.city)}
                  >
                    {sc.city} (Min {formatINR(sc.floor)})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          EDGE STATE: OVER-CEILING NOTICE
          ===================================================================== */}
      {isOverCeiling && (
        <div className="edge-state-card over-ceiling-card">
          <div className="edge-state-icon" aria-hidden="true">👑</div>
          <h3>Exclusive Premier Tier</h3>
          <p>
            Your budget comfortably covers the highest luxury venue, finest royal feast, and lavish thematic production in {city}.
            You have <strong>{formatINR(liveLeftOver)}</strong> left over as savings you can keep or spend on special celebrity artists.
          </p>
        </div>
      )}

      {/* =====================================================================
          PACKAGE TABS (BUDGET / BEST VALUE / PREMIUM)
          ===================================================================== */}
      {!isUnderFloor && (
        <div className="package-tabs-wrapper">
          <div className="package-tabs-bar" role="tablist">
            {packages.map((pkg) => {
              const isActive = selectedPkgName === pkg.name;
              return (
                <button
                  type="button"
                  key={pkg.name}
                  role="tab"
                  aria-selected={isActive}
                  className={`pkg-tab-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleTabSwitch(pkg.name)}
                >
                  {pkg.recommended && (
                    <span className="pkg-recommended-badge">Recommended</span>
                  )}
                  <span className="pkg-tab-title">{pkg.name}</span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE PACKAGE OVERVIEW ROW */}
          <div className="package-metrics-card">
            <div className="metric-box">
              <span className="metric-label">Total Package Cost</span>
              <strong className="metric-value">{formatINR(liveTotalCost)}</strong>
            </div>
            <div className="metric-box">
              <span className="metric-label">Amount Left Over</span>
              <strong className="metric-value highlight-green">{formatINR(liveLeftOver)}</strong>
            </div>
            <div className="metric-box">
              <span className="metric-label">Overall Rating</span>
              <strong className="metric-value">⭐ {activePackage?.overallRating || '4.8'} / 5.0</strong>
            </div>
          </div>

          {/* PLAIN ENGLISH REASON UNDER PACKAGE */}
          <div className="package-reason-box">
            <span className="reason-icon" aria-hidden="true">💬</span>
            <p className="reason-text">{activePackage?.reason}</p>
          </div>

          {/* =================================================================
              EDUCATIONAL ADD-ONS ROW (IF EDUCATIONAL EVENT)
              ================================================================= */}
          {event === 'educational' && (
            <div className="educational-addons-section">
              <h3 className="addons-title">🎓 Add-ons for your academic event</h3>
              <p className="addons-sub">Toggle equipment & services. Prices add directly into your total.</p>
              <div className="addons-chips-grid">
                {dummyVendors.educationalAddOns.map((item) => {
                  const isChecked = activeAddOns.some(a => a.id === item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`addon-pill-btn ${isChecked ? 'is-checked' : ''}`}
                      onClick={() => toggleAddOn(item)}
                    >
                      <span className="addon-check">{isChecked ? '✓' : '+'}</span>
                      <span className="addon-name">{item.name}</span>
                      <span className="addon-price">+{formatINR(item.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              CATEGORY VENDOR CARDS (HALL, CATERING, DECOR, BAND, CARDS, PHOTO)
              ================================================================= */}
          <div className="vendor-cards-section">
            <h3 className="section-subheading">Included Service Partners</h3>

            <div className="vendor-cards-grid">
              {/* HALL CARD */}
              {currentVendors.hall && (
                <div className="vendor-card">
                  <div className="vendor-card-header">
                    <span className="vendor-cat-badge">🏛️ Function Hall</span>
                    <span className="vendor-share-badge">
                      {Math.round((currentVendors.hall.price / budget) * 100)}% of budget
                    </span>
                  </div>
                  <div className="vendor-card-body">
                    <h4 className="vendor-name">{currentVendors.hall.name}</h4>
                    <p className="vendor-loc">📍 {currentVendors.hall.city} &middot; Capacity: {currentVendors.hall.capacity} guests</p>
                    <div className="vendor-meta">
                      <span className="vendor-rating">⭐ {currentVendors.hall.rating}</span>
                      <span className="vendor-price">
                        {formatINR(currentVendors.hall.calculatedCost || currentVendors.hall.price)}
                        {currentVendors.hall.isEstimated && (
                          <span style={{ marginLeft: '6px', fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 500 }}>
                            (estimated)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="vendor-tags">
                      {currentVendors.hall.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  </div>
                  <div className="vendor-card-actions">
                    <button type="button" className="action-link-btn" onClick={() => setViewDetailsVendor(currentVendors.hall)}>View details</button>
                    <button type="button" className="action-link-btn" onClick={() => alert(`Starting in-app secure chat with ${currentVendors.hall.name}...`)}>Chat in app</button>
                    <button type="button" className="action-pill-btn" onClick={() => setSwapCategory('hall')}>Swap ⇄</button>
                  </div>
                </div>
              )}

              {/* CATERING CARD */}
              {currentVendors.catering && (
                <div className="vendor-card">
                  <div className="vendor-card-header">
                    <span className="vendor-cat-badge">🍽️ Catering</span>
                    <span className="vendor-share-badge">
                      {Math.round(((currentVendors.catering.totalCalculatedPrice || currentVendors.catering.price) / budget) * 100)}% of budget
                    </span>
                  </div>
                  <div className="vendor-card-body">
                    <h4 className="vendor-name">{currentVendors.catering.name}</h4>
                    <p className="vendor-loc">📍 {currentVendors.catering.city} &middot; {plates} plates ({rawInput.dishesPerPlate || 8} dishes)</p>
                    <div className="vendor-meta">
                      <span className="vendor-rating">⭐ {currentVendors.catering.rating}</span>
                      <span className="vendor-price">
                        {formatINR(currentVendors.catering.calculatedCost || currentVendors.catering.totalCalculatedPrice || currentVendors.catering.price)}
                        {currentVendors.catering.isEstimated && (
                          <span style={{ marginLeft: '6px', fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 500 }}>
                            (estimated)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="vendor-tags">
                      {currentVendors.catering.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  </div>
                  <div className="vendor-card-actions">
                    <button type="button" className="action-link-btn" onClick={() => setViewDetailsVendor(currentVendors.catering)}>View details</button>
                    <button type="button" className="action-link-btn" onClick={() => alert(`Connecting you to head chef at ${currentVendors.catering.name}...`)}>Chat in app</button>
                    <button type="button" className="action-pill-btn" onClick={() => setSwapCategory('catering')}>Swap ⇄</button>
                  </div>
                </div>
              )}

              {/* DECORATION CARD */}
              {currentVendors.decor && (
                <div className="vendor-card">
                  <div className="vendor-card-header">
                    <span className="vendor-cat-badge">🌸 Decoration</span>
                    <span className="vendor-share-badge">
                      {Math.round((currentVendors.decor.price / budget) * 100)}% of budget
                    </span>
                  </div>
                  <div className="vendor-card-body">
                    <h4 className="vendor-name">{currentVendors.decor.name}</h4>
                    <p className="vendor-loc">{currentVendors.decor.desc}</p>
                    <div className="vendor-meta">
                      <span className="vendor-rating">⭐ {currentVendors.decor.rating}</span>
                      <span className="vendor-price">{formatINR(currentVendors.decor.price)}</span>
                    </div>
                  </div>
                  <div className="vendor-card-actions">
                    <button type="button" className="action-link-btn" onClick={() => setViewDetailsVendor(currentVendors.decor)}>View details</button>
                    <button type="button" className="action-link-btn" onClick={() => alert('Opening decor lookbook in app...')}>Chat in app</button>
                    <button type="button" className="action-pill-btn" onClick={() => onEditAnswers()}>Change style</button>
                  </div>
                </div>
              )}

              {/* BAND / MUSIC CARD */}
              {currentVendors.band && (
                <div className="vendor-card">
                  <div className="vendor-card-header">
                    <span className="vendor-cat-badge">🥁 Music / Band</span>
                    <span className="vendor-share-badge">
                      {Math.round((currentVendors.band.price / budget) * 100)}% of budget
                    </span>
                  </div>
                  <div className="vendor-card-body">
                    <h4 className="vendor-name">{currentVendors.band.name}</h4>
                    <p className="vendor-loc">📍 {currentVendors.band.city} &middot; Live Ensemble</p>
                    <div className="vendor-meta">
                      <span className="vendor-rating">⭐ {currentVendors.band.rating}</span>
                      <span className="vendor-price">{formatINR(currentVendors.band.price)}</span>
                    </div>
                    <div className="vendor-tags">
                      {currentVendors.band.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  </div>
                  <div className="vendor-card-actions">
                    <button type="button" className="action-link-btn" onClick={() => setViewDetailsVendor(currentVendors.band)}>View details</button>
                    <button type="button" className="action-link-btn" onClick={() => alert(`Chatting with band master at ${currentVendors.band.name}...`)}>Chat in app</button>
                    <button type="button" className="action-pill-btn" onClick={() => setSwapCategory('band')}>Swap ⇄</button>
                  </div>
                </div>
              )}

              {/* PHOTOGRAPHY CARD */}
              {currentVendors.photography && (
                <div className="vendor-card">
                  <div className="vendor-card-header">
                    <span className="vendor-cat-badge">📸 Photography & Film</span>
                    <span className="vendor-share-badge">
                      {Math.round((currentVendors.photography.price / budget) * 100)}% of budget
                    </span>
                  </div>
                  <div className="vendor-card-body">
                    <h4 className="vendor-name">{currentVendors.photography.name}</h4>
                    <p className="vendor-loc">Candid Stills & HD Video Reel</p>
                    <div className="vendor-meta">
                      <span className="vendor-rating">⭐ {currentVendors.photography.rating}</span>
                      <span className="vendor-price">{formatINR(currentVendors.photography.price)}</span>
                    </div>
                    <div className="vendor-tags">
                      {currentVendors.photography.tags?.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  </div>
                  <div className="vendor-card-actions">
                    <button type="button" className="action-link-btn" onClick={() => setViewDetailsVendor(currentVendors.photography)}>View details</button>
                    <button type="button" className="action-link-btn" onClick={() => alert(`Contacting studio manager at ${currentVendors.photography.name}...`)}>Chat in app</button>
                    <button type="button" className="action-pill-btn" onClick={() => setSwapCategory('photography')}>Swap ⇄</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =================================================================
              "WHY THIS PLAN?" EXPANDABLE
              ================================================================= */}
          <div className="why-plan-accordion">
            <button
              type="button"
              className="why-plan-toggle"
              onClick={() => setWhyExpanded(!whyExpanded)}
              aria-expanded={whyExpanded}
            >
              <span>🔍 Why this plan? (Budget floor &amp; distribution)</span>
              <span>{whyExpanded ? '▲' : '▼'}</span>
            </button>
            {whyExpanded && (
              <div className="why-plan-content">
                <p>
                  <strong>City Benchmarks:</strong> For <em>{plates} guests</em> in <em>{city}</em>, our budget engine calculated:
                </p>
                <ul>
                  <li><strong>Budget Floor:</strong> {formatINR(floor)} (minimum required cost to book essential quality partners).</li>
                  <li><strong>Ceiling:</strong> {formatINR(ceiling)} (luxury tier with premium decor &amp; dining).</li>
                  <li><strong>Your Allocation:</strong> Catering {split.catering}%, Hall {split.hall}%, Decor {split.decor}%, Extras {split.extras}%.</li>
                </ul>
                {notes.length > 0 && (
                  <div className="notes-box">
                    <strong>Special AI Notes:</strong>
                    {notes.map((n, i) => <p key={i} style={{ margin: '4px 0', color: 'var(--muted)' }}>• {n}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          BOTTOM ACTIONS
          ===================================================================== */}
      <div className="plan-result-bottom-actions">
        <button
          type="button"
          className="cta pulse-gold"
          onClick={() => setBookingOpen(true)}
        >
          Book this plan ⚡
        </button>
        <button
          type="button"
          className="cta ghost"
          onClick={onEditAnswers}
        >
          Change my answers
        </button>
        <button
          type="button"
          className="pill"
          onClick={handleShare}
          style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
        >
          🔗 Share plan
        </button>
      </div>

      {shareToast && (
        <div className="share-toast" role="status">
          ✓ Plan link copied to clipboard!
        </div>
      )}

      {/* =====================================================================
          SWAP MODAL
          ===================================================================== */}
      {swapCategory && (
        <div className="modal-backdrop" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-card swap-modal-card">
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSwapCategory(null)}
            >
              &times;
            </button>
            <h3 className="auth-heading" style={{ fontSize: '1.4rem' }}>
              Select Alternative {swapCategory.toUpperCase()}
            </h3>
            <p className="auth-subtext">
              Choose an alternative partner within your budget. Totals update live.
            </p>

            <div className="swap-list-wrap">
              {getAlternatives().map((alt) => (
                <div key={alt.id} className="swap-item-row">
                  <div>
                    <strong>{alt.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      📍 {alt.city} &middot; ⭐ {alt.rating}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: '4px' }}>
                      {formatINR(alt.price)}
                    </div>
                    <button
                      type="button"
                      className="pill g"
                      onClick={() => handleSwapSelect(alt)}
                    >
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VENDOR DETAILS MODAL
          ===================================================================== */}
      {viewDetailsVendor && (
        <div className="modal-backdrop" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-card">
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setViewDetailsVendor(null)}
            >
              &times;
            </button>
            <h3 className="auth-heading">{viewDetailsVendor.name}</h3>
            <p className="auth-subtext">📍 {viewDetailsVendor.city} &middot; ⭐ {viewDetailsVendor.rating} Rating</p>
            <div style={{ margin: '16px 0', padding: '16px', background: 'var(--bg)', borderRadius: '14px', border: '1px solid var(--line)' }}>
              <p><strong>Estimated Price:</strong> {formatINR(viewDetailsVendor.price || viewDetailsVendor.totalCalculatedPrice)}</p>
              {viewDetailsVendor.capacity && <p><strong>Capacity:</strong> {viewDetailsVendor.capacity} guests</p>}
              {viewDetailsVendor.desc && <p><strong>Details:</strong> {viewDetailsVendor.desc}</p>}
              <p><strong>Verified Partner:</strong> 100% genuine ratings verified by Utsavora event concierges.</p>
            </div>
            <button
              type="button"
              className="cta"
              style={{ width: '100%' }}
              onClick={() => {
                setViewDetailsVendor(null);
                alert(`Starting conversation with ${viewDetailsVendor.name}...`);
              }}
            >
              Contact Vendor in App
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          BOOKING REQUEST MODAL
          ===================================================================== */}
      {bookingOpen && (
        <div className="modal-backdrop" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-card">
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => {
                setBookingOpen(false);
                setBookingSubmitted(false);
              }}
            >
              &times;
            </button>

            {!bookingSubmitted ? (
              <>
                <h3 className="auth-heading" style={{ fontSize: '1.45rem' }}>
                  Request Booking for {eventDisplayName} Plan
                </h3>
                <p className="auth-subtext">
                  Our dedicated Utsavora concierge locks dates with all vendors for free.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!bookingPhone || bookingPhone.length !== 10) {
                      alert('Please enter a valid 10-digit mobile number');
                      return;
                    }
                    setBookingSubmitted(true);
                  }}
                  style={{ marginTop: '16px' }}
                >
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="field-label">Mobile Number</label>
                    <input
                      type="tel"
                      className="vedika-input"
                      placeholder="10-digit mobile"
                      maxLength="10"
                      value={bookingPhone}
                      onChange={(e) => setBookingPhone(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="field-label">Special instructions / Requests</label>
                    <textarea
                      className="vedika-input"
                      rows="3"
                      placeholder="Any specific muhurtham timings, food requests, or hall preferences..."
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="cta" style={{ width: '100%' }}>
                    Confirm Booking Request
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }} aria-hidden="true">🎉</div>
                <h3 className="auth-heading" style={{ fontSize: '1.4rem' }}>
                  Booking Request Received!
                </h3>
                <p className="auth-subtext" style={{ marginTop: '8px', lineHeight: 1.6 }}>
                  Our event concierge has notified the venues and caterers in <strong>{city}</strong>. We will call you on <strong>+91 {bookingPhone}</strong> within 2 hours.
                </p>
                <button
                  type="button"
                  className="cta"
                  style={{ marginTop: '20px', width: '100%' }}
                  onClick={() => {
                    setBookingOpen(false);
                    setBookingSubmitted(false);
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
