import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';
import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RAJAHMUNDRY_BRANCH_IDS,
  seedRajahmundryVendorsAndBranches,
  seedRajahmundrySampleBookings,
  seedRajahmundryMenuItems
} from './rajahmundryData.js';
import {
  KADAPA_BRANCH_IDS,
  seedKadapaVendorsAndBranches,
  seedKadapaSampleBookings,
  seedKadapaMenuItems
} from './kadapaData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const CITY_MULTIPLIERS = {
  kadapa: 0.9,
  vijayawada: 1.0,
  guntur: 0.95,
  visakhapatnam: 1.1,
  tirupati: 0.9,
  rajahmundry: 1.0,
  hyderabad: 1.2,
  warangal: 0.9,
  chennai: 1.2,
  coimbatore: 1.0,
  bengaluru: 1.25,
  mysuru: 0.95,
  mumbai: 1.5,
  pune: 1.2
};

const CITY_CODES = {
  kadapa: 'kdp',
  vijayawada: 'vja',
  guntur: 'gnt',
  visakhapatnam: 'vsp',
  tirupati: 'tpt',
  rajahmundry: 'rjy',
  hyderabad: 'hyd',
  warangal: 'wgl',
  chennai: 'maa',
  coimbatore: 'cjb',
  bengaluru: 'blr',
  mysuru: 'mys',
  mumbai: 'bom',
  pune: 'pnq'
};

const DEMO_OWNER_NAMES = [
  'Ramesh Reddy', 'Suresh Goud', 'Venkatesh Rao', 'Kavitha Naidu',
  'Lakshmi Prasanna', 'Anil Sharma', 'Pooja Patel', 'Ravi Teja',
  'Murali Krishna', 'Srinivas Raju', 'Manish Joshi', 'Deepak Verma',
  'Sunil Chary', 'Madhavan Pillai', 'Rajendra Varma', 'Bhavani Shankar',
  'Satish Choudhary', 'Radha Krishna', 'Naveen Kumar', 'Vijay Bhaskar',
  'Chandra Sekhar', 'Gopal Krishnan', 'Harish Babu', 'Jagadish Naidu',
  'Mahesh Babu', 'Prasad Rao', 'Raghavendra Swamy', 'Shiva Prasad',
  'Subba Rao', 'Vasanth Kumar', 'Yugandhar Reddy', 'Kishore Kumar',
  'Ashok Vardhan', 'Balaji Narayanan', 'Devendra Reddy', 'Giridhar Gopal',
  'Kiran Varma', 'Mohan Rao', 'Narasimha Murthy', 'Praveen Kumar'
];

export function maskDatabaseUrl(url) {
  if (!url) return '(unspecified)';
  try {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  } catch {
    return url;
  }
}

function generateSvgImage({ title, emoji, caption, filename, uploadsDir }) {
  const cleanTitle = (title || 'Utsavora Venue').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanCaption = (caption || 'Verified Partner').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3A0A1E" />
      <stop offset="60%" stop-color="#6B1230" />
      <stop offset="100%" stop-color="#E8B84A" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
  <circle cx="400" cy="190" r="70" fill="rgba(255,255,255,0.12)" />
  <text x="400" y="215" font-size="64" text-anchor="middle" dominant-baseline="middle">${emoji || '🏛️'}</text>
  <text x="400" y="320" font-family="system-ui, sans-serif" font-size="26" font-weight="bold" fill="#F8EBD8" text-anchor="middle">${cleanTitle}</text>
  <text x="400" y="365" font-family="system-ui, sans-serif" font-size="16" fill="#E8B84A" text-anchor="middle">${cleanCaption}</text>
</svg>`;

  let savedPath = `/uploads/public/${filename}`;
  if (uploadsDir) {
    try {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), svg, 'utf8');
    } catch {
      savedPath = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  }

  // Cloudinary fallback or container without persistent disk
  if (process.env.STORAGE_PROVIDER === 'cloudinary' && (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME)) {
    savedPath = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  return {
    path: savedPath,
    sizeBytes: Buffer.byteLength(svg, 'utf8')
  };
}

export async function seedDatabase(targetPrisma = prisma, options = {}) {
  const isDryRun = process.argv.includes('--dry-run') || Boolean(options?.dryRun);
  const mode = options?.mode || process.env.SEED_MODE || 'demo';
  const targetDb = process.env.DATABASE_URL || 'file:../database/utsavora.db';

  console.log(`[DB] Target database: ${maskDatabaseUrl(targetDb)}`);

  if (isDryRun) {
    console.log(`🔍 [DRY RUN] Simulating database seed (mode: ${mode})...`);
    console.log('  - Would seed/upsert planner configurations');
    console.log('  - Would seed/upsert core cities and states');
    console.log('  - Would upsert 3 customer accounts');
    console.log('  - Would upsert platform administrator');
    if (mode === 'minimal') {
      console.log('  - [Minimal Mode] Would verify essential test vendor and branches only if needed');
    } else {
      console.log('  - [Demo Mode] Would seed full catalog, branches, sample bookings, and notifications');
    }
    console.log('✅ [DRY RUN] Simulation complete. No database changes were made.');
    return;
  }

  console.log(`🌱 Starting database seeding (mode: ${mode})...`);

  const uploadsDir = path.resolve(__dirname, '../backend/uploads/public');
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {
      // Ephemeral disk fallback
    }
  }

  // 1. Seed Planner Config
  console.log('-> Seeding planner_config...');
  const configs = [
    {
      key: 'weights',
      value: JSON.stringify({
        both: { catering: 40, hall: 35, decor: 25 },
        hall: { hall: 60, decor: 40 },
        catering: { catering: 100 }
      })
    },
    {
      key: 'factors',
      value: JSON.stringify({
        serving: { 'banana leaf': 1.00, 'buffet': 1.05, 'table service': 1.25 },
        cuisine: { 'south indian': 0.95, 'andhra': 1.00, 'north indian': 1.10, 'multi-cuisine': 1.20 },
        hallCondition: { 'non-ac': 1.00, 'ac': 1.30 },
        duration: { 'half day': 0.60, 'full day': 1.00 }
      })
    },
    {
      key: 'plateTable',
      value: JSON.stringify({
        basic: { veg: { min: 150, max: 200 }, nonVeg: { min: 200, max: 250 } },
        standard: { veg: { min: 200, max: 300 }, nonVeg: { min: 300, max: 400 } },
        premium: { veg: { min: 300, max: 450 }, nonVeg: { min: 400, max: 600 } },
        luxury: { veg: { min: 450, max: 700 }, nonVeg: { min: 600, max: 1000 } }
      })
    },
    { key: 'bufferPercent', value: JSON.stringify(10) },
    { key: 'packageScales', value: JSON.stringify({ budget: 0.70, balanced: 0.90, premium: 1.05 }) },
    { key: 'scoreWeights', value: JSON.stringify({ rating: 0.40, value: 0.30, budgetFit: 0.20, popularity: 0.10 }) },
    { key: 'commissionRate', value: JSON.stringify(10) },
    { key: 'gstPercent', value: JSON.stringify(18) },
    {
      key: 'refundPolicy',
      value: JSON.stringify({
        userBefore7DaysPercent: 100,
        userBetween48hAnd7dPercent: 50,
        userLessThan48hPercent: 0,
        vendorCancelPercent: 100
      })
    },
    { key: 'holdMinutes', value: JSON.stringify(10) },
    { key: 'maxPhotosPerBranch', value: JSON.stringify(12) },
    { key: 'warningLimit', value: JSON.stringify(3) }
  ];

  for (const c of configs) {
    await targetPrisma.plannerConfig.upsert({
      where: { key: c.key },
      update: { value: c.value },
      create: c
    });
  }

  // 2. Seed Cities & States
  console.log('-> Seeding cities and states...');
  const locationsPath = path.resolve(__dirname, 'seed-data/indianLocations.json');
  let locationsData = {};
  if (fs.existsSync(locationsPath)) {
    locationsData = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  }

  if (!locationsData['Andhra Pradesh']) locationsData['Andhra Pradesh'] = [];
  if (!locationsData['Andhra Pradesh'].includes('Kadapa')) {
    locationsData['Andhra Pradesh'].unshift('Kadapa');
  }

  const cityRecords = new Map();
  for (const [state, cities] of Object.entries(locationsData)) {
    for (const city of cities) {
      const mult = CITY_MULTIPLIERS[city.toLowerCase()] || 1.0;
      const record = await targetPrisma.city.upsert({
        where: { state_city: { state, city } },
        update: { priceMultiplier: mult },
        create: { state, city, priceMultiplier: mult }
      });
      cityRecords.set(city.toLowerCase(), record);
    }
  }

  const kadapaCity = cityRecords.get('kadapa') || await targetPrisma.city.findFirst({ where: { city: 'Kadapa' } });

  // 3. Seed Exactly 3 Clean Customer Users (ZERO bookings, ZERO chats)
  console.log('-> Seeding 3 clean customer users (9390075877, 6305729847, 9963773539)...');

  // Purge any existing customer users who are not in the exact three ONLY in demo mode, NEVER in production/minimal
  if (mode !== 'minimal' && process.env.NODE_ENV !== 'production') {
    const allowedCustomerPhones = ['9390075877', '6305729847', '9963773539'];
    const strayCustomers = await targetPrisma.user.findMany({
      where: {
        role: 'user',
        NOT: { phone: { in: allowedCustomerPhones } }
      },
      select: { id: true }
    });
    if (strayCustomers.length > 0) {
      const strayIds = strayCustomers.map(u => u.id);
      await targetPrisma.refreshToken.deleteMany({ where: { userId: { in: strayIds } } });
      await targetPrisma.plan.deleteMany({ where: { userId: { in: strayIds } } });
      await targetPrisma.notification.deleteMany({ where: { userId: { in: strayIds } } });
      await targetPrisma.contactViolation.deleteMany({ where: { userId: { in: strayIds } } });
      await targetPrisma.user.deleteMany({ where: { id: { in: strayIds } } });
    }
  }

  const customersToSeed = [
    {
      name: 'D L Narasimha sai',
      phone: '9390075877',
      email: 'narasimhasai1012@gmail.com',
      password: 'sai@1398',
      city: 'Kadapa',
      state: 'Andhra Pradesh',
      pincode: '516001'
    },
    {
      name: 'K V Chanikya',
      phone: '6305729847',
      email: 'chanikyakv@gmail.com',
      password: 'chani@850218',
      city: 'Rajahmundry',
      state: 'Andhra Pradesh',
      pincode: '533101'
    },
    {
      name: 'B Sriram',
      phone: '9963773539',
      email: 'sriramboddu@gmail.com',
      password: 'Kumar@138',
      city: 'Rajahmundry',
      state: 'Andhra Pradesh',
      pincode: '533101'
    }
  ];

  for (const c of customersToSeed) {
    const passwordHash = await bcrypt.hash(c.password, 10);
    await targetPrisma.user.upsert({
      where: { phone: c.phone },
      update: {
        name: c.name,
        email: c.email.toLowerCase(),
        passwordHash,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        role: 'user',
        isActive: true,
        failedLogins: 0,
        lockedUntil: null,
        locationSource: 'manual'
      },
      create: {
        name: c.name,
        phone: c.phone,
        email: c.email.toLowerCase(),
        passwordHash,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        role: 'user',
        isActive: true,
        failedLogins: 0,
        lockedUntil: null,
        locationSource: 'manual'
      }
    });
  }

  // 4. Seed Admin
  console.log('-> Seeding admin...');
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await targetPrisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminPasswordHash,
      role: 'admin'
    },
    create: {
      name: 'Utsavora Admin',
      username: 'admin',
      phone: '9000000000',
      email: 'admin@utsavora.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      city: 'Kadapa',
      state: 'Andhra Pradesh'
    }
  });

  // 5. Seed Test Vendor: sai_halls / Vedika@123
  console.log('-> Seeding test vendor (sai_halls)...');
  const vendorPasswordHash = await bcrypt.hash('Vedika@123', 10);
  const testVendor = await targetPrisma.user.upsert({
    where: { username: 'sai_halls' },
    update: {
      name: 'Sai Kumar',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      city: 'Kadapa',
      state: 'Andhra Pradesh',
      phone: '9849012345'
    },
    create: {
      name: 'Sai Kumar',
      username: 'sai_halls',
      passwordHash: vendorPasswordHash,
      role: 'vendor',
      city: 'Kadapa',
      state: 'Andhra Pradesh',
      phone: '9849012345',
      email: 'sai.halls@utsavora.com'
    }
  });

  await targetPrisma.vendorProfile.upsert({
    where: { userId: testVendor.id },
    update: {
      ownerType: 'both',
      hallBusinessName: 'Sai Function Hall',
      cateringBusinessName: 'Annapurna Catering',
      termsVersion: 'v1.0',
      status: 'active'
    },
    create: {
      userId: testVendor.id,
      ownerType: 'both',
      hallBusinessName: 'Sai Function Hall',
      cateringBusinessName: 'Annapurna Catering',
      termsVersion: 'v1.0',
      status: 'active'
    }
  });

  // Verified Documents for sai_halls
  await targetPrisma.document.upsert({
    where: { type_number: { type: 'trade_licence', number: 'TL-KDP-2024-8842' } },
    update: { status: 'verified', vendorId: testVendor.id },
    create: {
      vendorId: testVendor.id,
      type: 'trade_licence',
      number: 'TL-KDP-2024-8842',
      status: 'verified',
      checks: JSON.stringify([{ rule: 'Municipal Registry Valid', passed: true }])
    }
  });

  await targetPrisma.document.upsert({
    where: { type_number: { type: 'fssai', number: '10123000456789' } },
    update: { status: 'verified', vendorId: testVendor.id },
    create: {
      vendorId: testVendor.id,
      type: 'fssai',
      number: '10123000456789',
      status: 'verified',
      checks: JSON.stringify([{ rule: 'FoSCoS 14-digit Registry Valid', passed: true }])
    }
  });

  // 5b. Seed sai_halls 3 branches
  console.log('-> Seeding sai_halls 3 branches...');
  const saiBranchesData = [
    {
      id: 'branch-sai-hall-1',
      vendorId: testVendor.id,
      kind: 'hall',
      name: 'Sai Function Hall - Main Town',
      description: 'Grand AC Convention Center with central stage and chandeliers.',
      addressLine: 'Seven Roads Junction, Main Town',
      area: 'Main Town',
      cityId: kadapaCity.id,
      pincode: '516001',
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 64,
      bookingsCount: 44,
      amenities: JSON.stringify(['Parking 150+ cars', 'Central Air Conditioning', 'Generator Backup', '10 Changing Rooms']),
      hall: {
        capacity: 800,
        acMode: 'both',
        priceFullDayNonAc: 85000,
        priceFullDayAc: 110500,
        priceHalfDay: 51000,
        parking: '150 cars',
        rooms: 10
      }
    },
    {
      id: 'branch-sai-hall-2',
      vendorId: testVendor.id,
      kind: 'hall',
      name: 'Sai Function Hall - Bypass Road',
      description: 'Lush open-air & AC mandapam for grand receptions.',
      addressLine: 'RIMS Bypass Road',
      area: 'Bypass Road',
      cityId: kadapaCity.id,
      pincode: '516002',
      status: 'verified',
      ratingAvg: 4.6,
      ratingCount: 38,
      bookingsCount: 28,
      amenities: JSON.stringify(['Parking 300+ cars', 'Air Conditioning', 'Full Dining Hall', 'Lawn']),
      hall: {
        capacity: 1200,
        acMode: 'both',
        priceFullDayNonAc: 120000,
        priceFullDayAc: 156000,
        priceHalfDay: 72000,
        parking: '300 cars',
        rooms: 8
      }
    },
    {
      id: 'branch-annapurna-cat-1',
      vendorId: testVendor.id,
      kind: 'catering',
      name: 'Annapurna Catering Kadapa',
      description: 'Authentic Rayalaseema & Andhra gourmet catering for weddings.',
      addressLine: 'Nagarajupalle',
      area: 'Kadapa Central',
      cityId: kadapaCity.id,
      pincode: '516001',
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 82,
      bookingsCount: 65,
      amenities: JSON.stringify(['Live Tandoor', 'Traditional Banana Leaf', 'Buffet Counters', 'Mineral Water Plant']),
      caterer: {
        cuisines: JSON.stringify(['andhra', 'south indian']),
        servingStyles: JSON.stringify(['buffet', 'banana leaf']),
        foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
        minPlates: 100
      },
      plateRates: [
        { category: 'basic', foodType: 'veg', price: 180 },
        { category: 'basic', foodType: 'nonveg', price: 230 },
        { category: 'standard', foodType: 'veg', price: 260 },
        { category: 'standard', foodType: 'nonveg', price: 350 },
        { category: 'premium', foodType: 'veg', price: 380 },
        { category: 'premium', foodType: 'nonveg', price: 520 },
        { category: 'luxury', foodType: 'veg', price: 550 },
        { category: 'luxury', foodType: 'nonveg', price: 780 }
      ]
    }
  ];

  for (const b of saiBranchesData) {
    const branchRecord = await targetPrisma.branch.upsert({
      where: { id: b.id },
      update: {
        vendorId: b.vendorId,
        kind: b.kind,
        name: b.name,
        description: b.description,
        addressLine: b.addressLine,
        area: b.area,
        cityId: b.cityId,
        pincode: b.pincode,
        status: b.status,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        bookingsCount: b.bookingsCount,
        amenities: b.amenities
      },
      create: {
        id: b.id,
        vendorId: b.vendorId,
        kind: b.kind,
        name: b.name,
        description: b.description,
        addressLine: b.addressLine,
        area: b.area,
        cityId: b.cityId,
        pincode: b.pincode,
        status: b.status,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        bookingsCount: b.bookingsCount,
        amenities: b.amenities
      }
    });

    if (b.hall) {
      await targetPrisma.hallDetails.upsert({
        where: { branchId: branchRecord.id },
        update: b.hall,
        create: { branchId: branchRecord.id, ...b.hall }
      });
    }

    if (b.caterer) {
      await targetPrisma.catererDetails.upsert({
        where: { branchId: branchRecord.id },
        update: b.caterer,
        create: { branchId: branchRecord.id, ...b.caterer }
      });
      if (b.plateRates) {
        for (const pr of b.plateRates) {
          const existingRate = await targetPrisma.plateRate.findFirst({
            where: { branchId: branchRecord.id, category: pr.category, foodType: pr.foodType }
          });
          if (existingRate) {
            await targetPrisma.plateRate.update({ where: { id: existingRate.id }, data: { price: pr.price } });
          } else {
            await targetPrisma.plateRate.create({
              data: { branchId: branchRecord.id, category: pr.category, foodType: pr.foodType, price: pr.price }
            });
          }
        }
      }
    }
  }

  // If running in minimal mode (e.g. production baseline), finish here cleanly
  if (mode === 'minimal') {
    console.log('✅ [Minimal Mode] Core configuration, cities, customer accounts, administrator, and essential vendor base seeded.');
    console.log('✅ Seeding completed successfully!');
    return;
  }

  // 6. Seed ~39 Platform Vendor Accounts & Distribute dummyVendors.json
  console.log('-> Seeding 39 platform vendors & distributing catalog...');
  const dummyVendorsPath = path.resolve(__dirname, 'seed-data/dummyVendors.json');
  let dummy = { halls: [], caterers: [], decor: [], bands: [], cards: [], photography: [] };
  if (fs.existsSync(dummyVendorsPath)) {
    dummy = JSON.parse(fs.readFileSync(dummyVendorsPath, 'utf8'));
  }

  // Group halls and caterers by city
  const hallsByCity = new Map();
  for (const h of (dummy.halls || [])) {
    const c = (h.city || 'Kadapa').toLowerCase();
    if (!hallsByCity.has(c)) hallsByCity.set(c, []);
    hallsByCity.get(c).push(h);
  }

  const caterersByCity = new Map();
  for (const c of (dummy.caterers || [])) {
    const cityKey = (c.city || 'Kadapa').toLowerCase();
    if (!caterersByCity.has(cityKey)) caterersByCity.set(cityKey, []);
    caterersByCity.get(cityKey).push(c);
  }

  // Unique vendor generator
  const createdVendors = [];
  let vendorCounter = 1;
  const commonPasswordHash = await bcrypt.hash('Vedika@123', 10);

  const cityList = Array.from(new Set([...hallsByCity.keys(), ...caterersByCity.keys()])).sort();

  for (const cityKey of cityList) {
    const code = CITY_CODES[cityKey] || cityKey.slice(0, 3);
    const cityRec = cityRecords.get(cityKey) || kadapaCity;

    // Create 2 hall vendors and 1 catering vendor per city (total 3 * 13 = 39)
    for (let vIdx = 1; vIdx <= 3; vIdx++) {
      const isHallVendor = vIdx <= 2;
      const username = `demo_${isHallVendor ? 'hall' : 'cat'}_${code}_0${vIdx}`;
      const ownerName = DEMO_OWNER_NAMES[(vendorCounter - 1) % DEMO_OWNER_NAMES.length];
      const existingUser = await targetPrisma.user.findUnique({ where: { username } });
      const phone = existingUser?.phone || `98491${String(vendorCounter).padStart(5, '0')}`;
      const email = `${username}@utsavora.com`;

      const vendorUser = await targetPrisma.user.upsert({
        where: { username },
        update: {
          name: ownerName,
          email,
          city: cityRec.city,
          state: cityRec.state,
          role: 'vendor',
          passwordHash: commonPasswordHash
        },
        create: {
          name: ownerName,
          username,
          phone,
          email,
          city: cityRec.city,
          state: cityRec.state,
          role: 'vendor',
          passwordHash: commonPasswordHash
        }
      });

      await targetPrisma.vendorProfile.upsert({
        where: { userId: vendorUser.id },
        update: {
          ownerType: isHallVendor ? 'hall' : 'catering',
          hallBusinessName: isHallVendor ? `${cityRec.city} Grand Venues` : null,
          cateringBusinessName: !isHallVendor ? `${cityRec.city} Royal Caterers` : null,
          termsVersion: 'v1.0',
          status: 'active'
        },
        create: {
          userId: vendorUser.id,
          ownerType: isHallVendor ? 'hall' : 'catering',
          hallBusinessName: isHallVendor ? `${cityRec.city} Grand Venues` : null,
          cateringBusinessName: !isHallVendor ? `${cityRec.city} Royal Caterers` : null,
          termsVersion: 'v1.0',
          status: 'active'
        }
      });

      // Verified Document
      const docType = isHallVendor ? 'trade_licence' : 'fssai';
      const docNum = isHallVendor
        ? `TL-${code.toUpperCase()}-2024-${String(1000 + vendorCounter)}`
        : `10123000${String(100000 + vendorCounter)}`;

      await targetPrisma.document.upsert({
        where: { type_number: { type: docType, number: docNum } },
        update: { status: 'verified', vendorId: vendorUser.id },
        create: {
          vendorId: vendorUser.id,
          type: docType,
          number: docNum,
          status: 'verified',
          checks: JSON.stringify([{ rule: 'Verified via Govt Portal', passed: true }])
        }
      });

      createdVendors.push({ user: vendorUser, cityKey, isHallVendor, vIdx });
      vendorCounter++;
    }
  }

  // Distribute dummy halls across the city's hall vendors
  for (const [cityKey, halls] of hallsByCity.entries()) {
    const cityRec = cityRecords.get(cityKey) || kadapaCity;
    const cityHallVendors = createdVendors.filter(v => v.cityKey === cityKey && v.isHallVendor);

    halls.forEach((h, idx) => {
      const assignedVendor = cityHallVendors[idx % cityHallVendors.length] || cityHallVendors[0];
      h._assignedVendorId = assignedVendor.user.id;
    });

    for (const h of halls) {
      const existing = await targetPrisma.branch.findUnique({ where: { id: h.id } });
      const branchData = {
        vendorId: h._assignedVendorId,
        kind: 'hall',
        name: h.name,
        addressLine: h.address || `${h.city}, AP/TS`,
        cityId: cityRec.id,
        status: 'verified',
        ratingAvg: Number(h.rating || 4.5),
        ratingCount: h.reviewsCount || 40,
        bookingsCount: Math.round((h.popularity || 0.8) * 50),
        amenities: JSON.stringify(h.amenities || ['Parking', 'Generator Backup'])
      };

      let br;
      if (!existing) {
        br = await targetPrisma.branch.create({
          data: { id: h.id, ...branchData }
        });
        await targetPrisma.hallDetails.create({
          data: {
            branchId: br.id,
            capacity: Number(h.capacity || 500),
            priceFullDayNonAc: Number(h.price || 80000),
            priceFullDayAc: Math.round(Number(h.price || 80000) * 1.3),
            acMode: h.isAC ? 'both' : 'non_ac'
          }
        });
      } else {
        br = await targetPrisma.branch.update({
          where: { id: h.id },
          data: { vendorId: h._assignedVendorId }
        });
      }
    }
  }

  // Distribute dummy caterers across the city's catering vendors
  for (const [cityKey, caterers] of caterersByCity.entries()) {
    const cityRec = cityRecords.get(cityKey) || kadapaCity;
    const cityCatVendors = createdVendors.filter(v => v.cityKey === cityKey && !v.isHallVendor);

    caterers.forEach((c, idx) => {
      const assignedVendor = cityCatVendors[idx % cityCatVendors.length] || cityCatVendors[0];
      c._assignedVendorId = assignedVendor.user.id;
    });

    for (const c of caterers) {
      const existing = await targetPrisma.branch.findUnique({ where: { id: c.id } });
      const branchData = {
        vendorId: c._assignedVendorId,
        kind: 'catering',
        name: c.name,
        addressLine: c.address || `${c.city}, AP/TS`,
        cityId: cityRec.id,
        status: 'verified',
        ratingAvg: Number(c.rating || 4.5),
        ratingCount: c.reviewsCount || 35,
        bookingsCount: Math.round((c.popularity || 0.8) * 45),
        amenities: JSON.stringify(c.amenities || ['Buffet Counters', 'Trained Staff'])
      };

      let br;
      if (!existing) {
        br = await targetPrisma.branch.create({
          data: { id: c.id, ...branchData }
        });
        await targetPrisma.catererDetails.create({
          data: {
            branchId: br.id,
            minPlates: Number(c.minPlates || 50),
            cuisines: JSON.stringify(c.cuisines || ['andhra']),
            servingStyles: JSON.stringify(c.servingStyles || ['buffet']),
            foodTypes: JSON.stringify(c.foodTypes || ['both'])
          }
        });

        if (c.price) {
          await targetPrisma.plateRate.create({
            data: {
              branchId: br.id,
              category: 'standard',
              foodType: 'nonveg',
              price: Number(c.price)
            }
          });
        }
      } else {
        br = await targetPrisma.branch.update({
          where: { id: c.id },
          data: { vendorId: c._assignedVendorId }
        });
      }
    }
  }

  // 6b. Seed Rajahmundry 6 Vendors & 8 Branches (Function Halls & Caterings)
  const rajahmundryCity = cityRecords.get('rajahmundry') || await targetPrisma.city.findFirst({ where: { city: 'Rajahmundry' } });
  const rajahmundryVendorMap = await seedRajahmundryVendorsAndBranches(targetPrisma, rajahmundryCity);

  // 6c. Seed Kadapa 6 Vendors & 6 Branches (Function Halls & Caterings)
  const kadapaVendorMap = await seedKadapaVendorsAndBranches(targetPrisma, kadapaCity);

  // Service Listings: Decor, Band, Cards, Photo
  console.log('-> Seeding service listings...');
  await targetPrisma.serviceListing.deleteMany({});
  for (const d of (dummy.decor || [])) {
    const cityRec = cityRecords.get((d.city || 'Kadapa').toLowerCase());
    await targetPrisma.serviceListing.create({
      data: {
        kind: 'decor',
        name: d.name,
        cityId: cityRec ? cityRec.id : null,
        level: d.tier || 'medium',
        price: d.price || 55000,
        rating: Number(d.rating || 4.5),
        description: `${d.tier || 'Medium'} floral & stage decor`
      }
    });
  }

  for (const b of (dummy.bands || [])) {
    const cityRec = cityRecords.get((b.city || 'Kadapa').toLowerCase());
    await targetPrisma.serviceListing.create({
      data: {
        kind: 'band',
        name: b.name,
        cityId: cityRec ? cityRec.id : null,
        price: b.price || 25000,
        rating: Number(b.rating || 4.5),
        description: 'Traditional wedding music band'
      }
    });
  }

  for (const cd of (dummy.cards || [])) {
    const cityRec = cityRecords.get((cd.city || 'Kadapa').toLowerCase());
    await targetPrisma.serviceListing.create({
      data: {
        kind: 'cards',
        name: cd.name,
        cityId: cityRec ? cityRec.id : null,
        price: cd.pricePerUnit || 35,
        priceUnit: 'per_card',
        rating: Number(cd.rating || 4.5),
        description: 'Wedding & invitation card designer'
      }
    });
  }

  for (const p of (dummy.photography || [])) {
    const cityRec = cityRecords.get((p.city || 'Kadapa').toLowerCase());
    await targetPrisma.serviceListing.create({
      data: {
        kind: 'photography',
        name: p.name,
        cityId: cityRec ? cityRec.id : null,
        price: p.price || 50000,
        rating: Number(p.rating || 4.7),
        description: 'Cinematic wedding photography & video'
      }
    });
  }

  // 7. Seed Placeholder Media: FileRecord + Photo rows
  console.log('-> Generating placeholder images & photos...');
  await targetPrisma.photo.deleteMany({});
  await targetPrisma.fileRecord.deleteMany({});
  await targetPrisma.previousWork.deleteMany({});

  // 1 cover photo for each other branch (excluding Kadapa and Rajahmundry)
  const allOtherBranches = await targetPrisma.branch.findMany({
    where: { NOT: { id: { in: [...KADAPA_BRANCH_IDS, ...RAJAHMUNDRY_BRANCH_IDS] } } }
  });
  for (const b of allOtherBranches) {
    const bSvg = generateSvgImage({
      title: b.name,
      emoji: b.kind === 'hall' ? '🏛️' : '🍽️',
      caption: 'Utsavora Verified Partner',
      filename: `${b.id}-cover.svg`,
      uploadsDir
    });
    const bFile = await targetPrisma.fileRecord.create({
      data: {
        ownerId: b.vendorId,
        purpose: 'photo',
        path: bSvg.path,
        mime: 'image/svg+xml',
        sizeBytes: bSvg.sizeBytes,
        isPublic: true
      }
    });
    await targetPrisma.photo.create({
      data: { branchId: b.id, fileId: bFile.id, caption: `${b.name} Cover`, isCover: true, sortOrder: 0 }
    });
    await targetPrisma.branch.update({ where: { id: b.id }, data: { coverPhotoId: bFile.id } });
  }

  // 9. Clean up any bookings, booking dates, payments, payouts, refunds and chats
  console.log('-> Cleaning up bookings, booking dates, payments, payouts, refunds & chats...');
  await targetPrisma.bookingDate.deleteMany({});
  await targetPrisma.refund.deleteMany({});
  await targetPrisma.payout.deleteMany({});
  await targetPrisma.payment.deleteMany({});
  await targetPrisma.review.deleteMany({});
  await targetPrisma.booking.deleteMany({});
  await targetPrisma.call.deleteMany({});
  await targetPrisma.message.deleteMany({});
  await targetPrisma.conversation.deleteMany({});

  // Seed sample completed bookings for Rajahmundry & Kadapa vendors (Track Revenue)
  await seedRajahmundrySampleBookings(targetPrisma, rajahmundryVendorMap);
  await seedKadapaSampleBookings(targetPrisma, kadapaVendorMap);

  const now = new Date();

  // AvailabilityBlock Rows for 3 Future Dates
  console.log('-> Seeding 3 AvailabilityBlock rows for future dates...');
  await targetPrisma.availabilityBlock.deleteMany({});
  const blockDates = [
    { branchId: 'h-kad-dsr-paradise', offsetDays: 5, reason: 'Hall Deep Cleaning & Floor Polishing' },
    { branchId: 'h-kad-dsr-paradise', offsetDays: 21, reason: 'Private Family Ceremony' },
    { branchId: 'h-kad-madhavi-conv', offsetDays: 49, reason: 'Stage Lighting & Audio Upgrades' }
  ];

  for (const blk of blockDates) {
    const d = new Date(now.getTime() + blk.offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await targetPrisma.availabilityBlock.create({
      data: {
        branchId: blk.branchId,
        date: d,
        reason: blk.reason
      }
    });
  }

  // 10. Seed MenuItems for catering branches
  console.log('-> Seeding menu items for catering branches...');
  await targetPrisma.menuItem.deleteMany({});
  const menuItems = [
    // Starters Veg
    { name: 'Paneer Tikka', category: 'Starters', isVeg: true },
    { name: 'Crispy Corn Kernels', category: 'Starters', isVeg: true },
    { name: 'Veg Spring Rolls', category: 'Starters', isVeg: true },
    // Starters Non-Veg
    { name: 'Andhra Chilli Chicken', category: 'Starters', isVeg: false },
    { name: 'Mutton Seekh Kebab', category: 'Starters', isVeg: false },
    { name: 'Apollo Fish Fry', category: 'Starters', isVeg: false },
    // Main Course Veg
    { name: 'Gutti Vankaya Kura', category: 'Main Course', isVeg: true },
    { name: 'Paneer Butter Masala', category: 'Main Course', isVeg: true },
    { name: 'Tomato Dal with Ghee', category: 'Main Course', isVeg: true },
    { name: 'Gongura Pachadi', category: 'Main Course', isVeg: true },
    // Main Course Non-Veg
    { name: 'Rayalaseema Natu Kodi Pulusu', category: 'Main Course', isVeg: false },
    { name: 'Dum Hyderabadi Mutton Biryani', category: 'Main Course', isVeg: false },
    { name: 'Gongura Mamsam', category: 'Main Course', isVeg: false },
    // Breads & Rice
    { name: 'Butter Naan', category: 'Breads & Rice', isVeg: true },
    { name: 'Ragi Sangati', category: 'Breads & Rice', isVeg: true },
    { name: 'Steamed Sona Masoori Rice', category: 'Breads & Rice', isVeg: true },
    { name: 'Curd Rice with Pomegranate', category: 'Breads & Rice', isVeg: true },
    // Desserts
    { name: 'Garam Gulab Jamun with Rabdi', category: 'Desserts', isVeg: true },
    { name: 'Dry Fruit Bobbatlu / Puran Poli', category: 'Desserts', isVeg: true },
    { name: 'Kaju Carrot Halwa', category: 'Desserts', isVeg: true }
  ];

  // Seed menu items for other catering branches (excluding Rajahmundry & Kadapa specific branches)
  const cateringBranches = await targetPrisma.branch.findMany({
    where: { kind: 'catering', NOT: { id: { in: [...KADAPA_BRANCH_IDS, ...RAJAHMUNDRY_BRANCH_IDS] } } }
  });
  for (const cb of cateringBranches) {
    for (const item of menuItems) {
      await targetPrisma.menuItem.create({
        data: {
          branchId: cb.id,
          name: item.name,
          category: item.category,
          isVeg: item.isVeg
        }
      });
    }
  }

  // Seed custom menu items for Rajahmundry & Kadapa catering branches
  await seedRajahmundryMenuItems(targetPrisma);
  await seedKadapaMenuItems(targetPrisma);

  // 11. Seed Platform & Vendor Notifications
  console.log('-> Seeding notifications...');
  await targetPrisma.notification.deleteMany({});
  const notifications = [
    { userId: testVendor.id, type: 'booking', title: 'New Booking Confirmed', body: 'Booking VED-CONF-1001 has been confirmed and advance received.' },
    { userId: testVendor.id, type: 'payment', title: 'Payout Processed', body: 'Payout of ₹3,06,000 for completed event was transferred.' },
    { userId: testVendor.id, type: 'chat', title: 'New Customer Inquiry', body: 'Customer inquiry received regarding wedding availability.' },
    { userId: testVendor.id, type: 'document', title: 'Document Verified', body: 'FoSCoS FSSAI licence has been verified successfully.' },
    { userId: testVendor.id, type: 'review', title: 'New 5-Star Review', body: 'A customer left a 5-star review for Sai Function Hall - Main Town.' },
    { userId: testVendor.id, type: 'system', title: 'Platform Policy Update', body: 'Standard hospitality GST & commission calculation updated.' },
    { userId: testVendor.id, type: 'alert', title: 'Hold Active', body: 'A temporary 10-minute hold is currently active for VED-HOLD-1001.' }
  ];

  for (const n of notifications) {
    await targetPrisma.notification.create({ data: n });
  }

  // Contact Violations for demo vendor
  console.log('-> Seeding contact violations for demo vendor...');
  await targetPrisma.contactViolation.deleteMany({});
  const flaggedVendor = createdVendors[0].user;
  await targetPrisma.contactViolation.create({
    data: {
      userId: flaggedVendor.id,
      pattern: 'Direct mobile number 9849012345 detected in message body'
    }
  });
  await targetPrisma.contactViolation.create({
    data: {
      userId: flaggedVendor.id,
      pattern: 'WhatsApp keyword wa.me detected in quotation'
    }
  });
  await targetPrisma.vendorProfile.update({
    where: { userId: flaggedVendor.id },
    data: { warningsCount: 2 }
  });

  console.log('✅ Seeding completed successfully!');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const mode = process.env.SEED_MODE || 'demo';
  try {
    await seedDatabase(prisma, { dryRun: isDryRun, mode });
  } catch (e) {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
