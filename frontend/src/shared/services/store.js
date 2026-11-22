import './migration.js';
import { sha256 } from '../utils/cryptoUtils.js';
import {
  stripPhotoUrlsForStorage,
  resolvePhotoUrls,
  migrateInlinePhotosToIndexedDB
} from '../utils/photos.js';
import {
  SEEDED_RAJAHMUNDRY_VENDORS,
  SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR,
  SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR
} from '../../features/vendor/rajahmundryOfflineData.js';
import {
  SEEDED_KADAPA_VENDORS,
  SEEDED_KADAPA_BRANCHES_BY_VENDOR,
  SEEDED_KADAPA_BOOKINGS_BY_VENDOR
} from '../../features/vendor/kadapaOfflineData.js';
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  listForVendor,
  listForCustomer,
  markRead,
  unreadCountForVendor,
  unreadCountForCustomer,
  subscribeChat,
  migrateChatData,
  getChatMessagesCompat,
  addChatMessageCompat,
  getVendorChatThreadsCompat,
  addVendorChatMessageCompat,
  getActiveChatVendorIdsCompat
} from '../../features/booking-chat/chatStore.js';

/**
 * NOTE ON STORAGE IDENTIFIERS:
 * Storage keys use 'utsavora_*' prefix with migration from legacy 'vedika_*'
 * (e.g. utsavora_vendors, utsavora_branches_*, utsavora_photos_db) to preserve existing
 * user data, credentials, and offline persistence following the application
 * rebranding to "Utsavora".
 */

// In-memory fallback if localStorage throws on file://
const inMemoryStore = new Map();

function storageGet(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (err) {
    console.warn('[store] localStorage read error, using in-memory fallback:', err);
  }
  return inMemoryStore.get(key) || null;
}

function storageSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
      return true;
    }
  } catch (err) {
    console.error('[store] localStorage write error (quota exceeded or restricted):', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('utsavora:storage-error', { detail: { key, error: err.message } }));
      window.dispatchEvent(new CustomEvent('utsavora:toast', {
        detail: { message: `Storage save failed: ${err.message}`, type: 'error' }
      }));
    }
    return false;
  }
  inMemoryStore.set(key, String(value));
  return true;
}

export function dispatchCatalogChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('utsavora:catalog-changed'));
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('utsavora_catalog_channel');
        bc.postMessage({ type: 'utsavora:catalog-changed', timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  }
}

function storageRemove(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch (err) {
    console.warn('[store] localStorage remove error:', err);
  }
  inMemoryStore.delete(key);
}

// Seed accounts for testing
export const TEST_USERS = [
  {
    name: 'D L Narasimha sai',
    phone: '9390075877',
    email: 'narasimhasai1012@gmail.com',
    upiId: 'narasimhasai@okhdfcbank',
    passwordHash: '8fb60b2d53e14d468ece00ece885b44ca48a1b4dd3d1637d9504915e22a7a2f3', // sha256 of 'sai@1398'
    city: 'Kadapa',
    state: 'Andhra Pradesh',
    location: {
      city: 'Kadapa',
      state: 'Andhra Pradesh',
      pincode: '516001',
      source: 'manual'
    },
    role: 'user',
    photo: null
  },
  {
    name: 'K V Chanikya',
    phone: '6305729847',
    email: 'chanikyakv@gmail.com',
    upiId: 'chanikyakv@okhdfcbank',
    passwordHash: '671293c95c63c4aeb9f0fd5a1bdb1c2cb366f987747ed22a513006da483f7b61', // sha256 of 'chani@850218'
    city: 'Rajahmundry',
    state: 'Andhra Pradesh',
    location: {
      city: 'Rajahmundry',
      state: 'Andhra Pradesh',
      pincode: '533101',
      source: 'manual'
    },
    role: 'user',
    photo: null
  },
  {
    name: 'B Sriram',
    phone: '9963773539',
    email: 'sriramboddu@gmail.com',
    upiId: 'sriramboddu@okhdfcbank',
    passwordHash: 'b4afddc9cac2db3784b0d801d69972e04a77e2849b8fc7d0900faeb6fe604de3', // sha256 of 'Kumar@138'
    city: 'Rajahmundry',
    state: 'Andhra Pradesh',
    location: {
      city: 'Rajahmundry',
      state: 'Andhra Pradesh',
      pincode: '533101',
      source: 'manual'
    },
    role: 'user',
    photo: null
  }
];

export const TEST_USER = TEST_USERS[0];
export const TEST_ACCOUNT = TEST_USER;

/**
 * Seed the test accounts on app init
 * Starts with ZERO bookings
 */
export function seedTestAccount() {
  try {
    const raw = storageGet('utsavora_users');
    let users = raw ? JSON.parse(raw) : [];

    // Purge any customer user from storage that is not one of the three allowed customers
    // Preserve vendor demo accounts (role === 'vendor', username === 'sai_halls', or vendor phones)
    const allowedCustomerPhones = new Set(TEST_USERS.map(u => u.phone));
    users = users.filter(u => {
      if (!u) return false;
      if (u.role === 'vendor' || u.username === 'sai_halls' || u.phone === '9876543210' || u.phone === '9849012345') {
        return true;
      }
      return allowedCustomerPhones.has(u.phone);
    });

    // Upsert all three customers into utsavora_users
    for (const testCustomer of TEST_USERS) {
      const idx = users.findIndex(u => u && u.phone === testCustomer.phone);
      if (idx === -1) {
        users.push({ ...testCustomer });
      } else {
        users[idx] = {
          ...testCustomer,
          ...users[idx],
          name: testCustomer.name,
          phone: testCustomer.phone,
          email: testCustomer.email,
          city: testCustomer.city,
          state: testCustomer.state,
          location: testCustomer.location,
          passwordHash: testCustomer.passwordHash,
          role: 'user',
          upiId: users[idx].upiId || testCustomer.upiId
        };
      }
    }

    storageSet('utsavora_users', JSON.stringify(users));
  } catch (err) {
    console.warn('[store] seedTestAccount failed:', err);
  }
}

/**
 * Authentication
 */
export async function authenticateUser(phone, password) {
  try {
    seedTestAccount();
    const raw = storageGet('utsavora_users');
    const users = raw ? JSON.parse(raw) : [];
    const user = users.find(u => u && u.phone === String(phone).trim());
    if (!user) return { success: false, error: 'No account found with this mobile number.' };

    const hash = await sha256(password);
    if (user.passwordHash === hash || user.password === password) {
      setCurrentUser(user);
      return { success: true, user };
    }
    return { success: false, error: 'Incorrect password. Please try again.' };
  } catch (err) {
    return { success: false, error: 'Authentication failed: ' + err.message };
  }
}

export function getCurrentUser() {
  try {
    const raw = storageGet('utsavora_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  try {
    if (user) {
      storageSet('utsavora_current_user', JSON.stringify(user));
    } else {
      storageRemove('utsavora_current_user');
    }
  } catch (err) {
    console.warn('[store] setCurrentUser failed:', err);
  }
}

/**
 * Check if a phone number is registered by another user
 */
export function isPhoneTaken(phone, excludePhone = '') {
  try {
    const raw = storageGet('utsavora_users');
    const users = raw ? JSON.parse(raw) : [];
    return users.some(u => u.phone === phone && u.phone !== excludePhone);
  } catch {
    return false;
  }
}

/**
 * Update User Profile
 */
export async function updateUserProfile(currentPhone, updates) {
  try {
    const raw = storageGet('utsavora_users');
    let users = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex(u => u.phone === currentPhone);

    if (idx === -1) {
      return { success: false, error: 'User not found' };
    }

    const updatedUser = {
      ...users[idx],
      ...updates
    };

    users[idx] = updatedUser;
    storageSet('utsavora_users', JSON.stringify(users));

    // Also update if phone changed: migrate bookings
    if (updates.phone && updates.phone !== currentPhone) {
      const oldBookings = storageGet(`utsavora_bookings_${currentPhone}`);
      if (oldBookings) {
        storageSet(`utsavora_bookings_${updates.phone}`, oldBookings);
        storageRemove(`utsavora_bookings_${currentPhone}`);
      }
    }

    setCurrentUser(updatedUser);
    return { success: true, user: updatedUser };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Change Password
 */
export async function changeUserPassword(phone, currentPassword, newPassword) {
  try {
    const raw = storageGet('utsavora_users');
    let users = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex(u => u.phone === phone);

    if (idx === -1) return { success: false, error: 'User not found' };

    const currentHash = await sha256(currentPassword);
    if (users[idx].passwordHash !== currentHash && users[idx].password !== currentPassword) {
      return { success: false, error: 'Current password does not match.' };
    }

    const newHash = await sha256(newPassword);
    users[idx].passwordHash = newHash;
    storageSet('utsavora_users', JSON.stringify(users));

    const cur = getCurrentUser();
    if (cur && cur.phone === phone) {
      setCurrentUser({ ...cur, passwordHash: newHash });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Event Selection Persistence (Saved in localStorage as "utsavora.event")
 */
export function getSelectedEvent() {
  try {
    return storageGet('utsavora.event') || 'wedding';
  } catch {
    return 'wedding';
  }
}

export function setSelectedEvent(eventId) {
  try {
    storageSet('utsavora.event', eventId || 'wedding');
  } catch (err) {
    console.warn('[store] setSelectedEvent failed:', err);
  }
}

/**
 * Bookings Store
 */
export function getUserBookings(phone) {
  try {
    const key = `utsavora_bookings_${phone || 'guest'}`;
    const raw = storageGet(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserBooking(phone, booking) {
  try {
    const key = `utsavora_bookings_${phone || 'guest'}`;
    const current = getUserBookings(phone);
    const newBooking = {
      id: booking.id || (`UTS-${Date.now().toString(36).toUpperCase()}`),
      createdAt: new Date().toISOString(),
      status: 'Confirmed',
      paymentStatus: 'Paid',
      ...booking
    };
    const updated = [newBooking, ...current];
    storageSet(key, JSON.stringify(updated));

    // Also add a chat confirmation line to vendor's chat
    if (booking.vendorId) {
      addChatMessage(booking.vendorId, {
        sender: 'vendor',
        text: `Your booking is confirmed for ${booking.date || 'your event'}. Booking ID: ${newBooking.id}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true
      });
    }

    // Bidirectional sync: also record in vendor's bookings store
    const vendorUsername = booking.vendorUsername || (
      (booking.vendorId && (booking.vendorId.startsWith('h-kad-') || booking.vendorId.startsWith('c-kad-') || booking.vendorId.includes('sai')))
        ? 'sai_halls'
        : 'sai_halls'
    );
    if (vendorUsername) {
      const vBookings = getVendorBookings(vendorUsername);
      const gross = booking.total || booking.amount || 140000;
      const commission = Math.round(gross * 0.10);
      const payout = gross - commission;
      const vBookingRecord = {
        ...newBooking,
        vendorUsername,
        branchId: booking.vendorId || 'h-kad-1',
        branchName: booking.vendorName || 'Sai Function Hall',
        branchType: booking.vendorType || 'hall',
        customerName: booking.userName || (getCurrentUser()?.name) || 'D L Narasimha',
        customerInitial: (getCurrentUser()?.name?.charAt(0)) || 'N',
        customerPhone: phone,
        amount: gross,
        commission,
        payout,
        paymentStatus: booking.paymentStatus || 'Paid',
        payoutStatus: 'Pending',
        status: booking.status || 'Confirmed',
        utrNumber: booking.utrNumber || ''
      };
      storageSet(`utsavora_vendor_bookings_${vendorUsername}`, JSON.stringify([vBookingRecord, ...vBookings]));
    }

    return newBooking;
  } catch (err) {
    console.warn('[store] saveUserBooking failed:', err);
    return booking;
  }
}

export function cancelUserBooking(phone, bookingId) {
  try {
    const key = `utsavora_bookings_${phone || 'guest'}`;
    const current = getUserBookings(phone);
    let target = null;
    const updated = current.map(b => {
      if (b.id === bookingId) {
        target = b;
        const isNonRef = Boolean(
          b.isNonRefundable ||
          b.description?.includes('non-refundable') ||
          b.vendorName?.toLowerCase().includes('svpc')
        );
        return {
          ...b,
          status: 'Cancelled',
          paymentStatus: isNonRef ? 'No refund (non-refundable)' : 'Refund pending',
          refundAmount: isNonRef ? 0 : (b.totalAmount || b.amount || 0),
          refundPercentage: isNonRef ? 0 : 100,
          cancelledAt: new Date().toISOString()
        };
      }
      return b;
    });
    storageSet(key, JSON.stringify(updated));

    // Also update vendor side
    if (target?.vendorUsername || target?.vendorId) {
      const vUser = target.vendorUsername || 'sai_halls';
      const isNonRef = Boolean(
        target.isNonRefundable ||
        target.description?.includes('non-refundable') ||
        target.vendorName?.toLowerCase().includes('svpc')
      );
      const vBookings = getVendorBookings(vUser).map(vb => {
        if (vb.id === bookingId) {
          return {
            ...vb,
            status: 'Cancelled',
            paymentStatus: isNonRef ? 'No refund (non-refundable)' : 'Refund pending',
            refundAmount: isNonRef ? 0 : (vb.totalAmount || vb.amount || 0),
            refundPercentage: isNonRef ? 0 : 100,
            cancelledAt: new Date().toISOString()
          };
        }
        return vb;
      });
      storageSet(`utsavora_vendor_bookings_${vUser}`, JSON.stringify(vBookings));
    }
    return true;
  } catch (err) {
    console.warn('[store] cancelUserBooking failed:', err);
    return false;
  }
}

export const cancelBooking = cancelUserBooking;

/**
 * Chats Store
 */
export function getChatMessages(vendorId) {
  return getChatMessagesCompat(vendorId);
}

export function addChatMessage(vendorId, message) {
  return addChatMessageCompat(vendorId, message);
}

export function addVoiceCallLog(vendorId, durationFormatted = '2:14') {
  return addChatMessage(vendorId, {
    sender: 'system',
    text: `📞 Voice call · ${durationFormatted}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isCallLog: true
  });
}

/**
 * Retrieve list of active vendor IDs with chat history
 */
export function getActiveChatVendorIds() {
  return getActiveChatVendorIdsCompat();
}

/**
 * Saved Plans Store
 */
export function saveUserPlan(plan) {
  try {
    storageSet('utsavora_saved_plan', JSON.stringify({
      plan,
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch {
    return false;
  }
}

export function getSavedPlan() {
  try {
    const raw = storageGet('utsavora_saved_plan');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ==========================================================================
   VENDOR STORE & MULTI-TENANT MANAGEMENT
   ========================================================================== */

export const TEST_VENDOR = {
  username: 'sai_halls',
  passwordHash: '8b7d90d8a6efbe63d91cf327bf02256dfac1cc87189fa94665a3d7d74db5304b', // SHA-256 for 'Vedika@123'
  password: 'Vedika@123',
  name: 'Sai Kumar',
  owns: 'both', // 'hall' | 'catering' | 'both'
  businessType: 'both',
  businessName: 'Sai Function Hall',
  hallName: 'Sai Function Hall',
  cateringName: 'Annapurna Catering',
  businessNameHall: 'Sai Function Hall',
  businessNameCatering: 'Annapurna Catering',
  phone: '9849012345',
  email: 'sai.halls.kadapa@gmail.com',
  upiId: 'sai.halls@okaxis',
  tradeLicenceNumber: 'TL-KAD-2024-8891',
  fssaiNumber: '10123004005678',
  tradeLicenceStatus: 'Verified',
  fssaiStatus: 'Verified',
  memberSince: 'January 2025',
  warnings: 0,
  warningsCount: 0,
  flaggedForReview: false,
  photo: null
};

// Seeded branches for sai_halls
export const SEEDED_BRANCHES = [
  {
    id: 'h-kad-1',
    vendorUsername: 'sai_halls',
    name: 'Sai Function Hall - Central',
    upiId: 'sai.halls@okaxis',
    type: 'hall',
    city: 'Kadapa',
    state: 'Andhra Pradesh',
    street: '7/412, Trunk Road, Near Seven Roads Circle',
    pincode: '516001',
    capacity: 500,
    isAC: true,
    price: 110000,
    basePrice: 85000,
    acPrice: 110000,
    halfDayPrice: 55000,
    parkingSpaces: 80,
    rooms: 6,
    amenities: ['Parking', 'Generator', 'Dining area', 'Bridal room', 'Stage', 'Sound system', 'Lift'],
    status: 'Verified',
    tradeLicenceNumber: 'TL-KAD-2024-8891',
    rating: 4.8,
    reviewsCount: 38,
    photos: [],
    bookedDates: ['2026-12-10', '2026-12-15', '2026-12-25']
  },
  {
    id: 'h-kad-sai-bypass',
    vendorUsername: 'sai_halls',
    name: 'Sai Grand Convention & Hall',
    type: 'hall',
    city: 'Kadapa',
    state: 'Andhra Pradesh',
    street: 'Plot 18, Ring Road Bypass, Near RIMS Hospital',
    pincode: '516002',
    capacity: 850,
    isAC: true,
    price: 175000,
    basePrice: 135000,
    acPrice: 175000,
    halfDayPrice: 90000,
    parkingSpaces: 160,
    rooms: 10,
    amenities: ['Parking', 'Generator', 'Dining area', 'Bridal room', 'Stage', 'Sound system', 'Lift', 'Valet'],
    status: 'Verified',
    tradeLicenceNumber: 'TL-KAD-2024-8891',
    rating: 4.9,
    reviewsCount: 52,
    photos: [],
    bookedDates: ['2027-01-14']
  },
  {
    id: 'c-kad-annapurna',
    vendorUsername: 'sai_halls',
    name: 'Annapurna Catering Services',
    type: 'caterer',
    city: 'Kadapa',
    state: 'Andhra Pradesh',
    street: 'Shop 4, Annapurna Complex, Nagarajupeta',
    pincode: '516001',
    cuisines: ['andhra', 'south indian', 'north indian'],
    servingStyles: ['buffet', 'banana leaf', 'table service'],
    minPlates: 80,
    plateRates: {
      basic: { veg: 180, nonVeg: 240 },
      standard: { veg: 240, nonVeg: 340 },
      premium: { veg: 380, nonVeg: 520 },
      luxury: { veg: 580, nonVeg: 780 }
    },
    price: 240,
    effectivePrice: 240,
    status: 'Verified',
    fssaiNumber: '10123004005678',
    rating: 4.8,
    reviewsCount: 64,
    photos: [],
    bookedDates: []
  }
];

// Seeded 6 previous works for sai_halls
export const SEEDED_PREVIOUS_WORKS = [
  {
    id: 'pw-1',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-1',
    title: 'Ravi & Anu Wedding',
    eventType: 'wedding',
    date: '2026-02-14',
    guests: 650,
    caption: 'Grand floral mandap with traditional nadaswaram welcome and lavish 24-item Andhra feast.',
    photos: []
  },
  {
    id: 'pw-2',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-1',
    title: "Kavya's 1st Birthday Bash",
    eventType: 'birthday',
    date: '2026-03-22',
    guests: 140,
    caption: 'Whimsical pastel balloon theme, live dessert counter, and kid-friendly buffet.',
    photos: []
  },
  {
    id: 'pw-3',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-sai-bypass',
    title: 'Rayalaseema Tech Summit',
    eventType: 'corporate',
    date: '2026-04-10',
    guests: 320,
    caption: 'High-definition acoustic stage, dual LED walls, and executive high-tea buffet.',
    photos: []
  },
  {
    id: 'pw-4',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-sai-bypass',
    title: 'Srinivas & Megha Reception',
    eventType: 'reception',
    date: '2026-06-18',
    guests: 550,
    caption: 'Crystal canopy stage with velvet red carpet and multi-cuisine live barbecue counters.',
    photos: []
  },
  {
    id: 'pw-5',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-1',
    title: 'Venkatesh Gruhapravesam',
    eventType: 'housewarming',
    date: '2026-08-05',
    guests: 200,
    caption: 'Traditional brass diya decor, marigold arch, and authentic banana-leaf satvik feast.',
    photos: []
  },
  {
    id: 'pw-6',
    vendorUsername: 'sai_halls',
    branchId: 'h-kad-sai-bypass',
    title: 'Nagarjuna College Alumni Meet',
    eventType: 'educational',
    date: '2026-10-12',
    guests: 400,
    caption: 'Auditorium sound arrangement, felicitation dais, and grand buffet dinner.',
    photos: []
  }
];

// Helper to generate 12 months of realistic seeded bookings for sai_halls showing steady growth
export function generateSeededBookings() {
  const bookings = [];
  const monthlyRevenueConfig = [
    { month: '2025-11', count: 2, gross: 180000 },
    { month: '2025-12', count: 3, gross: 240000 },
    { month: '2026-01', count: 4, gross: 310000 },
    { month: '2026-02', count: 4, gross: 340000 },
    { month: '2026-03', count: 3, gross: 280000 },
    { month: '2026-04', count: 5, gross: 390000 },
    { month: '2026-05', count: 5, gross: 420000 },
    { month: '2026-06', count: 4, gross: 360000 },
    { month: '2026-07', count: 3, gross: 290000 },
    { month: '2026-08', count: 6, gross: 480000 },
    { month: '2026-09', count: 5, gross: 430000 },
    { month: '2026-10', count: 7, gross: 560000 },
    { month: '2026-11', count: 6, gross: 510000 }
  ];

  const customers = [
    { name: 'K. Ramesh', initial: 'R' },
    { name: 'P. Sunitha', initial: 'S' },
    { name: 'T. Mohan', initial: 'M' },
    { name: 'G. Lakshmi', initial: 'L' },
    { name: 'V. Anand', initial: 'A' },
    { name: 'N. Deepa', initial: 'D' },
    { name: 'M. Suresh', initial: 'S' },
    { name: 'B. Haritha', initial: 'H' }
  ];

  const events = [
    { type: 'Wedding', color: '#FF5C8A' },
    { type: 'Reception', color: '#A57BFF' },
    { type: 'Birthday', color: '#FFA62B' },
    { type: 'Corporate', color: '#5AA2FF' },
    { type: 'Housewarming', color: '#5FD38D' }
  ];

  let idCounter = 1001;

  monthlyRevenueConfig.forEach(({ month, count, gross }) => {
    const avgAmount = Math.round(gross / count);
    for (let i = 1; i <= count; i++) {
      const day = String(Math.min(28, i * 4 + 2)).padStart(2, '0');
      const date = `${month}-${day}`;
      const cust = customers[(idCounter + i) % customers.length];
      const ev = events[(idCounter + i) % events.length];
      const branch = (i % 2 === 0) ? SEEDED_BRANCHES[0] : SEEDED_BRANCHES[1];
      const amount = Math.round(avgAmount * (0.85 + (i * 0.1)));
      const commission = Math.round(amount * 0.10);
      const payout = amount - commission;

      bookings.push({
        id: `BK-V${idCounter++}`,
        vendorUsername: 'sai_halls',
        branchId: branch.id,
        branchName: branch.name,
        branchType: branch.type,
        customerName: cust.name,
        customerInitial: cust.initial,
        customerPhone: '9876543210', // Private; not displayed in vendor cards
        eventType: ev.type,
        eventColor: ev.color,
        date,
        timeSlot: 'Full day (08:00 - 22:00)',
        guests: 400 + (i * 50),
        options: {
          hallCondition: 'ac',
          servingStyle: 'buffet',
          foodCategory: 'standard'
        },
        amount,
        commission,
        payout,
        paymentStatus: 'Paid',
        payoutStatus: month < '2026-11' ? 'Paid out' : 'Pending',
        status: month < '2026-11' ? 'Completed' : 'Confirmed',
        createdAt: `${month}-01T10:00:00Z`
      });
    }
  });

  // Add 3 upcoming bookings for testing
  bookings.unshift(
    {
      id: 'BK-V2001',
      vendorUsername: 'sai_halls',
      branchId: 'h-kad-1',
      branchName: 'Sai Function Hall - Central',
      branchType: 'hall',
      customerName: 'D L Narasimha',
      customerInitial: 'N',
      customerPhone: '9390075877',
      eventType: 'Wedding',
      eventColor: '#FF5C8A',
      date: '2026-12-18',
      timeSlot: 'Full day',
      guests: 600,
      options: { hallCondition: 'ac', servingStyle: 'buffet', foodCategory: 'standard' },
      amount: 140000,
      commission: 14000,
      payout: 126000,
      paymentStatus: 'Paid',
      payoutStatus: 'Pending',
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    },
    {
      id: 'BK-V2002',
      vendorUsername: 'sai_halls',
      branchId: 'h-kad-sai-bypass',
      branchName: 'Sai Grand Convention & Hall',
      branchType: 'hall',
      customerName: 'Priya K.',
      customerInitial: 'P',
      customerPhone: '9848011223',
      eventType: 'Birthday',
      eventColor: '#FFA62B',
      date: '2026-12-28',
      timeSlot: 'Evening (16:00 - 23:00)',
      guests: 150,
      options: { hallCondition: 'ac', servingStyle: 'buffet' },
      amount: 90000,
      commission: 9000,
      payout: 81000,
      paymentStatus: 'Paid',
      payoutStatus: 'Pending',
      status: 'Confirmed',
      createdAt: new Date().toISOString()
    }
  );

  return bookings;
}

/**
 * Migration: Remove old fake seeded chat threads (chat_sai_halls_1..4) from stored vendor chats,
 * preserving all real user conversations and ensuring no 0-message chat shows as unread.
 */
export function cleanSeededChats() {
  try {
    if (typeof localStorage === 'undefined') return;
    const seededIds = new Set(['chat_sai_halls_1', 'chat_sai_halls_2', 'chat_sai_halls_3', 'chat_sai_halls_4']);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('utsavora_vendor_chats_')) {
        try {
          const raw = storageGet(k);
          if (raw) {
            const threads = JSON.parse(raw);
            if (Array.isArray(threads)) {
              const cleaned = threads.filter(t => !seededIds.has(t.id));
              if (cleaned.length !== threads.length) {
                storageSet(k, JSON.stringify(cleaned));
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[store] cleanSeededChats error:', err);
  }
}

/**
 * Seed the test vendor account on app init
 */
export function seedTestVendor() {
  try {
    cleanSeededChats();

    const raw = storageGet('utsavora_vendors');
    let vendors = raw ? JSON.parse(raw) : [];

    const existingIdx = vendors.findIndex(v => v && v.username === TEST_VENDOR.username);
    if (existingIdx === -1) {
      vendors.push(TEST_VENDOR);
      storageSet('utsavora_vendors', JSON.stringify(vendors));
    } else {
      vendors[existingIdx] = {
        ...TEST_VENDOR,
        ...vendors[existingIdx],
        upiId: vendors[existingIdx].upiId || TEST_VENDOR.upiId
      };
      storageSet('utsavora_vendors', JSON.stringify(vendors));
    }

    // Seed branches for sai_halls if none exist
    const branchKey = `utsavora_branches_${TEST_VENDOR.username}`;
    if (!storageGet(branchKey)) {
      storageSet(branchKey, JSON.stringify(SEEDED_BRANCHES));
    }

    // Seed previous works for sai_halls if none exist
    const worksKey = `utsavora_works_${TEST_VENDOR.username}`;
    if (!storageGet(worksKey)) {
      storageSet(worksKey, JSON.stringify(SEEDED_PREVIOUS_WORKS));
    }

    // Seed bookings for sai_halls if none exist
    const bookingsKey = `utsavora_vendor_bookings_${TEST_VENDOR.username}`;
    if (!storageGet(bookingsKey)) {
      storageSet(bookingsKey, JSON.stringify(generateSeededBookings()));
    }

    // Initialize vendor chats as empty array - zero fake seeded chats!
    const chatsKey = `utsavora_vendor_chats_${TEST_VENDOR.username}`;
    if (!storageGet(chatsKey)) {
      storageSet(chatsKey, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Failed to seed test vendor:', err);
  }
}

/**
 * One-time migration: delete all old Kadapa branches from browser storage
 */
export function migrateKadapaReset() {
  try {
    if (storageGet('utsavora_kadapa_reset') === '1') {
      return;
    }
    // Delete any branch whose city is Kadapa from localStorage
    if (typeof localStorage !== 'undefined') {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        if (k.startsWith('utsavora_branches_')) {
          try {
            const raw = storageGet(k);
            if (raw) {
              const branches = JSON.parse(raw);
              if (Array.isArray(branches)) {
                const kept = branches.filter(b => b && b.city !== 'Kadapa');
                storageSet(k, JSON.stringify(kept));
              }
            }
          } catch {}
        }
      }
    }
    storageSet('utsavora_kadapa_reset', '1');
  } catch (err) {
    console.warn('[store] migrateKadapaReset error:', err);
  }
}

/**
 * Migration: Normalize all mixed-case vendor storage keys to lowercase
 */
export function migrateLowercaseVendorKeys() {
  try {
    const prefixes = ['utsavora_branches_', 'utsavora_works_', 'utsavora_vendor_bookings_', 'utsavora_vendor_chats_'];
    if (typeof localStorage !== 'undefined') {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        for (const pfx of prefixes) {
          if (k.startsWith(pfx)) {
            const username = k.slice(pfx.length);
            const lower = username.toLowerCase();
            if (username !== lower) {
              const mixedVal = storageGet(k);
              const lowerKey = `${pfx}${lower}`;
              const lowerVal = storageGet(lowerKey);
              if (!lowerVal && mixedVal) {
                storageSet(lowerKey, mixedVal);
              }
              storageRemove(k);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[store] migrateLowercaseVendorKeys error:', err);
  }
}

/**
 * Seed all 12 Catalog Vendors (Rajahmundry & Kadapa)
 * Upserts vendor login accounts, branches, and sample revenue entries idempotently.
 */
export async function seedCatalogVendors() {
  try {
    migrateKadapaReset();
    migrateLowercaseVendorKeys();
    migrateChatData();

    const raw = storageGet('utsavora_vendors');
    let vendors = raw ? JSON.parse(raw) : [];

    const allCatalogVendors = [...SEEDED_RAJAHMUNDRY_VENDORS, ...SEEDED_KADAPA_VENDORS];

    for (const cv of allCatalogVendors) {
      const cleanCvUser = cv.username.trim().toLowerCase();
      const pwdHash = cv.passwordHash || (await sha256(cv.password));
      const idx = vendors.findIndex(v => v && v.username.toLowerCase() === cleanCvUser);
      const vendorRecord = {
        ...cv,
        username: cleanCvUser,
        passwordHash: pwdHash
      };
      if (idx === -1) {
        vendors.push(vendorRecord);
      } else {
        vendors[idx] = { ...vendorRecord, ...vendors[idx], passwordHash: pwdHash, password: cv.password };
      }
    }
    storageSet('utsavora_vendors', JSON.stringify(vendors));

    // Seed Kadapa Branches & Bookings
    for (const kv of SEEDED_KADAPA_VENDORS) {
      const u = kv.username.toLowerCase();
      const branchKey = `utsavora_branches_${u}`;
      const existingBranchesRaw = storageGet(branchKey);
      if (!existingBranchesRaw || JSON.parse(existingBranchesRaw).length === 0) {
        storageSet(branchKey, JSON.stringify(SEEDED_KADAPA_BRANCHES_BY_VENDOR[u] || []));
      }

      const bookingsKey = `utsavora_vendor_bookings_${u}`;
      const existingBookingsRaw = storageGet(bookingsKey);
      const seedBookings = SEEDED_KADAPA_BOOKINGS_BY_VENDOR[u] || [];
      if (!existingBookingsRaw || JSON.parse(existingBookingsRaw).length === 0) {
        storageSet(bookingsKey, JSON.stringify(seedBookings));
      } else {
        try {
          const list = JSON.parse(existingBookingsRaw);
          if (Array.isArray(list) && list.length === 3 && seedBookings.length === 4) {
            list.push(seedBookings[3]);
            storageSet(bookingsKey, JSON.stringify(list));
          }
        } catch {}
      }

      const worksKey = `utsavora_works_${u}`;
      if (!storageGet(worksKey)) {
        storageSet(worksKey, JSON.stringify([]));
      }
    }

    // Seed Rajahmundry Branches & Bookings: Ensure district, seed revenue ONLY IF empty
    for (const rv of SEEDED_RAJAHMUNDRY_VENDORS) {
      const u = rv.username.toLowerCase();
      const branchKey = `utsavora_branches_${u}`;
      const existingBranchesRaw = storageGet(branchKey);
      if (!existingBranchesRaw) {
        storageSet(branchKey, JSON.stringify(SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR[u] || SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR[rv.username] || []));
      } else {
        try {
          const brs = JSON.parse(existingBranchesRaw);
          let changed = false;
          brs.forEach(b => {
            if (b && !b.district) {
              b.district = 'East Godavari';
              changed = true;
            }
          });
          if (changed) {
            storageSet(branchKey, JSON.stringify(brs));
          }
        } catch {}
      }

      const bookingsKey = `utsavora_vendor_bookings_${u}`;
      const existingBookingsRaw = storageGet(bookingsKey);
      const seedBookings = SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR[u] || SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR[rv.username] || [];
      if (!existingBookingsRaw || JSON.parse(existingBookingsRaw).length === 0) {
        storageSet(bookingsKey, JSON.stringify(seedBookings));
      } else {
        try {
          const list = JSON.parse(existingBookingsRaw);
          if (Array.isArray(list) && list.length === 3 && seedBookings.length === 4) {
            list.push(seedBookings[3]);
            storageSet(bookingsKey, JSON.stringify(list));
          }
        } catch {}
      }

      const worksKey = `utsavora_works_${u}`;
      if (!storageGet(worksKey)) {
        storageSet(worksKey, JSON.stringify([]));
      }
    }

    // Migrate any legacy inline base64 photos to IndexedDB once
    try {
      if (typeof localStorage !== 'undefined') {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.push(k);
        }
        for (const k of keys) {
          if (k.startsWith('utsavora_branches_')) {
            const rawB = storageGet(k);
            if (rawB) {
              const brs = JSON.parse(rawB);
              const { branches: updatedB, changedBranches } = await migrateInlinePhotosToIndexedDB(brs, []);
              if (changedBranches) storageSet(k, JSON.stringify(updatedB));
            }
          } else if (k.startsWith('utsavora_works_')) {
            const rawW = storageGet(k);
            if (rawW) {
              const wrks = JSON.parse(rawW);
              const { works: updatedW, changedWorks } = await migrateInlinePhotosToIndexedDB([], wrks);
              if (changedWorks) storageSet(k, JSON.stringify(updatedW));
            }
          }
        }
      }
    } catch (migErr) {
      console.warn('[store] photo migration error:', migErr);
    }
  } catch (err) {
    console.warn('[store] seedCatalogVendors failed:', err);
  }
}

/**
 * Authenticate Vendor Login
 */
export async function authenticateVendor(username, password) {
  try {
    seedTestVendor();
    await seedCatalogVendors();
    const raw = storageGet('utsavora_vendors');
    const vendors = raw ? JSON.parse(raw) : [];
    const cleanUser = String(username || '').trim().toLowerCase();
    const vendor = vendors.find(v => v && v.username.toLowerCase() === cleanUser);

    if (!vendor) {
      return { success: false, error: 'Username or password is incorrect.', message: 'Username or password is incorrect.' };
    }

    const hash = await sha256(password);
    if (vendor.passwordHash === hash || vendor.password === password) {
      const enrichedVendor = {
        ...TEST_VENDOR,
        ...vendor,
        businessType: vendor.businessType || vendor.owns || 'both'
      };
      setCurrentVendor(enrichedVendor);
      return { success: true, vendor: enrichedVendor };
    }
    return { success: false, error: 'Username or password is incorrect.', message: 'Username or password is incorrect.' };
  } catch (err) {
    return { success: false, error: 'Vendor authentication failed: ' + err.message };
  }
}

export function getCurrentVendor() {
  try {
    const raw = storageGet('utsavora_current_vendor');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentVendor(vendor) {
  try {
    if (vendor) {
      storageSet('utsavora_current_vendor', JSON.stringify(vendor));
    } else {
      storageRemove('utsavora_current_vendor');
    }
  } catch (err) {
    console.warn('[store] setCurrentVendor failed:', err);
  }
}

export function vendorLogout() {
  setCurrentVendor(null);
}

/**
 * Check if a username is taken by any vendor
 */
export function isUsernameTaken(username, excludeUsername = '') {
  try {
    const raw = storageGet('utsavora_vendors');
    const vendors = raw ? JSON.parse(raw) : [];
    const clean = String(username || '').trim().toLowerCase();
    const exclude = String(excludeUsername || '').trim().toLowerCase();
    return vendors.some(v => v.username.toLowerCase() === clean && v.username.toLowerCase() !== exclude);
  } catch {
    return false;
  }
}

/**
 * Register a new Vendor Account
 */
export async function createVendorAccount(vendorData) {
  try {
    seedTestVendor();
    const raw = storageGet('utsavora_vendors');
    const vendors = raw ? JSON.parse(raw) : [];

    if (isUsernameTaken(vendorData.username)) {
      return { success: false, error: 'This username is already taken. Please choose another.' };
    }

    const hash = await sha256(vendorData.password);
    const newVendor = {
      username: vendorData.username.trim(),
      passwordHash: hash,
      name: vendorData.name.trim(),
      owns: vendorData.owns || 'hall',
      businessNameHall: vendorData.businessNameHall || '',
      businessNameCatering: vendorData.businessNameCatering || '',
      phone: vendorData.phone.replace(/\D/g, ''),
      upiId: (vendorData.upiId || '').trim(),
      tradeLicenceNumber: vendorData.tradeLicenceNumber || '',
      fssaiNumber: vendorData.fssaiNumber || '',
      tradeLicenceStatus: vendorData.tradeLicenceStatus || 'Verified',
      fssaiStatus: vendorData.fssaiStatus || 'Verified',
      memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      warningsCount: 0,
      flaggedForReview: false,
      photo: null
    };

    vendors.push(newVendor);
    storageSet('utsavora_vendors', JSON.stringify(vendors));

    // A brand-new vendor starts with ZERO branches, bookings, and works
    storageSet(`utsavora_branches_${newVendor.username}`, JSON.stringify([]));
    storageSet(`utsavora_works_${newVendor.username}`, JSON.stringify([]));
    storageSet(`utsavora_vendor_bookings_${newVendor.username}`, JSON.stringify([]));

    setCurrentVendor(newVendor);
    return { success: true, vendor: newVendor };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Update Vendor Profile
 */
export async function updateVendorProfile(username, updates) {
  try {
    const raw = storageGet('utsavora_vendors');
    let vendors = raw ? JSON.parse(raw) : [];
    const idx = vendors.findIndex(v => v.username.toLowerCase() === username.toLowerCase());

    if (idx === -1) {
      return { success: false, error: 'Vendor account not found.' };
    }

    // Check username uniqueness if changed
    if (updates.username && updates.username.toLowerCase() !== username.toLowerCase()) {
      if (isUsernameTaken(updates.username, username)) {
        return { success: false, error: 'Username is already taken.' };
      }
    }

    const updated = {
      ...vendors[idx],
      ...updates
    };

    vendors[idx] = updated;
    storageSet('utsavora_vendors', JSON.stringify(vendors));

    // Migrate branch/booking keys if username changed
    if (updates.username && updates.username !== username) {
      ['branches', 'works', 'vendor_bookings', 'vendor_chats'].forEach(prefix => {
        const oldKey = `utsavora_${prefix}_${username}`;
        const newKey = `utsavora_${prefix}_${updates.username}`;
        const data = storageGet(oldKey);
        if (data) {
          storageSet(newKey, data);
          storageRemove(oldKey);
        }
      });
    }

    setCurrentVendor(updated);
    return { success: true, vendor: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Change Vendor Password
 */
export async function changeVendorPassword(username, currentPassword, newPassword) {
  try {
    const raw = storageGet('utsavora_vendors');
    let vendors = raw ? JSON.parse(raw) : [];
    const idx = vendors.findIndex(v => v.username.toLowerCase() === username.toLowerCase());

    if (idx === -1) return { success: false, error: 'Vendor not found.' };

    const currentHash = await sha256(currentPassword);
    if (vendors[idx].passwordHash !== currentHash && vendors[idx].password !== currentPassword) {
      return { success: false, error: 'Current password does not match.' };
    }

    const newHash = await sha256(newPassword);
    vendors[idx].passwordHash = newHash;
    storageSet('utsavora_vendors', JSON.stringify(vendors));

    const cur = getCurrentVendor();
    if (cur && cur.username.toLowerCase() === username.toLowerCase()) {
      setCurrentVendor({ ...cur, passwordHash: newHash });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Vendor Branches
 */
export function getVendorBranches(username) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const key = `utsavora_branches_${cleanUser}`;
    const raw = storageGet(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveVendorBranch(username, branchData) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const branches = getVendorBranches(cleanUser);
    const id = branchData.id || `br_${cleanUser}_${Date.now()}`;

    // Strip base64 URLs from photos so they are saved to IndexedDB, keeping localStorage small
    let photos = branchData.photos || [];
    if (Array.isArray(photos)) {
      photos = await stripPhotoUrlsForStorage(photos);
    }

    let coverPhoto = branchData.coverPhoto;
    if (coverPhoto && (coverPhoto.startsWith('data:image/') || coverPhoto.startsWith('blob:'))) {
      coverPhoto = photos.find(p => p.isCover)?.id || photos[0]?.id || '';
    }

    const newBranch = {
      ...branchData,
      id,
      photos,
      coverPhoto,
      vendorUsername: cleanUser,
      updatedAt: new Date().toISOString()
    };

    const existingIdx = branches.findIndex(b => b.id === id);
    if (existingIdx >= 0) {
      branches[existingIdx] = newBranch;
    } else {
      branches.push(newBranch);
    }

    const ok = storageSet(`utsavora_branches_${cleanUser}`, JSON.stringify(branches));
    if (!ok) {
      throw new Error('Storage write failed (quota exceeded). Photos are safely stored in IndexedDB.');
    }
    dispatchCatalogChanged();
    return newBranch;
  } catch (err) {
    console.warn('[store] saveVendorBranch failed:', err);
    throw err;
  }
}

export function deleteVendorBranch(username, branchId) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const branches = getVendorBranches(cleanUser).filter(b => b.id !== branchId);
    storageSet(`utsavora_branches_${cleanUser}`, JSON.stringify(branches));
    dispatchCatalogChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * Previous Works for Branch
 */
export function getVendorPreviousWorks(username) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const key = `utsavora_works_${cleanUser}`;
    const raw = storageGet(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveVendorPreviousWork(username, workData) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const works = getVendorPreviousWorks(cleanUser);
    const id = workData.id || `pw_${Date.now()}`;

    let photos = workData.photos || [];
    if (Array.isArray(photos)) {
      photos = await stripPhotoUrlsForStorage(photos);
    }

    let coverPhoto = workData.coverPhoto;
    if (coverPhoto && (coverPhoto.startsWith('data:image/') || coverPhoto.startsWith('blob:'))) {
      coverPhoto = photos.find(p => p.isCover)?.id || photos[0]?.id || '';
    }

    const newWork = {
      ...workData,
      id,
      photos,
      coverPhoto,
      vendorUsername: cleanUser
    };

    const existingIdx = works.findIndex(w => w.id === id);
    if (existingIdx >= 0) {
      works[existingIdx] = newWork;
    } else {
      works.push(newWork);
    }
    const ok = storageSet(`utsavora_works_${cleanUser}`, JSON.stringify(works));
    if (!ok) {
      throw new Error('Storage write failed (quota exceeded).');
    }
    dispatchCatalogChanged();
    return newWork;
  } catch (err) {
    console.warn('[store] saveVendorPreviousWork failed:', err);
    throw err;
  }
}

export function deleteVendorPreviousWork(username, workId) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const works = getVendorPreviousWorks(cleanUser).filter(w => w.id !== workId);
    storageSet(`utsavora_works_${cleanUser}`, JSON.stringify(works));
    dispatchCatalogChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * Vendor Bookings
 */
export function getVendorBookings(username) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const key = `utsavora_vendor_bookings_${cleanUser}`;
    const raw = storageGet(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Cancel a booking from the vendor side
 * Synchronizes with user-side booking list and posts chat cancellation note
 */
export function cancelVendorBooking(username, bookingId, reason, note = '') {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const vendorBookings = getVendorBookings(cleanUser);
    let targetBooking = null;

    const updatedVendorBookings = vendorBookings.map(b => {
      if (b.id === bookingId) {
        targetBooking = b;
        return {
          ...b,
          status: 'Cancelled',
          cancellationReason: reason,
          cancellationNote: note,
          refundStatus: 'Refund initiated',
          cancelledBy: 'vendor',
          cancelledAt: new Date().toISOString()
        };
      }
      return b;
    });

    storageSet(`utsavora_vendor_bookings_${cleanUser}`, JSON.stringify(updatedVendorBookings));

    // Also synchronize user booking list if customer phone is recorded
    if (targetBooking?.customerPhone) {
      const userBookingsKey = `utsavora_bookings_${targetBooking.customerPhone}`;
      const userBookings = getUserBookings(targetBooking.customerPhone);
      const updatedUserBookings = userBookings.map(ub => {
        if (ub.id === bookingId) {
          return {
            ...ub,
            status: 'Cancelled',
            cancellationReason: reason,
            cancellationNote: note,
            refundStatus: 'Refund initiated',
            cancelledBy: 'vendor',
            cancelledAt: new Date().toISOString()
          };
        }
        return ub;
      });
      storageSet(userBookingsKey, JSON.stringify(updatedUserBookings));
    }

    // Post notification to vendor chat
    const chats = getVendorChatThreads(cleanUser);
    const thread = chats.find(c => c.vendorId === targetBooking?.branchId || c.customerName === targetBooking?.customerName);
    if (thread) {
      addVendorChatMessage(cleanUser, thread.id, {
        sender: 'system',
        text: `⚠️ Booking ${bookingId} was cancelled by vendor. Reason: ${reason}. A full refund has been initiated to the customer.`,
        system: true
      });
    }

    return {
      success: true,
      booking: targetBooking ? {
        ...targetBooking,
        status: 'Cancelled',
        cancellationReason: reason,
        cancellationNote: note,
        refundStatus: 'Refund initiated'
      } : null
    };
  } catch (err) {
    console.warn('[store] cancelVendorBooking failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark booking as completed
 */
export function markBookingCompleted(username, bookingId) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const vendorBookings = getVendorBookings(cleanUser);
    const updated = vendorBookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'Completed',
          payoutStatus: 'Paid out',
          completedAt: new Date().toISOString()
        };
      }
      return b;
    });
    storageSet(`utsavora_vendor_bookings_${cleanUser}`, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Confirm vendor booking (e.g. for UPI payment pending confirmation)
 */
export function confirmVendorBooking(username, bookingId) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const vendorBookings = getVendorBookings(cleanUser);
    let targetBooking = null;
    const updated = vendorBookings.map(b => {
      if (b.id === bookingId) {
        targetBooking = b;
        return {
          ...b,
          status: 'Confirmed',
          paymentStatus: 'Paid',
          confirmedAt: new Date().toISOString()
        };
      }
      return b;
    });
    storageSet(`utsavora_vendor_bookings_${cleanUser}`, JSON.stringify(updated));

    if (targetBooking?.customerPhone) {
      const userBookingsKey = `utsavora_bookings_${targetBooking.customerPhone}`;
      const userBookings = getUserBookings(targetBooking.customerPhone);
      const updatedUserBookings = userBookings.map(ub => {
        if (ub.id === bookingId) {
          return {
            ...ub,
            status: 'Confirmed',
            paymentStatus: 'Paid',
            confirmedAt: new Date().toISOString()
          };
        }
        return ub;
      });
      storageSet(userBookingsKey, JSON.stringify(updatedUserBookings));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Vendor Chat Threads
 */
export function getVendorChatThreads(username) {
  return getVendorChatThreadsCompat(username);
}

export function addVendorChatMessage(username, threadId, message) {
  return addVendorChatMessageCompat(username, threadId, message);
}

/**
 * Vendor Contact Violation Warning Counter
 */
export function addVendorWarning(username, reason) {
  try {
    const cleanUser = String(username || '').trim().toLowerCase();
    const raw = storageGet('utsavora_vendors');
    let vendors = raw ? JSON.parse(raw) : [];
    const idx = vendors.findIndex(v => v.username.toLowerCase() === cleanUser);
    if (idx === -1) return 1;

    const currentCount = (vendors[idx].warningsCount || 0) + 1;
    const isFlagged = currentCount >= 3;

    vendors[idx].warningsCount = currentCount;
    vendors[idx].flaggedForReview = isFlagged;
    storageSet('utsavora_vendors', JSON.stringify(vendors));

    const cur = getCurrentVendor();
    if (cur && cur.username.toLowerCase() === cleanUser) {
      setCurrentVendor({ ...cur, warningsCount: currentCount, flaggedForReview: isFlagged });
    }

    return currentCount;
  } catch {
    return 1;
  }
}

/**
 * Unified Catalog Resolver (Combines dummy vendors + active verified vendor branches)
 * Enables newly added or edited vendor branches in Kadapa/other cities to appear instantly
 * in the user-side catalog and search!
 */
export function getUnifiedVendorsCatalog(baseDummyVendors) {
  try {
    const raw = storageGet('utsavora_vendors');
    const vendors = raw ? JSON.parse(raw) : [];
    const result = {
      halls: [...(baseDummyVendors?.halls || [])],
      caterers: [...(baseDummyVendors?.caterers || [])],
      decor: [...(baseDummyVendors?.decor || [])],
      bands: [...(baseDummyVendors?.bands || [])],
      cards: [...(baseDummyVendors?.cards || [])],
      photography: [...(baseDummyVendors?.photography || [])]
    };

    vendors.forEach(v => {
      const cleanUser = v.username ? v.username.toLowerCase() : '';
      const branches = getVendorBranches(cleanUser);
      const works = getVendorPreviousWorks(cleanUser);
      branches.forEach(b => {
        if (b.status === 'Verified') {
          const branchWorks = works.filter(w => !w.branchId || w.branchId === b.id);
          const district = b.district || (b.city === 'Kadapa' ? 'YSR Kadapa' : (b.city === 'Rajahmundry' ? 'East Godavari' : ''));
          if (b.type === 'hall') {
            const existingIdx = result.halls.findIndex(h => h.id === b.id);
            const formatted = {
              id: b.id,
              branchId: b.id,
              branchType: 'hall',
              name: b.name,
              vendorUsername: cleanUser,
              type: 'hall',
              city: b.city,
              state: b.state || 'Andhra Pradesh',
              district,
              address: b.street || b.address,
              capacity: b.capacity || 500,
              floatingCapacity: b.floatingCapacity || null,
              diningCapacity: b.diningCapacity || null,
              isAC: Boolean(b.isAC),
              price: b.price || b.acPrice || 150000,
              priceMax: b.priceMax || null,
              basePrice: b.basePrice || b.price || 150000,
              acPrice: b.acPrice || b.price || 150000,
              halfDayPrice: (b.halfDayPrice !== undefined && b.halfDayPrice !== null) ? b.halfDayPrice : null,
              parking: b.parking || b.parkingSpaces || '',
              rooms: b.rooms || 4,
              rating: b.rating || b.ratingAvg || 4.5,
              ratingAvg: b.ratingAvg || b.rating || 4.5,
              ratingCount: b.ratingCount || 0,
              reviewsCount: b.reviewsCount || 0,
              photos: b.photos || [],
              works: branchWorks,
              pastWorks: branchWorks,
              bookedDates: b.bookedDates || [],
              amenities: b.amenities || [],
              description: b.description || ''
            };
            if (existingIdx >= 0) {
              result.halls[existingIdx] = { ...result.halls[existingIdx], ...formatted };
            } else {
              result.halls.unshift(formatted);
            }
          } else if (b.type === 'caterer') {
            const existingIdx = result.caterers.findIndex(c => c.id === b.id);
            const hasRates = Boolean(b.plateRates && Object.keys(b.plateRates).length > 0);
            const price = b.price != null ? b.price : (hasRates ? (b.plateRates.basic?.veg || b.plateRates.basic?.price || 200) : null);
            const formatted = {
              id: b.id,
              branchId: b.id,
              branchType: 'caterer',
              name: b.name,
              vendorUsername: cleanUser,
              type: 'caterer',
              city: b.city,
              state: b.state || 'Andhra Pradesh',
              district,
              address: b.street || b.address,
              cuisines: b.cuisines || ['andhra'],
              servingStyles: b.servingStyles || ['buffet'],
              foodType: b.foodType || (b.foodTypes?.length === 1 && b.foodTypes[0] === 'veg' ? 'veg' : 'both'),
              foodTypes: b.foodTypes || (b.foodType === 'veg' ? ['veg'] : ['veg', 'nonveg', 'both']),
              minPlates: b.minPlates || 50,
              price: price,
              effectivePrice: price,
              priceDisplay: price ? `₹${price} / plate (starts from)` : 'Rates on request',
              plateRates: b.plateRates,
              rating: b.rating || b.ratingAvg || 4.8,
              ratingAvg: b.ratingAvg || b.rating || 4.8,
              ratingCount: b.ratingCount || 0,
              reviewsCount: b.reviewsCount || 0,
              photos: b.photos || [],
              works: branchWorks,
              pastWorks: branchWorks,
              description: b.description || '',
              amenities: b.amenities || []
            };
            if (existingIdx >= 0) {
              result.caterers[existingIdx] = { ...result.caterers[existingIdx], ...formatted };
            } else {
              result.caterers.unshift(formatted);
            }
          }
        }
      });
    });

    return result;
  } catch (err) {
    console.warn('[store] getUnifiedVendorsCatalog failed:', err);
    return baseDummyVendors;
  }
}

export {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  listForVendor,
  listForCustomer,
  markRead,
  unreadCountForVendor,
  unreadCountForCustomer,
  subscribeChat,
  migrateChatData
};

