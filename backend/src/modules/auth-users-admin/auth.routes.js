import express from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { hashPassword, comparePassword, hashToken, generateRandomToken } from '../../utils/crypto.js';
import { signAccessToken } from '../../utils/jwt.js';
import { requireAuth } from './auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authLimiter } from './rateLimit.middleware.js';
import { createAuditLog } from '../../utils/audit.js';
import { uploadPhoto, saveUploadedFile } from '../vendor-docs-storage/upload.middleware.js';
import { verifyDocument } from '../vendor-docs-storage/documentVerifier.js';

const router = express.Router();

// Validation Schemas
const userSignupSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6-9.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters with a letter and a number.')
    .regex(/[a-zA-Z]/, 'Password must contain a letter.')
    .regex(/[0-9]/, 'Password must contain a number.'),
  confirmPassword: z.string().optional(),
  upiId: z.string().optional(),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    source: z.string().optional()
  }).optional()
});

const userLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number.'),
  password: z.string().min(1, 'Password is required.')
});

const vendorSignupSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username must be 3-20 characters (letters, numbers, underscore).'),
  password: z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/),
  name: z.string().min(1, 'Owner name is required.'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number.'),
  email: z.string().email().optional().nullable(),
  owns: z.enum(['hall', 'catering', 'both']),
  businessNameHall: z.string().optional(),
  businessNameCatering: z.string().optional(),
  tradeLicenceNumber: z.string().optional(),
  fssaiNumber: z.string().optional(),
  termsVersion: z.string().default('v1.0')
});

const vendorLoginSchema = z.object({
  username: z.string().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1, 'Password is required.')
}).refine(data => Boolean(data.username || data.identifier), {
  message: 'Username is required.',
  path: ['username']
});

// Helper to create session
async function createSession(user) {
  const token = signAccessToken({ userId: user.id, role: user.role });
  const rawRefreshToken = generateRandomToken(48);
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  // User sanitized output (privacy: no phone/email exposed when serialized for non-self)
  const safeUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    username: user.username,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    vendorProfile: user.vendorProfile
  };

  return {
    accessToken: token,
    refreshToken: rawRefreshToken,
    user: safeUser
  };
}

// 1. User Sign Up
router.post('/user/signup', validate({ body: userSignupSchema }), async (req, res, next) => {
  try {
    const { name, phone, email, password, location } = req.body;

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(409).json({
        error: { code: 'PHONE_EXISTS', message: 'An account with this mobile number already exists.' }
      });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' }
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        role: 'user',
        name: name.trim(),
        phone,
        email: email.trim().toLowerCase(),
        passwordHash,
        city: location?.city || 'Kadapa',
        state: location?.state || 'Andhra Pradesh',
        pincode: location?.pincode || '516001',
        locationSource: location?.source || 'manual'
      }
    });

    await createAuditLog({ actorId: user.id, action: 'USER_SIGNUP', entity: 'User', entityId: user.id });

    const session = await createSession(user);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// 2. User Login
router.post('/user/login', authLimiter, validate({ body: userLoginSchema }), async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const genericMsg = 'Mobile number or password is incorrect.';

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { vendorProfile: true }
    });

    if (!user || user.role !== 'user') {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: genericMsg } });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked. Please try again after 15 minutes.' }
      });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      const fails = user.failedLogins + 1;
      const shouldLock = fails >= 5;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: fails,
          lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null
        }
      });
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: genericMsg } });
    }

    // Reset failed logins on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null }
    });

    await createAuditLog({ actorId: user.id, action: 'USER_LOGIN', entity: 'User', entityId: user.id });

    const session = await createSession(user);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// 3. Pre-signup Document Verification for Vendors
const handleDocVerify = async (req, res, next) => {
  try {
    const { type, number, businessName, branchId } = req.body;
    const file = req.file;

    const result = await verifyDocument({
      type,
      number,
      file,
      businessName,
      currentVendorId: req.user?.id || null
    });

    res.json({ data: result, ...result });
  } catch (err) {
    next(err);
  }
};

router.post('/vendors/signup/documents/verify', uploadPhoto.single('file'), handleDocVerify);
router.post('/verify-document', uploadPhoto.single('file'), handleDocVerify);

// 4. Vendor Sign Up
router.post('/vendor/signup', validate({ body: vendorSignupSchema }), async (req, res, next) => {
  try {
    const {
      username,
      password,
      name,
      phone,
      email,
      owns,
      businessNameHall,
      businessNameCatering,
      tradeLicenceNumber,
      fssaiNumber,
      termsVersion
    } = req.body;

    const cleanUser = username.trim().toLowerCase();
    const existingUsername = await prisma.user.findUnique({ where: { username: cleanUser } });
    if (existingUsername) {
      return res.status(409).json({
        error: { code: 'USERNAME_EXISTS', message: 'This username is already taken. Please choose another.' }
      });
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(409).json({
        error: { code: 'PHONE_EXISTS', message: 'An account with this mobile number already exists.' }
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        role: 'vendor',
        name: name.trim(),
        username: cleanUser,
        phone,
        email: email ? email.trim().toLowerCase() : null,
        passwordHash,
        city: 'Kadapa',
        state: 'Andhra Pradesh'
      }
    });

    const vendorProfile = await prisma.vendorProfile.create({
      data: {
        userId: user.id,
        ownerType: owns,
        hallBusinessName: businessNameHall || null,
        cateringBusinessName: businessNameCatering || null,
        termsVersion: termsVersion || 'v1.0',
        status: 'active'
      }
    });

    // Link uploaded documents if numbers provided
    if (tradeLicenceNumber) {
      await prisma.document.create({
        data: {
          vendorId: user.id,
          type: 'trade_licence',
          number: tradeLicenceNumber,
          status: 'verified'
        }
      });
    }

    if (fssaiNumber) {
      await prisma.document.create({
        data: {
          vendorId: user.id,
          type: 'fssai',
          number: fssaiNumber,
          status: 'verified'
        }
      });
    }

    await createAuditLog({ actorId: user.id, action: 'VENDOR_SIGNUP', entity: 'VendorProfile', entityId: user.id });

    user.vendorProfile = vendorProfile;
    const session = await createSession(user);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// 5. Vendor Login
router.post('/vendor/login', authLimiter, validate({ body: vendorLoginSchema }), async (req, res, next) => {
  try {
    const { password } = req.body;
    const rawUsername = req.body.username || req.body.identifier || '';
    const genericMsg = 'Username or password is incorrect.';

    const cleanUser = rawUsername.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username: cleanUser },
      include: { vendorProfile: true }
    });

    if (!user || user.role !== 'vendor') {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: genericMsg } });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_LOCKED', message: 'Account is temporarily locked. Please try again after 15 minutes.' }
      });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      const fails = user.failedLogins + 1;
      const shouldLock = fails >= 5;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: fails,
          lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null
        }
      });
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: genericMsg } });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null }
    });

    await createAuditLog({ actorId: user.id, action: 'VENDOR_LOGIN', entity: 'User', entityId: user.id });

    const session = await createSession(user);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// 6. Refresh Token (Rotates on use)
router.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Refresh token is required.' } });
    }

    const tokenHash = hashToken(refreshToken);
    const existing = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { vendorProfile: true } } }
    });

    if (!existing || !existing.user || !existing.user.isActive) {
      return res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token invalid or revoked.' } });
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });

    // Create new pair
    const session = await createSession(existing.user);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// 7. Logout (Revokes refresh token)
router.post('/auth/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() }
      });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// 8. Get Current Profile (/me)
router.get('/me', requireAuth, (req, res) => {
  const safeUser = {
    id: req.user.id,
    name: req.user.name,
    phone: req.user.phone,
    email: req.user.email,
    role: req.user.role,
    username: req.user.username,
    city: req.user.city,
    state: req.user.state,
    pincode: req.user.pincode,
    photoFileId: req.user.photoFileId,
    vendorProfile: req.user.vendorProfile
  };
  res.json({ user: safeUser });
});

// 9. Patch Current Profile
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email, city, state, pincode, location } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (city) updates.city = city.trim();
    if (state) updates.state = state.trim();
    if (pincode) updates.pincode = pincode.trim();
    if (location) {
      if (location.city) updates.city = location.city;
      if (location.state) updates.state = location.state;
      if (location.pincode) updates.pincode = location.pincode;
      if (location.source) updates.locationSource = location.source;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      include: { vendorProfile: true }
    });

    await createAuditLog({ actorId: req.user.id, action: 'UPDATE_PROFILE', entity: 'User', entityId: req.user.id });

    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

// 10. Update Password
router.post('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Current and new password are required.' } });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'New passwords do not match.' } });
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password must be at least 8 characters with a letter and a number.' } });
    }

    const isValid = await comparePassword(currentPassword, req.user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' } });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash }
    });

    await createAuditLog({ actorId: req.user.id, action: 'CHANGE_PASSWORD', entity: 'User', entityId: req.user.id });

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

// 11. Upload Profile Photo
router.post('/me/photo', requireAuth, uploadPhoto.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Photo file is required.' } });
    }

    const saved = await saveUploadedFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      purpose: 'avatar',
      ownerId: req.user.id,
      isPublic: true
    });

    const fileRec = await prisma.fileRecord.create({ data: saved });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { photoFileId: fileRec.id }
    });

    res.json({ success: true, photoFileId: fileRec.id, url: `/api/v1/files/${fileRec.id}` });
  } catch (err) {
    next(err);
  }
});

export default router;
