import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:../database/utsavora.db',
  jwtSecret: process.env.JWT_SECRET || 'utsavora-dev-jwt-super-secret-key-32chars-min',
  refreshSecret: process.env.REFRESH_SECRET || 'utsavora-dev-refresh-super-secret-key-32chars-min',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,null')
    .split(',')
    .map(s => s.trim()),
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads'),
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  holdMinutes: parseInt(process.env.HOLD_MINUTES || '10', 10),
  commissionRate: parseInt(process.env.COMMISSION_RATE || '10', 10),
  gstPercent: parseInt(process.env.GST_PERCENT || '18', 10),
  warningLimit: 3,
  maxBranchPhotos: parseInt(process.env.MAX_BRANCH_PHOTOS || '12', 10),
  maxPhotoSizeBytes: parseInt(process.env.MAX_PHOTO_SIZE_BYTES || String(8 * 1024 * 1024), 10)
};
