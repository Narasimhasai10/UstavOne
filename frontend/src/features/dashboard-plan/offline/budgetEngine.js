/* OFFLINE FALLBACK BUDGET ENGINE - Source of truth is backend/src/services/planner.js */
import plannerConfig from '../plannerConfig.json' with { type: 'json' };
import dummyData from '../../../shared/data/dummyVendors.json' with { type: 'json' };
import { EVENT_TYPES, ALL_CITIES } from '../events.js';

// Format currency in Indian numbering system: e.g. ₹60,00,000
export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  const rounded = Math.round(amount);
  const str = rounded.toString();
  if (str.length <= 3) return `₹${str}`;
  const last3 = str.substring(str.length - 3);
  const rest = str.substring(0, str.length - 3);
  const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${formattedRest},${last3}`;
}

// Convert rupees into short readable string (e.g. ₹5 lakh, ₹1.2 crore)
export function formatLakhCrore(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  if (amount >= 10000000) {
    const cr = (amount / 10000000).toFixed(1).replace(/\.0$/, '');
    return `₹${cr} crore`;
  }
  if (amount >= 100000) {
    const lk = (amount / 100000).toFixed(1).replace(/\.0$/, '');
    return `₹${lk} lakh`;
  }
  return formatINR(amount);
}

/**
 * Filter vendors by city or fallback to all available
 */
function getCityVendors(list, city) {
  if (!list || !list.length) return [];
  const match = list.filter(v => v.city && (v.city.toLowerCase() === city.toLowerCase() || v.city.toLowerCase() === 'all'));
  return match.length > 0 ? match : list;
}

/**
 * Calculate Plate Price Range using plannerConfig table and factors
 */
export function calculatePlatePriceRange(foodCategory = 'standard', servingStyle = 'buffet', cuisine = 'andhra', dietary = 'both') {
  const catKey = (foodCategory || 'standard').toLowerCase();
  const servKey = (servingStyle || 'buffet').toLowerCase();
  const cuisKey = (cuisine || 'andhra').toLowerCase();
  const dietKey = (dietary || 'both').toLowerCase();

  const baseRange = plannerConfig.platePricing[catKey] || plannerConfig.platePricing.standard;
  const servFactor = plannerConfig.servingFactors[servKey] ?? 1.0;
  const cuisFactor = plannerConfig.cuisineFactors[cuisKey] ?? 1.0;
  const dietFactor = plannerConfig.dietaryFactors[dietKey] ?? 1.0;

  const totalMultiplier = servFactor * cuisFactor * dietFactor;

  const minPlate = Math.round(baseRange.min * totalMultiplier);
  const maxPlate = Math.round(baseRange.max * totalMultiplier);

  return { minPlate, maxPlate, totalMultiplier };
}

/**
 * Main budget engine function
 * Implements planner-spec.md:
 * - 90% usable budget (10% contingency)
 * - Plate calculation x serving x cuisine factors
 * - 40/35/25 weights with AC and decor adjustments
 * - Clamping catering and redistributing excess to hall and decor
 * - 3 packages (~70%, ~90%, 100-110%)
 */
export function planEvent(input = {}) {
  const {
    event = 'wedding',
    city = 'Kadapa',
    budget = 800000,
    guests = 600,
    plates = 600,
    serviceNeed = 'both', // 'both' | 'hall' | 'catering'
    hallCondition = 'ac', // 'ac' | 'non-ac'
    bookingDuration = 'full-day', // 'half-day' | 'full-day' | 'multi-day'
    daysCount = 1,
    decorLevel = 'medium', // 'low' | 'medium' | 'high'
    servingStyle = 'buffet',
    foodCategory = 'standard',
    cuisine = 'andhra',
    dietary = 'both'
  } = input;

  const guestCount = Number(guests || plates || 600);
  const totalBudget = Number(budget || 800000);
  const isBoth = serviceNeed === 'both';
  const hasHall = isBoth || serviceNeed === 'hall';
  const hasCatering = isBoth || serviceNeed === 'catering';

  // 1. Usable Budget (90% usable, 10% contingency)
  const usableBudget = Math.round(totalBudget * (plannerConfig.usableBudgetRatio || 0.90));
  const contingencyBuffer = totalBudget - usableBudget;

  // 2. Plate price calculation
  const { minPlate, maxPlate } = calculatePlatePriceRange(foodCategory, servingStyle, cuisine, dietary);

  // 3. Catering Cost & Clamping
  let cateringCost = 0;
  let cateringClamped = false;
  let hallAllocation = 0;
  let decorAllocation = 0;
  let cateringAllocation = 0;

  if (isBoth) {
    // Both Hall and Catering
    const maxCateringNeed = guestCount * maxPlate;
    const baseCateringBudget = usableBudget * (plannerConfig.baseWeights.both.catering / 100); // 40% of usable

    if (maxCateringNeed <= baseCateringBudget) {
      // Clamped catering!
      cateringCost = maxCateringNeed;
      cateringAllocation = maxCateringNeed;
      cateringClamped = true;

      // Excess catering is redistributed to hall and decor
      const remainingUsable = usableBudget - cateringCost;

      // Adjust weights: Hall base 35 (+3 for AC), Decor base 25 (+/- decor adjustment)
      const acMod = (hallCondition === 'ac') ? (plannerConfig.acAdjustment || 3) : 0;
      const decorMod = plannerConfig.decorAdjustments[decorLevel] ?? 0;

      const hallWeight = plannerConfig.baseWeights.both.hall + acMod; // e.g. 35 + 3 = 38
      const decorWeight = Math.max(10, plannerConfig.baseWeights.both.decor + decorMod); // e.g. 25 + 0 = 25

      const totalRemainingWeight = hallWeight + decorWeight; // e.g. 38 + 25 = 63

      hallAllocation = Math.round(remainingUsable * (hallWeight / totalRemainingWeight));
      decorAllocation = remainingUsable - hallAllocation; // ensure exact sum
    } else {
      // Catering uses its full 40% slice
      cateringAllocation = Math.round(baseCateringBudget);
      cateringCost = cateringAllocation;

      const remainingUsable = usableBudget - cateringAllocation;
      const acMod = (hallCondition === 'ac') ? (plannerConfig.acAdjustment || 3) : 0;
      const decorMod = plannerConfig.decorAdjustments[decorLevel] ?? 0;

      const hallWeight = plannerConfig.baseWeights.both.hall + acMod;
      const decorWeight = Math.max(10, plannerConfig.baseWeights.both.decor + decorMod);
      const totalRemainingWeight = hallWeight + decorWeight;

      hallAllocation = Math.round(remainingUsable * (hallWeight / totalRemainingWeight));
      decorAllocation = remainingUsable - hallAllocation;
    }
  } else if (serviceNeed === 'hall') {
    // Hall only: 70% hall, 30% decor with adjustments
    cateringAllocation = 0;
    cateringCost = 0;

    const acMod = (hallCondition === 'ac') ? (plannerConfig.acAdjustment || 3) : 0;
    const decorMod = plannerConfig.decorAdjustments[decorLevel] ?? 0;

    const hallWeight = plannerConfig.baseWeights.hallOnly.hall + acMod;
    const decorWeight = Math.max(10, plannerConfig.baseWeights.hallOnly.decor + decorMod);
    const totalWeight = hallWeight + decorWeight;

    hallAllocation = Math.round(usableBudget * (hallWeight / totalWeight));
    decorAllocation = usableBudget - hallAllocation;
  } else {
    // Catering only: 85% catering, 15% decor/hospitality
    hallAllocation = 0;
    const maxCateringNeed = guestCount * maxPlate;
    const baseCatBudget = usableBudget * (plannerConfig.baseWeights.cateringOnly.catering / 100);

    if (maxCateringNeed <= baseCatBudget) {
      cateringAllocation = maxCateringNeed;
      cateringCost = maxCateringNeed;
      decorAllocation = usableBudget - cateringAllocation;
      cateringClamped = true;
    } else {
      cateringAllocation = Math.round(baseCatBudget);
      cateringCost = cateringAllocation;
      decorAllocation = usableBudget - cateringAllocation;
    }
  }

  // Multi-day duration multiplier for hall
  let durationMultiplier = 1.0;
  if (bookingDuration === 'half-day') {
    durationMultiplier = plannerConfig.durationMultipliers['half-day'] || 0.70;
  } else if (bookingDuration === 'multi-day') {
    const days = Math.max(2, daysCount);
    durationMultiplier = 1.0 + (days - 1) * (plannerConfig.durationMultipliers['multi-day-factor'] || 0.85);
  }

  // 4. City Vendor Lookups & Floor Check
  const cityHalls = getCityVendors(dummyData.halls, city);
  const cityCaterers = getCityVendors(dummyData.caterers, city);
  const cityDecor = (dummyData.decorPackages && (dummyData.decorPackages[city] || dummyData.decorPackages['Kadapa'] || dummyData.decorPackages['Vijayawada'])) || { low: { price: 20000 } };

  const minHallPrice = hasHall && cityHalls.length ? Math.min(...cityHalls.map(h => h.price)) : 0;
  const minPlatePrice = hasCatering && cityCaterers.length ? Math.min(...cityCaterers.map(c => c.price)) : minPlate;
  const minCateringPrice = hasCatering ? (guestCount * minPlatePrice) : 0;
  const minDecorPrice = (cityDecor && cityDecor.low) ? cityDecor.low.price : 20000;

  const minimumViableFloor = (hasHall ? minHallPrice : 0) + (hasCatering ? minCateringPrice : 0) + (decorAllocation > 0 ? minDecorPrice : 0);
  const isUnderFloor = totalBudget < minimumViableFloor;

  // Capacity Check: can any hall hold these guests?
  const maxCapacityInCity = cityHalls.length ? Math.max(...cityHalls.map(h => h.capacity || 0)) : 0;
  const isCapacityExceeded = hasHall && guestCount > maxCapacityInCity;

  const notes = [];
  if (isUnderFloor) {
    notes.push(`Your budget is a little below the minimum required for ${city}. The least recommended budget for ${guestCount} guests is ${formatINR(minimumViableFloor)}.`);
  }
  if (isCapacityExceeded) {
    notes.push(`Notice: Planned attendance of ${guestCount} guests exceeds the maximum single hall capacity (${maxCapacityInCity}) in ${city}. We suggest booking a lawn extension or 2 shifts.`);
  }

  // 5. Build 3 Packages (Budget, Best Value, Premium)
  function buildPackage(pkgName, targetRatio, strategy) {
    const targetUsable = usableBudget * targetRatio;
    const catTarget = hasCatering ? (cateringClamped ? Math.round(cateringAllocation * targetRatio) : Math.round(targetUsable * (cateringAllocation / usableBudget))) : 0;
    const hallTarget = hasHall ? Math.round(hallAllocation * targetRatio * durationMultiplier) : 0;
    const decorTarget = Math.round(decorAllocation * targetRatio);

    const vendors = {};
    const costs = {};
    let totalSpent = 0;

    // Pick Hall
    if (hasHall && cityHalls.length) {
      let candidates = [...cityHalls];
      if (hallCondition === 'ac') {
        const acHalls = candidates.filter(h => h.hasAc);
        if (acHalls.length) candidates = acHalls;
      }

      if (strategy === 'price') {
        candidates.sort((a, b) => a.price - b.price);
      } else if (strategy === 'value') {
        candidates.sort((a, b) => (b.rating / Math.max(1, a.price)) - (a.rating / Math.max(1, b.price)) || b.rating - a.rating);
      } else {
        candidates.sort((a, b) => b.rating - a.rating || b.price - a.price);
      }

      const chosenHall = candidates[0];
      const hallCost = Math.round(chosenHall.price * durationMultiplier);
      vendors.hall = {
        ...chosenHall,
        calculatedCost: hallCost,
        isEstimated: Boolean(chosenHall.isEstimated)
      };
      costs.hall = hallCost;
      totalSpent += hallCost;
    }

    // Pick Caterer
    if (hasCatering && cityCaterers.length) {
      let candidates = [...cityCaterers];
      if (dietary === 'veg') {
        const vegCat = candidates.filter(c => c.dietary === 'veg' || c.dietary === 'both');
        if (vegCat.length) candidates = vegCat;
      }

      if (strategy === 'price') {
        candidates.sort((a, b) => a.price - b.price);
      } else if (strategy === 'value') {
        candidates.sort((a, b) => b.rating - a.rating || a.price - b.price);
      } else {
        candidates.sort((a, b) => b.rating - a.rating || b.price - a.price);
      }

      const chosenCat = candidates[0];
      const plateRate = strategy === 'price' ? minPlate : (strategy === 'value' ? Math.round((minPlate + maxPlate) / 2) : maxPlate);
      const catCost = guestCount * plateRate;

      vendors.catering = {
        ...chosenCat,
        ratePerPlate: plateRate,
        calculatedCost: catCost,
        plates: guestCount,
        isEstimated: Boolean(chosenCat.isEstimated)
      };
      costs.catering = catCost;
      totalSpent += catCost;
    }

    // Pick Decor
    if (decorAllocation > 0 && cityDecor) {
      const tierKey = strategy === 'price' ? 'low' : (strategy === 'value' ? (decorLevel === 'high' ? 'moderate' : decorLevel) : 'high');
      const chosenDecor = cityDecor[tierKey] || cityDecor.moderate || cityDecor.low;
      vendors.decor = {
        ...chosenDecor,
        calculatedCost: chosenDecor.price,
        isEstimated: false
      };
      costs.decor = chosenDecor.price;
      totalSpent += chosenDecor.price;
    }

    const leftOver = Math.max(0, totalBudget - totalSpent);
    const overallRating = (
      Object.values(vendors).reduce((acc, v) => acc + (v.rating || 4.7), 0) /
      Math.max(1, Object.keys(vendors).length)
    ).toFixed(1);

    let reason = '';
    if (pkgName === 'Budget') {
      reason = `Saves ${formatINR(leftOver)} with dependable top-rated vendors in ${city}. Lean costs without sacrificing quality.`;
    } else if (pkgName === 'Best Value') {
      reason = `Optimal rating-per-rupee balance in ${city}. Fully covers ${guestCount} guests with ${formatINR(leftOver)} emergency buffer remaining.`;
    } else {
      reason = `Premier 5-star experience with grand lighting and luxury dining. Leaves ${formatINR(leftOver)} buffer for personal extras.`;
    }

    return {
      name: pkgName,
      totalCost: totalSpent,
      leftOver,
      overallRating,
      vendors,
      costs,
      reason,
      recommended: pkgName === 'Best Value'
    };
  }

  const packages = [
    buildPackage('Budget', plannerConfig.packageRatios.budget || 0.75, 'price'),
    buildPackage('Best Value', plannerConfig.packageRatios.bestValue || 0.92, 'value'),
    buildPackage('Premium', plannerConfig.packageRatios.premium || 1.05, 'premium')
  ];

  return {
    usableBudget,
    contingencyBuffer,
    totalBudget,
    guestCount,
    plates: guestCount,
    minPlate,
    maxPlate,
    cateringCost,
    cateringClamped,
    hallAllocation,
    decorAllocation,
    cateringAllocation,
    minimumViableFloor,
    isUnderFloor,
    isCapacityExceeded,
    split: {
      catering: Math.round((cateringAllocation / (usableBudget || 1)) * 100),
      hall: Math.round((hallAllocation / (usableBudget || 1)) * 100),
      decor: Math.round((decorAllocation / (usableBudget || 1)) * 100)
    },
    packages,
    notes,
    city,
    event,
    serviceNeed,
    hallCondition,
    bookingDuration,
    decorLevel,
    foodCategory,
    servingStyle,
    cuisine,
    dietary
  };
}
