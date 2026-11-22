# Utsavora – Event-Booking Marketplace

Utsavora is an event-planning and booking marketplace (function halls, catering, decoration, band, wedding cards) tailored for Indian families and vendors.

> **Offline Demo Mode**: Open index.html by double-clicking it directly from your file manager (zero server, zero install, 100% file:// compatible).  
> **Test customer login**: phone `9390075877`, password `sai@1398`

---

## ⚡ 5 Setup Steps

```bash
# 1. Install dependencies, initialize database, and seed test data
npm run setup

# 2. Start full-stack development environment (Backend 4000 + Frontend 5173)
npm run dev

# 3. (Alternative) Run backend serving both API and bundled frontend at http://localhost:4000
npm start

# 4. Build single-file offline standalone app (generates root index.html)
npm run build:standalone

# 5. Run integrity checks and test suites
npm run check
npm test
```

---

## 🔐 Test Logins

| Role | Username / Identifier | Password | Access Details |
| :--- | :--- | :--- | :--- |
| **Customer** | `9390075877` | `sai@1398` | User portal (Kadapa), smart AI planner, bookings, real-time chat, calls |
| **Vendor** | `sai_halls` (or `9849012345`) | `Utsavora@123` | Sai Function Halls (2 halls, 1 catering branch, 12 months historical bookings & analytics) |
| **Admin** | `admin` (or `9999999999`) | `Admin@12345` | Administrative controls, automated document verification, system stats |

---

## 📁 Project Structure

```
UTSAVORA/
├── frontend/               # React 18 + Vite SPA client
│   ├── src/
│   │   ├── api/            # API client with automatic offline fallback (mock.js)
│   │   ├── components/     # UI screens, modals, planner forms, vendor dashboard
│   │   ├── offline/        # Offline fallback planner and synchronized configs
│   │   ├── services/       # Store, auth, booking, and chat services
│   │   └── utils/          # Location, contact guard, contrast, and verification utilities
│   ├── public/             # Static public assets
│   ├── vite.config.js      # Vite build & proxy configuration (/api -> :4000)
│   └── package.json        # Frontend workspace configuration
│
├── backend/                # Express & Socket.IO REST API (Port 4000)
│   ├── src/
│   │   ├── adapters/       # Masked calls, document verifier, mock payments
│   │   ├── middleware/     # Auth, ContactGuard privacy filter, rate-limits
│   │   ├── routes/         # Auth, vendors, planner, bookings, chat, admin
│   │   ├── services/       # Planner source of truth, pricing, revenue
│   │   └── utils/          # JWT, logger, prisma client, audit logger
│   ├── tests/              # 50 Automated unit & integration tests
│   ├── uploads/            # Masked private documents & public assets (git-ignored)
│   ├── openapi.yaml        # Complete OpenAPI 3.0 specification
│   ├── package.json        # Backend workspace configuration
│   └── .env.example        # Backend environment variables template
│
├── database/               # Database Layer & Prisma ORM
│   ├── schema.prisma       # 29 Relational models, indexes & unique constraints
│   ├── seed.js             # Seeder script for Kadapa vendors, branches, bookings
│   ├── seed-data/          # Master seed catalogs (planner, locations, dummy vendors)
│   ├── migrations/         # Prisma migration history
│   ├── utsavora.db          # SQLite database file (git-ignored)
│   └── README.md           # Database management documentation
│
├── docs/                   # System Documentation
│   ├── ERD.md              # Mermaid diagram of all 29 database models
│   ├── utsavora.http        # REST Client ready-to-run API requests
│   └── architecture.md     # Full architectural and privacy specification
│
├── scripts/                # Workspace Automation & Quality Assurance
│   ├── build-singlefile.mjs    # Inlines assets into self-contained root index.html
│   ├── sync-planner-config.mjs # Copies planner config to frontend offline fallback
│   ├── check.mjs               # Workspace integrity & hygiene auditor
│   ├── db-check.mjs            # Validates database connection & counts
│   ├── db-reset.mjs            # Resets and re-seeds SQLite database cleanly
│   ├── db-backup.mjs           # Creates timestamped backup of database/utsavora.db
│   ├── dev.mjs                 # Cross-platform parallel dev runner (:4000 + :5173)
│   ├── setup.mjs               # One-click workspace initialization script
│   └── e2e-verification.mjs    # Regression & verification suite
│
├── index.html              # GENERATED single-file standalone app (file:// compatible)
├── package.json            # Root workspace orchestration scripts
├── .gitignore              # Clean gitignore (UTF-8, LF, zero tracked leaks)
└── .env.example            # Root environment variables template
```

---

## 🛠️ Root Commands

| Command | Description |
| :--- | :--- |
| `npm run setup` | Installs dependencies, initializes database, runs seeds, builds standalone app |
| `npm run dev` | Runs backend (:4000) with Swagger `/docs` and frontend (:5173) together |
| `npm run build` | Builds frontend production assets |
| `npm run build:standalone` | Compiles zero-CORS single-file `index.html` for offline double-click use |
| `npm start` | Runs backend serving both the REST API and the bundled web application |
| `npm test` | Runs the full 80-test automated suite (backend + frontend) |
| `npm run check` | Audits workspace hygiene, stray HTML files, duplicate CSS, and script tags |
| `npm run db:check` | Verifies database connection and reports model row counts |
| `npm run db:reset` | Wipes, pushes schema, and re-seeds `database/utsavora.db` |
| `npm run db:backup` | Saves a backup copy to `database/backups/` |
