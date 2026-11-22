import { Router } from "express";
import { prisma } from "../../utils/prisma.js";
import { requireAuth, requireRole } from "./auth.middleware.js";

const router = Router();

// Restrict all admin routes to admin
router.use(requireAuth, requireRole(["admin"]));

// GET /api/v1/admin/vendors - List vendors
router.get("/vendors", async (req, res, next) => {
  try {
    const vendors = await prisma.user.findMany({
      where: { role: "vendor" },
      include: {
        vendorProfile: true,
        branches: {
          include: {
            documents: true,
            city: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const items = vendors.map(v => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      email: v.email,
      status: v.vendorProfile?.status || "active",
      warningsCount: v.vendorProfile?.warningsCount || 0,
      branchesCount: v.branches.length,
      branches: v.branches.map(b => ({
        id: b.id,
        name: b.name,
        kind: b.kind,
        city: b.city.city,
        status: b.status,
        documents: b.documents
      })),
      createdAt: v.createdAt
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/documents/:id/verify - Approve / reject document
router.post("/documents/:id/verify", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: "approve" | "reject"

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: { message: "action must be 'approve' or 'reject'" } });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { branch: true }
    });

    if (!doc) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newStatus = action === "approve" ? "verified" : "rejected";
      const updatedDoc = await tx.document.update({
        where: { id },
        data: {
          status: newStatus,
          reviewedBy: req.user.id
        }
      });

      // If document was approved and attached to a branch, check if branch can be verified
      if (action === "approve" && doc.branchId) {
        // If kind is hall: requires trade_licence verified
        // If kind is catering: requires fssai verified
        const branchDocs = await tx.document.findMany({
          where: { branchId: doc.branchId, status: "verified" }
        });

        const hasRequired = doc.branch.kind === "hall"
          ? branchDocs.some(d => d.type === "trade_licence")
          : branchDocs.some(d => d.type === "fssai");

        if (hasRequired) {
          await tx.branch.update({
            where: { id: doc.branchId },
            data: { status: "verified" }
          });
        }
      }

      return updatedDoc;
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/violations - List contact violations
router.get("/violations", async (req, res, next) => {
  try {
    const violations = await prisma.contactViolation.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ data: violations });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/planner-config - Get planner config
router.get("/planner-config", async (req, res, next) => {
  try {
    const configs = await prisma.plannerConfig.findMany();
    const result = {};
    for (const c of configs) {
      try {
        result[c.key] = JSON.parse(c.value);
      } catch (e) {
        result[c.key] = c.value;
      }
    }
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/admin/planner-config - Update planner config
router.put("/planner-config", async (req, res, next) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: { message: "key and value are required" } });
    }

    const updated = await prisma.plannerConfig.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) }
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/stats - Overview stats
router.get("/stats", async (req, res, next) => {
  try {
    const [usersCount, vendorsCount, bookingsCount, grossData, branchesCount] = await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.user.count({ where: { role: "vendor" } }),
      prisma.booking.count(),
      prisma.booking.aggregate({
        where: { status: { in: ["confirmed", "completed"] } },
        _sum: {
          subtotal: true,
          commission: true,
          total: true
        }
      }),
      prisma.branch.count()
    ]);

    res.json({
      data: {
        usersCount,
        vendorsCount,
        branchesCount,
        bookingsCount,
        totalGross: grossData._sum.total || 0,
        totalCommission: grossData._sum.commission || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
