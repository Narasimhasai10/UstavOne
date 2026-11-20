import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyDocument } from './utils/verify.js';
import { checkContactDetails } from './utils/contactGuard.js';
import {
  seedTestVendor,
  authenticateVendor,
  getVendorBranches,
  saveVendorBranch,
  deleteVendorBranch,
  getVendorPreviousWorks,
  saveVendorPreviousWork,
  getVendorBookings,
  cancelVendorBooking,
  getVendorChatThreads,
  addVendorChatMessage,
  addVendorWarning,
  getUnifiedVendorsCatalog,
  getUserBookings,
  saveUserBooking
} from './services/store.js';
import { VENDOR_CONFIG } from './engine/config.js';
import dummyVendors from './data/dummyVendors.json' with { type: 'json' };

test('1. Document Verification Adapter (verify.js)', async () => {
  // Valid FSSAI: 14 digits starting with 1
  const validFssai = await verifyDocument({
    type: 'fssai',
    number: '10123456789012',
    businessName: 'Annapurna Catering'
  });
  assert.equal(validFssai.status, 'Verified', 'Valid FSSAI must be Verified');
  assert.equal(validFssai.checks.find(c => c.id === 'format').passed, true);

  // Invalid FSSAI: only 10 digits
  const invalidFssai = await verifyDocument({
    type: 'fssai',
    number: '1234567890',
    businessName: 'Annapurna Catering'
  });
  assert.equal(invalidFssai.status, 'Could not verify', 'Invalid FSSAI must be Could not verify');
  assert.ok(invalidFssai.reasons.length > 0, 'Rejection must have clear reasons');

  // Valid Trade Licence: 6-20 chars with letters, numbers, dash
  const validTrade = await verifyDocument({
    type: 'trade_licence',
    number: 'TL-KDP-2024-9841',
    businessName: 'Sai Function Hall'
  });
  assert.equal(validTrade.status, 'Verified', 'Valid Trade Licence must be Verified');

  // Invalid Trade Licence: too short
  const shortTrade = await verifyDocument({
    type: 'trade_licence',
    number: 'TL-1',
    businessName: 'Sai Hall'
  });
  assert.equal(shortTrade.status, 'Could not verify', 'Short Trade Licence must be Could not verify');

  // Duplicate Licence Check
  const duplicateFssai = await verifyDocument({
    type: 'fssai',
    number: '10123456789012',
    businessName: 'Another Catering',
    existingLicenceNumbers: ['10123456789012']
  });
  assert.equal(duplicateFssai.status, 'Could not verify', 'Duplicate licence must be Could not verify');
  assert.ok(duplicateFssai.reasons.some(r => r.includes('already been registered') || r.includes('registered')));
});

test('2. Personal Contact Guard (contactGuard.js)', () => {
  // Direct 10 digit phone number
  const res1 = checkContactDetails('Call me at 9876543210 please');
  assert.equal(res1.blocked, true);
  assert.ok(res1.reasons.some(r => r.toLowerCase().includes('phone') || r.toLowerCase().includes('contact')));

  // Formatted +91 number
  const res2 = checkContactDetails('My number is +91 9390075877');
  assert.equal(res2.blocked, true);

  // Spaced out digits
  const res3 = checkContactDetails('Contact 9 3 9 0 0 7 5 8 7 7');
  assert.equal(res3.blocked, true);

  // Spelled out digits
  const res4 = checkContactDetails('Ping me nine three nine zero zero seven five eight seven seven');
  assert.equal(res4.blocked, true);

  // Email address
  const res5 = checkContactDetails('Email me at sai.vendor@gmail.com');
  assert.equal(res5.blocked, true);

  // WhatsApp keyword
  const res6 = checkContactDetails('Check my whatsapp status for designs');
  assert.equal(res6.blocked, true);

  // UPI ID
  const res7 = checkContactDetails('Send advance to vendor@okhdfcbank');
  assert.equal(res7.blocked, true);

  // External link
  const res8 = checkContactDetails('Visit my site at https://mycatering.com');
  assert.equal(res8.blocked, true);

  // Clean allowed message
  const resClean = checkContactDetails('Yes, the date is available and we can host up to 600 guests.');
  assert.equal(resClean.blocked, false);
});

test('3. Seeded Test Vendor Authentication (sai_halls / Vedika@123)', async () => {
  seedTestVendor();

  const authSuccess = await authenticateVendor('sai_halls', 'Vedika@123');
  assert.equal(authSuccess.success, true);
  assert.equal(authSuccess.vendor.username, 'sai_halls');
  assert.equal(authSuccess.vendor.businessType, 'both');
  assert.equal(authSuccess.vendor.name, 'Sai Kumar');

  // Wrong password
  const authFail = await authenticateVendor('sai_halls', 'wrongpass');
  assert.equal(authFail.success, false);
  assert.equal(authFail.message, 'Username or password is incorrect.');
});

test('4. Seeded Vendor Branches & Previous Works', () => {
  seedTestVendor();

  const branches = getVendorBranches('sai_halls');
  assert.ok(branches.length >= 3, 'Must have at least 2 halls + 1 catering');
  assert.ok(branches.some(b => b.city === 'Kadapa'));

  const works = getVendorPreviousWorks('sai_halls');
  assert.ok(works.length >= 6, 'Must have at least 6 previous works');
  assert.ok(works.some(w => (w.eventType || '').toLowerCase() === 'wedding'));
});

test('5. Unified Catalog Sync (User Side Sees Vendor Branches in Kadapa)', () => {
  seedTestVendor();

  const catalog = getUnifiedVendorsCatalog(dummyVendors);
  assert.ok(catalog.halls.length >= dummyVendors.halls.length, 'Catalog must merge branches');

  const kadapaHalls = catalog.halls.filter(h => h.city.toLowerCase() === 'kadapa');
  assert.ok(kadapaHalls.length >= 2, 'Kadapa must contain seeded vendor halls');
  assert.ok(kadapaHalls.some(h => h.name.includes('Sai Function Hall')));
});

test('6. Bidirectional Booking Cancellation Sync', () => {
  seedTestVendor();

  // Create a user booking for sai_halls
  const userPhone = '9390075877';
  const testBooking = saveUserBooking(userPhone, {
    vendorId: 'h-kad-1',
    vendorName: 'Sai Function Hall - Central Branch',
    vendorType: 'hall',
    vendorUsername: 'sai_halls',
    date: '2026-12-15',
    total: 120000,
    amount: 120000,
    eventType: 'Wedding',
    guests: 500
  });

  assert.ok(testBooking.id);

  // Vendor cancels the booking with reason
  const cancelResult = cancelVendorBooking(
    'sai_halls',
    testBooking.id,
    'Double-booking / schedule conflict',
    'Apologies for the inconvenience'
  );

  assert.equal(cancelResult.success, true);
  assert.equal(cancelResult.booking.status, 'Cancelled');

  // Verify User side also shows Cancelled with refund initiated
  const userBookings = getUserBookings(userPhone);
  const foundUserBooking = userBookings.find(b => b.id === testBooking.id);
  assert.ok(foundUserBooking);
  assert.equal(foundUserBooking.status, 'Cancelled');
  assert.ok(foundUserBooking.cancellationReason.includes('Double-booking'));
  assert.equal(foundUserBooking.refundStatus, 'Refund initiated');
});

test('7. Vendor Warnings & Flagging', () => {
  seedTestVendor();

  // Add 1st warning
  const w1 = addVendorWarning('sai_halls', 'Phone number shared in chat');
  assert.ok(w1 >= 1);

  // Add more warnings up to limit
  addVendorWarning('sai_halls', 'Spaced phone number');
  const w3 = addVendorWarning('sai_halls', 'Email shared');
  assert.ok(w3 >= VENDOR_CONFIG.warningLimit, 'Must reach or exceed warning limit');
});

test('8. Vendor Revenue Calculations', () => {
  seedTestVendor();

  const bookings = getVendorBookings('sai_halls');
  assert.ok(bookings.length >= 10, 'Must have at least 12 months seeded bookings');

  const totalGross = bookings
    .filter(b => (b.status || '').toLowerCase() !== 'cancelled')
    .reduce((sum, b) => sum + (b.amount || 0), 0);

  const totalCommission = Math.round(totalGross * VENDOR_CONFIG.commissionRate);
  const totalNet = totalGross - totalCommission;

  assert.ok(totalGross > 0);
  assert.equal(totalCommission, Math.round(totalGross * 0.10));
  assert.equal(totalNet, totalGross - totalCommission);
});
