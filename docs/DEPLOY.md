# Utsavora Production Deployment Guide

A beginner-friendly, click-by-click manual for deploying **Utsavora** for **100% FREE** using **Render** (Web Service), **Neon** (Serverless PostgreSQL), and **Cloudinary** (Media CDN).

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Utsavora Customers & Vendors    │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTPS
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │             Render Web Service               │
                      │   - Node.js / Express API Backend            │
                      │   - Prebuilt React SPA Static Distribution   │
                      │   - WebSocket / Socket.IO Gateway            │
                      └──────────────┬──────────────────┬────────────┘
                                     │                  │
                PostgreSQL (SSL)     │                  │ Signed REST API
                                     ▼                  ▼
      ┌────────────────────────────────┐      ┌──────────────────────────────┐
      │       Neon PostgreSQL          │      │     Cloudinary Media CDN     │
      │ - Serverless Postgres 16       │      │ - Public Event Photos        │
      │ - Branching & Auto-backups     │      │ - Authenticated Documents    │
      │ - 0.5 GiB Free Storage         │      │ - 25 GB Free Bandwidth       │
      └────────────────────────────────┘      └──────────────────────────────┘
```

### Free Tier Limits & Resource Planning

| Service | Free Tier Allocation | How Utsavora Optimizes It |
| :--- | :--- | :--- |
| **Render** | 750 free instance hours / month | Entire app runs as a single web service. Spins down after 15 min idle; keep-alive ping prevents cold starts. |
| **Neon** | 0.5 GiB storage, 1 project, autosuspend | Compact schema with indexed queries; connection pooling (`?sslmode=require`). |
| **Cloudinary**| 25 credits (~25 GB managed storage & bandwidth) | WebP/JPEG compression; image transformations and fast global CDN caching. |
| **UptimeRobot**| 50 HTTP monitors, 5 min checks | 1 monitor pings `/health` every 14 minutes to prevent Render free instance spin-down. |

---

## Step 1: Create Free Neon PostgreSQL Database

1. Navigate to **[neon.tech](https://neon.tech/)** and sign up or log in with GitHub.
2. Click **Create a project**.
   - **Project name**: `utsavora-production`
   - **Postgres version**: `16` (default)
   - **Region**: Choose the region closest to your users or Render service (e.g., `US East (Ohio)` or `AWS Oregon`).
3. Once created, your dashboard will display the **Connection Details** modal.
4. Set the dropdown to **Prisma** or **PostgreSQL connection string**.
5. Copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:npg_SecretPass123@ep-cool-cloud-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   > [!IMPORTANT]
   > Keep this string ready. You will paste this into Render as `DATABASE_URL`.

---

## Step 2: Set Up Free Cloudinary Media Storage

1. Go to **[cloudinary.com](https://cloudinary.com/)** and create a free account.
2. Open the **Cloudinary Console Dashboard**.
3. Under **Product Environment Credentials**, locate:
   - **Cloud Name**: (e.g., `dzxyz123`)
   - **API Key**: (e.g., `123456789012345`)
   - **API Secret**: Click the eye icon to reveal (e.g., `aBcDeFgHiJkLmNoPqRsTuVwXyZ`)
4. *(Optional)* Go to **Settings > Security** and confirm that **Strict Transformations** is disabled so uploaded vendor photos render cleanly.

---

## Step 3: Deploy on Render

### Option A: 1-Click Blueprint (Recommended)

1. Log in to **[render.com](https://render.com/)** with your GitHub account.
2. Go to **Blueprints** and click **New Blueprint Instance**.
3. Select your repository: `Narasimhasai10/Utsavora`.
4. Branch: select `deploy-setup` (or `main` after merging).
5. Render detects `render.yaml`. Fill in the prompted secret variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `ADMIN_PASSWORD`: A secure password for the admin account (at least 8 characters).
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary Cloud Name.
   - `CLOUDINARY_API_KEY`: Your Cloudinary API Key.
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API Secret.
6. Click **Apply**. Render will automatically build the React frontend, generate the PostgreSQL schema, apply database migrations, seed the initial production records, and launch the server.

---

### Option B: Manual Web Service Setup

1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository: `Narasimhasai10/Utsavora`.
3. Fill in the service configuration:
   - **Name**: `utsavora`
   - **Region**: Choose the region matching or close to your Neon database.
   - **Branch**: `main` (or `deploy-setup`)
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend && node scripts/use-db.mjs postgres && npx prisma generate --schema database/schema.prisma && node scripts/db-deploy.mjs && node scripts/db-seed-prod.mjs
     ```
   - **Start Command**:
     ```bash
     npm run start --prefix backend
     ```
   - **Plan**: `Free`
4. Expand **Advanced** and configure **Environment Variables**:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & CSP |
| `PORT` | `10000` | Port assigned by Render |
| `DATABASE_URL` | `postgresql://...` | Neon PostgreSQL connection string |
| `JWT_SECRET` | *(Random 32+ char string)* | Secure token signing key |
| `REFRESH_SECRET` | *(Random 32+ char string)* | Secure refresh token key |
| `ADMIN_PASSWORD` | *(Secure password)* | Password for `admin` account |
| `STORAGE_PROVIDER` | `cloudinary` | Stores photos in Cloudinary |
| `CLOUDINARY_CLOUD_NAME` | *(Your Cloudinary name)* | Cloudinary account name |
| `CLOUDINARY_API_KEY` | *(Your Cloudinary API key)* | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | *(Your Cloudinary secret)* | Cloudinary API Secret |
| `CLOUDINARY_FOLDER` | `utsavora` | Subfolder in Cloudinary |
| `CORS_ORIGINS` | `https://utsavora.onrender.com` | Allowed browser origins |
| `HOLD_MINUTES` | `10` | Booking hold expiry window |
| `RATE_LIMIT_LOGIN_MAX` | `30` | Max login attempts per 15 min |

5. Under **Health Check Path**, enter: `/health`.
6. Click **Create Web Service**.

---

## Step 4: Verification & Smoke Test

Once Render finishes the build (usually 2–3 minutes), test the deployment from your local machine:

```bash
# Run the automated smoke suite against your Render URL
npm run smoke -- https://utsavora.onrender.com
```

The smoke suite verifies:
1. `GET /health` returns `{ status: "healthy", db: "ok" }`.
2. Public locations endpoint loads cities (Kadapa, Rajahmundry, etc.).
3. Customer test login works (`9390075877` / `sai@1398`).
4. Smart Planner engine calculates budgets.
5. Vendor portal login works (`sai_halls` / `Vedika@123`).
6. Vendor catalog and photo serving are active.
7. Socket.IO gateway connection is operational.

---

## Step 5: Prevent Spin-Down with UptimeRobot (Free)

Render free instances sleep after 15 minutes of inactivity, causing a 30–50 second cold-start delay for the next visitor. You can keep it warm 24/7 for free:

1. Sign up for free at **[uptimerobot.com](https://uptimerobot.com/)**.
2. Click **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Utsavora Web Service`
   - **URL (or IP)**: `https://utsavora.onrender.com/health`
   - **Monitoring Interval**: `Every 14 minutes`
3. Click **Create Monitor**.
4. UptimeRobot will ping your `/health` endpoint every 14 minutes, keeping your server warm without consuming extra instance hours.

---

## Switching Between Local SQLite and PostgreSQL

You can toggle between local development and production modes at any time without data loss:

```bash
# Switch to Local SQLite Development (default)
npm run db:use:sqlite
npm run dev

# Switch to Remote PostgreSQL / Neon Mode
npm run db:use:postgres
# (Set DATABASE_URL in .env before running migrations or start)
npm run db:deploy
```

---

## Troubleshooting

### 1. Cold Start Delay
- **Symptom**: The first request after a long time takes ~30 seconds.
- **Fix**: Verify UptimeRobot monitor is active and pinging `https://utsavora.onrender.com/health` every 14 minutes.

### 2. Database Connection Error on Neon
- **Symptom**: `PrismaClientInitializationError: Can't reach database server`.
- **Fix**: Neon free tier databases auto-suspend when inactive. Ensure your connection string includes `?sslmode=require&connect_timeout=15`. Prisma will automatically wake up Neon upon connection.

### 3. Startup Validation Halts
- **Symptom**: In Render logs: `Production startup validation failed. Server halting.`
- **Fix**: Verify that:
  - `JWT_SECRET` is at least 32 characters long.
  - `REFRESH_SECRET` is at least 32 characters long.
  - `ADMIN_PASSWORD` is set and not equal to the default `Admin@12345`.
  - `DATABASE_URL` starts with `postgres://` or `postgresql://`.

### 4. CORS Errors in Browser
- **Symptom**: `Access to fetch has been blocked by CORS policy`.
- **Fix**: In Render environment variables, ensure `CORS_ORIGINS` includes your custom domain or Render URL (e.g. `https://utsavora.onrender.com`).
