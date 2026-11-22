import React, { useState, useEffect, useMemo } from 'react';
import {
  getVendorBookings,
  getVendorBranches,
  cancelVendorBooking,
  markBookingCompleted,
  confirmVendorBooking
} from '../../shared/data-service/index.js';
import { VENDOR_CONFIG } from '../dashboard-plan/engine/config.js';

const EVENT_COLORS = {
  Wedding: '#B5173B',
  Reception: '#6B1230',
  Engagement: '#FF5C8A',
  Sangeet: '#E8B84A',
  Mehendi: '#2F7D5B',
  Birthday: '#3A0A1E',
  Annaprasana: '#E4572E',
  'Half Saree': '#9C27B0'
};

const CANCELLATION_REASONS = [
  'Venue undergoing maintenance/repairs',
  'Double-booking / schedule conflict',
  'Renovation or natural circumstance',
  'Customer requested cancellation directly',
  'Other emergency'
];

export default function VendorBookings({ vendor, onNavigate }) {
  const [bookings, setBookings] = useState([]);
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past' | 'cancelled'
  const [branchFilter, setBranchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('date-asc'); // 'date-asc' | 'date-desc'

  // Modals
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelNote, setCancelNote] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Reload bookings
  const reloadBookings = async () => {
    if (vendor?.username) {
      try {
        const [list, bList] = await Promise.all([
          getVendorBookings(vendor.username),
          getVendorBranches(vendor.username)
        ]);
        setBookings(Array.isArray(list) ? list : []);
        setBranches(Array.isArray(bList) ? bList : []);
      } catch (err) {
        console.warn('[VendorBookings] Failed to load data:', err);
      }
    }
  };

  useEffect(() => {
    reloadBookings();
  }, [vendor]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Filter & sort
  const filteredBookings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return bookings
      .filter(b => {
        // Tab filter
        const status = (b.status || 'Confirmed').toLowerCase();
        if (activeTab === 'cancelled') {
          if (status !== 'cancelled') return false;
        } else if (activeTab === 'past') {
          if (status === 'cancelled') return false;
          if (status !== 'completed' && (!b.date || b.date >= today)) return false;
        } else {
          // upcoming
          if (status === 'cancelled' || status === 'completed') return false;
          if (b.date && b.date < today) return false;
        }

        // Branch filter
        if (branchFilter !== 'all' && b.branchId !== branchFilter) {
          return false;
        }

        // Search query (booking ID or customer first name only)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = (b.id || '').toLowerCase().includes(q);
          const matchName = (b.customerFirstName || b.customerName || '').toLowerCase().includes(q);
          if (!matchId && !matchName) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (sortOrder === 'date-asc') {
          return dateA.localeCompare(dateB);
        } else {
          return dateB.localeCompare(dateA);
        }
      });
  }, [bookings, activeTab, branchFilter, searchQuery, sortOrder]);

  // Handle Mark Completed
  const handleMarkCompleted = async (bookingId) => {
    if (!vendor?.username) return;
    try {
      await markBookingCompleted(vendor.username, bookingId);
      await reloadBookings();
      showToast('Booking marked as Completed ✓');
    } catch (err) {
      showToast(err.message || 'Failed to update booking');
    }
  };

  // Handle Cancel Booking
  const handleConfirmCancel = async () => {
    if (!cancelModalBooking || !vendor?.username) return;

    setIsSubmittingCancel(true);
    try {
      await cancelVendorBooking(vendor.username, cancelModalBooking.id, cancelReason, cancelNote);
      setIsSubmittingCancel(false);
      setCancelModalBooking(null);
      setCancelNote('');
      await reloadBookings();
      showToast('Booking cancelled. Full refund initiated for customer.');
    } catch (err) {
      setIsSubmittingCancel(false);
      showToast(err.message || 'Failed to cancel booking');
    }
  };

  // Handle Open Chat
  const handleOpenChat = (booking) => {
    window.location.hash = `#/v/requests?thread=${booking.id}`;
  };

  return (
    <div className="vedika-vendor-page fade-in" style={{ padding: '24px 0 80px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(234, 171, 80, 0.31)',
            color: 'var(--vendor-btn-text, #f8ebd8)',
            padding: '12px 22px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontWeight: 600,
            fontSize: '14px',
            border: '1px solid var(--gold)'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'Yatra One, serif', fontSize: '28px', color: '#f8ebd8', margin: '0 0 6px' }}>
            Manage Customer Bookings
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '15px' }}>
            View upcoming dates, guest requirements, completed payouts and manage cancellations.
          </p>
        </div>

        {/* Tab Badges */}
        <div style={{ display: 'inline-flex', background: 'var(--line)', borderRadius: '999px', padding: '4px' }}>
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'past', label: 'Past & Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                padding: '8px 18px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                background: activeTab === tab.id ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                color: activeTab === tab.id ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div
        className="vedika-card"
        style={{
          background: 'var(--card)',
          borderRadius: '18px',
          padding: '16px 20px',
          border: '1px solid var(--line)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="text"
            className="vedika-input"
            placeholder="Search by Booking ID or customer name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: '12px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Branch:</span>
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Sort:</span>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <option value="date-asc">Date (Earliest first)</option>
            <option value="date-desc">Date (Latest first)</option>
          </select>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div
          className="vedika-card"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--card)',
            borderRadius: '24px',
            border: '1px dashed var(--line)'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>📭</div>
          <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px', fontSize: '20px' }}>
            No bookings yet
          </h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto', fontSize: '14px', lineHeight: 1.5 }}>
            Bookings from customers will appear here once confirmed.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredBookings.map(b => {
            const evColor = EVENT_COLORS[b.eventType] || 'var(--ink)';
            const total = Number(b.amount || b.totalAmount || 0);
            const commission = Math.round(total * VENDOR_CONFIG.commissionRate);
            const netPayout = total - commission;
            const isCancelled = (b.status || '').toLowerCase() === 'cancelled';
            const isCompleted = (b.status || '').toLowerCase() === 'completed';

            return (
              <div
                key={b.id}
                className="vedika-card pop-in"
                style={{
                  background: 'var(--card)',
                  borderRadius: '20px',
                  border: '1px solid var(--line)',
                  padding: '20px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Top Row: ID, Event Chip, Status Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8ebd8' }}>
                      #{b.id}
                    </span>

                    <span
                      style={{
                        background: evColor,
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        letterSpacing: '0.4px'
                      }}
                    >
                      {b.eventType || 'Wedding'}
                    </span>

                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      • {b.branchName || 'Central Branch'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {b.status === 'Payment pending confirmation' || b.paymentStatus === 'Payment pending confirmation' ? (
                      <span
                        style={{
                          background: '#FFF3E0',
                          color: '#E65100',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          border: '1px solid #FFE0B2'
                        }}
                      >
                        Payment pending confirmation ⏳
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#E8F5E9',
                          color: 'var(--leaf)',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          border: '1px solid var(--leaf)'
                        }}
                      >
                        Paid ✓
                      </span>
                    )}

                    <span
                      style={{
                        background: isCancelled ? '#FFEBEE' : isCompleted ? '#E0F2F1' : (b.status === 'Payment pending confirmation' ? '#FFF3E0' : '#FFF8E1'),
                        color: isCancelled ? 'var(--rose)' : isCompleted ? 'var(--leaf)' : (b.status === 'Payment pending confirmation' ? '#E65100' : '#B78103'),
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px'
                      }}
                    >
                      {b.status || 'Confirmed'}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Customer Info (NO phone/email!), Date, Guests, Options */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--bg)',
                    borderRadius: '14px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Customer</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      👤 {b.customerFirstName || 'Customer'} {b.customerLastInitial ? `${b.customerLastInitial}.` : ''}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Event Date & Slot</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      📅 {b.date} ({b.slot || 'Full Day'})
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Guests & Setup</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      👥 {b.guests || 500} guests · {b.isAc ? 'AC Hall' : 'Non-AC'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Financials</div>
                    <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                      Total: <strong>₹{total.toLocaleString('en-IN')}</strong> · Net: <strong style={{ color: 'var(--leaf)' }}>₹{netPayout.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                {/* Cancelled Info Banner if cancelled */}
                {isCancelled && (
                  <div style={{ padding: '10px 14px', background: '#FFEBEE', borderRadius: '10px', border: '1px solid #FFCDD2', fontSize: '13px', color: 'var(--rose)' }}>
                    <strong>Cancelled:</strong> {b.cancellationReason || 'Cancelled by vendor'} {b.cancellationNote ? `("${b.cancellationNote}")` : ''} — Refund initiated.
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedBookingDetails(b)}
                    className="vedika-btn"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      padding: '7px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔍 View details
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenChat(b)}
                    className="vedika-btn"
                    style={{
                      background: 'rgba(234, 171, 80, 0.31)',
                      color: 'var(--vendor-btn-text, #f8ebd8)',
                      border: '1px solid rgba(232, 184, 74, 0.3)',
                      padding: '7px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    💬 Chat with customer
                  </button>

                  {!isCancelled && !isCompleted && (
                    <>
                      {(b.status === 'Payment pending confirmation' || b.paymentStatus === 'Payment pending confirmation') && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await confirmVendorBooking(vendor.username, b.id);
                              await reloadBookings();
                              showToast('Payment confirmed! Booking is now Confirmed ✓');
                            } catch (err) {
                              showToast(err.message || 'Failed to confirm booking');
                            }
                          }}
                          className="vedika-btn pulse-gold"
                          style={{
                            background: 'var(--leaf)',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 18px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Confirm Payment
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleMarkCompleted(b.id)}
                        className="vedika-btn"
                        style={{
                          background: 'var(--leaf)',
                          color: '#fff',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Mark completed
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalBooking(b);
                          setCancelReason(CANCELLATION_REASONS[0]);
                          setCancelNote('');
                        }}
                        className="vedika-btn"
                        style={{
                          background: 'transparent',
                          color: 'var(--rose)',
                          border: '1px solid var(--line)',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel booking
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOOKING DETAILS MODAL */}
      {selectedBookingDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedBookingDetails(null)} style={{ zIndex: 9990 }}>
          <div
            className="vedika-card pop-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(500px, 94vw)',
              background: 'var(--card)',
              borderRadius: '24px',
              padding: '24px',
              border: '1px solid var(--line)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: 0, fontSize: '20px' }}>
                Booking #{selectedBookingDetails.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedBookingDetails(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Customer:</span>
                <span style={{ fontWeight: 600 }}>
                  👤 {selectedBookingDetails.customerFirstName || 'Customer'} {selectedBookingDetails.customerLastInitial ? `${selectedBookingDetails.customerLastInitial}.` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Event Type:</span>
                <span style={{ fontWeight: 600 }}>{selectedBookingDetails.eventType}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Date & Slot:</span>
                <span style={{ fontWeight: 600 }}>{selectedBookingDetails.date} ({selectedBookingDetails.slot || 'Full Day'})</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Branch:</span>
                <span style={{ fontWeight: 600 }}>{selectedBookingDetails.branchName || 'Central Branch'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Gross Booking Amount:</span>
                <span style={{ fontWeight: 600 }}>₹{Number(selectedBookingDetails.amount || selectedBookingDetails.totalAmount || 0).toLocaleString('en-IN')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>Utsavora Platform Fee (10%):</span>
                <span style={{ color: 'var(--rose)', fontWeight: 600 }}>
                  -₹{Math.round(Number(selectedBookingDetails.amount || selectedBookingDetails.totalAmount || 0) * VENDOR_CONFIG.commissionRate).toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: '15px' }}>
                <span style={{ fontWeight: 700, color: '#f8ebd8' }}>Your Net Payout:</span>
                <span style={{ fontWeight: 700, color: 'var(--leaf)' }}>
                  ₹{(Number(selectedBookingDetails.amount || selectedBookingDetails.totalAmount || 0) * (1 - VENDOR_CONFIG.commissionRate)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedBookingDetails(null)}
                className="vedika-btn"
                style={{ background: 'rgba(234, 171, 80, 0.31)', color: 'var(--vendor-btn-text, #f8ebd8)', border: '1px solid rgba(232, 184, 74, 0.3)', padding: '8px 20px', borderRadius: '999px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL BOOKING MODAL */}
      {cancelModalBooking && (
        <div className="modal-backdrop" onClick={() => setCancelModalBooking(null)} style={{ zIndex: 9990 }}>
          <div
            className="vedika-card pop-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(460px, 94vw)',
              background: 'var(--card)',
              borderRadius: '24px',
              padding: '24px',
              border: '1px solid var(--line)'
            }}
          >
            <h3 style={{ fontFamily: 'Yatra One, serif', color: 'var(--rose)', margin: '0 0 10px', fontSize: '20px' }}>
              Cancel Booking #{cancelModalBooking.id}?
            </h3>

            {/* Warning Callout */}
            <div
              style={{
                background: '#FFEBEE',
                border: '1px solid #FFCDD2',
                borderRadius: '12px',
                padding: '12px 14px',
                color: 'var(--rose)',
                fontSize: '13px',
                lineHeight: 1.4,
                marginBottom: '16px'
              }}
            >
              ⚠️ <strong>Important:</strong> Cancelling affects your rating and the customer will be refunded in full. A notification will be sent immediately to the customer.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Reason for Cancellation *
                </label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    fontSize: '13px'
                  }}
                >
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Note to Customer (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Due to urgent hall maintenance, we are unable to host your event on this date."
                  value={cancelNote}
                  onChange={e => setCancelNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    fontFamily: 'Hind, sans-serif',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="vedika-btn"
                style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)', padding: '8px 20px', borderRadius: '999px' }}
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancel}
                className="vedika-btn"
                style={{ background: 'var(--rose)', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '999px', fontWeight: 600 }}
              >
                {isSubmittingCancel ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
