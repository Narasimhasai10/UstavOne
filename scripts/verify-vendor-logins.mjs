import bcrypt from '../backend/node_modules/bcryptjs/index.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  SEEDED_RAJAHMUNDRY_VENDORS,
  SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR,
  SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR
} from '../frontend/src/services/rajahmundryOfflineData.js';

const prisma = new PrismaClient();

const VENDORS_TO_TEST = [
  { username: 'Sri_convention', password: 'Vedika@BVR', expectedBranches: 2 },
  { username: 'SVPC_halls', password: 'Vedika@SVPC', expectedBranches: 2 },
  { username: 'SreeB_hall', password: 'Vedika@SBH', expectedBranches: 1 },
  { username: 'sai_caterings', password: 'Vedika@annapurna', expectedBranches: 1 },
  { username: 'Emmi_caterings', password: 'Vedika@Emmi', expectedBranches: 1 },
  { username: 'Ramya_caterings', password: 'Vedika@ramya', expectedBranches: 1 }
];

async function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function run() {
  console.log('--- TESTING BACKEND DATABASE LOGIN ---');
  for (const v of VENDORS_TO_TEST) {
    const user = await prisma.user.findFirst({
      where: { username: v.username },
      include: {
        vendorProfile: true,
        branches: {
          include: {
            bookings: true
          }
        }
      }
    });

    if (!user) {
      throw new Error(`Vendor ${v.username} not found in database!`);
    }

    const match = await bcrypt.compare(v.password, user.passwordHash);
    if (!match) {
      throw new Error(`Password mismatch for ${v.username}!`);
    }

    const branches = user.branches || [];
    if (branches.length !== v.expectedBranches) {
      throw new Error(`Branch count mismatch for ${v.username}: got ${branches.length}, expected ${v.expectedBranches}`);
    }

    const totalBookings = branches.reduce((acc, b) => acc + (b.bookings ? b.bookings.length : 0), 0);
    if (totalBookings !== 3) {
      throw new Error(`Bookings count mismatch for ${v.username}: got ${totalBookings}, expected 3`);
    }

    console.log(`✅ Backend ${v.username}: Authenticated, ${branches.length} branch(es), ${totalBookings} sample bookings`);
  }

  console.log('\n--- TESTING OFFLINE STORE LOGIN ---');
  for (const v of VENDORS_TO_TEST) {
    const offlineVendor = SEEDED_RAJAHMUNDRY_VENDORS.find(ov => ov.username.toLowerCase() === v.username.toLowerCase());
    if (!offlineVendor) {
      throw new Error(`Offline vendor ${v.username} not found!`);
    }

    const inputHash = await sha256(v.password);
    if (inputHash !== offlineVendor.passwordHash) {
      throw new Error(`Offline passwordHash mismatch for ${v.username}! Expected ${offlineVendor.passwordHash}, got ${inputHash}`);
    }

    const branches = SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR[offlineVendor.username] || [];
    if (branches.length !== v.expectedBranches) {
      throw new Error(`Offline branch count mismatch for ${v.username}: got ${branches.length}, expected ${v.expectedBranches}`);
    }

    const bookings = SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR[offlineVendor.username] || [];
    if (bookings.length !== 3) {
      throw new Error(`Offline bookings count mismatch for ${v.username}: got ${bookings.length}, expected 3`);
    }

    console.log(`✅ Offline ${v.username}: Authenticated with SHA-256, ${branches.length} branch(es), ${bookings.length} sample bookings`);
  }

  console.log('\nAll 6 vendor accounts verified successfully for backend and offline modes!');
  await prisma.$disconnect();
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
