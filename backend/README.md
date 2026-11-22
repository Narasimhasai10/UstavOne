# Utsavora Backend & Database Architecture

Production-ready, privacy-first Node.js 20 & Prisma backend for **Utsavora** — the event-booking marketplace for Indian families, function halls, caterers, and vendors.

---

## ⚡ 5-Step Quickstart

Zero setup required. Runs out of the box with SQLite (`dev.db`).

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Initialize SQLite database schema
npm run db:push

# 4. Seed database with Kadapa branches, works, bookings, and test accounts
npm run db:seed

# 5. Start the backend server (runs on http://localhost:4000)
npm run dev
```

Interactive OpenAPI Swagger UI is immediately available at:
👉 **[http://localhost:4000/docs](http://localhost:4000/docs)**

---

## 🔐 Pre-Seeded Test Accounts

| Role | Identifier / Phone | Username | Password | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **User** | `9390075877` | — | `sai@1398` | Test customer account (Kadapa) with 0 initial bookings |
| **Vendor** | `9849012345` | `sai_halls` | `Utsavora@123` | Sai Function Halls (2 hall branches, 1 catering branch in Kadapa, 12 months revenue history) |
| **Admin** | `9999999999` | `admin` | `Admin@12345` | Administrator with document verification & analytics access |

---

## ⚙️ Environment Variables

Configuration is loaded from `backend/.env`.

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for Express & Socket.IO server |
| `DATABASE_URL` | `"file:./dev.db"` | Database connection string (SQLite file or PostgreSQL URI) |
| `JWT_SECRET` | `"utsavora_jwt_secret_dev_2026_secure"` | HMAC-SHA256 secret for signing Access Tokens |
| `JWT_EXPIRES_IN` | `"15m"` | Access Token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | `"7d"` | Refresh Token TTL |
| `COMMISSION_RATE` | `0.10` | Platform commission (10%) |
| `GST_RATE` | `0.18` | Goods & Services Tax (18%) |
| `CORS_ORIGIN` | `"http://localhost:5173,http://localhost:4173"` | Allowed frontend origins |
| `PAYMENT_PROVIDER` | `"mock"` | `"mock"` for instant testing or `"razorpay"` for live |
| `CALL_PROVIDER` | `"mock"` | In-app masked calling adapter |

---

## 🔄 Switching to PostgreSQL

The database schema is 100% compatible with PostgreSQL with zero code changes:

1. In `backend/prisma/schema.prisma`, update the datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Update your `backend/.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/utsavora?schema=public"
   ```
3. Run migration:
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

---

## 🛡️ Privacy & Security Features

1. **Server-Side Phone/Email Guard**: Vendor API responses never contain user contact details. User API responses never contain vendor personal contact details.
2. **Contact Sharing Protection (`ContactGuard`)**: Message bodies are filtered to reject 10-digit mobile numbers (including spaced/hyphenated/spelled-out digits), WhatsApp keywords, external links, and UPI IDs, returning HTTP `422 CONTACT_SHARING_BLOCKED`.
3. **Atomic Double-Booking Prevention**: Database enforces a composite unique constraint on `(branchId, date, slot, activeKey)`. Active bookings and 15-minute holds hold `activeKey="ACTIVE"`; cancelled or expired bookings release the constraint with `activeKey=null`.
4. **Brute Force Lockout**: 5 failed consecutive logins lock an account for 15 minutes.
5. **Tiered Refund Policy**:
   - Cancelled $\ge$ 7 days before event: **100% refund**.
   - Cancelled between 48 hours and 7 days: **50% refund**.
   - Cancelled $<$ 48 hours: **0% refund**.
   - Vendor cancellation: **100% refund unconditionally**.

---

## 🧪 Running Automated Tests

Run the complete 50-test suite with Node's native ESM test runner:

```bash
cd backend
npm test
```

Test coverage includes:
- `tests/contactGuard.test.js`: 33 privacy and regex pattern cases.
- `tests/planner.test.js`: 5 worked budget, guest scaling, and multi-day tests.
- `tests/auth.test.js`: Hashing, JWT rotation, and brute-force lockout.
- `tests/bookings.test.js`: Concurrency race conditions, hold expiration, and refund calculations.
- `tests/privacy.test.js`: Public and vendor data isolation checks.
- `tests/revenue.test.js`: 12-month series generation and growth rate calculation.
