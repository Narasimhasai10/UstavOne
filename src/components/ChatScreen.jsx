import React, { useState, useEffect, useRef } from 'react';
import { getChatMessages, addChatMessage, addVoiceCallLog } from '../services/store.js';
import CallModal from './CallModal.jsx';

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
  const messagesEndRef = useRef(null);

  // Load message history from localStorage
  useEffect(() => {
    const list = getChatMessages(vendor.id);
    if (list.length === 0) {
      // Seed initial welcoming message
      const initial = [
        {
          id: 'm1',
          sender: 'vendor',
          text: `Namaskaram! Welcome to ${vendor.name}. How can we assist you with your celebration?`,
          timestamp: '10:00 AM'
        }
      ];
      setMessages(initial);
    } else {
      setMessages(list);
    }
  }, [vendor.id, vendor.name]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text,
      timestamp: timeNow,
      status: 'read' // ✓✓ read
    };

    const updated = addChatMessage(vendor.id, userMsg);
    setMessages(updated);
    setInputText('');

    // Trigger typing indicator and auto-reply
    setIsTyping(true);
    setTimeout(() => {
      let replyText = 'Thank you for your inquiry. Our manager will be happy to assist and customize options for your dates.';
      const lower = text.toLowerCase();
      if (lower.includes('date') || lower.includes('available')) {
        replyText = `Yes! We are currently confirming auspicious dates for the upcoming season. Which date are you planning?`;
      } else if (lower.includes('price') || lower.includes('cost')) {
        replyText = `Our pricing is transparent: standard package begins at the rate shown in your plan with all taxes included.`;
      } else if (lower.includes('visit')) {
        replyText = `You are welcome to visit our venue between 10 AM and 6 PM any day. Would tomorrow work for you?`;
      }

      const vendorReply = {
        id: 'vnd_' + Date.now(),
        sender: 'vendor',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setIsTyping(false);
      const afterReply = addChatMessage(vendor.id, vendorReply);
      setMessages(afterReply);
    }, 1500);
  };

  const handleCallEnded = (durationFormatted) => {
    const updated = addVoiceCallLog(vendor.id, durationFormatted);
    setMessages(updated);
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
          style={{ background: 'transparent', border: 0, fontSize: '1.4rem', cursor: 'pointer', color: 'var(--ink)' }}
          aria-label="Back"
        >
          ←
        </button>

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
            🔒 Chats and calls stay inside Vedika. Phone numbers are never shared.
          </span>
        </div>

        <div style={{ textAlign: 'center', margin: '4px 0' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', background: '#0000000d', padding: '2px 10px', borderRadius: '6px' }}>
            Today
          </span>
        </div>

        {/* Message Bubbles */}
        {messages.map((m, idx) => {
          if (m.isCallLog) {
            return (
              <div key={idx} style={{ textAlign: 'center', margin: '8px 0' }}>
                <span style={{ background: 'color-mix(in srgb, var(--gold) 20%, var(--card))', border: '1px solid var(--gold)', color: 'var(--ink)', fontSize: '0.82rem', padding: '4px 12px', borderRadius: '99px', fontWeight: 600 }}>
                  {m.text}
                </span>
              </div>
            );
          }

          const isUser = m.sender === 'user';
          return (
            <div
              key={idx}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div
                style={{
                  background: isUser ? 'var(--acc)' : 'var(--card)',
                  color: isUser ? '#2B1D2F' : 'var(--text)',
                  border: isUser ? 0 : '1px solid var(--line)',
                  padding: '9px 14px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                  fontSize: '0.94rem',
                  lineHeight: 1.45
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
                  color: 'var(--muted)',
                  marginTop: '2px',
                  alignSelf: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                <span>{m.timestamp}</span>
                {isUser && <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>✓✓</span>}
              </div>
            </div>
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
            if (e.key === 'Enter') handleSendMessage();
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
