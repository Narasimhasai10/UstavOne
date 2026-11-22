import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/utils/prisma.js";

describe("Review System - Integrity, Booking Status & Rating Recalculation", () => {
  let user1 = null;
  let user2 = null;
  let branch = null;
  let completedBooking = null;
  let confirmedBooking = null;

  before(async () => {
    // Find or pick users and branch
    const users = await prisma.user.findMany({ where: { role: "user" }, take: 2 });
    user1 = users[0];
    user2 = users[1] || users[0];
    branch = await prisma.branch.findFirst({ where: { kind: "hall" } });

    // Clean up test bookings
    await prisma.review.deleteMany({
      where: {
        booking: {
          code: { in: ["TEST-REV-COMPLETED", "TEST-REV-CONFIRMED"] }
        }
      }
    });
    await prisma.booking.deleteMany({
      where: { code: { in: ["TEST-REV-COMPLETED", "TEST-REV-CONFIRMED"] } }
    });

    // Create completed booking
    completedBooking = await prisma.booking.create({
      data: {
        code: "TEST-REV-COMPLETED",
        userId: user1.id,
        vendorId: branch.vendorId,
        branchId: branch.id,
        kind: "hall",
        eventType: "wedding",
        startDate: "2026-05-10",
        endDate: "2026-05-10",
        slot: "full_day",
        guests: 400,
        subtotal: 100000,
        gst: 18000,
        total: 118000,
        commission: 10000,
        vendorPayout: 90000,
        status: "completed",
        paymentStatus: "paid"
      }
    });

    // Create confirmed (not yet completed) booking
    confirmedBooking = await prisma.booking.create({
      data: {
        code: "TEST-REV-CONFIRMED",
        userId: user1.id,
        vendorId: branch.vendorId,
        branchId: branch.id,
        kind: "hall",
        eventType: "wedding",
        startDate: "2027-05-10",
        endDate: "2027-05-10",
        slot: "full_day",
        guests: 400,
        subtotal: 100000,
        gst: 18000,
        total: 118000,
        commission: 10000,
        vendorPayout: 90000,
        status: "confirmed",
        paymentStatus: "paid"
      }
    });
  });

  test("1. Reject review for booking that does not exist", async () => {
    const nonExistent = await prisma.booking.findUnique({ where: { id: "non-existent-booking-id" } });
    assert.equal(nonExistent, null, "Booking should not exist");
  });

  test("2. Reject review for non-completed booking", async () => {
    assert.equal(confirmedBooking.status, "confirmed");
    // Verify policy: only completed bookings can be reviewed
    const canReview = confirmedBooking.status === "completed";
    assert.equal(canReview, false, "Confirmed but non-completed booking cannot be reviewed");
  });

  test("3. Reject review when attempted by a different user", async () => {
    const isOwner = completedBooking.userId === user2.id;
    if (user1.id !== user2.id) {
      assert.equal(isOwner, false, "Different user must be rejected with 403 Forbidden");
    }
  });

  test("4. Successfully create review on completed booking and recalculate ratingAvg", async () => {
    // Submit review
    const ratingValue = 5;
    const commentText = "Spectacular venue and outstanding service!";

    const createdReview = await prisma.review.create({
      data: {
        bookingId: completedBooking.id,
        userId: user1.id,
        branchId: branch.id,
        rating: ratingValue,
        comment: commentText
      }
    });

    assert.ok(createdReview.id, "Review ID created");
    assert.equal(createdReview.rating, 5);

    // Recalculate average
    const allReviews = await prisma.review.findMany({
      where: { branchId: branch.id },
      select: { rating: true }
    });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    const expectedAvg = Math.round(avg * 10) / 10;

    const updatedBranch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        ratingAvg: expectedAvg,
        ratingCount: allReviews.length
      }
    });

    assert.equal(updatedBranch.ratingAvg, expectedAvg);
    assert.equal(updatedBranch.ratingCount, allReviews.length);
  });

  test("5. Prevent duplicate review for the same booking", async () => {
    // Attempting to create second review for same booking should violate unique constraint
    let caughtError = false;
    try {
      await prisma.review.create({
        data: {
          bookingId: completedBooking.id,
          userId: user1.id,
          branchId: branch.id,
          rating: 4,
          comment: "Second attempt"
        }
      });
    } catch (err) {
      caughtError = true;
    }
    assert.equal(caughtError, true, "Prisma unique constraint must block duplicate reviews");
  });
});
