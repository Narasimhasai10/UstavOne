import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "../auth-users-admin/auth.middleware.js";
import { pricingService } from "./pricing.js";

const router = Router();

// POST /api/v1/bookings/quote - Pricing preview
router.post("/quote", async (req, res, next) => {
  try {
    const { branchId, startDate, endDate, slot = "full_day", guests = 100, options = {} } = req.body;

    if (!branchId || !startDate) {
      return res.status(400).json({ error: { message: "branchId and startDate are required" } });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        city: true,
        hallDetails: true,
        catererDetails: true,
        plateRates: true
      }
    });

    if (!branch) {
      return res.status(404).json({ error: { message: "Vendor branch not found" } });
    }

    const quote = pricingService.calculateQuote({
      branch,
      startDate,
      endDate: endDate || startDate,
      slot,
      guests: parseInt(guests) || 100,
      options
    });

    res.json({ data: quote });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookings - Create booking with 15-minute hold
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      branchId,
      eventType = "wedding",
      startDate,
      endDate,
      slot = "full_day",
      guests = 100,
      options = {},
      planId
    } = req.body;

    if (!branchId || !startDate) {
      return res.status(400).json({ error: { message: "branchId and startDate are required" } });
    }

    const finalEndDate = endDate || startDate;

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        city: true,
        hallDetails: true,
        catererDetails: true,
        plateRates: true
      }
    });

    if (!branch) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    // Generate date array
    const dates = [];
    let curr = new Date(startDate);
    const end = new Date(finalEndDate);
    while (curr <= end) {
      dates.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Run in Prisma transaction to guarantee atomic double-booking prevention
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Check vendor manual blocks
      const blocks = await tx.availabilityBlock.findMany({
        where: {
          branchId,
          date: { in: dates }
        }
      });
      if (blocks.length > 0) {
        const err = new Error(`Date ${blocks[0].date} is blocked by vendor`);
        err.status = 409;
        throw err;
      }

      // 2. Check active booked dates
      const activeBookings = await tx.bookingDate.findMany({
        where: {
          branchId,
          date: { in: dates },
          slot: { in: [slot, "full_day"] },
          activeKey: "ACTIVE"
        }
      });

      if (activeBookings.length > 0) {
        const err = new Error(`Date ${activeBookings[0].date} slot ${activeBookings[0].slot} is already booked or on hold`);
        err.status = 409;
        throw err;
      }

      // 3. Calculate official quote
      const quote = pricingService.calculateQuote({
        branch,
        startDate,
        endDate: finalEndDate,
        slot,
        guests: parseInt(guests) || 100,
        options
      });

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const code = `UTS-${new Date().getFullYear()}-${randomSuffix}`;
      const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins hold

      // 4. Create Booking
      const newBooking = await tx.booking.create({
        data: {
          code,
          userId: req.user.id,
          vendorId: branch.vendorId,
          branchId: branch.id,
          kind: branch.kind,
          eventType,
          startDate,
          endDate: finalEndDate,
          slot,
          guests: parseInt(guests) || 100,
          options: JSON.stringify(options),
          planId: planId || null,
          priceBreakdown: JSON.stringify(quote.breakdown),
          subtotal: quote.subtotal,
          gst: quote.gst,
          total: quote.total,
          commission: quote.commission,
          vendorPayout: quote.vendorPayout,
          status: "pending_payment",
          paymentStatus: "unpaid",
          holdExpiresAt
        }
      });

      // 5. Create BookingDate records with activeKey="ACTIVE"
      for (const d of dates) {
        await tx.bookingDate.create({
          data: {
            bookingId: newBooking.id,
            branchId: branch.id,
            date: d,
            slot,
            isActive: true,
            activeKey: "ACTIVE"
          }
        });
      }

      return newBooking;
    });

    res.status(201).json({
      data: {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        startDate: booking.startDate,
        endDate: booking.endDate,
        slot: booking.slot,
        guests: booking.guests,
        subtotal: booking.subtotal,
        gst: booking.gst,
        total: booking.total,
        holdExpiresAt: booking.holdExpiresAt,
        createdAt: booking.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bookings - List user's bookings
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            kind: true,
            area: true,
            coverPhotoId: true,
            city: { select: { city: true, state: true } }
          }
        },
        bookingDates: true,
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            createdAt: true
          }
        },
        review: {
          select: { id: true, rating: true, comment: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const items = bookings.map(b => ({
      id: b.id,
      code: b.code,
      eventType: b.eventType,
      startDate: b.startDate,
      endDate: b.endDate,
      slot: b.slot,
      guests: b.guests,
      subtotal: b.subtotal,
      gst: b.gst,
      total: b.total,
      status: b.status,
      paymentStatus: b.paymentStatus,
      holdExpiresAt: b.holdExpiresAt,
      cancelReason: b.cancelReason,
      branch: {
        id: b.branch.id,
        name: b.branch.name,
        kind: b.branch.kind,
        area: b.branch.area,
        city: b.branch.city.city,
        state: b.branch.city.state
      },
      review: b.review,
      createdAt: b.createdAt
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bookings/:id - Detail of booking
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        branch: {
          include: { city: true }
        },
        bookingDates: true,
        payments: true,
        review: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const isUserOwner = booking.userId === req.user.id;
    const isVendorOwner = booking.vendorId === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isUserOwner && !isVendorOwner && !isAdmin) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    // PRIVACY ENFORCEMENT: Never expose phone/email to counterpart
    const safeData = {
      id: booking.id,
      code: booking.code,
      eventType: booking.eventType,
      startDate: booking.startDate,
      endDate: booking.endDate,
      slot: booking.slot,
      guests: booking.guests,
      options: booking.options ? JSON.parse(booking.options) : {},
      priceBreakdown: booking.priceBreakdown ? JSON.parse(booking.priceBreakdown) : {},
      subtotal: booking.subtotal,
      gst: booking.gst,
      total: booking.total,
      commission: isVendorOwner ? booking.commission : undefined, // user doesn't need commission detail
      vendorPayout: isVendorOwner ? booking.vendorPayout : undefined,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      holdExpiresAt: booking.holdExpiresAt,
      cancelReason: booking.cancelReason,
      cancelNote: booking.cancelNote,
      cancelledAt: booking.cancelledAt,
      branch: {
        id: booking.branch.id,
        name: booking.branch.name,
        kind: booking.branch.kind,
        area: booking.branch.area,
        city: booking.branch.city.city,
        state: booking.branch.city.state
      },
      bookingDates: booking.bookingDates.map(bd => ({
        date: bd.date,
        slot: bd.slot,
        isActive: bd.isActive
      })),
      payments: booking.payments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method,
        createdAt: p.createdAt
      })),
      review: booking.review,
      createdAt: booking.createdAt
    };

    res.json({ data: safeData });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookings/:id/cancel - Cancellation with refund policy
router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        payments: { where: { status: "paid" } },
        branch: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    if (booking.status.startsWith("cancelled") || booking.status === "completed") {
      return res.status(400).json({ error: { message: `Cannot cancel booking with status ${booking.status}` } });
    }

    const isUser = booking.userId === req.user.id;
    const isVendor = booking.vendorId === req.user.id;

    if (!isUser && !isVendor && req.user.role !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
    let refundPercentage = 0;
    let newStatus = isVendor ? "cancelled_by_vendor" : "cancelled_by_user";

    if (isVendor) {
      // Vendor cancellation -> 100% refund unconditionally
      refundPercentage = 100;
    } else {
      // Check if branch has non-refundable cancellation policy
      const isNonRefundable = booking.branch?.description?.includes("non-refundable") ||
        (booking.branch?.amenities && booking.branch.amenities.toLowerCase().includes("non-refundable"));

      if (isNonRefundable) {
        // 0% refund rule for non-refundable policy
        refundPercentage = 0;
      } else {
        // User cancellation: tiered refund policy based on hours until startDate
        const eventDate = new Date(`${booking.startDate}T00:00:00Z`);
        const now = new Date();
        const diffMs = eventDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours >= 7 * 24) {
          // >= 7 days before event: 100% refund
          refundPercentage = 100;
        } else if (diffHours >= 48) {
          // 48 hours to 7 days before event: 50% refund
          refundPercentage = 50;
        } else {
          // < 48 hours before event: 0% refund
          refundPercentage = 0;
        }
      }
    }

    const refundAmount = Math.round((totalPaid * refundPercentage) / 100);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Release active booking dates
      await tx.bookingDate.updateMany({
        where: { bookingId: id },
        data: {
          isActive: false,
          activeKey: null
        }
      });

      // 2. Create refund record if eligible and paid
      let paymentStatus = booking.paymentStatus;
      if (refundAmount > 0 && booking.payments.length > 0) {
        paymentStatus = "refund_pending";
        await tx.refund.create({
          data: {
            paymentId: booking.payments[0].id,
            bookingId: booking.id,
            amount: refundAmount,
            status: "initiated",
            reason: reason || (isVendor ? "Vendor cancelled booking" : "User cancelled booking")
          }
        });
      }

      // 3. Update booking status
      return await tx.booking.update({
        where: { id },
        data: {
          status: newStatus,
          paymentStatus,
          cancelReason: reason || "Cancelled",
          cancelNote: note || null,
          cancelledAt: new Date(),
          holdExpiresAt: null
        }
      });
    });

    res.json({
      data: {
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        refundPercentage,
        refundAmount,
        cancelledAt: updated.cancelledAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookings/:id/review - User leaves a review
router.post("/:id/review", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: { message: "Rating must be an integer between 1 and 5" } });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { review: true }
    });

    if (!booking) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    if (booking.review) {
      return res.status(400).json({ error: { message: "Review already submitted for this booking" } });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ error: { message: "Only completed bookings can be reviewed" } });
    }

    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          bookingId: booking.id,
          userId: req.user.id,
          branchId: booking.branchId,
          rating: parseInt(rating),
          comment: comment || null
        }
      });

      // Recalculate average rating for the branch
      const allReviews = await tx.review.findMany({
        where: { branchId: booking.branchId },
        select: { rating: true }
      });

      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await tx.branch.update({
        where: { id: booking.branchId },
        data: {
          ratingAvg: Math.round(avg * 10) / 10,
          ratingCount: allReviews.length
        }
      });

      return newReview;
    });

    res.status(201).json({ data: review });
  } catch (err) {
    next(err);
  }
});

export default router;
