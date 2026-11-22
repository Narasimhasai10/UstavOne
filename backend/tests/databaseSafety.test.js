import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { validateTestDatabaseIsolation, seedDatabase } from '../../database/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const schemaPath = path.resolve(rootDir, 'database/schema.prisma');
const throwawayDir = path.resolve(rootDir, 'database/throwaway-safety');
const throwawayDbPath = path.resolve(throwawayDir, 'test.db').replace(/\\/g, '/');

describe('Database Safety & Test Isolation Guards', () => {
  test('1. Guard refuses when NODE_ENV=test and target db is utsavora.db', () => {
    const origEnv = process.env.NODE_ENV;
    const origTestDb = process.env.TEST_DB;
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_DB;

    assert.throws(
      () => validateTestDatabaseIsolation('file:../database/utsavora.db', rootDir),
      /Refusing to run in test mode/,
      'Must throw when targeting utsavora.db in test mode'
    );

    process.env.NODE_ENV = origEnv;
    if (origTestDb !== undefined) process.env.TEST_DB = origTestDb;
  });

  test('2. Guard refuses when TEST_DB is set and db is not named test.db', () => {
    const origEnv = process.env.NODE_ENV;
    const origTestDb = process.env.TEST_DB;
    process.env.NODE_ENV = 'production';
    process.env.TEST_DB = 'some/path/production.db';

    assert.throws(
      () => validateTestDatabaseIsolation('file:../database/production.db', rootDir),
      /database file must be named "test.db"/,
      'Must throw when file is not named test.db'
    );

    process.env.NODE_ENV = origEnv;
    if (origTestDb !== undefined) process.env.TEST_DB = origTestDb;
    else delete process.env.TEST_DB;
  });

  test('3. Guard allows valid test.db path in test mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    assert.doesNotThrow(
      () => validateTestDatabaseIsolation(`file:${rootDir}/database/test.db`, rootDir),
      'Must not throw when file is named test.db and not utsavora.db'
    );

    process.env.NODE_ENV = origEnv;
  });

  describe('Default Seed Safety on Non-Empty Database', () => {
    let throwawayPrisma = null;

    before(async () => {
      // Ensure throwaway directory exists and is clean
      if (!fs.existsSync(throwawayDir)) {
        fs.mkdirSync(throwawayDir, { recursive: true });
      }
      for (const p of [throwawayDbPath, `${throwawayDbPath}-journal`, `${throwawayDbPath}-wal`, `${throwawayDbPath}-shm`]) {
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch {}
        }
      }

      // Push fresh schema to throwaway database
      execSync(`npx prisma db push --schema "${schemaPath}" --accept-data-loss --skip-generate`, {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: `file:${throwawayDbPath}` },
        stdio: 'pipe'
      });

      throwawayPrisma = new PrismaClient({
        datasources: { db: { url: `file:${throwawayDbPath}` } }
      });

      // Insert pre-existing data: city, vendor, customer, existing hall, booking, chat
      const city = await throwawayPrisma.city.create({
        data: { state: 'Andhra Pradesh', city: 'Kadapa', priceMultiplier: 1.0 }
      });

      const vendorUser = await throwawayPrisma.user.create({
        data: {
          name: 'Surviving Vendor User',
          username: 'surviving_vendor',
          phone: '9991112223',
          email: 'surviving.vendor@example.com',
          role: 'vendor',
          passwordHash: 'dummyhash',
          city: 'Kadapa',
          state: 'Andhra Pradesh'
        }
      });

      const customerUser = await throwawayPrisma.user.create({
        data: {
          name: 'Surviving Customer User',
          phone: '9994445556',
          email: 'surviving.cust@example.com',
          role: 'user',
          passwordHash: 'dummyhash',
          city: 'Kadapa',
          state: 'Andhra Pradesh'
        }
      });

      const existingBranch = await throwawayPrisma.branch.create({
        data: {
          id: 'branch-existing-surviving-hall',
          vendorId: vendorUser.id,
          cityId: city.id,
          name: 'Surviving Royal Palace',
          kind: 'hall',
          addressLine: 'Main Street Kadapa'
        }
      });

      await throwawayPrisma.hallDetails.create({
        data: {
          branchId: existingBranch.id,
          capacity: 500,
          priceFullDayNonAc: 40000,
          priceFullDayAc: 60000,
          rooms: 4
        }
      });

      await throwawayPrisma.booking.create({
        data: {
          id: 'booking-existing-surviving',
          code: 'VED-SURVIVE-001',
          userId: customerUser.id,
          branchId: existingBranch.id,
          vendorId: vendorUser.id,
          kind: 'hall',
          eventType: 'Wedding',
          startDate: '2026-12-15',
          endDate: '2026-12-15',
          guests: 300,
          subtotal: 60000,
          gst: 10800,
          total: 70800,
          commission: 6000,
          vendorPayout: 54000,
          status: 'confirmed'
        }
      });

      const convo = await throwawayPrisma.conversation.create({
        data: {
          id: 'convo-existing-surviving',
          userId: customerUser.id,
          vendorId: vendorUser.id,
          branchId: existingBranch.id
        }
      });

      await throwawayPrisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: customerUser.id,
          senderRole: 'user',
          body: 'Hello, is the date available?'
        }
      });
    });

    after(async () => {
      if (throwawayPrisma) {
        await throwawayPrisma.$disconnect();
      }
      try {
        fs.rmSync(throwawayDir, { recursive: true, force: true });
      } catch {}
    });

    test('4. Default seed run without --allow-destructive preserves existing halls, bookings, and chats', async () => {
      // Temporarily override DATABASE_URL and TEST_DB to point to throwaway test database for seedDatabase
      const origDbUrl = process.env.DATABASE_URL;
      const origTestDb = process.env.TEST_DB;
      process.env.DATABASE_URL = `file:${throwawayDbPath}`;
      process.env.TEST_DB = throwawayDbPath;

      // Run seedDatabase WITHOUT allowDestructive on the populated throwaway DB
      await seedDatabase(throwawayPrisma, { mode: 'minimal' });

      // Restore environment variables
      if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
      else delete process.env.DATABASE_URL;
      if (origTestDb !== undefined) process.env.TEST_DB = origTestDb;
      else delete process.env.TEST_DB;

      // Verify the existing branch still exists
      const branch = await throwawayPrisma.branch.findUnique({
        where: { id: 'branch-existing-surviving-hall' }
      });
      assert.ok(branch, 'Existing branch must survive default seed');
      assert.equal(branch.name, 'Surviving Royal Palace');

      // Verify the existing booking still exists
      const booking = await throwawayPrisma.booking.findUnique({
        where: { id: 'booking-existing-surviving' }
      });
      assert.ok(booking, 'Existing booking must survive default seed');

      // Verify the existing conversation still exists
      const convo = await throwawayPrisma.conversation.findUnique({
        where: { id: 'convo-existing-surviving' }
      });
      assert.ok(convo, 'Existing conversation must survive default seed');

      const messageCount = await throwawayPrisma.message.count({
        where: { conversationId: 'convo-existing-surviving' }
      });
      assert.equal(messageCount, 1, 'Existing chat messages must survive default seed');
    });
  });
});
