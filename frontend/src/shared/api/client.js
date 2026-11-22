import { mockApi } from './mock.js';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000/api/v1';

let isBackendLive = null; // null = untried, true = live, false = offline fallback

export function isLive() {
  return isBackendLive === true;
}

export function isOfflineMock() {
  return isBackendLive === false;
}

// Token storage helpers
function getToken(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setToken(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function removeToken(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Universal request wrapper with JWT attachment, 401 token refresh, and offline mock fallback
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken('utsavora_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    // We reached the backend successfully
    isBackendLive = true;

    // Handle 401 Unauthorized by attempting refresh token rotation
    if (res.status === 401 && !options._retried) {
      const refreshToken = getToken('utsavora_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.data?.accessToken) {
              setToken('utsavora_access_token', refreshData.data.accessToken);
              if (refreshData.data.refreshToken) {
                setToken('utsavora_refresh_token', refreshData.data.refreshToken);
              }
              // Retry the original request
              return request(endpoint, { ...options, _retried: true });
            }
          }
        } catch (e) {
          console.warn('[API Client] Token refresh failed:', e);
        }
      }
      removeToken('utsavora_access_token');
      removeToken('utsavora_refresh_token');
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(json.error?.message || `HTTP ${res.status} Error`);
      error.status = res.status;
      error.code = json.error?.code || 'API_ERROR';
      error.details = json.error;
      throw error;
    }

    return json.data !== undefined ? json.data : json;
  } catch (err) {
    // If it is a network error (backend server not running or CORS block), fall back to offline mock
    if (err.name === 'TypeError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      if (isBackendLive !== false) {
        console.info('[API Client] Backend unreachable, falling back to transparent offline mock mode.');
      }
      isBackendLive = false;
      return handleMockFallback(endpoint, options, err);
    }
    throw err;
  }
}

/**
 * Upload multipart form data with progress callback
 */
async function uploadWithProgress(endpoint, formData, onProgress) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getToken('utsavora_access_token');

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }
      xhr.onload = () => {
        try {
          isBackendLive = true;
          const json = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(100);
            resolve(json.data !== undefined ? json.data : json);
          } else {
            const err = new Error(json.error?.message || `HTTP ${xhr.status} Error`);
            err.status = xhr.status;
            err.code = json.error?.code;
            reject(err);
          }
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = () => {
        isBackendLive = false;
        reject(new Error('Network connection error during photo upload.'));
      };
      xhr.send(formData);
    });
  } else {
    // Node / test environment fallback
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });
    isBackendLive = true;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error?.message || `HTTP ${res.status} Error`);
      err.status = res.status;
      throw err;
    }
    return json.data !== undefined ? json.data : json;
  }
}

/**
 * Routes requests to mockApi when backend is offline
 */
async function handleMockFallback(endpoint, options, originalError) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // Auth routing
  if (endpoint.includes('/auth/user/login') && method === 'POST') {
    return mockApi.auth.userLogin(body.phone, body.password);
  }
  if (endpoint.includes('/auth/vendor/login') && method === 'POST') {
    return mockApi.auth.vendorLogin(body.identifier, body.password);
  }
  if (endpoint.includes('/auth/me')) {
    return mockApi.auth.me();
  }

  // Vendors routing
  if (endpoint.startsWith('/vendors') && method === 'GET') {
    return mockApi.vendors.list();
  }

  // Bookings routing
  if (endpoint.startsWith('/bookings') && method === 'GET') {
    return mockApi.bookings.list();
  }
  if (endpoint.startsWith('/bookings') && method === 'POST') {
    return mockApi.bookings.create(body);
  }

  // Chat routing
  if (endpoint.startsWith('/chat/conversations') && method === 'GET') {
    return mockApi.chat.list();
  }

  // Re-throw if unhandled in mock
  throw originalError;
}

export const api = {
  isLive,
  isOfflineMock,

  // Auth
  auth: {
    userSignup: async (data) => {
      const res = await request('/auth/user/signup', { method: 'POST', body: JSON.stringify(data) });
      if (res?.accessToken) {
        setToken('utsavora_access_token', res.accessToken);
        if (res.refreshToken) setToken('utsavora_refresh_token', res.refreshToken);
      }
      return res;
    },
    userLogin: async (phone, password) => {
      const res = await request('/auth/user/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      if (res?.accessToken) {
        setToken('utsavora_access_token', res.accessToken);
        if (res.refreshToken) setToken('utsavora_refresh_token', res.refreshToken);
      }
      return res;
    },
    vendorSignup: async (data) => {
      const res = await request('/auth/vendor/signup', { method: 'POST', body: JSON.stringify(data) });
      if (res?.accessToken) {
        setToken('utsavora_access_token', res.accessToken);
        if (res.refreshToken) setToken('utsavora_refresh_token', res.refreshToken);
      }
      return res;
    },
    vendorLogin: async (identifier, password) => {
      const res = await request('/auth/vendor/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
      if (res?.accessToken) {
        setToken('utsavora_access_token', res.accessToken);
        if (res.refreshToken) setToken('utsavora_refresh_token', res.refreshToken);
      }
      return res;
    },
    me: () => request('/auth/me'),
    refresh: () => request('/auth/refresh', { method: 'POST' }),
    verifyDocument: (type, number, branchId) => request('/auth/verify-document', { method: 'POST', body: JSON.stringify({ type, number, branchId }) })
  },

  // Vendors
  vendors: {
    browse: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/vendors${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/vendors/${id}`),
    availability: (id, month) => request(`/vendors/${id}/availability?month=${month}`),
    reviews: (id) => request(`/vendors/${id}/reviews`)
  },

  // Planner
  planner: {
    calculate: (input) => request('/planner', { method: 'POST', body: JSON.stringify(input) }),
    save: (input, result) => request('/planner/save', { method: 'POST', body: JSON.stringify({ input, result }) }),
    list: () => request('/planner'),
    share: (id) => request(`/planner/${id}/share`, { method: 'POST' })
  },

  // Bookings
  bookings: {
    quote: (data) => request('/bookings/quote', { method: 'POST', body: JSON.stringify(data) }),
    create: (data) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    list: () => request('/bookings'),
    get: (id) => request(`/bookings/${id}`),
    cancel: (id, reason) => request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
    review: (id, rating, comment) => request(`/bookings/${id}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) })
  },

  // Payments
  payments: {
    createOrder: (bookingId) => request('/payments/create-order', { method: 'POST', body: JSON.stringify({ bookingId }) }),
    confirm: (data) => request('/payments/confirm', { method: 'POST', body: JSON.stringify(data) })
  },

  // Chat
  chat: {
    conversations: () => request('/chat/conversations'),
    messages: (convoId) => request(`/chat/conversations/${convoId}/messages`),
    sendMessage: (convoId, body, clientId) => request(`/chat/conversations/${convoId}/messages`, { method: 'POST', body: JSON.stringify({ body, clientId }) }),
    start: (branchId, planId) => request('/chat/start', { method: 'POST', body: JSON.stringify({ branchId, planId }) }),
    markRead: (convoId) => request(`/chat/conversations/${convoId}/read`, { method: 'POST' })
  },

  // Masked In-App Calls
  calls: {
    initiate: (conversationId) => request('/calls/initiate', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    answer: (callId) => request(`/calls/${callId}/answer`, { method: 'POST' }),
    end: (callId) => request(`/calls/${callId}/end`, { method: 'POST' })
  },

  // Vendor Portal
  vendor: {
    profile: () => request('/vendor/profile'),
    updateProfile: (data) => request('/vendor/profile', { method: 'PUT', body: JSON.stringify(data) }),
    branches: () => request('/vendor/branches'),
    createBranch: (data) => request('/vendor/branches', { method: 'POST', body: JSON.stringify(data) }),
    blocks: (branchId) => request(`/vendor/branches/${branchId}/blocks`),
    addBlock: (branchId, date, reason) => request(`/vendor/branches/${branchId}/blocks`, { method: 'POST', body: JSON.stringify({ date, reason }) }),
    bookings: () => request('/vendor/bookings'),
    requests: () => request('/vendor/requests'),
    createWork: (branchId, data) => request(`/vendor/branches/${branchId}/works`, { method: 'POST', body: JSON.stringify(data) }),
    revenueSummary: () => request('/vendor/revenue/summary'),
    revenueSeries: (months = 12) => request(`/vendor/revenue/series?months=${months}`),
    payouts: () => request('/vendor/payouts')
  },

  // Admin
  admin: {
    vendors: () => request('/admin/vendors'),
    verifyDocument: (docId, action, reason) => request(`/admin/documents/${docId}/verify`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
    violations: () => request('/admin/violations'),
    stats: () => request('/admin/stats')
  },

  // Notifications
  notifications: {
    list: () => request('/notifications'),
    unreadCount: () => request('/notifications/unread-count'),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PUT' })
  },

  // Photos
  photos: {
    uploadBranchPhotos: (branchId, files, onProgress) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('photos', file);
      }
      return uploadWithProgress(`/vendor/branches/${branchId}/photos`, formData, onProgress);
    },
    updatePhoto: (photoId, data) => request(`/vendor/photos/${photoId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    deletePhoto: (photoId) => request(`/vendor/photos/${photoId}`, {
      method: 'DELETE'
    }),
    uploadWorkPhotos: (workId, files, onProgress) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('photos', file);
      }
      return uploadWithProgress(`/vendor/works/${workId}/photos`, formData, onProgress);
    },
    deleteWorkPhoto: (workId, photoId) => request(`/vendor/works/${workId}/photos/${photoId}`, {
      method: 'DELETE'
    })
  }
};

export default api;
