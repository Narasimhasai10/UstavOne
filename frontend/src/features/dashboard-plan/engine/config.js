// Chat Transport Configuration: 'local' (browser-store based) | 'backend' (HTTP + Socket.IO)
export const CHAT_TRANSPORT = 'local';

// Planner Configuration & Pricing Constants
export const PLANNER_CONFIG = {
  usableBudgetRatio: 0.90, // 10% kept as contingency buffer

  // Plate Price Table (₹ per plate, min-max)
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

  // Multipliers & Factors
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
      'multi-cuisine': 1.20
    },
    hallCondition: {
      'non-ac': 1.00,
      'ac': 1.30
    },
    duration: {
      'half day': 0.60,
      'full day': 1.00
    }
  },

  // City Multipliers
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

  // Base Weights (for Both: Catering 40, Hall 35, Decoration 25)
  baseWeights: {
    both: { catering: 40, hall: 35, decor: 25 },
    hall: { hall: 60, decor: 40 },
    catering: { catering: 100 }
  },

  // Weight Adjustments
  adjustments: {
    acHall: 3,
    extraDayPerDay: 4, // Max +12 for multi-day
    maxExtraDayHallAdjustment: 12,
    halfDayHall: -5,
    decorHigh: 8,
    decorLow: -5,
    tableServiceCatering: 2
  },

  // Scoring Weights
  scoring: {
    rating: 0.40,
    value: 0.30,
    budgetFit: 0.20,
    popularity: 0.10
  },

  // Package Target Percentages of each slice
  packages: {
    budget: 0.70,
    balanced: 0.90,
    premium: 1.05
  },

  // i18n Dictionary
  i18n: {
    en: {
      savedSuccessfully: 'Saved ✓',
      linkCopied: 'Link copied ✓',
      budgetTooLow: 'Your budget is too low for the selected options.',
      largestHallFits: (city, cap) => `Largest hall in ${city} fits ${cap} guests; try another city or split the event.`,
      pickReason: (rating, service) => `Chosen for rating ${rating}, and it fits your ${service} budget.`,
      upgradeSuggestion: (cat, plate, nextCat, minP, maxP) =>
        `Your food budget reaches the top of ${cat} (₹${plate} per plate). ${nextCat} would cost ₹${minP}-${maxP} per plate, if you want to upgrade by reducing the hall or decoration budget.`,
      downgradeSuggestion: (cat, minP, maxP) =>
        `Your food budget is at the minimum of ${cat} (₹${minP}-${maxP}). Consider standard or basic to save for a larger hall.`
    },
    te: {},
    hi: {}
  },

  // Vendor Portal Configuration
  vendor: {
    commissionRate: 0.10, // 10% Utsavora commission
    warningLimit: 3, // 3 contact violations flags account
    maxPhotosPerBranch: 12,
    maxFileSizeMB: 5,
    minImageWidthPx: 600,
    geminiApiKey: '' // Optional free-tier Gemini API key hook for document vision
  }
};

export const VENDOR_CONFIG = PLANNER_CONFIG.vendor;

export default PLANNER_CONFIG;
