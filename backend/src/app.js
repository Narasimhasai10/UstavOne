import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import yaml from "yaml";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Feature Modules
import authUsersAdminModule from "./modules/auth-users-admin/index.js";
import plannerBookingsPayModule from "./modules/planner-bookings-pay/index.js";
import chatCallsModule from "./modules/chat-calls/index.js";
import vendorDocsStorageModule from "./modules/vendor-docs-storage/index.js";

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS setup supporting Vite dev, previews, and local file:// origin
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4000",
  "http://127.0.0.1:4000"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin === "null") {
      callback(null, true);
    } else {
      callback(null, true); // Permissive for local dev & testing
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static public uploads (photos, avatars)
const uploadBase = config.uploadDir ? path.resolve(config.uploadDir) : path.resolve(__dirname, "../uploads");
const publicUploads = path.resolve(uploadBase, "public");
if (fs.existsSync(publicUploads)) {
  app.use("/uploads/public", express.static(publicUploads));
} else {
  const rootUploads = path.resolve("backend/uploads/public");
  if (fs.existsSync(rootUploads)) {
    app.use("/uploads/public", express.static(rootUploads));
  }
}

// Serve static frontend build if present (e.g. for npm start)
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
      customSiteTitle: "UstavOne API Documentation"
    }));
  }
} catch (e) {
  // Silent swagger fallback
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "healthy",
    version: "1.0.0",
    service: "ustavone-backend",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

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
