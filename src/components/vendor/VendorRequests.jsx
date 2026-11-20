import React, { useState, useEffect, useRef } from 'react';
import {
  getVendorChatThreads,
  addVendorChatMessage,
  addVendorWarning,
  getCurrentVendor
} from '../../services/store.js';
import { checkContactDetails } from '../../utils/contactGuard.js';
import { VENDOR_CONFIG } from '../../engine/config.js';

export default function VendorRequests({ vendor, initialThreadId }) {
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unread' | 'booked'

  // Chat message input
  const [inputText, setInputText] = useState('');
  const [guardWarning, setGuardWarning] = useState('');
  const [currentWarningsCount, setCurrentWarningsCount] = useState(vendor?.warnings || 0);

  // Private Call Modal state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Mobile navigation
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // Reload threads
  const reloadThreads = () => {
    if (vendor?.username) {
      const list = getVendorChatThreads(vendor.username);
      setThreads(list);
      if (!selectedThreadId && list.length > 0) {
        setSelectedThreadId(list[0].id);
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
        setIsMobileChatOpen(true);
      }
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadId, threads]);

  // Active Thread
  const activeThread = threads.find(t => t.id === selectedThreadId) || threads[0];

  // Filtered threads list
  const filteredThreads = threads.filter(t => {
    if (filterMode === 'unread' && !t.unread) return false;
    if (filterMode === 'booked' && !t.isBooked) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (t.customerFirstName || t.customerName || '').toLowerCase().includes(q);
      const matchMsg = (t.lastMessage || '').toLowerCase().includes(q);
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

  const handleEndCall = () => {
    setIsCalling(false);
    if (activeThread && vendor?.username) {
      // Append call log to chat
      addVendorChatMessage(vendor.username, activeThread.id, {
        sender: 'system',
        text: `📞 In-app call ended (${formatCallTime(callDuration || 124)})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      reloadThreads();
    }
  };

  // Quick reply
  const handleQuickReply = (text) => {
    setInputText(text);
  };

  // Send message with Contact Guard
  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !activeThread || !vendor?.username) return;

    // Contact Guard check
    const guardResult = checkContactDetails(text);
    if (guardResult.blocked) {
      // Record violation
      const updatedWarnings = addVendorWarning(vendor.username, `Attempted contact leak: ${guardResult.reason}`);
      setCurrentWarningsCount(updatedWarnings);
      setGuardWarning(
        `Sharing personal contact details is not allowed in Vedika and can lead to a suspension. (Warning ${updatedWarnings} of ${VENDOR_CONFIG.warningLimit})`
      );
      return;
    }

    setGuardWarning('');
    const newMsg = {
      sender: 'vendor',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      delivered: true,
      read: true
    };

    addVendorChatMessage(vendor.username, activeThread.id, newMsg);
    setInputText('');
    reloadThreads();
  };

  return (
    <div
      className="vedika-vendor-page fade-in"
      style={{
        padding: '16px',
        maxWidth: '1100px',
        margin: '0 auto',
        height: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column'
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

      {/* Main 2-Pane Chat Container */}
      <div
        className="vedika-card"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isMobileChatOpen ? '1fr' : 'minmax(300px, 340px) 1fr',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}
      >
        {/* LEFT PANE: Conversations List */}
        <div
          style={{
            borderRight: '1px solid var(--line)',
            display: isMobileChatOpen ? 'none' : 'flex',
            flexDirection: 'column',
            background: 'var(--card)',
            minWidth: '300px',
            overflow: 'hidden'
          }}
        >
          {/* Header & Search */}
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontFamily: 'Yatra One, serif', color: 'var(--text)', fontSize: '20px', margin: '0 0 12px' }}>
              💬 Customer Requests
            </h2>

            <input
              type="text"
              className="vedika-input"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                fontSize: '13px',
                marginBottom: '10px'
              }}
            />

            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'unread', 'booked'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: filterMode === mode ? '1px solid var(--ink)' : '1px solid var(--line)',
                    background: filterMode === mode ? 'var(--ink)' : 'transparent',
                    color: filterMode === mode ? '#FFE7B0' : 'var(--muted)',
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
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                No conversations found.
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = t.id === selectedThreadId;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedThreadId(t.id);
                      setIsMobileChatOpen(true);
                    }}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--gold)' : '4px solid transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                        {t.customerEmoji || '👤'} {t.customerFirstName || 'Customer'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {t.timestamp || 'Today'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'var(--muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '200px'
                        }}
                      >
                        {t.lastMessage || 'Plan inquiry received'}
                      </span>
                      {t.unread && (
                        <span
                          style={{
                            background: 'var(--gold)',
                            color: 'var(--ink)',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '999px'
                          }}
                        >
                          New
                        </span>
                      )}
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
            display: !isMobileChatOpen && window.innerWidth < 768 ? 'none' : 'flex',
            flexDirection: 'column',
            background: 'var(--bg)'
          }}
        >
          {activeThread ? (
            <>
              {/* Chat Top Bar */}
              <div
                style={{
                  padding: '12px 18px',
                  background: 'var(--card)',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Mobile Back Arrow */}
                  <button
                    type="button"
                    onClick={() => setIsMobileChatOpen(false)}
                    style={{
                      display: window.innerWidth < 768 ? 'inline-block' : 'none',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px 8px'
                    }}
                  >
                    ←
                  </button>

                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--ink)',
                      color: '#FFE7B0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '16px'
                    }}
                  >
                    {(activeThread.customerFirstName || 'C')[0]}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
                      {activeThread.customerFirstName || 'Customer'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--leaf)', fontWeight: 500 }}>
                      ● Active customer · Booking via Vedika
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
                    gap: '6px'
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
                    margin: '12px 16px 0',
                    padding: '12px 16px',
                    background: 'var(--card)',
                    borderRadius: '14px',
                    border: '1px solid var(--gold)',
                    boxShadow: '0 2px 8px rgba(232, 184, 74, 0.15)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '13px'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text)' }}>📋 Customer Plan:</strong>{' '}
                    <span>{activeThread.planSummary.event || 'Wedding'} · {activeThread.planSummary.date || 'Upcoming'} · {activeThread.planSummary.guests || 500} guests</span>
                  </div>
                  <div style={{ color: 'var(--leaf)', fontWeight: 600 }}>
                    Budget: ₹{(activeThread.planSummary.budget || 200000).toLocaleString('en-IN')}
                  </div>
                </div>
              )}

              {/* Messages Bubble Area */}
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
                {(activeThread.messages || []).map((msg, idx) => {
                  const isVendor = msg.sender === 'vendor';
                  const isSystem = msg.sender === 'system';

                  if (isSystem) {
                    return (
                      <div key={idx} style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span
                          style={{
                            background: 'var(--line)',
                            color: 'var(--text)',
                            fontSize: '12px',
                            padding: '4px 14px',
                            borderRadius: '999px',
                            fontWeight: 500
                          }}
                        >
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
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
                          background: isVendor ? 'var(--acc)' : 'var(--card)',
                          color: isVendor ? '#fff' : 'var(--text)',
                          border: isVendor ? 'none' : '1px solid var(--line)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                          fontSize: '14px',
                          lineHeight: 1.45,
                          wordBreak: 'break-word'
                        }}
                      >
                        {msg.text}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11px', color: 'var(--muted)' }}>
                        <span>{msg.timestamp || '10:30 AM'}</span>
                        {isVendor && <span>✓✓</span>}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Policy Warning Callout if guard tripped */}
              {guardWarning && (
                <div
                  role="alert"
                  style={{
                    margin: '0 16px 10px',
                    padding: '10px 14px',
                    background: '#FFEBEE',
                    borderRadius: '12px',
                    border: '1px solid #FFCDD2',
                    color: 'var(--rose)',
                    fontSize: '13px',
                    lineHeight: 1.4
                  }}
                >
                  ⚠️ <strong>Blocked:</strong> {guardWarning}
                </div>
              )}

              {/* Quick Replies Bar */}
              <div
                style={{
                  padding: '8px 16px',
                  background: 'var(--card)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap'
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
                    onClick={() => handleQuickReply(reply)}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      cursor: 'pointer'
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
                  padding: '12px 16px',
                  background: 'var(--card)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center'
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
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '999px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    fontSize: '14px'
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
                    background: 'var(--ink)',
                    color: '#FFE7B0',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  ➤
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              Select a conversation to start chatting.
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
              background: 'var(--ink)',
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
                color: 'var(--ink)',
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
              {activeThread?.customerFirstName || 'Customer'}
            </h3>

            <p style={{ color: '#FFE7B0cc', fontSize: '13px', margin: '0 0 16px' }}>
              🔒 Connecting you to the customer via Vedika…
            </p>

            <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--gold)', marginBottom: '28px' }}>
              {formatCallTime(callDuration)}
            </div>

            <p style={{ fontSize: '11px', color: '#FFE7B099', margin: '0 0 28px' }}>
              Your private phone numbers are encrypted and protected by Vedika Private Connect.
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
                cursor: 'pointer'
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
