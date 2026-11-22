/**
 * Unified Local Conversation Store (chatStore.js)
 * Manages customer <-> vendor conversations in localStorage under 'utsavora_conversations_v2'
 */

export const CHAT_STORAGE_KEY = 'utsavora_conversations_v2';
export const CHAT_MIGRATED_KEY = 'utsavora_chat_migrated';

// Safe in-memory fallback if localStorage is disabled
const memoryStorage = new Map();

function storageGet(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorage.get(key) || null;
}

function storageSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return true;
    }
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22)) {
      throw new Error('Storage is full, please free space');
    }
    throw err;
  }
  memoryStorage.set(key, value);
  return true;
}

function storageRemove(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {}
  memoryStorage.delete(key);
}

// Global broadcast channel & event dispatcher for cross-tab and cross-component updates
let broadcastChannel = null;
if (typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('utsavora-chat');
    if (typeof broadcastChannel.unref === 'function') {
      broadcastChannel.unref();
    }
  } catch {}
}

export function notifyChat(detail = {}) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(detail);
    } catch {}
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('utsavora:chat-updated', { detail }));
    } catch {}
  }
}

/**
 * Subscribes to real-time chat updates across tabs and within the window
 */
export function subscribeChat(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (ev) => {
    try {
      callback(ev?.detail || null);
    } catch {}
  };

  const handleStorageEvent = (ev) => {
    if (ev.key === CHAT_STORAGE_KEY || !ev.key) {
      try {
        callback({ type: 'STORAGE_SYNC', key: ev.key });
      } catch {}
    }
  };

  let localBc = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      localBc = new BroadcastChannel('utsavora-chat');
      if (typeof localBc.unref === 'function') {
        localBc.unref();
      }
      localBc.onmessage = (ev) => {
        try {
          callback(ev.data);
        } catch {}
      };
    } catch {}
  }

  window.addEventListener('utsavora:chat-updated', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('utsavora:chat-updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (localBc) {
      try { localBc.close(); } catch {}
    }
  };
}

/**
 * Loads all conversations from storage
 */
export function loadAllConversations() {
  try {
    const raw = storageGet(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves all conversations to storage
 */
export function saveAllConversations(conversations) {
  storageSet(CHAT_STORAGE_KEY, JSON.stringify(conversations || []));
}

/**
 * Resolves the lowercase username of the vendor who owns a given branch
 */
export function resolveVendorUsername(branch) {
  if (!branch) return null;
  if (branch.vendorUsername) {
    return String(branch.vendorUsername).trim().toLowerCase();
  }

  const bId = String(branch.branchId || branch.id || '').trim();
  if (!bId) return null;

  try {
    const raw = storageGet('utsavora_vendors');
    const vendors = raw ? JSON.parse(raw) : [];
    if (Array.isArray(vendors)) {
      for (const v of vendors) {
        if (!v || !v.username) continue;
        const u = v.username.trim().toLowerCase();
        const rawBranches = storageGet(`utsavora_branches_${u}`);
        const branches = rawBranches ? JSON.parse(rawBranches) : [];
        if (Array.isArray(branches) && branches.some(b => String(b.id || b.branchId) === bId)) {
          return u;
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Retrieves an existing conversation or creates a new one
 */
export function getOrCreateConversation(customer, branch) {
  migrateChatData();

  const customerPhone = String(customer?.phone || '').trim() || '9390075877';
  const customerName = String(customer?.name || '').trim() || 'Customer';
  const branchId = String(branch?.branchId || branch?.id || '').trim() || 'default-branch';
  const branchName = branch?.name || branch?.branchName || 'Listing';
  const branchType = branch?.type || branch?.branchType || (branch?.capacity ? 'hall' : (branch?.servingStyles ? 'caterer' : 'hall'));
  const vendorUsername = resolveVendorUsername(branch);

  const conversationId = `${customerPhone}__${branchId}`;
  const conversations = loadAllConversations();
  const existingIdx = conversations.findIndex(c => c.id === conversationId);

  if (existingIdx >= 0) {
    const existing = conversations[existingIdx];
    let updated = false;
    if (vendorUsername && existing.vendorUsername !== vendorUsername) {
      existing.vendorUsername = vendorUsername;
      updated = true;
    }
    if (branchName && existing.branchName !== branchName) {
      existing.branchName = branchName;
      updated = true;
    }
    if (customerName && customerName !== 'Customer' && existing.customerName !== customerName) {
      existing.customerName = customerName;
      updated = true;
    }
    if (updated) {
      saveAllConversations(conversations);
    }
    return existing;
  }

  const now = new Date().toISOString();
  const newConversation = {
    id: conversationId,
    customerPhone,
    customerName,
    branchId,
    branchName,
    branchType,
    vendorUsername: vendorUsername || null,
    createdAt: now,
    lastMessageAt: now,
    messages: []
  };

  conversations.unshift(newConversation);
  saveAllConversations(conversations);
  notifyChat({ type: 'CONVERSATION_CREATED', conversationId, vendorUsername });
  return newConversation;
}

/**
 * Sends a message into a conversation (idempotent by clientId)
 */
export function sendMessage(conversationId, sender, text, clientId = null) {
  migrateChatData();

  if (!conversationId) {
    throw new Error('Conversation ID is required to send message');
  }

  const conversations = loadAllConversations();
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  if (!Array.isArray(conv.messages)) {
    conv.messages = [];
  }

  // Idempotency check: if clientId already exists in this conversation, return it
  if (clientId) {
    const existingMsg = conv.messages.find(m => m.clientId === clientId);
    if (existingMsg) {
      return { conversation: conv, message: existingMsg, duplicate: true };
    }
  }

  const cleanSender = sender === 'user' ? 'customer' : sender;
  const now = new Date().toISOString();
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const newMsg = {
    id: msgId,
    clientId: clientId || null,
    sender: cleanSender,
    text: String(text || '').trim(),
    createdAt: now,
    status: 'sent'
  };

  conv.messages.push(newMsg);
  conv.lastMessageAt = now;

  saveAllConversations(conversations);

  notifyChat({
    type: 'MESSAGE_SENT',
    conversationId,
    message: newMsg,
    sender: cleanSender,
    customerName: conv.customerName,
    customerPhone: conv.customerPhone,
    vendorUsername: conv.vendorUsername,
    branchName: conv.branchName
  });

  return { conversation: conv, message: newMsg, duplicate: false };
}

/**
 * Retrieves messages for a conversation
 */
export function getMessages(conversationId) {
  migrateChatData();
  const conversations = loadAllConversations();
  const conv = conversations.find(c => c.id === conversationId);
  return conv?.messages || [];
}

/**
 * Lists conversations for a vendor (case-insensitive username match)
 */
export function listForVendor(username) {
  migrateChatData();
  const cleanUser = String(username || '').trim().toLowerCase();
  if (!cleanUser) return [];

  const conversations = loadAllConversations();
  const vendorConvs = conversations.filter(c => {
    return c.vendorUsername && c.vendorUsername.toLowerCase() === cleanUser;
  });

  return vendorConvs.map(c => {
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const unreadMsgs = msgs.filter(m => m.sender === 'customer' && m.status !== 'read');
    const lastMsg = msgs[msgs.length - 1];

    return {
      ...c,
      unreadCount: unreadMsgs.length,
      unread: unreadMsgs.length > 0,
      lastMessage: lastMsg?.text || 'No messages yet',
      lastMessageAt: c.lastMessageAt || c.createdAt
    };
  }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
}

/**
 * Lists conversations for a customer by phone number
 */
export function listForCustomer(phone) {
  migrateChatData();
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone) return [];

  const conversations = loadAllConversations();
  const customerConvs = conversations.filter(c => c.customerPhone === cleanPhone);

  return customerConvs.map(c => {
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const unreadMsgs = msgs.filter(m => m.sender === 'vendor' && m.status !== 'read');
    const lastMsg = msgs[msgs.length - 1];

    return {
      ...c,
      unreadCount: unreadMsgs.length,
      unread: unreadMsgs.length > 0,
      lastMessage: lastMsg?.text || 'No messages yet',
      lastMessageAt: c.lastMessageAt || c.createdAt
    };
  }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
}

/**
 * Marks messages in a conversation as read by readerRole ('vendor' | 'customer')
 */
export function markRead(conversationId, readerRole) {
  migrateChatData();
  if (!conversationId) return;

  const conversations = loadAllConversations();
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv || !Array.isArray(conv.messages)) return;

  const targetSender = readerRole === 'vendor' ? 'customer' : 'vendor';
  let changed = false;

  conv.messages = conv.messages.map(m => {
    if (m.sender === targetSender && m.status !== 'read') {
      changed = true;
      return { ...m, status: 'read' };
    }
    return m;
  });

  if (changed) {
    saveAllConversations(conversations);
    notifyChat({
      type: 'MESSAGES_READ',
      conversationId,
      readerRole,
      vendorUsername: conv.vendorUsername,
      customerPhone: conv.customerPhone
    });
  }
}

/**
 * Derived unread conversations count for vendor (0 -> no badge)
 */
export function unreadCountForVendor(username) {
  migrateChatData();
  const cleanUser = String(username || '').trim().toLowerCase();
  if (!cleanUser) return 0;

  const conversations = loadAllConversations();
  return conversations.filter(c => {
    if (!c.vendorUsername || c.vendorUsername.toLowerCase() !== cleanUser) return false;
    return Array.isArray(c.messages) && c.messages.some(m => m.sender === 'customer' && m.status !== 'read');
  }).length;
}

/**
 * Derived unread vendor messages/conversations count for customer
 */
export function unreadCountForCustomer(phone, branchId = null) {
  migrateChatData();
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone) return 0;

  const conversations = loadAllConversations();
  if (branchId) {
    const convId = `${cleanPhone}__${branchId}`;
    const conv = conversations.find(c => c.id === convId);
    if (!conv || !Array.isArray(conv.messages)) return 0;
    return conv.messages.filter(m => m.sender === 'vendor' && m.status !== 'read').length;
  }

  return conversations.filter(c => {
    if (c.customerPhone !== cleanPhone) return false;
    return Array.isArray(c.messages) && c.messages.some(m => m.sender === 'vendor' && m.status !== 'read');
  }).length;
}

/**
 * One-time migration: converts existing vedika_chat_* and vedika_vendor_chats_*
 * into utsavora_conversations_v2 without losing real messages.
 */
export function migrateChatData() {
  try {
    if (storageGet(CHAT_MIGRATED_KEY) === '1') return;

    const fakeThreadIds = new Set(['chat_sai_halls_1', 'chat_sai_halls_2', 'chat_sai_halls_3', 'chat_sai_halls_4']);
    const fakeMsgIds = new Set(['m_welcome', 'm1', 'msg_welcome', 'msg_1']);

    let conversations = loadAllConversations();
    const convMap = new Map();
    conversations.forEach(c => convMap.set(c.id, c));

    // Determine default customer info from currentUser
    let defaultPhone = '9390075877';
    let defaultName = 'Customer';
    try {
      const uRaw = storageGet('utsavora_current_user');
      if (uRaw) {
        const u = JSON.parse(uRaw);
        if (u?.phone) defaultPhone = u.phone;
        if (u?.name) defaultName = u.name;
      }
    } catch {}

    const keysToRemove = [];

    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith('utsavora_vendor_chats_') || key.startsWith('vedika_vendor_chats_')) {
          keysToRemove.push(key);
          const username = key.replace('utsavora_vendor_chats_', '').replace('vedika_vendor_chats_', '').toLowerCase();
          try {
            const raw = localStorage.getItem(key);
            const threads = raw ? JSON.parse(raw) : [];
            if (Array.isArray(threads)) {
              for (const t of threads) {
                if (fakeThreadIds.has(t.id)) continue;
                const custPhone = t.customerPhone || defaultPhone;
                const custName = t.customerName || defaultName;
                const branchId = t.vendorId || t.branchId || 'default-branch';
                const convId = `${custPhone}__${branchId}`;

                let conv = convMap.get(convId);
                if (!conv) {
                  conv = {
                    id: convId,
                    customerPhone: custPhone,
                    customerName: custName,
                    branchId,
                    branchName: t.branchName || t.name || 'Listing',
                    branchType: t.branchType || 'hall',
                    vendorUsername: username,
                    createdAt: t.createdAt || new Date().toISOString(),
                    lastMessageAt: t.timestamp ? new Date().toISOString() : new Date().toISOString(),
                    messages: []
                  };
                  convMap.set(convId, conv);
                  conversations.push(conv);
                }

                if (Array.isArray(t.messages)) {
                  for (const m of t.messages) {
                    if (fakeMsgIds.has(m.id)) continue;
                    if (!m.text || m.text.includes('Welcome to')) continue;
                    const already = conv.messages.some(em => em.id === m.id || (em.text === m.text && em.createdAt === m.createdAt));
                    if (!already) {
                      conv.messages.push({
                        id: m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        clientId: m.clientId || null,
                        sender: m.sender === 'user' ? 'customer' : (m.sender || 'vendor'),
                        text: m.text,
                        createdAt: m.createdAt || new Date().toISOString(),
                        status: m.status || 'sent'
                      });
                    }
                  }
                }
              }
            }
          } catch {}
        } else if (key.startsWith('utsavora_chat_') || key.startsWith('vedika_chat_')) {
          keysToRemove.push(key);
          const branchId = key.replace('utsavora_chat_', '').replace('vedika_chat_', '');
          try {
            const raw = localStorage.getItem(key);
            const msgs = raw ? JSON.parse(raw) : [];
            if (Array.isArray(msgs) && msgs.length > 0) {
              const convId = `${defaultPhone}__${branchId}`;
              let conv = convMap.get(convId);
              if (!conv) {
                const vendorUser = resolveVendorUsername({ branchId, id: branchId });
                conv = {
                  id: convId,
                  customerPhone: defaultPhone,
                  customerName: defaultName,
                  branchId,
                  branchName: 'Listing',
                  branchType: 'hall',
                  vendorUsername: vendorUser,
                  createdAt: new Date().toISOString(),
                  lastMessageAt: new Date().toISOString(),
                  messages: []
                };
                convMap.set(convId, conv);
                conversations.push(conv);
              }

              for (const m of msgs) {
                if (fakeMsgIds.has(m.id)) continue;
                if (!m.text || m.text.includes('Welcome to')) continue;
                const already = conv.messages.some(em => em.id === m.id || (em.text === m.text && em.createdAt === m.createdAt));
                if (!already) {
                  conv.messages.push({
                    id: m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    clientId: m.clientId || null,
                    sender: m.sender === 'user' ? 'customer' : (m.sender || 'vendor'),
                    text: m.text,
                    createdAt: m.createdAt || new Date().toISOString(),
                    status: m.status || 'sent'
                  });
                }
              }
            }
          } catch {}
        }
      }
    }

    saveAllConversations(conversations);
    storageSet(CHAT_MIGRATED_KEY, '1');

    for (const k of keysToRemove) {
      storageRemove(k);
    }
  } catch (err) {
    console.warn('[chatStore] migrateChatData error:', err);
  }
}

/**
 * Backward compatibility helpers for store.js and data-service
 */
export function getChatMessagesCompat(vendorOrBranchId, customerPhone = null) {
  migrateChatData();
  const phone = customerPhone || '9390075877';
  const convId = `${phone}__${vendorOrBranchId}`;
  return getMessages(convId);
}

export function addChatMessageCompat(vendorOrBranchId, message, customer = null) {
  migrateChatData();
  const cust = customer || { phone: '9390075877', name: 'Customer' };
  const branch = typeof vendorOrBranchId === 'object'
    ? vendorOrBranchId
    : { id: vendorOrBranchId, branchId: vendorOrBranchId };

  const conv = getOrCreateConversation(cust, branch);
  const sender = message.sender === 'vendor' ? 'vendor' : (message.sender === 'system' ? 'system' : 'customer');
  const res = sendMessage(conv.id, sender, message.text, message.clientId);
  return getMessages(conv.id);
}

export function getVendorChatThreadsCompat(username) {
  migrateChatData();
  return listForVendor(username);
}

export function addVendorChatMessageCompat(username, conversationOrThreadId, message) {
  migrateChatData();
  const sender = message.sender === 'system' ? 'system' : 'vendor';
  const res = sendMessage(conversationOrThreadId, sender, message.text, message.clientId);
  return res?.message || null;
}

export function getActiveChatVendorIdsCompat(customerPhone = null) {
  migrateChatData();
  const phone = customerPhone || '9390075877';
  const convs = listForCustomer(phone);
  return convs.map(c => c.branchId);
}
