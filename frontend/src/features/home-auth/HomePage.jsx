import React, { useState, useEffect } from 'react';
import Confetti from '../../shared/components/Confetti.jsx';
import LocationPopover from '../../shared/components/LocationPopover.jsx';
import { EVENT_TYPES } from '../dashboard-plan/events.js';

// Sample Hall Cards shown when Section F unlocks upon login
const UNLOCKED_HALLS = [
  {
    id: 1,
    name: 'Shree Shubham Mandapam',
    city: 'Bengaluru',
    rating: '4.9',
    reviews: '128 reviews',
    price: '₹1,40,000 / day',
    tag: 'Grand AC Hall',
    gradient: 'linear-gradient(135deg, #6B1230, #E8B84A)'
  },
  {
    id: 2,
    name: 'Royal Palace Convention Center',
    city: 'Hyderabad',
    rating: '4.8',
    reviews: '94 reviews',
    price: '₹2,10,000 / day',
    tag: 'Lawn + Banquet',
    gradient: 'linear-gradient(135deg, #2F7D5B, #E8B84A)'
  },
  {
    id: 3,
    name: 'Vrindavan Grand Mandapam',
    city: 'Chennai',
    rating: '4.9',
    reviews: '165 reviews',
    price: '₹1,80,000 / day',
    tag: 'Traditional Decor',
    gradient: 'linear-gradient(135deg, #B5173B, #3A0A1E)'
  },
  {
    id: 4,
    name: 'Mayura Banquet & Lawns',
    city: 'Pune',
    rating: '4.7',
    reviews: '82 reviews',
    price: '₹95,000 / day',
    tag: 'Catering Included',
    gradient: 'linear-gradient(135deg, #6B1230, #FF5C8A)'
  }
];

export default function HomePage({
  user,
  onLogout,
  onOpenAuth,
  onStartPlan,
  onUpdateUserLocation
}) {
  // Hero rotating events (7 actual events, excluding 'And more')
  const HERO_EVENTS = EVENT_TYPES.filter(e => e.heroRotate !== false);

  const [eventIndex, setEventIndex] = useState(0);
  const [animatingWord, setAnimatingWord] = useState(false);

  const currentEvent = HERO_EVENTS[eventIndex] || HERO_EVENTS[0];

  // Dynamic segments derived from currentEvent default split with ±4 random variation
  const [segments, setSegments] = useState(() => ({
    catering: currentEvent.split.catering,
    hall: currentEvent.split.hall,
    decor: currentEvent.split.decor,
    extras: currentEvent.split.extras
  }));

  // Set page title
  useEffect(() => {
    document.title = "Utsavora – Plan any event within your budget";
  }, []);

  // Set CSS variable --acc on the root document to sync with the current event
  useEffect(() => {
    document.documentElement.style.setProperty('--acc', currentEvent.color);
  }, [currentEvent]);

  // 3-second cycle for hero event type, rotating word, budget, and bar segments
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatingWord(true);

      setTimeout(() => {
        setEventIndex((prev) => {
          const nextIndex = (prev + 1) % HERO_EVENTS.length;
          const nextEvent = HERO_EVENTS[nextIndex];

          // Vary segments around event's base split by ±2 to ±4, keeping sum at 100
          const d1 = Math.floor(Math.random() * 7) - 3;
          const d2 = Math.floor(Math.random() * 5) - 2;
          const d3 = Math.floor(Math.random() * 5) - 2;

          const c = Math.max(15, nextEvent.split.catering + d1);
          const h = Math.max(15, nextEvent.split.hall + d2);
          const d = Math.max(8, nextEvent.split.decor + d3);
          const e = 100 - (c + h + d);

          setSegments({ catering: c, hall: h, decor: d, extras: Math.max(5, e) });
          return nextIndex;
        });

        setAnimatingWord(false);
      }, 250);
    }, 3000);

    return () => clearInterval(timer);
  }, [HERO_EVENTS]);

  // Smooth scroll helper
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.querySelector(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'V';

  return (
    <div className="vedika-app-container">
      {/* =====================================================================
          PART 2 - A) STICKY HEADER
          ===================================================================== */}
      <header className="vedika-sticky-header">
        {/* Left: Logo */}
        <a href="#top" className="vedika-header-logo" aria-label="Utsavora Home">
          <span className="vedika-logo-circle" aria-hidden="true" />
          <span className="vedika-logo-title">Utsavora</span>
        </a>

        {/* Centre Nav (hidden below 820px) */}
        <nav className="vedika-header-nav" aria-label="Main navigation">
          <a href="#types" onClick={(e) => scrollToSection(e, '#types')}>Events</a>
          <a href="#how" onClick={(e) => scrollToSection(e, '#how')}>How it works</a>
          <a href="#why" onClick={(e) => scrollToSection(e, '#why')}>Why Utsavora</a>
          <a href="#love" onClick={(e) => scrollToSection(e, '#love')}>Reviews</a>
        </nav>

        {/* Right: Auth Controls */}
        <div className="vedika-header-actions">
          {user ? (
            <div className="user-profile-bar">
              <span className="user-avatar-pill" title={user.name}>
                <span className="user-initial">{initial}</span>
                <span className="user-greeting">Hi, {firstName}</span>
              </span>
              <LocationPopover
                user={user}
                onUpdateLocation={onUpdateUserLocation}
              />
              <button
                type="button"
                className="pill g"
                onClick={() => onStartPlan && onStartPlan('wedding')}
              >
                Plan an event
              </button>
              <button
                type="button"
                className="pill"
                onClick={onLogout}
                aria-label="Log out of account"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="pill"
                onClick={() => onOpenAuth('login')}
              >
                Log in
              </button>
              <button
                type="button"
                className="pill g"
                onClick={() => onOpenAuth('signup')}
              >
                Sign up free
              </button>
            </>
          )}
        </div>
      </header>

      {/* =====================================================================
          PART 2 - B) HERO SECTION
          ===================================================================== */}
      <section className="vedika-hero-section" id="top">
        {/* 14 floating confetti pieces */}
        <Confetti count={14} />

        <div className="hero-container">
          {/* HERO LEFT */}
          <div className="hero-left">
            <h1 className="hero-h1">
              Plan your next
              <span className="rotating-word-viewport" aria-live="polite">
                <span
                  className={`rotating-word ${animatingWord ? 'sliding-up' : ''}`}
                  style={{ color: currentEvent.color }}
                >
                  {currentEvent.word}
                </span>
              </span>
              without going over budget
            </h1>

            <p className="hero-lead">
              Tell us your budget. Our AI picks the right hall, catering, decoration, music and cards for you.
            </p>

            <div className="hero-cta-row">
              <button
                type="button"
                className="cta"
                onClick={() => onStartPlan ? onStartPlan(currentEvent.id) : onOpenAuth('signup')}
              >
                Start planning free
              </button>
              <a
                href="#how"
                className="cta ghost how-it-works-btn"
                onClick={(e) => scrollToSection(e, '#how')}
              >
                How it works
              </a>
            </div>

            {/* Stats row: 3 items */}
            <div className="hero-stats-row">
              <div className="hero-stat-col">
                <strong className="stat-number">All states</strong>
                <span className="stat-label">and cities</span>
              </div>
              <div className="hero-stat-col">
                <strong className="stat-number">Rated</strong>
                <span className="stat-label">and priced</span>
              </div>
              <div className="hero-stat-col">
                <strong className="stat-number">One app</strong>
                <span className="stat-label">for everything</span>
              </div>
            </div>
          </div>

          {/* HERO RIGHT: Stage (440px tall, max-width 480px) */}
          <div className="hero-stage-wrap">
            {/* 4 Floating Gold Chips bobbing up/down 14px with slight rotation */}
            <div className="floating-chip chip-top-left" aria-hidden="true">
              🏛 Hall
            </div>
            <div className="floating-chip chip-top-right" aria-hidden="true">
              🍽 Catering
            </div>
            <div className="floating-chip chip-bottom-left" aria-hidden="true">
              🎶 Band
            </div>
            <div className="floating-chip chip-bottom-right" aria-hidden="true">
              💌 Cards
            </div>

            {/* Main Stage Card */}
            <div className="stage-main-card">
              <div className="stage-card-header">
                <h3 className="stage-card-title">{currentEvent.name} plan</h3>
                <span className="stage-card-sub">Your budget, split by AI</span>
              </div>

              {/* Big Budget Number in Yatra One */}
              <div
                className="stage-budget-number"
                style={{ color: currentEvent.color }}
              >
                {currentEvent.budget}
              </div>

              {/* 34px-high segmented bar */}
              <div
                className="stage-segmented-bar"
                key={eventIndex}
                role="img"
                aria-label={`Budget split: Catering ${segments.catering}%, Hall ${segments.hall}%, Decor ${segments.decor}%, Extras ${segments.extras}%`}
              >
                <div
                  className="bar-segment seg-catering"
                  style={{ width: `${segments.catering}%` }}
                >
                  <span>{segments.catering}%</span>
                </div>
                <div
                  className="bar-segment seg-hall"
                  style={{ width: `${segments.hall}%` }}
                >
                  <span>{segments.hall}%</span>
                </div>
                <div
                  className="bar-segment seg-decor"
                  style={{ width: `${segments.decor}%` }}
                >
                  <span>{segments.decor}%</span>
                </div>
                <div
                  className="bar-segment seg-extras"
                  style={{ width: `${segments.extras}%` }}
                >
                  <span>{segments.extras}%</span>
                </div>
              </div>

              {/* 2-Column Legend */}
              <div className="stage-legend-grid" aria-hidden="true">
                <div className="legend-item">
                  <span className="legend-dot dot-catering" />
                  <span className="legend-name">Catering</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-hall" />
                  <span className="legend-name">Hall</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-decor" />
                  <span className="legend-name">Decor</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-extras" />
                  <span className="legend-name">Extras</span>
                </div>
              </div>

              {/* Green Tint Box at bottom */}
              <div className="stage-ai-pill">
                AI matches the best options in your city
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PART 2 - C) EVENTS SECTION (id="types", centred)
          ===================================================================== */}
      <section className="vedika-section centred-section" id="types">
        <h2>Every kind of celebration</h2>
        <p className="sub">
          Weddings, birthdays, office events, college and school functions, and more, all planned in one place.
        </p>

        <div className="events-grid">
          {EVENT_TYPES.map((evt) => {
            const isYellow = evt.color === '#F2D14B';
            return (
              <button
                type="button"
                key={evt.id}
                className="event-card-btn"
                onClick={() => onOpenAuth('signup')}
                style={{
                  '--evt-color': evt.color
                }}
                aria-label={`Plan ${evt.name}`}
              >
                <div
                  className="event-icon-box"
                  style={{
                    backgroundColor: evt.color,
                    color: isYellow ? '#3A0A1E' : '#FFFFFF'
                  }}
                  aria-hidden="true"
                >
                  <span className="event-emoji">{evt.emoji}</span>
                </div>
                <span className="event-name-text">{evt.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          PART 2 - D) HOW IT WORKS (id="how", centred)
          ===================================================================== */}
      <section className="vedika-section centred-section" id="how">
        <h2>Four steps to a planned event</h2>
        <p className="sub">
          No calling dozens of vendors. Answer, compare and book.
        </p>

        <div className="how-steps-grid">
          <div className="step-card">
            <span className="step-number">1</span>
            <h3>Answer a few questions</h3>
            <p>Event, budget, guests, dishes and decoration style.</p>
          </div>

          <div className="step-card">
            <span className="step-number">2</span>
            <h3>AI splits your budget</h3>
            <p>Food, hall, decor and extras get a fair share.</p>
          </div>

          <div className="step-card">
            <span className="step-number">3</span>
            <h3>Chat and call in the app</h3>
            <p>Talk to venues and caterers safely, inside Utsavora.</p>
          </div>

          <div className="step-card">
            <span className="step-number">4</span>
            <h3>Book with confidence</h3>
            <p>Lock the date, then add cards, band and decor.</p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PART 2 - E) WHY UTSAVORA (id="why")
          ===================================================================== */}
      <section className="vedika-section centred-section" id="why">
        <h2>Why people plan with Utsavora</h2>
        <p className="sub">
          Made for families who want a great event at a fair price.
        </p>

        <div className="bento-grid">
          {/* Tile b1: spans 2 cols, background var(--rose) */}
          <div className="bento-tile b1-tile">
            <div className="bento-emoji" aria-hidden="true">🤖</div>
            <div className="bento-text">
              <h3>AI that plans for your budget</h3>
              <p>Give a budget, get a complete plan with hall, food and decor.</p>
            </div>
          </div>

          {/* Tile b2: var(--leaf) */}
          <div className="bento-tile b2-tile">
            <div className="bento-emoji" aria-hidden="true">⭐</div>
            <div className="bento-text">
              <h3>Ratings and prices</h3>
              <p>Compare by quality and cost.</p>
            </div>
          </div>

          {/* Tile b3: var(--gold), dark text #3A0A1E */}
          <div className="bento-tile b3-tile">
            <div className="bento-emoji" aria-hidden="true">📞</div>
            <div className="bento-text">
              <h3>In-app chat and call</h3>
              <p>Everything stays in one place.</p>
            </div>
          </div>

          {/* Tile b4: var(--ink) */}
          <div className="bento-tile b4-tile">
            <div className="bento-emoji" aria-hidden="true">🎨</div>
            <div className="bento-text">
              <h3>Custom decoration</h3>
              <p>Low, moderate or high. Make it yours.</p>
            </div>
          </div>

          {/* Tile b5: var(--ink2) */}
          <div className="bento-tile b5-tile">
            <div className="bento-emoji" aria-hidden="true">🥁</div>
            <div className="bento-text">
              <h3>Band and music</h3>
              <p>Book bands, DJs and more.</p>
            </div>
          </div>

          {/* Tile b6: spans 2 cols, linear-gradient 135deg var(--ink2) to var(--rose) */}
          <div className="bento-tile b6-tile">
            <div className="bento-emoji" aria-hidden="true">💌</div>
            <div className="bento-text">
              <h3>Invitation cards, delivered</h3>
              <p>Pick a design, add your details and order, all in the app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PART 2 - F) LOCKED PREVIEW
          ===================================================================== */}
      <section className="vedika-section centred-section" id="locked-preview">
        <h2>See halls and caterers after you sign in</h2>
        <p className="sub">
          Create a free account to browse rated halls and caterers in your city or any state.
        </p>

        <div className="locked-card-container">
          {!user ? (
            /* Logged out: 4 blurred placeholders + veil */
            <>
              <div className="blurred-tiles-grid" aria-hidden="true">
                <div className="blur-tile tile-grad-1">
                  <span className="blur-title">Grand Function Hall</span>
                </div>
                <div className="blur-tile tile-grad-2">
                  <span className="blur-title">Catering &amp; Traditional Feasts</span>
                </div>
                <div className="blur-tile tile-grad-3">
                  <span className="blur-title">Floral &amp; Mandapam Decor</span>
                </div>
                <div className="blur-tile tile-grad-4">
                  <span className="blur-title">Band, Shenai &amp; Music</span>
                </div>
              </div>

              {/* Veil on top */}
              <div className="locked-veil">
                <div className="bobbing-lock" aria-hidden="true">🔒</div>
                <h3>Sign in to unlock</h3>
                <p>It takes less than a minute.</p>
                <button
                  type="button"
                  className="btn-dark-unlock"
                  onClick={() => onOpenAuth('signup')}
                >
                  Create free account
                </button>
              </div>
            </>
          ) : (
            /* Logged in: UNLOCKED Real Sample Hall Cards (user's city first) */
            <div className="unlocked-halls-grid">
              {(() => {
                const userCity = (user?.city || user?.location?.city || '').toLowerCase();
                const sorted = [...UNLOCKED_HALLS].sort((a, b) => {
                  const matchA = a.city.toLowerCase() === userCity;
                  const matchB = b.city.toLowerCase() === userCity;
                  if (matchA && !matchB) return -1;
                  if (!matchA && matchB) return 1;
                  return 0;
                });
                return sorted.map((hall) => (
                  <div key={hall.id} className="hall-card">
                    <div className="hall-card-img" style={{ background: hall.gradient }}>
                      <span className="hall-tag">{hall.tag}</span>
                    </div>
                    <div className="hall-card-body">
                      <h4>{hall.name}</h4>
                      <p className="hall-city">📍 {hall.city}</p>
                      <div className="hall-meta-row">
                        <span className="hall-rating">⭐ {hall.rating}</span>
                        <span className="hall-price">{hall.price}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          PART 2 - G) REVIEWS (id="love", centred)
          ===================================================================== */}
      <section className="vedika-section centred-section" id="love">
        <h2>People like you, planning better</h2>
        <p className="sub">
          Real stories from families across India.
        </p>

        <div className="reviews-grid">
          {/* Review 1 */}
          <div className="review-card">
            <p className="review-quote">
              “I gave my budget and got a full plan in minutes. We saved a lot.”
            </p>
            <div className="review-author-row">
              <div className="avatar-circle" style={{ backgroundColor: '#B5173B' }}>
                R
              </div>
              <span className="author-name">Ravi, wedding</span>
            </div>
          </div>

          {/* Review 2 */}
          <div className="review-card">
            <p className="review-quote">
              “Chatting inside the app made comparing caterers so easy.”
            </p>
            <div className="review-author-row">
              <div className="avatar-circle" style={{ backgroundColor: '#2F7D5B' }}>
                L
              </div>
              <span className="author-name">Lakshmi, housewarming</span>
            </div>
          </div>

          {/* Review 3 */}
          <div className="review-card">
            <p className="review-quote">
              “Booked our office annual day hall and food in one evening.”
            </p>
            <div className="review-author-row">
              <div className="avatar-circle" style={{ backgroundColor: '#6B1230' }}>
                S
              </div>
              <span className="author-name">Suresh, corporate</span>
            </div>
          </div>

          {/* Review 4: Educational Added */}
          <div className="review-card">
            <p className="review-quote">
              “Our college annual day hall, sound and snacks were sorted in one evening.”
            </p>
            <div className="review-author-row">
              <div className="avatar-circle" style={{ backgroundColor: '#2F7D5B' }}>
                P
              </div>
              <span className="author-name">Principal Prasad, college fest</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PART 2 - H) CTA BAND
          ===================================================================== */}
      <section className="cta-band-wrapper">
        <div className="cta-band-box">
          <h2>Your event. Your budget. Sorted.</h2>
          <p>Join free and get your first plan today.</p>
          <button
            type="button"
            className="cta"
            onClick={() => onStartPlan ? onStartPlan('wedding') : onOpenAuth('signup')}
          >
            Sign up free
          </button>
        </div>
      </section>

      {/* =====================================================================
          PART 2 - I) FOOTER
          ===================================================================== */}
      <footer className="vedika-home-footer">
        <p>
          &copy; {new Date().getFullYear()} Utsavora &middot; Plan any event within your budget. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
