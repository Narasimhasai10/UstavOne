/**
 * Real-Time Chat WebSocket Service
 * 
 * Provides single-instance connection to Socket.IO backend for low-latency,
 * WhatsApp-style messaging between customers and vendors.
 */

import { io } from 'socket.io-client';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000/api/v1';
const SOCKET_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

let socket = null;
let currentToken = null;
const messageListeners = new Set();
const updateListeners = new Set();
const readListeners = new Set();
let activeConversationId = null;

function getToken() {
  try {
    return localStorage.getItem('utsavora_access_token') || null;
  } catch {
    return null;
  }
}

export function initSocket() {
  if (typeof window === 'undefined') return null;

  const token = getToken();

  // If already connected with the same token, return existing instance
  if (socket && token === currentToken && socket.connected) {
    return socket;
  }

  // If token changed or socket disconnected/null, rebuild connection
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }

  currentToken = token;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 8000
  });

  socket.on('connect', () => {
    if (activeConversationId) {
      socket.emit('join_conversation', activeConversationId);
    }
  });

  socket.on('new_message', (data) => {
    messageListeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error('[chatSocket] onMessage error:', err); }
    });
  });

  socket.on('conversation_update', (data) => {
    updateListeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error('[chatSocket] onConversationUpdate error:', err); }
    });
  });

  socket.on('messages_read', (data) => {
    readListeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error('[chatSocket] onMessagesRead error:', err); }
    });
  });

  return socket;
}

export function join(conversationId) {
  if (!conversationId) return;
  activeConversationId = conversationId;
  const s = initSocket();
  if (s) {
    if (s.connected) {
      s.emit('join_conversation', conversationId);
    } else {
      s.once('connect', () => {
        s.emit('join_conversation', conversationId);
      });
    }
  }
}

export function leave(conversationId) {
  if (activeConversationId === conversationId) {
    activeConversationId = null;
  }
  if (socket && socket.connected) {
    socket.emit('leave_conversation', conversationId);
  }
}

export function onMessage(cb) {
  messageListeners.add(cb);
  initSocket();
  return () => messageListeners.delete(cb);
}

export function onConversationUpdate(cb) {
  updateListeners.add(cb);
  initSocket();
  return () => updateListeners.delete(cb);
}

export function onMessagesRead(cb) {
  readListeners.add(cb);
  initSocket();
  return () => readListeners.delete(cb);
}

export function disconnect() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
    currentToken = null;
    activeConversationId = null;
  }
}

export const chatSocket = {
  initSocket,
  join,
  leave,
  onMessage,
  onConversationUpdate,
  onMessagesRead,
  disconnect
};

export default chatSocket;
