import React, { useState, useEffect } from 'react';
import { EVENT_TYPES, CITIES_BY_STATE } from '../data/events';
import { formatINR, formatLakhCrore } from '../engine/budgetEngine';

export default function PlannerForm({
  initialData = {},
  onSubmit,
  onCancel
}) {
  // Event Type
  const [eventType, setEventType] = useState(initialData.eventType || initialData.event || 'wedding');

  // City & State
  const [stateName, setStateName] = useState(initialData.stateName || 'Andhra Pradesh');
  const [city, setCity] = useState(initialData.city || 'Kadapa');

  // Event Date (defaults to 30 days from today)
  const [eventDate, setEventDate] = useState(() => {
    if (initialData.eventDate) return initialData.eventDate;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Total Budget (Rs 50,000 to Rs 1,00,00,000)
  const [budget, setBudget] = useState(initialData.budget || 800000);

  // "I need" (Service Need): 'both' | 'hall' | 'catering'
  const [serviceNeed, setServiceNeed] = useState(initialData.serviceNeed || 'both');

  // Number of guests (20 to 2000)
  const [guests, setGuests] = useState(initialData.guests || initialData.plates || 600);

  // --- HALL FIELDS (if serviceNeed === 'hall' or 'both') ---
  const [hallCondition, setHallCondition] = useState(initialData.hallCondition || 'ac'); // 'ac' | 'non-ac'
  const [bookingDuration, setBookingDuration] = useState(initialData.bookingDuration || 'full-day'); // 'half-day' | 'full-day' | 'multi-day'
  const [daysCount, setDaysCount] = useState(initialData.daysCount || 2);
  const [decorTier, setDecorTier] = useState(initialData.decorTier || initialData.decorLevel || 'medium'); // 'low' | 'medium' | 'high'

  // --- CATERING FIELDS (if serviceNeed === 'catering' or 'both') ---
  const [servingStyle, setServingStyle] = useState(initialData.servingStyle || 'buffet'); // 'banana-leaf' | 'buffet' | 'table-service'
  const [foodCategory, setFoodCategory] = useState(initialData.foodCategory || 'standard'); // 'basic' | 'standard' | 'premium' | 'luxury'
  const [cuisine, setCuisine] = useState(initialData.cuisine || 'andhra'); // 'andhra' | 'south-indian' | 'north-indian' | 'multi-cuisine'
  const [dietary, setDietary] = useState(initialData.dietary || 'both'); // 'veg' | 'non-veg' | 'both'
  const [nonVegPercent, setNonVegPercent] = useState(initialData.nonVegPercent || 50);

  // Validation Errors
  const [errors, setErrors] = useState({});

  const selectedEventObj = EVENT_TYPES.find(e => e.id === eventType) || EVENT_TYPES[0];

  // Dynamically set --acc based on current event
  useEffect(() => {
    if (selectedEventObj?.color) {
      document.documentElement.style.setProperty('--acc', selectedEventObj.color);
    }
  }, [selectedEventObj]);

  // Handle "I need" switch with clean section resets
  const handleServiceNeedChange = (newNeed) => {
    setServiceNeed(newNeed);
    if (newNeed === 'hall') {
      // Reset catering section
      setServingStyle('buffet');
      setFoodCategory('standard');
      setCuisine('andhra');
      setDietary('both');
      setNonVegPercent(50);
    } else if (newNeed === 'catering') {
      // Reset hall section
      setHallCondition('ac');
      setBookingDuration('full-day');
      setDaysCount(2);
      setDecorTier('medium');
    }
    // Clear section errors
    setErrors(prev => ({ ...prev, hall: null, catering: null }));
  };

  // Available cities for selected state
  const availableCities = CITIES_BY_STATE[stateName] || ['Kadapa', 'Vijayawada', 'Hyderabad'];

  // Handle State change
  const handleStateChange = (newState) => {
    setStateName(newState);
    const cities = CITIES_BY_STATE[newState] || [];
    if (cities.length > 0) {
      setCity(cities[0]);
    }
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!budget || budget < 20000) {
      errs.budget = 'Please enter a realistic budget of at least ₹20,000.';
    }
    if (!guests || guests < 20) {
      errs.guests = 'Please enter at least 20 guests.';
    }
    if (!city) {
      errs.city = 'Please select a city for your event.';
    }
    if (!eventDate) {
      errs.eventDate = 'Please select the date of your celebration.';
    }
    if ((serviceNeed === 'hall' || serviceNeed === 'both') && bookingDuration === 'multi-day') {
      if (!daysCount || daysCount < 2) {
        errs.daysCount = 'Multiple days booking must be at least 2 days.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    const payload = {
      event: eventType,
      eventType,
      city,
      stateName,
      eventDate,
      budget: Number(budget),
      guests: Number(guests),
      plates: Number(guests),
      serviceNeed,
      // Needs array for backward compatibility
      needs: serviceNeed === 'both'
        ? ['hall', 'catering', 'decor', 'band', 'cards', 'photography']
        : serviceNeed === 'hall'
          ? ['hall', 'decor', 'cards']
          : ['catering', 'decor'],
      // Hall answers
      ...(serviceNeed === 'hall' || serviceNeed === 'both' ? {
        hallCondition,
        bookingDuration,
        daysCount: bookingDuration === 'multi-day' ? Number(daysCount) : 1,
        decorLevel: decorTier,
        decorTier
      } : {}),
      // Catering answers
      ...(serviceNeed === 'catering' || serviceNeed === 'both' ? {
        servingStyle,
        foodCategory,
        cuisine,
        dietary,
        nonVegPercent: dietary === 'both' ? Number(nonVegPercent) : dietary === 'non-veg' ? 100 : 0
      } : {})
    };

    onSubmit(payload);
  };

  const isHallNeeded = serviceNeed === 'hall' || serviceNeed === 'both';
  const isCateringNeeded = serviceNeed === 'catering' || serviceNeed === 'both';

  return (
    <div className="planner-page-container">
      <div className="planner-card-shell">
        {/* Top Header */}
        <div className="planner-header-bar">
          <button
            type="button"
            className="planner-back-btn"
            onClick={onCancel}
            aria-label="Back to dashboard"
          >
            ← Back
          </button>
          <div className="planner-badge">AI Event Planner</div>
        </div>

        <div className="planner-heading-group">
          <h1 className="planner-main-title">
            Tell us about your <span>{selectedEventObj.name.toLowerCase()}</span>
          </h1>
          <p className="planner-sub-title">
            Answer a few quick questions so our AI can curate verified halls and caterers matching your budget.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* =========================================================
              SECTION 1: CELEBRATION, LOCATION & DATE (ALWAYS VISIBLE)
             ========================================================= */}
          <div className="planner-section-box">
            <h2 className="planner-section-title">1. Celebration & Date</h2>

            {/* Event Chips */}
            <div className="form-field-group">
              <label className="field-label-bold">Event Type</label>
              <div className="chips" role="radiogroup" aria-label="Choose event type">
                {EVENT_TYPES.filter(e => e.id !== 'more').map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="chip"
                    style={{ '--c': ev.color }}
                    aria-pressed={eventType === ev.id}
                    onClick={() => setEventType(ev.id)}
                  >
                    <span>{ev.emoji}</span> {ev.name}
                  </button>
                ))}
              </div>
            </div>

            {/* City & State Dropdowns */}
            <div className="form-row-2col">
              <div className="form-field-group">
                <label htmlFor="state-select" className="field-label-bold">State</label>
                <select
                  id="state-select"
                  className="vedika-input"
                  value={stateName}
                  onChange={(e) => handleStateChange(e.target.value)}
                >
                  {Object.keys(CITIES_BY_STATE).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="city-select" className="field-label-bold">City / Town</label>
                <select
                  id="city-select"
                  className={`vedika-input ${errors.city ? 'has-error' : ''}`}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors(prev => ({ ...prev, city: null }));
                  }}
                >
                  {availableCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.city && <p className="field-error-text">{errors.city}</p>}
              </div>
            </div>

            {/* Event Date */}
            <div className="form-field-group">
              <label htmlFor="event-date" className="field-label-bold">Event Date</label>
              <input
                id="event-date"
                type="date"
                className={`vedika-input ${errors.eventDate ? 'has-error' : ''}`}
                value={eventDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  if (errors.eventDate) setErrors(prev => ({ ...prev, eventDate: null }));
                }}
              />
              {errors.eventDate && <p className="field-error-text">{errors.eventDate}</p>}
            </div>
          </div>

          {/* =========================================================
              SECTION 2: BUDGET & I NEED (ALWAYS VISIBLE)
             ========================================================= */}
          <div className="planner-section-box">
            <h2 className="planner-section-title">2. Budget & Scale</h2>

            {/* Total Budget */}
            <div className="form-field-group">
              <div className="field-header-row">
                <label htmlFor="budget-slider" className="field-label-bold">Total Budget</label>
                <span className="field-highlight-text">{formatINR(budget)} ({formatLakhCrore(budget)})</span>
              </div>
              <input
                id="budget-slider"
                type="range"
                min="50000"
                max="10000000"
                step="25000"
                value={budget}
                onChange={(e) => {
                  setBudget(Number(e.target.value));
                  if (errors.budget) setErrors(prev => ({ ...prev, budget: null }));
                }}
              />
              {/* Quick Presets */}
              <div className="quick-pill-row">
                {[200000, 500000, 800000, 1500000, 2500000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="quick-preset-pill"
                    onClick={() => {
                      setBudget(amt);
                      if (errors.budget) setErrors(prev => ({ ...prev, budget: null }));
                    }}
                  >
                    {formatLakhCrore(amt)}
                  </button>
                ))}
              </div>
              {errors.budget && <p className="field-error-text">{errors.budget}</p>}
            </div>

            {/* I need */}
            <div className="form-field-group">
              <label className="field-label-bold">I need</label>
              <div className="service-need-grid" role="radiogroup" aria-label="Services needed">
                {[
                  { id: 'hall', label: 'Hall only', icon: '🏛', desc: 'Venue & decor' },
                  { id: 'catering', label: 'Catering only', icon: '🍽', desc: 'Dining & hospitality' },
                  { id: 'both', label: 'Both', icon: '✨', desc: 'Venue + Catering bundle' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`service-need-card ${serviceNeed === item.id ? 'is-selected' : ''}`}
                    onClick={() => handleServiceNeedChange(item.id)}
                    aria-pressed={serviceNeed === item.id}
                  >
                    <span className="card-icon">{item.icon}</span>
                    <span className="card-title">{item.label}</span>
                    <span className="card-desc">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of guests */}
            <div className="form-field-group">
              <div className="field-header-row">
                <label htmlFor="guests-slider" className="field-label-bold">Number of Guests</label>
                <span className="field-highlight-text">{guests} guests</span>
              </div>
              <input
                id="guests-slider"
                type="range"
                min="20"
                max="2000"
                step="10"
                value={guests}
                onChange={(e) => {
                  setGuests(Number(e.target.value));
                  if (errors.guests) setErrors(prev => ({ ...prev, guests: null }));
                }}
              />
              <div className="quick-pill-row">
                {[100, 250, 500, 600, 1000, 1500].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="quick-preset-pill"
                    onClick={() => {
                      setGuests(g);
                      if (errors.guests) setErrors(prev => ({ ...prev, guests: null }));
                    }}
                  >
                    {g} guests
                  </button>
                ))}
              </div>
              {errors.guests && <p className="field-error-text">{errors.guests}</p>}
            </div>
          </div>

          {/* =========================================================
              SECTION 3: HALL DETAILS (CONDITIONAL: HALL OR BOTH)
             ========================================================= */}
          {isHallNeeded && (
            <div className="planner-section-box section-conditional-fade">
              <div className="section-header-row">
                <h2 className="planner-section-title">3. Function Hall Preferences</h2>
                <span className="section-tag-badge">Hall details</span>
              </div>

              {/* Hall condition */}
              <div className="form-field-group">
                <label className="field-label-bold">Hall Condition</label>
                <div className="segmented-toggle-row" role="radiogroup" aria-label="Hall condition">
                  <button
                    type="button"
                    className={`toggle-option-btn ${hallCondition === 'ac' ? 'is-active' : ''}`}
                    onClick={() => setHallCondition('ac')}
                    aria-pressed={hallCondition === 'ac'}
                  >
                    ❄️ Air-Conditioned (AC)
                  </button>
                  <button
                    type="button"
                    className={`toggle-option-btn ${hallCondition === 'non-ac' ? 'is-active' : ''}`}
                    onClick={() => setHallCondition('non-ac')}
                    aria-pressed={hallCondition === 'non-ac'}
                  >
                    🌿 Non-AC (Natural Ventilation)
                  </button>
                </div>
              </div>

              {/* Booking Duration */}
              <div className="form-field-group">
                <label className="field-label-bold">Booking Duration</label>
                <div className="segmented-toggle-row" role="radiogroup" aria-label="Booking duration">
                  {[
                    { id: 'half-day', label: 'Half Day (6 hours)' },
                    { id: 'full-day', label: 'Full Day (24 hours)' },
                    { id: 'multi-day', label: 'Multiple Days' }
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      className={`toggle-option-btn ${bookingDuration === dur.id ? 'is-active' : ''}`}
                      onClick={() => setBookingDuration(dur.id)}
                      aria-pressed={bookingDuration === dur.id}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>

                {/* Multiple days typing box */}
                {bookingDuration === 'multi-day' && (
                  <div className="multi-days-input-wrap">
                    <label htmlFor="multi-days-count" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                      Enter number of days:
                    </label>
                    <input
                      id="multi-days-count"
                      type="number"
                      min="2"
                      max="14"
                      className="vedika-input"
                      style={{ maxWidth: '140px', padding: '10px 14px', fontSize: '1.05rem', fontWeight: 700 }}
                      value={daysCount}
                      onChange={(e) => setDaysCount(Math.max(2, Number(e.target.value) || 2))}
                    />
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>days</span>
                  </div>
                )}
                {errors.daysCount && <p className="field-error-text">{errors.daysCount}</p>}
              </div>

              {/* Decoration Tier */}
              <div className="form-field-group">
                <label className="field-label-bold">Decoration Style</label>
                <div className="decor-cards-grid" role="radiogroup" aria-label="Decoration tier">
                  {[
                    { id: 'low', title: 'Low', badge: 'Budget Friendly', desc: 'Simple floral backdrop, banana plant entrance & clean focus lights.' },
                    { id: 'medium', title: 'Medium', badge: 'Most Popular', desc: 'Grand floral mandap stage, pathway pillars, warm LED ambient lighting.' },
                    { id: 'high', title: 'High', badge: 'Luxury Extravaganza', desc: 'Thematic royal canopy, imported flowers, digital LED backdrop & chandeliers.' }
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`decor-card-item ${decorTier === tier.id ? 'is-selected' : ''}`}
                      onClick={() => setDecorTier(tier.id)}
                      aria-pressed={decorTier === tier.id}
                    >
                      <div className="decor-card-header">
                        <span className="decor-card-title">{tier.title}</span>
                        <span className="decor-card-badge">{tier.badge}</span>
                      </div>
                      <p className="decor-card-desc">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              SECTION 4: CATERING DETAILS (CONDITIONAL: CATERING OR BOTH)
             ========================================================= */}
          {isCateringNeeded && (
            <div className="planner-section-box section-conditional-fade">
              <div className="section-header-row">
                <h2 className="planner-section-title">4. Catering & Food Preferences</h2>
                <span className="section-tag-badge">Dining details</span>
              </div>

              {/* Serving Style */}
              <div className="form-field-group">
                <label className="field-label-bold">Serving Style</label>
                <div className="segmented-toggle-row" role="radiogroup" aria-label="Serving style">
                  {[
                    { id: 'banana-leaf', label: '🍃 Banana Leaf' },
                    { id: 'buffet', label: '🍽 Buffet' },
                    { id: 'table-service', label: '🧑‍🍳 Table Service' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`toggle-option-btn ${servingStyle === s.id ? 'is-active' : ''}`}
                      onClick={() => setServingStyle(s.id)}
                      aria-pressed={servingStyle === s.id}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food Category */}
              <div className="form-field-group">
                <label className="field-label-bold">Food Category (Dish Variety)</label>
                <div className="food-cat-grid" role="radiogroup" aria-label="Food category">
                  {[
                    { id: 'basic', title: 'Basic', dishes: '10–15 dishes', desc: 'Standard feast with rice, sambhar, rasam, 2 curries, sweet & curd.' },
                    { id: 'standard', title: 'Standard', dishes: '15–20 dishes', desc: 'Popular royal feast with 2 sweets, starter, flavored rice, curries & ice cream.' },
                    { id: 'premium', title: 'Premium', dishes: '20–30 dishes', desc: 'Multi-course banquet with welcome drinks, live counters & dessert stall.' },
                    { id: 'luxury', title: 'Luxury', dishes: '30+ dishes', desc: 'Grand gourmet dining with international appetizers, chaat stalls & live sweets.' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`food-cat-card ${foodCategory === cat.id ? 'is-selected' : ''}`}
                      onClick={() => setFoodCategory(cat.id)}
                      aria-pressed={foodCategory === cat.id}
                    >
                      <div className="cat-header">
                        <span className="cat-name">{cat.title}</span>
                        <span className="cat-dishes">{cat.dishes}</span>
                      </div>
                      <p className="cat-desc">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuisine */}
              <div className="form-field-group">
                <label className="field-label-bold">Cuisine</label>
                <div className="segmented-toggle-row" role="radiogroup" aria-label="Cuisine">
                  {[
                    { id: 'andhra', label: '🌶 Andhra' },
                    { id: 'south-indian', label: '🥥 South Indian' },
                    { id: 'north-indian', label: '🫓 North Indian' },
                    { id: 'multi-cuisine', label: '✨ Multi-Cuisine' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`toggle-option-btn ${cuisine === c.id ? 'is-active' : ''}`}
                      onClick={() => setCuisine(c.id)}
                      aria-pressed={cuisine === c.id}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Veg / Non-Veg */}
              <div className="form-field-group">
                <label className="field-label-bold">Dietary Preference</label>
                <div className="segmented-toggle-row" role="radiogroup" aria-label="Dietary preference">
                  {[
                    { id: 'veg', label: '🌱 Pure Veg' },
                    { id: 'non-veg', label: '🍗 Non-Veg' },
                    { id: 'both', label: '🥗 Both (Veg & Non-Veg)' }
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`toggle-option-btn ${dietary === d.id ? 'is-active' : ''}`}
                      onClick={() => setDietary(d.id)}
                      aria-pressed={dietary === d.id}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* % Non-Veg slider if Both */}
                {dietary === 'both' && (
                  <div className="non-veg-slider-wrap">
                    <div className="field-header-row">
                      <label htmlFor="nv-slider" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                        Estimated Non-Veg Ratio:
                      </label>
                      <span className="field-highlight-text">
                        {nonVegPercent}% Non-Veg / {100 - nonVegPercent}% Veg
                      </span>
                    </div>
                    <input
                      id="nv-slider"
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={nonVegPercent}
                      onChange={(e) => setNonVegPercent(Number(e.target.value))}
                    />
                    <div className="slider-labels-row">
                      <span>Mostly Veg (10%)</span>
                      <span>Balanced (50%)</span>
                      <span>Mostly Non-Veg (90%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="planner-form-actions">
            <button
              type="button"
              className="planner-cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="cta-primary planner-submit-btn"
            >
              Make my plan ✨
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
