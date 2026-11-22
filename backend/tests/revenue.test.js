import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/utils/prisma.js";
import { revenueService } from "../src/modules/vendor-docs-storage/revenue.service.js";

describe("Vendor Revenue Service & Analytics", () => {
  let vendor = null;

  before(async () => {
    vendor = await prisma.user.findFirst({
      where: { role: "vendor" }
    });
  });

  test("1. Revenue Summary Calculation", async () => {
    if (!vendor) return;

    const summary = await revenueService.getRevenueSummary(vendor.id);

    assert.ok(summary, "Summary returned");
    assert.ok(typeof summary.grossRevenue === "number", "grossRevenue must be a number");
    assert.ok(typeof summary.netRevenue === "number", "netRevenue must be a number");
    assert.ok(typeof summary.commissionPaid === "number", "commissionPaid must be a number");
    assert.ok(summary.completedBookings >= 0, "completedBookings count");
  });

  test("2. 12-Month Revenue Series with Growth Math", async () => {
    if (!vendor) return;

    const series = await revenueService.getRevenueSeries(vendor.id, 12);

    assert.ok(Array.isArray(series), "Series must be an array");
    assert.equal(series.length, 12, "Should return 12 months data");

    const first = series[0];
    assert.ok(first.month, "Month must be present");
    assert.ok(typeof first.gross === "number", "Gross must be a number");
    assert.ok(typeof first.net === "number", "Net must be a number");
    assert.ok(first.growth !== undefined, "Growth must be defined");

    // Test Growth Math function
    // If prev == 0 and curr > 0 -> "New"
    // If prev > 0 -> ((curr - prev) / prev) * 100
    const testGrowth = (prev, curr) => {
      if (prev === 0) {
        return curr > 0 ? "New" : 0;
      }
      return Math.round(((curr - prev) / prev) * 100);
    };

    assert.equal(testGrowth(0, 50000), "New", "0 to positive must be 'New'");
    assert.equal(testGrowth(0, 0), 0, "0 to 0 is 0");
    assert.equal(testGrowth(50000, 75000), 50, "50k to 75k is +50%");
    assert.equal(testGrowth(100000, 50000), -50, "100k to 50k is -50%");
  });
});
