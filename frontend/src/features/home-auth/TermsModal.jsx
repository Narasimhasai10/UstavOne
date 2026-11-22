import React, { useEffect } from 'react';

export default function TermsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card terms-modal-card"
        style={{
          width: 'min(460px, 92vw)',
          maxHeight: '80vh',
          background: 'var(--card)',
          color: 'var(--text)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
          border: '1.5px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'popIn 0.3s cubic-bezier(0.2, 1.2, 0.4, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
          <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.3rem', margin: 0, color: 'var(--ink)' }}>
            UstavOne Vendor Terms and Conditions
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.6rem',
              cursor: 'pointer',
              color: 'var(--muted)',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', fontSize: '0.88rem', lineHeight: '1.6' }}>
          <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
            <li>
              All bookings and payments must happen through UstavOne. Do not take customers off the app.
            </li>
            <li>
              <strong>Do not share your personal contact details</strong> (phone number, WhatsApp, email, social media or UPI ID) with customers in chats, calls, photos or documents. Sharing personal contact violates these terms, and you will face the consequences: a warning, suspension of your listings, withheld payouts and permanent removal from UstavOne. Commission is still charged on any booking taken outside the app.
            </li>
            <li>
              Upload only genuine documents and your own work photos. Fake documents or photos lead to a permanent ban and possible legal action.
            </li>
            <li>
              Keep your prices, capacity, availability and details accurate.
            </li>
            <li>
              Honour every confirmed booking. Repeated vendor cancellations reduce your rating and visibility, and refunds to the customer are your responsibility.
            </li>
            <li>
              UstavOne charges a 10% commission on each completed booking. Payouts are sent after the event is completed.
            </li>
            <li>
              Reviews must be real. Buying, faking or removing reviews is not allowed.
            </li>
            <li>
              Caterers must follow food-safety rules and keep a valid FSSAI licence. Halls must follow fire and safety rules.
            </li>
            <li>
              Treat customers with respect. Customer data may only be used for the booking.
            </li>
            <li>
              UstavOne may suspend or remove an account that breaks these terms.
            </li>
          </ol>
          <p style={{ marginTop: '18px', fontSize: '0.76rem', color: 'var(--muted)', fontStyle: 'italic', borderTop: '1px dashed var(--line)', paddingTop: '10px' }}>
            Demo text. Have a lawyer review before launch.
          </p>
        </div>

        {/* Footer Action */}
        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="pill g"
            onClick={onClose}
            style={{ minHeight: '40px', padding: '8px 24px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
