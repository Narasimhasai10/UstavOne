/**
 * Unified Data Service Layer for Utsavora
 * 
 * Provides a single data access interface across the entire application with two implementations:
 * 1. "live": Communicates with Express backend API & SQLite database via src/api/client.js
 * 2. "mock": Offline fallback using local store and in-memory engine (works on file:// and offline)
 * 
 * Mode is determined at startup via GET /api/v1/public/health (2s timeout).
 */

import api from '../api/client.js';
import * as store from '../services/store.js';
import * as offlinePlanner from '../../features/dashboard-plan/engine/planner.js';
import { resolvePhotoUrls, compressImage, savePhoto, getPhoto, dataUrlToFile, showUtsavoraToast } from '../utils/photos.js';
import { CHAT_TRANSPORT } from '../../features/dashboard-plan/engine/config.js';
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
  migrateChatData
} from '../../features/booking-chat/chatStore.js';

// Safe Session Storage Wrapper (works reliably on file://, iframe, and Node test runners)
export const safeStorage = {
  getItem: (key) => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key, val) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    } catch { }
  },
  removeItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch { }
  }
};

let currentMode = 'mock'; // 'live' | 'mock'
let isInitialized = false;
const modeListeners = new Set();

export function getMode() {
  return currentMode;
}

export function isLive() {
  return currentMode === 'live';
}

export function setMode(mode) {
  currentMode = mode === 'live' ? 'live' : 'mock';
  modeListeners.forEach((cb) => {
    try { cb(currentMode); } catch { }
  });
}

export function subscribeMode(cb) {
  modeListeners.add(cb);
  cb(currentMode);
  return () => modeListeners.delete(cb);
}

// Startup Health Check (2-second timeout)
export async function detectMode() {
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000/api/v1';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/public/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      setMode('live');
    } else {
      setMode('mock');
    }
  } catch {
    setMode('mock');
  }
  isInitialized = true;
  return currentMode;
}

// Auto-run detection in browser environment
if (typeof window !== 'undefined') {
  detectMode();
}

// ==========================================
// 1. AUTH DOMAIN
// ==========================================
const authDomain = {
  // Test accounts constants
  TEST_USER: store.TEST_USER,
  TEST_VENDOR: store.TEST_VENDOR,
  TEST_ACCOUNT: store.TEST_ACCOUNT,

  seedTestAccount: async () => Promise.resolve(store.seedTestAccount()),
  seedTestVendor: async () => Promise.resolve(store.seedTestVendor()),
  seedCatalogVendors: async () => Promise.resolve(store.seedCatalogVendors()),

  userLogin: async (phone, password) => {
    try {
      const data = await api.auth.userLogin(phone, password);
      if (data?.accessToken) {
        setMode('live');
        safeStorage.setItem('utsavora_access_token', data.accessToken);
        if (data.refreshToken) safeStorage.setItem('utsavora_refresh_token', data.refreshToken);
        const userObj = data.user || {
          name: data.name || 'Utsavora User',
          phone,
          role: 'user',
          city: data.city || 'Kadapa'
        };
        sessionDomain.setCurrentUser(userObj);
        return { success: true, user: userObj };
      }
    } catch {
      // Backend not running or offline fallback
    }
    return store.authenticateUser(phone, password);
  },

  vendorLogin: async (identifier, password) => {
    try {
      const data = await api.auth.vendorLogin(identifier, password);
      if (data?.accessToken) {
        setMode('live');
        safeStorage.setItem('utsavora_access_token', data.accessToken);
        if (data.refreshToken) safeStorage.setItem('utsavora_refresh_token', data.refreshToken);
        const vendorObj = data.vendor || data.user || {
          username: identifier,
          name: data.name || identifier,
          role: 'vendor'
        };
        sessionDomain.setCurrentVendor(vendorObj);
        return { success: true, vendor: vendorObj };
      }
    } catch {
      // Backend offline -> fallback to store
    }
    return store.authenticateVendor(identifier, password);
  },

  userSignup: async (userData) => {
    if (isLive()) {
      try {
        const data = await api.auth.userSignup(userData);
        if (data?.accessToken) {
          safeStorage.setItem('utsavora_access_token', data.accessToken);
          if (data.refreshToken) safeStorage.setItem('utsavora_refresh_token', data.refreshToken);
        }
        sessionDomain.setCurrentUser(data.user || userData);
        return { success: true, user: data.user || userData };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    // Mock user creation
    return { success: true, user: userData };
  },

  vendorSignup: async (vendorData) => {
    if (isLive()) {
      try {
        const data = await api.auth.vendorSignup(vendorData);
        if (data?.accessToken) {
          safeStorage.setItem('utsavora_access_token', data.accessToken);
          if (data.refreshToken) safeStorage.setItem('utsavora_refresh_token', data.refreshToken);
        }
        sessionDomain.setCurrentVendor(data.vendor || data.user || vendorData);
        return { success: true, vendor: data.vendor || vendorData };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return store.createVendorAccount(vendorData);
  },

  logout: async () => {
    sessionDomain.clear();
    safeStorage.removeItem('utsavora_access_token');
    safeStorage.removeItem('utsavora_refresh_token');
    safeStorage.removeItem('vedika_access_token');
    safeStorage.removeItem('vedika_refresh_token');
    return Promise.resolve(true);
  },

  isPhoneTaken: async (phone, excludePhone) => Promise.resolve(store.isPhoneTaken(phone, excludePhone)),
  isUsernameTaken: async (username) => Promise.resolve(store.isUsernameTaken(username)),

  updateUserProfile: async (phone, profile) => Promise.resolve(store.updateUserProfile(phone, profile)),
  changeUserPassword: async (phone, oldPass, newPass) => Promise.resolve(store.changeUserPassword(phone, oldPass, newPass)),
  changeVendorPassword: async (username, oldPass, newPass) => Promise.resolve(store.changeVendorPassword(username, oldPass, newPass))
};

// ==========================================
// 2. SESSION DOMAIN
// ==========================================
const sessionDomain = {
  getCurrentUser: () => {
    const raw = safeStorage.getItem('utsavora_current_user') || safeStorage.getItem('vedika_current_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  setCurrentUser: (u) => {
    if (u) { safeStorage.setItem('utsavora_current_user', JSON.stringify(u)); }
    else { safeStorage.removeItem('utsavora_current_user'); safeStorage.removeItem('vedika_current_user'); }
  },
  getCurrentVendor: () => {
    const raw = safeStorage.getItem('utsavora_current_vendor') || safeStorage.getItem('vedika_current_vendor');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  setCurrentVendor: (v) => {
    if (v) { safeStorage.setItem('utsavora_current_vendor', JSON.stringify(v)); }
    else { safeStorage.removeItem('utsavora_current_vendor'); safeStorage.removeItem('vedika_current_vendor'); }
  },
  clear: () => {
    safeStorage.removeItem('utsavora_current_user');
    safeStorage.removeItem('utsavora_current_vendor');
    safeStorage.removeItem('vedika_current_user');
    safeStorage.removeItem('vedika_current_vendor');
  }
};

// ==========================================
// 3. LOCATION & EVENT DOMAIN
// ==========================================
const locationDomain = {
  getSelectedEvent: () => store.getSelectedEvent(),
  setSelectedEvent: (evt) => store.setSelectedEvent(evt),
  getLocations: async () => {
    if (isLive()) {
      try {
        const res = await api.request ? api.request('/public/locations') : null;
        if (res?.items) return res.items;
      } catch { }
    }
    return [];
  }
};

// ==========================================
// 4. PLANNER DOMAIN
// ==========================================
const plannerDomain = {
  calculatePlan: async (input) => {
    if (isLive()) {
      try {
        const res = await api.planner.calculate(input);
        return res;
      } catch (err) {
        console.warn('[DataService] Server planner failed, falling back to client engine:', err.message);
      }
    }
    const vendors = store.getUnifiedVendorsCatalog([]);
    return offlinePlanner.planEvent(input, { halls: vendors.filter(v => v.type === 'hall'), caterers: vendors.filter(v => v.type === 'caterer'), decor: [] });
  },

  saveUserPlan: async (plan) => Promise.resolve(store.saveUserPlan(plan)),
  getSavedPlan: async () => Promise.resolve(store.getSavedPlan())
};

// ==========================================
// 5. VENDORS DOMAIN
// ==========================================
const vendorsDomain = {
  getUnifiedVendorsCatalog: async (vendorBranches = []) => {
    // Single source of truth for vendor-managed content is the browser store in BOTH mock and live mode.
    // Local branches always win, and local photos, works, prices, ratings, and district are never overwritten.
    const base = store.getUnifiedVendorsCatalog(vendorBranches);

    if (isLive()) {
      try {
        const liveRes = await api.vendors.browse({ limit: 100 });
        const liveBranches = liveRes?.items || [];
        for (const lb of liveBranches) {
          const targetList = lb.kind === 'catering' ? base.caterers : base.halls;
          const match = targetList.find(item =>
            item.id === lb.id ||
            item.name?.toLowerCase() === lb.name?.toLowerCase() ||
            (item.id === 'h-kad-1' && lb.id === 'branch-sai-hall-1') ||
            (item.id === 'h-kad-sai-bypass' && lb.id === 'branch-sai-hall-2') ||
            (item.id === 'c-kad-annapurna' && lb.id === 'branch-annapurna-cat-1')
          );
          if (match) {
            if (Array.isArray(lb.photos) && lb.photos.length > 0) {
              match.photos = lb.photos;
            }
            if (lb.coverPhotoUrl) {
              match.coverPhotoUrl = lb.coverPhotoUrl;
              match.coverPhoto = lb.coverPhotoUrl;
            }
            if (Array.isArray(lb.works) && lb.works.length > 0) {
              match.works = lb.works;
              match.pastWorks = lb.works;
            }
          } else {
            targetList.unshift({
              id: lb.id,
              branchId: lb.id,
              name: lb.name,
              type: lb.kind === 'catering' ? 'caterer' : 'hall',
              city: lb.city,
              state: lb.state,
              price: lb.hallDetails?.priceFullDayNonAc || 80000,
              photos: lb.photos || [],
              coverPhotoUrl: lb.coverPhotoUrl,
              coverPhoto: lb.coverPhotoUrl,
              rating: lb.ratingAvg || 4.5,
              ratingAvg: lb.ratingAvg || 4.5,
              reviewsCount: lb.ratingCount || 0,
              capacity: lb.hallDetails?.capacity || 500,
              amenities: lb.amenities || []
            });
          }
        }
      } catch (err) {
        console.warn('[DataService] Failed to fetch live branches for catalog:', err.message);
      }
    }

    // Resolve photos asynchronously from IndexedDB for halls and caterers
    if (base) {
      if (Array.isArray(base.halls)) {
        for (const h of base.halls) {
          if (Array.isArray(h.photos)) {
            h.photos = await resolvePhotoUrls(h.photos);
          }
          if (Array.isArray(h.works)) {
            for (const w of h.works) {
              if (Array.isArray(w.photos)) {
                w.photos = await resolvePhotoUrls(w.photos);
              }
            }
          }
        }
      }
      if (Array.isArray(base.caterers)) {
        for (const c of base.caterers) {
          if (Array.isArray(c.photos)) {
            c.photos = await resolvePhotoUrls(c.photos);
          }
          if (Array.isArray(c.works)) {
            for (const w of c.works) {
              if (Array.isArray(w.photos)) {
                w.photos = await resolvePhotoUrls(w.photos);
              }
            }
          }
        }
      }
    }

    return base;
  },

  getVendorById: async (id) => {
    // Check local store first (vendor-managed content takes precedence)
    const all = store.getUnifiedVendorsCatalog([]);
    const found = all.find(v => String(v.id) === String(id));
    if (found) {
      if (isLive()) {
        try {
          const live = await api.vendors.get(id);
          if (live) {
            if (Array.isArray(live.photos) && live.photos.length > 0) found.photos = live.photos;
            if (live.coverPhotoUrl) {
              found.coverPhotoUrl = live.coverPhotoUrl;
              found.coverPhoto = live.coverPhotoUrl;
            }
            if (Array.isArray(live.works) && live.works.length > 0) {
              found.works = live.works;
              found.pastWorks = live.works;
            }
          }
        } catch {}
      }
      if (Array.isArray(found.photos)) {
        found.photos = await resolvePhotoUrls(found.photos);
      }
      if (Array.isArray(found.works)) {
        for (const w of found.works) {
          if (Array.isArray(w.photos)) {
            w.photos = await resolvePhotoUrls(w.photos);
          }
        }
      }
      return found;
    }
    if (isLive()) {
      try {
        const live = await api.vendors.get(id);
        if (live) {
          const resolvedPhotos = await resolvePhotoUrls(live.photos || []);
          return {
            ...live,
            type: live.kind === 'catering' ? 'caterer' : 'hall',
            photos: resolvedPhotos,
            coverPhotoUrl: live.coverPhotoUrl || resolvedPhotos.find(p => p.isCover)?.url || resolvedPhotos[0]?.url,
            works: live.works || []
          };
        }
      } catch { }
    }
    return null;
  },

  getAvailability: async (id, month) => {
    if (isLive()) {
      try {
        return await api.vendors.availability(id, month);
      } catch { }
    }
    return [];
  },

  getReviews: async (id) => {
    if (isLive()) {
      try {
        return await api.vendors.reviews(id);
      } catch { }
    }
    return [];
  }
};

// ==========================================
// 6. BOOKINGS DOMAIN
// ==========================================
const bookingsDomain = {
  getUserBookings: async (phone) => {
    const token = safeStorage.getItem('utsavora_access_token');
    if (isLive() && token) {
      try {
        const res = await api.bookings.list();
        const items = Array.isArray(res) ? res : res?.items || [];
        return items.map(b => ({
          id: b.id,
          code: b.code,
          vendorId: b.branch?.id || b.branchId || b.id,
          vendorName: b.branch?.name || b.vendor?.name || 'Utsavora Vendor',
          vendorType: b.kind || b.branch?.kind || 'hall',
          eventName: b.eventType ? b.eventType.charAt(0).toUpperCase() + b.eventType.slice(1) : 'Wedding',
          eventType: b.eventType || 'wedding',
          date: b.startDate,
          timeSlot: b.slot === 'morning' ? 'Morning' : b.slot === 'evening' ? 'Evening' : 'Full day',
          guests: b.guests || 500,
          amount: b.total,
          totalAmount: b.total,
          status: b.status === 'confirmed' ? 'Confirmed' : b.status === 'completed' ? 'Completed' : b.status?.includes('cancelled') ? 'Cancelled' : b.status === 'pending_payment' ? 'Awaiting payment' : 'Pending',
          paymentStatus: b.paymentStatus === 'paid' ? 'Paid' : b.paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid',
          method: 'UPI',
          priceBreakdown: b.priceBreakdown ? (typeof b.priceBreakdown === 'string' ? JSON.parse(b.priceBreakdown) : b.priceBreakdown) : null
        }));
      } catch (err) {
        console.warn('[DataService] Failed to fetch live bookings:', err.message);
      }
    }
    return Promise.resolve(store.getUserBookings(phone) || []);
  },

  saveUserBooking: async (phone, bookingData) => {
    if (isLive()) {
      try {
        const payload = {
          branchId: bookingData.vendorId || bookingData.branchId,
          startDate: bookingData.date,
          endDate: bookingData.endDate || bookingData.date,
          slot: bookingData.timeSlot === 'Morning' ? 'morning' : bookingData.timeSlot === 'Evening' ? 'evening' : 'full_day',
          guests: bookingData.guests || 500,
          eventType: bookingData.eventType || 'wedding'
        };
        const created = await api.bookings.create(payload);
        return created;
      } catch (err) {
        console.warn('[DataService] Server booking creation failed:', err.message);
        throw err;
      }
    }
    return Promise.resolve(store.saveUserBooking(phone, bookingData));
  },

  cancelUserBooking: async (phone, bookingId, reason) => {
    if (isLive()) {
      try {
        return await api.bookings.cancel(bookingId, reason || 'User requested cancellation');
      } catch (err) {
        console.warn('[DataService] Server booking cancel failed:', err.message);
        throw err;
      }
    }
    return Promise.resolve(store.cancelUserBooking(phone, bookingId));
  }
};

// ==========================================
// 7. PAYMENTS DOMAIN
// ==========================================
const paymentsDomain = {
  createOrder: async (bookingId) => {
    if (isLive()) {
      return api.payments.createOrder(bookingId);
    }
    return { orderId: 'mock_order_' + Date.now(), amount: 100000 };
  },

  confirmPayment: async (data) => {
    if (isLive()) {
      return api.payments.confirm(data);
    }
    return { success: true, paymentId: 'mock_pay_' + Date.now() };
  }
};

// ==========================================
// 8. CHAT & CALLS DOMAIN
// ==========================================
const chatDomain = {
  getChatMessages: async (convoId) => {
    if (CHAT_TRANSPORT !== 'local' && isLive()) {
      try {
        const res = await api.chat.messages(convoId);
        const msgs = Array.isArray(res) ? res : res?.data || res?.items || [];
        return msgs.map(m => ({
          id: m.id,
          clientId: m.clientId || null,
          sender: m.senderRole,
          text: m.body,
          type: m.type,
          status: m.status,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: m.createdAt
        }));
      } catch (err) {
        console.warn('[DataService] Live chat messages failed:', err.message);
      }
    }
    return Promise.resolve(store.getChatMessages(convoId));
  },

  addChatMessage: async (convoId, message) => {
    if (CHAT_TRANSPORT !== 'local' && isLive()) {
      // Hits ContactGuard middleware directly on server
      const text = typeof message === 'string' ? message : message.text;
      const clientId = message?.clientId;
      return api.chat.sendMessage(convoId, text, clientId);
    }
    return Promise.resolve(store.addChatMessage(convoId, message));
  },

  addVoiceCallLog: async (convoId, durationStr) => Promise.resolve(store.addVoiceCallLog(convoId, durationStr)),
  getActiveChatVendorIds: async () => Promise.resolve(store.getActiveChatVendorIds()),

  getVendorChatThreads: async (username) => {
    if (CHAT_TRANSPORT !== 'local' && isLive()) {
      try {
        const res = await api.chat.conversations();
        const items = res?.data || (Array.isArray(res) ? res : []);
        return items.map(c => ({
          id: c.id,
          vendorUsername: username,
          branchId: c.branchId,
          branchName: c.branchName,
          customerId: c.customerId,
          customerName: c.customerName,
          customerInitial: (c.customerName || 'C')[0]?.toUpperCase() || '👤',
          unreadCount: c.unreadCount || 0,
          unread: (c.unreadCount || 0) > 0,
          lastMessage: c.lastMessage?.body || '',
          lastMessageAt: c.lastMessageAt || c.lastMessage?.createdAt,
          timestamp: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
          messages: []
        }));
      } catch (err) {
        console.warn('[DataService] Live vendor chat threads failed:', err.message);
      }
    }
    return Promise.resolve(store.getVendorChatThreads(username));
  },

  addVendorChatMessage: async (arg1, arg2, arg3) => {
    const isThreeArgs = arg3 !== undefined;
    const convoId = isThreeArgs ? arg2 : arg1;
    const message = isThreeArgs ? arg3 : arg2;
    const username = isThreeArgs ? arg1 : null;

    if (CHAT_TRANSPORT !== 'local' && isLive()) {
      const text = typeof message === 'string' ? message : message.text;
      const clientId = message?.clientId;
      return api.chat.sendMessage(convoId, text, clientId);
    }
    if (isThreeArgs) {
      return Promise.resolve(store.addVendorChatMessage(username, convoId, message));
    }
    return Promise.resolve(store.addVendorChatMessage(username || 'sai_halls', convoId, message));
  }
};

const callsDomain = {
  initiate: async (convoId) => (isLive() ? api.calls.initiate(convoId) : Promise.resolve({ status: 'ringing' })),
  answer: async (callId) => (isLive() ? api.calls.answer(callId) : Promise.resolve({ status: 'connected' })),
  end: async (callId) => (isLive() ? api.calls.end(callId) : Promise.resolve({ status: 'ended' }))
};

// ==========================================
// 9. VENDOR PORTAL DOMAIN
// ==========================================
const vendorBranchesDomain = {
  getVendorBranches: async (username) => Promise.resolve(store.getVendorBranches(username)),
  saveVendorBranch: async (username, branch) => Promise.resolve(store.saveVendorBranch(username, branch)),
  deleteVendorBranch: async (username, branchId) => Promise.resolve(store.deleteVendorBranch(username, branchId))
};

const vendorWorksDomain = {
  getVendorPreviousWorks: async (username) => {
    const local = store.getVendorPreviousWorks(username) || [];
    if (isLive()) {
      try {
        const branches = await api.vendor.branches();
        if (Array.isArray(branches?.data)) {
          const serverWorks = [];
          for (const b of branches.data) {
            for (const w of (b.works || [])) {
              serverWorks.push({
                ...w,
                branchId: b.id,
                date: w.eventDate,
                photos: (w.photos || []).map(wp => ({
                  id: wp.id,
                  url: wp.url,
                  caption: wp.caption,
                  order: wp.order
                })),
                coverPhoto: w.photos?.[0]?.url || ''
              });
            }
          }
          if (serverWorks.length > 0) return serverWorks;
        }
      } catch (e) {}
    }
    return local;
  },
  saveVendorPreviousWork: async (username, work) => {
    let savedServerWork = null;
    if (isLive() && work.branchId) {
      try {
        const photoFileIds = (work.photos || []).map(p => p.id || p.fileId).filter(Boolean);
        const res = await api.vendor.createWork(work.branchId, {
          title: work.title,
          eventType: work.eventType,
          eventDate: work.date,
          guests: work.guests,
          caption: work.caption,
          photoFileIds
        });
        if (res?.data) savedServerWork = res.data;
      } catch (err) {
        console.warn('[DataService] Server createWork failed:', err.message);
      }
    }
    const localWork = { ...work, id: savedServerWork?.id || work.id };
    return store.saveVendorPreviousWork(username, localWork);
  },
  deleteVendorPreviousWork: async (username, workId) => Promise.resolve(store.deleteVendorPreviousWork(username, workId))
};

const vendorBookingsDomain = {
  getVendorBookings: async (username) => Promise.resolve(store.getVendorBookings(username)),
  cancelVendorBooking: async (username, id, reason) => Promise.resolve(store.cancelVendorBooking(username, id, reason)),
  markBookingCompleted: async (username, id) => Promise.resolve(store.markBookingCompleted(username, id)),
  confirmVendorBooking: async (username, id) => Promise.resolve(store.confirmVendorBooking(username, id))
};

const vendorRevenueDomain = {
  getRevenueSummary: async (username) => {
    if (isLive()) {
      try {
        return await api.vendor.revenueSummary();
      } catch { }
    }
    const bookings = store.getVendorBookings(username) || [];
    const completed = bookings.filter(b => b.status === 'Completed' || b.paymentStatus === 'Paid');
    const gross = completed.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const commission = Math.round(gross * 0.10);
    return Promise.resolve({
      grossRevenue: gross,
      netRevenue: gross - commission,
      commissionPaid: commission,
      completedBookings: completed.length
    });
  },

  getRevenueSeries: async (username, months = 12) => {
    if (isLive()) {
      try {
        return await api.vendor.revenueSeries(months);
      } catch { }
    }
    return Promise.resolve([]);
  }
};

const vendorProfileDomain = {
  updateVendorProfile: async (username, profile) => Promise.resolve(store.updateVendorProfile(username, profile)),
  addVendorWarning: async (username, reason) => Promise.resolve(store.addVendorWarning(username, reason))
};

const documentsDomain = {
  verifyDocument: async (type, number, branchId) => {
    if (isLive()) {
      try {
        return await api.auth.verifyDocument(type, number, branchId);
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    // Mock document validation
    const isValid = type === 'trade_licence' ? /^TL-[A-Z]{3}-\d{4}-\d{4}$/.test(number) : /^\d{14}$/.test(number);
    return {
      success: isValid,
      status: isValid ? 'verified' : 'rejected',
      message: isValid ? 'Document verified' : 'Invalid document format'
    };
  }
};

const reviewsDomain = {
  createReview: async (bookingId, rating, comment) => {
    if (isLive()) {
      return api.bookings.review(bookingId, rating, comment);
    }
    return { id: 'rev_' + Date.now(), rating, comment };
  }
};

const notificationsDomain = {
  list: async () => (isLive() ? api.notifications.list() : Promise.resolve([])),
  unreadCount: async () => (isLive() ? api.notifications.unreadCount() : Promise.resolve({ count: 0 })),
  markRead: async (id) => (isLive() ? api.notifications.markRead(id) : Promise.resolve(null))
};

// ==========================================
// EXPORT UNIFIED DATA SERVICE INTERFACE
// ==========================================
export const dataService = {
  getMode,
  isLive,
  setMode,
  detectMode,
  subscribeMode,
  safeStorage,

  auth: authDomain,
  session: sessionDomain,
  location: locationDomain,
  planner: plannerDomain,
  vendors: vendorsDomain,
  bookings: bookingsDomain,
  payments: paymentsDomain,
  chat: chatDomain,
  calls: callsDomain,
  notifications: notificationsDomain,
  vendorBranches: vendorBranchesDomain,
  vendorWorks: vendorWorksDomain,
  vendorBookings: vendorBookingsDomain,
  vendorRevenue: vendorRevenueDomain,
  vendorProfile: vendorProfileDomain,
  documents: documentsDomain,
  reviews: reviewsDomain
};

// Top-level named convenience exports matching component usage
export const TEST_USER = authDomain.TEST_USER;
export const TEST_VENDOR = authDomain.TEST_VENDOR;
export const TEST_ACCOUNT = authDomain.TEST_ACCOUNT;
export const seedTestAccount = authDomain.seedTestAccount;
export const seedTestVendor = authDomain.seedTestVendor;
export const seedCatalogVendors = authDomain.seedCatalogVendors;
export const authenticateUser = authDomain.userLogin;
export const authenticateVendor = authDomain.vendorLogin;
export const isPhoneTaken = authDomain.isPhoneTaken;
export const isUsernameTaken = authDomain.isUsernameTaken;
export const updateUserProfile = authDomain.updateUserProfile;
export const changeUserPassword = authDomain.changeUserPassword;
export const changeVendorPassword = authDomain.changeVendorPassword;
export const createVendorAccount = authDomain.vendorSignup;
export const vendorLogout = authDomain.logout;

export const getCurrentUser = sessionDomain.getCurrentUser;
export const setCurrentUser = sessionDomain.setCurrentUser;
export const getCurrentVendor = sessionDomain.getCurrentVendor;
export const setCurrentVendor = sessionDomain.setCurrentVendor;

export const getSelectedEvent = locationDomain.getSelectedEvent;
export const setSelectedEvent = locationDomain.setSelectedEvent;

export const saveUserPlan = plannerDomain.saveUserPlan;
export const getSavedPlan = plannerDomain.getSavedPlan;
export const calculatePlan = plannerDomain.calculatePlan;

export const getUnifiedVendorsCatalog = vendorsDomain.getUnifiedVendorsCatalog;
export const getUserBookings = bookingsDomain.getUserBookings;
export const saveUserBooking = bookingsDomain.saveUserBooking;
export const cancelUserBooking = bookingsDomain.cancelUserBooking;
export const cancelBooking = bookingsDomain.cancelUserBooking;

export const getChatMessages = chatDomain.getChatMessages;
export const addChatMessage = chatDomain.addChatMessage;
export const addVoiceCallLog = chatDomain.addVoiceCallLog;
export const getActiveChatVendorIds = chatDomain.getActiveChatVendorIds;
export const getVendorChatThreads = chatDomain.getVendorChatThreads;
export const addVendorChatMessage = chatDomain.addVendorChatMessage;

export const getVendorBranches = vendorBranchesDomain.getVendorBranches;
export const saveVendorBranch = vendorBranchesDomain.saveVendorBranch;
export const deleteVendorBranch = vendorBranchesDomain.deleteVendorBranch;

export const getVendorPreviousWorks = vendorWorksDomain.getVendorPreviousWorks;
export const saveVendorPreviousWork = vendorWorksDomain.saveVendorPreviousWork;
export const deleteVendorPreviousWork = vendorWorksDomain.deleteVendorPreviousWork;

export const getVendorBookings = vendorBookingsDomain.getVendorBookings;
export const cancelVendorBooking = vendorBookingsDomain.cancelVendorBooking;
export const markBookingCompleted = vendorBookingsDomain.markBookingCompleted;
export const confirmVendorBooking = vendorBookingsDomain.confirmVendorBooking;

export const updateVendorProfile = vendorProfileDomain.updateVendorProfile;
export const addVendorWarning = vendorProfileDomain.addVendorWarning;

// Photo Management Methods
export const uploadBranchPhotos = async (branchId, files, onProgress) => {
  if (isLive()) {
    return api.photos.uploadBranchPhotos(branchId, files, onProgress);
  }
  const items = [];
  for (const file of files) {
    const dataUrl = await compressImage(file, 1280, 0.8);
    const photoId = await savePhoto(dataUrl);
    items.push({
      id: photoId,
      url: dataUrl,
      caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : '',
      isCover: false
    });
  }
  return items;
};

export const updatePhoto = async (photoId, data) => {
  if (isLive()) {
    return api.photos.updatePhoto(photoId, data);
  }
  return { id: photoId, ...data };
};

export const deletePhoto = async (photoId) => {
  if (isLive()) {
    return api.photos.deletePhoto(photoId);
  }
  return { message: 'Deleted locally', id: photoId };
};

export const uploadWorkPhotos = async (workId, files, onProgress) => {
  if (isLive()) {
    return api.photos.uploadWorkPhotos(workId, files, onProgress);
  }
  const items = [];
  for (const file of files) {
    const dataUrl = await compressImage(file, 1280, 0.8);
    const photoId = await savePhoto(dataUrl);
    items.push({
      id: photoId,
      url: dataUrl,
      caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : ''
    });
  }
  return items;
};

export async function syncBrowserPhotosToBackend(username) {
  if (!username || !isLive()) return;
  try {
    const branches = store.getVendorBranches(username) || [];
    let totalSynced = 0;

    for (const b of branches) {
      if (!Array.isArray(b.photos) || b.photos.length === 0) continue;
      const pendingPhotos = [];
      const keptPhotos = [];

      for (const p of b.photos) {
        if (!p) continue;
        const url = p.url || '';
        if (url.startsWith('/uploads') || url.startsWith('http')) {
          keptPhotos.push(p);
          continue;
        }

        let dataUrl = url;
        if (!dataUrl.startsWith('data:')) {
          dataUrl = await getPhoto(p.id || url);
        }

        if (dataUrl && dataUrl.startsWith('data:image/')) {
          const file = dataUrlToFile(dataUrl, `synced-${p.id || Date.now()}.jpg`);
          pendingPhotos.push({ file, meta: p });
        } else {
          keptPhotos.push(p);
        }
      }

      if (pendingPhotos.length > 0) {
        try {
          const files = pendingPhotos.map(item => item.file);
          const uploaded = await api.photos.uploadBranchPhotos(b.id, files);
          if (Array.isArray(uploaded)) {
            for (let idx = 0; idx < uploaded.length; idx++) {
              const u = uploaded[idx];
              const orig = pendingPhotos[idx]?.meta || {};
              keptPhotos.push({
                id: u.id,
                url: u.url,
                caption: orig.caption || u.caption || '',
                isCover: orig.isCover || u.isCover,
                order: u.order !== undefined ? u.order : keptPhotos.length
              });
            }
            b.photos = keptPhotos;
            store.saveVendorBranch(username, b);
            totalSynced += uploaded.length;
          }
        } catch (err) {
          console.warn('[Sync] Failed to sync branch photos:', err.message);
        }
      }
    }

    if (totalSynced > 0) {
      showUtsavoraToast('Your photos are now visible to customers');
    }
  } catch (err) {
    console.warn('[Sync] Photos sync error:', err.message);
  }
}

export {
  CHAT_TRANSPORT,
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

export default dataService;
