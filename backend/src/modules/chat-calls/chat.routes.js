import { Router } from "express";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "../auth-users-admin/auth.middleware.js";
import { containsContactInfo } from "./contactGuard.middleware.js";

const router = Router();

// GET /api/v1/chat/conversations - List user's or vendor's conversations
router.get("/conversations", requireAuth, async (req, res, next) => {
  try {
    const isVendor = req.user.role === "vendor";

    const where = isVendor
      ? { vendorId: req.user.id }
      : { userId: req.user.id };

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            kind: true,
            area: true,
            coverPhotoId: true,
            city: { select: { city: true } }
          }
        },
        user: {
          select: {
            id: true,
            name: true
            // CRITICAL: NEVER include phone or email!
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    });

    // Count unread messages for each conversation
    const items = await Promise.all(
      conversations.map(async (c) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: req.user.id },
            status: { not: "read" }
          }
        });

        const lastMsg = c.messages[0] || null;

        return {
          id: c.id,
          branchId: c.branchId,
          branchName: c.branch.name,
          branchArea: c.branch.area,
          city: c.branch.city?.city,
          customerName: c.user?.name || "Customer",
          customerId: c.userId,
          lastMessage: lastMsg ? {
            id: lastMsg.id,
            body: lastMsg.body,
            senderRole: lastMsg.senderRole,
            createdAt: lastMsg.createdAt,
            status: lastMsg.status
          } : null,
          unreadCount,
          lastMessageAt: c.lastMessageAt
        };
      })
    );

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/chat/start - Start or get existing conversation with a branch
router.post("/start", requireAuth, async (req, res, next) => {
  try {
    const { branchId, planId } = req.body;

    if (!branchId) {
      return res.status(400).json({ error: { message: "branchId is required" } });
    }

    let branch = await prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      branch = await prisma.branch.findFirst({
        where: {
          OR: [
            { id: { contains: branchId } },
            { name: { contains: branchId } }
          ]
        }
      });
    }

    if (!branch) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    let conversation = await prisma.conversation.findUnique({
      where: {
        userId_branchId: {
          userId: req.user.id,
          branchId: branch.id
        }
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          vendorId: branch.vendorId,
          branchId: branch.id,
          planId: planId || null
        }
      });
    }

    res.json({
      data: {
        id: conversation.id,
        branchId: conversation.branchId,
        vendorId: conversation.vendorId,
        lastMessageAt: conversation.lastMessageAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/chat/conversations/:id/messages - Get messages in conversation
router.get("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const conversation = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({ error: { message: "Conversation not found" } });
    }

    // Access check: only participants or admin
    if (
      conversation.userId !== req.user.id &&
      conversation.vendorId !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const where = { conversationId: id };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.message.findMany({
      where,
      take: Math.min(parseInt(limit) || 50, 100),
      orderBy: { createdAt: "asc" }
    });

    // Mark unread messages sent by the counterpart as read
    const updateResult = await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: req.user.id },
        status: { not: "read" }
      },
      data: {
        status: "read",
        readAt: new Date()
      }
    });

    if (updateResult.count > 0) {
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation_${id}`).emit("messages_read", {
          conversationId: id,
          readerId: req.user.id
        });
      }
    }

    res.json({
      data: messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderRole: m.senderRole,
        type: m.type,
        body: m.body,
        status: m.status,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/chat/conversations/:id/read - Mark conversation as read
router.post("/conversations/:id/read", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({ error: { message: "Conversation not found" } });
    }

    if (
      conversation.userId !== req.user.id &&
      conversation.vendorId !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const updateResult = await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: req.user.id },
        status: { not: "read" }
      },
      data: {
        status: "read",
        readAt: new Date()
      }
    });

    if (updateResult.count > 0) {
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation_${id}`).emit("messages_read", {
          conversationId: id,
          readerId: req.user.id
        });
      }
    }

    res.json({ success: true, count: updateResult.count });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/chat/conversations/:id/messages - Send message with contact guard
router.post("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body, type = "text", clientId } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: { message: "Message body cannot be empty" } });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({ error: { message: "Conversation not found" } });
    }

    if (
      conversation.userId !== req.user.id &&
      conversation.vendorId !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    // 1. RUN CONTACT GUARD CHECK
    const check = containsContactInfo(body);
    if (check.blocked) {
      // Record violation
      await prisma.contactViolation.create({
        data: {
          userId: req.user.id,
          conversationId: id,
          pattern: check.reason
        }
      });

      // If sender is vendor, increment warnings count
      if (req.user.role === "vendor") {
        const vp = await prisma.vendorProfile.findUnique({
          where: { userId: req.user.id }
        });
        if (vp) {
          const newWarnings = vp.warningsCount + 1;
          const status = newWarnings >= 3 ? "flagged" : vp.status;
          await prisma.vendorProfile.update({
            where: { userId: req.user.id },
            data: {
              warningsCount: newWarnings,
              status
            }
          });
        }
      }

      return res.status(422).json({
        error: {
          code: "CONTACT_SHARING_BLOCKED",
          message: "Sharing personal contact numbers, WhatsApp, UPI IDs or links is strictly blocked for platform safety. Please use Utsavora's masked calling or messaging."
        }
      });
    }

    // 2. CREATE CLEAN MESSAGE
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: req.user.id,
        senderRole: req.user.role,
        type,
        body: body.trim(),
        status: "sent"
      }
    });

    const messageData = {
      id: message.id,
      conversationId: id,
      senderId: message.senderId,
      senderRole: message.senderRole,
      type: message.type,
      body: message.body,
      status: message.status,
      createdAt: message.createdAt,
      clientId: clientId || null
    };

    // Socket.io real-time emit immediately after prisma.message.create
    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${id}`).emit("new_message", messageData);
      // Notify counterpart user channel and sender user channel
      const targetUserId = req.user.id === conversation.userId ? conversation.vendorId : conversation.userId;
      io.to(`user_${targetUserId}`).emit("conversation_update", {
        conversationId: id,
        lastMessage: messageData
      });
      io.to(`user_${req.user.id}`).emit("conversation_update", {
        conversationId: id,
        lastMessage: messageData
      });
    }

    // Non-blocking secondary work: update conversation timestamp
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: message.createdAt }
    }).catch(() => { });

    res.status(201).json({
      data: messageData
    });
  } catch (err) {
    next(err);
  }
});

export default router;
