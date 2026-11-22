# Utsavora System Architecture

This document outlines the architecture, data boundaries, and execution models of the Utsavora event-booking marketplace.

---

## 🏗️ High-Level Structure

```
UTSAVORA/
├── frontend/          # React 18 + Vite SPA (Client-side portal)
│   ├── src/           # Components, offline engines, API client
│   ├── public/        # Static public assets
│   ├── vite.config.js # Vite configuration with /api proxy to :4000
│   └── package.json   # Frontend workspace configuration
│
├── backend/           # Express + Socket.IO REST & Real-Time API (:4000)
│   ├── src/           # Controllers, routes, adapters, middleware, services
│   ├── tests/         # Automated Node.js ESM test suite
│   ├── uploads/       # Masked private documents & public assets (git-ignored)
│   ├── openapi.yaml   # Complete OpenAPI 3.0 specification
│   ├── package.json   # Backend workspace configuration
│   └── .env.example   # Backend environment configuration template
│
├── database/          # Database & Prisma Data Access Layer
│   ├── schema.prisma  # 29 Relational models, indexes, unique constraints
│   ├── seed.js        # Automated seed script with test data & Kadapa branches
│   ├── seed-data/     # Static seed catalogs (planner, locations, dummy vendors)
│   ├── migrations/    # Prisma migration records
│   ├── utsavora.db      # SQLite database file (git-ignored)
│   └── README.md      # Database management guide
│
├── docs/              # System Documentation & Specs
│   ├── ERD.md         # Mermaid entity-relationship diagram
│   ├── utsavora.http    # REST client test requests
│   └── architecture.md# This document
│
├── scripts/           # Automation & Verification Scripts
│   ├── build-singlefile.mjs    # Builds standalone zero-CORS root index.html
│   ├── sync-planner-config.mjs # Synchronizes planner config to frontend offline fallback
│   ├── check.mjs               # Workspace hygiene & integrity auditor
│   ├── db-check.mjs            # Validates database connection & counts
│   ├── db-reset.mjs            # Drops & re-seeds database cleanly
│   ├── db-backup.mjs           # Creates timestamped backup of utsavora.db
│   └── e2e-verification.mjs    # End-to-end regression test suite
│
├── index.html         # GENERATED single-file standalone app (file:// compatible)
├── package.json       # Root orchestration scripts
├── .gitignore         # Strict gitignore rules
└── .env.example       # Root environment variable template
```

---

## 🔒 Privacy & Boundary Enforcement

1. **Role Contact Isolation**:
   - Customer phone numbers and emails are never serialized in vendor responses.
   - Vendor personal phone numbers and emails are never serialized in customer responses.
   - Review author names are obfuscated (e.g. `Ramesh K.`).
2. **ContactGuard Filter**:
   - Chat and inquiry messages are parsed before persistence.
   - Phone numbers (digits, words, spaces), WhatsApp references, external URLs, and UPI addresses are blocked with HTTP `422 CONTACT_SHARING_BLOCKED`.
   - 3 violations result in automatic vendor flagging.
3. **In-App Masked Communication**:
   - Calling uses server-mediated masked sessions; neither party sees the other's real phone number.

---

## ⚡ Dual-Mode Execution

### 1. Live Client-Server Mode
- Frontend runs on `http://localhost:5173` (Vite dev server) or served statically by backend at `http://localhost:4000`.
- Backend runs on `http://localhost:4000` connected to `database/utsavora.db` via Prisma.
- API requests route to `/api/v1/*` with JWT access & refresh tokens.
- Interactive Swagger documentation lives at `http://localhost:4000/docs`.

### 2. Standalone Offline / Double-Click Mode (`file://`)
- `npm run build:standalone` bundles all JS and CSS into the self-contained root `index.html`.
- Double-clicking `index.html` launches the app directly from disk without web server requirements.
- `src/api/client.js` detects when backend is unreachable and transparently routes to `src/api/mock.js` and `src/offline/planner.js`, maintaining full app functionality in offline demo mode.
