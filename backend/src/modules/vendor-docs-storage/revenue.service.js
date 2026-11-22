import { prisma } from '../../utils/prisma.js';

export async function getVendorRevenueSummary({ vendorId, range = 'monthly', branchId = null, kind = null }) {
  const where = {
    vendorId,
    status: { in: ['confirmed', 'completed'] },
    paymentStatus: 'paid',
    ...(branchId ? { branchId } : {}),
    ...(kind ? { kind } : {})
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let totalEarned = 0;
  let grossRevenue = 0;
  let commissionPaid = 0;
  let thisMonth = 0;
  let thisYear = 0;
  let completedCount = 0;
  let pendingPayout = 0;

  for (const b of bookings) {
    const payoutAmount = b.vendorPayout;
    if (b.status === 'completed') {
      totalEarned += payoutAmount;
      grossRevenue += (b.subtotal || b.vendorPayout);
      commissionPaid += (b.commission || 0);
      completedCount++;

      const bDate = new Date(b.startDate || b.createdAt);
      if (bDate.getFullYear() === currentYear) {
        thisYear += payoutAmount;
        if (bDate.getMonth() === currentMonth) {
          thisMonth += payoutAmount;
        }
      }
    } else if (b.status === 'confirmed') {
      pendingPayout += payoutAmount;
    }
  }

  // Previous month for growth calculation
  let prevMonth = 0;
  const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  for (const b of bookings) {
    if (b.status === 'completed') {
      const bDate = new Date(b.startDate || b.createdAt);
      if (bDate.getFullYear() === prevMonthYear && bDate.getMonth() === prevMonthIdx) {
        prevMonth += b.vendorPayout;
      }
    }
  }

  let growthPct = null;
  let growthLabel = 'New';
  if (prevMonth > 0) {
    growthPct = Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
    growthLabel = `${growthPct >= 0 ? '+' : ''}${growthPct}%`;
  }

  const averageBookingValue = completedCount > 0 ? Math.round(totalEarned / completedCount) : 0;

  return {
    grossRevenue,
    netRevenue: totalEarned,
    commissionPaid,
    totalEarned,
    thisMonth,
    thisYear,
    completedBookings: completedCount,
    averageBookingValue,
    pendingPayout,
    growth: {
      vsPrevious: growthPct,
      label: growthLabel
    }
  };
}

export async function getVendorRevenueSeries({ vendorId, range = 'monthly', branchId = null, kind = null }) {
  const where = {
    vendorId,
    status: 'completed',
    paymentStatus: 'paid',
    ...(branchId ? { branchId } : {}),
    ...(kind ? { kind } : {})
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startDate: 'asc' }
  });

  const now = new Date();
  const series = [];

  if (range === 'monthly') {
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

      let revenue = 0;
      let count = 0;

      for (const b of bookings) {
        const bDate = new Date(b.startDate || b.createdAt);
        if (bDate.getFullYear() === year && bDate.getMonth() === month) {
          revenue += b.vendorPayout;
          count++;
        }
      }

      series.push({
        period: monthStr,
        label,
        revenue,
        bookingsCount: count,
        growth: null // computed in next step
      });
    }
  } else {
    // Yearly: Group by year
    const yearMap = new Map();
    for (const b of bookings) {
      const bDate = new Date(b.startDate || b.createdAt);
      const year = bDate.getFullYear();
      const existing = yearMap.get(year) || { revenue: 0, count: 0 };
      existing.revenue += b.vendorPayout;
      existing.count += 1;
      yearMap.set(year, existing);
    }

    const sortedYears = Array.from(yearMap.keys()).sort();
    for (const y of sortedYears) {
      const val = yearMap.get(y);
      series.push({
        period: String(y),
        label: String(y),
        revenue: val.revenue,
        bookingsCount: val.count,
        growth: null
      });
    }
  }

  // Calculate growth vs previous period
  for (let i = 0; i < series.length; i++) {
    if (i === 0) {
      series[i].growth = null;
      series[i].growthLabel = 'New';
    } else {
      const prevRev = series[i - 1].revenue;
      const currRev = series[i].revenue;
      if (prevRev === 0) {
        series[i].growth = null;
        series[i].growthLabel = currRev > 0 ? 'New' : '0%';
      } else {
        const pct = Math.round(((currRev - prevRev) / prevRev) * 100);
        series[i].growth = pct;
        series[i].growthLabel = `${pct >= 0 ? '+' : ''}${pct}%`;
      }
    }
  }

  return series;
}

export async function getVendorRevenueBreakdown({ vendorId }) {
  const branches = await prisma.branch.findMany({
    where: { vendorId },
    include: {
      bookings: {
        where: {
          status: 'completed',
          paymentStatus: 'paid'
        }
      }
    }
  });

  let hallRevenue = 0;
  let cateringRevenue = 0;
  const branchBreakdown = [];

  for (const br of branches) {
    let brTotal = 0;
    for (const b of br.bookings) {
      brTotal += b.vendorPayout;
      if (b.kind === 'hall') hallRevenue += b.vendorPayout;
      else if (b.kind === 'catering') cateringRevenue += b.vendorPayout;
      else if (b.kind === 'combined') {
        const half = Math.round(b.vendorPayout / 2);
        hallRevenue += half;
        cateringRevenue += (b.vendorPayout - half);
      }
    }
    branchBreakdown.push({
      branchId: br.id,
      name: br.name,
      kind: br.kind,
      revenue: brTotal,
      completedBookings: br.bookings.length
    });
  }

  return {
    byCategory: {
      hall: hallRevenue,
      catering: cateringRevenue
    },
    byBranch: branchBreakdown
  };
}

export const revenueService = {
  getRevenueSummary: async (vendorId, options = {}) => {
    return getVendorRevenueSummary({ vendorId, ...options });
  },
  getRevenueSeries: async (vendorId, months = 12) => {
    const raw = await getVendorRevenueSeries({ vendorId, range: 'monthly' });
    return raw.map(r => ({
      month: r.period,
      year: r.period ? parseInt(r.period.split('-')[0]) : 2026,
      gross: r.revenue,
      net: r.revenue,
      bookingsCount: r.bookingsCount,
      growth: r.growthLabel === 'New' ? 'New' : (r.growth !== null ? r.growth : 0)
    }));
  },
  getRevenueBreakdown: async (vendorId) => {
    return getVendorRevenueBreakdown({ vendorId });
  }
};

