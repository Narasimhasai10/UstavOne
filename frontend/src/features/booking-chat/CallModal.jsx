import React, { useState, useEffect } from 'react';

/**
 * Masked In-App Voice Call Screen
 * Note: Production will use a masked-number provider such as Exotel, Twilio Voice Proxy,
 * or Agora WebRTC in-app calling.
 * Customer and vendor phone numbers are never exposed to each other.
 */
export default function CallModal({
  isOpen,
  vendor,
  onClose,
  onCallEnded
}) {
  const [callStage, setCallStage] = useState('ringing'); // 'ringing' | 'connected' | 'ended'
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Role label: "hall manager" | "catering manager" | "event manager"
  const roleLabel = vendor?.managerRole || (vendor?.type === 'hall' ? 'hall manager' : vendor?.type === 'caterer' ? 'catering manager' : 'event manager');

  useEffect(() => {
    if (isOpen && vendor) {
      setCallStage('ringing');
      setCallSeconds(0);
      setIsMuted(false);
      setIsSpeaker(false);

      // Transition to connected after 2.4 seconds
      const timer = setTimeout(() => {
        setCallStage('connected');
      }, 2400);

      return () => clearTimeout(timer);
    }
  }, [isOpen, vendor]);

  useEffect(() => {
    let interval = null;
    if (isOpen && callStage === 'connected') {
      interval = setInterval(() => {
        setCallSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, callStage]);

  if (!isOpen || !vendor) return null;

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleEnd = () => {
    const durationFormatted = formatTimer(callSeconds || 134); // Default 2:14 if ended fast
    setCallStage('ended');
    setTimeout(() => {
      onCallEnded(durationFormatted);
      onClose();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(27, 13, 20, 0.94)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        color: '#F8EBD8'
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Private in-app call"
    >
      <div style={{ textAlign: 'center', maxWidth: '380px', width: '100%' }}>
        {/* Pulsing Green Circle Animation */}
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'var(--leaf)',
            margin: '0 auto 20px',
            display: 'grid',
            placeItems: 'center',
            fontSize: '2.5rem',
            boxShadow: callStage === 'ringing' ? '0 0 0 16px rgba(47, 125, 91, 0.3)' : '0 0 0 8px rgba(47, 125, 91, 0.2)'
          }}
        >
          📞
        </div>

        <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.6rem', margin: '0 0 6px', color: '#FFE7B0' }}>
          {vendor.name}
        </h2>

        {callStage === 'ringing' ? (
          <p style={{ color: 'var(--gold)', fontSize: '0.95rem', margin: '0 0 16px' }}>
            Connecting you to the {roleLabel} via UstavOne…
          </p>
        ) : (
          <div style={{ color: 'var(--leaf)', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px' }}>
            Connected · {formatTimer(callSeconds)}
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 14px', margin: '16px 0 28px', fontSize: '0.85rem', color: '#FFE7B0' }}>
          🔒 Your number stays private. So does theirs.
        </div>

        {/* Buttons: Mute, Speaker, End call */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: isMuted ? 'var(--rose)' : 'transparent',
              color: '#fff',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
            title="Mute"
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>

          <button
            type="button"
            onClick={handleEnd}
            style={{
              padding: '12px 28px',
              borderRadius: '99px',
              border: 0,
              background: 'var(--rose)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(181, 23, 59, 0.4)'
            }}
          >
            End call
          </button>

          <button
            type="button"
            onClick={() => setIsSpeaker(!isSpeaker)}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: isSpeaker ? 'var(--gold)' : 'transparent',
              color: isSpeaker ? '#3A0A1E' : '#fff',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
            title="Speaker"
          >
            🔊
          </button>
        </div>
      </div>
    </div>
  );
}
