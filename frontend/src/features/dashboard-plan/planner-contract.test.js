import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as offlinePlanner from './offline/planner.js';
import * as serverPlanner from '../../../../backend/src/modules/planner-bookings-pay/planner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Planner Contract Test - Worked Example Alignment', () => {
  const workedExample = {
    budget: 800000,
    servicesNeeded: 'both',
    guests: 600,
    hallCondition: 'ac',
    bookingDuration: 'full day',
    decorLevel: 'medium',
    servingStyle: 'buffet',
    foodCategory: 'standard',
    cuisine: 'andhra',
    foodType: 'non-veg',
    city: 'Kadapa'
  };

  const dummyPath = path.resolve(__dirname, '../../../../database/seed-data/dummyVendors.json');
  const dummyData = JSON.parse(fs.readFileSync(dummyPath, 'utf8'));

  test('Runs worked example through server and offline planner and asserts identical results', () => {
    // 1. Plate Range
    const serverPlateRange = serverPlanner.calculatePlateRange(
      workedExample.foodCategory,
      workedExample.foodType,
      50,
      workedExample.servingStyle,
      workedExample.cuisine,
      0.9
    );

    const offlinePlateRange = offlinePlanner.calculatePlateRange(
      workedExample.foodCategory,
      workedExample.foodType,
      50,
      workedExample.servingStyle,
      workedExample.cuisine,
      0.9
    );

    assert.deepEqual(offlinePlateRange, serverPlateRange, 'Plate range must match exactly between offline and server');
    assert.equal(serverPlateRange.minPlate, 284);
    assert.equal(serverPlateRange.maxPlate, 378);

    // 2. Full Plan Event Execution
    const serverPlan = serverPlanner.planEvent(workedExample, dummyData);
    const offlinePlan = offlinePlanner.planEvent(workedExample, dummyData);

    // Catering spend match
    assert.equal(
      offlinePlan.cateringAllocation,
      serverPlan.cateringAllocation,
      `Catering allocation must match: ${offlinePlan.cateringAllocation} vs ${serverPlan.cateringAllocation}`
    );
    assert.equal(serverPlan.cateringAllocation, 226800);

    // Hall allocation match
    assert.equal(
      offlinePlan.hallAllocation,
      serverPlan.hallAllocation,
      `Hall allocation must match: ${offlinePlan.hallAllocation} vs ${serverPlan.hallAllocation}`
    );
    assert.equal(serverPlan.hallAllocation, 297486);

    // Decor allocation match
    assert.equal(
      offlinePlan.decorAllocation,
      serverPlan.decorAllocation,
      `Decor allocation must match: ${offlinePlan.decorAllocation} vs ${serverPlan.decorAllocation}`
    );
    assert.equal(serverPlan.decorAllocation, 195714);

    // Verify sum equals usable budget
    const totalAllocated = serverPlan.cateringAllocation + serverPlan.hallAllocation + serverPlan.decorAllocation;
    assert.equal(totalAllocated, 720000, 'Allocations sum to usable budget (90% of 8,00,000)');
  });
});
