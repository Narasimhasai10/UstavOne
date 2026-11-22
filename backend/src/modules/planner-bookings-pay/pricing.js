import { DEFAULT_PLANNER_CONFIG, calculatePlateRange } from './planner.js';
import { config } from '../../config.js';

export function calculateBookingQuote({
  kind = 'hall',
  guests = 600,
  branch,
  hallDetails,
  catererDetails,
  plateRate,
  options = {},
  cityMult = 1.0,
  plannerConfig = DEFAULT_PLANNER_CONFIG
}) {
  const {
    acMode = 'ac',
    days = 1,
    duration = 'full_day',
    decorLevel = 'medium',
    servingStyle = 'buffet',
    foodCategory = 'standard',
    cuisine = 'andhra',
    foodType = 'non-veg',
    nonVegPct = 50
  } = options;

  let hallCost = 0;
  let cateringCost = 0;
  let decorCost = 0;
  const isEstimated = {
    hall: false,
    catering: false
  };

  const durDays = Math.max(1, Number(days || 1));
  const isAc = acMode === 'ac';
  const durMult = duration === 'half_day' || duration === 'half day'
    ? 0.60
    : (durDays > 1 ? (1 + 0.80 * (durDays - 1)) : 1.00);

  // 1. Hall Cost
  if (kind === 'hall' || kind === 'both') {
    let basePrice = 85000;
    if (hallDetails) {
      basePrice = isAc ? (hallDetails.priceFullDayAc || Math.round(hallDetails.priceFullDayNonAc * 1.3)) : hallDetails.priceFullDayNonAc;
      hallCost = Math.round(basePrice * durMult);
    } else if (branch && branch.price) {
      basePrice = branch.price;
      hallCost = Math.round(basePrice * (isAc ? 1.3 : 1.0) * durMult);
    } else {
      isEstimated.hall = true;
      hallCost = Math.round(120000 * (isAc ? 1.3 : 1.0) * durMult * cityMult);
    }

    // Decor Cost
    const decorTiers = { low: 35000, medium: 75000, high: 160000 };
    const baseDecor = (decorTiers[decorLevel.toLowerCase()] || 75000) * cityMult;
    const decorDaysMult = 1 + 0.5 * (durDays - 1);
    decorCost = Math.round(baseDecor * decorDaysMult);
  }

  // 2. Catering Cost
  if (kind === 'catering' || kind === 'both') {
    let ratePerPlate = 0;
    if (plateRate && plateRate.price) {
      ratePerPlate = plateRate.price;
    } else {
      isEstimated.catering = true;
      const range = calculatePlateRange(foodCategory, foodType, nonVegPct, servingStyle, cuisine, cityMult, plannerConfig);
      ratePerPlate = range.minPlate; // conservative base estimate
    }
    cateringCost = Math.round(ratePerPlate * Number(guests || 100));
  }

  const subtotal = hallCost + decorCost + cateringCost;
  const gstPercent = config.gstPercent || 18;
  const commissionRate = config.commissionRate || 10;

  const gst = Math.round((subtotal * gstPercent) / 100);
  const total = subtotal + gst;
  const commission = Math.round((subtotal * commissionRate) / 100);
  const vendorPayout = subtotal - commission;

  return {
    kind,
    subtotal,
    gst,
    total,
    commission,
    vendorPayout,
    priceBreakdown: {
      hallCost,
      decorCost,
      cateringCost,
      subtotal,
      gst,
      total,
      commission,
      vendorPayout,
      isEstimated,
      formula: {
        guests,
        days: durDays,
        duration,
        acMode,
        decorLevel,
        servingStyle,
        foodCategory,
        cuisine,
        foodType,
        nonVegPct
      }
    }
  };
}

export const pricingService = {
  calculateQuote: ({ branch, startDate, endDate, slot = 'full_day', guests = 100, options = {} }) => {
    let days = 1;
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffTime = Math.abs(e - s);
      days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }

    const mergedOptions = {
      days,
      duration: slot,
      ...options
    };

    const res = calculateBookingQuote({
      kind: branch?.kind || 'hall',
      guests: Number(guests) || 100,
      branch,
      hallDetails: branch?.hallDetails,
      catererDetails: branch?.catererDetails,
      options: mergedOptions,
      cityMult: branch?.city?.priceMultiplier || 1.0
    });

    return {
      subtotal: res.subtotal,
      gst: res.gst,
      total: res.total,
      commission: res.commission,
      vendorPayout: res.vendorPayout,
      breakdown: res.priceBreakdown
    };
  }
};

