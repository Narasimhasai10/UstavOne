import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../../config.js';

// Ensure directories exist
const publicUploadsDir = path.join(config.uploadDir, 'public');
const privateDocsDir = path.join(config.uploadDir, 'private');

if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true });
if (!fs.existsSync(privateDocsDir)) fs.mkdirSync(privateDocsDir, { recursive: true });

export function getMagicMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  // WEBP: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  return null;
}

export const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.memoryStorage();

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: config.maxPhotoSizeBytes || 8 * 1024 * 1024 } // 8 MB
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

export async function saveUploadedFile({ buffer, originalname, purpose = 'photo', ownerId, isPublic = false }) {
  const detectedMime = getMagicMime(buffer);
  if (!detectedMime) {
    const error = new Error('Invalid file format. Only JPEG, PNG, WEBP, and PDF files are allowed.');
    error.status = 400;
    throw error;
  }

  const ext = detectedMime === 'application/pdf' ? '.pdf' : detectedMime === 'image/jpeg' ? '.jpg' : detectedMime === 'image/png' ? '.png' : '.webp';
  const randomName = `${crypto.randomUUID()}${ext}`;
  const targetDir = isPublic ? publicUploadsDir : privateDocsDir;
  const targetPath = path.join(targetDir, randomName);

  await fs.promises.writeFile(targetPath, buffer);

  return {
    path: targetPath,
    filename: randomName,
    mime: detectedMime,
    sizeBytes: buffer.length,
    isPublic,
    purpose,
    ownerId
  };
}
