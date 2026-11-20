import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  seedTestAccount,
  getCurrentUser,
  setCurrentUser,
  updateUserProfile,
  changeUserPassword,
  getUserBookings,
  saveUserBooking,
  getSelectedEvent,
  setSelectedEvent,
  authenticateUser
} from './services/store.js';

import { planEvent, calculatePlateRange, formatINR } from './engine/planner.js';
import { EVENT_TYPES, CITIES_BY_STATE, ALL_CITIES } from './data/events.js';
import {
  getLuminance,
  getContrastRatio,
  onColor,
  getAccessibleTextColor,
  applyThemeColors
} from './utils/contrastUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Verification 1: Test Account & Store Seeding', async () => {
  seedTestAccount();
  const auth = await authenticateUser('9390075877', 'sai@1398');
  assert.ok(auth.success, 'Authentication for test account must succeed');

  const user = getCurrentUser();
  assert.ok(user, 'Test account must be seeded and retrieved as current user');
  assert.equal(user.phone, '9390075877');
  assert.equal(user.name, 'D L Narasimha sai');
  assert.equal(user.email, 'narasimhasai@gmail.com');
  assert.equal(user.city, 'Kadapa');
  assert.equal(user.state, 'Andhra Pradesh');

  const bookings = getUserBookings('9390075877');
  assert.equal(bookings.length, 0, 'Test user starts with ZERO bookings');
});

test('Verification 2: Details Page Profile & Password Updates', async () => {
  seedTestAccount();
  const res = await updateUserProfile('9390075877', {
    name: 'D L Narasimha sai updated',
    city: 'Tirupati'
  });
  assert.ok(res.success, 'Profile update must succeed');
  assert.equal(res.user.city, 'Tirupati');

  // Restore Kadapa
  await updateUserProfile('9390075877', { city: 'Kadapa' });

  // Test password change
  const pwdRes = await changeUserPassword('9390075877', 'sai@1398', 'newSai@1398');
  assert.ok(pwdRes.success, 'Valid password change must succeed');

  // Restore password
  await changeUserPassword('9390075877', 'newSai@1398', 'sai@1398');
});

test('Verification 3: Section D Cost Table & Planner Dynamic Calculations', () => {
  // Initial inputs (Wedding, Rs 8,00,000, 600 guests, AC, Full day, Medium decor, Buffet, Standard, Andhra, Non-Veg)
  const initialPlan = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg'
  });

  assert.ok(initialPlan.estimatedCost, 'Plan must include estimatedCost');
  assert.ok(initialPlan.estimatedCost.catering?.cost > 0, 'Catering cost must be positive');
  assert.ok(initialPlan.estimatedCost.hall?.cost > 0, 'Hall cost must be positive');

  // Change guests 600 -> 100
  const plan100 = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 100,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg'
  });

  assert.ok(
    plan100.estimatedCost.catering.cost < initialPlan.estimatedCost.catering.cost,
    'Catering cost must drop when guests decrease from 600 to 100'
  );
  assert.ok(
    plan100.estimatedCost.hall.capacity >= 100,
    'Picked hall must fit at least 100 guests'
  );

  // Change AC -> Non-AC
  const planNonAC = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'non-ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg'
  });
  assert.ok(
    planNonAC.estimatedCost.hall.cost < initialPlan.estimatedCost.hall.cost,
    'Non-AC hall must cost less than AC hall'
  );

  // Change Full day -> Multiple days (3 days)
  const plan3Days = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'ac',
    bookingDuration: 'multiple days',
    daysCount: 3,
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg'
  });
  assert.ok(
    plan3Days.estimatedCost.hall.cost > initialPlan.estimatedCost.hall.cost,
    'Multiple days (3 days) hall must cost more than single day'
  );

  // Change Standard -> Premium catering
  const planPremiumFood = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'premium',
    cuisine: 'andhra',
    foodType: 'non-veg'
  });
  assert.ok(
    planPremiumFood.estimatedCost.catering.cost > initialPlan.estimatedCost.catering.cost,
    'Premium food must cost more than Standard food'
  );

  // Change Veg -> Non-Veg
  const planVeg = planEvent({
    budget: 800000,
    serviceNeed: 'both',
    guests: 600,
    city: 'Kadapa',
    event: 'wedding',
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'veg'
  });
  assert.ok(
    initialPlan.estimatedCost.catering.cost > planVeg.estimatedCost.catering.cost,
    'Non-Veg food must cost more than Veg food'
  );
});

test('Verification 4: Section E 8 Event Colors & Persistence', () => {
  const expectedColors = {
    wedding: '#FF5C8A',
    birthday: '#FFA62B',
    corporate: '#5AA2FF',
    babyshower: '#3DD6C6',
    housewarming: '#5FD38D',
    reception: '#A57BFF',
    educational: '#F2D14B',
    andmore: '#F0654F'
  };

  EVENT_TYPES.forEach(ev => {
    assert.equal(ev.color.toUpperCase(), expectedColors[ev.id].toUpperCase(), `Color for event ${ev.id} must match spec`);
  });

  // Verify event persistence in store
  setSelectedEvent('corporate');
  assert.equal(getSelectedEvent(), 'corporate');
  setSelectedEvent('wedding');
  assert.equal(getSelectedEvent(), 'wedding');
});

test('Verification 5: Section F WCAG AA Contrast Standards', () => {
  // Test onColor helper for light accents
  assert.equal(onColor('#F2D14B'), '#2B1D2F', 'Yellow accent must use dark text');
  assert.equal(onColor('#FFA62B'), '#2B1D2F', 'Orange birthday accent must use dark text');
  assert.equal(onColor('#3DD6C6'), '#2B1D2F', 'Teal baby shower accent must use dark text');
  assert.equal(onColor('#5FD38D'), '#2B1D2F', 'Green housewarming accent must use dark text');

  // Test getAccessibleTextColor against light background #FFF8EA
  const lightBg = '#FFF8EA';
  EVENT_TYPES.forEach(ev => {
    const accText = getAccessibleTextColor(ev.color, lightBg, 4.5);
    const ratio = getContrastRatio(accText, lightBg);
    assert.ok(
      ratio >= 4.5,
      `Text color ${accText} for ${ev.name} must meet WCAG AA (>= 4.5:1), got ${ratio.toFixed(2)}:1`
    );
  });
});

test('Verification 6: Section A Single-File & Double-Click Compatibility', () => {
  const indexPath = path.join(rootDir, 'index.html');
  assert.ok(fs.existsSync(indexPath), 'root index.html must exist');

  const content = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(content.length > 500000, `index.html must be self-contained bundle (>500kB), got ${content.length} bytes`);
  assert.ok(!content.includes('<script type="module"'), 'index.html must NOT contain script type="module"');
  assert.ok(!content.includes('import {'), 'index.html must NOT contain direct ES imports in loaded script');
  assert.ok(content.includes('<div id="root"></div>'), 'index.html must contain React mount root');

  const readmePath = path.join(rootDir, 'README.md');
  assert.ok(fs.existsSync(readmePath), 'README.md must exist');
  const readmeContent = fs.readFileSync(readmePath, 'utf-8').trim();
  assert.equal(
    readmeContent,
    `Open index.html by double-clicking it\nTest login: phone 9390075877, password sai@1398`
  );
});
