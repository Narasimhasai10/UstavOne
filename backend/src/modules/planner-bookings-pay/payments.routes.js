import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "../auth-users-admin/auth.middleware.js";
import { getPaymentProvider } from "./adapters/payments/index.js";

const router = Router();
const paymentProvider = getPaymentProvider();

// POST /api/v1/payments/create-order
router.post("/create-order", requireAuth, async (req, res, next) => {
  try {
    const { bookingId, idempotencyKey } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: { message: "bookingId is required" } });
    }

    const key = idempotencyKey || `pay_${bookingId}_${Date.now()}`;

    // Check existing payment with key
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: key }
    });
    if (existingPayment && existingPayment.status === "paid") {
      return res.json({ data: existingPayment });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    if (booking.status !== "pending_payment") {
      return res.status(400).json({ error: { message: `Booking status is ${booking.status}` } });
    }

    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) < new Date()) {
      return res.status(410).json({ error: { message: "Booking hold has expired. Please select dates again." } });
    }

    const providerOrder = await paymentProvider.createOrder({
      amount: booking.total,
      currency: "INR",
      receipt: booking.code,
      bookingId: booking.id
    });

    const payment = await prisma.payment.upsert({
      where: { idempotencyKey: key },
      update: {
        providerOrderId: providerOrder.orderId,
        amount: booking.total
      },
      create: {
        bookingId: booking.id,
        provider: paymentProvider.name,
        providerOrderId: providerOrder.orderId,
        amount: booking.total,
        status: "created",
        idempotencyKey: key
      }
    });

    res.json({
      data: {
        paymentId: payment.id,
        orderId: providerOrder.orderId,
        amount: booking.total,
        currency: "INR",
        provider: paymentProvider.name,
        bookingCode: booking.code
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/payments/confirm
router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const { bookingId, paymentId, providerOrderId, providerPaymentId, method = "upi" } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: { message: "bookingId is required" } });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        branch: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    // Verify with provider
    const verification = await paymentProvider.verifyPayment({
      orderId: providerOrderId,
      paymentId: providerPaymentId || `mock_pay_${Date.now()}`
    });

    if (!verification.verified && !verification.success) {
      return res.status(400).json({ error: { message: "Payment verification failed" } });
    }

    // Execute confirmation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Payment record
      const updatedPayment = await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: { not: "paid" }
        },
        data: {
          status: "paid",
          providerPaymentId: verification.providerPaymentId || verification.paymentId || providerPaymentId || `pay_mock_${Date.now()}`,
          method
        }
      });

      // 2. Update Booking
      const confirmedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "confirmed",
          paymentStatus: "paid",
          holdExpiresAt: null
        }
      });

      // 3. Increment Branch booking count
      await tx.branch.update({
        where: { id: booking.branchId },
        data: {
          bookingsCount: { increment: 1 }
        }
      });

      // 4. Create Payout entry for vendor (pending release)
      await tx.payout.upsert({
        where: { bookingId: booking.id },
        update: {},
        create: {
          vendorId: booking.vendorId,
          bookingId: booking.id,
          gross: booking.subtotal,
          commission: booking.commission,
          net: booking.vendorPayout,
          status: "pending"
        }
      });

      // 5. Create in-app notifications
      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: "booking_confirmed",
          title: "Booking Confirmed!",
          body: `Your booking for ${booking.branch.name} (${booking.code}) on ${booking.startDate} is confirmed.`
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.vendorId,
          type: "vendor_new_booking",
          title: "New Booking Received!",
          body: `You received a confirmed booking for ${booking.branch.name} on ${booking.startDate}. Ref: ${booking.code}`
        }
      });

      return confirmedBooking;
    });

    res.json({
      data: {
        success: true,
        bookingId: result.id,
        code: result.code,
        status: result.status,
        paymentStatus: result.paymentStatus
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/payments/webhook
router.post("/webhook", async (req, res, next) => {
  try {
    // Acknowledge webhook
    res.json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

export default router;
