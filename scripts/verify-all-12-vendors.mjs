import path from "node:path";
import http from "node:http";
import { Socket } from "node:net";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../backend/node_modules/@prisma/client/default.js";
import app from "../backend/src/app.js";
import { comparePassword } from "../backend/src/utils/crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${path.resolve(rootDir, "database/utsavora.db")}`
    }
  }
});

// Dispatch request through Express without opening TCP socket
let ipCounter = 1;
function dispatch(reqOptions, body) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    const ip = `10.0.0.${++ipCounter}`;
    req.method = reqOptions.method || "POST";
    req.url = reqOptions.url;
    req.headers = {
      "content-type": "application/json",
      host: "localhost",
      "x-forwarded-for": ip,
      ...(reqOptions.headers || {})
    };
    req.connection = { remoteAddress: ip };
    req.socket = { remoteAddress: ip };
    req.ip = ip;
    req.body = body;

    const res = new http.ServerResponse(req);
    let resData = "";
    res.write = (chunk) => {
      if (chunk) resData += chunk.toString();
      return true;
    };
    res.end = (chunk) => {
      if (chunk) resData += chunk.toString();
      let parsed = resData;
      try {
        parsed = JSON.parse(resData);
      } catch {}
      resolve({ status: res.statusCode, body: parsed });
    };

    app.handle(req, res, (err) => {
      if (err) resolve({ status: 500, error: err.message });
      else resolve({ status: 404, body: "Not Found" });
    });
  });
}

const vendors = [
  // Kadapa (6)
  { username: "dsr_paradise", password: "Vedika@paradise", city: "Kadapa", kind: "hall" },
  { username: "madhavi_convention", password: "Vedika@MCC", city: "Kadapa", kind: "hall" },
  { username: "meda_reddy", password: "Vedika@MRRCC", city: "Kadapa", kind: "hall" },
  { username: "subhamasthu_catters", password: "Vedika@SC", city: "Kadapa", kind: "catering" },
  { username: "ks_cattering", password: "Vedika@KSC", city: "Kadapa", kind: "catering" },
  { username: "maharaja", password: "Vedika@Raja", city: "Kadapa", kind: "catering" },
  // Rajahmundry (6)
  { username: "sri_convention", password: "Vedika@BVR", city: "Rajahmundry", kind: "hall" },
  { username: "svpc_halls", password: "Vedika@SVPC", city: "Rajahmundry", kind: "hall" },
  { username: "sreeb_hall", password: "Vedika@SBH", city: "Rajahmundry", kind: "hall" },
  { username: "sai_caterings", password: "Vedika@annapurna", city: "Rajahmundry", kind: "catering" },
  { username: "emmi_caterings", password: "Vedika@Emmi", city: "Rajahmundry", kind: "catering" },
  { username: "ramya_caterings", password: "Vedika@ramya", city: "Rajahmundry", kind: "catering" }
];

const customers = [
  { phone: "9390075877", password: "sai@1398", name: "D L Narasimha sai" },
  { phone: "6305729847", password: "chani@850218", name: "K V Chanikya" },
  { phone: "9963773539", password: "Kumar@138", name: "B Sriram" }
];

async function main() {
  console.log("🚀 Running Full Verification for All 12 Vendors and 3 Customers...\n");
  let failed = false;

  // 1. Direct Database Password Hash & Role Verification
  console.log("=== 1. Database User Records & Bcrypt Verification ===");
  for (const v of vendors) {
    const user = await prisma.user.findUnique({
      where: { username: v.username.toLowerCase() },
      include: { vendorProfile: true }
    });
    if (!user || user.role !== "vendor") {
      console.error(`  ✗ [FAIL] DB user missing or not vendor: ${v.username}`);
      failed = true;
      continue;
    }
    const match = await comparePassword(v.password, user.passwordHash);
    const reject = !(await comparePassword("WrongPass123!", user.passwordHash));
    if (match && reject) {
      console.log(`  ✓ [PASS] DB vendor ${v.username.padEnd(22)}: Bcrypt verified OK`);
    } else {
      console.error(`  ✗ [FAIL] DB vendor ${v.username}: password match failed`);
      failed = true;
    }
  }

  for (const c of customers) {
    const user = await prisma.user.findUnique({
      where: { phone: c.phone }
    });
    if (!user || user.role !== "user") {
      console.error(`  ✗ [FAIL] DB customer missing or not user: ${c.phone}`);
      failed = true;
      continue;
    }
    const match = await comparePassword(c.password, user.passwordHash);
    const reject = !(await comparePassword("WrongPass123!", user.passwordHash));
    if (match && reject) {
      console.log(`  ✓ [PASS] DB customer ${c.name.padEnd(20)} (${c.phone}): Bcrypt verified OK`);
    } else {
      console.error(`  ✗ [FAIL] DB customer ${c.phone}: password match failed`);
      failed = true;
    }
  }

  // 2. Express Route Dispatch Verification
  console.log("\n=== 2. Express Route Login Dispatch ===");
  for (const v of vendors) {
    const resAuth = await dispatch(
      { method: "POST", url: "/api/v1/auth/vendor/login" },
      { username: v.username, password: v.password }
    );
    const authOk = resAuth.status === 200 && Boolean(resAuth.body?.accessToken || resAuth.body?.token);

    const resAlias = await dispatch(
      { method: "POST", url: "/api/v1/vendor/login" },
      { username: v.username, password: v.password }
    );
    const aliasOk = resAlias.status === 200 && Boolean(resAlias.body?.accessToken || resAlias.body?.token);

    const resBad = await dispatch(
      { method: "POST", url: "/api/v1/auth/vendor/login" },
      { username: v.username, password: "BadPassword123" }
    );
    const rejectOk = resBad.status === 401;

    if (authOk && aliasOk && rejectOk) {
      console.log(`  ✓ [PASS] Route Vendor ${v.username.padEnd(20)} -> /auth/vendor/login & /vendor/login OK`);
    } else {
      console.error(`  ✗ [FAIL] Route Vendor ${v.username}: auth=${resAuth.status}, alias=${resAlias.status}, bad=${resBad.status}`);
      failed = true;
    }
  }

  for (const c of customers) {
    const res = await dispatch(
      { method: "POST", url: "/api/v1/auth/user/login" },
      { phone: c.phone, password: c.password }
    );
    const ok = res.status === 200 && Boolean(res.body?.accessToken || res.body?.token);
    if (ok) {
      console.log(`  ✓ [PASS] Route Customer ${c.name.padEnd(20)} (${c.phone}) -> Login OK`);
    } else {
      console.error(`  ✗ [FAIL] Route Customer ${c.phone}: status=${res.status}, body=`, res.body);
      failed = true;
    }
  }

  // 3. Database Branch, District & Photo Integrity
  console.log("\n=== 3. Database Branch, District & Photo Integrity ===");
  const branches = await prisma.branch.findMany({
    where: {
      city: {
        city: { in: ["Kadapa", "Rajahmundry", "Rajamahendravaram"] }
      }
    },
    include: {
      city: true,
      photos: true,
      works: true,
      bookings: true,
      vendor: true
    }
  });

  const kadapaBranches = branches.filter((b) => b.city.city === "Kadapa" && b.vendor.username !== "sai_halls");
  const rajahmundryBranches = branches.filter(
    (b) => b.city.city === "Rajahmundry" || b.city.city === "Rajamahendravaram"
  );

  console.log(`  - Kadapa Branches Found: ${kadapaBranches.length} (Expected 6)`);
  console.log(`  - Rajahmundry Branches Found: ${rajahmundryBranches.length} (Expected >= 8)`);

  if (kadapaBranches.length !== 6) {
    console.error(`  ✗ [FAIL] Kadapa branches count mismatch: got ${kadapaBranches.length}, expected 6`);
    failed = true;
  } else {
    console.log(`  ✓ [PASS] Exactly 6 Kadapa branches for new vendors in database`);
  }

  // Check zero photos for Kadapa
  let kadapaPhotosCount = 0;
  let kadapaWorksCount = 0;
  for (const b of kadapaBranches) {
    kadapaPhotosCount += b.photos.length;
    kadapaWorksCount += b.works.length;
  }
  if (kadapaPhotosCount === 0 && kadapaWorksCount === 0) {
    console.log(`  ✓ [PASS] Zero seeded photos and zero seeded works for Kadapa vendors in DB`);
  } else {
    console.error(`  ✗ [FAIL] Kadapa has ${kadapaPhotosCount} photos and ${kadapaWorksCount} works (Expected 0)`);
    failed = true;
  }

  // Check 3 bookings per Kadapa vendor
  let allKadapaBookings3 = true;
  for (const b of kadapaBranches) {
    if (b.bookings.length < 3) {
      console.error(`  ✗ [FAIL] Branch ${b.name} has only ${b.bookings.length} bookings (Expected >= 3)`);
      allKadapaBookings3 = false;
      failed = true;
    }
  }
  if (allKadapaBookings3) {
    console.log(`  ✓ [PASS] All Kadapa branches have at least 3 completed bookings in DB`);
  }

  // 4. Verify Frontend Offline Store & Unified Catalog
  console.log("\n=== 4. Frontend Offline Store & Catalog Verification ===");
  const {
    seedCatalogVendors,
    authenticateVendor,
    getUnifiedVendorsCatalog,
    getVendorBookings
  } = await import("../frontend/src/services/store.js");

  // Run frontend catalog seeding
  await seedCatalogVendors();

  // Test authenticateVendor for all 12 vendors
  for (const v of vendors) {
    const authSuccess = await authenticateVendor(v.username, v.password);
    const authFail = await authenticateVendor(v.username, "WrongPass123!");

    if (authSuccess?.success && !authFail?.success) {
      console.log(`  ✓ [PASS] Store authenticateVendor(${v.username}) -> Valid PASS, Invalid REJECT`);
    } else {
      console.error(`  ✗ [FAIL] Store auth failed for ${v.username}: valid=${authSuccess?.success}, invalid=${authFail?.success}`);
      failed = true;
    }

    // Verify bookings exist
    const bookings = getVendorBookings(v.username);
    if (bookings.length >= 3) {
      console.log(`  ✓ [PASS] Vendor ${v.username.padEnd(20)} has ${bookings.length} offline bookings in store`);
    } else {
      console.error(`  ✗ [FAIL] Vendor ${v.username} has only ${bookings.length} offline bookings in store (expected >= 3)`);
      failed = true;
    }
  }

  // Test getUnifiedVendorsCatalog
  const dummyVendorsRaw = (await import("../frontend/src/data/dummyVendors.json", { with: { type: "json" } })).default;
  const catalog = getUnifiedVendorsCatalog(dummyVendorsRaw);

  const kadapaHallsCatalog = catalog.halls.filter((h) => h.city === "Kadapa" && h.vendorUsername !== "sai_halls");
  const kadapaCaterersCatalog = catalog.caterers.filter((c) => c.city === "Kadapa" && c.vendorUsername !== "sai_halls");

  console.log(`  - Catalog Kadapa Halls: ${kadapaHallsCatalog.length} (Expected 3)`);
  console.log(`  - Catalog Kadapa Caterers: ${kadapaCaterersCatalog.length} (Expected 3)`);

  if (kadapaHallsCatalog.length !== 3 || kadapaCaterersCatalog.length !== 3) {
    console.error(`  ✗ [FAIL] Catalog Kadapa counts mismatch: halls=${kadapaHallsCatalog.length}, caterers=${kadapaCaterersCatalog.length}`);
    failed = true;
  } else {
    console.log(`  ✓ [PASS] Exactly 3 Kadapa halls and 3 Kadapa caterers in frontend catalog`);
  }

  // Verify districts and 0 photos
  for (const h of kadapaHallsCatalog) {
    if (h.district !== "YSR Kadapa") {
      console.error(`  ✗ [FAIL] Hall ${h.name} has district "${h.district}" (expected "YSR Kadapa")`);
      failed = true;
    }
    if ((h.photos && h.photos.length > 0) || (h.works && h.works.length > 0)) {
      console.error(`  ✗ [FAIL] Kadapa hall ${h.name} has photos/works!`);
      failed = true;
    }
  }

  for (const c of kadapaCaterersCatalog) {
    if (c.district !== "YSR Kadapa") {
      console.error(`  ✗ [FAIL] Caterer ${c.name} has district "${c.district}" (expected "YSR Kadapa")`);
      failed = true;
    }
    if ((c.photos && c.photos.length > 0) || (c.works && c.works.length > 0)) {
      console.error(`  ✗ [FAIL] Kadapa caterer ${c.name} has photos/works!`);
      failed = true;
    }
  }

  const rajHallsCatalog = catalog.halls.filter(
    (h) => h.city === "Rajahmundry" || h.city === "Rajamahendravaram"
  );
  for (const h of rajHallsCatalog) {
    if (h.district !== "East Godavari") {
      console.error(`  ✗ [FAIL] Rajahmundry hall ${h.name} has district "${h.district}" (expected "East Godavari")`);
      failed = true;
    }
  }

  if (failed) {
    console.error("\n❌ Verification FAILED!");
    process.exit(1);
  } else {
    console.log("\n✅ ALL 12 VENDORS & CUSTOMERS VERIFIED SUCCESSFULLY!");
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
