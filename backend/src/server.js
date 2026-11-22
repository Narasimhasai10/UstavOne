import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cron from "node-cron";
import app from "./app.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./utils/prisma.js";
import { verifyAccessToken } from "./utils/jwt.js";
import { releaseExpiredHolds } from "./modules/planner-bookings-pay/holds.js";

// Production Startup Validation
if (config.nodeEnv === "production") {
  const errors = [];

  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret.includes("utsavora-dev-jwt")) {
    errors.push("JWT_SECRET must be at least 32 characters long and not use the default development secret.");
  }

  if (!config.refreshSecret || config.refreshSecret.length < 32 || config.refreshSecret.includes("utsavora-dev-refresh")) {
    errors.push("REFRESH_SECRET must be at least 32 characters long and not use the default development secret.");
  }

  if (!config.databaseUrl || (!config.databaseUrl.startsWith("postgres://") && !config.databaseUrl.startsWith("postgresql://"))) {
    errors.push("DATABASE_URL in production must be a valid PostgreSQL connection string starting with postgres:// or postgresql://.");
  }

  if (!config.adminPassword || config.adminPassword === "Admin@12345" || config.adminPassword.length < 8) {
    errors.push("ADMIN_PASSWORD must be configured with a secure non-default password (at least 8 characters).");
  }

  if (errors.length > 0) {
    logger.fatal({ validationErrors: errors }, "❌ Production startup validation failed. Server halting.");
    console.error("FATAL: Production environment misconfigured:");
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}

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
// 1. Every minute: Expire unpaid booking holds (> config.holdMinutes) and release date locks
cron.schedule("* * * * *", async () => {
  try {
    const releasedCount = await releaseExpiredHolds(prisma);
    if (releasedCount > 0) {
      logger.info({ count: releasedCount }, "Cron: Expired unpaid booking holds released");
    }

    // 2. Auto-complete past confirmed bookings
    const now = new Date();
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
  logger.info(`Utsavora backend running on http://localhost:${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/docs`);
});

// Graceful shutdown
let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Gracefully shutting down Utsavora backend...`);

  // Force close after 10s if hanging
  const forceTimer = setTimeout(() => {
    logger.error("Forced process shutdown due to timeout.");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("Database disconnected. Exiting process.");
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, "Error during Prisma disconnect");
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { server, io };
