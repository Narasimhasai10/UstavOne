import React, { useState, useEffect, useRef } from 'react';
import { getChatMessages, addChatMessage, addVoiceCallLog, isLive } from '../../shared/data-service/index.js';
import { CHAT_TRANSPORT } from '../dashboard-plan/engine/config.js';
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  markRead,
  subscribeChat
} from './chatStore.js';
import api from '../../shared/api/client.js';
import chatSocket from './chatSocket.js';
import { containsContactInfo } from '../../shared/utils/contactGuard.js';
import { resolvePhotoUrls } from '../../shared/utils/photos.js';
import SafeImage from '../../shared/components/SafeImage.jsx';
import CallModal from './CallModal.jsx';

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

export default function ChatScreen({
  user,
  vendor,
  onBack,
  onOpenBook
}) {
  if (!vendor) return null;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [contactWarning, setContactWarning] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isDemoListing, setIsDemoListing] = useState(false);
  const [vendorCoverPhoto, setVendorCoverPhoto] = useState(null);
  const messagesEndRef = useRef(null);

  // Resolve vendor cover photo if available
  useEffect(() => {
    let isMounted = true;
    const photos = vendor.photos || [];
    if (Array.isArray(photos) && photos.length > 0) {
      resolvePhotoUrls(photos).then(resolved => {
        if (isMounted) {
          const cover = resolved.find(p => p.isCover) || resolved[0];
          if (cover?.url) setVendorCoverPhoto(cover.url);
        }
      });
    } else if (vendor.photoUrl || vendor.photo || vendor.image) {
      const p = vendor.photoUrl || vendor.photo || vendor.image;
      if (typeof p === 'string' && (p.startsWith('data:') || p.startsWith('http') || p.startsWith('/'))) {
        setVendorCoverPhoto(p);
      } else {
        resolvePhotoUrls([p]).then(res => {
          if (isMounted && res[0]?.url) setVendorCoverPhoto(res[0].url);
        });
      }
    }
    return () => { isMounted = false; };
  }, [vendor]);

  // Format server message to UI structure
  const formatServerMsg = (m) => ({
    id: m.id,
    clientId: m.clientId || null,
    sender: m.senderRole === 'user' || m.sender === 'customer' || m.sender === 'user' ? 'user' : (m.senderRole === 'system' || m.sender === 'system' ? 'system' : 'vendor'),
    text: m.body || m.text,
    status: m.status || 'sent',
    createdAt: m.createdAt || new Date().toISOString(),
    timestamp: formatMessageTime(m.createdAt, m.timestamp),
    isCallLog: m.type === 'call_log' || m.isCallLog || m.text?.startsWith('📞') || false
  });

  // Load message history & setup real-time listeners
  useEffect(() => {
    let isMounted = true;
    let unsubMsg = null;
    let unsubRead = null;
    let unsubChatStore = null;
    let currentConvoId = null;

    if (CHAT_TRANSPORT === 'local') {
      const conv = getOrCreateConversation(user, vendor);
      currentConvoId = conv.id;
      if (isMounted) {
        setConversationId(conv.id);
        setIsDemoListing(!conv.vendorUsername);
        const initialMsgs = getMessages(conv.id).map(formatServerMsg);
        setMessages(initialMsgs);
        markRead(conv.id, 'customer');
      }

      unsubChatStore = subscribeChat((detail) => {
        if (!isMounted) return;
        if (!detail || !detail.conversationId || detail.conversationId === conv.id) {
          const fresh = getMessages(conv.id).map(formatServerMsg);
          setMessages(fresh);
          markRead(conv.id, 'customer');
        }
      });

      return () => {
        isMounted = false;
        if (unsubChatStore) unsubChatStore();
      };
    }

    if (isLive()) {
      // 1. LIVE MODE: Connect to backend API & Socket.IO
      const branchKey = vendor.branchId || vendor.id;
      api.chat.start(branchKey)
        .then(res => {
          if (!isMounted) return;
          const convoId = res?.data?.id || res?.id;
          currentConvoId = convoId;
          setConversationId(convoId);
          chatSocket.join(convoId);

          return api.chat.messages(convoId);
        })
        .then(msgRes => {
          if (!isMounted) return;
          const list = msgRes?.data || (Array.isArray(msgRes) ? msgRes : []);
          setMessages(list.map(formatServerMsg));

          if (currentConvoId) {
            api.chat.markRead(currentConvoId).catch(() => {});
          }
        })
        .catch(err => {
          console.warn('[ChatScreen] Live conversation init failed, falling back to mock:', err);
          if (isMounted) {
            getChatMessages(vendor.id).then(list => {
              if (isMounted) setMessages(list || []);
            });
          }
        });

      // Socket.IO message handler
      unsubMsg = chatSocket.onMessage((incoming) => {
        if (!isMounted) return;
        setMessages(prev => {
          // If this message belongs to the current conversation
          if (currentConvoId && incoming.conversationId && incoming.conversationId !== currentConvoId) {
            return prev;
          }

          // Replace optimistic message with server echo
          if (incoming.clientId && prev.some(m => m.clientId === incoming.clientId)) {
            return prev.map(m => m.clientId === incoming.clientId ? formatServerMsg(incoming) : m);
          }

          // If message already exists by ID, update it
          if (prev.some(m => m.id === incoming.id)) {
            return prev.map(m => m.id === incoming.id ? formatServerMsg(incoming) : m);
          }

          return [...prev, formatServerMsg(incoming)];
        });

        // Mark incoming vendor messages as read
        if (incoming.senderRole !== 'user' && currentConvoId) {
          api.chat.markRead(currentConvoId).catch(() => {});
        }
      });

      // Socket.IO read receipts handler (blue ticks)
      unsubRead = chatSocket.onMessagesRead((readData) => {
        if (!isMounted) return;
        if (currentConvoId && readData.conversationId === currentConvoId) {
          setMessages(prev => prev.map(m => m.sender === 'user' ? { ...m, status: 'read' } : m));
        }
      });

    } else {
      // 2. MOCK MODE: Local store with storage event cross-tab synchronization
      getChatMessages(vendor.id).then(list => {
        if (!isMounted) return;
        setMessages(Array.isArray(list) ? list : []);
      }).catch(err => {
        console.warn('[ChatScreen] Failed to load mock messages:', err);
      });

      const handleStorage = (e) => {
        if (e.key === `utsavora_chat_${vendor.id}` || e.key === `vedika_chat_${vendor.id}` || e.key?.startsWith('utsavora_vendor_chats_') || e.key?.startsWith('vedika_vendor_chats_')) {
          getChatMessages(vendor.id).then(msgs => {
            if (isMounted && Array.isArray(msgs) && msgs.length > 0) {
              setMessages(msgs);
            }
          });
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        isMounted = false;
        window.removeEventListener('storage', handleStorage);
      };
    }

    return () => {
      isMounted = false;
      if (unsubMsg) unsubMsg();
      if (unsubRead) unsubRead();
      if (currentConvoId) chatSocket.leave(currentConvoId);
    };
  }, [vendor.id, vendor.name, vendor.branchId, user?.phone]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend, explicitClientId = null) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    // Contact sharing guard check (client-side)
    const check = containsContactInfo(text);
    if (check.blocked) {
      setContactWarning('⚠️ Sharing personal contact details is not allowed in Utsavora and can lead to a suspension.');
      return;
    }
    setContactWarning('');

    const clientId = explicitClientId || ('c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistic UI update (shows 🕒 sending)
    const userMsg = {
      id: clientId,
      clientId,
      sender: 'user',
      text,
      timestamp: timeFormatted,
      status: 'sending',
      createdAt: now.toISOString()
    };

    setMessages(prev => {
      if (explicitClientId && prev.some(m => m.clientId === explicitClientId || m.id === explicitClientId)) {
        return prev.map(m => (m.clientId === explicitClientId || m.id === explicitClientId) ? userMsg : m);
      }
      return [...prev, userMsg];
    });
    if (!textToSend) setInputText('');

    if (CHAT_TRANSPORT === 'local') {
      try {
        const convoId = conversationId || getOrCreateConversation(user, vendor).id;
        const res = sendMessage(convoId, 'customer', text, clientId);
        setMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return {
              ...m,
              id: res.message.id || m.id,
              status: res.message.status || 'sent',
              createdAt: res.message.createdAt || m.createdAt
            };
          }
          return m;
        }));
      } catch (err) {
        setMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return { ...m, status: 'failed' };
          }
          return m;
        }));
        if (err && (err.message?.includes('Storage is full') || err.message?.includes('quota'))) {
          setContactWarning('⚠️ Storage is full, please free space');
        } else {
          setContactWarning(err?.message || 'Failed to send message.');
        }
      }
      return;
    }

    if (isLive() && conversationId) {
      try {
        const res = await api.chat.sendMessage(conversationId, text, clientId);
        const saved = res?.data || res;
        setMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return {
              ...m,
              id: saved.id || m.id,
              status: saved.status || 'sent', // single tick ✓
              createdAt: saved.createdAt || m.createdAt
            };
          }
          return m;
        }));
      } catch (err) {
        setMessages(prev => prev.map(m => {
          if (m.clientId === clientId || m.id === clientId) {
            return { ...m, status: 'failed' };
          }
          return m;
        }));
        if (err.status === 422 || err.code === 'CONTACT_SHARING_BLOCKED' || err.message?.includes('contact')) {
          setContactWarning('⚠️ Sharing personal contact details is not allowed in Utsavora and can lead to a suspension.');
        } else {
          setContactWarning(err.message || 'Failed to send message.');
        }
      }
    } else {
      // Mock mode fallback
      try {
        const updated = await addChatMessage(vendor.id, {
          id: clientId,
          clientId,
          sender: 'user',
          text,
          timestamp: timeFormatted,
          status: 'sent',
          createdAt: now.toISOString()
        });
        if (Array.isArray(updated)) {
          setMessages(updated);
        } else {
          setMessages(prev => prev.map(m => m.id === clientId ? { ...m, status: 'sent' } : m));
        }
      } catch {
        setMessages(prev => prev.map(m => m.id === clientId ? { ...m, status: 'failed' } : m));
      }
    }
  };

  const handleRetrySend = (failedMsg) => {
    handleSendMessage(failedMsg.text, failedMsg.clientId);
  };

  const handleCallEnded = async (durationFormatted) => {
    const logItem = {
      id: 'call_' + Date.now(),
      sender: 'system',
      text: `📞 Voice call · ${durationFormatted}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      isCallLog: true
    };

    if (CHAT_TRANSPORT === 'local') {
      try {
        const convoId = conversationId || getOrCreateConversation(user, vendor).id;
        sendMessage(convoId, 'system', logItem.text);
        const fresh = getMessages(convoId).map(formatServerMsg);
        setMessages(fresh);
      } catch {}
      return;
    }

    if (isLive() && conversationId) {
      try {
        await api.chat.sendMessage(conversationId, logItem.text);
      } catch {}
    } else {
      const updated = await addVoiceCallLog(vendor.id, durationFormatted);
      if (Array.isArray(updated)) {
        setMessages(updated);
      }
    }
  };

  const renderStatusTick = (msg) => {
    if (msg.sender !== 'user') return null;
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
    // Default 'sent' (server saved)
    return <span title="Sent" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.75rem' }}>✓</span>;
  };

  const quickReplies = [
    'Is my date available?',
    'What is the price?',
    'Can I visit?'
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)'
      }}
    >
      <div
        className="wrap"
        style={{
          flex: 1,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: 'var(--card)',
          borderLeft: '1px solid var(--line)',
          borderRight: '1px solid var(--line)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        {/* Top Bar: Back arrow, round avatar, ONLY name and status, 📞 call icon */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--card)',
            borderBottom: '1.5px solid var(--line)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer', color: '#f8ebd8' }}
            aria-label="Back"
          >
            ←
          </button>

          {vendorCoverPhoto ? (
            <SafeImage
              src={vendorCoverPhoto}
              alt={vendor.name}
              kind={vendor?.kind === 'catering' ? 'catering' : 'hall'}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid var(--line)',
                flexShrink: 0
              }}
            />
          ) : (
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: vendor.gradient || 'linear-gradient(135deg, var(--ink2), var(--acc))',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}
            >
              {vendor.type === 'caterer' ? '🍽️' : '🏛️'}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {vendor.name}
            </h2>
            <div style={{ fontSize: '0.8rem', color: isTyping ? 'var(--rose)' : 'var(--leaf)', fontWeight: 500 }}>
              {isTyping ? 'typing…' : 'online'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCallOpen(true)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '1.5px solid var(--leaf)',
              background: 'color-mix(in srgb, var(--leaf) 12%, transparent)',
              color: 'var(--leaf)',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
            title="Private call"
            aria-label="Call manager"
          >
            📞
          </button>
        </header>

        {/* Messages Scroll Area with Subtle Wallpaper & Privacy Note */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Privacy reassurance note */}
          <div style={{ textAlign: 'center', margin: '6px 0 12px' }}>
            <span style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: '0.82rem', padding: '6px 14px', borderRadius: '99px' }}>
              🔒 Chats and calls stay inside Utsavora. Phone numbers are never shared.
            </span>
          </div>

          {/* Demo listing notice */}
          {isDemoListing && (
            <div style={{ textAlign: 'center', margin: '0 0 10px' }}>
              <span style={{ background: 'rgba(234, 171, 80, 0.15)', border: '1px dashed var(--gold)', color: '#f8ebd8', fontSize: '0.82rem', padding: '6px 14px', borderRadius: '99px', display: 'inline-block' }}>
                ℹ️ This listing is a demo and has no vendor account yet.
              </span>
            </div>
          )}

          {/* Empty state hint */}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', padding: '30px 16px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👋</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8ebd8' }}>
                Say hello to {vendor.name}
              </div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Ask about availability, packages, pricing, or custom requests.
              </div>
            </div>
          )}

          {/* Message Bubbles with Day Separators */}
          {messages.map((m, idx) => {
            const isUser = m.sender === 'user';
            const currentDay = getDayKey(m.createdAt);
            const prevDay = idx > 0 ? getDayKey(messages[idx - 1].createdAt) : null;
            const showDaySeparator = idx === 0 || currentDay !== prevDay;

            return (
              <React.Fragment key={m.id || m.clientId || idx}>
                {showDaySeparator && (
                  <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#f8ebd8aa', background: 'rgba(0,0,0,0.2)', padding: '3px 12px', borderRadius: '999px', fontWeight: 500 }}>
                      {currentDay}
                    </span>
                  </div>
                )}

                {m.isCallLog ? (
                  <div style={{ textAlign: 'center', margin: '8px 0' }}>
                    <span style={{ background: 'color-mix(in srgb, var(--gold) 20%, var(--card))', border: '1px solid var(--gold)', color: '#f8ebd8', fontSize: '0.82rem', padding: '4px 12px', borderRadius: '99px', fontWeight: 600 }}>
                      {m.text}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        background: isUser ? 'color-mix(in srgb, var(--gold) 28%, var(--card))' : 'var(--card)',
                        color: '#f8ebd8',
                        border: isUser ? '1px solid rgba(232, 184, 74, 0.3)' : '1px solid var(--line)',
                        padding: '9px 14px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                        fontSize: '0.94rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word'
                      }}
                    >
                      {m.text}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        color: '#f8ebd8aa',
                        marginTop: '2px',
                        alignSelf: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <span>{formatMessageTime(m.createdAt, m.timestamp)}</span>
                      {renderStatusTick(m)}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {isTyping && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--card)', border: '1px solid var(--line)', padding: '8px 14px', borderRadius: '16px', fontSize: '0.88rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              typing…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick-Reply Chips */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', overflowX: 'auto', background: 'var(--card)', borderTop: '1px solid var(--line)' }}>
          {quickReplies.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              style={{
                padding: '6px 12px',
                borderRadius: '99px',
                border: '1.5px solid var(--line)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '0.82rem',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Inline Contact Guard Warning */}
        {contactWarning && (
          <div style={{ color: '#FF5C8A', fontSize: '0.82rem', padding: '8px 16px', background: 'rgba(255, 92, 138, 0.12)', borderTop: '1px solid rgba(255, 92, 138, 0.25)', fontWeight: 600 }}>
            {contactWarning}
          </div>
        )}

        {/* Bottom Input Bar */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '10px 16px',
            background: 'var(--card)',
            borderTop: '1px solid var(--line)'
          }}
        >
          <input
            type="text"
            value={inputText}
            placeholder="Type a message…"
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '99px',
              border: '1.5px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '0.92rem'
            }}
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 0,
              background: 'var(--ink)',
              color: '#FFE7B0',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Masked Call Modal */}
      <CallModal
        isOpen={isCallOpen}
        vendor={vendor}
        onClose={() => setIsCallOpen(false)}
        onCallEnded={handleCallEnded}
      />
    </div>
  );
}
