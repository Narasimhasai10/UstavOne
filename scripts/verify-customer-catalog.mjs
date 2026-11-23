import { PrismaClient } from '@prisma/client';
import dummyVendors from '../frontend/src/data/dummyVendors.json' with { type: 'json' };
import { getUnifiedVendorsCatalog, seedTestVendor } from '../frontend/src/services/store.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- VERIFYING RAJAHMUNDRY CATALOG IN DATABASE ---');
  const city = await prisma.city.findFirst({
    where: { city: 'Rajahmundry' },
    include: {
      branches: {
        include: {
          hallDetails: true,
          catererDetails: true,
          plateRates: true,
          photos: true,
          works: true
        }
      }
    }
  });

  if (!city) {
    throw new Error('Rajahmundry city not found in DB!');
  }

  const dbHalls = city.branches.filter(b => b.kind === 'hall');
  const dbCaterers = city.branches.filter(b => b.kind === 'catering');

  console.log(`DB Halls in Rajahmundry: ${dbHalls.length}`);
  console.log(`DB Caterers in Rajahmundry: ${dbCaterers.length}`);

  if (dbHalls.length !== 3) throw new Error(`Expected 3 halls in DB, got ${dbHalls.length}`);
  if (dbCaterers.length !== 5) throw new Error(`Expected 5 caterers in DB, got ${dbCaterers.length}`);

  for (const b of city.branches) {
    if (b.photos.length !== 0) throw new Error(`Branch ${b.name} has ${b.photos.length} photos! Expected 0 photos.`);
    if (b.works.length !== 0) throw new Error(`Branch ${b.name} has ${b.works.length} previous works! Expected 0.`);
  }
  console.log('✅ 0 photos and 0 previous works across all 8 branches (no stock photos).');

  // Verify SVPC cancellation policy
  const svpcHall = dbHalls.find(h => h.name.includes('SVPC'));
  if (!svpcHall.description.includes('Cancellations are non-refundable.')) {
    throw new Error('SVPC Hall description missing "Cancellations are non-refundable."');
  }
  console.log('✅ SVPC Hall description includes "Cancellations are non-refundable."');

  // Verify BVR policies
  const bvrHall = dbHalls.find(h => h.name.includes('BVR'));
  const bvrDesc = bvrHall.description.toLowerCase();
  if (!bvrDesc.includes('outside food') || !bvrDesc.includes('outside dj') || !bvrDesc.includes('outside decorators') || !bvrDesc.includes('outside alcohol')) {
    throw new Error('BVR Hall description missing required outside policy details');
  }
  console.log('✅ BVR Hall description includes full outside policies.');

  // Verify Sai Annapurna pure veg
  const saiAnnapurna = dbCaterers.find(c => c.name.includes('Sai Annapurna'));
  if (!saiAnnapurna) throw new Error('Sai Annapurna not found');
  const foodTypes = JSON.parse(saiAnnapurna.catererDetails.foodTypes);
  if (foodTypes.length !== 1 || foodTypes[0] !== 'veg') {
    throw new Error(`Sai Annapurna foodTypes is ${JSON.stringify(foodTypes)}, expected ["veg"]`);
  }
  const nonVegRates = saiAnnapurna.plateRates.filter(pr => pr.foodType !== 'veg');
  if (nonVegRates.length > 0) {
    throw new Error(`Sai Annapurna has ${nonVegRates.length} non-veg plate rates!`);
  }
  console.log('✅ Sai Annapurna is pure veg only (foodTypes: ["veg"], 0 non-veg plate rates).');

  // Verify BVR Catering & SVPC Catering empty plate rates
  const bvrCat = dbCaterers.find(c => c.name.includes('BVR'));
  const svpcCat = dbCaterers.find(c => c.name.includes('SVPC'));
  if (bvrCat.plateRates.length !== 0) throw new Error(`BVR Catering has ${bvrCat.plateRates.length} plate rates, expected 0`);
  if (svpcCat.plateRates.length !== 0) throw new Error(`SVPC Catering has ${svpcCat.plateRates.length} plate rates, expected 0`);
  console.log('✅ BVR & SVPC Catering have empty plate rates (Rates on request).');

  console.log('\n--- VERIFYING UNIFIED CATALOG (STORE.JS) ---');
  // Mock localStorage for node environment
  const mockStorage = {};
  global.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
  };

  seedTestVendor();
  const catalog = getUnifiedVendorsCatalog(dummyVendors);
  const rjyHalls = catalog.halls.filter(h => h.city.toLowerCase() === 'rajahmundry');
  const rjyCaterers = catalog.caterers.filter(c => c.city.toLowerCase() === 'rajahmundry');

  console.log(`Unified catalog Rajahmundry halls: ${rjyHalls.length}`);
  console.log(`Unified catalog Rajahmundry caterers: ${rjyCaterers.length}`);

  if (rjyHalls.length !== 3) throw new Error(`Expected 3 halls in unified catalog, got ${rjyHalls.length}`);
  if (rjyCaterers.length !== 5) throw new Error(`Expected 5 caterers in unified catalog, got ${rjyCaterers.length}`);

  for (const h of rjyHalls) {
    console.log(`Hall: ${h.name} | Price: ${h.price} | Rating: ${h.rating} | Capacity: ${h.capacity} | AC: ${h.isAC} | Photos: ${h.photos.length}`);
    if (h.photos.length !== 0) throw new Error(`${h.name} has photos in catalog! Expected 0.`);
  }

  for (const c of rjyCaterers) {
    console.log(`Caterer: ${c.name} | Price: ${c.priceDisplay} | Rating: ${c.rating} | FoodType: ${c.foodType} | Photos: ${c.photos.length}`);
    if (c.photos.length !== 0) throw new Error(`${c.name} has photos in catalog! Expected 0.`);
  }

  console.log('\nAll customer portal checks passed!');
  await prisma.$disconnect();
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
