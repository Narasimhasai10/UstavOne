import React from 'react';
import SafeImage from '../../shared/components/SafeImage.jsx';

export default function DashboardVendorsCatalog({
  userCity,
  userState,
  TAB_CONFIG,
  lowerActiveTab,
  setLowerActiveTab,
  lowerSearchQuery,
  setLowerSearchQuery,
  tierFilter,
  setTierFilter,
  placeFilter,
  updatePlaceFilter,
  isPlacePopoverOpen,
  setIsPlacePopoverOpen,
  placePopoverStep,
  setPlacePopoverStep,
  popoverSelectedState,
  setPopoverSelectedState,
  districtSearchQuery,
  setDistrictSearchQuery,
  placePopoverRef,
  districtsData,
  displayedVendorList,
  serviceNeed,
  handleVendorCardClick,
  onOpenChat,
  onOpenBook
}) {
  return (
    <>
      <div className="bar" style={{ marginTop: '36px' }}>
              <h2>Picked for you in {userCity}</h2>
              <div className="tabs" role="tablist" aria-label="Vendor categories">
                {Object.keys(TAB_CONFIG).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="tab"
                    aria-pressed={lowerActiveTab === k}
                    onClick={() => setLowerActiveTab(k)}
                    style={{
                      background: lowerActiveTab === k ? 'var(--gold)' : 'var(--card)',
                      color: lowerActiveTab === k ? '#3A0A1E' : '#f8ebd8',
                      borderColor: lowerActiveTab === k ? 'var(--gold)' : 'var(--line)',
                      fontWeight: lowerActiveTab === k ? 700 : 500
                    }}
                  >
                    {TAB_CONFIG[k].icon} {TAB_CONFIG[k].label}
                  </button>
                ))}
              </div>
            </div>
    
            {/* Search Bar & Filters Above Results */}
            <div style={{ margin: '14px 0 12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder={`Search ${TAB_CONFIG[lowerActiveTab]?.label.toLowerCase()} by name, area or keyword...`}
                  value={lowerSearchQuery}
                  onChange={(e) => setLowerSearchQuery(e.target.value)}
                  className="vedika-input"
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--line)',
                    background: 'var(--card)',
                    color: '#f8ebd8',
                    fontSize: '0.93rem'
                  }}
                  aria-label="Search vendors"
                />
              </div>
              {lowerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLowerSearchQuery('')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'rgba(255, 231, 176, 0.1)',
                    color: '#f8ebd8',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Clear search
                </button>
              )}
            </div>
    
            {/* Price Tier Filters & Place Filter */}
            <div className="filters" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', position: 'relative' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.9rem' }}>Price tier:</span>
              {['All', 'Budget', 'Mid-range', 'Premium'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="f"
                  aria-pressed={tierFilter === t}
                  onClick={() => setTierFilter(t)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '99px',
                    border: `1.5px solid ${tierFilter === t ? 'var(--gold)' : 'var(--line)'}`,
                    background: tierFilter === t ? 'var(--gold)' : 'transparent',
                    color: tierFilter === t ? '#3A0A1E' : '#f8ebd8',
                    fontWeight: tierFilter === t ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
    
              {/* Place Filter Pill & Popover */}
              <div style={{ position: 'relative' }} ref={placePopoverRef}>
                {placeFilter.district ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '99px',
                      border: '1.5px solid var(--gold)',
                      background: 'color-mix(in srgb, var(--gold) 15%, transparent)',
                      color: '#FFE7B0',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setPopoverSelectedState(placeFilter.state || 'Andhra Pradesh');
                      setPlacePopoverStep('district');
                      setIsPlacePopoverOpen(true);
                    }}
                  >
                    📍 Place: {placeFilter.district}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePlaceFilter({ state: null, district: null });
                      }}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#FFE7B0',
                        cursor: 'pointer',
                        fontWeight: 700,
                        padding: 0,
                        fontSize: '0.9rem',
                        marginLeft: '2px'
                      }}
                      aria-label="Clear place filter"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="f"
                    onClick={() => {
                      setPlacePopoverStep('state');
                      setIsPlacePopoverOpen(!isPlacePopoverOpen);
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '99px',
                      border: '1.5px solid var(--line)',
                      background: 'transparent',
                      color: '#f8ebd8',
                      fontWeight: 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📍 Place ▾
                  </button>
                )}
    
                {/* Place Filter Popover */}
                {isPlacePopoverOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '8px',
                      background: 'var(--card)',
                      border: '1.5px solid var(--gold)',
                      borderRadius: '16px',
                      padding: '16px',
                      zIndex: 100,
                      width: '280px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                      color: 'var(--text)'
                    }}
                  >
                    {placePopoverStep === 'state' ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <b style={{ color: '#FFE7B0', fontSize: '0.95rem' }}>Select State</b>
                          <button
                            type="button"
                            onClick={() => setIsPlacePopoverOpen(false)}
                            style={{ background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {['Andhra Pradesh', 'Telangana'].map(st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setPopoverSelectedState(st);
                                setDistrictSearchQuery('');
                                setPlacePopoverStep('district');
                              }}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--line)',
                                background: 'rgba(255,255,255,0.04)',
                                color: '#f8ebd8',
                                textAlign: 'left',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <span>{st}</span>
                              <span>→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setPlacePopoverStep('state')}
                            style={{ background: 'transparent', border: 0, color: '#FFE7B0', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                          >
                            ← Back
                          </button>
                          <b style={{ color: '#FFE7B0', fontSize: '0.95rem', flex: 1, textAlign: 'center' }}>{popoverSelectedState}</b>
                          <button
                            type="button"
                            onClick={() => setIsPlacePopoverOpen(false)}
                            style={{ background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}
                          >
                            ✕
                          </button>
                        </div>
    
                        <input
                          type="text"
                          placeholder="Search district..."
                          value={districtSearchQuery}
                          onChange={(e) => setDistrictSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--line)',
                            background: 'rgba(0,0,0,0.2)',
                            color: '#f8ebd8',
                            fontSize: '0.85rem',
                            marginBottom: '10px'
                          }}
                        />
    
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(districtsData[popoverSelectedState] || [])
                            .filter(d => !districtSearchQuery.trim() || d.toLowerCase().includes(districtSearchQuery.toLowerCase().trim()))
                            .map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  if (placeFilter.district === d) {
                                    updatePlaceFilter({ state: null, district: null });
                                  } else {
                                    updatePlaceFilter({ state: popoverSelectedState, district: d });
                                  }
                                  setIsPlacePopoverOpen(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: placeFilter.district === d ? '1px solid var(--gold)' : '1px solid transparent',
                                  background: placeFilter.district === d ? 'rgba(234, 171, 80, 0.2)' : 'transparent',
                                  color: '#f8ebd8',
                                  textAlign: 'left',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {d} {placeFilter.district === d ? '✓' : ''}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
    
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                Showing {displayedVendorList.length} {TAB_CONFIG[lowerActiveTab]?.label.toLowerCase()}
              </span>
            </div>
    
            {/* Restored Full Vendor Grid */}
            <div className="grid">
              {lowerActiveTab === 'C' && serviceNeed === 'hall' ? (
                <div className="empty" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  Add catering in your plan to see caterers.
                </div>
              ) : lowerActiveTab === 'H' && serviceNeed === 'catering' ? (
                <div className="empty" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  Add hall in your plan to see function halls.
                </div>
              ) : displayedVendorList.length > 0 ? (
                displayedVendorList.map((vendor) => (
                  <article
                    key={vendor.id}
                    className="v"
                    onClick={() => handleVendorCardClick(vendor.raw || vendor)}
                    style={{ opacity: vendor.isBooked ? 0.65 : 1, cursor: 'pointer' }}
                  >
                    <div
                      className="pic"
                      style={{
                        background: vendor.raw?.gradient || 'linear-gradient(135deg, var(--ink2), var(--acc))',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {(vendor.coverPhotoUrl || vendor.raw?.coverPhotoUrl || vendor.raw?.coverPhoto || vendor.raw?.photos?.[0]?.url) ? (
                        <SafeImage
                          src={vendor.coverPhotoUrl || vendor.raw?.coverPhotoUrl || vendor.raw?.coverPhoto || vendor.raw?.photos?.[0]?.url}
                          alt={vendor.name}
                          kind={vendor.type === 'caterer' ? 'caterer' : 'hall'}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#FFE7B0', padding: '12px', zIndex: 1 }}>
                          <div style={{ fontSize: '2.5rem' }}>
                            {TAB_CONFIG[lowerActiveTab]?.icon || (vendor.type === 'caterer' ? '🍽️' : '🏛️')}
                          </div>
                        </div>
                      )}
                      {/* Tier tag with dark scrim behind text for contrast */}
                      <span className="t" style={{ background: 'rgba(0,0,0,0.72)', color: '#ffffff', fontWeight: 600 }}>
                        {vendor.tier}
                      </span>
                      {vendor.fitsPlan ? (
                        <span className="m" style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700 }}>
                          Fits your plan
                        </span>
                      ) : vendor.notFitLabel ? (
                        <span
                          className="m"
                          style={{
                            background: 'rgba(235, 87, 87, 0.28)',
                            color: '#FFB4A2',
                            border: '1px solid rgba(235, 87, 87, 0.45)',
                            fontWeight: 600,
                            fontSize: '0.72rem'
                          }}
                        >
                          {vendor.notFitLabel}
                        </span>
                      ) : null}
                      {vendor.isBooked && (
                        <span style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'var(--rose)', color: '#ffffff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          Not available on this date
                        </span>
                      )}
                    </div>
    
                    <div className="vb">
                      <h3 style={{ color: '#f8ebd8' }}>{vendor.name}</h3>
                      <div style={{ fontSize: '0.82rem', color: vendor.fitsPlan ? 'var(--leaf)' : 'rgba(248, 235, 216, 0.75)', margin: '2px 0 4px', fontStyle: 'italic', fontWeight: 500 }}>
                        {vendor.pickReason}
                      </div>
                      <div className="meta">
                        <span className="star" style={{ color: '#D99A00', fontWeight: 700 }}>★ {vendor.rating}</span>
                        <span style={{ color: 'var(--muted)' }}>
                          {vendor.city} {vendor.capacity ? `· Capacity ${vendor.capacity}` : ''}
                          {vendor.type === 'hall' && vendor.isAC != null ? ` · ${vendor.isAC ? 'AC Hall' : 'Non-AC'}` : ''}
                          {vendor.type === 'caterer' && vendor.vegInfo ? ` · ${vendor.vegInfo}` : ''}
                        </span>
                      </div>
    
                      <div className="pr">
                        {vendor.priceDisplay} <small>{vendor.subtext}</small>
                      </div>
    
                      <div
                        className="acts"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="c"
                          onClick={() => onOpenChat(vendor.raw || vendor)}
                          aria-label={`Chat with ${vendor.name}`}
                        >
                          💬 Chat
                        </button>
                        <button
                          type="button"
                          className="b"
                          disabled={vendor.isBooked}
                          onClick={() => onOpenBook(vendor.raw || vendor)}
                          aria-label={`Book ${vendor.name}`}
                        >
                          {vendor.isBooked ? 'Booked' : 'Book'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty" style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  {placeFilter.district
                    ? `No ${TAB_CONFIG[lowerActiveTab]?.label.toLowerCase() || 'vendors'} found in ${placeFilter.district} district.`
                    : (lowerSearchQuery ? `No vendors found matching "${lowerSearchQuery}".` : 'No vendors found in this category.')}
                </div>
              )}
            </div>
    </>
  );
}
