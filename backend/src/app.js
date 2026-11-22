import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import yaml from "yaml";
import swaggerUi from "swagger-ui-express";
import compression from "compression";
import { config } from "./config.js";
import { prisma } from "./utils/prisma.js";
import { errorHandler } from "./middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Feature Modules
import authUsersAdminModule from "./modules/auth-users-admin/index.js";
import plannerBookingsPayModule from "./modules/planner-bookings-pay/index.js";
import chatCallsModule from "./modules/chat-calls/index.js";
import vendorDocsStorageModule from "./modules/vendor-docs-storage/index.js";

const app = express();
const isProd = config.nodeEnv === "production";

// Enable reverse-proxy trust for correct client IP detection, rate limiting and secure headers on Render
app.set("trust proxy", 1);

// HTTP response compression (gzip/deflate)
app.use(compression());

// Security headers with CSP
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com"
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: [
              "'self'",
              "data:",
              "blob:",
              "https://res.cloudinary.com",
              "https://images.unsplash.com"
            ],
            connectSrc: [
              "'self'",
              "ws:",
              "wss:",
              "http://localhost:*",
              "https://*.render.com",
              "https://res.cloudinary.com"
            ],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
          }
        }
      : false
  })
);

// CORS setup supporting Vite dev, previews, production origins, and local file:// origin
const defaultLocalOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4000",
  "http://127.0.0.1:4000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check configured CORS origins or default local origins
      if (
        config.corsOrigins.includes(origin) ||
        defaultLocalOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      // Handle file:// / null origin
      if (origin === "null") {
        if (!isProd || config.allowFileOrigin || config.corsOrigins.includes("null")) {
          return callback(null, true);
        }
        return callback(new Error("CORS origin 'null' not allowed in production"));
      }

      // Permissive in dev/test
      if (!isProd) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static public uploads (photos, avatars)
const uploadBase = config.uploadDir ? path.resolve(config.uploadDir) : path.resolve(__dirname, "../uploads");
const publicUploads = path.resolve(uploadBase, "public");
if (!fs.existsSync(publicUploads)) {
  try {
    fs.mkdirSync(publicUploads, { recursive: true });
  } catch {
    // Ephemeral or read-only container fallback
  }
}
const staticUploadOptions = {
  maxAge: "7d",
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  }
};
app.use("/uploads/public", express.static(publicUploads, staticUploadOptions));
app.use("/uploads", express.static(uploadBase, staticUploadOptions));

// Serve static frontend build if present (e.g. for npm start / Render full-stack service)
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const rootIndex = path.resolve(__dirname, "../../index.html");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Swagger API Documentation at /docs
try {
  let openApiPath = path.resolve("backend/openapi.yaml");
  if (!fs.existsSync(openApiPath)) {
    openApiPath = path.resolve("openapi.yaml");
  }
  if (fs.existsSync(openApiPath)) {
    const file = fs.readFileSync(openApiPath, "utf8");
    const swaggerDoc = yaml.parse(file);
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
      customSiteTitle: "Utsavora API Documentation"
    }));
  }
} catch {
  // Silent swagger fallback
}

// Health check handler verifying database connectivity
const handleHealthCheck = async (req, res) => {
  let dbStatus = "ok";
  let dbError = null;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch (err) {
    dbStatus = "error";
    dbError = err.message;
  }

  const isHealthy = dbStatus === "ok";
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    db: dbStatus,
    service: "utsavora-backend",
    version: "1.0.0",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    ...(dbError ? { error: dbError } : {})
  });
};

app.get("/health", handleHealthCheck);
app.get("/api/v1/health", handleHealthCheck);
app.get("/api/v1/public/health", handleHealthCheck);

// Feature Module Routes mounted under /api/v1
app.use("/api/v1", authUsersAdminModule);
app.use("/api/v1", plannerBookingsPayModule);
app.use("/api/v1", chatCallsModule);
app.use("/api/v1", vendorDocsStorageModule);

// Fallback to client-side index.html for non-API routes
app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/docs") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/uploads")
  ) {
    return next();
  }
  const distIndex = path.join(frontendDist, "index.html");
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
