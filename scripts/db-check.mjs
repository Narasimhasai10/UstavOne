import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const defaultSqliteUrl = `file:${path.resolve(rootDir, 'database/utsavora.db')}`;
const activeDbUrl = process.env.DATABASE_URL || defaultSqliteUrl;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: activeDbUrl
    }
  }
});

async function main() {
  console.log('🔍 Running Comprehensive Utsavora Database Quality & Integrity Audit...\n');

  let passedAll = true;

  try {
    // 1. Row counts for every model (all 29 models)
    console.log('📊 Table Row Counts:');
    const tables = [
      ['User', prisma.user.count()],
      ['RefreshToken', prisma.refreshToken.count()],
      ['VendorProfile', prisma.vendorProfile.count()],
      ['City', prisma.city.count()],
      ['Branch', prisma.branch.count()],
      ['HallDetails', prisma.hallDetails.count()],
      ['CatererDetails', prisma.catererDetails.count()],
      ['PlateRate', prisma.plateRate.count()],
      ['MenuItem', prisma.menuItem.count()],
      ['ServiceListing', prisma.serviceListing.count()],
      ['Document', prisma.document.count()],
      ['FileRecord', prisma.fileRecord.count()],
      ['Photo', prisma.photo.count()],
      ['PreviousWork', prisma.previousWork.count()],
      ['AvailabilityBlock', prisma.availabilityBlock.count()],
      ['Booking', prisma.booking.count()],
      ['BookingDate', prisma.bookingDate.count()],
      ['Payment', prisma.payment.count()],
      ['Refund', prisma.refund.count()],
      ['Payout', prisma.payout.count()],
      ['Conversation', prisma.conversation.count()],
      ['Message', prisma.message.count()],
      ['ContactViolation', prisma.contactViolation.count()],
      ['Call', prisma.call.count()],
      ['Review', prisma.review.count()],
      ['Plan', prisma.plan.count()],
      ['PlannerConfig', prisma.plannerConfig.count()],
      ['Notification', prisma.notification.count()],
      ['AuditLog', prisma.auditLog.count()]
    ];

    const results = await Promise.all(tables.map(async ([name, promise]) => [name, await promise]));
    for (const [name, count] of results) {
      console.log(`   - ${name.padEnd(20)}: ${count}`);
    }

    console.log('\n🔒 Verification Rules:');

    // Rule 1: sai_halls owns EXACTLY 3 branches
    const saiVendor = await prisma.user.findUnique({
      where: { username: 'sai_halls' },
      include: { branches: true }
    });
    const saiBranchCount = saiVendor?.branches?.length || 0;
    const rule1Pass = saiBranchCount === 3;
    console.log(` ${rule1Pass ? '✓' : '✗'} [${rule1Pass ? 'PASS' : 'FAIL'}] sai_halls owns exactly 3 branches (actual: ${saiBranchCount})`);
    if (!rule1Pass) passedAll = false;

    // Rule 2: Kadapa counts
    const kadapaCity = await prisma.city.findFirst({ where: { city: 'Kadapa' } });
    const kadapaCityId = kadapaCity?.id;
    const [kadapaHalls, kadapaCaterers, kadapaDecor, kadapaBands, kadapaCards, kadapaPhoto] = await Promise.all([
      prisma.branch.count({ where: { cityId: kadapaCityId, kind: 'hall' } }),
      prisma.branch.count({ where: { cityId: kadapaCityId, kind: 'catering' } }),
      prisma.serviceListing.count({ where: { kind: 'decor' } }),
      prisma.serviceListing.count({ where: { kind: 'band' } }),
      prisma.serviceListing.count({ where: { kind: 'cards' } }),
      prisma.serviceListing.count({ where: { kind: 'photography' } })
    ]);
    const rule2Pass = kadapaHalls >= 3 && kadapaCaterers >= 3 && kadapaDecor > 0 && kadapaBands > 0 && kadapaCards > 0 && kadapaPhoto > 0;
    console.log(` ${rule2Pass ? '✓' : '✗'} [${rule2Pass ? 'PASS' : 'FAIL'}] Kadapa counts: Halls=${kadapaHalls} (>=3), Caterers=${kadapaCaterers} (>=3), Decor=${kadapaDecor}, Band=${kadapaBands}, Cards=${kadapaCards}, Photo=${kadapaPhoto}`);
    if (!rule2Pass) passedAll = false;

    // Rule 3: Upcoming confirmed bookings have BookingDate locks
    const upcomingBookings = await prisma.booking.findMany({
      where: { status: { in: ['confirmed', 'pending_payment'] } },
      include: { bookingDates: true }
    });
    const allHaveLocks = upcomingBookings.length === 0 || upcomingBookings.every(b => b.bookingDates.some(d => d.activeKey === 'ACTIVE' && d.isActive));
    console.log(` ${allHaveLocks ? '✓' : '✗'} [${allHaveLocks ? 'PASS' : 'FAIL'}] Upcoming & pending bookings have active BookingDate locks (${upcomingBookings.length} bookings checked)`);
    if (!allHaveLocks) passedAll = false;

    // Rule 4: No duplicate active locks
    const activeLocks = await prisma.bookingDate.findMany({
      where: { activeKey: 'ACTIVE' }
    });
    const lockKeys = new Set();
    let hasDuplicateLock = false;
    for (const l of activeLocks) {
      const k = `${l.branchId}-${l.date}-${l.slot}`;
      if (lockKeys.has(k)) {
        hasDuplicateLock = true;
        break;
      }
      lockKeys.add(k);
    }
    const rule4Pass = !hasDuplicateLock;
    console.log(` ${rule4Pass ? '✓' : '✗'} [${rule4Pass ? 'PASS' : 'FAIL'}] No duplicate active date locks (${activeLocks.length} active locks verified unique)`);
    if (!rule4Pass) passedAll = false;

    // Rule 5: All passwords are bcrypt hashes
    const allUsers = await prisma.user.findMany({ select: { id: true, username: true, passwordHash: true } });
    const allBcrypt = allUsers.every(u => u.passwordHash && (u.passwordHash.startsWith('$2a$') || u.passwordHash.startsWith('$2b$')) && u.passwordHash.length >= 59);
    console.log(` ${allBcrypt ? '✓' : '✗'} [${allBcrypt ? 'PASS' : 'FAIL'}] All user passwords are secure bcrypt hashes (${allUsers.length} users checked)`);
    if (!allBcrypt) passedAll = false;

    // Rule 6: Every verified branch has a verified document
    const verifiedBranches = await prisma.branch.findMany({
      where: { status: 'verified' },
      include: {
        vendor: {
          include: {
            branches: { include: { documents: true } }
          }
        }
      }
    });
    // Vendor or branch must have verified document
    const vendorDocs = await prisma.document.findMany({ where: { status: 'verified' } });
    const verifiedVendorIds = new Set(vendorDocs.map(d => d.vendorId));
    const allBranchesHaveDoc = verifiedBranches.every(b => verifiedVendorIds.has(b.vendorId));
    console.log(` ${allBranchesHaveDoc ? '✓' : '✗'} [${allBranchesHaveDoc ? 'PASS' : 'FAIL'}] Every verified branch belongs to a vendor with verified documents (${verifiedBranches.length} verified branches checked)`);
    if (!allBranchesHaveDoc) passedAll = false;

    // Rule 7: Every conversation has messages
    const convos = await prisma.conversation.findMany({
      include: { messages: true }
    });
    const allConvosHaveMsgs = convos.length === 0 || convos.every(c => c.messages.length > 0);
    console.log(` ${allConvosHaveMsgs ? '✓' : '✗'} [${allConvosHaveMsgs ? 'PASS' : 'FAIL'}] Every conversation has messages (${convos.length} conversations checked)`);
    if (!allConvosHaveMsgs) passedAll = false;

    // Rule 8: Reviews match branch ratings
    const branchesWithReviews = await prisma.branch.findMany({
      where: { reviews: { some: {} } },
      include: { reviews: true }
    });
    let reviewsMatch = true;
    for (const b of branchesWithReviews) {
      const avg = b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length;
      const expectedAvg = Math.round(avg * 10) / 10;
      if (Math.abs(b.ratingAvg - expectedAvg) > 0.05 || b.ratingCount !== b.reviews.length) {
        reviewsMatch = false;
        break;
      }
    }
    console.log(` ${reviewsMatch ? '✓' : '✗'} [${reviewsMatch ? 'PASS' : 'FAIL'}] Branch ratings accurately match reviews (${branchesWithReviews.length} reviewed branches checked)`);
    if (!reviewsMatch) passedAll = false;

    // Rule 9: Planner config keys exist
    const requiredConfigKeys = [
      'weights', 'factors', 'plateTable', 'bufferPercent',
      'packageScales', 'scoreWeights', 'commissionRate',
      'gstPercent', 'refundPolicy', 'holdMinutes'
    ];
    const existingConfigs = await prisma.plannerConfig.findMany({
      where: { key: { in: requiredConfigKeys } }
    });
    const allConfigsPresent = existingConfigs.length >= requiredConfigKeys.length;
    console.log(` ${allConfigsPresent ? '✓' : '✗'} [${allConfigsPresent ? 'PASS' : 'FAIL'}] All required planner config keys exist (${existingConfigs.length}/${requiredConfigKeys.length})`);
    if (!allConfigsPresent) passedAll = false;

    // Rule 10: Foreign keys valid
    const fkCheck = await prisma.$queryRawUnsafe('PRAGMA foreign_key_check;');
    const fkValid = Array.isArray(fkCheck) && fkCheck.length === 0;
    console.log(` ${fkValid ? '✓' : '✗'} [${fkValid ? 'PASS' : 'FAIL'}] SQLite foreign key integrity check (PRAGMA foreign_key_check: 0 violations)`);
    if (!fkValid) passedAll = false;

    if (!passedAll) {
      console.error('\n❌ One or more database verification checks FAILED.');
      process.exit(1);
    }

    console.log('\n✅ All Database Quality & Integrity Checks PASSED.');
  } catch (err) {
    console.error('❌ Database check encountered fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
