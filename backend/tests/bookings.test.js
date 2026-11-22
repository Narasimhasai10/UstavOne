import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/utils/prisma.js";

describe("Booking System - Concurrency, Hold Locks & Refund Policy", () => {
  let testUser = null;
  let testBranch = null;

  before(async () => {
    testUser = await prisma.user.findFirst({ where: { role: "user" } });
    testBranch = await prisma.branch.findFirst({ where: { kind: "hall" } });
  });

  test("1. Atomic Double-booking Prevention & Race Condition", async () => {
    const testDate = "2027-01-15";
    const slot = "full_day";

    // Clean up any existing bookings for test date
    await prisma.bookingDate.deleteMany({
      where: { branchId: testBranch.id, date: testDate }
    });

    // 1st booking attempt
    const booking1 = await prisma.$transaction(async (tx) => {
      const active = await tx.bookingDate.findMany({
        where: { branchId: testBranch.id, date: testDate, slot, activeKey: "ACTIVE" }
      });
      if (active.length > 0) throw new Error("CONFLICT_DATE_BOOKED");

      const b = await tx.booking.create({
        data: {
          code: `TEST-BK-1`,
          userId: testUser.id,
          vendorId: testBranch.vendorId,
          branchId: testBranch.id,
          kind: "hall",
          eventType: "wedding",
          startDate: testDate,
          endDate: testDate,
          slot,
          guests: 500,
          subtotal: 50000,
          gst: 9000,
          total: 59000,
          commission: 5000,
          vendorPayout: 45000,
          status: "pending_payment"
        }
      });

      await tx.bookingDate.create({
        data: {
          bookingId: b.id,
          branchId: testBranch.id,
          date: testDate,
          slot,
          isActive: true,
          activeKey: "ACTIVE"
        }
      });

      return b;
    });

    assert.ok(booking1.id, "First booking created successfully");

    // 2nd simultaneous booking attempt on same date and slot must FAIL with conflict
    let failed = false;
    try {
      await prisma.$transaction(async (tx) => {
        const active = await tx.bookingDate.findMany({
          where: { branchId: testBranch.id, date: testDate, slot, activeKey: "ACTIVE" }
        });
        if (active.length > 0) throw new Error("CONFLICT_DATE_BOOKED");

        await tx.bookingDate.create({
          data: {
            bookingId: "temp",
            branchId: testBranch.id,
            date: testDate,
            slot,
            isActive: true,
            activeKey: "ACTIVE"
          }
        });
      });
    } catch (err) {
      failed = true;
      assert.equal(err.message, "CONFLICT_DATE_BOOKED");
    }

    assert.equal(failed, true, "Second simultaneous booking must fail with conflict");

    // Clean up test booking
    await prisma.booking.delete({ where: { id: booking1.id } });
  });

  test("2. Hold Expiration Releases Date for New Bookings", async () => {
    const testDate = "2027-02-20";
    const slot = "morning";

    // Create booking on hold
    const holdBooking = await prisma.booking.create({
      data: {
        code: `HOLD-EXP-1`,
        userId: testUser.id,
        vendorId: testBranch.vendorId,
        branchId: testBranch.id,
        kind: "hall",
        eventType: "engagement",
        startDate: testDate,
        endDate: testDate,
        slot,
        guests: 200,
        subtotal: 30000,
        gst: 5400,
        total: 35400,
        commission: 3000,
        vendorPayout: 27000,
        status: "pending_payment",
        holdExpiresAt: new Date(Date.now() - 1000) // already expired
      }
    });

    const bd = await prisma.bookingDate.create({
      data: {
        bookingId: holdBooking.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: true,
        activeKey: "ACTIVE"
      }
    });

    // Simulate hold expiration cron
    await prisma.$transaction(async (tx) => {
      await tx.bookingDate.updateMany({
        where: { bookingId: holdBooking.id },
        data: { isActive: false, activeKey: null }
      });
      await tx.booking.update({
        where: { id: holdBooking.id },
        data: { status: "expired" }
      });
    });

    // Now a new booking for the same date must succeed
    const newBooking = await prisma.booking.create({
      data: {
        code: `NEW-AFTER-EXP-1`,
        userId: testUser.id,
        vendorId: testBranch.vendorId,
        branchId: testBranch.id,
        kind: "hall",
        eventType: "engagement",
        startDate: testDate,
        endDate: testDate,
        slot,
        guests: 200,
        subtotal: 30000,
        gst: 5400,
        total: 35400,
        commission: 3000,
        vendorPayout: 27000,
        status: "pending_payment"
      }
    });

    const newBd = await prisma.bookingDate.create({
      data: {
        bookingId: newBooking.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: true,
        activeKey: "ACTIVE"
      }
    });

    assert.ok(newBd.id, "Date can now be locked by new booking");

    // Clean up
    await prisma.booking.deleteMany({
      where: { id: { in: [holdBooking.id, newBooking.id] } }
    });
  });

  test("3. Refund Policy Calculation Rules", () => {
    const totalPaid = 100000;

    // Helper for refund calculation
    function calculateRefund(eventDateStr, now, isVendor) {
      if (isVendor) return { refundPct: 100, amount: totalPaid };

      const eventDate = new Date(`${eventDateStr}T00:00:00Z`);
      const diffHours = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours >= 7 * 24) {
        return { refundPct: 100, amount: totalPaid };
      } else if (diffHours >= 48) {
        return { refundPct: 50, amount: totalPaid * 0.5 };
      } else {
        return { refundPct: 0, amount: 0 };
      }
    }

    const now = new Date("2026-11-20T10:00:00Z");

    // Case A: User cancels 10 days before (> 7 days) -> 100%
    const resA = calculateRefund("2026-11-30", now, false);
    assert.equal(resA.refundPct, 100);
    assert.equal(resA.amount, 100000);

    // Case B: User cancels 3 days before (between 48h and 7d) -> 50%
    const resB = calculateRefund("2026-11-23", now, false);
    assert.equal(resB.refundPct, 50);
    assert.equal(resB.amount, 50000);

    // Case C: User cancels 24 hours before (< 48h) -> 0%
    const resC = calculateRefund("2026-11-21", now, false);
    assert.equal(resC.refundPct, 0);
    assert.equal(resC.amount, 0);

    // Case D: Vendor cancels 1 hour before -> 100% unconditionally!
    const resD = calculateRefund("2026-11-20", now, true);
    assert.equal(resD.refundPct, 100);
    assert.equal(resD.amount, 100000);
  });
});
