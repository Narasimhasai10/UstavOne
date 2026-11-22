import { Router } from "express";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "./auth.middleware.js";

const router = Router();

// GET /api/v1/notifications - List user's notifications
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      take: Math.min(parseInt(limit) || 20, 50),
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: notifications });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null
      }
    });

    res.json({ data: { count } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/:id/read - Mark one read
router.put("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.updateMany({
      where: {
        id,
        userId: req.user.id
      },
      data: { readAt: new Date() }
    });

    res.json({ data: { updated: updated.count > 0 } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/read-all - Mark all read
router.put("/read-all", requireAuth, async (req, res, next) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        readAt: null
      },
      data: { readAt: new Date() }
    });

    res.json({ data: { updatedCount: updated.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
