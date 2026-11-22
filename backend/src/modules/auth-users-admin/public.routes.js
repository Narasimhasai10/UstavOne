import express from 'express';
import { prisma } from '../../utils/prisma.js';

const router = express.Router();

// 0. Public Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'live',
    timestamp: new Date().toISOString()
  });
});

// 1. Locations
router.get('/locations', async (req, res, next) => {
  try {
    const cities = await prisma.city.findMany({
      orderBy: [{ state: 'asc' }, { city: 'asc' }]
    });

    const byState = {};
    for (const c of cities) {
      if (!byState[c.state]) byState[c.state] = [];
      byState[c.state].push({
        id: c.id,
        city: c.city,
        priceMultiplier: c.priceMultiplier
      });
    }

    res.json({ states: byState, items: cities });
  } catch (err) {
    next(err);
  }
});

// 2. Events
router.get('/events', (req, res) => {
  const events = [
    { id: 'wedding', name: 'Wedding', emoji: '💍', color: '#FF5C8A', word: 'wedding', defaultBudget: 800000 },
    { id: 'reception', name: 'Reception', emoji: '🥂', color: '#E8B84A', word: 'reception', defaultBudget: 500000 },
    { id: 'engagement', name: 'Engagement', emoji: '💐', color: '#FFA62B', word: 'engagement', defaultBudget: 350000 },
    { id: 'birthday', name: 'Birthday', emoji: '🎂', color: '#5AA2FF', word: 'birthday', defaultBudget: 150000 },
    { id: 'housewarming', name: 'Housewarming', emoji: '🏡', color: '#5FD38D', word: 'housewarming', defaultBudget: 250000 },
    { id: 'corporate', name: 'Corporate Event', emoji: '💼', color: '#3DD6C6', word: 'corporate event', defaultBudget: 400000 },
    { id: 'educational', name: 'Educational Event', emoji: '🎓', color: '#F2D14B', word: 'educational event', defaultBudget: 300000 }
  ];
  res.json({ items: events });
});

// 3. Terms for Vendor
router.get('/terms/vendor', (req, res) => {
  res.json({
    version: 'v1.0',
    title: 'UstavOne Vendor Terms & Platform Guidelines',
    items: [
      { id: 1, text: 'All bookings and payments must happen through UstavOne.' },
      { id: 2, text: 'Do not share personal contact details (phone, WhatsApp, email, social media, UPI ID) in chats, calls, photos or documents; violating this leads to a warning, suspended listings, withheld payouts and permanent removal, and commission is still charged on bookings taken outside the app.' },
      { id: 3, text: 'Upload only genuine documents and your own work photos.' },
      { id: 4, text: 'Keep prices, capacity, availability and details accurate.' },
      { id: 5, text: "Honour confirmed bookings; repeated vendor cancellations reduce rating and visibility; refunds to customers are the vendor's responsibility." },
      { id: 6, text: '10% commission on each completed booking, payout after the event is completed.' },
      { id: 7, text: 'Reviews must be real.' },
      { id: 8, text: 'Caterers must keep a valid FSSAI licence; halls must follow fire and safety rules.' },
      { id: 9, text: 'Customer data may only be used for the booking.' },
      { id: 10, text: 'UstavOne may suspend or remove accounts that break these terms.' }
    ]
  });
});

// 4. Health
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

export default router;
