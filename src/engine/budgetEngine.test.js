import test from 'node:test';
import assert from 'node:assert/strict';
import { planEvent, calculatePlatePriceRange, formatINR, formatLakhCrore } from './budgetEngine.js';

test('1. Worked Example from Spec: Rs 8,00,000, Both, 600 guests, AC, Full day, Medium decor, Buffet, Standard, Andhra, Non-Veg', () => {
  const result = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    plates: 600,
    hallCondition: 'ac',
    bookingDuration: 'full-day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    dietary: 'non-veg'
  });

  // Usable Rs 7,20,000 (90% of Rs 8L)
  assert.equal(result.usableBudget, 720000, 'Usable budget must be exactly 90% of total budget (Rs 7,20,000)');
  assert.equal(result.contingencyBuffer, 80000, 'Contingency buffer must be 10% (Rs 80,000)');

  // Plate Rs 315-420 (Buffet 1.05 x Standard 300-400)
  assert.equal(result.minPlate, 315, 'Min plate price must be Rs 315');
  assert.equal(result.maxPlate, 420, 'Max plate price must be Rs 420');

  // Catering clamped at Rs 2,52,000 (600 guests x Rs 420)
  assert.equal(result.cateringClamped, true, 'Catering should be clamped because 600 x 420 (2.52L) <= 40% of 7.2L (2.88L)');
  assert.equal(result.cateringCost, 252000, 'Catering cost must be clamped at Rs 2,52,000');

  // Hall about Rs 2,82,286 and Decoration about Rs 1,85,714
  assert.ok(
    Math.abs(result.hallAllocation - 282286) <= 2,
    `Hall allocation (${result.hallAllocation}) should be about Rs 2,82,286`
  );
  assert.ok(
    Math.abs(result.decorAllocation - 185714) <= 2,
    `Decoration allocation (${result.decorAllocation}) should be about Rs 1,85,714`
  );

  // Sum of allocations must exactly equal usable budget (Rs 7,20,000)
  const sumAllocations = result.cateringAllocation + result.hallAllocation + result.decorAllocation;
  assert.equal(sumAllocations, 720000, 'Sum of catering, hall, and decor must equal usable budget (Rs 7,20,000)');

  // Generates 3 packages (Budget, Best Value, Premium)
  assert.equal(result.packages.length, 3, 'Must generate 3 packages');
  const [budgetPkg, bestValPkg, premiumPkg] = result.packages;
  assert.equal(budgetPkg.name, 'Budget');
  assert.equal(bestValPkg.name, 'Best Value');
  assert.equal(bestValPkg.recommended, true);
  assert.equal(premiumPkg.name, 'Premium');
});

test('2. Budget Too Low Detection: flags when budget is below minimum viable floor', () => {
  const lowBudget = 25000;
  const result = planEvent({
    event: 'wedding',
    city: 'Kadapa',
    budget: lowBudget,
    guests: 600,
    serviceNeed: 'both'
  });

  assert.equal(result.isUnderFloor, true, 'Should detect budget is below floor');
  assert.ok(result.minimumViableFloor > lowBudget, 'Floor should exceed low budget');
  assert.ok(
    result.notes.some(n => n.includes('minimum required')),
    'Notes must include minimum required budget advice'
  );
});

test('3. No Vendors in City: graceful fallback to global catalog without crashing', () => {
  const result = planEvent({
    event: 'birthday',
    city: 'NonExistentCity123',
    budget: 500000,
    guests: 150,
    serviceNeed: 'both'
  });

  assert.equal(result.packages.length, 3, 'Should generate packages using fallback vendors');
  assert.ok(result.packages[0].vendors.hall, 'Hall vendor should be present via fallback');
  assert.ok(result.packages[0].vendors.catering, 'Catering vendor should be present via fallback');
});

test('4. One Service Only: Hall Only & Catering Only splits', () => {
  // Hall only
  const hallOnly = planEvent({
    event: 'corporate',
    city: 'Hyderabad',
    budget: 400000,
    serviceNeed: 'hall',
    hallCondition: 'ac'
  });

  assert.equal(hallOnly.cateringAllocation, 0, 'Catering allocation must be 0 for hall-only');
  assert.ok(hallOnly.hallAllocation > 0, 'Hall allocation must be greater than 0');
  assert.ok(hallOnly.decorAllocation > 0, 'Decor allocation must be greater than 0');
  assert.equal(hallOnly.packages[0].vendors.catering, undefined, 'Catering vendor must not be selected in hall-only');
  assert.ok(hallOnly.packages[0].vendors.hall, 'Hall vendor must be selected in hall-only');

  // Catering only
  const cateringOnly = planEvent({
    event: 'reception',
    city: 'Vijayawada',
    budget: 300000,
    serviceNeed: 'catering',
    guests: 300,
    foodCategory: 'standard'
  });

  assert.equal(cateringOnly.hallAllocation, 0, 'Hall allocation must be 0 for catering-only');
  assert.ok(cateringOnly.cateringAllocation > 0, 'Catering allocation must be greater than 0');
  assert.equal(cateringOnly.packages[0].vendors.hall, undefined, 'Hall vendor must not be selected in catering-only');
  assert.ok(cateringOnly.packages[0].vendors.catering, 'Catering vendor must be selected in catering-only');
});

test('5. Guests Above Capacity Detection: flags when attendance exceeds city venue capacities', () => {
  const result = planEvent({
    event: 'educational',
    city: 'Kadapa', // In Kadapa, max hall capacity is 1200
    budget: 1500000,
    guests: 5000, // 5000 students exceeds all halls
    serviceNeed: 'hall'
  });

  assert.equal(result.isCapacityExceeded, true, 'Must flag capacity exceeded when guests > 1200 in Kadapa');
  assert.ok(
    result.notes.some(n => n.includes('exceeds the maximum single hall capacity')),
    'Notes should recommend lawn extension or multiple shifts'
  );
});

test('6. Missing Price ("Estimated" Flag): correctly propagates isEstimated boolean', () => {
  const result = planEvent({
    event: 'birthday',
    city: 'Kadapa',
    budget: 300000,
    guests: 200,
    serviceNeed: 'both'
  });

  const bestVal = result.packages.find(p => p.name === 'Best Value');
  assert.ok(bestVal, 'Best value package must exist');
  assert.ok(typeof bestVal.vendors.hall.isEstimated === 'boolean', 'Hall vendor must contain isEstimated boolean');
  assert.ok(typeof bestVal.vendors.catering.isEstimated === 'boolean', 'Catering vendor must contain isEstimated boolean');
});
