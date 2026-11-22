import React, { useState, useEffect, useMemo, useRef } from 'react';
import Confetti from '../../shared/components/Confetti.jsx';
import dummyVendors from '../../shared/data/dummyVendors.json' with { type: 'json' };
import districtsData from '../../shared/data/districts.json' with { type: 'json' };
import cityDistrictMap from '../../shared/data/cityDistrict.json' with { type: 'json' };
import { EVENT_TYPES, CITIES_BY_STATE, ALL_CITIES } from './events.js';
import { planEvent, calculatePlateRange, formatINR, formatLakh } from './engine/planner.js';
import PLANNER_CONFIG from './engine/config.js';
import { saveUserPlan, getSelectedEvent, setSelectedEvent, getUnifiedVendorsCatalog } from '../../shared/data-service/index.js';
import { applyThemeColors, onColor, getLuminance, getContrastRatio } from '../../shared/utils/contrastUtils.js';
import { getStoredPlaceFilter, setStoredPlaceFilter, clearStoredPlaceFilter } from './placeFilter.js';

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
  const [unifiedVendors, setUnifiedVendors] = useState({
    halls: [],
    caterers: [],
    decor: [],
    bands: [],
    cards: [],
    photography: []
  });
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingCatalog(true);
    getUnifiedVendorsCatalog(dummyVendors).then(cat => {
      if (isMounted && cat) {
        setUnifiedVendors({
          halls: cat.halls || [],
          caterers: cat.caterers || [],
          decor: cat.decor || [],
          bands: cat.bands || [],
          cards: cat.cards || [],
          photography: cat.photography || []
        });
        setIsLoadingCatalog(false);
      }
    }).catch(err => {
      console.warn('[DashboardView] Failed to load catalog:', err);
      if (isMounted) setIsLoadingCatalog(false);
    });
    return () => { isMounted = false; };
  }, [userCity]);

  const greetingName = useMemo(() => {
    if (!user || !user.name) return 'Narasimha';
    if (user.phone === '9390075877' || user.name.includes('Narasimha')) return 'Narasimha';
    return user.name.trim().split(/\s+/)[0] || 'Friend';
  }, [user]);

  // Event Selection (Persisted in localStorage as "vedika.event", defaults to "wedding")
  // 7 core events, removing "And more" from chips and subtitle
  const events = useMemo(() => EVENT_TYPES.filter(e => e.id !== 'andmore' && e.name !== 'And more'), []);
  const [selectedEventId, setSelectedEventIdState] = useState(() => {
    const saved = getSelectedEvent();
    return (saved && saved !== 'andmore') ? saved : 'wedding';
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

  // Top 3 inside AI Plan Panel
  const [planTopTab, setPlanTopTab] = useState('H');
  const [planExpandedPickId, setPlanExpandedPickId] = useState(null);
  const [selectedHallPick, setSelectedHallPick] = useState(null);
  const [selectedCateringPick, setSelectedCateringPick] = useState(null);
  const [selectedDecorPick, setSelectedDecorPick] = useState(null);

  // Restored Full Vendor List Below AI Plan
  const [lowerActiveTab, setLowerActiveTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem('vedika_dashboard_tab');
      if (saved && (saved === 'H' || saved === 'C' || saved === 'X')) return saved;
    } catch {}
    return 'H';
  });
  const [tierFilter, setTierFilter] = useState('All');
  const [lowerSearchQuery, setLowerSearchQuery] = useState('');
  const [placeFilter, setPlaceFilter] = useState(() => getStoredPlaceFilter());
  const [isPlacePopoverOpen, setIsPlacePopoverOpen] = useState(false);
  const [placePopoverStep, setPlacePopoverStep] = useState('state'); // 'state' | 'district'
  const [popoverSelectedState, setPopoverSelectedState] = useState('Andhra Pradesh');
  const [districtSearchQuery, setDistrictSearchQuery] = useState('');
  const placePopoverRef = useRef(null);

  const updatePlaceFilter = (next) => {
    const val = (next && next.district) ? { state: next.state || null, district: next.district } : { state: null, district: null };
    setStoredPlaceFilter(val);
    setPlaceFilter(val);
  };

  // Sync lowerActiveTab to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('vedika_dashboard_tab', lowerActiveTab);
    } catch {}
  }, [lowerActiveTab]);

  // Restore scroll position if returning from vendor detail
  useEffect(() => {
    try {
      const savedScroll = sessionStorage.getItem('vedika_dashboard_scroll');
      if (savedScroll) {
        const pos = parseInt(savedScroll, 10);
        if (!isNaN(pos) && pos > 0) {
          setTimeout(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          }, 80);
        }
      }
    } catch {}
  }, []);

  const handleVendorCardClick = (v) => {
    try {
      sessionStorage.setItem('vedika_dashboard_scroll', String(window.scrollY || window.pageYOffset || 0));
    } catch {}
    if (onSelectVendor) onSelectVendor(v);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (placePopoverRef.current && !placePopoverRef.current.contains(e.target)) {
        setIsPlacePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset custom picks when key inputs change
  useEffect(() => {
    setSelectedHallPick(null);
    setSelectedCateringPick(null);
    setSelectedDecorPick(null);
    setPlanExpandedPickId(null);
  }, [budget, guests, serviceNeed, userCity, hallCondition, bookingDuration, daysCount]);

  // Reset search when lower category tab changes
  useEffect(() => {
    setLowerSearchQuery('');
    setTierFilter('All');
  }, [lowerActiveTab]);

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
    servingStyle, foodCategory, cuisine, foodType, nonVegPercent,
    unifiedVendors
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

  // Combined Vendors offering both Hall and Catering in Current City
  const combinedVendors = useMemo(() => {
    const cityLower = userCity.toLowerCase();
    const cityHalls = (unifiedVendors.halls || []).filter(h => h.city.toLowerCase() === cityLower);
    const cityCaterers = (unifiedVendors.caterers || []).filter(c => c.city.toLowerCase() === cityLower);

    const pairs = [];
    // 1. By shared vendorUsername (e.g., sai_halls branches)
    cityHalls.forEach(h => {
      if (h.vendorUsername) {
        const cat = cityCaterers.find(c => c.vendorUsername === h.vendorUsername);
        if (cat) {
          pairs.push({ hall: h, caterer: cat, vendorName: h.name.split(' - ')[0] });
        }
      }
    });

    // 2. By matching brand name in same city (e.g. Sri Sai Krishna Convention & Gourmet Kitchen)
    cityHalls.forEach(h => {
      const hPrefix = h.name.split(' ')[0].toLowerCase();
      if (!pairs.some(p => p.hall.id === h.id)) {
        const cat = cityCaterers.find(c => c.name.split(' ')[0].toLowerCase() === hPrefix || (hPrefix.includes('krishna') && c.name.toLowerCase().includes('krishna')));
        if (cat) {
          pairs.push({
            hall: h,
            caterer: cat,
            vendorName: h.name.replace(/Convention.*|Hall.*/i, 'Grand Events & Kitchen').replace(/ Kadapa| Vijayawada| Guntur| Visakhapatnam| Tirupati| Hyderabad| Warangal| Chennai| Coimbatore| Bengaluru| Mysuru| Mumbai| Pune/i, '')
          });
        }
      }
    });

    return pairs;
  }, [unifiedVendors, userCity]);

  const hasCombinedVendors = combinedVendors.length > 0;

  // Small tabs based on "I need" choice inside the AI Plan Panel (Top 3)
  const planPanelTabs = useMemo(() => {
    const tabs = [];
    if (serviceNeed === 'hall' || serviceNeed === 'both') {
      tabs.push({ id: 'H', label: 'Function hall', icon: '🏛' });
    }
    if (serviceNeed === 'catering' || serviceNeed === 'both') {
      tabs.push({ id: 'C', label: 'Catering', icon: '🍽' });
    }
    if (serviceNeed === 'both' && hasCombinedVendors) {
      tabs.push({ id: 'HC', label: 'Hall + Catering (one vendor)', icon: '🏛+🍽' });
    }
    tabs.push({ id: 'decor', label: 'Decoration', icon: '✨' });
    tabs.push({ id: 'band', label: 'Band', icon: '🎺' });
    tabs.push({ id: 'cards', label: 'Cards', icon: '💌' });
    return tabs;
  }, [serviceNeed, hasCombinedVendors]);

  // Ensure planTopTab matches available tabs
  useEffect(() => {
    if (!planPanelTabs.some(t => t.id === planTopTab)) {
      setPlanTopTab(planPanelTabs[0]?.id || 'H');
    }
  }, [planPanelTabs, planTopTab]);

  // TOP 3 RECOMMENDATIONS (ONLY FOR THE AI PLAN PANEL)
  const currentPlanTop3 = useMemo(() => {
    if (!planResult) return [];
    const cityLower = userCity.toLowerCase();
    const isAcNeed = (hallCondition || 'ac').toLowerCase() === 'ac';
    const durNormalized = (bookingDuration || 'full day').toLowerCase();
    const durMult = durNormalized === 'half day' ? 0.60 : (durNormalized === 'multiple days' ? (1 + 0.80 * (Math.max(1, daysCount) - 1)) : 1.00);

    const isDateBooked = (v) => {
      if (!functionDate || !v.bookedDates) return false;
      return v.bookedDates.includes(functionDate);
    };

    const scoreVendor = (cost, budgetShare, capacity, rating) => {
      const budgetFit = Math.min(1, cost / (budgetShare || 1));
      const capFit = capacity ? Math.min(1, guests / capacity) : 1;
      const ratingFit = (rating || 4.5) / 5;
      return (budgetFit * 40) + (capFit * 30) + (ratingFit * 30);
    };

    if (planTopTab === 'H') {
      const cityHalls = (unifiedVendors.halls || []).filter(h => h.city.toLowerCase() === cityLower);
      const list = cityHalls.length > 0 ? cityHalls : (unifiedVendors.halls || []);
      const budgetShare = planResult.hallAllocation || Math.round(budget * (serviceNeed === 'hall' ? 1.0 : 0.35));

      const items = list.map(h => {
        const capacity = Number(h.capacity || 0);
        const basePrice = h.basePrice || h.price || 85000;
        const acFactor = isAcNeed ? 1.30 : 1.00;
        const cost = Math.round(basePrice * acFactor * durMult);
        const booked = isDateBooked(h);
        const fitsCap = capacity >= guests;
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsCap && fitsBudget && isFree;

        let note = '';
        if (!fitsCap) {
          note = `Capacity ${capacity} – doesn't fit ${guests} guests`;
        } else if (!isFree) {
          note = 'Not available on this date';
        } else if (!fitsBudget) {
          note = `Over budget (by ${formatINR(cost - budgetShare)})`;
        }

        const formulaText = `Base ${formatINR(basePrice)} × ${isAcNeed ? 'AC 1.30' : 'Non-AC 1.00'} × ${durNormalized === 'half day' ? 'Half day 0.60' : durNormalized === 'multiple days' ? `${daysCount} days (${durMult.toFixed(2)})` : 'Full day 1.00'}`;

        return {
          id: h.id,
          name: h.name,
          type: 'hall',
          city: h.city,
          state: h.state || 'Andhra Pradesh',
          district: h.district || (cityDistrictMap[h.city] || ''),
          address: h.address || h.street || `${userCity}, AP/TS`,
          rating: Number(h.rating || 4.5),
          reviewsCount: h.reviewsCount || 42,
          capacity,
          basePrice,
          acFactor,
          durMult,
          cost,
          budgetShare,
          fitsCap,
          fitsBudget,
          isFree,
          hardPass,
          note,
          formulaText,
          score: scoreVendor(cost, budgetShare, capacity, Number(h.rating || 4.5)),
          raw: h
        };
      });

      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score || b.rating - a.rating);
      const nonPassing = items.filter(v => !v.hardPass).sort((a, b) => (b.fitsCap ? 1 : 0) - (a.fitsCap ? 1 : 0) || b.rating - a.rating);

      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    if (planTopTab === 'C') {
      const cityCaterers = (unifiedVendors.caterers || []).filter(c => c.city.toLowerCase() === cityLower);
      const list = cityCaterers.length > 0 ? cityCaterers : (unifiedVendors.caterers || []);
      const budgetShare = planResult.cateringAllocation || Math.round(budget * (serviceNeed === 'catering' ? 1.0 : 0.40));

      const items = list.map(c => {
        const pricePerPlate = c.price || c.effectivePrice || planResult.targetPlate || 350;
        const cost = Math.round(pricePerPlate * guests);
        const booked = isDateBooked(c);
        const minPlates = Number(c.minPlates || 0);
        const maxPlates = Number(c.maxPlates || 10000);
        const fitsCap = (minPlates <= guests) && (maxPlates >= guests);
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsCap && fitsBudget && isFree;

        let note = '';
        if (!fitsCap) {
          note = minPlates > guests ? `Min plates: ${minPlates} – guests: ${guests}` : `Max plates: ${maxPlates}`;
        } else if (!isFree) {
          note = 'Not available on this date';
        } else if (!fitsBudget) {
          note = `Over budget (by ${formatINR(cost - budgetShare)})`;
        }

        const formulaText = `₹${pricePerPlate} per plate × ${guests} guests`;

        return {
          id: c.id,
          name: c.name,
          type: 'caterer',
          city: c.city,
          state: c.state || 'Andhra Pradesh',
          district: c.district || (cityDistrictMap[c.city] || ''),
          address: c.address || c.street || `${userCity}, AP/TS`,
          rating: Number(c.rating || 4.5),
          reviewsCount: c.reviewsCount || 48,
          capacity: guests,
          basePrice: pricePerPlate,
          pricePerPlate,
          cost,
          budgetShare,
          fitsCap,
          fitsBudget,
          isFree,
          hardPass,
          note,
          formulaText,
          score: scoreVendor(cost, budgetShare, guests, Number(c.rating || 4.5)),
          raw: c
        };
      });

      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score || b.rating - a.rating);
      const nonPassing = items.filter(v => !v.hardPass).sort((a, b) => (b.fitsCap ? 1 : 0) - (a.fitsCap ? 1 : 0) || b.rating - a.rating);

      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    if (planTopTab === 'HC') {
      const budgetShare = (planResult.hallAllocation || 0) + (planResult.cateringAllocation || 0);

      const items = combinedVendors.map(pair => {
        const h = pair.hall;
        const c = pair.caterer;
        const capacity = Number(h.capacity || 0);
        const basePrice = h.basePrice || h.price || 85000;
        const acFactor = isAcNeed ? 1.30 : 1.00;
        const hallCost = Math.round(basePrice * acFactor * durMult);
        const pricePerPlate = c.price || c.effectivePrice || planResult.targetPlate || 350;
        const cateringCost = Math.round(pricePerPlate * guests);
        const cost = hallCost + cateringCost;

        const booked = isDateBooked(h) || isDateBooked(c);
        const fitsCap = capacity >= guests;
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsCap && fitsBudget && isFree;

        let note = '';
        if (!fitsCap) {
          note = `Capacity ${capacity} – doesn't fit ${guests} guests`;
        } else if (!isFree) {
          note = 'Not available on this date';
        } else if (!fitsBudget) {
          note = `Over budget (by ${formatINR(cost - budgetShare)})`;
        }

        const formulaText = `Hall: ${formatINR(hallCost)} + Catering (${guests} × ₹${pricePerPlate}): ${formatINR(cateringCost)}`;

        return {
          id: `hc-${h.id}-${c.id}`,
          name: pair.vendorName || `${h.name} & ${c.name}`,
          type: 'combined',
          city: h.city,
          address: h.address || h.street || `${userCity}, AP/TS`,
          rating: Number(((Number(h.rating || 4.5) + Number(c.rating || 4.5)) / 2).toFixed(1)),
          reviewsCount: (h.reviewsCount || 30) + (c.reviewsCount || 30),
          capacity,
          hallPart: h,
          cateringPart: c,
          hallCost,
          cateringCost,
          cost,
          budgetShare,
          fitsCap,
          fitsBudget,
          isFree,
          hardPass,
          note,
          formulaText,
          score: scoreVendor(cost, budgetShare, capacity, Number(h.rating || 4.5)),
          raw: { ...h, isCombined: true, caterer: c }
        };
      });

      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score || b.rating - a.rating);
      const nonPassing = items.filter(v => !v.hardPass).sort((a, b) => (b.fitsCap ? 1 : 0) - (a.fitsCap ? 1 : 0) || b.rating - a.rating);

      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    if (planTopTab === 'decor') {
      const dList = (unifiedVendors.decor || []).filter(d => d.city.toLowerCase() === cityLower);
      const list = dList.length > 0 ? dList : (unifiedVendors.decor || []);
      const budgetShare = planResult.decorAllocation || Math.round(budget * 0.12);

      const items = list.map(d => {
        const cost = d.price || (d.tier === 'low' ? 25000 : d.tier === 'medium' ? 55000 : 110000);
        const booked = isDateBooked(d);
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsBudget && isFree;
        return {
          id: d.id,
          name: d.name,
          type: 'decor',
          city: d.city,
          address: d.address || `${userCity}, AP/TS`,
          rating: Number(d.rating || 4.6),
          reviewsCount: d.reviewsCount || 32,
          cost,
          basePrice: cost,
          budgetShare,
          fitsCap: true,
          fitsBudget,
          isFree,
          hardPass,
          note: !fitsBudget ? `Over budget (by ${formatINR(cost - budgetShare)})` : !isFree ? 'Not available on this date' : '',
          formulaText: `${d.tier || 'Medium'} floral & stage decor`,
          score: scoreVendor(cost, budgetShare, 0, Number(d.rating || 4.6)),
          raw: d
        };
      });
      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score);
      const nonPassing = items.filter(v => !v.hardPass);
      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    if (planTopTab === 'band') {
      const bList = (unifiedVendors.bands || []).filter(b => b.city.toLowerCase() === cityLower);
      const list = bList.length > 0 ? bList : (unifiedVendors.bands || []);
      const budgetShare = planResult.extrasAllocation > 0 ? planResult.extrasAllocation : 35000;

      const items = list.map(b => {
        const cost = b.price || 25000;
        const booked = isDateBooked(b);
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsBudget && isFree;
        return {
          id: b.id,
          name: b.name,
          type: 'band',
          city: b.city,
          address: b.address || `${userCity}, AP/TS`,
          rating: Number(b.rating || 4.5),
          reviewsCount: b.reviewsCount || 20,
          cost,
          basePrice: cost,
          budgetShare,
          fitsCap: true,
          fitsBudget,
          isFree,
          hardPass,
          note: !fitsBudget ? 'Over budget' : !isFree ? 'Not available on this date' : '',
          formulaText: 'Traditional live music ensemble',
          score: scoreVendor(cost, budgetShare, 0, Number(b.rating || 4.5)),
          raw: b
        };
      });
      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score);
      const nonPassing = items.filter(v => !v.hardPass);
      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    if (planTopTab === 'cards') {
      const cdList = (unifiedVendors.cards || []).filter(cd => cd.city.toLowerCase() === cityLower);
      const list = cdList.length > 0 ? cdList : (unifiedVendors.cards || []);
      const budgetShare = 25000;

      const items = list.map(cd => {
        const cardCount = Math.max(100, Math.round(guests * 0.6));
        const cost = Math.round((cd.pricePerUnit || 35) * cardCount);
        const booked = isDateBooked(cd);
        const fitsBudget = cost <= budgetShare;
        const isFree = !functionDate || !booked;
        const hardPass = fitsBudget && isFree;
        return {
          id: cd.id,
          name: cd.name,
          type: 'cards',
          city: cd.city,
          address: cd.address || `${userCity}, AP/TS`,
          rating: Number(cd.rating || 4.5),
          reviewsCount: cd.reviewsCount || 25,
          cost,
          basePrice: cd.pricePerUnit || 35,
          budgetShare,
          fitsCap: true,
          fitsBudget,
          isFree,
          hardPass,
          note: !fitsBudget ? 'Over budget' : '',
          formulaText: `₹${cd.pricePerUnit || 35} / card × ${cardCount} cards`,
          score: scoreVendor(cost, budgetShare, 0, Number(cd.rating || 4.5)),
          raw: cd
        };
      });
      const passing = items.filter(v => v.hardPass).sort((a, b) => b.score - a.score);
      const nonPassing = items.filter(v => !v.hardPass);
      if (passing.length >= 3) return passing.slice(0, 3);
      return [...passing, ...nonPassing].slice(0, 3);
    }

    return [];
  }, [planTopTab, planResult, unifiedVendors, userCity, hallCondition, bookingDuration, daysCount, functionDate, guests, budget, serviceNeed, combinedVendors]);

  // Click handler for Top 3 item inside AI Plan Panel
  const handlePlanPickClick = (item) => {
    if (planExpandedPickId === item.id) {
      setPlanExpandedPickId(null);
    } else {
      setPlanExpandedPickId(item.id);
      if (item.type === 'hall') {
        setSelectedHallPick(item);
      } else if (item.type === 'caterer') {
        setSelectedCateringPick(item);
      } else if (item.type === 'combined') {
        setSelectedHallPick({ name: item.hallPart?.name || item.name, cost: item.hallCost, capacity: item.capacity, formulaText: item.formulaText });
        setSelectedCateringPick({ name: item.cateringPart?.name || item.name, cost: item.cateringCost, pricePerPlate: Math.round(item.cateringCost / guests) });
      } else if (item.type === 'decor') {
        setSelectedDecorPick(item);
      }
    }
  };

  // Dynamic Plan Panel Cost Sync (Updates in real time when pick is selected)
  const displayEstimatedCost = useMemo(() => {
    if (!planResult?.estimatedCost) return null;
    const base = planResult.estimatedCost;
    let hallCost = base.hall ? base.hall.cost : 0;
    let hallName = base.hall ? base.hall.name : '';
    let hallCap = base.hall ? base.hall.capacity : 0;
    let hallFormula = base.hall ? base.hall.formulaText : '';

    if (selectedHallPick && serviceNeed !== 'catering') {
      hallCost = selectedHallPick.cost;
      hallName = selectedHallPick.name;
      hallCap = selectedHallPick.capacity;
      hallFormula = selectedHallPick.formulaText || base.hall?.formulaText;
    }

    let cateringCost = base.catering ? base.catering.cost : 0;
    let cateringHeading = base.catering ? `🍽 Catering (${guests} plates × ₹${base.catering.targetPlate})` : '';

    if (selectedCateringPick && serviceNeed !== 'hall') {
      cateringCost = selectedCateringPick.cost;
      cateringHeading = `🍽 ${selectedCateringPick.name} (${guests} plates × ₹${selectedCateringPick.pricePerPlate || selectedCateringPick.basePrice})`;
    }

    let decorCost = base.decor ? base.decor.cost : 0;
    let decorFormula = base.decor ? base.decor.formulaText : '';
    if (selectedDecorPick && serviceNeed !== 'catering') {
      decorCost = selectedDecorPick.cost;
      decorFormula = `✨ ${selectedDecorPick.name} (${selectedDecorPick.formulaText})`;
    }

    const subtotal = (serviceNeed !== 'catering' ? hallCost + decorCost : 0) + (serviceNeed !== 'hall' ? cateringCost : 0);
    const costRemaining = budget - subtotal;
    const isOver = subtotal > budget;

    return {
      ...base,
      hall: base.hall ? {
        ...base.hall,
        name: hallName,
        capacity: hallCap,
        cost: hallCost,
        formulaText: hallFormula
      } : null,
      catering: base.catering ? {
        ...base.catering,
        cost: cateringCost,
        heading: cateringHeading
      } : null,
      decor: base.decor ? {
        ...base.decor,
        cost: decorCost,
        formulaText: decorFormula || base.decor.formulaText
      } : null,
      subtotal,
      budget,
      remaining: Math.max(0, costRemaining),
      isOverBudget: isOver,
      overBy: isOver ? subtotal - budget : 0
    };
  }, [planResult, selectedHallPick, selectedCateringPick, selectedDecorPick, serviceNeed, budget, guests]);

  // RESTORED FULL VENDOR LIST FOR LOWER SECTION (NOT CAPPED AT 3)
  const fullVendorList = useMemo(() => {
    if (!planResult) return [];
    const cityLower = userCity.toLowerCase();
    const isAcNeed = (hallCondition || 'ac').toLowerCase() === 'ac';
    const durNormalized = (bookingDuration || 'full day').toLowerCase();
    const durMult = durNormalized === 'half day' ? 0.60 : (durNormalized === 'multiple days' ? (1 + 0.80 * (Math.max(1, daysCount) - 1)) : 1.00);

    const isDateBooked = (v) => {
      if (!functionDate || !v.bookedDates) return false;
      return v.bookedDates.includes(functionDate);
    };

    let items = [];

    if (lowerActiveTab === 'H') {
      const cityHalls = (unifiedVendors.halls || []).filter(h => h.city.toLowerCase() === cityLower);
      const list = placeFilter.district ? (unifiedVendors.halls || []) : (cityHalls.length > 0 ? cityHalls : (unifiedVendors.halls || []));
      const budgetShare = planResult.hallAllocation || Math.round(budget * (serviceNeed === 'hall' ? 1.0 : 0.35));

      items = list.map(h => {
        const capacity = Number(h.capacity || 0);
        const basePrice = h.basePrice || h.price || 85000;
        const acFactor = isAcNeed ? 1.30 : 1.00;
        const cost = Math.round(basePrice * acFactor * durMult);
        const booked = isDateBooked(h);
        const fitsCap = capacity >= guests;
        const fitsBudget = cost <= budgetShare;
        const fitsPlan = fitsCap && fitsBudget && !booked;
        const tier = basePrice < 90000 ? 'Budget' : basePrice < 250000 ? 'Mid-range' : 'Premium';

        let notFitLabel = '';
        let pickReason = '';
        if (fitsPlan) {
          pickReason = `Capacity ${capacity} fits ${guests} guests, rating ${h.rating || 4.5}.`;
        } else if (!fitsCap) {
          notFitLabel = `Capacity ${capacity} – doesn't fit ${guests} guests`;
          pickReason = `Capacity ${capacity} is below your ${guests} guests.`;
        } else if (booked) {
          notFitLabel = 'Not available on this date';
          pickReason = 'Hall is already reserved on this date.';
        } else if (!fitsBudget) {
          notFitLabel = 'Over budget';
          pickReason = `Over allocated budget by ${formatINR(cost - budgetShare)}.`;
        }

        return {
          id: h.id,
          name: h.name,
          type: 'hall',
          city: h.city,
          state: h.state || 'Andhra Pradesh',
          district: h.district || (cityDistrictMap[h.city] || ''),
          address: h.address || h.street || `${userCity}, AP/TS`,
          rating: Number(h.rating || 4.5),
          price: cost,
          basePrice,
          capacity,
          priceDisplay: formatINR(cost),
          subtext: `Capacity: ${capacity} guests`,
          tier,
          fitsCap,
          fitsBudget,
          fitsPlan,
          isBooked: booked,
          notFitLabel,
          pickReason,
          raw: h
        };
      });
    } else if (lowerActiveTab === 'C') {
      const cityCaterers = (unifiedVendors.caterers || []).filter(c => c.city.toLowerCase() === cityLower);
      const list = placeFilter.district ? (unifiedVendors.caterers || []) : (cityCaterers.length > 0 ? cityCaterers : (unifiedVendors.caterers || []));
      const budgetShare = planResult.cateringAllocation || Math.round(budget * (serviceNeed === 'catering' ? 1.0 : 0.40));

      items = list.map(c => {
        const booked = isDateBooked(c);
        const hasPrice = (c.price != null && c.price > 0) || (c.effectivePrice != null && c.effectivePrice > 0);
        const plateP = hasPrice ? (c.price || c.effectivePrice) : (planResult.targetPlate || 350);
        const cost = hasPrice ? Math.round(plateP * guests) : 0;
        const minPlates = Number(c.minPlates || 0);
        const maxPlates = Number(c.maxPlates || 10000);
        const fitsCap = (minPlates <= guests) && (maxPlates >= guests);
        const fitsBudget = hasPrice ? (cost <= budgetShare) : true;
        const fitsPlan = fitsCap && fitsBudget && !booked;
        const tier = hasPrice ? (plateP < 320 ? 'Budget' : plateP < 480 ? 'Mid-range' : 'Premium') : 'Custom';
        const isPureVeg = (c.foodType === 'veg' || (c.foodTypes?.length === 1 && c.foodTypes[0] === 'veg'));
        const vegInfo = isPureVeg ? 'Pure Veg' : 'Veg & Non-Veg';

        let notFitLabel = '';
        let pickReason = '';
        if (fitsPlan) {
          pickReason = hasPrice ? `Fits your catering allocation and supports ${guests} guests.` : `Supports ${guests} guests. Custom menu on request.`;
        } else if (!fitsCap) {
          notFitLabel = minPlates > guests ? `Min plates: ${minPlates} (you have ${guests})` : `Max plates: ${maxPlates}`;
          pickReason = notFitLabel;
        } else if (booked) {
          notFitLabel = 'Not available on this date';
          pickReason = 'Caterer is fully booked on this date.';
        } else if (!fitsBudget) {
          notFitLabel = 'Over budget';
          pickReason = `Over allocated budget by ${formatINR(cost - budgetShare)}.`;
        }

        return {
          id: c.id,
          name: c.name,
          type: 'caterer',
          city: c.city,
          state: c.state || 'Andhra Pradesh',
          district: c.district || (cityDistrictMap[c.city] || ''),
          address: c.address || c.street || `${userCity}, AP/TS`,
          rating: Number(c.rating || 4.5),
          price: hasPrice ? plateP : null,
          cost,
          priceDisplay: hasPrice ? `₹${plateP} / plate` : 'Rates on request',
          subtext: hasPrice ? `Total ≈ ${formatINR(cost)}` : 'Rates on request',
          tier,
          vegInfo,
          isPureVeg,
          fitsCap,
          fitsBudget,
          fitsPlan,
          isBooked: booked,
          notFitLabel,
          pickReason,
          raw: c
        };
      });
    } else {
      // 'X': Decor, band, cards
      const dItems = (unifiedVendors.decor || []).filter(d => d.city.toLowerCase() === cityLower);
      const bItems = (unifiedVendors.bands || []).filter(b => b.city.toLowerCase() === cityLower);
      const cdItems = (unifiedVendors.cards || []).filter(cd => cd.city.toLowerCase() === cityLower);
      const pItems = (unifiedVendors.photography || []).filter(p => p.city.toLowerCase() === cityLower);

      const dList = dItems.length > 0 ? dItems : (unifiedVendors.decor || []);
      const bList = bItems.length > 0 ? bItems : (unifiedVendors.bands || []);
      const cdList = cdItems.length > 0 ? cdItems : (unifiedVendors.cards || []);
      const pList = pItems.length > 0 ? pItems : (unifiedVendors.photography || []);

      const extras = [
        ...dList.map(d => ({
          ...d,
          type: 'decor',
          priceDisplay: formatINR(d.price || 45000),
          subtext: `${d.tier || 'Medium'} floral & stage decor`,
          tier: d.tier === 'low' ? 'Budget' : d.tier === 'medium' ? 'Mid-range' : 'Premium',
          fitsPlan: true,
          pickReason: 'Theme-matched celebration decor',
          isBooked: isDateBooked(d),
          raw: d
        })),
        ...bList.map(b => ({
          ...b,
          type: 'band',
          priceDisplay: formatINR(b.price || 25000),
          subtext: 'Traditional live music',
          tier: (b.price || 25000) < 25000 ? 'Budget' : 'Mid-range',
          fitsPlan: true,
          pickReason: 'Live traditional wedding music',
          isBooked: isDateBooked(b),
          raw: b
        })),
        ...cdList.map(cd => {
          const cardCount = Math.max(100, Math.round(guests * 0.6));
          const totalCost = (cd.pricePerUnit || 35) * cardCount;
          return {
            ...cd,
            type: 'cards',
            price: totalCost,
            priceDisplay: formatINR(totalCost),
            subtext: `₹${cd.pricePerUnit || 35} / card (${cardCount} cards)`,
            tier: 'Budget',
            fitsPlan: true,
            pickReason: 'Custom invitation prints',
            isBooked: isDateBooked(cd),
            raw: cd
          };
        }),
        ...pList.map(p => ({
          ...p,
          type: 'photo',
          priceDisplay: formatINR(p.price || 50000),
          subtext: 'HD Photo & Cinematic Video',
          tier: (p.price || 50000) < 55000 ? 'Budget' : 'Premium',
          fitsPlan: true,
          pickReason: 'Cinematic photography coverage',
          isBooked: isDateBooked(p),
          raw: p
        }))
      ];
      items = extras;
    }

    // Sort by AI plan ranking: best fit first, but never hide non-fitting ones!
    items.sort((a, b) => {
      if (a.fitsPlan && !b.fitsPlan) return -1;
      if (!a.fitsPlan && b.fitsPlan) return 1;
      if (a.fitsCap && !b.fitsCap) return -1;
      if (!a.fitsCap && b.fitsCap) return 1;
      return (b.rating || 4.5) - (a.rating || 4.5);
    });

    return items;
  }, [lowerActiveTab, planResult, unifiedVendors, userCity, hallCondition, bookingDuration, daysCount, functionDate, guests, budget, serviceNeed, placeFilter]);

  // Apply Search Query, Tier Filter & Place Filter on fullVendorList
  const displayedVendorList = useMemo(() => {
    let list = fullVendorList;
    if (tierFilter && tierFilter !== 'All') {
      list = list.filter(v => v.tier === tierFilter);
    }
    if (placeFilter.district) {
      const targetDist = placeFilter.district.toLowerCase();
      list = list.filter(v => {
        const vDist = (v.district || (cityDistrictMap[v.city] || '')).toLowerCase();
        const vCity = (v.city || '').toLowerCase();
        return vDist === targetDist || vDist.includes(targetDist) || vCity === targetDist;
      });
    }
    if (lowerSearchQuery.trim()) {
      const q = lowerSearchQuery.toLowerCase().trim();
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.address && v.address.toLowerCase().includes(q)) ||
        (v.city && v.city.toLowerCase().includes(q)) ||
        (v.district && v.district.toLowerCase().includes(q)) ||
        (v.subtext && v.subtext.toLowerCase().includes(q))
      );
    }
    return list;
  }, [fullVendorList, tierFilter, placeFilter, lowerSearchQuery]);

  const handleApplyFix = (fix) => {
    if (fix.action.hallCondition) setHallCondition(fix.action.hallCondition);
    if (fix.action.foodCategory) setFoodCategory(fix.action.foodCategory);
    if (fix.action.guests) setGuests(fix.action.guests);
    triggerHighlight('all');
  };

  const handleSavePlan = async () => {
    await saveUserPlan({
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
    clearStoredPlaceFilter();
    updatePlaceFilter({ state: null, district: null });
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
            {placeFilter.district ? (
              <>
                Showing halls and caterers in <b>{placeFilter.district} district</b> ({placeFilter.state || 'Andhra Pradesh'}).{' '}
                <button
                  type="button"
                  onClick={() => updatePlaceFilter({ state: null, district: null })}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--gold)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    fontFamily: 'inherit'
                  }}
                >
                  Clear the place filter to see {userCity}.
                </button>
              </>
            ) : (
              <>Showing halls and caterers in <b>{userCity}</b>. You can switch city or state anytime.</>
            )}
          </p>
        </div>

        {/* 7 Event Chips */}
import DashboardEventChips from './DashboardEventChips.jsx';
import DashboardFormPanel from './DashboardFormPanel.jsx';
import DashboardPlanPanel from './DashboardPlanPanel.jsx';
import DashboardVendorsCatalog from './DashboardVendorsCatalog.jsx';
import DashboardLocationModal from './DashboardLocationModal.jsx';

        {/* 7 Event Chips */}
        <DashboardEventChips
          events={events}
          selectedEventIndex={selectedEventIndex}
          onSelectEvent={handleSelectEvent}
        />

        {/* Two Panels Side by Side */}
        <div className="top2">
          {/* LEFT PANEL: Tell us about your event */}
          <DashboardFormPanel
            budget={budget}
            setBudget={setBudget}
            formatLakh={formatLakh}
            guests={guests}
            setGuests={setGuests}
            daysCount={daysCount}
            setDaysCount={setDaysCount}
            serviceNeed={serviceNeed}
            setServiceNeed={setServiceNeed}
            functionDate={functionDate}
            setFunctionDate={setFunctionDate}
            hallCondition={hallCondition}
            setHallCondition={setHallCondition}
            bookingDuration={bookingDuration}
            setBookingDuration={setBookingDuration}
            decorLevel={decorLevel}
            setDecorLevel={setDecorLevel}
            servingStyle={servingStyle}
            setServingStyle={setServingStyle}
            foodCategory={foodCategory}
            setFoodCategory={setFoodCategory}
            cuisine={cuisine}
            setCuisine={setCuisine}
            foodType={foodType}
            setFoodType={setFoodType}
            nonVegPercent={nonVegPercent}
            setNonVegPercent={setNonVegPercent}
            triggerHighlight={triggerHighlight}
            basicRange={basicRange}
            standardRange={standardRange}
            premiumRange={premiumRange}
            luxuryRange={luxuryRange}
          />

          {/* RIGHT PANEL: Your AI Plan */}
          <DashboardPlanPanel
            planResult={planResult}
            budget={budget}
            formatLakh={formatLakh}
            formatINR={formatINR}
            currentEvent={currentEvent}
            guests={guests}
            serviceNeed={serviceNeed}
            bookingDuration={bookingDuration}
            userCity={userCity}
            selectedPackageName={selectedPackageName}
            setSelectedPackageName={setSelectedPackageName}
            planTopTab={planTopTab}
            setPlanTopTab={setPlanTopTab}
            planPanelTabs={planPanelTabs}
            currentPlanTop3={currentPlanTop3}
            planExpandedPickId={planExpandedPickId}
            selectedHallPick={selectedHallPick}
            selectedCateringPick={selectedCateringPick}
            selectedDecorPick={selectedDecorPick}
            displayEstimatedCost={displayEstimatedCost}
            highlightedRow={highlightedRow}
            savePlanFeedback={savePlanFeedback}
            shareFeedback={shareFeedback}
            handlePlanPickClick={handlePlanPickClick}
            handleApplyFix={handleApplyFix}
            handleSavePlan={handleSavePlan}
            handleSharePlan={handleSharePlan}
            onOpenBook={onOpenBook}
            onOpenChat={onOpenChat}
            onSelectVendor={onSelectVendor}
            onTriggerLoader={onTriggerLoader}
            SPLIT_COLORS={SPLIT_COLORS}
          />
        </div>

        {/* =============================================================
            PART B: RESTORED FULL VENDOR LIST BELOW THE AI PLAN
            ============================================================= */}
        <DashboardVendorsCatalog
          userCity={userCity}
          userState={userState}
          TAB_CONFIG={TAB_CONFIG}
          lowerActiveTab={lowerActiveTab}
          setLowerActiveTab={setLowerActiveTab}
          lowerSearchQuery={lowerSearchQuery}
          setLowerSearchQuery={setLowerSearchQuery}
          tierFilter={tierFilter}
          setTierFilter={setTierFilter}
          placeFilter={placeFilter}
          updatePlaceFilter={updatePlaceFilter}
          isPlacePopoverOpen={isPlacePopoverOpen}
          setIsPlacePopoverOpen={setIsPlacePopoverOpen}
          placePopoverStep={placePopoverStep}
          setPlacePopoverStep={setPlacePopoverStep}
          popoverSelectedState={popoverSelectedState}
          setPopoverSelectedState={setPopoverSelectedState}
          districtSearchQuery={districtSearchQuery}
          setDistrictSearchQuery={setDistrictSearchQuery}
          placePopoverRef={placePopoverRef}
          districtsData={districtsData}
          displayedVendorList={displayedVendorList}
          handleVendorCardClick={handleVendorCardClick}
          onOpenChat={onOpenChat}
          onOpenBook={onOpenBook}
        />

        {/* Footer */}
        <footer>
          UstavOne · Design preview. Names, prices and ratings are placeholders.
        </footer>
      </div>

      {/* Location Modal */}
      <DashboardLocationModal
        showLocationModal={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        tempState={tempState}
        setTempState={setTempState}
        tempCity={tempCity}
        setTempCity={setTempCity}
        availableCitiesForState={availableCitiesForState}
        handleConfirmLocation={handleConfirmLocation}
        CITIES_BY_STATE={CITIES_BY_STATE}
      />
    </div>
  );
}
