/**
 * Mock Mode Adapter
 * Preserves full localStorage / offline functionality when backend is unreachable.
 */
import * as store from '../services/store.js';

export const mockApi = {
  isMock: true,

  auth: {
    userLogin: async (phone, password) => {
      const res = await store.authenticateUser(phone, password);
      if (!res.success) {
        const err = new Error(res.error || 'Authentication failed');
        err.status = 401;
        throw err;
      }
      return {
        user: res.user,
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now()
      };
    },
    vendorLogin: async (identifier, password) => {
      const res = await store.authenticateVendor(identifier, password);
      if (!res.success) {
        const err = new Error(res.error || 'Vendor authentication failed');
        err.status = 401;
        throw err;
      }
      return {
        vendor: res.vendor,
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now()
      };
    },
    me: async () => {
      const u = store.getCurrentUser();
      const v = store.getCurrentVendor();
      if (u) return { user: u, role: 'user' };
      if (v) return { user: v, role: 'vendor' };
      return null;
    }
  },

  vendors: {
    list: async (filters = {}) => {
      // Return unified vendors catalog
      return store.getUnifiedVendorsCatalog([]);
    },
    get: async (id) => {
      const all = store.getUnifiedVendorsCatalog([]);
      return all.find(v => String(v.id) === String(id)) || null;
    }
  },

  bookings: {
    list: async () => {
      const u = store.getCurrentUser();
      return u ? store.getUserBookings(u.phone) : [];
    },
    create: async (bookingData) => {
      const u = store.getCurrentUser();
      if (!u) throw new Error('Must be logged in');
      return store.saveUserBooking(u.phone, bookingData);
    },
    cancel: async (bookingId) => {
      const u = store.getCurrentUser();
      if (!u) throw new Error('Must be logged in');
      return store.cancelUserBooking(u.phone, bookingId);
    }
  },

  chat: {
    list: async () => {
      const u = store.getCurrentUser();
      const v = store.getCurrentVendor();
      if (v) {
        return store.getVendorChatThreads(v.username);
      }
      // For user, return chat ids
      const ids = store.getActiveChatVendorIds();
      return ids.map(id => ({ id, branchId: id, messages: store.getChatMessages(id) }));
    },
    messages: async (convoId) => {
      return store.getChatMessages(convoId);
    },
    send: async (convoId, message) => {
      return store.addChatMessage(convoId, message);
    }
  },

  vendor: {
    profile: async () => store.getCurrentVendor(),
    branches: async () => {
      const v = store.getCurrentVendor();
      return v ? store.getVendorBranches(v.username) : [];
    },
    bookings: async () => {
      const v = store.getCurrentVendor();
      return v ? store.getVendorBookings(v.username) : [];
    }
  }
};
