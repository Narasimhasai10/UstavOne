# Utsavora Data Migration Guide
### Migrating Local SQLite Data & Media to Production Neon PostgreSQL + Cloudinary

This step-by-step guide explains how to migrate all existing accounts, vendors, branches, bookings, menu items, and media assets from your local development environment (`database/utsavora.db` and `backend/uploads/`) to your production **Neon PostgreSQL** database and **Cloudinary** media storage.

---

> [!CAUTION]
> **One-Time Migration Policy**
> Data migration is intended as a **one-time transfer** before opening your site to live users.
> Once real customers and vendors begin signing up, creating bookings, and making payments on your live deployed site, **NEVER run this migration script again** and **NEVER run `npm run db:seed` or `npm run db:seed:prod`** against production, as that would overwrite real customer data.

---

## Safety & Security Principles

1. **Credentials Isolation**: Never commit connection strings or API keys to git or paste them into chat. Always set them as session environment variables in your local PowerShell terminal.
2. **Export Privacy**: The exported data contains phone numbers, emails, and bcrypt password hashes. The `data-export/` folder is pre-configured in `.gitignore`. Always verify with `git status` that nothing from `data-export/` is staged.
3. **Session & Security Exclusions**: The migration scripts automatically exclude active sessions, refresh tokens (`RefreshToken`), lockout counters (`failedLogins`), and audit logs (`AuditLog`).
4. **Admin Security**: The local admin password hash is never copied. The admin account password on production is generated freshly from `ADMIN_PASSWORD`.
5. **Dry-Run Safe**: Both media upload and data import support `--dry-run` to preview actions before modifying anything.

---

## Click-by-Click Migration Steps

### Step 1: Create a Timestamped Local Backup

Before touching anything, create a complete backup of both your local SQLite database and your media uploads directory:

```powershell
npm run db:backup
```

**Output**:
- SQLite database backup: `database/backups/utsavora-backup-<timestamp>.db`
- Media uploads backup: `database/backups/uploads-backup-<timestamp>/`

---

### Step 2: Export Data from Local SQLite

Extract all data across all 27 models in dependency order:

```powershell
npm run data:export
```

This creates:
- `data-export/data.json`: All records with preserved IDs, dates, and relations.
- `data-export/manifest.json`: Row counts per model, file paths, and SHA-256 integrity checksum.

Verify that git does not track the export:
```powershell
git status
```
Confirm `data-export/` is not listed under untracked files.

---

### Step 3: Inspect the Export Manifest

Open `data-export/manifest.json` and review the summary:
- **Total Models**: 27
- **Users**: 53
- **Vendor Profiles**: 49
- **Branches**: 161 (80 Halls, 81 Caterers)
- **Menu Items**: 1,532
- **File Records**: 153
- **Bookings**: 36

---

### Step 4: Configure Terminal Session Credentials

Open a PowerShell terminal and set your production environment variables. These variables will remain active **only for the current terminal session** and will vanish when you close the window.

```powershell
# 1. PostgreSQL Connection Strings (from your Neon Console -> Connection Details):
$env:DATABASE_URL = "postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR-PROJECT.us-east-2.aws.neon.tech/neondb?sslmode=require"
$env:DIRECT_URL   = "postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR-PROJECT.us-east-2.aws.neon.tech/neondb?sslmode=require"

# 2. Cloudinary Media Storage Credentials (from Cloudinary Dashboard -> API Keys):
$env:CLOUDINARY_CLOUD_NAME = "your_cloud_name"
$env:CLOUDINARY_API_KEY    = "your_api_key"
$env:CLOUDINARY_API_SECRET = "your_api_secret"

# 3. Secure Admin Account Password for Production:
$env:ADMIN_PASSWORD        = "YourStrongAdminPassword123!"
```

---

### Step 5: Upload Media Assets to Cloudinary

#### A. Run Dry-Run Preview First:
```powershell
npm run data:media -- --dry-run
```
This inspects all 188 files on disk, verifies zero missing assets, and simulates Cloudinary URLs.

#### B. Run the Real Media Upload:
```powershell
npm run data:media
```
**What happens**:
- Public photos under `backend/uploads/public/` are uploaded to Cloudinary folder `utsavora/photos/` with stable public IDs matching their filenames (prevents duplicate assets on reruns).
- Private documents under `backend/uploads/private/` (if any) are uploaded as `authenticated` assets to `utsavora/documents/`.
- Writes `data-export/media-map.json` mapping every local path (e.g. `/uploads/public/branch-sai-hall-1-cover.svg`) to its live Cloudinary HTTPS URL.

---

### Step 6: Deploy Database Schema to PostgreSQL

Ensure your Neon database has the latest tables deployed:

```powershell
# Generate schema for PostgreSQL
node scripts/use-db.mjs postgres

# Push schema directly to Neon PostgreSQL
npx prisma db push --schema database/schema.prisma
```

---

### Step 7: Test Import in Dry-Run Mode

Before writing to production, simulate the entire import:

```powershell
npm run data:import -- --dry-run
```

**Verification Checklist**:
- [x] Host printed matches your Neon project host.
- [x] Target URL is properly masked (`****@`).
- [x] Confirms 153/153 FileRecord paths rewritten to Cloudinary URLs.
- [x] Admin password configured from `$env:ADMIN_PASSWORD`.
- [x] Checks for zero account conflicts.

---

### Step 8: Execute the Real Database Import

Run the import script with the confirmation flag:

```powershell
npm run data:import -- --confirm
```

*(Note: If importing into an existing database that already contains accounts, add the `--merge` flag: `npm run data:import -- --confirm --merge`)*

**What happens**:
1. Inserts all models in strict foreign-key dependency order inside transactions.
2. Rewrites all file record paths to Cloudinary HTTPS URLs.
3. Configures the admin account password securely from `$env:ADMIN_PASSWORD`.
4. Fixes PostgreSQL auto-increment sequences.
5. Rebuilds branch rating metrics (`ratingAvg`, `ratingCount`).

---

### Step 9: Verify the Migration

Run the post-migration audit suite:

```powershell
npm run data:verify
```

**Audit Checks**:
1. **Row Count Audit**: Compares row counts across all 27 models between `data-export/manifest.json` and Neon PostgreSQL. Every row must show `✅ PASS`.
2. **API Verification**: When backend is started against PostgreSQL:
   - Tests customer login: `9390075877` / `sai@1398` -> `✅ PASS`
   - Tests vendor login: `sai_halls` / `Vedika@123` -> `✅ PASS`
   - Tests admin login: `admin` / `$env:ADMIN_PASSWORD` -> `✅ PASS`
   - Tests demo vendor logins -> `✅ PASS`
3. **Privacy Audit**: Confirms zero customer phone/email leaks in vendor endpoints, and zero vendor phone/email leaks in public catalog endpoints.
4. **Media Audit**: Sends HTTP HEAD requests to catalog photos to confirm HTTP 200 OK.

---

### Step 10: Clean Up Sensitive Export Files

After confirming successful migration, remove the sensitive unencrypted export data from your local machine:

```powershell
# Remove local exported data folder
Remove-Item -Recurse -Force data-export
```

If you wish to retain an offline archive, move `data-export` into an encrypted external drive or secure password manager vault.

---

## Rollback & Disaster Recovery

If you ever need to reset or roll back the Neon PostgreSQL database during testing:

### Option A: Reset via Neon Console
1. Log into your [Neon Console](https://console.neon.tech).
2. Go to **Branches** -> create a restore point or reset your database branch to a clean state.

### Option B: Reset Tables via Script
To empty tables in Neon PostgreSQL before re-importing:
```powershell
# Using Prisma db push with data-loss confirmation to reset tables:
npx prisma db push --schema database/schema.prisma --force-reset
```

### Option C: Restore Local SQLite to Active Development
To return your local environment to local SQLite development:
```powershell
node scripts/use-db.mjs sqlite
```
