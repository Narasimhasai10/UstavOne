import React from 'react';

export default function DashboardFormPanel({
  budget,
  setBudget,
  formatLakh,
  guests,
  setGuests,
  daysCount,
  setDaysCount,
  serviceNeed,
  setServiceNeed,
  functionDate,
  setFunctionDate,
  hallCondition,
  setHallCondition,
  bookingDuration,
  setBookingDuration,
  decorLevel,
  setDecorLevel,
  servingStyle,
  setServingStyle,
  foodCategory,
  setFoodCategory,
  cuisine,
  setCuisine,
  foodType,
  setFoodType,
  nonVegPercent,
  setNonVegPercent,
  triggerHighlight,
  basicRange,
  standardRange,
  premiumRange,
  luxuryRange
}) {
  return (
              <div className="panel">
                <h2>Tell us about your event</h2>
                <small>The plan updates as you change these.</small>
    
                {/* 1. Total Budget */}
                <div className="row">
                  <label htmlFor="b-slider">
                    <span>Total budget</span>
                    <output style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatLakh(budget)}</output>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      id="b-slider"
                      type="range"
                      min="50000"
                      max="10000000"
                      step="10000"
                      value={budget}
                      onInput={(e) => { setBudget(Number(e.target.value)); triggerHighlight('budget'); }}
                      onChange={(e) => { setBudget(Number(e.target.value)); triggerHighlight('budget'); }}
                    />
                    <input
                      type="text"
                      value={formatINR(budget)}
                      onChange={(e) => {
                        const cleaned = Number(e.target.value.replace(/[^0-9]/g, ''));
                        if (!isNaN(cleaned) && cleaned > 0) {
                          setBudget(cleaned);
                          triggerHighlight('budget');
                        }
                      }}
                      style={{ width: '110px', padding: '5px 8px', borderRadius: '8px', border: '1.5px solid var(--line)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', background: 'var(--card)' }}
                      aria-label="Typed budget"
                    />
                  </div>
    
                  {/* Quick Chips: ₹2L, ₹5L, ₹10L, ₹30L, ₹60L */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {[200000, 500000, 1000000, 3000000, 6000000].map((bVal) => (
                      <button
                        key={bVal}
                        type="button"
                        className="f"
                        style={{ padding: '3px 10px', fontSize: '0.8rem', borderRadius: '99px', border: '1px solid var(--line)', color: 'var(--text)' }}
                        onClick={() => { setBudget(bVal); triggerHighlight('budget'); }}
                      >
                        {formatLakh(bVal)}
                      </button>
                    ))}
                  </div>
                </div>
    
                {/* 2. I need: Hall / Catering / Both */}
                <div className="row">
                  <label>I need</label>
                  <div className="seg" role="radiogroup" aria-label="Services needed">
                    {[
                      { id: 'hall', label: 'Hall' },
                      { id: 'catering', label: 'Catering' },
                      { id: 'both', label: 'Both' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={serviceNeed === opt.id}
                        onClick={() => { setServiceNeed(opt.id); triggerHighlight('all'); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
    
                {/* 3. Number of guests */}
                <div className="row">
                  <label htmlFor="g-slider">
                    <span>Number of guests</span>
                    <output style={{ color: 'var(--gold)', fontWeight: 700 }}>{guests}</output>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      id="g-slider"
                      type="range"
                      min="20"
                      max="2000"
                      step="10"
                      value={guests}
                      onInput={(e) => { setGuests(Number(e.target.value)); triggerHighlight('catering'); }}
                      onChange={(e) => { setGuests(Number(e.target.value)); triggerHighlight('catering'); }}
                    />
                    <input
                      type="number"
                      min="20"
                      max="2000"
                      value={guests}
                      onChange={(e) => {
                        setGuests(Math.max(20, Math.min(2000, Number(e.target.value))));
                        triggerHighlight('catering');
                      }}
                      style={{ width: '75px', padding: '5px 8px', borderRadius: '8px', border: '1.5px solid var(--line)', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', background: 'var(--card)' }}
                      aria-label="Typed guests"
                    />
                  </div>
                </div>
    
                {/* 4. Function date */}
                <div className="row">
                  <label htmlFor="f-date">
                    <span>Function date (optional)</span>
                    {functionDate && <output style={{ color: '#f8ebd8', fontWeight: 600 }}>{functionDate}</output>}
                  </label>
                  <input
                    id="f-date"
                    type="date"
                    value={functionDate}
                    onChange={(e) => setFunctionDate(e.target.value)}
                    style={{ width: '100%', marginTop: '6px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--text)' }}
                  />
                </div>
    
                {/* Hall Details Group (shown if Hall or Both) */}
                {(serviceNeed === 'both' || serviceNeed === 'hall') && (
                  <div className="conditional-group" style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px dashed var(--line)' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#f8ebd8', marginBottom: '8px' }}>🏛 Hall details</h3>
    
                    {/* 4a. Hall condition */}
                    <div className="row">
                      <label>Hall condition</label>
                      <div className="seg" role="radiogroup">
                        {['AC', 'Non-AC'].map(c => (
                          <button
                            key={c}
                            type="button"
                            aria-pressed={hallCondition === c.toLowerCase()}
                            onClick={() => { setHallCondition(c.toLowerCase()); triggerHighlight('hall'); }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
    
                    {/* 4b. Booking duration */}
                    <div className="row">
                      <label>Booking duration</label>
                      <div className="seg" role="radiogroup">
                        {[
                          { id: 'half day', label: 'Half day' },
                          { id: 'full day', label: 'Full day' },
                          { id: 'multiple days', label: 'Multiple days' }
                        ].map(d => (
                          <button
                            key={d.id}
                            type="button"
                            aria-pressed={bookingDuration === d.id}
                            onClick={() => { setBookingDuration(d.id); triggerHighlight('hall'); }}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      {bookingDuration === 'multiple days' && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>How many days? (2-10):</span>
                          <input
                            type="number"
                            min="2"
                            max="10"
                            value={daysCount}
                            onChange={(e) => {
                              setDaysCount(Math.max(2, Math.min(10, Number(e.target.value))));
                              triggerHighlight('hall');
                            }}
                            style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1.5px solid var(--line)', color: 'var(--text)', background: 'var(--card)' }}
                          />
                        </div>
                      )}
                    </div>
    
                    {/* 4c. Decoration */}
                    <div className="row">
                      <label>Decoration</label>
                      <div className="seg" role="radiogroup">
                        {['Low', 'Medium', 'High'].map(l => (
                          <button
                            key={l}
                            type="button"
                            aria-pressed={decorLevel === l.toLowerCase()}
                            onClick={() => { setDecorLevel(l.toLowerCase()); triggerHighlight('decor'); }}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
    
                {/* Catering Details Group (shown if Catering or Both) */}
                {(serviceNeed === 'both' || serviceNeed === 'catering') && (
                  <div className="conditional-group" style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px dashed var(--line)' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#f8ebd8', marginBottom: '8px' }}>🍽 Catering details</h3>
    
                    {/* 5a. Serving style */}
                    <div className="row">
                      <label>Serving style</label>
                      <div className="seg" role="radiogroup">
                        {[
                          { id: 'banana leaf', label: 'Banana Leaf' },
                          { id: 'buffet', label: 'Buffet' },
                          { id: 'table service', label: 'Table Service' }
                        ].map(s => (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={servingStyle === s.id}
                            onClick={() => { setServingStyle(s.id); triggerHighlight('catering'); }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
    
                    {/* 5b. Food category: 4 cards */}
                    <div className="row">
                      <label>Food category</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '6px' }}>
                        {[
                          { id: 'basic', label: 'Basic', dishes: '10-15 dishes', range: `₹${basicRange.minPlate}–${basicRange.maxPlate}` },
                          { id: 'standard', label: 'Standard', dishes: '15-20 dishes', range: `₹${standardRange.minPlate}–${standardRange.maxPlate}` },
                          { id: 'premium', label: 'Premium', dishes: '20-30 dishes', range: `₹${premiumRange.minPlate}–${premiumRange.maxPlate}` },
                          { id: 'luxury', label: 'Luxury', dishes: '30+ dishes', range: `₹${luxuryRange.minPlate}–${luxuryRange.maxPlate}` }
                        ].map(card => {
                          const isSel = foodCategory === card.id;
                          return (
                            <div
                              key={card.id}
                              onClick={() => { setFoodCategory(card.id); triggerHighlight('catering'); }}
                              style={{
                                border: `2px solid ${isSel ? 'var(--gold)' : 'var(--line)'}`,
                                background: isSel ? 'color-mix(in srgb, var(--gold) 12%, var(--card))' : 'var(--card)',
                                borderRadius: '12px',
                                padding: '10px 8px',
                                cursor: 'pointer',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSel ? 'var(--gold)' : '#f8ebd8' }}>{card.label}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{card.dishes}</div>
                              <div style={{ fontSize: '0.78rem', color: isSel ? 'var(--gold)' : 'rgba(248, 235, 216, 0.75)', marginTop: '4px', fontWeight: 600 }}>{card.range}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
    
                    {/* 5c. Cuisine */}
                    <div className="row">
                      <label>Cuisine</label>
                      <div className="seg" role="radiogroup">
                        {[
                          { id: 'andhra', label: 'Andhra' },
                          { id: 'south indian', label: 'South Indian' },
                          { id: 'north indian', label: 'North Indian' },
                          { id: 'multi-cuisine', label: 'Multi-Cuisine' }
                        ].map(c => (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={cuisine === c.id}
                            onClick={() => { setCuisine(c.id); triggerHighlight('catering'); }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
    
                    {/* 5d. Food type */}
                    <div className="row">
                      <label>Food type</label>
                      <div className="seg" role="radiogroup">
                        {['Veg', 'Non-Veg', 'Both'].map(t => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={foodType === t.toLowerCase()}
                            onClick={() => { setFoodType(t.toLowerCase()); triggerHighlight('catering'); }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
    
                      {foodType === 'both' && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)' }}>
                            <span>% Non-Veg plates:</span>
                            <b>{nonVegPercent}% ({Math.round(guests * nonVegPercent / 100)} plates)</b>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={nonVegPercent}
                            onInput={(e) => { setNonVegPercent(Number(e.target.value)); triggerHighlight('catering'); }}
                            onChange={(e) => { setNonVegPercent(Number(e.target.value)); triggerHighlight('catering'); }}
                            style={{ width: '100%', marginTop: '4px' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
  );
}
