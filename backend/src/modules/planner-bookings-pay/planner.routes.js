import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "../auth-users-admin/auth.middleware.js";
import { plannerService } from "./planner.js";

const router = Router();

// POST /api/v1/plan - Calculate plan (stateless or logged-in)
router.post("/", async (req, res, next) => {
  try {
    const input = req.body;
    const planResult = await plannerService.calculatePlan(input);
    res.json({ data: planResult });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/plans - Save plan for current user
router.post("/save", requireAuth, async (req, res, next) => {
  try {
    const { input, result } = req.body;

    if (!input || !result) {
      return res.status(400).json({ error: { message: "Both input and result objects are required to save a plan" } });
    }

    // Find cityId if city name provided
    let cityId = "default";
    if (input.city) {
      const cityRec = await prisma.city.findFirst({
        where: { city: { equals: input.city } }
      });
      if (cityRec) cityId = cityRec.id;
    }

    const plan = await prisma.plan.create({
      data: {
        userId: req.user.id,
        eventType: input.eventType || "wedding",
        cityId,
        input: JSON.stringify(input),
        result: JSON.stringify(result),
        isSaved: true
      }
    });

    res.status(201).json({
      data: {
        id: plan.id,
        eventType: plan.eventType,
        isSaved: plan.isSaved,
        shareToken: plan.shareToken,
        createdAt: plan.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/plans - Get current user's saved plans
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        userId: req.user.id,
        isSaved: true
      },
      orderBy: { createdAt: "desc" }
    });

    const items = plans.map(p => ({
      id: p.id,
      eventType: p.eventType,
      input: JSON.parse(p.input),
      result: JSON.parse(p.result),
      shareToken: p.shareToken,
      createdAt: p.createdAt
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/plans/:id - Get plan by ID
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({
      where: { id }
    });

    if (!plan) {
      return res.status(404).json({ error: { message: "Plan not found" } });
    }

    // Access check: only owner or admin can fetch without shareToken
    if (plan.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: { message: "Not authorized to access this plan" } });
    }

    res.json({
      data: {
        id: plan.id,
        eventType: plan.eventType,
        input: JSON.parse(plan.input),
        result: JSON.parse(plan.result),
        shareToken: plan.shareToken,
        createdAt: plan.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/plans/:id/share - Generate share link
router.post("/:id/share", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({
      where: { id }
    });

    if (!plan || plan.userId !== req.user.id) {
      return res.status(404).json({ error: { message: "Plan not found" } });
    }

    let shareToken = plan.shareToken;
    if (!shareToken) {
      shareToken = crypto.randomBytes(16).toString("hex");
      await prisma.plan.update({
        where: { id },
        data: { shareToken }
      });
    }

    res.json({
      data: {
        shareToken,
        shareUrl: `/plan/share/${shareToken}`
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/plans/shared/:shareToken - Public view of shared plan
router.get("/shared/:shareToken", async (req, res, next) => {
  try {
    const { shareToken } = req.params;
    const plan = await prisma.plan.findUnique({
      where: { shareToken }
    });

    if (!plan) {
      return res.status(404).json({ error: { message: "Shared plan not found" } });
    }

    res.json({
      data: {
        id: plan.id,
        eventType: plan.eventType,
        input: JSON.parse(plan.input),
        result: JSON.parse(plan.result),
        createdAt: plan.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
