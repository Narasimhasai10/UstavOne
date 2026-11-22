import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as dataService from './index.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Data-Service Async Consistency & Component Rendering Tests', () => {

  test('Every data-fetching and mutation export returns a Promise in mock mode', async () => {
    // Ensure mock mode is active
    dataService.setMode('mock');
    assert.equal(dataService.getMode(), 'mock', 'Mode must be mock');

    // List of operations to assert Promise return types
    const operations = [
      () => dataService.getUserBookings('9390075877'),
      () => dataService.saveUserBooking('9390075877', { vendorId: 'hall-1', date: '2026-12-25' }),
      () => dataService.cancelUserBooking('9390075877', 'b-mock-1', 'Test reason'),
      () => dataService.getUnifiedVendorsCatalog({ halls: [], caterers: [] }),
      () => dataService.calculatePlan({ budget: 800000, guests: 500, city: 'Kadapa' }),
      () => dataService.saveUserPlan({ budget: 800000 }),
      () => dataService.getSavedPlan(),
      () => dataService.authenticateUser('9390075877', 'sai@1398'),
      () => dataService.updateUserProfile({ name: 'Test' }),
      () => dataService.changeUserPassword('old', 'new'),
      () => dataService.isPhoneTaken('9390075877'),
      () => dataService.isUsernameTaken('sai_halls'),
      () => dataService.seedTestAccount(),
      () => dataService.seedTestVendor(),
      () => dataService.authenticateVendor('sai_halls', 'Vedika@123'),
      () => dataService.updateVendorProfile({ name: 'Vendor' }),
      () => dataService.changeVendorPassword('old', 'new'),
      () => dataService.vendorLogout(),
      () => dataService.getVendorBranches(),
      () => dataService.saveVendorBranch('sai_halls', { id: 'br-1', name: 'Branch 1' }),
      () => dataService.deleteVendorBranch('br-1'),
      () => dataService.getVendorPreviousWorks(),
      () => dataService.saveVendorPreviousWork('sai_halls', { id: 'pw-1', title: 'Work 1' }),
      () => dataService.deleteVendorPreviousWork('pw-1'),
      () => dataService.getVendorBookings(),
      () => dataService.confirmVendorBooking('bk-1'),
      () => dataService.cancelVendorBooking('bk-1'),
      () => dataService.markBookingCompleted('bk-1'),
      () => dataService.getChatMessages('hall-1'),
      () => dataService.addChatMessage('hall-1', 'Hello'),
      () => dataService.getVendorChatThreads(),
      () => dataService.addVendorChatMessage('c-1', 'Hello from vendor'),
      () => dataService.getActiveChatVendorIds(),
      () => dataService.addVoiceCallLog('hall-1', 'outgoing', 60),
      () => dataService.addVendorWarning('Contact sharing blocked'),
      () => dataService.detectMode()
    ];

    for (const op of operations) {
      const result = op();
      assert.ok(
        result && typeof result.then === 'function',
        `Operation ${op.toString()} must return a Promise in mock mode`
      );
      // Await resolution to prevent unhandled rejection warnings in test runner
      try {
        await result;
      } catch (err) {
        // Tolerated in mock mode (e.g. invalid mock params), return type was verified
      }
    }
  });

  // Dynamically compile MyBookingsView.jsx for SSR test execution
  const cacheDir = path.resolve(__dirname, '.test-cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const compiledFile = path.join(cacheDir, 'MyBookingsView.test-ssr.js');

  esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '../../features/booking-chat/MyBookingsView.jsx')],
    bundle: true,
    format: 'esm',
    outfile: compiledFile,
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server']
  });

  let MyBookingsView;

  test('MyBookingsView module compilation succeeds', async () => {
    const fileUrl = url.pathToFileURL(compiledFile).href;
    const mod = await import(fileUrl);
    MyBookingsView = mod.default;
    assert.equal(typeof MyBookingsView, 'function', 'MyBookingsView must export a React component');
  });

  test('Component test: renders MyBookingsView for a user with no bookings (must render "No bookings yet", not throw)', () => {
    assert.ok(MyBookingsView, 'Component must be loaded');

    // Rendering with empty bookings list
    const html = renderToStaticMarkup(
      React.createElement(MyBookingsView, {
        user: { phone: '9390075877', name: 'Sai' },
        initialBookings: []
      })
    );

    assert.ok(html.includes('No bookings yet'), 'Must render "No bookings yet" heading');
    assert.ok(html.includes('Your confirmed bookings will show up here'), 'Must render empty state helper text');
    assert.ok(!html.includes('Loading your bookings...'), 'Should not remain in loading state');
  });

  test('Component test: renders MyBookingsView with seeded bookings (must render cards with vendor name, event type, date, amount, code)', () => {
    assert.ok(MyBookingsView, 'Component must be loaded');

    const seededBookings = [
      {
        id: 'BK-101',
        code: 'VED-BK-101',
        vendorId: 'hall-sai-kdp-1',
        vendorName: 'Sai Function Hall - Main Town',
        vendorType: 'hall',
        eventName: 'Grand Wedding',
        eventType: 'Wedding',
        date: '2026-12-25',
        timeSlot: 'Morning (6 AM - 2 PM)',
        guests: 600,
        amount: 450000,
        totalAmount: 450000,
        status: 'Confirmed',
        paymentStatus: 'Paid'
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(MyBookingsView, {
        user: { phone: '9390075877', name: 'Sai' },
        initialBookings: seededBookings
      })
    );

    // Verify all 5 required elements appear in rendered markup:
    // 1. Vendor name
    assert.ok(html.includes('Sai Function Hall - Main Town'), 'Must render vendor name');
    // 2. Event type
    assert.ok(html.includes('Wedding'), 'Must render event type');
    // 3. Date
    assert.ok(html.includes('2026-12-25'), 'Must render booking date');
    // 4. Amount (formatted in INR)
    assert.ok(html.includes('4,50,000'), 'Must render formatted booking amount');
    // 5. Code
    assert.ok(html.includes('VED-BK-101'), 'Must render booking code');
  });

});
