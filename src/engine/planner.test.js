import test from 'node:test';
import assert from 'node:assert/strict';
import { planEvent, calculatePlateRange, formatINR, formatLakh } from './planner.js';
import dummyVendors from '../data/dummyVendors.json' with { type: 'json' };
import PLANNER_CONFIG from './config.js';

test('1. Worked Example from Spec: Budget Rs 8,00,000, Both, 600 guests, AC, Full day, Medium decor, Buffet, Standard, Andhra, Non-Veg, city multiplier 1.0', () => {
  const result = planEvent({
    event: 'wedding',
    city: 'Vijayawada', // Vijayawada has multiplier 1.0
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    plates: 600,
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg',
    cityMultiplierOverride: 1.0,
    capsHigh: true
  }, dummyVendors, PLANNER_CONFIG);

  // Usable = 8,00,000 * 0.90 = 7,20,000
  assert.equal(result.usableBudget, 720000, 'Usable budget must be exactly 90% of total budget (Rs 7,20,000)');

  // Plate range: Standard Non-Veg 300-400 x Buffet 1.05 x Andhra 1.00 = 315 to 420
  assert.equal(result.minPlate, 315, 'Min plate price must be Rs 315');
  assert.equal(result.maxPlate, 420, 'Max plate price must be Rs 420');

  // Cmin = 600 * 315 = 1,89,000; Cmax = 600 * 420 = 2,52,000
  assert.equal(result.Cmin, 189000, 'Cmin must be Rs 1,89,000');
  assert.equal(result.Cmax, 252000, 'Cmax must be Rs 2,52,000');

  // Weights: Catering 40, Hall 35 + 3 (AC) = 38, Decor 25 (total 103)
  assert.equal(result.weights.catering, 40, 'Catering weight must be 40');
  assert.equal(result.weights.hall, 38, 'Hall weight must be 38 (35 + 3 AC)');
  assert.equal(result.weights.decor, 25, 'Decor weight must be 25');

  // Catering slice: 7,20,000 * 40 / 103 ≈ 2,79,612, which is clamped to Cmax (2,52,000)
  assert.equal(result.cateringClamped, true, 'Catering slice must be clamped to Cmax');
  assert.equal(result.cateringAllocation, 252000, 'Catering allocation must be clamped to Rs 2,52,000');

  // Remaining usable: 7,20,000 - 2,52,000 = 4,68,000
  // Hall: 4,68,000 * 38 / 63 ≈ 2,82,286
  // Decor: 4,68,000 * 25 / 63 ≈ 1,85,714
  assert.ok(
    Math.abs(result.hallAllocation - 282286) <= 2,
    `Hall allocation (${result.hallAllocation}) should be about Rs 2,82,286`
  );
  assert.ok(
    Math.abs(result.decorAllocation - 185714) <= 2,
    `Decor allocation (${result.decorAllocation}) should be about Rs 1,85,714`
  );

  // Sum of allocations must equal usable budget (Rs 7,20,000)
  const sum = result.cateringAllocation + result.hallAllocation + result.decorAllocation;
  assert.equal(sum, 720000, 'Sum of allocations must equal usable budget (Rs 7,20,000)');

  // Upgrade message appears
  assert.ok(result.suggestions.length > 0, 'Should suggest upgrade to next category');
  assert.ok(result.suggestions[0].text.includes('Standard Non-Veg'), 'Should mention current standard non-veg');
  assert.ok(result.suggestions[0].text.includes('Premium Non-Veg'), 'Should mention premium non-veg upgrade');
});

test('2. Budget Too Low Detection & Concrete Fixes: returns status "too_low" and concrete actions', () => {
  const lowBudget = 30000;
  const result = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: lowBudget,
    guests: 600,
    serviceNeed: 'both',
    hallCondition: 'ac',
    foodCategory: 'standard'
  }, dummyVendors, PLANNER_CONFIG);

  assert.equal(result.status, 'too_low', 'Status must be "too_low"');
  assert.equal(result.isUnderFloor, true, 'isUnderFloor must be true');
  assert.ok(result.concreteFixes.length >= 2, 'Must provide concrete fix options');
  assert.ok(result.concreteFixes.some(f => f.text.includes('Non-AC saves') || f.text.includes('category saves') || f.text.includes('supports up to')), 'Must include specific savings advice');
});

test('3. Only Hall Selected: catering allocation is 0 and only halls scored', () => {
  const result = planEvent({
    event: 'corporate',
    city: 'Hyderabad',
    budget: 500000,
    serviceNeed: 'hall',
    hallCondition: 'ac',
    guests: 300
  }, dummyVendors, PLANNER_CONFIG);

  assert.equal(result.cateringAllocation, 0, 'Catering allocation must be 0');
  assert.ok(result.hallAllocation > 0, 'Hall allocation must be greater than 0');
  assert.ok(result.decorAllocation > 0, 'Decor allocation must be greater than 0');
  assert.equal(result.packages[0].vendors.catering, undefined, 'Package must not include catering vendor');
  assert.ok(result.packages[0].vendors.hall, 'Package must include hall vendor');
});

test('4. Only Catering Selected: hall and decor allocations are 0 and only caterers scored', () => {
  const result = planEvent({
    event: 'birthday',
    city: 'Guntur',
    budget: 200000,
    serviceNeed: 'catering',
    guests: 200,
    foodCategory: 'standard',
    servingStyle: 'buffet'
  }, dummyVendors, PLANNER_CONFIG);

  assert.equal(result.hallAllocation, 0, 'Hall allocation must be 0');
  assert.equal(result.decorAllocation, 0, 'Decor allocation must be 0');
  assert.ok(result.cateringAllocation > 0, 'Catering allocation must be greater than 0');
  assert.equal(result.packages[0].vendors.hall, undefined, 'Package must not include hall vendor');
  assert.ok(result.packages[0].vendors.catering, 'Package must include catering vendor');
});

test('5. Multi-Day Weights: +4 to hall per day beyond 1 (max +12)', () => {
  // 1 day
  const res1 = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: 1000000,
    serviceNeed: 'both',
    bookingDuration: 'full day',
    daysCount: 1,
    hallCondition: 'non-ac'
  }, dummyVendors, PLANNER_CONFIG);

  // 3 days: extraDays = 2 -> +8 to hall
  const res3 = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: 1000000,
    serviceNeed: 'both',
    bookingDuration: 'multiple days',
    daysCount: 3,
    hallCondition: 'non-ac'
  }, dummyVendors, PLANNER_CONFIG);

  // 6 days: extraDays = 5 -> 5 * 4 = 20, but capped at +12
  const res6 = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: 1000000,
    serviceNeed: 'both',
    bookingDuration: 'multiple days',
    daysCount: 6,
    hallCondition: 'non-ac'
  }, dummyVendors, PLANNER_CONFIG);

  assert.equal(res1.weights.hall, 35, '1 day non-ac hall weight is 35');
  assert.equal(res3.weights.hall, 35 + 8, '3 days non-ac hall weight is 35 + 8 = 43');
  assert.equal(res6.weights.hall, 35 + 12, '6 days non-ac hall weight is capped at 35 + 12 = 47');
});

test('6. Missing Price ("Estimated" Label): correctly identifies estimated price when listed price is null', () => {
  const result = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: 800000,
    serviceNeed: 'both',
    guests: 400
  }, dummyVendors, PLANNER_CONFIG);

  const estimatedCaterers = result.scoredCaterers.filter(c => c.isEstimated);
  assert.ok(estimatedCaterers.length > 0, 'Should have caterers with estimated prices');
  assert.ok(estimatedCaterers[0].effectivePrice > 0, 'Estimated caterers should have effective target plate price');
});

test('7. Section D Unit Test: changing guests from 600 to 100 drops catering total proportionally and changes hall to capacity >= 100', () => {
  const plan600 = planEvent({
    event: 'wedding',
    city: 'Vijayawada',
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    hallCondition: 'ac',
    bookingDuration: 'full day',
    foodCategory: 'standard',
    foodType: 'veg',
    servingStyle: 'buffet',
    cuisine: 'andhra',
    cityMultiplierOverride: 1.0
  }, dummyVendors, PLANNER_CONFIG);

  const plan100 = planEvent({
    event: 'wedding',
    city: 'Vijayawada',
    budget: 800000,
    serviceNeed: 'both',
    guests: 100,
    hallCondition: 'ac',
    bookingDuration: 'full day',
    foodCategory: 'standard',
    foodType: 'veg',
    servingStyle: 'buffet',
    cuisine: 'andhra',
    cityMultiplierOverride: 1.0
  }, dummyVendors, PLANNER_CONFIG);

  // Example test (city multiplier 1.0): Standard, Veg, Buffet, Andhra -> 210 to 315 per plate
  assert.equal(plan600.minPlate, 210, 'Min plate must be 210 for standard veg buffet andhra');
  assert.equal(plan600.maxPlate, 315, 'Max plate must be 315 for standard veg buffet andhra');

  // 600 guests: 600 * 210 = 1,26,000 to 600 * 315 = 1,89,000
  assert.equal(plan600.Cmin, 126000, '600 guests Cmin must be 1,26,000');
  assert.equal(plan600.Cmax, 189000, '600 guests Cmax must be 1,89,000');

  // 100 guests: 100 * 210 = 21,000 to 100 * 315 = 31,500
  assert.equal(plan100.Cmin, 21000, '100 guests Cmin must be 21,000');
  assert.equal(plan100.Cmax, 31500, '100 guests Cmax must be 31,500');

  // Catering drops proportionally (exactly 6x drop)
  assert.equal(plan600.Cmin / plan100.Cmin, 6, 'Catering min drops exactly 6x');
  assert.equal(plan600.Cmax / plan100.Cmax, 6, 'Catering max drops exactly 6x');

  // Hall capacity check: 100 guests picks smaller hall (capacity >= 100), 600 guests picks hall with capacity >= 600
  assert.ok(plan100.estimatedCost.hall.capacity >= 100, 'Hall capacity for 100 guests must be >= 100');
  assert.ok(plan600.estimatedCost.hall.capacity >= 600, 'Hall capacity for 600 guests must be >= 600');
  assert.ok(plan100.estimatedCost.hall.capacity <= plan600.estimatedCost.hall.capacity, '100 guests picks smaller or equal capacity hall than 600 guests');
});

