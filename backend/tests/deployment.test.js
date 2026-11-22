import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../src/utils/prisma.js";
import { releaseExpiredHolds } from "../src/modules/planner-bookings-pay/holds.js";
import { LocalStorageAdapter, CloudinaryStorageAdapter } from "../src/adapters/storage/index.js";

describe("Deployment Architecture - Concurrency, Expiry & Storage Adapters", () => {
  let testUser = null;
  let testBranch = null;

  before(async () => {
    testUser = await prisma.user.findFirst({ where: { role: "user" } });
    testBranch = await prisma.branch.findFirst({ where: { kind: "hall" } });
  });

  test("1. Composite Unique Constraint [branchId, date, slot, activeKey] Behavior", async () => {
    const testDate = "2027-11-15";
    const slot = "morning";

    // Clean up any test records
    await prisma.bookingDate.deleteMany({
      where: { branchId: testBranch.id, date: testDate }
    });

    // Create real parent booking records for foreign key constraint
    const testBookingA = await prisma.booking.create({
      data: {
        code: `TEST-BK-A-${Date.now()}`,
        userId: testUser.id,
        vendorId: testBranch.vendorId,
        branchId: testBranch.id,
        kind: "hall",
        eventType: "wedding",
        startDate: testDate,
        endDate: testDate,
        slot,
        guests: 100,
        subtotal: 20000,
        gst: 3600,
        total: 23600,
        commission: 2000,
        vendorPayout: 18000,
        status: "cancelled"
      }
    });

    const testBookingB = await prisma.booking.create({
      data: {
        code: `TEST-BK-B-${Date.now()}`,
        userId: testUser.id,
        vendorId: testBranch.vendorId,
        branchId: testBranch.id,
        kind: "hall",
        eventType: "wedding",
        startDate: testDate,
        endDate: testDate,
        slot,
        guests: 100,
        subtotal: 20000,
        gst: 3600,
        total: 23600,
        commission: 2000,
        vendorPayout: 18000,
        status: "pending_payment"
      }
    });

    // A. Multiple inactive records (activeKey: null) MUST be allowed for the same slot
    const inactive1 = await prisma.bookingDate.create({
      data: {
        bookingId: testBookingA.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: false,
        activeKey: null
      }
    });

    const inactive2 = await prisma.bookingDate.create({
      data: {
        bookingId: testBookingB.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: false,
        activeKey: null
      }
    });

    assert.ok(inactive1.id && inactive2.id, "Multiple records with activeKey: null are permitted");

    // B. First ACTIVE record (activeKey: 'ACTIVE') MUST succeed
    const active1 = await prisma.bookingDate.create({
      data: {
        bookingId: testBookingA.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: true,
        activeKey: "ACTIVE"
      }
    });
    assert.ok(active1.id, "First active record created");

    // C. Second ACTIVE record for the identical (branchId, date, slot, 'ACTIVE') MUST fail with unique constraint violation
    let duplicateFailed = false;
    try {
      await prisma.bookingDate.create({
        data: {
          bookingId: testBookingB.id,
          branchId: testBranch.id,
          date: testDate,
          slot,
          isActive: true,
          activeKey: "ACTIVE"
        }
      });
    } catch (err) {
      duplicateFailed = true;
      assert.ok(
        err.message.includes("Unique constraint failed") || err.code === "P2002",
        `Expected unique constraint violation, got: ${err.message}`
      );
    }

    assert.equal(duplicateFailed, true, "Duplicate active lock was successfully rejected by database constraint");

    // Clean up
    await prisma.bookingDate.deleteMany({
      where: { branchId: testBranch.id, date: testDate }
    });
    await prisma.booking.deleteMany({
      where: { id: { in: [testBookingA.id, testBookingB.id] } }
    });
  });

  test("2. Lazy Hold Expiry Service Releases Locked Dates and Marks Bookings Expired", async () => {
    const testDate = "2027-11-20";
    const slot = "full_day";

    // Clean up test dates
    await prisma.bookingDate.deleteMany({
      where: { branchId: testBranch.id, date: testDate }
    });

    // Create an expired booking on hold
    const expiredBooking = await prisma.booking.create({
      data: {
        code: `TEST-EXPIRED-${Date.now()}`,
        userId: testUser.id,
        vendorId: testBranch.vendorId,
        branchId: testBranch.id,
        kind: "hall",
        eventType: "wedding",
        startDate: testDate,
        endDate: testDate,
        slot,
        guests: 300,
        subtotal: 50000,
        gst: 9000,
        total: 59000,
        commission: 5000,
        vendorPayout: 45000,
        status: "pending_payment",
        paymentStatus: "unpaid",
        holdExpiresAt: new Date(Date.now() - 5000) // 5 seconds in the past
      }
    });

    await prisma.bookingDate.create({
      data: {
        bookingId: expiredBooking.id,
        branchId: testBranch.id,
        date: testDate,
        slot,
        isActive: true,
        activeKey: "ACTIVE"
      }
    });

    // Run lazy hold expiry
    const releasedCount = await releaseExpiredHolds(prisma);
    assert.ok(releasedCount >= 1, "At least 1 expired hold should have been released");

    // Verify booking updated to expired
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: expiredBooking.id }
    });
    assert.equal(updatedBooking.status, "expired");
    assert.equal(updatedBooking.holdExpiresAt, null);

    // Verify bookingDate unlocked
    const updatedDate = await prisma.bookingDate.findFirst({
      where: { bookingId: expiredBooking.id }
    });
    assert.equal(updatedDate.isActive, false);
    assert.equal(updatedDate.activeKey, null);

    // Clean up
    await prisma.booking.delete({ where: { id: expiredBooking.id } });
  });

  test("3. Storage Adapters - LocalStorageAdapter and CloudinaryStorageAdapter", async () => {
    // A. LocalStorageAdapter
    const local = new LocalStorageAdapter();
    const testBuffer = Buffer.from("test image content", "utf8");
    const savedLocal = await local.save({
      buffer: testBuffer,
      originalname: "test.png",
      mime: "image/png",
      isPublic: true
    });

    assert.ok(savedLocal.url.includes(".png"), "Local adapter saves file with proper extension");
    assert.equal(local.getUrl(savedLocal.url), savedLocal.url);
    const removed = await local.remove(savedLocal.path);
    assert.equal(removed, true, "Local adapter deletes file");

    // B. CloudinaryStorageAdapter
    const cloudinaryAdapter = new CloudinaryStorageAdapter({
      cloudName: "demo-cloud",
      apiKey: "1234567890",
      apiSecret: "abcdefghijklmnopqrstuv",
      folder: "utsavora"
    });

    assert.equal(cloudinaryAdapter.isConfigured(), true);

    // URL resolution
    const samplePublicId = "utsavora/photos/sample-venue";
    const publicUrl = cloudinaryAdapter.getUrl(samplePublicId, { isPublic: true });
    assert.ok(publicUrl.includes("demo-cloud"), "Cloudinary adapter builds URL with cloud name");

    // Unconfigured fallback
    const unconfigured = new CloudinaryStorageAdapter({ cloudName: "", apiKey: "", apiSecret: "" });
    assert.equal(unconfigured.isConfigured(), false);
    const fallbackSaved = await unconfigured.save({
      buffer: testBuffer,
      originalname: "fallback.jpg",
      mime: "image/jpeg",
      isPublic: true
    });
    assert.ok(fallbackSaved.url.startsWith("/uploads/public/"), "Unconfigured Cloudinary falls back to local storage");
    await unconfigured.remove(fallbackSaved.path);
  });
});
