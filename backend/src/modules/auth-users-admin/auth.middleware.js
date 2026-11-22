import { verifyAccessToken } from '../../utils/jwt.js';
import { prisma } from '../../utils/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing or invalid.'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED_OR_INVALID',
          message: 'Session expired or token invalid.'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'USER_INACTIVE_OR_DELETED',
          message: 'Account not found or has been deactivated.'
        }
      });
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
        }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied: insufficient permissions.' }
      });
    }
    next();
  };
}
