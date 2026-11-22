import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cron from "node-cron";
import app from "./app.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./utils/prisma.js";
import { verifyAccessToken } from "./utils/jwt.js";

const server = http.createServer(app);

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach io to app so route handlers can emit events
app.set("io", io);

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    // Allow anonymous or handle later
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    socket.user = payload;
    return next();
  } catch (err) {
    logger.warn({ err: err.message }, "Socket auth token invalid");
    return next();
  }
});

io.on("connection", (socket) => {
  if (socket.user) {
    socket.join(`user_${socket.user.id}`);
    logger.debug({ userId: socket.user.id, socketId: socket.id }, "User connected to personal socket room");
  }

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  socket.on("disconnect", () => {
    // Disconnect cleanup
  });
});

// SCHEDULED BACKGROUND TASKS (node-cron)
// 1. Every minute: Expire unpaid booking holds (> 15 minutes) and release date locks
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: "pending_payment",
        holdExpiresAt: { lt: now }
      },
      select: { id: true, code: true }
    });

    if (expiredBookings.length > 0) {
      logger.info({ count: expiredBookings.length }, "Expiring unpaid booking holds");

      for (const b of expiredBookings) {
        await prisma.$transaction(async (tx) => {
          // Release dates
          await tx.bookingDate.updateMany({
            where: { bookingId: b.id },
            data: {
              isActive: false,
              activeKey: null
            }
          });

          // Mark booking expired
          await tx.booking.update({
            where: { id: b.id },
            data: {
              status: "expired",
              holdExpiresAt: null
            }
          });
        });
      }
    }

    // 2. Auto-complete past confirmed bookings
    const todayYMD = now.toISOString().split("T")[0];
    const completedCount = await prisma.booking.updateMany({
      where: {
        status: "confirmed",
        endDate: { lt: todayYMD }
      },
      data: {
        status: "completed"
      }
    });

    if (completedCount.count > 0) {
      logger.info({ count: completedCount.count }, "Auto-completed matured bookings");
    }
  } catch (err) {
    logger.error({ err: err.message }, "Error running background hold expiration cron");
  }
});

// Start Server
const PORT = config.port || 4000;
server.listen(PORT, () => {
  logger.info(`UstavOne backend running on http://localhost:${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/docs`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Gracefully shutting down UstavOne backend...");
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Database disconnected. Exiting process.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server, io };
