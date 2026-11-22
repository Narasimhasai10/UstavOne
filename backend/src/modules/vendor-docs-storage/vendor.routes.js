import { Router } from "express";
import { prisma } from "../../utils/prisma.js";
import { requireAuth, requireRole } from "../auth-users-admin/auth.middleware.js";
import { revenueService } from "./revenue.service.js";

const router = Router();

// Restrict all vendor routes to vendor or admin
router.use(requireAuth, requireRole(["vendor", "admin"]));

// GET /api/v1/vendor/profile - Vendor profile
router.get("/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        vendorProfile: true,
        branches: {
          include: {
            city: true,
            hallDetails: true,
            catererDetails: true,
            documents: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: { message: "Vendor not found" } });
    }

    res.json({
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        username: user.username,
        city: user.city,
        state: user.state,
        vendorProfile: user.vendorProfile,
        branches: user.branches.map(b => ({
          id: b.id,
          name: b.name,
          kind: b.kind,
          status: b.status,
          city: b.city.city,
          ratingAvg: b.ratingAvg,
          ratingCount: b.ratingCount,
          bookingsCount: b.bookingsCount,
          documents: b.documents
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/profile - Update vendor profile
router.put("/profile", async (req, res, next) => {
  try {
    const { name, email, hallBusinessName, cateringBusinessName, city, state } = req.body;

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        city: city || undefined,
        state: state || undefined
      }
    });

    if (hallBusinessName || cateringBusinessName) {
      await prisma.vendorProfile.upsert({
        where: { userId: req.user.id },
        update: {
          hallBusinessName: hallBusinessName || undefined,
          cateringBusinessName: cateringBusinessName || undefined
        },
        create: {
          userId: req.user.id,
          ownerType: "both",
          hallBusinessName,
          cateringBusinessName
        }
      });
    }

    res.json({ data: { message: "Profile updated successfully" } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/branches - List vendor branches
router.get("/branches", async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { vendorId: req.user.id },
      include: {
        city: true,
        hallDetails: true,
        catererDetails: true,
        plateRates: true,
        photos: true,
        works: {
          include: { photos: true },
          orderBy: { createdAt: "desc" }
        },
        blocks: true,
        documents: true
      }
    });

    const items = branches.map(b => ({
      id: b.id,
      name: b.name,
      kind: b.kind,
      description: b.description,
      addressLine: b.addressLine,
      area: b.area,
      city: b.city.city,
      state: b.city.state,
      pincode: b.pincode,
      status: b.status,
      ratingAvg: b.ratingAvg,
      ratingCount: b.ratingCount,
      bookingsCount: b.bookingsCount,
      amenities: b.amenities ? JSON.parse(b.amenities) : [],
      hallDetails: b.hallDetails,
      catererDetails: b.catererDetails ? {
        minPlates: b.catererDetails.minPlates,
        cuisines: b.catererDetails.cuisines ? JSON.parse(b.catererDetails.cuisines) : [],
        servingStyles: b.catererDetails.servingStyles ? JSON.parse(b.catererDetails.servingStyles) : [],
        foodTypes: b.catererDetails.foodTypes ? JSON.parse(b.catererDetails.foodTypes) : []
      } : null,
      plateRates: b.plateRates,
      photos: b.photos,
      works: b.works,
      blocks: b.blocks,
      documents: b.documents
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches - Create branch
router.post("/branches", async (req, res, next) => {
  try {
    const {
      kind,
      name,
      description,
      addressLine,
      area,
      city,
      state,
      pincode,
      lat,
      lon,
      amenities = [],
      hallDetails,
      catererDetails,
      plateRates = []
    } = req.body;

    if (!kind || !name || !city) {
      return res.status(400).json({ error: { message: "kind, name, and city are required" } });
    }

    // Resolve or create City
    let cityRecord = await prisma.city.findFirst({
      where: { city: { equals: city } }
    });

    if (!cityRecord) {
      cityRecord = await prisma.city.create({
        data: {
          city,
          state: state || "Andhra Pradesh",
          priceMultiplier: 1.0
        }
      });
    }

    const branch = await prisma.branch.create({
      data: {
        vendorId: req.user.id,
        kind,
        name,
        description: description || null,
        addressLine: addressLine || null,
        area: area || city,
        cityId: cityRecord.id,
        pincode: pincode || null,
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null,
        status: "under_review",
        amenities: JSON.stringify(amenities),
        hallDetails: kind === "hall" && hallDetails ? {
          create: {
            capacity: parseInt(hallDetails.capacity) || 500,
            acMode: hallDetails.acMode || "both",
            priceFullDayNonAc: parseInt(hallDetails.priceFullDayNonAc) || 40000,
            priceFullDayAc: parseInt(hallDetails.priceFullDayAc) || 60000,
            priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : null,
            parking: hallDetails.parking || "50 cars",
            rooms: parseInt(hallDetails.rooms) || 2
          }
        } : undefined,
        catererDetails: kind === "catering" && catererDetails ? {
          create: {
            minPlates: parseInt(catererDetails.minPlates) || 50,
            cuisines: JSON.stringify(catererDetails.cuisines || ["South Indian"]),
            servingStyles: JSON.stringify(catererDetails.servingStyles || ["Buffet"]),
            foodTypes: JSON.stringify(catererDetails.foodTypes || ["both"])
          }
        } : undefined,
        plateRates: kind === "catering" && plateRates.length > 0 ? {
          create: plateRates.map(pr => ({
            category: pr.category,
            foodType: pr.foodType,
            price: parseInt(pr.price)
          }))
        } : undefined
      },
      include: {
        hallDetails: true,
        catererDetails: true,
        plateRates: true
      }
    });

    res.status(201).json({ data: branch });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/branches/:id - Update branch
router.put("/branches/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({ where: { id } });

    if (!branch || (branch.vendorId !== req.user.id && req.user.role !== "admin")) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    const {
      name,
      description,
      addressLine,
      area,
      pincode,
      amenities,
      hallDetails,
      catererDetails
    } = req.body;

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        addressLine: addressLine || undefined,
        area: area || undefined,
        pincode: pincode || undefined,
        amenities: amenities ? JSON.stringify(amenities) : undefined
      }
    });

    if (branch.kind === "hall" && hallDetails) {
      await prisma.hallDetails.upsert({
        where: { branchId: id },
        update: {
          capacity: hallDetails.capacity ? parseInt(hallDetails.capacity) : undefined,
          acMode: hallDetails.acMode || undefined,
          priceFullDayNonAc: hallDetails.priceFullDayNonAc ? parseInt(hallDetails.priceFullDayNonAc) : undefined,
          priceFullDayAc: hallDetails.priceFullDayAc ? parseInt(hallDetails.priceFullDayAc) : undefined,
          priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : undefined,
          parking: hallDetails.parking || undefined,
          rooms: hallDetails.rooms ? parseInt(hallDetails.rooms) : undefined
        },
        create: {
          branchId: id,
          capacity: parseInt(hallDetails.capacity) || 500,
          acMode: hallDetails.acMode || "both",
          priceFullDayNonAc: parseInt(hallDetails.priceFullDayNonAc) || 40000,
          priceFullDayAc: parseInt(hallDetails.priceFullDayAc) || 60000,
          priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : null,
          parking: hallDetails.parking || "50 cars",
          rooms: parseInt(hallDetails.rooms) || 2
        }
      });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/branches/:id/blocks - List blocks
router.get("/branches/:id/blocks", async (req, res, next) => {
  try {
    const { id } = req.params;
    const blocks = await prisma.availabilityBlock.findMany({
      where: { branchId: id },
      orderBy: { date: "asc" }
    });
    res.json({ data: blocks });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches/:id/blocks - Block date
router.post("/branches/:id/blocks", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, reason } = req.body;

    if (!date) {
      return res.status(400).json({ error: { message: "Date is required (YYYY-MM-DD)" } });
    }

    const block = await prisma.availabilityBlock.upsert({
      where: {
        branchId_date: {
          branchId: id,
          date
        }
      },
      update: { reason: reason || "Vendor blocked" },
      create: {
        branchId: id,
        date,
        reason: reason || "Vendor blocked"
      }
    });

    res.status(201).json({ data: block });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/branches/:id/blocks/:blockId - Unblock date
router.delete("/branches/:id/blocks/:blockId", async (req, res, next) => {
  try {
    const { blockId } = req.params;
    await prisma.availabilityBlock.delete({
      where: { id: blockId }
    });
    res.json({ data: { message: "Block removed successfully" } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches/:id/works - Add previous work
router.post("/branches/:id/works", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, eventType, eventDate, guests, caption, photoFileIds = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: { message: "title is required" } });
    }

    const work = await prisma.previousWork.create({
      data: {
        branchId: id,
        title,
        eventType,
        eventDate,
        guests: guests ? parseInt(guests) : null,
        caption,
        photos: photoFileIds.length > 0 ? {
          create: photoFileIds.map((fileId, idx) => ({
            fileId,
            sortOrder: idx
          }))
        } : undefined
      },
      include: { photos: true }
    });

    res.status(201).json({ data: work });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/works/:workId - Delete previous work
router.delete("/works/:workId", async (req, res, next) => {
  try {
    const { workId } = req.params;
    await prisma.previousWork.delete({
      where: { id: workId }
    });
    res.json({ data: { message: "Work deleted" } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/bookings - List vendor bookings
router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { vendorId: req.user.id },
      include: {
        branch: { select: { id: true, name: true, kind: true } },
        user: { select: { id: true, name: true } }, // PRIVACY: NEVER expose user phone/email
        bookingDates: true,
        payout: true
      },
      orderBy: { createdAt: "desc" }
    });

    const items = bookings.map(b => ({
      id: b.id,
      code: b.code,
      customerName: b.user.name,
      branchName: b.branch.name,
      kind: b.kind,
      eventType: b.eventType,
      startDate: b.startDate,
      endDate: b.endDate,
      slot: b.slot,
      guests: b.guests,
      gross: b.subtotal,
      commission: b.commission,
      vendorPayout: b.vendorPayout,
      status: b.status,
      paymentStatus: b.paymentStatus,
      payoutStatus: b.payout?.status || "pending",
      createdAt: b.createdAt
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/bookings/:id/status - Update booking status
router.put("/bookings/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking || (booking.vendorId !== req.user.id && req.user.role !== "admin")) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status }
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/requests - Inquiries summary
router.get("/requests", async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { vendorId: req.user.id },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { lastMessageAt: "desc" }
    });

    const requests = conversations.map(c => ({
      id: c.id,
      customerName: c.user.name,
      branchName: c.branch.name,
      branchId: c.branchId,
      lastMessage: c.messages[0]?.body || "Inquiry initiated",
      lastMessageAt: c.lastMessageAt
    }));

    res.json({ data: requests });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/revenue/summary
router.get("/revenue/summary", async (req, res, next) => {
  try {
    const summary = await revenueService.getRevenueSummary(req.user.id);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/revenue/series
router.get("/revenue/series", async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const series = await revenueService.getRevenueSeries(req.user.id, months);
    res.json({ data: series });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/payouts
router.get("/payouts", async (req, res, next) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: { vendorId: req.user.id },
      include: {
        booking: {
          select: {
            code: true,
            startDate: true,
            branch: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: payouts });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/payouts/request
router.post("/payouts/request", async (req, res, next) => {
  try {
    // In demo/mock, vendor requests release for completed bookings
    const updated = await prisma.payout.updateMany({
      where: {
        vendorId: req.user.id,
        status: "pending"
      },
      data: {
        status: "paid_out",
        paidAt: new Date()
      }
    });

    res.json({
      data: {
        message: `Payout of ${updated.count} bookings initiated successfully.`
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
