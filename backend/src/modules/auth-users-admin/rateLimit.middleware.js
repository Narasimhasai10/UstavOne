import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';

export const authLimiter = rateLimit({
  windowMs: config.rateLimitLoginWindowMs || 15 * 60 * 1000,
  max: config.rateLimitLoginMax || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.'
    }
  }
});

export const apiLimiter = rateLimit({
  windowMs: config.rateLimitApiWindowMs || 15 * 60 * 1000,
  max: config.rateLimitApiMax || 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});
