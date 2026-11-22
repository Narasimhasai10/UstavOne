import React, { useState, useEffect, useRef } from 'react';
import {
  getVendorChatThreads,
  addVendorChatMessage,
  addVendorWarning,
  getCurrentVendor,
  getVendorBookings,
  isLive,
  safeStorage
} from '../../shared/data-service/index.js';
import { CHAT_TRANSPORT } from '../dashboard-plan/engine/config.js';
import {
  listForVendor,
  sendMessage,
  getMessages,
  markRead,
  subscribeChat,
  unreadCountForVendor
} from '../booking-chat/chatStore.js';
import api from '../../shared/api/client.js';
import chatSocket from '../booking-chat/chatSocket.js';
import { checkContactDetails } from '../../shared/utils/contactGuard.js';
import { VENDOR_CONFIG } from '../dashboard-plan/engine/config.js';

function formatMessageTime(dateInput, fallback = '10:00 AM') {
  if (!dateInput) return fallback;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDayKey(dateInput) {
  if (!dateInput) return 'Today';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Today';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VendorRequests({ vendor, initialThreadId }) {
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId || null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unread' | 'booked'
  const [hoveredThreadId, setHoveredThreadId] = useState(null);

  // Chat message input
  const [inputText, setInputText] = useState('');
  const [guardWarning, setGuardWarning] = useState('');
  const [currentWarningsCount, setCurrentWarningsCount] = useState(vendor?.warnings || 0);

  // Private Call Modal state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Mobile navigation under 800px (WhatsApp Web behavior)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 800);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Registered users and vendor bookings for name resolution
  const [users, setUsers] = useState([]);
  const [vendorBookings, setVendorBookings] = useState([]);

  const messagesEndRef = useRef(null);

  // Responsive breakpoint listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 800);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Format server message to UI structure
  const formatServerMsg = (m) => ({
    id: m.id,
    clientId: m.clientId || null,
    sender: m.senderRole === 'vendor' || m.sender === 'vendor' ? 'vendor' : (m.senderRole === 'system' || m.sender === 'system' ? 'system' : 'customer'),
    senderRole: m.senderRole === 'vendor' || m.sender === 'vendor' ? 'vendor' : (m.senderRole === 'system' || m.sender === 'system' ? 'system' : 'customer'),
    text: m.body || m.text,
    status: m.status || 'sent',
    createdAt: m.createdAt || new Date().toISOString(),
    timestamp: formatMessageTime(m.createdAt, m.timestamp),
    isCallLog: m.type === 'call_log' || m.isCallLog || m.text?.startsWith('📞') || false
  });

  // Load registered users and vendor bookings for name linking
  useEffect(() => {
    try {
      const uRaw = safeStorage.getItem('vedika_users');
      if (uRaw) setUsers(JSON.parse(uRaw));
    } catch {}

    if (vendor?.username) {
      getVendorBookings(vendor.username).then(bList => {
        if (bList) setVendorBookings(bList);
      }).catch(() => {});
    }
  }, [vendor]);

  // Reload threads and auto-select first customer if none selected
  const reloadThreads = async () => {
    if (vendor?.username) {
      if (CHAT_TRANSPORT === 'local') {
        const list = listForVendor(vendor.username);
        setThreads(list);
        setSelectedThreadId(prev => {
          if (prev && list.some(t => t.id === prev)) return prev;
          return list.length > 0 ? list[0].id : null;
        });
        return;
      }
      try {
        const list = await getVendorChatThreads(vendor.username);
        const validList = Array.isArray(list) ? list : [];
        setThreads(validList);
        setSelectedThreadId(prev => {
          if (prev && validList.some(t => t.id === prev)) return prev;
          return validList.length > 0 ? validList[0].id : null;
        });
      } catch (err) {
        console.warn('[VendorRequests] Failed to load threads:', err);
      }
    }
  };

  useEffect(() => {
    reloadThreads();
    const v = getCurrentVendor();
    if (v) setCurrentWarningsCount(v.warnings || 0);
  }, [vendor]);

  // Check URL query param for thread
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('thread=')) {
      const parts = hash.split('thread=');
      if (parts[1]) {
        setSelectedThreadId(parts[1]);
        if (window.innerWidth < 800) {
          setIsMobileChatOpen(true);
        }
      }
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadId, activeMessages]);

  // Active selected thread
  const activeThread = threads.find(t => t.id === selectedThreadId) || (threads.length > 0 ? threads[0] : null);

  // Load messages for currently selected thread
  useEffect(() => {
    const threadIdToLoad = selectedThreadId || activeThread?.id;
    if (!threadIdToLoad) {
      setActiveMessages([]);
      return;
    }

    let isMounted = true;

    if (CHAT_TRANSPORT === 'local') {
      markRead(threadIdToLoad, 'vendor');
      const msgs = getMessages(threadIdToLoad).map(formatServerMsg);
      if (isMounted) {
        setActiveMessages(msgs);
        setThreads(listForVendor(vendor?.username));
      }
      return () => {
        isMounted = false;
      };
    }

    if (isLive()) {
      chatSocket.join(threadIdToLoad);
      api.chat.messages(threadIdToLoad)
        .then(res => {
          if (!isMounted) return;
          const list = res?.data || (Array.isArray(res) ? res : []);
          setActiveMessages(list.map(formatServerMsg));
          return api.chat.markRead(threadIdToLoad);
        })
        .then(() => {
          if (!isMounted) return;
          setThreads(prev => prev.map(t => t.id === threadIdToLoad ? { ...t, unreadCount: 0, unread: false } : t));
        })
        .catch(err => {
          console.warn('[VendorRequests] Failed to fetch thread messages:', err);
        });

      return () => {
        isMounted = false;
        chatSocket.leave(threadIdToLoad);
      };
    } else {
      // Mock mode
      const found = threads.find(t => t.id === threadIdToLoad);
      if (found) {
        const updatedMsgs = (found.messages || []).map(m => (m.sender === 'user' ? { ...m, status: 'read' } : m));
        setActiveMessages(updatedMsgs);
        if (found.unreadCount > 0 || found.unread) {
          setThreads(prev => prev.map(t => t.id === threadIdToLoad ? { ...t, unreadCount: 0, unread: false, messages: updatedMsgs } : t));
          try {
            const rawStored = safeStorage.getItem(`vedika_vendor_chats_${vendor.username}`);
            if (rawStored) {
              const list = JSON.parse(rawStored);
              const updatedList = list.map(t => t.id === threadIdToLoad ? { ...t, unreadCount: 0, unread: false, messages: updatedMsgs } : t);
              safeStorage.setItem(`vedika_vendor_chats_${vendor.username}`, JSON.stringify(updatedList));
              window.dispatchEvent(new CustomEvent('vedika:chat-read', { detail: { threadId: threadIdToLoad } }));
            }
          } catch (_) {}
        }
      }
    }
  }, [selectedThreadId, activeThread?.id]);

  // Real-time Socket.IO listeners & Storage listeners for cross-tab sync
  useEffect(() => {
    if (CHAT_TRANSPORT === 'local') {
      const unsub = subscribeChat(() => {
        reloadThreads();
        const activeId = selectedThreadId || activeThread?.id;
        if (activeId) {
          setActiveMessages(getMessages(activeId).map(formatServerMsg));
          markRead(activeId, 'vendor');
        }
      });
      return () => {
        if (unsub) unsub();
      };
    }

    if (!isLive()) {
      const handleStorage = async (e) => {
        if (e.key?.startsWith('vedika_vendor_chats_') || e.key?.startsWith('vedika_chat_')) {
          await reloadThreads();
          if (activeThread?.id) {
            const freshThreads = await getVendorChatThreads(vendor.username);
            const current = (freshThreads || []).find(t => t.id === activeThread.id);
            if (current && current.messages) {
              setActiveMessages(current.messages);
            }
          }
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }

    // Live mode: Socket.IO listeners
    const currentActiveId = selectedThreadId || activeThread?.id;

    const unsubUpdate = chatSocket.onConversationUpdate((data) => {
      const convoId = data.conversationId;
      setThreads(prev => {
        const exists = prev.some(t => t.id === convoId);
        let updated;
        if (exists) {
          updated = prev.map(t => {
            if (t.id === convoId) {
              const isCurrentlyActive = t.id === currentActiveId;
              return {
                ...t,
                lastMessage: data.lastMessage?.body || t.lastMessage,
                lastMessageAt: data.lastMessage?.createdAt || new Date().toISOString(),
                timestamp: data.lastMessage?.createdAt ? formatMessageTime(data.lastMessage.createdAt) : 'Just now',
                unreadCount: isCurrentlyActive ? 0 : (t.unreadCount || 0) + 1,
                unread: !isCurrentlyActive
              };
            }
            return t;
          });
        } else {
          reloadThreads();
          return prev;
        }
        return [...updated].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    });

    const unsubMsg = chatSocket.onMessage((incoming) => {
      const activeId = selectedThreadId || activeThread?.id;
      if (incoming.conversationId === activeId) {
        setActiveMessages(prev => {
          if (incoming.clientId && prev.some(m => m.clientId === incoming.clientId)) {
            return prev.map(m => m.clientId === incoming.clientId ? formatServerMsg(incoming) : m);
          }
          if (prev.some(m => m.id === incoming.id)) {
            return prev.map(m => m.id === incoming.id ? formatServerMsg(incoming) : m);
          }
          return [...prev, formatServerMsg(incoming)];
        });

        // Mark incoming messages as read since vendor is viewing this conversation
        if (incoming.senderRole !== 'vendor' && activeId) {
          api.chat.markRead(activeId).catch(() => {});
        }
      }
    });

    const unsubRead = chatSocket.onMessagesRead((readData) => {
      const activeId = selectedThreadId || activeThread?.id;
      if (readData.conversationId === activeId) {
        setActiveMessages(prev => prev.map(m => m.sender === 'vendor' ? { ...m, status: 'read' } : m));
      }
    });

    return () => {
      unsubUpdate();
      unsubMsg();
      unsubRead();
    };
  }, [selectedThreadId, activeThread?.id, vendor?.username]);

  // Resolve real customer name (NEVER expose phone or email for platform privacy)
  const getCustomerRealName = (thread) => {
    if (!thread) return 'Customer';

    const matchedUser = (users || []).find(u => {
      if (!u) return false;
      if (thread.customerId && (u.id === thread.customerId || u.userId === thread.customerId)) return true;
      if (thread.userId && (u.id === thread.userId || u.userId === thread.userId)) return true;
      if (thread.customerName && u.name && u.name.trim().toLowerCase() === thread.customerName.trim().toLowerCase()) return true;
      return false;
    });

    if (matchedUser && matchedUser.name && matchedUser.name.trim()) {
      return matchedUser.name.trim();
    }

    if (thread.customerName && thread.customerName.trim() && thread.customerName.trim().toLowerCase() !== 'customer') {
      return thread.customerName.trim();
    }
    if (thread.name && thread.name.trim() && thread.name.trim().toLowerCase() !== 'customer') {
      return thread.name.trim();
    }

    return 'Customer';
  };

  const activeCustomerName = getCustomerRealName(activeThread);

  // Filtered threads list based on search and mode (all / unread / booked)
  const filteredThreads = threads.filter(t => {
    const hasUnread = Boolean(t.unread || (t.unreadCount && t.unreadCount > 0));
    if (filterMode === 'unread' && !hasUnread) return false;

    const realName = getCustomerRealName(t);
    const isBooked = Boolean(
      t.isBooked ||
      vendorBookings.some(b => {
        const bName = (b.customerName || '').toLowerCase().trim();
        const rName = realName.toLowerCase().trim();
        if (bName && rName && (bName === rName || bName.includes(rName) || rName.includes(bName))) return true;
        return false;
      })
    );
    if (filterMode === 'booked' && !isBooked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = realName.toLowerCase().includes(q) || (t.customerName || '').toLowerCase().includes(q);
      const lastMsgText = t.lastMessage || '';
      const matchMsg = lastMsgText.toLowerCase().includes(q);
      if (!matchName && !matchMsg) return false;
    }
    return true;
  });

  // Call timer
  useEffect(() => {
    let interval = null;
    if (isCalling) {
      interval = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const formatCallTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    setIsCalling(false);
    const threadId = selectedThreadId || activeThread?.id;
    if (threadId && vendor?.username) {
      try {
        const logText = `📞 In-app call ended (${formatCallTime(callDuration || 124)})`;
        if (CHAT_TRANSPORT === 'local') {
          sendMessage(threadId, 'system', logText);
          setActiveMessages(getMessages(threadId).map(formatServerMsg));
          setThreads(listForVendor(vendor.username));
          return;
        }
        if (isLive()) {
          await api.chat.sendMessage(threadId, logText);
        } else {
          await addVendorChatMessage(vendor.username, threadId, {
            sender: 'system',
            text: logText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          await reloadThreads();
        }
      } catch (err) {
        console.warn('[VendorRequests] Failed to log call message:', err);
      }
    }
  };

  // Quick reply
  const handleQuickReply = (text) => {
    setInputText(text);
  };

  // Send message with Contact Guard
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    const threadId = selectedThreadId || activeThread?.id;
    if (!text || !threadId || !vendor?.username) return;

    // Contact Guard check
    const guardResult = checkContactDetails(text);
    if (guardResult.blocked) {
      const updatedWarnings = await addVendorWarning(vendor.username, `Attempted contact leak: ${guardResult.reason}`);
      setCurrentWarningsCount(updatedWarnings);
      setGuardWarning(
        `Sharing personal contact details is not allowed in UstavOne and can lead to a suspension. (Warning ${updatedWarnings} of ${VENDOR_CONFIG.warningLimit})`
      );
      return;
    }

    setGuardWarning('');
    const clientId = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistic message
    const newMsg = {
      id: clientId,
      clientId,
      sender: 'vendor',
      senderRole: 'vendor',
      text,
      timestamp: timeFormatted,
      status: 'sending',
      createdAt: now.toISOString()
    };

    setActiveMessages(prev => [...prev, newMsg]);
    setInputText('');

    if (CHAT_TRANSPORT === 'local') {
      try {
        const res = sendMessage(threadId, 'vendor', text, clientId);
        setActiveMessages(prev => prev.map(m => (m.clientId === clientId || m.id === clientId) ? {
          ...m,
          id: res.message.id || m.id,
          status: res.message.status || 'sent',
          createdAt: res.message.createdAt || m.createdAt
        } : m));
        setThreads(listForVendor(vendor.username));
      } catch (err) {
        setActiveMessages(prev => prev.map(m => (m.clientId === clientId || m.id === clientId) ? {
          ...m,
          status: 'failed'
        } : m));
        if (err && (err.message?.includes('Storage is full') || err.message?.includes('quota'))) {
          setGuardWarning('⚠️ Storage is full, please free space');
        } else {
          setGuardWarning(err?.message || 'Failed to send message');
        }
      }
      return;
    }

    if (isLive()) {
      try {
        const res = await api.chat.sendMessage(threadId, text, clientId);
        const saved = res?.data || res;
        setActiveMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return {
              ...m,
              id: saved.id || m.id,
              status: saved.status || 'sent',
              createdAt: saved.createdAt || m.createdAt
            };
          }
          return m;
        }));

        setThreads(prev => prev.map(t => t.id === threadId ? {
          ...t,
          lastMessage: text,
          lastMessageAt: now.toISOString(),
          timestamp: timeFormatted
        } : t));
      } catch (err) {
        setActiveMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return { ...m, status: 'failed' };
          }
          return m;
        }));

        if (err.status === 422 || err.code === 'CONTACT_SHARING_BLOCKED' || err.message?.includes('contact')) {
          const updatedWarnings = await addVendorWarning(vendor.username, 'Attempted contact leak via API');
          setCurrentWarningsCount(updatedWarnings);
          setGuardWarning(
            `Sharing personal contact details is not allowed in UstavOne and can lead to a suspension. (Warning ${updatedWarnings} of ${VENDOR_CONFIG.warningLimit})`
          );
        } else {
          setGuardWarning(err.message || 'Failed to send message');
        }
      }
    } else {
      // Mock mode
      try {
        await addVendorChatMessage(vendor.username, threadId, {
          id: clientId,
          clientId,
          sender: 'vendor',
          text,
          timestamp: timeFormatted,
          status: 'sent',
          createdAt: now.toISOString()
        });
        setActiveMessages(prev => prev.map(m => m.id === clientId ? { ...m, status: 'sent' } : m));
        await reloadThreads();
      } catch {
        setActiveMessages(prev => prev.map(m => m.id === clientId ? { ...m, status: 'failed' } : m));
      }
    }
  };

  const handleRetrySend = (failedMsg) => {
    setActiveMessages(prev => prev.filter(m => m.id !== failedMsg.id && m.clientId !== failedMsg.clientId));
    setInputText(failedMsg.text);
  };

  const renderStatusTick = (msg) => {
    if (msg.sender !== 'vendor') return null;
    if (msg.status === 'sending') {
      return <span title="Sending" style={{ opacity: 0.7, fontSize: '0.72rem' }}>🕒</span>;
    }
    if (msg.status === 'failed') {
      return (
        <span
          onClick={() => handleRetrySend(msg)}
          title="Failed – tap to retry"
          style={{ color: '#FF5C8A', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}
        >
          ⚠️ Failed – tap to retry
        </span>
      );
    }
    if (msg.status === 'read') {
      return <span title="Read" style={{ color: '#5AA2FF', fontWeight: 700, fontSize: '0.75rem' }}>✓✓</span>;
    }
    if (msg.status === 'delivered') {
      return <span title="Delivered" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.75rem' }}>✓✓</span>;
    }
    return <span title="Sent" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.75rem' }}>✓</span>;
  };

  return (
    <div
      className="vedika-vendor-page fade-in"
      style={{
        padding: '16px 0',
        height: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* Red Banner if Account Flagged for Review */}
      {currentWarningsCount >= VENDOR_CONFIG.warningLimit && (
        <div
          role="alert"
          style={{
            background: 'var(--rose)',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '12px',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(181, 23, 59, 0.25)'
          }}
        >
          <span>🚨</span>
          <span>
            <strong>Account flagged for review:</strong> Repeated policy violations detected (personal contact sharing). Listings may be paused pending administrative review.
          </span>
        </div>
      )}

      {/* Main 2-Pane Chat Container (WhatsApp Web Style) */}
      <div
        className="vedika-card"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          flex: 1,
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'clamp(300px, 28%, 380px) 1fr',
          flexDirection: isMobile ? 'column' : undefined,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          boxSizing: 'border-box'
        }}
      >
        {/* LEFT PANE: Conversations List */}
        <div
          style={{
            borderRight: isMobile ? 'none' : '1px solid var(--line)',
            display: isMobile && isMobileChatOpen ? 'none' : 'flex',
            flexDirection: 'column',
            background: 'var(--card)',
            minWidth: 0,
            width: '100%',
            flex: isMobile ? 1 : undefined,
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* Header & Search */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px' }}>
              <h2 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', fontSize: '20px', margin: 0 }}>
                💬 Customer Requests
              </h2>
              {(() => {
                const uCount = unreadCountForVendor(vendor?.username);
                return (
                  <span style={{ fontSize: '12px', color: uCount > 0 ? 'var(--gold)' : '#f8ebd8aa', fontWeight: 600 }}>
                    {uCount > 0 ? `${uCount} unread ${uCount === 1 ? 'conversation' : 'conversations'}` : 'All caught up'}
                  </span>
                );
              })()}
            </div>

            <input
              type="text"
              className="vedika-input"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: '#f8ebd8',
                fontFamily: 'inherit',
                fontSize: '13px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            />

            {/* Filter Chips - Task 2 active highlight rgba(234, 171, 80, 0.31) */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['all', 'unread', 'booked'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`filter-chip ${filterMode === mode ? 'active' : ''}`}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    fontFamily: 'inherit',
                    border: filterMode === mode ? '1px solid var(--gold)' : '1px solid var(--line)',
                    background: filterMode === mode ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                    color: filterMode === mode ? 'var(--vendor-btn-text, #f8ebd8)' : '#f8ebd8',
                    cursor: 'pointer'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Threads Scroll List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredThreads.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: '#f8ebd8aa', fontSize: '14px', fontFamily: 'inherit' }}>
                {threads.length === 0 ? 'No customer requests yet.' : 'No conversations found.'}
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = t.id === (selectedThreadId || activeThread?.id);
                const displayName = getCustomerRealName(t);
                const initial = (displayName || 'C')[0]?.toUpperCase() || '👤';
                const lastMsg = t.lastMessage || 'Plan inquiry received';
                const timeText = t.timestamp || 'Today';
                const unreadCount = t.unreadCount || (t.unread ? 1 : 0);

                return (
                  <div
                    key={t.id}
                    className={`customer-request-row thread-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedThreadId(t.id);
                      if (isMobile) {
                        setIsMobileChatOpen(true);
                      }
                    }}
                    onMouseEnter={() => setHoveredThreadId(t.id)}
                    onMouseLeave={() => setHoveredThreadId(null)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(234, 171, 80, 0.31)'
                        : (hoveredThreadId === t.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent'),
                      borderLeft: isSelected ? '4px solid var(--gold)' : '4px solid transparent',
                      transition: 'background 150ms ease, border-color 150ms ease',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    {/* Avatar circle with first letter */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isSelected ? 'rgba(234, 171, 80, 0.31)' : 'rgba(234, 171, 80, 0.18)',
                        color: 'var(--vendor-btn-text, #f8ebd8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                        flexShrink: 0,
                        border: isSelected ? '1px solid var(--gold)' : 'none'
                      }}
                    >
                      {initial}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8ebd8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                        </span>
                        <span style={{ fontSize: '11px', color: '#f8ebd8aa', marginLeft: '6px', flexShrink: 0 }}>
                          {timeText}
                        </span>
                      </div>

                      {t.branchName && (
                        <div style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          About: {t.branchName} ({t.branchType === 'caterer' || t.branchType === 'catering' ? 'Catering' : 'Hall'})
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#f8ebd8aa',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {lastMsg}
                        </span>
                        {unreadCount > 0 && (
                          <span
                            style={{
                              background: 'var(--gold)',
                              color: '#3A0A1E',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '999px',
                              flexShrink: 0
                            }}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Active Chat & Header */}
        <div
          style={{
            display: isMobile && !isMobileChatOpen ? 'none' : 'flex',
            flexDirection: 'column',
            background: 'var(--bg)',
            minWidth: 0,
            flex: 1,
            width: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {activeThread ? (
            <>
              {/* Chat Top Bar */}
              <div
                style={{
                  padding: '12px 20px',
                  background: 'var(--card)',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {/* Mobile Back Arrow (under 800px only) */}
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setIsMobileChatOpen(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: '#f8ebd8',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      aria-label="Back to conversations list"
                    >
                      ←
                    </button>
                  )}

                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(234, 171, 80, 0.31)',
                      color: 'var(--vendor-btn-text, #f8ebd8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '17px',
                      flexShrink: 0,
                      border: '2px solid var(--gold)'
                    }}
                  >
                    {(activeCustomerName || 'C')[0]?.toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8ebd8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeCustomerName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--leaf)', fontWeight: 500 }}>
                      ● Active customer · Booking via UstavOne
                    </div>
                  </div>
                </div>

                {/* Private In-App Call Button */}
                <button
                  type="button"
                  onClick={() => setIsCalling(true)}
                  aria-label="Call customer privately"
                  className="vedika-btn pulse-gold"
                  style={{
                    background: 'var(--gold)',
                    color: '#3A0A1E',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'inherit',
                    flexShrink: 0
                  }}
                >
                  <span>📞</span>
                  <span>Call (Private)</span>
                </button>
              </div>

              {/* Customer Plan Summary Card (if thread has plan context) */}
              {activeThread.planSummary && (
                <div
                  style={{
                    margin: '12px 20px 0',
                    padding: '12px 18px',
                    background: 'var(--card)',
                    borderRadius: '14px',
                    border: '1px solid var(--gold)',
                    boxShadow: '0 2px 8px rgba(232, 184, 74, 0.15)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div>
                    <strong style={{ color: '#f8ebd8' }}>📋 Customer Plan:</strong>{' '}
                    <span style={{ color: '#f8ebd8' }}>{activeThread.planSummary.event || 'Wedding'} · {activeThread.planSummary.date || 'Upcoming'} · {activeThread.planSummary.guests || 500} guests</span>
                  </div>
                  <div style={{ color: 'var(--leaf)', fontWeight: 600 }}>
                    Budget: ₹{(activeThread.planSummary.budget || 200000).toLocaleString('en-IN')}
                  </div>
                </div>
              )}

              {/* Messages Bubble Area with Day Separators */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxSizing: 'border-box'
                }}
              >
                {activeMessages.map((msg, idx) => {
                  const isVendor = msg.sender === 'vendor';
                  const isSystem = msg.sender === 'system';
                  const currentDay = getDayKey(msg.createdAt);
                  const prevDay = idx > 0 ? getDayKey(activeMessages[idx - 1].createdAt) : null;
                  const showDaySeparator = idx === 0 || currentDay !== prevDay;

                  return (
                    <React.Fragment key={msg.id || msg.clientId || idx}>
                      {showDaySeparator && (
                        <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#f8ebd8aa', background: 'rgba(0,0,0,0.2)', padding: '3px 12px', borderRadius: '999px', fontWeight: 500 }}>
                            {currentDay}
                          </span>
                        </div>
                      )}

                      {isSystem ? (
                        <div style={{ textAlign: 'center', margin: '8px 0' }}>
                          <span
                            style={{
                              background: 'var(--line)',
                              color: '#f8ebd8',
                              fontSize: '12px',
                              padding: '4px 14px',
                              borderRadius: '999px',
                              fontWeight: 500
                            }}
                          >
                            {msg.text}
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            alignSelf: isVendor ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isVendor ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: isVendor ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                              background: isVendor ? 'rgba(234, 171, 80, 0.31)' : 'var(--card)',
                              color: '#f8ebd8',
                              border: isVendor ? '1px solid rgba(232, 184, 74, 0.3)' : '1px solid var(--line)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                              fontSize: '14px',
                              lineHeight: 1.45,
                              wordBreak: 'break-word'
                            }}
                          >
                            {msg.text}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11px', color: '#f8ebd8aa' }}>
                            <span>{formatMessageTime(msg.createdAt, msg.timestamp)}</span>
                            {renderStatusTick(msg)}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Policy Warning Callout if guard tripped */}
              {guardWarning && (
                <div
                  role="alert"
                  style={{
                    margin: '0 20px 10px',
                    padding: '10px 14px',
                    background: '#FFEBEE',
                    borderRadius: '12px',
                    border: '1px solid #FFCDD2',
                    color: 'var(--rose)',
                    fontSize: '13px',
                    lineHeight: 1.4,
                    boxSizing: 'border-box'
                  }}
                >
                  ⚠️ <strong>Blocked:</strong> {guardWarning}
                </div>
              )}

              {/* Quick Replies Bar */}
              <div
                style={{
                  padding: '10px 20px',
                  background: 'var(--card)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  boxSizing: 'border-box'
                }}
              >
                {[
                  'Yes, the date is available',
                  'Please share your guest count',
                  'Our price for your plan is ready',
                  'We would be delighted to host your event!'
                ].map((reply, i) => (
                  <button
                    key={i}
                    type="button"
                    className="quick-reply-chip"
                    onClick={() => handleQuickReply(reply)}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: '#f8ebd8',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px 20px',
                  background: 'var(--card)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <input
                  type="text"
                  className="vedika-input"
                  placeholder="Type a message (personal contact details are blocked)…"
                  value={inputText}
                  onChange={e => {
                    setInputText(e.target.value);
                    if (guardWarning) setGuardWarning('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '999px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: '#f8ebd8',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />

                <button
                  type="submit"
                  aria-label="Send message"
                  className="vedika-btn"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(234, 171, 80, 0.31)',
                    color: 'var(--vendor-btn-text, #f8ebd8)',
                    border: '1px solid rgba(232, 184, 74, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0
                  }}
                >
                  ➤
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8ebd8', fontFamily: 'inherit', padding: '20px', textAlign: 'center' }}>
              No customer requests yet.
            </div>
          )}
        </div>
      </div>

      {/* PRIVATE CALL MODAL SCREEN */}
      {isCalling && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div
            className="vedika-card pop-in"
            style={{
              width: 'min(380px, 92vw)',
              background: 'var(--card)',
              color: '#FFE7B0',
              borderRadius: '28px',
              padding: '36px 24px',
              textAlign: 'center',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'var(--gold)',
                color: '#3A0A1E',
                fontSize: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                boxShadow: '0 0 0 8px rgba(232, 184, 74, 0.25)'
              }}
            >
              📞
            </div>

            <h3 style={{ fontFamily: 'Yatra One, serif', color: '#FFE7B0', margin: '0 0 6px', fontSize: '22px' }}>
              {activeCustomerName}
            </h3>

            <p style={{ color: '#FFE7B0cc', fontSize: '13px', margin: '0 0 16px' }}>
              🔒 Connecting you to the customer via UstavOne…
            </p>

            <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--gold)', marginBottom: '28px' }}>
              {formatCallTime(callDuration)}
            </div>

            <p style={{ fontSize: '11px', color: '#FFE7B099', margin: '0 0 28px' }}>
              Your private phone numbers are encrypted and protected by UstavOne Private Connect.
            </p>

            <button
              type="button"
              onClick={handleEndCall}
              className="vedika-btn"
              style={{
                background: 'var(--rose)',
                color: '#fff',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              End Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
