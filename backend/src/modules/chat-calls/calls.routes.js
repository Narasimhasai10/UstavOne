import { Router } from "express";
import { prisma } from "../../utils/prisma.js";
import { requireAuth } from "../auth-users-admin/auth.middleware.js";
import { getCallProvider } from "./adapters/calls/index.js";

const router = Router();
const callProvider = getCallProvider();

// POST /api/v1/calls/initiate - Start masked in-app call
router.post("/initiate", requireAuth, async (req, res, next) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: { message: "conversationId is required" } });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        branch: true,
        user: true,
        vendor: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: { message: "Conversation not found" } });
    }

    const isUser = req.user.id === conversation.userId;
    const isVendor = req.user.id === conversation.vendorId;

    if (!isUser && !isVendor && req.user.role !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const callerId = req.user.id;
    const calleeId = isUser ? conversation.vendorId : conversation.userId;

    // PRIVACY ENFORCEMENT: Never expose actual phone numbers!
    const maskedCalleeLabel = isUser
      ? `${conversation.branch.name} (Masked Call)`
      : `${conversation.user.name.split(" ")[0]} (Customer - Masked Call)`;

    // Call adapter initiate
    const session = await callProvider.initiateCall({
      callerId,
      calleeId,
      conversationId
    });

    const callRecord = await prisma.call.create({
      data: {
        conversationId,
        callerId,
        calleeId,
        status: "ringing",
        providerRef: session.providerRef
      }
    });

    // Notify callee via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${calleeId}`).emit("incoming_call", {
        callId: callRecord.id,
        conversationId,
        callerLabel: isUser ? "Customer" : conversation.branch.name
      });
    }

    res.json({
      data: {
        callId: callRecord.id,
        status: callRecord.status,
        maskedCalleeLabel,
        sessionToken: session.sessionToken
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/calls/:id/answer
router.post("/:id/answer", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const call = await prisma.call.findUnique({
      where: { id },
      include: { conversation: true }
    });

    if (!call) {
      return res.status(404).json({ error: { message: "Call not found" } });
    }

    if (call.calleeId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const updated = await prisma.call.update({
      where: { id },
      data: { status: "connected" }
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${call.conversationId}`).emit("call_status", {
        callId: id,
        status: "connected"
      });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/calls/:id/end
router.post("/:id/end", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const call = await prisma.call.findUnique({
      where: { id }
    });

    if (!call) {
      return res.status(404).json({ error: { message: "Call not found" } });
    }

    const now = new Date();
    const durationSec = Math.max(0, Math.round((now.getTime() - new Date(call.startedAt).getTime()) / 1000));

    const updated = await prisma.call.update({
      where: { id },
      data: {
        status: "ended",
        endedAt: now,
        durationSec
      }
    });

    // Record call log message in conversation
    await prisma.message.create({
      data: {
        conversationId: call.conversationId,
        senderId: req.user.id,
        senderRole: req.user.role,
        type: "call_log",
        body: `Call ended (${durationSec}s)`,
        status: "delivered"
      }
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${call.conversationId}`).emit("call_status", {
        callId: id,
        status: "ended",
        durationSec
      });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
