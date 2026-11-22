import { prisma as defaultPrisma } from "../../utils/prisma.js";

/**
 * Lazy Hold Expiration
 * Releases booking holds that have passed their expiration timestamp.
 * Can be called with either a transaction client or the default prisma client.
 *
 * @param {import('@prisma/client').PrismaClient} [txOrPrisma]
 * @returns {Promise<number>} Number of expired bookings released
 */
export async function releaseExpiredHolds(txOrPrisma = defaultPrisma) {
  try {
    const now = new Date();

    const expiredBookings = await txOrPrisma.booking.findMany({
      where: {
        status: "pending_payment",
        holdExpiresAt: { lt: now }
      },
      select: { id: true, code: true }
    });

    if (!expiredBookings || expiredBookings.length === 0) {
      return 0;
    }

    const expiredIds = expiredBookings.map(b => b.id);

    // Release booked dates so activeKey="ACTIVE" is freed
    await txOrPrisma.bookingDate.updateMany({
      where: {
        bookingId: { in: expiredIds },
        activeKey: "ACTIVE"
      },
      data: {
        isActive: false,
        activeKey: null
      }
    });

    // Mark bookings as expired
    await txOrPrisma.booking.updateMany({
      where: {
        id: { in: expiredIds }
      },
      data: {
        status: "expired",
        holdExpiresAt: null
      }
    });

    return expiredBookings.length;
  } catch (err) {
    console.error("[LazyHoldExpiry] Error releasing expired holds:", err.message);
    return 0;
  }
}

export default releaseExpiredHolds;
