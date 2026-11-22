import { Router } from "express";
import { prisma } from "../../utils/prisma.js";

const router = Router();

// GET /api/v1/vendors - Browse branches with filters
router.get("/", async (req, res, next) => {
  try {
    const {
      kind,
      city,
      state,
      search,
      verifiedOnly,
      minRating,
      minPrice,
      maxPrice,
      capacity,
      sortBy = "rating", // "rating" | "price_asc" | "price_desc" | "popularity"
      page = 1,
      limit = 20
    } = req.query;

    const where = {};

    if (kind && kind !== "all") {
      where.kind = kind;
    }

    if (verifiedOnly === "true") {
      where.status = "verified";
    } else {
      where.status = { in: ["verified", "under_review"] };
    }

    if (city) {
      where.city = {
        city: { equals: city }
      };
    } else if (state) {
      where.city = {
        state: { equals: state }
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { area: { contains: search } },
        { description: { contains: search } }
      ];
    }

    if (minRating) {
      where.ratingAvg = { gte: parseFloat(minRating) };
    }

    let orderBy = { ratingAvg: "desc" };
    if (sortBy === "popularity") {
      orderBy = { bookingsCount: "desc" };
    }

    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = Math.max(((parseInt(page) || 1) - 1) * take, 0);

    const [total, branches] = await Promise.all([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        take,
        skip,
        orderBy,
        include: {
          city: true,
          hallDetails: true,
          catererDetails: true,
          plateRates: true,
          photos: {
            take: 3,
            orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }]
          }
        }
      })
    ]);

    // Format safe response (NO vendor phone or email)
    const items = branches.map(b => {
      let amenitiesList = [];
      try {
        amenitiesList = b.amenities ? JSON.parse(b.amenities) : [];
      } catch (e) {
        amenitiesList = [];
      }

      return {
        id: b.id,
        name: b.name,
        kind: b.kind,
        description: b.description,
        area: b.area,
        city: b.city.city,
        state: b.city.state,
        pincode: b.pincode,
        lat: b.lat,
        lon: b.lon,
        status: b.status,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        bookingsCount: b.bookingsCount,
        amenities: amenitiesList,
        coverPhotoId: b.coverPhotoId,
        photos: b.photos.map(p => ({
          id: p.id,
          fileId: p.fileId,
          caption: p.caption,
          isCover: p.isCover
        })),
        hallDetails: b.hallDetails ? {
          capacity: b.hallDetails.capacity,
          acMode: b.hallDetails.acMode,
          priceFullDayNonAc: b.hallDetails.priceFullDayNonAc,
          priceFullDayAc: b.hallDetails.priceFullDayAc,
          priceHalfDay: b.hallDetails.priceHalfDay,
          parking: b.hallDetails.parking,
          rooms: b.hallDetails.rooms
        } : null,
        catererDetails: b.catererDetails ? {
          minPlates: b.catererDetails.minPlates,
          cuisines: b.catererDetails.cuisines ? JSON.parse(b.catererDetails.cuisines) : [],
          servingStyles: b.catererDetails.servingStyles ? JSON.parse(b.catererDetails.servingStyles) : [],
          foodTypes: b.catererDetails.foodTypes ? JSON.parse(b.catererDetails.foodTypes) : []
        } : null,
        plateRates: b.plateRates.map(pr => ({
          id: pr.id,
          category: pr.category,
          foodType: pr.foodType,
          price: pr.price
        }))
      };
    });

    res.json({
      data: items,
      meta: {
        total,
        page: parseInt(page) || 1,
        limit: take,
        pages: Math.ceil(total / take)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendors/:id - Public branch detail
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        city: true,
        hallDetails: true,
        catererDetails: true,
        plateRates: true,
        menuItems: true,
        photos: {
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }]
        },
        works: {
          include: {
            photos: true
          },
          orderBy: { createdAt: "desc" },
          take: 10
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true
                // CRITICAL: NEVER include phone or email
              }
            }
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: { message: "Vendor branch not found" } });
    }

    let amenities = [];
    try {
      amenities = branch.amenities ? JSON.parse(branch.amenities) : [];
    } catch (e) {
      amenities = [];
    }

    // Safe sanitized response
    const sanitized = {
      id: branch.id,
      name: branch.name,
      kind: branch.kind,
      description: branch.description,
      addressLine: branch.addressLine,
      area: branch.area,
      city: branch.city.city,
      state: branch.city.state,
      pincode: branch.pincode,
      lat: branch.lat,
      lon: branch.lon,
      status: branch.status,
      ratingAvg: branch.ratingAvg,
      ratingCount: branch.ratingCount,
      bookingsCount: branch.bookingsCount,
      amenities,
      coverPhotoId: branch.coverPhotoId,
      photos: branch.photos.map(p => ({
        id: p.id,
        fileId: p.fileId,
        caption: p.caption,
        isCover: p.isCover
      })),
      hallDetails: branch.hallDetails ? {
        capacity: branch.hallDetails.capacity,
        acMode: branch.hallDetails.acMode,
        priceFullDayNonAc: branch.hallDetails.priceFullDayNonAc,
        priceFullDayAc: branch.hallDetails.priceFullDayAc,
        priceHalfDay: branch.hallDetails.priceHalfDay,
        parking: branch.hallDetails.parking,
        rooms: branch.hallDetails.rooms
      } : null,
      catererDetails: branch.catererDetails ? {
        minPlates: branch.catererDetails.minPlates,
        cuisines: branch.catererDetails.cuisines ? JSON.parse(branch.catererDetails.cuisines) : [],
        servingStyles: branch.catererDetails.servingStyles ? JSON.parse(branch.catererDetails.servingStyles) : [],
        foodTypes: branch.catererDetails.foodTypes ? JSON.parse(branch.catererDetails.foodTypes) : []
      } : null,
      plateRates: branch.plateRates.map(pr => ({
        id: pr.id,
        category: pr.category,
        foodType: pr.foodType,
        price: pr.price
      })),
      menuItems: branch.menuItems.map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        isVeg: m.isVeg
      })),
      works: branch.works.map(w => ({
        id: w.id,
        title: w.title,
        eventType: w.eventType,
        eventDate: w.eventDate,
        guests: w.guests,
        caption: w.caption,
        photos: w.photos.map(wp => ({ id: wp.id, fileId: wp.fileId }))
      })),
      reviews: branch.reviews.map(r => {
        // Obfuscate user name for privacy (e.g. "Ramesh K.")
        const parts = (r.user?.name || "Customer").split(" ");
        const safeName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          authorName: safeName,
          createdAt: r.createdAt
        };
      })
    };

    res.json({ data: sanitized });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendors/:id/availability?month=YYYY-MM - Month availability
router.get("/:id/availability", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month } = req.query; // YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: { message: "Query parameter 'month' in YYYY-MM format required" } });
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!branch) {
      return res.status(404).json({ error: { message: "Vendor branch not found" } });
    }

    // Find vendor manual blocks for the month
    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        branchId: id,
        date: { startsWith: month }
      }
    });

    // Find active booking dates for the month
    const bookingDates = await prisma.bookingDate.findMany({
      where: {
        branchId: id,
        date: { startsWith: month },
        activeKey: "ACTIVE"
      },
      select: {
        date: true,
        slot: true
      }
    });

    const unavailableDates = [];

    // All blocked dates are fully unavailable
    for (const b of blocks) {
      unavailableDates.push({
        date: b.date,
        slot: "full_day",
        reason: "blocked"
      });
    }

    // Active bookings
    for (const bd of bookingDates) {
      unavailableDates.push({
        date: bd.date,
        slot: bd.slot,
        reason: "booked"
      });
    }

    res.json({
      data: {
        branchId: id,
        month,
        unavailable: unavailableDates
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendors/:id/reviews - Public reviews
router.get("/:id/reviews", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const take = Math.min(parseInt(limit) || 10, 50);
    const skip = Math.max(((parseInt(page) || 1) - 1) * take, 0);

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: { branchId: id } }),
      prisma.review.findMany({
        where: { branchId: id },
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { name: true }
          }
        }
      })
    ]);

    const sanitized = reviews.map(r => {
      const parts = (r.user?.name || "Customer").split(" ");
      const safeName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: safeName,
        createdAt: r.createdAt
      };
    });

    res.json({
      data: sanitized,
      meta: {
        total,
        page: parseInt(page) || 1,
        limit: take,
        pages: Math.ceil(total / take)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
