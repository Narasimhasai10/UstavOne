import { prisma } from "../../utils/prisma.js";

export const DEFAULT_PLANNER_CONFIG = {
  usableBudgetRatio: 0.90, // 10% kept as contingency buffer

  plateTable: {
    basic: {
      veg: { min: 150, max: 200 },
      nonVeg: { min: 200, max: 250 }
    },
    standard: {
      veg: { min: 200, max: 300 },
      nonVeg: { min: 300, max: 400 }
    },
    premium: {
      veg: { min: 300, max: 450 },
      nonVeg: { min: 400, max: 600 }
    },
    luxury: {
      veg: { min: 450, max: 700 },
      nonVeg: { min: 600, max: 1000 }
    }
  },

  factors: {
    serving: {
      'banana leaf': 1.00,
      'buffet': 1.05,
      'table service': 1.25
    },
    cuisine: {
      'south indian': 0.95,
      'andhra': 1.00,
      'north indian': 1.10,
      'multi-cuisine': 1.20,
      'multi': 1.20
    },
    hallCondition: {
      'non-ac': 1.00,
      'ac': 1.30
    },
    duration: {
      'half day': 0.60,
      'half_day': 0.60,
      'full day': 1.00,
      'full_day': 1.00
    }
  },

  cityMultipliers: {
    'kadapa': 0.9,
    'vijayawada': 1.0,
    'guntur': 0.95,
    'visakhapatnam': 1.1,
    'tirupati': 0.9,
    'hyderabad': 1.2,
    'warangal': 0.9,
    'chennai': 1.2,
    'coimbatore': 1.0,
    'bengaluru': 1.25,
    'mysuru': 0.95,
    'mumbai': 1.5,
    'pune': 1.2
  },

  baseWeights: {
    both: { catering: 40, hall: 35, decor: 25 },
    hall: { hall: 60, decor: 40 },
    catering: { catering: 100 }
  },

  adjustments: {
    acHall: 3,
    extraDayPerDay: 4,
    maxExtraDayHallAdjustment: 12,
    halfDayHall: -5,
    decorHigh: 8,
    decorLow: -5,
    tableServiceCatering: 2
  },

  scoring: {
    rating: 0.40,
    value: 0.30,
    budgetFit: 0.20,
    popularity: 0.10
  },

  packages: {
    budget: 0.70,
    balanced: 0.90,
    premium: 1.05
  }
};

export function formatINR(val) {
  if (val == null || isNaN(val)) return '₹0';
  const rounded = Math.round(val);
  const str = rounded.toString();
  if (str.length <= 3) return `₹${str}`;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${formattedRest},${last3}`;
}

export function formatLakh(val) {
  if (val == null || isNaN(val)) return '₹0';
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(1).replace(/\.0$/, '');
    return `₹${cr} crore`;
  }
  if (val >= 100000) {
    const lk = (val / 100000).toFixed(1).replace(/\.0$/, '');
    return `₹${lk} lakh`;
  }
  return formatINR(val);
}

export function calculatePlateRange(
  foodCategory = 'standard',
  foodType = 'non-veg',
  nonVegPercent = 50,
  serving = 'buffet',
  cuisine = 'andhra',
  cityMult = 1.0,
  config = DEFAULT_PLANNER_CONFIG
) {
  const catKey = (foodCategory || 'standard').toLowerCase();
  const servKey = (serving || 'buffet').toLowerCase();
  const cuisKey = (cuisine || 'andhra').toLowerCase();
  const typeKey = (foodType || 'non-veg').toLowerCase();

  const catPricing = config.plateTable[catKey] || config.plateTable.standard;
  const servFactor = config.factors.serving[servKey] ?? 1.05;
  const cuisFactor = config.factors.cuisine[cuisKey] ?? 1.00;

  let baseMin = 0;
  let baseMax = 0;

  if (typeKey === 'veg') {
    baseMin = catPricing.veg.min;
    baseMax = catPricing.veg.max;
  } else if (typeKey === 'non-veg' || typeKey === 'nonveg') {
    baseMin = catPricing.nonVeg.min;
    baseMax = catPricing.nonVeg.max;
  } else {
    // Both: Plate = Veg + p * (NonVeg - Veg)
    const p = (nonVegPercent != null ? nonVegPercent : 50) / 100;
    baseMin = catPricing.veg.min + p * (catPricing.nonVeg.min - catPricing.veg.min);
    baseMax = catPricing.veg.max + p * (catPricing.nonVeg.max - catPricing.veg.max);
  }

  const multiplier = servFactor * cuisFactor * cityMult;
  const minPlate = Math.round(baseMin * multiplier);
  const maxPlate = Math.round(baseMax * multiplier);

  return { minPlate, maxPlate };
}

export function planEvent(input = {}, data = { halls: [], caterers: [], decor: [] }, config = DEFAULT_PLANNER_CONFIG) {
  const {
    event = 'wedding',
    city = 'Kadapa',
    budget = 800000,
    serviceNeed = 'both',
    need = null,
    guests = 600,
    plates = null,
    date = null,
    hallCondition = 'ac',
    acMode = null,
    bookingDuration = 'full day',
    duration = null,
    daysCount = 1,
    days = null,
    decorLevel = 'medium',
    servingStyle = 'buffet',
    foodCategory = 'standard',
    cuisine = 'andhra',
    foodType = 'non-veg',
    nonVegPercent = 50,
    nonVegPct = null,
    cityMultiplierOverride = null,
    capsHigh = false
  } = input;

  const actualNeed = (
    (input.services && input.services.length === 1 ? input.services[0] : null) ||
    need ||
    serviceNeed ||
    'both'
  ).toLowerCase();
  const actualGuests = Number(input.guestCount || guests || plates || 600);
  const actualBudget = Number(input.totalBudget || budget || 800000);
  const actualAc = (acMode || hallCondition || 'ac').toLowerCase();
  const actualDays = Number(input.days || days || daysCount || 1);
  const actualDur = (duration || (actualDays > 1 ? 'multiple days' : bookingDuration) || 'full day').toLowerCase();
  const actualNonVegPct = nonVegPct != null ? Number(nonVegPct) : Number(nonVegPercent != null ? nonVegPercent : 50);

  const hasHall = actualNeed === 'both' || actualNeed === 'hall';
  const hasCatering = actualNeed === 'both' || actualNeed === 'catering';

  const normalizedCity = (city || 'Kadapa').toLowerCase();
  const cityMult = cityMultiplierOverride != null ? cityMultiplierOverride : (config.cityMultipliers[normalizedCity] ?? 1.0);

  // 1. Usable = Budget * 0.90 (10% kept as contingency buffer)
  const usableBudget = Math.round(actualBudget * config.usableBudgetRatio);
  const contingencyBuffer = actualBudget - usableBudget;

  // 2. Catering Plate Range
  let minPlate = 0;
  let maxPlate = 0;
  let Cmin = 0;
  let Cmax = 0;

  if (hasCatering) {
    const range = calculatePlateRange(foodCategory, foodType, actualNonVegPct, servingStyle, cuisine, cityMult, config);
    minPlate = range.minPlate;
    maxPlate = range.maxPlate;
    Cmin = actualGuests * minPlate;
    Cmax = actualGuests * maxPlate;
  }

  // 3. Hall & Decor Minimums
  let Hmin = 0;
  let Dmin = 0;
  let hallCapExceeded = false;
  let maxHallCapInCity = 0;

  const hallsList = data.halls || [];
  const getCity = (item) => (typeof item?.city === 'object' ? item.city?.city : item?.city) || '';
  const cityHalls = hallsList.filter(h => getCity(h).toLowerCase() === normalizedCity);
  const fallbackHalls = cityHalls.length > 0 ? cityHalls : hallsList;
  maxHallCapInCity = Math.max(...fallbackHalls.map(h => Number(h.capacity || 0)), 0);

  if (hasHall) {
    if (actualGuests > maxHallCapInCity && maxHallCapInCity > 0) {
      hallCapExceeded = true;
    }

    const isAcNeed = actualAc === 'ac';
    const durMult = actualDur === 'half day' || actualDur === 'half_day'
      ? 0.60
      : (actualDur === 'multiple days' || actualDur === 'multiple'
        ? (1 + 0.80 * (Math.max(1, actualDays) - 1))
        : 1.00);

    const matchingHalls = fallbackHalls.filter(h => Number(h.capacity || 0) >= actualGuests * 0.8 && (isAcNeed ? (h.isAC || h.acMode !== 'non_ac') : true));
    const hallPool = matchingHalls.length > 0 ? matchingHalls : fallbackHalls;
    const baseCheapest = Math.min(...hallPool.map(h => Number(h.price || h.basePrice || h.priceFullDayNonAc || 80000)), 80000);
    Hmin = Math.round(baseCheapest * (isAcNeed ? 1.30 : 1.00) * durMult);

    const decorTiers = { low: 35000, medium: 75000, high: 160000 };
    const baseDecor = (decorTiers[decorLevel.toLowerCase()] || 75000) * cityMult;
    const decorDaysMult = 1 + 0.5 * (Math.max(1, actualDays) - 1);
    Dmin = Math.round(baseDecor * decorDaysMult);
  }

  // 4. Feasibility Check
  const minRequired = (hasCatering ? Cmin : 0) + (hasHall ? (Hmin + Dmin) : 0);
  const isTooLow = usableBudget < minRequired;

  const concreteFixes = [];
  if (isTooLow) {
    if (hasHall && actualAc === 'ac') {
      const nonAcHmin = Math.round(Hmin / 1.30);
      const savings = Hmin - nonAcHmin;
      concreteFixes.push({
        type: 'switch_non_ac',
        text: `Non-AC saves ${formatINR(savings)}`,
        action: { hallCondition: 'non-ac', acMode: 'non_ac' }
      });
    }
    if (hasCatering && (foodCategory || '').toLowerCase() !== 'basic') {
      const basicRange = calculatePlateRange('basic', foodType, actualNonVegPct, servingStyle, cuisine, cityMult, config);
      const basicCmin = actualGuests * basicRange.minPlate;
      const savings = Cmin - basicCmin;
      concreteFixes.push({
        type: 'lower_food_category',
        text: `A lower food category saves ${formatINR(savings)}`,
        action: { foodCategory: 'basic' }
      });
    }
    const perGuestCost = (hasCatering ? minPlate : 0) + (hasHall ? ((Hmin + Dmin) / actualGuests) : 0);
    const maxSupportedGuests = Math.max(10, Math.floor(usableBudget / (perGuestCost || 1)));
    concreteFixes.push({
      type: 'reduce_guests',
      text: `Your budget supports up to ${maxSupportedGuests} guests`,
      action: { guests: maxSupportedGuests }
    });
  }

  // 5. Weights Calculation
  let weights = { catering: 0, hall: 0, decor: 0 };
  if (actualNeed === 'both') {
    weights = { ...config.baseWeights.both };
  } else if (actualNeed === 'hall') {
    weights = { ...config.baseWeights.hall, catering: 0 };
  } else {
    weights = { ...config.baseWeights.catering, hall: 0, decor: 0 };
  }

  if (hasHall) {
    if (actualAc === 'ac') {
      weights.hall += config.adjustments.acHall; // +3
    }
    if (actualDur === 'half day' || actualDur === 'half_day') {
      weights.hall += config.adjustments.halfDayHall; // -5
    } else if (actualDur === 'multiple days' || actualDur === 'multiple') {
      const extraDays = Math.max(0, actualDays - 1);
      weights.hall += Math.min(config.adjustments.maxExtraDayHallAdjustment, extraDays * config.adjustments.extraDayPerDay);
    }
    if ((decorLevel || '').toLowerCase() === 'high') {
      weights.decor += config.adjustments.decorHigh; // +8
    } else if ((decorLevel || '').toLowerCase() === 'low') {
      weights.decor += config.adjustments.decorLow; // -5
    }
  }

  if (hasCatering) {
    if ((servingStyle || '').toLowerCase() === 'table service') {
      weights.catering += config.adjustments.tableServiceCatering; // +2
    }
  }

  const sumWeights = (hasCatering ? weights.catering : 0) + (hasHall ? (weights.hall + weights.decor) : 0) || 1;

  // Slices
  let cateringSlice = hasCatering ? Math.round(usableBudget * (weights.catering / sumWeights)) : 0;
  let hallSlice = hasHall ? Math.round(usableBudget * (weights.hall / sumWeights)) : 0;
  let decorSlice = hasHall ? Math.round(usableBudget * (weights.decor / sumWeights)) : 0;

  if (input.services && input.services.length === 1 && input.services[0] === 'hall') {
    hallSlice = usableBudget;
    cateringSlice = 0;
    decorSlice = 0;
  }

  // 6. Clamp Catering
  let cateringSpend = cateringSlice;
  let excess = 0;
  let extrasSlice = 0;

  if (hasCatering && actualNeed === 'both') {
    if (cateringSlice > Cmax) {
      cateringSpend = Cmax;
      excess = cateringSlice - Cmax;

      const hallDecorSum = weights.hall + weights.decor || 1;
      const hallAdd = Math.round(excess * (weights.hall / hallDecorSum));
      const decorAdd = excess - hallAdd;

      hallSlice += hallAdd;
      decorSlice += decorAdd;
      cateringSlice = cateringSpend;
    } else if (cateringSlice < Cmin) {
      cateringSpend = Cmin;
    }
  } else if (hasCatering && actualNeed === 'catering') {
    cateringSpend = Math.min(cateringSlice, Cmax > 0 ? Cmax : cateringSlice);
    excess = Math.max(0, cateringSlice - cateringSpend);
    cateringSlice = cateringSpend;
    extrasSlice = excess;
  }

  // Target Plate
  let targetPlate = maxPlate;
  if (Cmax > Cmin) {
    const t = Math.max(0, Math.min(1, (cateringSpend - Cmin) / (Cmax - Cmin)));
    targetPlate = Math.round(minPlate + t * (maxPlate - minPlate));
  } else {
    targetPlate = minPlate;
  }

  // 7. Suggestions
  const suggestions = [];
  if (hasCatering) {
    const cats = ['basic', 'standard', 'premium', 'luxury'];
    const currentIdx = cats.indexOf(foodCategory.toLowerCase());
    const capCat = foodCategory.charAt(0).toUpperCase() + foodCategory.slice(1).toLowerCase();
    const capType = foodType === 'non-veg' || foodType === 'nonveg' ? 'Non-Veg' : (foodType === 'veg' ? 'Veg' : 'Both');

    if (currentIdx >= 0 && currentIdx < cats.length - 1) {
      const nextCat = cats[currentIdx + 1];
      const nextCapCat = nextCat.charAt(0).toUpperCase() + nextCat.slice(1).toLowerCase();
      const nextRange = calculatePlateRange(nextCat, foodType, actualNonVegPct, servingStyle, cuisine, cityMult, config);
      suggestions.push({
        type: 'upgrade_food',
        text: `Your food budget reaches the top of ${capCat} ${capType} (₹${targetPlate} per plate). ${nextCapCat} ${capType} would cost ₹${nextRange.minPlate}-${nextRange.maxPlate} per plate, if you want to upgrade by reducing the hall or decoration budget.`,
        nextCategory: nextCat
      });
    }
  }

  // 8. Rank Vendors
  const caterersList = data.caterers || [];
  const cityCaterers = caterersList.filter(c => getCity(c).toLowerCase() === normalizedCity);
  const fallbackCat = cityCaterers.length > 0 ? cityCaterers : caterersList;

  const scoredHalls = fallbackHalls.map(h => {
    const hallCap = Number(h.capacity || 0);
    const fitsCap = hallCap >= actualGuests;
    const hPrice = Number(h.price || h.priceFullDayAc || h.basePrice || 140000);
    const fitsBudget = hPrice <= (hallSlice > 0 ? hallSlice * 1.10 : Infinity);
    const valScore = Math.min(1, ((h.rating || 4.5) / 5) * (150000 / (hPrice || 150000)));
    const budgetFit = hallSlice > 0 ? Math.min(1, hPrice / hallSlice) : 0.8;
    const score = config.scoring.rating * ((h.rating || 4.5) / 5) + config.scoring.value * valScore + config.scoring.budgetFit * budgetFit + (fitsCap ? 0.5 : 0) + config.scoring.popularity * (h.popularity || 0.8);
    return {
      ...h,
      capacity: hallCap,
      price: hPrice,
      score,
      fitsPlan: fitsCap && fitsBudget,
      pickReason: fitsCap
        ? `Capacity ${hallCap} fits ${actualGuests} guests, rating ${h.rating || 4.5}.`
        : `Capacity ${hallCap} is below ${actualGuests} guests.`
    };
  }).sort((a, b) => b.score - a.score);

  const scoredCaterers = fallbackCat.map(c => {
    const effectivePrice = c.price || c.effectivePrice || targetPlate;
    const fitsBudget = effectivePrice <= (targetPlate > 0 ? targetPlate * 1.15 : Infinity);
    const valScore = Math.min(1, ((c.rating || 4.5) / 5) * (400 / (effectivePrice || 400)));
    const budgetFit = targetPlate > 0 ? Math.min(1, effectivePrice / targetPlate) : 0.8;
    const score = config.scoring.rating * ((c.rating || 4.5) / 5) + config.scoring.value * valScore + config.scoring.budgetFit * budgetFit + config.scoring.popularity * (c.popularity || 0.8);
    return {
      ...c,
      score,
      effectivePrice,
      isEstimated: c.price == null,
      fitsPlan: fitsBudget,
      pickReason: `Chosen for rating ${c.rating || 4.5}, and it fits your catering budget.`
    };
  }).sort((a, b) => b.score - a.score);

  // 9. Packages
  const packages = [
    { id: 'pkg-budget', name: 'Budget-friendly', multiplier: config.packages.budget },
    { id: 'pkg-balanced', name: 'Balanced', multiplier: config.packages.balanced },
    { id: 'pkg-premium', name: 'Premium', multiplier: config.packages.premium }
  ].map(pkg => {
    const targetH = Math.round(hallSlice * pkg.multiplier);
    const targetC = Math.round(cateringSlice * pkg.multiplier);

    const hall = scoredHalls.find(h => (h.capacity || 0) >= actualGuests && h.price <= (targetH * 1.25 || Infinity)) ||
                 scoredHalls.find(h => (h.capacity || 0) >= actualGuests) ||
                 scoredHalls[0];
    const catering = scoredCaterers.find(c => (c.effectivePrice * actualGuests) <= (targetC * 1.25 || Infinity)) || scoredCaterers[0];

    const hCost = hasHall && hall ? hall.price : 0;
    const cCost = hasCatering && catering ? (catering.effectivePrice * actualGuests) : 0;
    const totalCost = hCost + cCost;

    return {
      ...pkg,
      hall,
      catering,
      totalCost,
      remaining: Math.max(0, actualBudget - totalCost)
    };
  });

  // Estimated Cost Breakdown Object for direct UI rendering
  const durNormalized = actualDur;
  const isAcNeed = actualAc === 'ac';
  const durMult = durNormalized === 'half day' || durNormalized === 'half_day'
    ? 0.60
    : (durNormalized === 'multiple days' || durNormalized === 'multiple'
      ? (1 + 0.80 * (Math.max(1, actualDays) - 1))
      : 1.00);

  const fittingHalls = fallbackHalls.filter(h => (Number(h.capacity) || 0) >= actualGuests);
  const hallPool = fittingHalls.length > 0 ? fittingHalls : fallbackHalls;
  const sortedFitting = [...hallPool].sort((a, b) => (Number(a.capacity) - Number(b.capacity)) || (Number(a.price || a.basePrice || 0) - Number(b.price || b.basePrice || 0)));
  const bestFitHall = sortedFitting[0] || fallbackHalls[0];
  const hallBasePrice = bestFitHall ? Number(bestFitHall.price || bestFitHall.basePrice || bestFitHall.priceFullDayNonAc || 140000) : 140000;
  const computedHallCost = Math.round(hallBasePrice * (isAcNeed ? 1.30 : 1.00) * durMult);
  const minFittingPrice = Math.min(...hallPool.map(h => Math.round(Number(h.price || h.basePrice || 140000) * (isAcNeed ? 1.30 : 1.00) * durMult)), computedHallCost);
  const maxFittingPrice = Math.max(...hallPool.map(h => Math.round(Number(h.price || h.basePrice || 140000) * (isAcNeed ? 1.30 : 1.00) * durMult)), computedHallCost);

  const computedDecorCost = Dmin || 75000;
  const computedCateringCost = Cmax > 0 ? Math.round(targetPlate * actualGuests) : 0;

  const estimatedCost = {
    hall: hasHall ? {
      name: bestFitHall ? bestFitHall.name : 'Best Fit Convention Hall',
      capacity: bestFitHall ? bestFitHall.capacity : 600,
      basePrice: hallBasePrice,
      cost: computedHallCost,
      formulaText: `Base ${formatINR(hallBasePrice)} × ${isAcNeed ? 'AC 1.30' : 'Non-AC 1.00'} × ${durNormalized === 'half day' ? 'Half day 0.60' : durNormalized === 'multiple days' ? `${actualDays} days (${durMult.toFixed(2)})` : 'Full day 1.00'}`,
      rangeText: `Halls that fit ${actualGuests} guests: ${formatINR(minFittingPrice)} to ${formatINR(maxFittingPrice)}`
    } : null,
    decor: hasHall ? {
      cost: computedDecorCost,
      formulaText: `${decorLevel.charAt(0).toUpperCase() + decorLevel.slice(1)} Decoration package${actualDays > 1 ? ` (${actualDays} days)` : ''}`
    } : null,
    catering: hasCatering ? {
      targetPlate,
      cost: computedCateringCost,
      rangeText: `Plate rate: ₹${minPlate}–₹${maxPlate} per plate (${actualGuests} guests ≈ ${formatINR(Cmin)}–${formatINR(Cmax)})`
    } : null,
    subtotal: (hasHall ? computedHallCost + computedDecorCost : 0) + (hasCatering ? computedCateringCost : 0),
    budget: actualBudget,
    remaining: Math.max(0, actualBudget - ((hasHall ? computedHallCost + computedDecorCost : 0) + (hasCatering ? computedCateringCost : 0)))
  };

  return {
    status: isTooLow ? 'too_low' : 'ok',
    isUnderFloor: isTooLow,
    isCapacityExceeded: hallCapExceeded,
    maxCityCapacity: maxHallCapInCity,
    budget: actualBudget,
    usableBudget,
    usable: usableBudget,
    contingencyBuffer,
    weights,
    catering: hasCatering ? {
      plateMin: minPlate,
      plateMax: maxPlate,
      cmin: Cmin,
      cmax: Cmax,
      targetPlate,
      spend: cateringSpend
    } : null,
    hall: hasHall ? {
      hmin: Hmin,
      spend: hallSlice
    } : null,
    decor: hasHall ? {
      dmin: Dmin,
      spend: decorSlice
    } : null,
    split: [
      ...(hasCatering ? [{ service: 'catering', allocation: cateringSlice, percent: Math.round((cateringSlice / usableBudget) * 100) }] : []),
      ...(hasHall ? [{ service: 'hall', allocation: hallSlice, percent: Math.round((hallSlice / usableBudget) * 100) }] : []),
      ...(hasHall ? [{ service: 'decor', allocation: decorSlice, percent: Math.round((decorSlice / usableBudget) * 100) }] : []),
      ...(contingencyBuffer > 0 ? [{ service: 'contingency', allocation: contingencyBuffer, percent: 10 }] : [])
    ],
    savings: Math.max(0, usableBudget - (cateringSlice + hallSlice + decorSlice)),
    suggestions,
    packages,
    notes: [],
    estimatedCost,
    scoredHalls,
    scoredCaterers,
    hallAllocation: hallSlice,
    cateringAllocation: cateringSlice,
    decorAllocation: decorSlice,
    extrasAllocation: extrasSlice,
    targetPlate,
    concreteFixes,
    minRequired
  };
}

export const plannerService = {
  calculatePlan: async (input) => {
    let halls = [];
    let caterers = [];
    try {
      const rawHalls = await prisma.branch.findMany({
        where: { kind: 'hall' },
        include: { city: true, hallDetails: true, photos: true }
      });
      halls = rawHalls.map(h => ({
        id: h.id,
        name: h.name,
        city: h.city?.city || 'Kadapa',
        capacity: h.hallDetails?.capacity || 500,
        price: h.hallDetails?.priceFullDayNonAc || 50000,
        basePrice: h.hallDetails?.priceFullDayNonAc || 50000,
        priceFullDayNonAc: h.hallDetails?.priceFullDayNonAc || 50000,
        priceFullDayAc: h.hallDetails?.priceFullDayAc || 70000,
        isAC: h.hallDetails?.acMode !== 'non_ac',
        rating: h.ratingAvg || 4.5,
        ratingCount: h.ratingCount || 0
      }));

      const rawCaterers = await prisma.branch.findMany({
        where: { kind: 'catering' },
        include: { city: true, catererDetails: true, plateRates: true, photos: true }
      });
      caterers = rawCaterers.map(c => ({
        id: c.id,
        name: c.name,
        city: c.city?.city || 'Kadapa',
        rating: c.ratingAvg || 4.5,
        ratingCount: c.ratingCount || 0,
        minPlates: c.catererDetails?.minPlates || 50
      }));
    } catch (e) {
      // Fallback in case DB is offline
    }

    const raw = planEvent(input, { halls, caterers, decor: [] });
    const totalUsable = raw.usableBudget || 1;
    const catAlloc = raw.cateringAllocation || 0;
    const hallAlloc = raw.hallAllocation || 0;
    const decorAlloc = raw.decorAllocation || 0;

    return {
      ...raw,
      feasible: raw.status === 'ok',
      minRecommendedBudget: raw.isUnderFloor
        ? Math.round((raw.minRequired || raw.usableBudget * 1.5) / 0.90)
        : raw.budget,
      breakdown: {
        total: raw.budget,
        usable: raw.usableBudget,
        contingency: raw.contingencyBuffer,
        categories: {
          hall: {
            allocated: hallAlloc,
            percentage: Math.round((hallAlloc / totalUsable) * 100)
          },
          catering: {
            allocated: catAlloc,
            percentage: Math.round((catAlloc / totalUsable) * 100)
          },
          decor: {
            allocated: decorAlloc,
            percentage: Math.round((decorAlloc / totalUsable) * 100)
          }
        }
      },
      cateringTiers: {
        basic: { plateRate: raw.targetPlate ? Math.round(raw.targetPlate * 0.8) : 250 },
        standard: { plateRate: raw.targetPlate || 350 },
        premium: { plateRate: raw.targetPlate ? Math.round(raw.targetPlate * 1.3) : 500 }
      },
      recommendations: {
        hall: raw.hall ? (raw.scoredHalls || []).slice(0, 3) : [],
        catering: raw.catering ? (raw.scoredCaterers || []).slice(0, 3) : []
      },
      alerts: raw.suggestions || []
    };
  },
  planEvent
};

