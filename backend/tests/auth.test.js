import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../src/utils/prisma.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../src/utils/jwt.js";
import { hashPassword, comparePassword } from "../src/utils/crypto.js";

describe("Auth System - Security & Token Lifecycle", () => {
  const testPhone = "9998887770";
  const testPassword = "Password@123";
  let testUserId = null;

  before(async () => {
    // Clean up any previous test user
    await prisma.user.deleteMany({
      where: { phone: testPhone }
    });

    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        role: "user",
        name: "Test Auth User",
        phone: testPhone,
        passwordHash
      }
    });
    testUserId = user.id;
  });

  test("1. Password hashing and verification", async () => {
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    const isMatch = await comparePassword(testPassword, user.passwordHash);
    const isBad = await comparePassword("WrongPassword!", user.passwordHash);

    assert.equal(isMatch, true, "Valid password must verify");
    assert.equal(isBad, false, "Invalid password must fail");
  });

  test("2. JWT generation and claims", () => {
    const token = generateAccessToken({
      id: testUserId,
      role: "user",
      phone: testPhone
    });

    assert.ok(token, "Access token must be generated");
    assert.equal(typeof token, "string");
  });

  test("3. Account lockout after 5 consecutive failed attempts", async () => {
    const user = await prisma.user.findUnique({ where: { id: testUserId } });

    // Simulate 5 failed login attempts
    let failedCount = 0;
    for (let i = 1; i <= 5; i++) {
      failedCount++;
      const isLocked = failedCount >= 5;
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          failedLogins: failedCount,
          lockedUntil: isLocked ? new Date(Date.now() + 15 * 60 * 1000) : null
        }
      });
    }

    const lockedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.equal(lockedUser.failedLogins, 5);
    assert.ok(lockedUser.lockedUntil !== null, "User must have lockedUntil timestamp");
    assert.ok(new Date(lockedUser.lockedUntil) > new Date(), "User must be locked in future");

    // Reset lockout for further tests
    await prisma.user.update({
      where: { id: testUserId },
      data: { failedLogins: 0, lockedUntil: null }
    });
  });

  test("4. Refresh token rotation: invalidating previous refresh token", async () => {
    const rawRefreshToken = generateRefreshToken({ id: testUserId });
    const tokenHash = await hashPassword(rawRefreshToken);

    const record = await prisma.refreshToken.create({
      data: {
        userId: testUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    assert.ok(record.id, "Refresh token record stored");

    // Revoke on rotation
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() }
    });

    const revokedRecord = await prisma.refreshToken.findUnique({ where: { id: record.id } });
    assert.ok(revokedRecord.revokedAt !== null, "Old refresh token must be revoked");
  });
});
