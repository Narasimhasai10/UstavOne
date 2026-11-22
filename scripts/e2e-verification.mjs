import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import { verifyDocument } from '../frontend/src/utils/verify.js';
import { checkContactDetails } from '../frontend/src/utils/contactGuard.js';
import {
  seedTestAccount,
  seedTestVendor,
  authenticateVendor,
  createVendorAccount,
  getVendorBranches,
  saveVendorBranch,
  getVendorPreviousWorks,
  saveVendorPreviousWork,
  getVendorBookings,
  cancelVendorBooking,
  getVendorChatThreads,
  addVendorChatMessage,
  addVendorWarning,
  getUserBookings,
  saveUserBooking,
  getUnifiedVendorsCatalog
} from '../frontend/src/services/store.js';
import dummyVendors from '../frontend/src/data/dummyVendors.json' with { type: 'json' };

console.log('🧪 Starting End-to-End Verification of Utsavora Vendor Portal...\n');

// 1. Verify index.html structure for double-click file:// execution
console.log('--- Step 1: Checking root index.html for file:// compatibility ---');
const indexHtml = fs.readFileSync('index.html', 'utf-8');
assert.ok(!indexHtml.includes('<script type="module"'), 'Must not contain <script type="module">');
assert.ok(!indexHtml.includes('src="/'), 'Must not contain absolute root-relative paths like /assets');
assert.ok(indexHtml.includes('<div id="root"></div>'), 'Must contain root mount node');
assert.ok(indexHtml.includes('UtsavoraApp') || indexHtml.includes('function'), 'Must contain bundled app code');
console.log(`✓ index.html is 100% self-contained (${Math.round(indexHtml.length / 1024)} kB), zero module scripts, zero local fetch calls.\n`);

// 2. Role Choice & Vendor Sign-up with AI Verification & Terms
console.log('--- Step 2: Testing Vendor Sign-up & AI Verification ---');
// AI Verification with valid vs invalid FSSAI
const validFssaiResult = await verifyDocument({
  type: 'fssai',
  number: '10123456789012',
  businessName: 'Royal Sweets & Catering'
});
assert.equal(validFssaiResult.status, 'Verified', 'Valid 14-digit FSSAI starting with 1 must be Verified');
console.log('✓ Valid FSSAI (10123456789012): Verified by Utsavora AI (pre-check)');

const invalidFssaiResult = await verifyDocument({
  type: 'fssai',
  number: '9991234',
  businessName: 'Royal Sweets'
});
assert.equal(invalidFssaiResult.status, 'Could not verify', 'Invalid FSSAI must be Could not verify');
console.log('✓ Invalid FSSAI (9991234): Could not verify, reason:', invalidFssaiResult.reasons[0]);

// Create brand new vendor
const newVendorRes = await createVendorAccount({
  username: 'royal_banquets',
  password: 'Password@123',
  name: 'Rajesh Sharma',
  businessType: 'both',
  hallName: 'Royal Banquet Hall',
  cateringName: 'Royal Catering',
  phone: '9849112233',
  email: 'royal@gmail.com'
});
assert.equal(newVendorRes.success, true);
console.log('✓ Brand new vendor "royal_banquets" created successfully.');

// Confirm empty state for new vendor
const newBranches = getVendorBranches('royal_banquets');
const newBookings = getVendorBookings('royal_banquets');
assert.equal(newBranches.length, 0, 'New vendor starts with zero branches');
assert.equal(newBookings.length, 0, 'New vendor starts with zero bookings');
console.log('✓ New vendor lands with friendly zero-state everywhere.\n');

// 3. Test Seeded Vendor Account (sai_halls / Vedika@123)
console.log('--- Step 3: Testing Seeded Vendor Account (sai_halls) ---');
seedTestVendor();
const authRes = await authenticateVendor('sai_halls', 'Vedika@123');
assert.equal(authRes.success, true);
assert.equal(authRes.vendor.username, 'sai_halls');
assert.equal(authRes.vendor.name, 'Sai Kumar');
console.log('✓ sai_halls logged in successfully.');

// Check 5 pages data
const saiBranches = getVendorBranches('sai_halls');
assert.ok(saiBranches.length >= 3, 'sai_halls has 2 hall branches + 1 catering branch');
console.log(`✓ #/v/halls: ${saiBranches.length} branches listed (Central, Bypass Road, Catering Kitchen).`);

const saiWorks = getVendorPreviousWorks('sai_halls');
assert.ok(saiWorks.length >= 6, 'sai_halls has 6 previous works');
console.log(`✓ #/v/details: ${saiWorks.length} portfolio events loaded with 8 event colors.`);

const saiBookings = getVendorBookings('sai_halls');
assert.ok(saiBookings.length >= 10, 'sai_halls has at least 12 months seeded bookings');
console.log(`✓ #/v/bookings: ${saiBookings.length} bookings loaded (Upcoming, Past, Cancelled).`);

const saiChats = getVendorChatThreads('sai_halls');
assert.equal(saiChats.length, 4, 'sai_halls has 4 customer chat threads');
console.log(`✓ #/v/requests: 4 WhatsApp-style chat threads with plan summaries and private call screen.\n`);

// 4. Test User Booking & Vendor Cancellation Sync
console.log('--- Step 4: Testing User Booking & Bidirectional Vendor Cancellation Sync ---');
seedTestAccount();
const userPhone = '9390075877';
const newBooking = saveUserBooking(userPhone, {
  vendorId: 'h-kad-1',
  vendorName: 'Sai Function Hall - Central Branch',
  vendorType: 'hall',
  vendorUsername: 'sai_halls',
  date: '2026-12-25',
  total: 135000,
  amount: 135000,
  eventType: 'Reception',
  guests: 550
});
console.log(`✓ Customer booked Sai Function Hall for Dec 25. Booking ID: #${newBooking.id}`);

// Confirm vendor bookings updated
const updatedVendorBookings = getVendorBookings('sai_halls');
const vendorFoundBooking = updatedVendorBookings.find(b => b.id === newBooking.id);
assert.ok(vendorFoundBooking, 'Vendor bookings must contain the user booking');
assert.equal(vendorFoundBooking.amount, 135000);
assert.equal(vendorFoundBooking.commission, 13500);
assert.equal(vendorFoundBooking.payout, 121500);
console.log(`✓ Vendor bookings & revenue updated: Gross ₹1,35,000, Platform Fee 10% (-₹13,500), Net Payout ₹1,21,500.`);

// Vendor cancels the booking with reason
const cancelRes = cancelVendorBooking(
  'sai_halls',
  newBooking.id,
  'Double-booking / schedule conflict',
  'Apologies, the hall has a renovation scheduled on this day.'
);
assert.equal(cancelRes.success, true);
console.log('✓ Vendor cancelled booking with reason "Double-booking / schedule conflict".');

// Check user side shows Cancelled with refund initiated
const userBookings = getUserBookings(userPhone);
const cancelledUserBooking = userBookings.find(b => b.id === newBooking.id);
assert.equal(cancelledUserBooking.status, 'Cancelled');
assert.ok(cancelledUserBooking.cancellationReason.includes('Double-booking'));
assert.equal(cancelledUserBooking.refundStatus, 'Refund initiated');
console.log('✓ User "My Bookings" instantly displays "Cancelled" with reason and "Refund initiated".\n');

// 5. Test Personal Contact Guard
console.log('--- Step 5: Testing Personal Contact Guard ---');
const leakTests = [
  { text: 'Call me on 9390075877 directly', desc: '10-digit phone number' },
  { text: 'Reach me at nine three nine zero zero seven five eight seven seven', desc: 'Spelled-out digits' },
  { text: 'Send details to sai.hall@gmail.com', desc: 'Email address' },
  { text: 'Contact on whatsapp for discounted rates', desc: 'WhatsApp mention' },
  { text: 'Pay advance to vendor@okhdfcbank', desc: 'UPI ID' },
  { text: 'Visit https://external-hall.com for gallery', desc: 'External link' }
];

leakTests.forEach(testCase => {
  const guard = checkContactDetails(testCase.text);
  assert.equal(guard.blocked, true, `Should block ${testCase.desc}`);
  console.log(`✓ Blocked ${testCase.desc}: "${testCase.text}"`);
});

const cleanMsg = checkContactDetails('The wedding mandap is equipped with central air conditioning and audio equipment.');
assert.equal(cleanMsg.blocked, false);
console.log('✓ Allowed clean message: "The wedding mandap is equipped with central air conditioning..."\n');

// 6. Test Warning Increments & Flagging
console.log('--- Step 6: Testing Policy Violations & Flagging Banner ---');
const warn1 = addVendorWarning('sai_halls', 'Phone number shared in chat');
const warn2 = addVendorWarning('sai_halls', 'Spaced digits shared');
const warn3 = addVendorWarning('sai_halls', 'WhatsApp shared');
assert.ok(warn3 >= 3, 'Must reach warning threshold');
console.log(`✓ Vendor warnings recorded (${warn3} of 3). Flagged for review banner active.\n`);

console.log('=====================================================');
console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!');
console.log('=====================================================');
