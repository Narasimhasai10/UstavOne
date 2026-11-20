import React, { useState, useEffect, useMemo, useRef } from 'react';
import Confetti from './Confetti.jsx';
import dummyVendors from '../data/dummyVendors.json' with { type: 'json' };
import { EVENT_TYPES, CITIES_BY_STATE, ALL_CITIES } from '../data/events.js';
import { planEvent, calculatePlateRange, formatINR, formatLakh } from '../engine/planner.js';
import PLANNER_CONFIG from '../engine/config.js';
import { saveUserPlan, getSelectedEvent, setSelectedEvent, getUnifiedVendorsCatalog } from '../services/store.js';
import { applyThemeColors, onColor } from '../utils/contrastUtils.js';

const TAB_CONFIG = {
  H: { label: 'Function halls', icon: '🏛' },
  C: { label: 'Caterers', icon: '🍽' },
  X: { label: 'Decor, band, cards', icon: '✨' }
};

// Fixed category colors as specified
const SPLIT_COLORS = {
  catering: '#E4572E',
  hall: '#2F9E7B',
  decor: '#D6254F',
  extras: '#E8B84A'
};

export default function DashboardView({
  user,
  onLogout,
  onOpenMyBookings,
  onSelectVendor,
  onOpenChat,
  onOpenBook,
  onUpdateUserLocation,
  onTriggerLoader
}) {
  const userCity = user?.city || user?.location?.city || 'Kadapa';
  const userState = user?.state || user?.location?.state || 'Andhra Pradesh';

  // Unified vendor catalog including vendor-added branches
  const unifiedVendors = useMemo(() => getUnifiedVendorsCatalog(dummyVendors), []);

  const greetingName = useMemo(() => {
    if (!user || !user.name) return 'Narasimha';
    if (user.phone === '9390075877' || user.name.includes('Narasimha')) return 'Narasimha';
    return user.name.trim().split(/\s+/)[0] || 'Friend';
  }, [user]);

  // Event Selection (Persisted in localStorage as "vedika.event", defaults to "wedding")
  const events = EVENT_TYPES;
  const [selectedEventId, setSelectedEventIdState] = useState(() => {
    return getSelectedEvent() || 'wedding';
  });

  const selectedEventIndex = useMemo(() => {
    const idx = events.findIndex(e => e.id === selectedEventId);
    return idx >= 0 ? idx : 0;
  }, [events, selectedEventId]);

  const currentEvent = events[selectedEventIndex] || events[0];

  // Confetti Burst (22 pieces)
  const [confettiPieces, setConfettiPieces] = useState([]);
  const fireConfetti = () => {
    const colors = ['#E8B84A', '#FF5C8A', '#3DD6C6', '#5AA2FF', '#A57BFF', '#FFA62B', '#5FD38D'];
    const pieces = [];
    for (let i = 0; i < 22; i++) {
      pieces.push({
        id: Math.random(),
        color: colors[i % colors.length],
        left: `${(i * 4.5 + Math.random() * 5) % 96 + 2}%`,
        x: `${(Math.random() - 0.5) * 200}px`,
        y: `${700 + Math.random() * 300}px`,
        duration: `${1.8 + Math.random() * 0.8}s`
      });
    }
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 2600);
  };

  // Set theme colors once when selected event changes (NO AUTO-CYCLE!)
  useEffect(() => {
    applyThemeColors(currentEvent.color || '#FF5C8A');
  }, [currentEvent.color]);

  // FORM ANSWERS (State)
  const [budget, setBudget] = useState(800000);
  const [serviceNeed, setServiceNeed] = useState('both'); // 'both' | 'hall' | 'catering'
  const [guests, setGuests] = useState(600);
  const [functionDate, setFunctionDate] = useState('');

  // Hall specific
  const [hallCondition, setHallCondition] = useState('ac'); // 'ac' | 'non-ac'
  const [bookingDuration, setBookingDuration] = useState('full day'); // 'half day' | 'full day' | 'multiple days'
  const [daysCount, setDaysCount] = useState(2);
  const [decorLevel, setDecorLevel] = useState('medium'); // 'low' | 'medium' | 'high'

  // Catering specific
  const [servingStyle, setServingStyle] = useState('buffet'); // 'banana leaf' | 'buffet' | 'table service'
  const [foodCategory, setFoodCategory] = useState('standard'); // 'basic' | 'standard' | 'premium' | 'luxury'
  const [cuisine, setCuisine] = useState('andhra'); // 'andhra' | 'south indian' | 'north indian' | 'multi-cuisine'
  const [foodType, setFoodType] = useState('both'); // 'veg' | 'non-veg' | 'both'
  const [nonVegPercent, setNonVegPercent] = useState(50);

  // Package Switch: 'Budget-friendly' | 'Balanced' | 'Premium'
  const [selectedPackageName, setSelectedPackageName] = useState('Balanced');

  // Active Category Tab: 'H' | 'C' | 'X'
  const [activeTab, setActiveTab] = useState('H');

  // Filters: 'All' | 'Budget' | 'Mid-range' | 'Premium'
  const [tierFilter, setTierFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('m'); // 'm' | 'r' | 'p'

  // Buttons feedback
  const [savePlanFeedback, setSavePlanFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  // Row highlight tracking
  const [highlightedRow, setHighlightedRow] = useState(null);
  const triggerHighlight = (rowKey) => {
    setHighlightedRow(rowKey);
    setTimeout(() => setHighlightedRow(null), 800);
  };

  // Location modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempState, setTempState] = useState(userState);
  const [tempCity, setTempCity] = useState(userCity);

  // When user selects an event chip: only manual click changes event
  const [burstKey, setBurstKey] = useState(0);

  const handleSelectEvent = (idx) => {
    const ev = events[idx];
    if (!ev) return;
    setSelectedEventIdState(ev.id);
    setSelectedEvent(ev.id);
    setBurstKey(k => k + 1);
    fireConfetti();
    if (ev.defaultBudget) {
      setBudget(ev.defaultBudget);
      if (ev.id === 'wedding') { setGuests(600); }
      else if (ev.id === 'birthday') { setGuests(100); }
      else if (ev.id === 'corporate') { setGuests(250); }
      else if (ev.id === 'educational') { setGuests(800); }
      else { setGuests(200); }
    }
    triggerHighlight('all');
  };

  // Run AI planner engine safely (never throws)
  const planResult = useMemo(() => {
    try {
      return planEvent({
        event: currentEvent.id,
        city: userCity,
        budget,
        serviceNeed,
        guests,
        date: functionDate,
        hallCondition,
        bookingDuration,
        daysCount: bookingDuration === 'multiple days' ? Number(daysCount) : 1,
        decorLevel,
        servingStyle,
        foodCategory,
        cuisine,
        foodType,
        nonVegPercent
      }, unifiedVendors, PLANNER_CONFIG);
    } catch (err) {
      console.error('[DashboardView] planEvent error:', err);
      return null;
    }
  }, [
    currentEvent.id, userCity, budget, serviceNeed, guests, functionDate,
    hallCondition, bookingDuration, daysCount, decorLevel,
    servingStyle, foodCategory, cuisine, foodType, nonVegPercent
  ]);

  // Current selected package
  const activePackage = useMemo(() => {
    if (!planResult) return null;
    const pkgs = planResult.packages || [];
    return pkgs.find(p => p.name.toLowerCase() === selectedPackageName.toLowerCase()) || pkgs[1] || pkgs[0];
  }, [planResult, selectedPackageName]);

  // Plate ranges for the 4 food category cards (in current city)
  const cityMult = PLANNER_CONFIG.cityMultipliers[userCity.toLowerCase()] ?? 1.0;
  const basicRange = calculatePlateRange('basic', foodType, nonVegPercent, servingStyle, cuisine, cityMult, PLANNER_CONFIG);
  const standardRange = calculatePlateRange('standard', foodType, nonVegPercent, servingStyle, cuisine, cityMult, PLANNER_CONFIG);
  const premiumRange = calculatePlateRange('premium', foodType, nonVegPercent, servingStyle, cuisine, cityMult, PLANNER_CONFIG);
  const luxuryRange = calculatePlateRange('luxury', foodType, nonVegPercent, servingStyle, cuisine, cityMult, PLANNER_CONFIG);

  // Vendor lists for Picked For You
  const vendorList = useMemo(() => {
    if (!planResult) return [];
    const cityLower = userCity.toLowerCase();
    const isDateBooked = (v) => {
      if (!functionDate || !v.bookedDates) return false;
      return v.bookedDates.includes(functionDate);
    };

    let items = [];

    if (activeTab === 'H') {
      const halls = planResult.scoredHalls || [];
      const cityFiltered = halls.filter(h => h.city.toLowerCase() === cityLower || h.city.toLowerCase() === 'all');
      const list = cityFiltered.length > 0 ? cityFiltered : halls;

      items = list.map(h => {
        const booked = isDateBooked(h);
        const tier = h.price < 90000 ? 'Budget' : h.price < 250000 ? 'Mid-range' : 'Premium';
        return {
          id: h.id,
          name: h.name,
          type: 'hall',
          city: h.city,
          rating: h.rating,
          price: h.price,
          priceDisplay: formatINR(h.price),
          subtext: `Capacity: ${h.capacity} guests`,
          tier,
          fitsPlan: h.fitsPlan,
          pickReason: h.pickReason,
          isBooked: booked,
          raw: h
        };
      });
    } else if (activeTab === 'C') {
      const caterers = planResult.scoredCaterers || [];
      const cityFiltered = caterers.filter(c => c.city.toLowerCase() === cityLower || c.city.toLowerCase() === 'all');
      const list = cityFiltered.length > 0 ? cityFiltered : caterers;

      items = list.map(c => {
        const booked = isDateBooked(c);
        const plateP = c.price || c.effectivePrice || planResult.targetPlate || 350;
        const tier = plateP < 320 ? 'Budget' : plateP < 480 ? 'Mid-range' : 'Premium';
        return {
          id: c.id,
          name: c.name,
          type: 'caterer',
          city: c.city,
          rating: c.rating,
          price: plateP,
          priceDisplay: c.price ? `₹${c.price} / plate` : `₹${plateP} / plate (estimated)`,
          subtext: `Total ≈ ${formatINR(plateP * guests)}`,
          tier,
          fitsPlan: c.fitsPlan,
          pickReason: c.pickReason,
          isBooked: booked,
          raw: c
        };
      });
    } else {
      const dItems = (unifiedVendors.decor || []).filter(d => d.city.toLowerCase() === cityLower);
      const bItems = (unifiedVendors.bands || []).filter(b => b.city.toLowerCase() === cityLower);
      const cdItems = (unifiedVendors.cards || []).filter(cd => cd.city.toLowerCase() === cityLower);
      const pItems = (unifiedVendors.photography || []).filter(p => p.city.toLowerCase() === cityLower);

      const extras = [
        ...dItems.map(d => ({ ...d, type: 'decor', subtext: `${d.tier} floral & lighting`, tier: d.tier === 'low' ? 'Budget' : d.tier === 'medium' ? 'Mid-range' : 'Premium' })),
        ...bItems.map(b => ({ ...b, type: 'band', subtext: 'Traditional live music', tier: b.price < 25000 ? 'Budget' : 'Mid-range' })),
        ...cdItems.map(cd => ({ ...cd, type: 'cards', price: cd.pricePerUnit * Math.max(100, Math.round(guests * 0.6)), subtext: `₹${cd.pricePerUnit} / card`, tier: 'Budget' })),
        ...pItems.map(p => ({ ...p, type: 'photo', subtext: 'HD Photo & Cinematic Video', tier: p.price < 55000 ? 'Budget' : 'Premium' }))
      ];

      items = extras.map(x => ({
        id: x.id,
        name: x.name,
        type: x.type,
        city: x.city,
        rating: x.rating || 4.6,
        price: x.price,
        priceDisplay: formatINR(x.price),
        subtext: x.subtext,
        tier: x.tier || 'Budget',
        fitsPlan: true,
        pickReason: 'Fits your decoration and extras slice.',
        isBooked: isDateBooked(x),
        raw: x
      }));
    }

    if (tierFilter !== 'All') {
      items = items.filter(x => x.tier === tierFilter);
    }

    items.sort((a, b) => {
      if (sortOrder === 'r') return b.rating - a.rating;
      if (sortOrder === 'p') return a.price - b.price;
      return (b.fitsPlan ? 1 : 0) - (a.fitsPlan ? 1 : 0) || b.rating - a.rating;
    });

    return items;
  }, [activeTab, userCity, planResult, guests, functionDate, tierFilter, sortOrder]);

  const handleApplyFix = (fix) => {
    if (fix.action.hallCondition) setHallCondition(fix.action.hallCondition);
    if (fix.action.foodCategory) setFoodCategory(fix.action.foodCategory);
    if (fix.action.guests) setGuests(fix.action.guests);
    triggerHighlight('all');
  };

  const handleSavePlan = () => {
    saveUserPlan({
      event: currentEvent.id,
      city: userCity,
      budget,
      guests,
      package: activePackage
    });
    setSavePlanFeedback(true);
    setTimeout(() => setSavePlanFeedback(false), 2400);
  };

  const handleSharePlan = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
    setShareFeedback(true);
    setTimeout(() => setShareFeedback(false), 2400);
  };

  const handleConfirmLocation = () => {
    setShowLocationModal(false);
    if (onTriggerLoader) {
      onTriggerLoader('Lighting the lamps for your function…', () => {
        onUpdateUserLocation({ city: tempCity, state: tempState });
      });
    } else {
      onUpdateUserLocation({ city: tempCity, state: tempState });
    }
  };

  const availableCitiesForState = CITIES_BY_STATE[tempState] || ALL_CITIES;

  return (
    <div className="vedika-dashboard">
      {/* Falling-diamond Confetti Burst on event change */}
      {burstKey > 0 && <Confetti key={burstKey} burst duration={4000} />}

      {/* 22-piece Confetti Burst on event change */}
      {confettiPieces.map(p => (
        <div
          key={p.id}
          className="cf"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDuration: p.duration,
            transform: `translate(${p.x}, ${p.y}) rotate(480deg)`
          }}
        />
      ))}

      {/* Main Wrap */}
      <div className="wrap">
        {/* Hello Block */}
        <div className="hello">
          <div className="eb" aria-hidden="true">{currentEvent.emoji}</div>
          <h1>
            Hi {greetingName}, let’s plan your{' '}
            <span id="evw">
              <span key={currentEvent.id} style={{ color: 'var(--acc-text)' }}>
                {currentEvent.word || currentEvent.name.toLowerCase()}
              </span>
            </span>
          </h1>
          <p>
            Showing halls and caterers in <b>{userCity}</b>. You can switch city or state anytime.
          </p>
        </div>

        {/* 8 Event Chips */}
        <div className="chips" role="tablist" aria-label="Celebration types">
          {events.map((ev, i) => {
            const isSelected = i === selectedEventIndex;
            return (
              <button
                key={ev.id}
                type="button"
                className="chip"
                style={{
                  '--c': ev.color,
                  backgroundColor: isSelected ? ev.color : 'var(--card)',
                  borderColor: isSelected ? ev.color : 'var(--line)',
                  color: isSelected ? onColor(ev.color) : 'var(--text)',
                  fontWeight: isSelected ? 700 : 500
                }}
                aria-pressed={isSelected}
                onClick={() => handleSelectEvent(i)}
              >
                <span>{ev.emoji}</span> {ev.name}
              </button>
            );
          })}
        </div>

        {/* Two Panels Side by Side */}
        <div className="top2">
          {/* LEFT PANEL: Tell us about your event */}
          <div className="panel">
            <h2>Tell us about your event</h2>
            <small>The plan updates as you change these.</small>

            {/* 1. Total Budget */}
            <div className="row">
              <label htmlFor="b-slider">
                <span>Total budget</span>
                <output style={{ color: 'var(--rose)', fontWeight: 700 }}>{formatLakh(budget)}</output>
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
                <output style={{ color: 'var(--rose)', fontWeight: 700 }}>{guests}</output>
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
                {functionDate && <output style={{ color: 'var(--rose)' }}>{functionDate}</output>}
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
                <h3 style={{ fontSize: '1.05rem', color: 'var(--ink)', marginBottom: '8px' }}>🏛 Hall details</h3>

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
                <h3 style={{ fontSize: '1.05rem', color: 'var(--ink)', marginBottom: '8px' }}>🍽 Catering details</h3>

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
                            border: `2px solid ${isSel ? 'var(--ink)' : 'var(--line)'}`,
                            background: isSel ? 'color-mix(in srgb, var(--ink) 8%, var(--card))' : 'var(--card)',
                            borderRadius: '12px',
                            padding: '10px 8px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSel ? 'var(--ink)' : 'var(--text)' }}>{card.label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{card.dishes}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--rose)', marginTop: '4px', fontWeight: 600 }}>{card.range}</div>
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

          {/* RIGHT PANEL: Your AI Plan */}
          <div className="panel plan">
            <h2>Your AI plan</h2>
            <small>
              {currentEvent.name} · {guests} guests · {serviceNeed === 'both' ? `${bookingDuration} & catering` : serviceNeed} · {userCity}
            </small>

            <div className="big">{formatLakh(budget)}</div>

            {planResult ? (
              <>
                {/* Animated Split Bar */}
                <div className="split" aria-label="Budget split segments">
                  {serviceNeed !== 'hall' && planResult.cateringAllocation > 0 && (
                    <div
                      style={{
                        width: `${Math.round((planResult.cateringAllocation / planResult.usableBudget) * 100)}%`,
                        backgroundColor: SPLIT_COLORS.catering
                      }}
                      title={`Catering: ${formatINR(planResult.cateringAllocation)}`}
                    >
                      Catering
                    </div>
                  )}
                  {serviceNeed !== 'catering' && planResult.hallAllocation > 0 && (
                    <div
                      style={{
                        width: `${Math.round((planResult.hallAllocation / planResult.usableBudget) * 100)}%`,
                        backgroundColor: SPLIT_COLORS.hall
                      }}
                      title={`Function hall: ${formatINR(planResult.hallAllocation)}`}
                    >
                      Hall
                    </div>
                  )}
                  {serviceNeed !== 'catering' && planResult.decorAllocation > 0 && (
                    <div
                      style={{
                        width: `${Math.round((planResult.decorAllocation / planResult.usableBudget) * 100)}%`,
                        backgroundColor: SPLIT_COLORS.decor
                      }}
                      title={`Decoration: ${formatINR(planResult.decorAllocation)}`}
                    >
                      Decor
                    </div>
                  )}
                  {planResult.extrasAllocation > 0 && (
                    <div
                      style={{
                        width: `${Math.round((planResult.extrasAllocation / planResult.usableBudget) * 100)}%`,
                        backgroundColor: SPLIT_COLORS.extras,
                        color: '#3A0A1E'
                      }}
                      title={`Savings or extras: ${formatINR(planResult.extrasAllocation)}`}
                    >
                      Extras
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="lg">
                  {serviceNeed !== 'hall' && (
                    <span>
                      <i style={{ backgroundColor: SPLIT_COLORS.catering }} />
                      Catering
                      <b>{formatINR(planResult.cateringAllocation)}</b>
                    </span>
                  )}
                  {serviceNeed !== 'catering' && (
                    <span>
                      <i style={{ backgroundColor: SPLIT_COLORS.hall }} />
                      Function hall
                      <b>{formatINR(planResult.hallAllocation)}</b>
                    </span>
                  )}
                  {serviceNeed !== 'catering' && (
                    <span>
                      <i style={{ backgroundColor: SPLIT_COLORS.decor }} />
                      Decoration
                      <b>{formatINR(planResult.decorAllocation)}</b>
                    </span>
                  )}
                  <span>
                    <i style={{ backgroundColor: SPLIT_COLORS.extras }} />
                    Contingency & Extras
                    <b>{formatINR(planResult.contingencyBuffer + planResult.extrasAllocation)}</b>
                  </span>
                </div>

                {/* 3-tab switch: Budget-friendly / Balanced / Premium */}
                <div style={{ marginTop: '16px' }}>
                  <div className="seg" style={{ background: '#ffffff22', padding: '4px', borderRadius: '12px' }}>
                    {['Budget-friendly', 'Balanced', 'Premium'].map(pkgName => {
                      const isSel = selectedPackageName === pkgName;
                      return (
                        <button
                          key={pkgName}
                          type="button"
                          style={{
                            background: isSel ? 'var(--gold)' : 'transparent',
                            color: isSel ? '#3A0A1E' : '#FFE7B0',
                            fontWeight: isSel ? 700 : 500,
                            border: 0,
                            fontSize: '0.85rem'
                          }}
                          onClick={() => setSelectedPackageName(pkgName)}
                        >
                          {pkgName}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#FFE7B0', marginTop: '6px', padding: '0 4px' }}>
                    <span>Package Total: <b>{formatINR(activePackage?.totalCost)}</b></span>
                    <span style={{ color: 'var(--gold)' }}>{formatINR(activePackage?.remaining)} left</span>
                  </div>
                </div>

                {/* Note box with aria-live */}
                <div className="note" aria-live="polite">
                  {planResult.status === 'too_low' ? (
                    <div>
                      <div style={{ color: '#FFB4A2', fontWeight: 600, marginBottom: '6px' }}>
                        ⚠️ Your budget is below the minimum viable floor for these options.
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {planResult.concreteFixes.map((fix, idx) => (
                          <button
                            key={idx}
                            type="button"
                            style={{
                              background: 'var(--gold)',
                              color: '#3A0A1E',
                              border: 0,
                              borderRadius: '8px',
                              padding: '5px 10px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            onClick={() => handleApplyFix(fix)}
                          >
                            Tap to fix: {fix.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>
                        ✨ AI found {planResult.scoredHalls?.length || 6} halls and {planResult.scoredCaterers?.length || 6} caterers in <b>{userCity}</b> that match your budget.
                      </div>
                      {planResult.suggestions?.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '0.86rem', color: '#FFF8EA', background: '#ffffff1a', padding: '6px 10px', borderRadius: '8px' }}>
                          💡 {planResult.suggestions[0].text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION D: "Estimated cost for your answers" Table */}
                {planResult.estimatedCost && (
                  <div
                    style={{
                      marginTop: '20px',
                      background: 'rgba(0, 0, 0, 0.22)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(255, 231, 176, 0.2)'
                    }}
                  >
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0', margin: '0 0 12px' }}>
                      Estimated cost for your answers
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Function hall row */}
                      {planResult.estimatedCost.hall && (
                        <div
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            background: highlightedRow === 'hall' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                            transition: 'background 0.8s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                              🏛 {planResult.estimatedCost.hall.name}
                            </span>
                            <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                              {formatINR(planResult.estimatedCost.hall.cost)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#E9CFA8', marginTop: '2px' }}>
                            {planResult.estimatedCost.hall.formulaText}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#C9B0B8', marginTop: '2px', fontStyle: 'italic' }}>
                            {planResult.estimatedCost.hall.rangeText}
                          </div>
                        </div>
                      )}

                      {/* Decoration row */}
                      {planResult.estimatedCost.decor && (
                        <div
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            background: highlightedRow === 'decor' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                            transition: 'background 0.8s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                              ✨ {planResult.estimatedCost.decor.formulaText}
                            </span>
                            <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                              {formatINR(planResult.estimatedCost.decor.cost)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Catering row */}
                      {planResult.estimatedCost.catering && (
                        <div
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            background: highlightedRow === 'catering' || highlightedRow === 'all' ? 'rgba(232, 184, 74, 0.15)' : 'transparent',
                            transition: 'background 0.8s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#FFF8EA' }}>
                              🍽 Catering ({guests} plates × ₹{planResult.estimatedCost.catering.targetPlate})
                            </span>
                            <span style={{ fontFamily: 'Yatra One', fontSize: '1.15rem', color: '#FFE7B0' }}>
                              {formatINR(planResult.estimatedCost.catering.cost)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#E9CFA8', marginTop: '2px' }}>
                            {planResult.estimatedCost.catering.rangeText}
                          </div>
                        </div>
                      )}

                      {/* Divider & Summary rows */}
                      <div style={{ borderTop: '1.5px solid rgba(255, 231, 176, 0.3)', paddingTop: '10px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '6px' }}>
                          <span style={{ color: '#E9CFA8' }}>Subtotal:</span>
                          <b>{formatINR(planResult.estimatedCost.subtotal)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '6px' }}>
                          <span style={{ color: '#E9CFA8' }}>Your budget:</span>
                          <b>{formatINR(planResult.estimatedCost.budget)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {planResult.estimatedCost.isOverBudget ? (
                              <span style={{ color: 'var(--rose)' }}>Over by {formatINR(planResult.estimatedCost.overBy)}</span>
                            ) : (
                              <span style={{ color: '#5FD38D' }}>Remaining:</span>
                            )}
                          </span>
                          <span style={{ fontFamily: 'Yatra One', fontSize: '1.35rem', color: planResult.estimatedCost.isOverBudget ? 'var(--rose)' : '#5FD38D' }}>
                            {planResult.estimatedCost.isOverBudget ? `-${formatINR(planResult.estimatedCost.overBy)}` : formatINR(planResult.estimatedCost.remaining)}
                          </span>
                        </div>
                        {planResult.estimatedCost.isOverBudget && (
                          <div style={{ fontSize: '0.78rem', color: '#FFB4A2', marginTop: '4px' }}>
                            💡 Tip: Switch to Non-AC or adjust guest count to align with your ₹{formatLakh(budget)} budget.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="note" style={{ color: 'var(--rose)' }}>
                We could not calculate right now. Please change an answer and try again.
              </div>
            )}

            {/* Buttons: Save & Share */}
            <div className="mini">
              <button
                type="button"
                onClick={handleSavePlan}
                style={{ color: savePlanFeedback ? 'var(--gold)' : '#FFE7B0' }}
              >
                {savePlanFeedback ? 'Saved ✓' : 'Save this plan'}
              </button>
              <button
                type="button"
                onClick={handleSharePlan}
                style={{ color: shareFeedback ? 'var(--gold)' : '#FFE7B0' }}
              >
                {shareFeedback ? 'Link copied ✓' : 'Share with family ↗'}
              </button>
            </div>
          </div>
        </div>

        {/* Picked For You Bar & Tabs */}
        <div className="bar">
          <h2>Picked for you in {userCity}</h2>
          <div className="tabs" role="tablist" aria-label="Vendor categories">
            {Object.keys(TAB_CONFIG).map((k) => (
              <button
                key={k}
                type="button"
                className="tab"
                aria-pressed={activeTab === k}
                onClick={() => setActiveTab(k)}
              >
                {TAB_CONFIG[k].icon} {TAB_CONFIG[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="filters">
          <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.9rem' }}>Price tier:</span>
          {['All', 'Budget', 'Mid-range', 'Premium'].map((t) => (
            <button
              key={t}
              type="button"
              className="f"
              aria-pressed={tierFilter === t}
              onClick={() => setTierFilter(t)}
            >
              {t}
            </button>
          ))}

          <select
            className="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort vendors"
          >
            <option value="m">Best match</option>
            <option value="r">Top rated</option>
            <option value="p">Price: low to high</option>
          </select>

          <button
            type="button"
            style={{ background: 'transparent', border: 0, color: 'var(--rose)', textDecoration: 'underline', fontSize: '0.88rem', marginLeft: 'auto', cursor: 'pointer' }}
            onClick={() => {
              setTierFilter('All');
              setSortOrder('m');
            }}
          >
            Reset to AI picks
          </button>
        </div>

        {/* Vendor Grid */}
        <div className="grid">
          {activeTab === 'C' && serviceNeed === 'hall' ? (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              Add catering in your plan to see caterers.
            </div>
          ) : activeTab === 'H' && serviceNeed === 'catering' ? (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              Add hall in your plan to see function halls.
            </div>
          ) : vendorList.length > 0 ? (
            vendorList.map((vendor) => (
              <article
                key={vendor.id}
                className="v"
                onClick={() => onSelectVendor(vendor.raw || vendor)}
                style={{ opacity: vendor.isBooked ? 0.65 : 1 }}
              >
                <div
                  className="pic"
                  style={{
                    background: vendor.raw?.gradient || 'linear-gradient(135deg, var(--ink2), var(--acc))'
                  }}
                >
                  {TAB_CONFIG[activeTab]?.icon || '🏛'}
                  {/* Tier tag with dark scrim behind text for contrast */}
                  <span className="t" style={{ background: 'rgba(0,0,0,0.72)', color: '#ffffff', fontWeight: 600 }}>
                    {vendor.tier}
                  </span>
                  {vendor.fitsPlan && (
                    <span className="m" style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700 }}>
                      Fits your plan
                    </span>
                  )}
                  {vendor.isBooked && (
                    <span style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'var(--rose)', color: '#ffffff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      Not available on this date
                    </span>
                  )}
                </div>

                <div className="vb">
                  <h3>{vendor.name}</h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--leaf)', margin: '2px 0 4px', fontStyle: 'italic', fontWeight: 500 }}>
                    {vendor.pickReason}
                  </div>
                  <div className="meta">
                    <span className="star" style={{ color: '#D99A00', fontWeight: 700 }}>★ {vendor.rating}</span>
                    <span style={{ color: 'var(--muted)' }}>{vendor.city}</span>
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
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              No {TAB_CONFIG[activeTab]?.label.toLowerCase()} found matching "{tierFilter}" in {userCity}. Try another price filter or switch city above.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer>
          Vedika · Design preview. Names, prices and ratings are placeholders.
        </footer>
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="md on" role="dialog" aria-modal="true" aria-label="Switch city">
          <div className="mb">
            <button
              type="button"
              className="x"
              onClick={() => setShowLocationModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3>Choose your city</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '4px', marginBottom: '16px' }}>
              We show halls and caterers from your city first. You can change it anytime.
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>State</label>
              <select
                value={tempState}
                onChange={(e) => {
                  const newState = e.target.value;
                  setTempState(newState);
                  const cities = CITIES_BY_STATE[newState] || [];
                  if (cities.length > 0) setTempCity(cities[0]);
                }}
              >
                {Object.keys(CITIES_BY_STATE).map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>City</label>
              <select
                value={tempCity}
                onChange={(e) => setTempCity(e.target.value)}
              >
                {availableCitiesForState.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn"
              onClick={handleConfirmLocation}
            >
              Show this city
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
