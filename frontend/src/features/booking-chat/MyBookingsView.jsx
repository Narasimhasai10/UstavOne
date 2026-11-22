import React, { useState, useEffect, useMemo } from 'react';
import { formatINR } from '../dashboard-plan/engine/planner.js';
import { getUserBookings, cancelUserBooking } from '../../shared/data-service/index.js';
import { unreadCountForCustomer, subscribeChat } from './chatStore.js';
import CallModal from './CallModal.jsx';

export default function MyBookingsView({
  user,
  onBack,
  onStartPlan,
  onOpenChat,
  initialBookings
}) {
  const userPhone = user?.phone || '9390075877';
  const [bookings, setBookings] = useState(initialBookings || []);
  const [isLoading, setIsLoading] = useState(initialBookings === undefined);
  const [cancelError, setCancelError] = useState('');
  const [refundNotice, setRefundNotice] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past' | 'cancelled'

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [activeCallVendor, setActiveCallVendor] = useState(null);

  // Load user's bookings
  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await getUserBookings(userPhone);
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialBookings === undefined) {
      loadBookings();
    }
  }, [userPhone, initialBookings]);

  const [chatTick, setChatTick] = useState(0);

  useEffect(() => {
    return subscribeChat(() => {
      setChatTick(t => t + 1);
    });
  }, []);

  // Tab filtering
  const filteredBookings = useMemo(() => {
    const list = Array.isArray(bookings) ? bookings : [];
    const today = new Date().toISOString().split('T')[0];
    return list.filter(b => {
      if (activeTab === 'cancelled') {
        return b.status === 'Cancelled';
      }
      if (b.status === 'Cancelled') return false;

      const bDate = b.date || today;
      if (activeTab === 'upcoming') {
        return bDate >= today;
      }
      if (activeTab === 'past') {
        return bDate < today;
      }
      return true;
    });
  }, [bookings, activeTab]);

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancelError('');
    try {
      const res = await cancelUserBooking(userPhone, cancellingBooking.id, 'User requested cancellation');
      const refundAmt = res?.refund?.amount || res?.refundAmount || res?.data?.refund?.amount;
      if (refundAmt) {
        setRefundNotice(`Booking cancelled. Refund of ₹${Number(refundAmt).toLocaleString('en-IN')} has been initiated.`);
      } else {
        setRefundNotice('Booking cancelled successfully.');
      }
      setCancellingBooking(null);
      await loadBookings();
      setActiveTab('cancelled');
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel booking');
    }
  };

  return (
    <div className="wrap" style={{ padding: '24px 0 80px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'transparent', border: 0, fontSize: '1.2rem', cursor: 'pointer', color: '#f8ebd8' }}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: 'Yatra One', fontSize: '1.6rem', color: '#f8ebd8', margin: 0 }}>
          My bookings
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      {/* Tabs: Upcoming / Past / Cancelled */}
      <div className="tabs" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        {[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'past', label: 'Past' },
          { id: 'cancelled', label: 'Cancelled' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-pressed={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '99px',
              border: '1.5px solid var(--line)',
              background: activeTab === t.id ? 'var(--ink)' : 'var(--card)',
              color: activeTab === t.id ? '#FFE7B0' : 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Refund Banner */}
      {activeTab === 'cancelled' && refundNotice && (
        <div
          style={{
            background: 'rgba(47, 125, 91, 0.15)',
            border: '1.5px solid var(--leaf)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: 'var(--leaf)',
            fontWeight: 600,
            fontSize: '0.92rem'
          }}
        >
          ✓ {refundNotice}
        </div>
      )}

      {/* Bookings List, Loading State, or Empty State */}
      {isLoading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--card)',
            border: '1.5px solid var(--line)',
            borderRadius: '24px',
            color: 'var(--muted)'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🪔</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8ebd8' }}>
            Loading your bookings...
          </div>
        </div>
      ) : filteredBookings.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredBookings.map((b) => {
            const isConfirmed = b.status === 'Confirmed';
            const isAwaiting = b.status === 'Awaiting' || b.status === 'Awaiting reply';
            const isCancelled = b.status === 'Cancelled';
            const borderColor = isCancelled ? 'var(--rose)' : isAwaiting ? 'var(--gold)' : 'var(--leaf)';

            return (
              <div
                key={b.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderLeft: `5px solid ${borderColor}`,
                  borderRadius: '16px',
                  padding: '18px 20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: '#f8ebd8', margin: 0 }}>
                      {b.vendorName || 'Function Booking'}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {b.eventType || b.eventName || (b.vendorType === 'hall' ? '🏛️ Function Hall' : b.vendorType === 'caterer' ? '🍽️ Caterer' : '✨ Celebration Partner')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '99px',
                        background: isCancelled ? 'rgba(181, 23, 59, 0.12)' : isAwaiting ? 'rgba(232, 184, 74, 0.2)' : 'rgba(47, 125, 91, 0.12)',
                        color: isCancelled ? 'var(--rose)' : isAwaiting ? '#854D0E' : 'var(--leaf)'
                      }}
                    >
                      {b.status || 'Confirmed'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '99px',
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        color: 'var(--muted)'
                      }}
                    >
                      {b.paymentStatus || 'Paid'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', margin: '14px 0', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Date & Slot</span>
                    <div style={{ fontWeight: 600 }}>📅 {b.date || 'Upcoming'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>⏰ {b.timeSlot || 'Full day'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Guests</span>
                    <div style={{ fontWeight: 600 }}>👥 {b.guests || 600} Guests</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Amount</span>
                    <div style={{ fontFamily: 'Yatra One', fontSize: '1.2rem', color: '#f8ebd8' }}>
                      {formatINR(b.amount || b.totalAmount || 0)}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '14px' }}>
                  Booking ID: <code>{b.code || b.id}</code>
                </div>

                {/* Actions: Chat, Call, View receipt, Cancel booking */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
                  {(() => {
                    const hasUnread = unreadCountForCustomer(userPhone, b.vendorId || b.id) > 0;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenChat) onOpenChat({ id: b.vendorId || b.id, name: b.vendorName, type: b.vendorType });
                        }}
                        style={{ position: 'relative', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        💬 Chat
                        {hasUnread && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: 'var(--gold)',
                              display: 'inline-block',
                              marginLeft: '6px',
                              verticalAlign: 'middle',
                              boxShadow: '0 0 4px rgba(234, 171, 80, 0.8)'
                            }}
                            title="Unread reply from vendor"
                          />
                        )}
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setActiveCallVendor({ id: b.vendorId || b.id, name: b.vendorName, type: b.vendorType })}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    📞 Call
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(b)}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    View receipt
                  </button>

                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={() => setCancellingBooking(b)}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--rose)', background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontSize: '0.85rem', marginLeft: 'auto' }}
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* EMPTY STATE: Large 📭, heading "No bookings yet", text, gold button "Plan an event" */
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '24px'
          }}
        >
          <div style={{ fontSize: '4.5rem', marginBottom: '12px' }}>📭</div>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.6rem', color: '#f8ebd8', margin: '0 0 6px' }}>
            No bookings yet
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0 0 24px' }}>
            Your confirmed bookings will show up here.
          </p>
          <button
            type="button"
            onClick={onStartPlan}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              border: 0,
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontFamily: 'Yatra One',
              fontSize: '1.1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(232, 184, 74, 0.4)'
            }}
          >
            Plan an event
          </button>
        </div>
      )}

      {/* VIEW RECEIPT MODAL */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 90,
            display: 'grid',
            placeItems: 'center',
            padding: '16px'
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: '20px',
              padding: '24px',
              width: 'min(440px, 94vw)',
              color: 'var(--text)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.4rem', margin: 0, color: '#f8ebd8' }}>
                Booking Receipt
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{ background: 'transparent', border: 0, fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '16px' }}>
              Booking ID: <b>{selectedReceipt.id}</b>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '14px', fontSize: '0.9rem', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--muted)' }}>Vendor / Venue:</span>
                <b>{selectedReceipt.vendorName}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--muted)' }}>Date & Slot:</span>
                <b>{selectedReceipt.date} ({selectedReceipt.timeSlot})</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--muted)' }}>Guests:</span>
                <b>{selectedReceipt.guests}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--muted)' }}>Payment Method:</span>
                <b>{(selectedReceipt.method || 'UPI').toUpperCase()}</b>
              </div>
              <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700 }}>Total Paid (incl. 18% GST):</span>
                <span style={{ fontFamily: 'Yatra One', fontSize: '1.4rem', color: '#f8ebd8' }}>
                  {formatINR(selectedReceipt.amount || selectedReceipt.totalAmount || 0)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 0, background: 'var(--ink)', color: '#FFE7B0', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CANCEL BOOKING CONFIRMATION MODAL */}
      {cancellingBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 90,
            display: 'grid',
            placeItems: 'center',
            padding: '16px'
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: '20px',
              padding: '24px',
              width: 'min(420px, 94vw)',
              color: 'var(--text)'
            }}
          >
            <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.4rem', margin: '0 0 10px', color: 'var(--rose)' }}>
              Cancel this booking?
            </h3>

            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '12px', padding: '12px', fontSize: '0.88rem', color: '#9F1239', lineHeight: 1.45, marginBottom: '18px' }}>
              <b>UstavOne Refund Policy:</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                <li>Full refund up to 7 days before the date</li>
                <li>50% refund up to 48 hours before</li>
                <li>No refund after 48 hours before function</li>
              </ul>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 20px' }}>
              Cancelling will release your reserved slot for <b>{cancellingBooking.vendorName}</b> and move this to your Cancelled tab.
            </p>

            {cancelError && (
              <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '10px', padding: '10px', marginBottom: '14px', color: '#9F1239', fontSize: '0.85rem' }}>
                ⚠️ {cancelError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer' }}
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 0, background: 'var(--rose)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Masked Call Modal */}
      {activeCallVendor && (
        <CallModal
          isOpen={Boolean(activeCallVendor)}
          vendor={activeCallVendor}
          onClose={() => setActiveCallVendor(null)}
          onCallEnded={() => setActiveCallVendor(null)}
        />
      )}
    </div>
  );
}
