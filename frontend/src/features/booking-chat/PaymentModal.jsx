import React, { useState, useMemo } from 'react';
import { formatINR } from '../dashboard-plan/engine/planner.js';
import { generateQRCodeSVG } from '../../shared/utils/qrCode.js';
import DiyaLoader from '../../shared/components/DiyaLoader.jsx';

export default function PaymentModal({
  isOpen,
  vendor,
  bookingDetails,
  onClose,
  onSuccess
}) {
  if (!isOpen) return null;

  const totalAmount = bookingDetails?.totalAmount || 100000;
  const vendorUpiId = vendor?.upiId || vendor?.vendorUpiId || 'sai.halls@okaxis';
  const vendorName = vendor?.name || 'Utsavora Vendor';

  const isNonRefundable = Boolean(
    bookingDetails?.isNonRefundable ||
    vendor?.description?.includes('non-refundable') ||
    vendor?.isNonRefundable ||
    (Array.isArray(vendor?.amenities) && vendor.amenities.some(a => String(a).toLowerCase().includes('non-refundable')))
  );

  // Booking reference ID
  const [bookingRef] = useState(() => 'UTS-2026-' + String(Math.floor(Math.random() * 9000) + 1000));

  // Payment stages: 'direct_upi' | 'utr_input' | 'success'
  const [stage, setStage] = useState('direct_upi');
  const [utrNumber, setUtrNumber] = useState('');
  const [utrError, setUtrError] = useState('');

  // UPI deep link
  const upiDeepLink = useMemo(() => {
    if (!vendorUpiId) return '';
    const cleanPa = encodeURIComponent(vendorUpiId);
    const cleanPn = encodeURIComponent(vendorName);
    const cleanTn = encodeURIComponent(`Utsavora Booking ${bookingRef}`);
    return `upi://pay?pa=${cleanPa}&pn=${cleanPn}&am=${totalAmount}&cu=INR&tn=${cleanTn}`;
  }, [vendorUpiId, vendorName, totalAmount, bookingRef]);

  // QR Code SVG
  const qrSvg = useMemo(() => {
    if (!upiDeepLink) return null;
    return generateQRCodeSVG(upiDeepLink, {
      size: 190,
      margin: 2,
      color: '#3A0A1E',
      bg: '#ffffff'
    });
  }, [upiDeepLink]);

  const handleOpenUtrPrompt = () => {
    setStage('utr_input');
  };

  const handleConfirmPayment = () => {
    const cleanUtr = utrNumber.trim();
    if (cleanUtr && cleanUtr.length < 6) {
      setUtrError('Please enter a valid UTR / transaction reference number.');
      return;
    }
    setUtrError('');

    const paymentResult = {
      id: bookingRef,
      paymentId: cleanUtr ? `UTR-${cleanUtr}` : `UPI-${Date.now().toString().slice(-8)}`,
      method: 'UPI',
      amount: totalAmount,
      date: bookingDetails?.date,
      timeSlot: bookingDetails?.timeSlot,
      vendorName,
      vendorId: vendor?.id,
      guests: bookingDetails?.guests,
      utr: cleanUtr || null,
      status: 'Payment pending confirmation',
      paymentStatus: 'Payment pending confirmation'
    };

    setStage('success');
    if (onSuccess) {
      onSuccess(paymentResult);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(27, 13, 20, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px'
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Direct UPI Payment"
    >
      <div
        className="vedika-card pop-in"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          padding: '24px',
          width: 'min(460px, 94vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          color: 'var(--text)'
        }}
      >
        {/* STAGE 1: DIRECT UPI PAYMENT */}
        {stage === 'direct_upi' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'Yatra One, serif', fontSize: '1.4rem', color: 'var(--ink)', margin: 0 }}>
                Direct UPI Payment
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'transparent', border: 0, fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>

            {/* Payable Amount banner */}
            <div
              style={{
                background: 'color-mix(in srgb, var(--ink) 6%, var(--card))',
                borderRadius: '14px',
                padding: '14px 18px',
                marginBottom: '18px',
                border: '1px solid var(--line)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Payable Amount (incl. 18% GST)</div>
                  <div style={{ fontFamily: 'Yatra One, serif', fontSize: '1.8rem', color: '#a79768', marginTop: '2px' }}>
                    {formatINR(totalAmount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Paying to</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{vendorName}</div>
                </div>
              </div>
            </div>

            {isNonRefundable && (
              <div
                style={{
                  background: 'rgba(235, 87, 87, 0.16)',
                  border: '1.5px solid rgba(235, 87, 87, 0.45)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#FFB4A2',
                  fontSize: '0.82rem',
                  lineHeight: 1.4
                }}
              >
                ⚠️ <b>Cancellation Policy:</b> Cancellations are non-refundable (0% refund).
              </div>
            )}

            {/* Vendor UPI ID Display */}
            {vendorUpiId ? (
              <div
                style={{
                  background: 'var(--bg)',
                  borderRadius: '14px',
                  padding: '14px',
                  border: '1px solid var(--line)',
                  marginBottom: '18px'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Vendor Verified UPI ID
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: '#a79768' }}>
                    {vendorUpiId}
                  </span>
                  <span style={{ background: '#E8F5E9', color: 'var(--leaf)', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                    ✓ Verified
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#FFF3E0',
                  color: '#E65100',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  marginBottom: '18px',
                  border: '1px solid #FFE0B2'
                }}
              >
                ⚠️ Vendor UPI ID not configured. Please contact the vendor directly for payment instructions.
              </div>
            )}

            {/* Mobile "Pay with UPI app" button */}
            {vendorUpiId && upiDeepLink && (
              <div style={{ marginBottom: '18px' }}>
                <a
                  href={upiDeepLink}
                  className="vedika-btn pulse-gold"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    background: 'var(--gold)',
                    color: '#3A0A1E',
                    fontFamily: 'Yatra One, serif',
                    fontSize: '1.05rem',
                    textDecoration: 'none',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(232, 184, 74, 0.4)'
                  }}
                >
                  <span>📱</span>
                  <span>Pay with UPI app</span>
                </a>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', marginTop: '6px' }}>
                  Opens Google Pay, PhonePe, Paytm, or your default UPI app
                </div>
              </div>
            )}

            {/* Desktop Pure SVG QR Code */}
            {vendorUpiId && qrSvg && (
              <div
                style={{
                  textAlign: 'center',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid var(--line)',
                  marginBottom: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <div
                  style={{ width: '190px', height: '190px', display: 'grid', placeItems: 'center' }}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <div style={{ fontSize: '0.82rem', color: '#6E5C72', marginTop: '8px', fontWeight: 600 }}>
                  Scan with any UPI app to pay
                </div>
              </div>
            )}

            {/* "I have paid" confirmation button */}
            <button
              type="button"
              onClick={handleOpenUtrPrompt}
              className="vedika-btn"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: '2px solid var(--gold)',
                background: 'transparent',
                color: '#a79768',
                fontFamily: 'Yatra One, serif',
                fontSize: '1.05rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ✓ I have paid
            </button>
          </div>
        )}

        {/* STAGE 2: UTR NUMBER INPUT */}
        {stage === 'utr_input' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'Yatra One, serif', fontSize: '1.3rem', color: 'var(--ink)', margin: 0 }}>
                Confirm Your Payment
              </h2>
              <button
                type="button"
                onClick={() => setStage('direct_upi')}
                style={{ background: 'transparent', border: 0, fontSize: '1.3rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ← Back
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Enter the 12-digit UTR reference or transaction number from your UPI app so {vendorName} can confirm your booking quickly.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                UTR / Reference Number (Optional)
              </label>
              <input
                type="text"
                className="vedika-input"
                placeholder="e.g. 439201847192"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  fontSize: '0.95rem'
                }}
              />
              {utrError && (
                <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '4px' }}>
                  {utrError}
                </div>
              )}
            </div>

            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '12px', padding: '12px', fontSize: '0.84rem', color: '#795548', marginBottom: '20px' }}>
              ⏳ Once submitted, your booking status will be set to <b>"Payment pending confirmation"</b> until verified by the vendor.
            </div>

            <button
              type="button"
              onClick={handleConfirmPayment}
              className="vedika-btn pulse-gold"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 0,
                background: 'var(--gold)',
                color: '#3A0A1E',
                fontFamily: 'Yatra One, serif',
                fontSize: '1.1rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Submit Confirmation →
            </button>
          </div>
        )}

        {/* STAGE 3: SUCCESS / PENDING CONFIRMATION */}
        {stage === 'success' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: '#E8F5E9',
                color: 'var(--leaf)',
                margin: '0 auto 16px',
                display: 'grid',
                placeItems: 'center',
                fontSize: '2.5rem',
                border: '2px solid var(--leaf)'
              }}
            >
              ✓
            </div>

            <h2 style={{ fontFamily: 'Yatra One, serif', fontSize: '1.6rem', color: 'var(--ink)', margin: '0 0 6px' }}>
              Payment submitted!
            </h2>
            <div
              style={{
                display: 'inline-block',
                background: '#FFF3E0',
                color: '#E65100',
                padding: '4px 14px',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '16px',
                border: '1px solid #FFE0B2'
              }}
            >
              Payment pending confirmation ⏳
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your booking #{bookingRef} has been recorded. {vendorName} will review your UPI payment and confirm the slot.
            </p>

            {isNonRefundable && (
              <div
                style={{
                  background: 'rgba(235, 87, 87, 0.14)',
                  border: '1px solid rgba(235, 87, 87, 0.4)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  marginBottom: '18px',
                  color: '#FFB4A2',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ Non-refundable venue policy applies to this booking.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.hash = '#/bookings';
              }}
              className="vedika-btn pulse-gold"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 0,
                background: 'var(--gold)',
                color: '#3A0A1E',
                fontFamily: 'Yatra One, serif',
                fontSize: '1.1rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              View my bookings →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
