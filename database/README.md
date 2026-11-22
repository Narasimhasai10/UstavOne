# Utsavora Database Layer

This directory contains the database schema, seed scripts, seed catalogs, and local SQLite database (`utsavora.db`) for Utsavora.

---

## 📁 Directory Contents

- `schema.prisma`: Complete Prisma schema containing all 29 models, relations, composite unique indexes, and foreign keys.
- `seed.js`: Database seeder creating planner configs, Indian cities (Kadapa default with 0.9 price multiplier), test customer (`9390075877` / `sai@1398`), test vendor (`sai_halls` / `Utsavora@123`), admin (`admin` / `Admin@12345`), Kadapa branches, works, and bookings.
- `seed-data/`: JSON catalogs for planner configuration, Indian locations, events, and dummy vendors.
- `migrations/`: Prisma migration directory.
- `utsavora.db`: Local SQLite database file (git-ignored).

---

## 🛠️ Database Commands (from Root)

```bash
# Check database connectivity, tables, and row counts
npm run db:check

# Push schema changes to database
npm run db:push --prefix backend

# Seed the database
npm run db:seed --prefix backend

# Reset database (cleans, applies schema, and re-seeds)
npm run db:reset

# Create a timestamped backup of database/utsavora.db
npm run db:backup
```

---

## 🐘 Switching to PostgreSQL in Production

1. In `database/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Update `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/utsavora?schema=public"
   ```
3. Run migrations and seed:
   ```bash
   npx prisma migrate dev --schema database/schema.prisma --name init
   node database/seed.js
   ```
