import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentSession, processPayment } from './paymentService.js';
import { saveUserBooking, getUserBookings, cancelBooking } from './bookingService.js';

// Polyfill minimal localStorage for Node test runner
if (typeof localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };
}

test('Payment Service: create session and process mock payment', async () => {
  const session = createPaymentSession(55000, 'upi', { vendorName: 'Test Mandap' });
  assert.ok(session.paymentId.startsWith('PAY_RZP_MOCK_'), 'Payment ID must follow Razorpay mock format');
  assert.equal(session.amount, 55000);
  assert.equal(session.method, 'upi');

  // Process success
  const successRes = await processPayment(session, true);
  assert.equal(successRes.success, true);
  assert.equal(successRes.status, 'Confirmed');

  // Process failure
  const failRes = await processPayment(session, false);
  assert.equal(failRes.success, false);
  assert.equal(failRes.status, 'Failed');
});

test('Booking Service: save, retrieve and cancel bookings', () => {
  const testPhone = '9390075877';
  const initial = getUserBookings(testPhone);
  assert.equal(Array.isArray(initial), true);

  const booking = saveUserBooking(testPhone, {
    vendorName: 'Sri Venkateswara Kalyana Mandapam',
    vendorType: 'hall',
    date: '2026-12-15',
    timeSlot: 'Full Day (24 hrs)',
    guests: 600,
    amount: 55000
  });

  assert.ok(booking.id.startsWith('BK-'), 'Booking ID must start with BK-');
  assert.equal(booking.status, 'Confirmed');

  const afterSave = getUserBookings(testPhone);
  assert.ok(afterSave.some(b => b.id === booking.id), 'Saved booking must be present in user bookings');

  // Cancel booking
  const cancelRes = cancelBooking(testPhone, booking.id);
  assert.equal(cancelRes, true);
  const afterCancel = getUserBookings(testPhone);
  const found = afterCancel.find(b => b.id === booking.id);
  assert.equal(found.status, 'Cancelled');
});
