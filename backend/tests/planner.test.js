import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { plannerService } from "../src/modules/planner-bookings-pay/planner.js";

describe("Smart Planner Service Engine", () => {
  test("1. Worked example: ₹8,00,000, 600 guests, Kadapa, Wedding", async () => {
    const plan = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 800000,
      guestCount: 600,
      city: "Kadapa",
      days: 1
    });

    assert.equal(plan.feasible, true, "Plan must be feasible");
    assert.ok(plan.breakdown, "Breakdown must be present");

    // Catering + Hall must account for major portion of budget
    const cateringAlloc = plan.breakdown.categories.catering?.allocated || 0;
    const hallAlloc = plan.breakdown.categories.hall?.allocated || 0;
    assert.ok(cateringAlloc > 200000, "Catering should be at least 2L for 600 guests");
    assert.ok(hallAlloc > 100000, "Hall should be at least 1L");

    // Check catering plate rate tiers
    assert.ok(plan.cateringTiers, "Should provide 3 catering tiers");
    assert.ok(plan.cateringTiers.standard.plateRate > 0, "Standard plate rate must exist");

    // Check top 3 recommendations
    assert.ok(Array.isArray(plan.recommendations.hall), "Hall recommendations must be an array");
    assert.ok(plan.recommendations.hall.length <= 3, "Top 3 recommendations maximum");
    assert.ok(Array.isArray(plan.recommendations.catering), "Catering recommendations must be an array");
  });

  test("2. Budget share shift: 600 guests vs 100 guests", async () => {
    const plan600 = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 800000,
      guestCount: 600,
      city: "Kadapa"
    });

    const plan100 = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 800000,
      guestCount: 100,
      city: "Kadapa"
    });

    const cateringPct600 = plan600.breakdown.categories.catering.percentage;
    const cateringPct100 = plan100.breakdown.categories.catering.percentage;

    assert.ok(
      cateringPct600 > cateringPct100,
      `Catering % for 600 guests (${cateringPct600}%) must be higher than for 100 guests (${cateringPct100}%)`
    );
  });

  test("3. Total budget too low for guest count detection", async () => {
    const plan = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 50000,
      guestCount: 500,
      city: "Kadapa"
    });

    assert.equal(plan.feasible, false, "₹50k for 500 guests must be flagged not feasible");
    assert.ok(plan.minRecommendedBudget > 50000, "Must calculate minimum recommended budget");
    assert.ok(plan.alerts && plan.alerts.length > 0, "Must generate actionable alerts/explanation");
  });

  test("4. Single service: 'I need only function hall'", async () => {
    const plan = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 200000,
      guestCount: 300,
      city: "Kadapa",
      services: ["hall"]
    });

    assert.equal(plan.feasible, true);
    assert.equal(plan.breakdown.categories.hall.percentage, 100, "Hall should get 100% of allocated budget");
    assert.equal(plan.breakdown.categories.catering?.allocated || 0, 0, "Catering should get 0");
    assert.equal(plan.recommendations.catering?.length || 0, 0, "No catering recommendations needed");
    assert.ok(plan.recommendations.hall.length > 0, "Hall recommendations returned");
  });

  test("5. Multi-day event budget weighting", async () => {
    const plan1Day = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 1000000,
      guestCount: 400,
      city: "Kadapa",
      days: 1
    });

    const plan3Days = await plannerService.calculatePlan({
      eventType: "wedding",
      totalBudget: 1000000,
      guestCount: 400,
      city: "Kadapa",
      days: 3
    });

    const hall1Day = plan1Day.breakdown.categories.hall.allocated;
    const hall3Days = plan3Days.breakdown.categories.hall.allocated;

    assert.ok(
      hall3Days > hall1Day,
      `3-day event hall allocation (${hall3Days}) must be higher than 1-day event (${hall1Day})`
    );
  });
});
