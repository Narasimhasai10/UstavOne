import React, { useState, useMemo } from 'react';
import { formatINR } from '../engine/planner.js';
import PaymentModal from './PaymentModal.jsx';

export default function BookingPage({
  user,
  vendor,
  plannerAnswers,
  onCancel,
  onBookingConfirmed,
  onViewMyBookings
}) {
  if (!vendor) return null;

  const isHall = vendor.type === 'hall' || Boolean(vendor.capacity);
  const isCaterer = vendor.type === 'caterer' || Boolean(vendor.servingStyles);

  // Current Step: 1 | 2 | 3
  const [currentStep, setCurrentStep] = useState(1);

  // STEP 1: Date & Time
  const bookedDates = vendor.bookedDates || ['2026-12-10', '2026-12-15', '2026-12-25', '2027-01-14'];
  const [selectedDate, setSelectedDate] = useState(() => {
    return plannerAnswers?.functionDate || '2026-12-18';
  });
  const [timeSlot, setTimeSlot] = useState('full-day'); // 'morning' | 'evening' | 'full-day' | 'custom'
  const [customStartTime, setCustomStartTime] = useState('08:00');
  const [customEndTime, setCustomEndTime] = useState('18:00');
  const [dateError, setDateError] = useState('');

  // STEP 2: Details prefilled from plannerAnswers
  const [guests, setGuests] = useState(plannerAnswers?.guests || 600);
  const [hallCondition, setHallCondition] = useState(plannerAnswers?.hallCondition || (vendor.isAC ? 'ac' : 'non-ac'));
  const [duration, setDuration] = useState(plannerAnswers?.bookingDuration || 'full day');
  const [daysCount, setDaysCount] = useState(plannerAnswers?.daysCount || 1);
  const [decorLevel, setDecorLevel] = useState(plannerAnswers?.decorLevel || 'medium');
  const [servingStyle, setServingStyle] = useState(plannerAnswers?.servingStyle || 'buffet');
  const [foodCategory, setFoodCategory] = useState(plannerAnswers?.foodCategory || 'standard');
  const [cuisine, setCuisine] = useState(plannerAnswers?.cuisine || 'andhra');
  const [foodType, setFoodType] = useState(plannerAnswers?.foodType || 'both');
  const [editingField, setEditingField] = useState(null);

  // STEP 3: Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Cost calculation
  const costCalculation = useMemo(() => {
    let base = 0;
    let adjustments = 0;
    let platesRate = 0;
    let isEstimated = false;

    if (isHall) {
      base = vendor.price || 140000;
      if (hallCondition === 'ac' && !vendor.isAC) {
        adjustments += base * 0.30;
      }
      if (duration === 'half day') {
        base = Math.round(base * 0.60);
      } else if (duration === 'multiple days') {
        base = Math.round(base * (1 + 0.80 * (Math.max(1, daysCount) - 1)));
      }
    } else if (isCaterer) {
      platesRate = vendor.price || vendor.effectivePrice || 420;
      isEstimated = vendor.price == null;
      base = Math.round(guests * platesRate);
    } else {
      base = vendor.price || 45000;
    }

    const subtotal = base + adjustments;
    const gst = Math.round(subtotal * 0.18); // 18% GST as spec
    const total = subtotal + gst;

    return {
      base,
      adjustments,
      platesRate,
      subtotal,
      gst,
      total,
      isEstimated
    };
  }, [isHall, isCaterer, vendor, hallCondition, duration, daysCount, guests]);

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (bookedDates.includes(selectedDate)) {
        setDateError(`The date ${selectedDate} is already booked for this venue.`);
        return;
      }
      setDateError('');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePaymentSuccess = (paymentResult) => {
    setPaymentModalOpen(false);
    if (onBookingConfirmed) {
      onBookingConfirmed({
        ...paymentResult,
        status: paymentResult?.status || 'Payment pending confirmation',
        paymentStatus: paymentResult?.paymentStatus || 'Payment pending confirmation',
        totalAmount: costCalculation.total
      });
    }
  };

  const timeSlotLabel = timeSlot === 'morning' ? 'Morning 6 AM – 2 PM' : timeSlot === 'evening' ? 'Evening 4 PM – 11 PM' : timeSlot === 'full-day' ? 'Full day' : `Custom: ${customStartTime} to ${customEndTime}`;

  return (
    <div className="wrap" style={{ padding: '24px 4vw 80px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => {
            if (currentStep > 1) setCurrentStep(currentStep - 1);
            else onCancel();
          }}
          style={{ background: 'transparent', border: 0, fontSize: '1.2rem', cursor: 'pointer', color: 'var(--ink)' }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: 'Yatra One', fontSize: '1.2rem', color: 'var(--ink)' }}>
          Book with {vendor.name}
        </span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Stepped Progress Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
        {[
          { num: 1, label: 'Date & Time' },
          { num: 2, label: 'Details' },
          { num: 3, label: 'Cost Summary' }
        ].map((s) => (
          <div key={s.num} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: '6px',
                borderRadius: '3px',
                background: currentStep >= s.num ? 'var(--gold)' : 'var(--line)',
                marginBottom: '6px',
                transition: 'background 0.3s'
              }}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: currentStep === s.num ? 700 : 500, color: currentStep >= s.num ? 'var(--ink)' : 'var(--muted)' }}>
              Step {s.num}: {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: Date & Time */}
      {currentStep === 1 && (
        <div className="panel" style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.5rem', color: 'var(--ink)', marginBottom: '8px' }}>
            Select Celebration Date & Time
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Crossed out dates are reserved. You can choose any open auspicious day.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>Function Date</label>
            <input
              type="date"
              value={selectedDate}
              min="2026-11-25"
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                if (bookedDates.includes(val)) {
                  setDateError(`Note: ${val} is currently booked. Please select an alternate date.`);
                } else {
                  setDateError('');
                }
              }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '1rem', background: 'var(--card)', color: 'var(--text)' }}
            />
            {dateError && (
              <div style={{ color: 'var(--rose)', fontSize: '0.85rem', marginTop: '6px' }}>
                ⚠️ {dateError}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px' }}>Time Slot</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                { id: 'morning', label: 'Morning', hours: '6 AM – 2 PM' },
                { id: 'evening', label: 'Evening', hours: '4 PM – 11 PM' },
                { id: 'full-day', label: 'Full day', hours: '24 Hours Window' },
                { id: 'custom', label: 'Custom Times', hours: 'Specify Hours' }
              ].map(slot => (
                <div
                  key={slot.id}
                  onClick={() => setTimeSlot(slot.id)}
                  style={{
                    border: timeSlot === slot.id ? '2px solid var(--ink)' : '1px solid var(--line)',
                    background: timeSlot === slot.id ? 'color-mix(in srgb, var(--ink) 6%, var(--card))' : 'var(--card)',
                    borderRadius: '12px',
                    padding: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{slot.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>{slot.hours}</div>
                </div>
              ))}
            </div>

            {timeSlot === 'custom' && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Start Time</label>
                  <input
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>End Time</label>
                  <input
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 0,
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontFamily: 'Yatra One',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
          >
            Continue to Details →
          </button>
        </div>
      )}

      {/* STEP 2: Details prefilled with "from your plan" tags */}
      {currentStep === 2 && (
        <div className="panel" style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.5rem', color: 'var(--ink)', marginBottom: '8px' }}>
            Confirm Event Details
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Prefilled with your answers. You can edit any detail for this booking.
          </p>

          <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
            {/* Guests count */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Guest attendance</div>
                <div style={{ fontWeight: 700 }}>{guests} Guests</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'var(--leaf)', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px' }}>from your plan</span>
                <button type="button" onClick={() => setEditingField(editingField === 'guests' ? null : 'guests')} style={{ border: 0, background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
              </div>
            </div>
            {editingField === 'guests' && (
              <div style={{ padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '10px' }}>
                <input type="number" value={guests} onChange={(e) => setGuests(Number(e.target.value))} style={{ width: '100px', padding: '6px' }} />
              </div>
            )}

            {/* Hall options */}
            {isHall && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Hall Condition</div>
                    <div style={{ fontWeight: 700 }}>{hallCondition.toUpperCase()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: 'var(--leaf)', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px' }}>from your plan</span>
                    <button type="button" onClick={() => setEditingField(editingField === 'hall' ? null : 'hall')} style={{ border: 0, background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                  </div>
                </div>
                {editingField === 'hall' && (
                  <div style={{ padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '10px' }}>
                    <button type="button" className="pill" onClick={() => setHallCondition('ac')}>AC</button>
                    <button type="button" className="pill" onClick={() => setHallCondition('non-ac')} style={{ marginLeft: '8px' }}>Non-AC</button>
                  </div>
                )}
              </>
            )}

            {/* Catering options */}
            {isCaterer && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', borderRadius: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Serving Style & Cuisine</div>
                    <div style={{ fontWeight: 700 }}>{servingStyle} · {cuisine}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: 'var(--leaf)', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px' }}>from your plan</span>
                    <button type="button" onClick={() => setEditingField(editingField === 'cater' ? null : 'cater')} style={{ border: 0, background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                  </div>
                </div>
                {editingField === 'cater' && (
                  <div style={{ padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '10px' }}>
                    <select value={servingStyle} onChange={(e) => setServingStyle(e.target.value)}>
                      <option value="buffet">Buffet</option>
                      <option value="banana leaf">Banana Leaf</option>
                      <option value="table service">Table Service</option>
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 0,
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontFamily: 'Yatra One',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
          >
            Review Cost Summary →
          </button>
        </div>
      )}

      {/* STEP 3: Cost Summary */}
      {currentStep === 3 && (
        <div className="panel" style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.5rem', color: 'var(--ink)', marginBottom: '8px' }}>
            Booking Cost Summary
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Transparent breakdown decided by your selected plan.
          </p>

          <div style={{ background: 'var(--bg)', borderRadius: '16px', padding: '18px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Base {isCaterer ? `Plates (${guests} × ₹${costCalculation.platesRate})` : 'Venue Rate'}:</span>
              <b>{formatINR(costCalculation.base)}</b>
            </div>

            {costCalculation.adjustments > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Adjustments (AC / multi-day):</span>
                <b>{formatINR(costCalculation.adjustments)}</b>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>GST (18% hospitality standard):</span>
              <b>{formatINR(costCalculation.gst)}</b>
            </div>

            <div style={{ borderTop: '1.5px dashed var(--line)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Total Payable</span>
                {costCalculation.isEstimated && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--rose)', fontWeight: 600 }}>(rate estimated)</div>
                )}
              </div>
              <div style={{ fontFamily: 'Yatra One', fontSize: '2rem', color: 'var(--ink)' }}>
                {formatINR(costCalculation.total)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid var(--line)',
                background: 'transparent',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '12px',
                border: 0,
                background: 'var(--gold)',
                color: '#3A0A1E',
                fontFamily: 'Yatra One',
                fontSize: '1.15rem',
                cursor: 'pointer',
                boxShadow: '0 0 0 3px rgba(232, 184, 74, 0.4)'
              }}
            >
              Payment →
            </button>
          </div>
        </div>
      )}

      {/* Discard confirmation modal */}
      {showDiscardConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--card)', borderRadius: '20px', padding: '24px', maxWidth: '380px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.3rem', margin: '0 0 8px' }}>Discard this booking?</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 20px' }}>
              Your selected schedule and details will not be saved.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--line)', background: 'transparent' }}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onCancel}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 0, background: 'var(--rose)', color: '#fff', fontWeight: 600 }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        vendor={vendor}
        bookingDetails={{
          date: selectedDate,
          timeSlot: timeSlotLabel,
          guests,
          totalAmount: costCalculation.total
        }}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
