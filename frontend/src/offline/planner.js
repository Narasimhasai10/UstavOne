/* OFFLINE FALLBACK PLANNER - Source of truth is backend/src/services/planner.js */
import defaultPlannerConfig from './generated/planner-config.json' with { type: 'json' };
import fallbackPlannerConfig from '../engine/config.js';

const PLANNER_CONFIG = defaultPlannerConfig || fallbackPlannerConfig;
import dummyVendors from '../data/dummyVendors.json' with { type: 'json' };

/**
 * Format currency in Indian Numbering System
 */
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

/**
 * Calculate plate price range for given parameters
 */
export function calculatePlateRange(foodCategory = 'standard', foodType = 'non-veg', nonVegPercent = 50, serving = 'buffet', cuisine = 'andhra', cityMult = 1.0, config = PLANNER_CONFIG) {
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
  } else if (typeKey === 'non-veg' || typeKey === 'nonveg' || typeKey === 'non_veg') {
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

/**
 * Pure function planEvent(input, data, config)
 * Follows the 9-step algorithm from planner-spec.md
 */
export function planEvent(input = {}, data = dummyVendors, config = PLANNER_CONFIG) {
  const {
    event = 'wedding',
    city = 'Kadapa',
    budget = 800000,
    serviceNeed = 'both', // 'both' | 'hall' | 'catering'
    guests = 600,
    plates = 600,
    date = null,
    hallCondition = 'ac', // 'ac' | 'non-ac'
    bookingDuration = 'full day', // 'half day' | 'full day' | 'multiple days'
    daysCount = 1,
    decorLevel = 'medium', // 'low' | 'medium' | 'high'
    servingStyle = 'buffet',
    foodCategory = 'standard', // 'basic' | 'standard' | 'premium' | 'luxury'
    cuisine = 'andhra',
    foodType = 'non-veg', // 'veg' | 'non-veg' | 'both'
    nonVegPercent = 50,
    cityMultiplierOverride = null,
    capsHigh = false
  } = input;

  const guestCount = Number(guests || plates || 600);
  const totalBudget = Number(budget || 800000);
  const normalizedNeed = (serviceNeed || 'both').toLowerCase();
  const hasHall = normalizedNeed === 'both' || normalizedNeed === 'hall';
  const hasCatering = normalizedNeed === 'both' || normalizedNeed === 'catering';

  const normalizedCity = (city || 'Kadapa').toLowerCase();
  const cityMult = cityMultiplierOverride != null ? cityMultiplierOverride : (config.cityMultipliers[normalizedCity] ?? 1.0);

  // 1. Usable = Budget * 0.90 (10% kept as contingency buffer)
  const usableBudget = Math.round(totalBudget * config.usableBudgetRatio);
  const contingencyBuffer = totalBudget - usableBudget;

  // 2. Catering: PlateMin and PlateMax
  let minPlate = 0;
  let maxPlate = 0;
  let Cmin = 0;
  let Cmax = 0;

  if (hasCatering) {
    const range = calculatePlateRange(foodCategory, foodType, nonVegPercent, servingStyle, cuisine, cityMult, config);
    minPlate = range.minPlate;
    maxPlate = range.maxPlate;
    Cmin = guestCount * minPlate;
    Cmax = guestCount * maxPlate;
  }

  // 3. Hall & Decor: Hmin & Dmin
  let Hmin = 0;
  let Dmin = 0;
  let hallCapExceeded = false;
  let maxHallCapInCity = 0;

  const cityHalls = (data.halls || []).filter(h => h.city.toLowerCase() === normalizedCity);
  const fallbackHalls = cityHalls.length > 0 ? cityHalls : (data.halls || []);
  maxHallCapInCity = Math.max(...fallbackHalls.map(h => h.capacity || 0), 0);

  if (hasHall) {
    if (guestCount > maxHallCapInCity && maxHallCapInCity > 0) {
      hallCapExceeded = true;
    }

    const isAcNeed = (hallCondition || 'ac').toLowerCase() === 'ac';
    const durNormalized = (bookingDuration || 'full day').toLowerCase();
    const durMult = durNormalized === 'half day' ? 0.60 : (durNormalized === 'multiple days' ? (1 + 0.80 * (Math.max(1, daysCount) - 1)) : 1.00);

    // Matching capacity >= guests, matching AC
    const matchingHalls = fallbackHalls.filter(h => (h.capacity >= guestCount * 0.8) && (isAcNeed ? h.isAC : true));
    const hallPool = matchingHalls.length > 0 ? matchingHalls : fallbackHalls;
    const baseCheapest = Math.min(...hallPool.map(h => h.price || 80000));
    Hmin = Math.round(baseCheapest * (isAcNeed ? 1.30 : 1.00) * durMult);

    // Decor Dmin
    const decorTiers = { low: 35000, medium: 75000, high: 160000 };
    const baseDecor = (decorTiers[decorLevel.toLowerCase()] || 75000) * cityMult;
    const decorDaysMult = 1 + 0.5 * (Math.max(1, daysCount) - 1);
    Dmin = Math.round(baseDecor * decorDaysMult);
  }

  // 4. Feasibility Check: Usable < Cmin + Hmin + Dmin
  const minRequired = (hasCatering ? Cmin : 0) + (hasHall ? (Hmin + Dmin) : 0);
  const isTooLow = usableBudget < minRequired;

  const concreteFixes = [];
  if (isTooLow) {
    if (hasHall && (hallCondition || 'ac').toLowerCase() === 'ac') {
      const nonAcHmin = Math.round(Hmin / 1.30);
      const savings = Hmin - nonAcHmin;
      concreteFixes.push({
        type: 'switch_non_ac',
        text: `Non-AC saves ${formatINR(savings)}`,
        action: { hallCondition: 'non-ac' }
      });
    }
    if (hasCatering && foodCategory.toLowerCase() !== 'basic') {
      const basicRange = calculatePlateRange('basic', foodType, nonVegPercent, servingStyle, cuisine, cityMult, config);
      const basicCmin = guestCount * basicRange.minPlate;
      const savings = Cmin - basicCmin;
      concreteFixes.push({
        type: 'lower_food_category',
        text: `A lower food category saves ${formatINR(savings)}`,
        action: { foodCategory: 'basic' }
      });
    }
    const perGuestCost = (hasCatering ? minPlate : 0) + (hasHall ? ((Hmin + Dmin) / guestCount) : 0);
    const maxSupportedGuests = Math.max(10, Math.floor(usableBudget / (perGuestCost || 1)));
    concreteFixes.push({
      type: 'reduce_guests',
      text: `Your budget supports up to ${maxSupportedGuests} guests`,
      action: { guests: maxSupportedGuests }
    });
  }

  // 5. Weights Calculation
  let weights = { catering: 0, hall: 0, decor: 0 };
  if (normalizedNeed === 'both') {
    weights = { ...config.baseWeights.both };
  } else if (normalizedNeed === 'hall') {
    weights = { ...config.baseWeights.hall, catering: 0 };
  } else {
    weights = { ...config.baseWeights.catering, hall: 0, decor: 0 };
  }

  // Adjustments
  if (hasHall) {
    if ((hallCondition || 'ac').toLowerCase() === 'ac') {
      weights.hall += config.adjustments.acHall; // +3
    }
    if ((bookingDuration || '').toLowerCase() === 'half day') {
      weights.hall += config.adjustments.halfDayHall; // -5
    } else if ((bookingDuration || '').toLowerCase() === 'multiple days') {
      const extraDays = Math.max(0, daysCount - 1);
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

  // Initial Slices
  let cateringSlice = hasCatering ? Math.round(usableBudget * (weights.catering / sumWeights)) : 0;
  let hallSlice = hasHall ? Math.round(usableBudget * (weights.hall / sumWeights)) : 0;
  let decorSlice = hasHall ? Math.round(usableBudget * (weights.decor / sumWeights)) : 0;

  // 6. Clamp catering
  let cateringClamped = false;
  let cateringSpend = cateringSlice;
  let excess = 0;
  let extrasSlice = 0;

  if (hasCatering && normalizedNeed === 'both') {
    if (cateringSlice > Cmax) {
      cateringSpend = Cmax;
      excess = cateringSlice - Cmax;
      cateringClamped = true;

      // Distribute excess to hall and decoration in proportion to their weights
      const hallDecorSum = weights.hall + weights.decor || 1;
      const hallAdd = Math.round(excess * (weights.hall / hallDecorSum));
      const decorAdd = excess - hallAdd;

      hallSlice += hallAdd;
      decorSlice += decorAdd;
      cateringSlice = cateringSpend;
    } else if (cateringSlice < Cmin) {
      cateringSpend = Cmin;
    }
  } else if (hasCatering && normalizedNeed === 'catering') {
    cateringSpend = Math.min(cateringSlice, Cmax > 0 ? Cmax : cateringSlice);
    excess = Math.max(0, cateringSlice - cateringSpend);
    cateringSlice = cateringSpend;
    extrasSlice = excess;
  }

  // Target plate
  let targetPlate = maxPlate;
  if (Cmax > Cmin) {
    const t = Math.max(0, Math.min(1, (cateringSpend - Cmin) / (Cmax - Cmin)));
    targetPlate = Math.round(minPlate + t * (maxPlate - minPlate));
  } else {
    targetPlate = minPlate;
  }

  // 7. Suggestions (Upgrade / Downgrade)
  const suggestions = [];
  if (hasCatering) {
    const cats = ['basic', 'standard', 'premium', 'luxury'];
    const currentIdx = cats.indexOf(foodCategory.toLowerCase());
    const capCat = foodCategory.charAt(0).toUpperCase() + foodCategory.slice(1).toLowerCase();
    const capType = foodType === 'non-veg' ? 'Non-Veg' : (foodType === 'veg' ? 'Veg' : 'Both');

    if (currentIdx >= 0 && currentIdx < cats.length - 1) {
      const nextCat = cats[currentIdx + 1];
      const nextCapCat = nextCat.charAt(0).toUpperCase() + nextCat.slice(1).toLowerCase();
      const nextRange = calculatePlateRange(nextCat, foodType, nonVegPercent, servingStyle, cuisine, cityMult, config);
      suggestions.push({
        type: 'upgrade_food',
        text: `Your food budget reaches the top of ${capCat} ${capType} (₹${targetPlate} per plate). ${nextCapCat} ${capType} would cost ₹${nextRange.minPlate}-${nextRange.maxPlate} per plate, if you want to upgrade by reducing the hall or decoration budget.`,
        nextCategory: nextCat
      });
    }
  }

  // 8. Filter & Rank Vendors
  const cityCaterers = (data.caterers || []).filter(c => c.city.toLowerCase() === normalizedCity);
  const fallbackCat = cityCaterers.length > 0 ? cityCaterers : (data.caterers || []);

  const scoredHalls = fallbackHalls.map(h => {
    const hallCap = Number(h.capacity || 0);
    const fitsCap = hallCap >= guestCount;
    const fitsBudget = h.price <= (hallSlice > 0 ? hallSlice * 1.10 : Infinity);
    const valScore = Math.min(1, (h.rating / 5) * (150000 / (h.price || 150000)));
    const budgetFit = hallSlice > 0 ? Math.min(1, h.price / hallSlice) : 0.8;
    const score = config.scoring.rating * (h.rating / 5) + config.scoring.value * valScore + config.scoring.budgetFit * budgetFit + (fitsCap ? 0.5 : 0) + config.scoring.popularity * (h.popularity || 0.8);
    return {
      ...h,
      capacity: hallCap,
      score,
      fitsPlan: fitsCap && fitsBudget,
      pickReason: fitsCap
        ? `Capacity ${hallCap} fits ${guestCount} guests, rating ${h.rating}.`
        : `Capacity ${hallCap} is below ${guestCount} guests.`
    };
  }).sort((a, b) => b.score - a.score);

  const scoredCaterers = fallbackCat.map(c => {
    const effectivePrice = c.price || targetPlate;
    const fitsBudget = effectivePrice <= (targetPlate > 0 ? targetPlate * 1.15 : Infinity);
    const valScore = Math.min(1, (c.rating / 5) * (400 / (effectivePrice || 400)));
    const budgetFit = targetPlate > 0 ? Math.min(1, effectivePrice / targetPlate) : 0.8;
    const score = config.scoring.rating * (c.rating / 5) + config.scoring.value * valScore + config.scoring.budgetFit * budgetFit + config.scoring.popularity * (c.popularity || 0.8);
    return {
      ...c,
      score,
      effectivePrice,
      isEstimated: c.price == null,
      fitsPlan: fitsBudget,
      pickReason: `Chosen for rating ${c.rating}, and it fits your catering budget.`
    };
  }).sort((a, b) => b.score - a.score);

  // 9. Build 3 Packages (Budget-friendly ~70%, Balanced ~90%, Premium 100-110%)
  const packages = [
    {
      id: 'pkg-budget',
      name: 'Budget-friendly',
      multiplier: config.packages.budget,
      recommended: false
    },
    {
      id: 'pkg-balanced',
      name: 'Balanced',
      multiplier: config.packages.balanced,
      recommended: true
    },
    {
      id: 'pkg-premium',
      name: 'Premium',
      multiplier: config.packages.premium,
      recommended: false
    }
  ].map(pkg => {
    const targetHall = Math.round(hallSlice * pkg.multiplier);
    const targetCatering = Math.round(cateringSlice * pkg.multiplier);
    const targetDecor = Math.round(decorSlice * pkg.multiplier);

    const hall = scoredHalls.find(h => (h.capacity || 0) >= guestCount && h.price <= (targetHall * 1.25 || Infinity)) ||
                 scoredHalls.find(h => (h.capacity || 0) >= guestCount) ||
                 scoredHalls[0];
    const catering = scoredCaterers.find(c => (c.effectivePrice * guestCount) <= (targetCatering * 1.25 || Infinity)) || scoredCaterers[0];

    const hCost = hasHall && hall ? hall.price : 0;
    const cCost = hasCatering && catering ? (catering.effectivePrice * guestCount) : 0;
    const dCost = hasHall ? targetDecor : 0;

    const totalPackageCost = hCost + cCost + dCost;
    const remaining = Math.max(0, totalBudget - totalPackageCost);

    return {
      id: pkg.id,
      name: pkg.name,
      recommended: pkg.recommended,
      totalCost: totalPackageCost,
      remaining,
      vendors: {
        ...(hasHall && hall ? { hall } : {}),
        ...(hasCatering && catering ? { catering } : {})
      }
    };
  });

  // 10. Estimated Cost Breakdown for User's Answers (Section D)
  const isAcNeed = (hallCondition || 'ac').toLowerCase() === 'ac';
  const durNormalized = (bookingDuration || 'full day').toLowerCase();
  const durMult = durNormalized === 'half day' ? 0.60 : (durNormalized === 'multiple days' ? (1 + 0.80 * (Math.max(1, daysCount) - 1)) : 1.00);

  // Best fit hall matching capacity >= guestCount
  const fittingHalls = fallbackHalls.filter(h => (h.capacity || 0) >= guestCount);
  const hallPool = fittingHalls.length > 0 ? fittingHalls : fallbackHalls;
  // Sort by smallest fitting capacity first (best fit), then price
  const sortedFitting = [...hallPool].sort((a, b) => (a.capacity - b.capacity) || (a.price - b.price));
  const bestFitHall = sortedFitting[0] || fallbackHalls[0];

  const hallBasePrice = bestFitHall ? (bestFitHall.price || 140000) : 140000;
  const computedHallCost = Math.round(hallBasePrice * (isAcNeed ? 1.30 : 1.00) * durMult);
  const minFittingPrice = Math.min(...hallPool.map(h => Math.round((h.price || 140000) * (isAcNeed ? 1.30 : 1.00) * durMult)));
  const maxFittingPrice = Math.max(...hallPool.map(h => Math.round((h.price || 140000) * (isAcNeed ? 1.30 : 1.00) * durMult)));

  const computedDecorCost = Dmin || 75000;
  const computedCateringCost = hasCatering ? Math.round(guestCount * targetPlate) : 0;

  const totalEstimatedCost = (hasHall ? computedHallCost + computedDecorCost : 0) + (hasCatering ? computedCateringCost : 0);
  const costRemaining = totalBudget - totalEstimatedCost;
  const isOverBudget = totalEstimatedCost > totalBudget;

  const estimatedCost = {
    hall: hasHall ? {
      name: bestFitHall ? bestFitHall.name : 'Best Fit Convention Hall',
      capacity: bestFitHall ? bestFitHall.capacity : 600,
      basePrice: hallBasePrice,
      cost: computedHallCost,
      formulaText: `Base ${formatINR(hallBasePrice)} × ${isAcNeed ? 'AC 1.30' : 'Non-AC 1.00'} × ${durNormalized === 'half day' ? 'Half day 0.60' : durNormalized === 'multiple days' ? `${daysCount} days (${durMult.toFixed(2)})` : 'Full day 1.00'}`,
      rangeText: `Halls that fit ${guestCount} guests: ${formatINR(minFittingPrice)} to ${formatINR(maxFittingPrice)}`
    } : null,
    decor: hasHall ? {
      level: decorLevel.charAt(0).toUpperCase() + decorLevel.slice(1).toLowerCase(),
      daysCount: Math.max(1, daysCount),
      cost: computedDecorCost,
      formulaText: `${decorLevel.charAt(0).toUpperCase() + decorLevel.slice(1).toLowerCase()} decoration (${daysCount > 1 ? `${daysCount} days` : '1 day'})`
    } : null,
    catering: hasCatering ? {
      minPlate,
      maxPlate,
      targetPlate,
      minTotal: Cmin,
      maxTotal: Cmax,
      cost: computedCateringCost,
      formulaText: `${guestCount} guests × ₹${targetPlate} per plate (${foodCategory} ${foodType})`,
      rangeText: `₹${minPlate} to ₹${maxPlate} per plate (estimated): ${formatINR(Cmin)} to ${formatINR(Cmax)}`
    } : null,
    subtotal: totalEstimatedCost,
    budget: totalBudget,
    remaining: costRemaining,
    isOverBudget,
    overBy: Math.max(0, totalEstimatedCost - totalBudget)
  };

  return {
    status: isTooLow ? 'too_low' : 'ok',
    isUnderFloor: isTooLow,
    isCapacityExceeded: hallCapExceeded,
    maxCityCapacity: maxHallCapInCity,
    budget: totalBudget,
    usableBudget,
    contingencyBuffer,
    weights,
    minPlate,
    maxPlate,
    targetPlate,
    Cmin,
    Cmax,
    Hmin,
    Dmin,
    cateringClamped,
    cateringCost: cateringSpend,
    cateringAllocation: cateringSlice,
    hallAllocation: hallSlice,
    decorAllocation: decorSlice,
    extrasAllocation: extrasSlice,
    concreteFixes,
    suggestions,
    packages,
    scoredHalls,
    scoredCaterers,
    estimatedCost
  };
}
