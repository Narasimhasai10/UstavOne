import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * StorageAdapter interface:
 * - save({ buffer, originalname, mime, isPublic }): Promise<{ path: string, filename: string, url: string, mime: string, sizeBytes: number }>
 * - getUrl(pathOrFilename, options?): string
 * - remove(pathOrFilename): Promise<boolean>
 */

export class LocalStorageAdapter {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.resolve(__dirname, '../../../uploads/public');
    this.publicPrefix = options.publicPrefix || '/uploads/public';
    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch {
        // May be read-only filesystem in some deployment containers
      }
    }
  }

  async save({ buffer, originalname, mime, isPublic = true }) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    let ext = '.jpg';
    if (mime === 'image/jpeg') ext = '.jpg';
    else if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    else if (mime === 'image/svg+xml') ext = '.svg';
    else if (mime === 'application/pdf') ext = '.pdf';
    else if (originalname) {
      const parsedExt = path.extname(originalname);
      if (parsedExt) ext = parsedExt;
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const url = `${this.publicPrefix}/${filename}`;
    return {
      path: url,
      filename,
      url,
      mime: mime || 'application/octet-stream',
      sizeBytes: buffer.length
    };
  }

  getUrl(pathOrFilename) {
    if (!pathOrFilename) return '';
    if (
      pathOrFilename.startsWith('http://') ||
      pathOrFilename.startsWith('https://') ||
      pathOrFilename.startsWith('data:')
    ) {
      return pathOrFilename;
    }
    if (pathOrFilename.startsWith('/uploads/')) {
      return pathOrFilename;
    }
    return `${this.publicPrefix}/${pathOrFilename.replace(/^\/+/, '')}`;
  }

  async remove(pathOrFilename) {
    if (!pathOrFilename) return true;
    try {
      const filename = path.basename(pathOrFilename);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (err) {
      console.warn('[LocalStorageAdapter] Remove error:', err.message);
      return false;
    }
  }
}

export class CloudinaryStorageAdapter {
  constructor(options = {}) {
    this.cloudName = options.cloudName || config.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = options.apiKey || config.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY;
    this.apiSecret = options.apiSecret || config.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET;
    this.folder = options.folder || config.cloudinaryFolder || process.env.CLOUDINARY_FOLDER || 'utsavora';

    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true
      });
    } else if (process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL,
        secure: true
      });
    }
  }

  isConfigured() {
    return Boolean(
      (this.cloudName && this.apiKey && this.apiSecret) ||
      process.env.CLOUDINARY_URL
    );
  }

  async save({ buffer, originalname, mime, isPublic = true, publicId = null }) {
    if (!this.isConfigured()) {
      console.warn('[CloudinaryStorageAdapter] Cloudinary not configured; falling back to LocalStorageAdapter');
      const fallback = new LocalStorageAdapter();
      return fallback.save({ buffer, originalname, mime, isPublic });
    }

    const subFolder = isPublic ? 'photos' : 'documents';
    const folder = `${this.folder}/${subFolder}`;
    const resourceType = mime && mime.startsWith('image/') ? 'image' : 'auto';
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      type: isPublic ? 'upload' : 'authenticated',
      access_mode: isPublic ? 'public' : 'authenticated'
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
      uploadOptions.overwrite = true;
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, res) => {
        if (error) return reject(error);
        resolve(res);
      });
      stream.end(buffer);
    });

    const fileUrl = result.secure_url || result.url;
    return {
      path: fileUrl,
      filename: result.public_id,
      url: fileUrl,
      mime: mime || `${result.resource_type}/${result.format}`,
      sizeBytes: result.bytes || buffer.length
    };
  }

  getUrl(pathOrFilename, options = {}) {
    if (!pathOrFilename) return '';
    if (
      pathOrFilename.startsWith('http://') ||
      pathOrFilename.startsWith('https://') ||
      pathOrFilename.startsWith('data:')
    ) {
      return pathOrFilename;
    }
    if (pathOrFilename.startsWith('/uploads/')) {
      return pathOrFilename;
    }

    const isPublic = options.isPublic !== false;
    if (!isPublic) {
      try {
        return cloudinary.url(pathOrFilename, {
          sign_url: true,
          type: 'authenticated',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          secure: true
        });
      } catch {
        return cloudinary.url(pathOrFilename, { secure: true });
      }
    }

    return cloudinary.url(pathOrFilename, { secure: true });
  }

  async remove(pathOrFilename) {
    if (!pathOrFilename) return true;
    if (!this.isConfigured()) {
      const fallback = new LocalStorageAdapter();
      return fallback.remove(pathOrFilename);
    }

    try {
      let publicId = pathOrFilename;
      if (pathOrFilename.includes('res.cloudinary.com')) {
        const parts = pathOrFilename.split('/upload/');
        if (parts.length > 1) {
          const afterUpload = parts[1].replace(/^v\d+\//, '');
          publicId = afterUpload.substring(0, afterUpload.lastIndexOf('.')) || afterUpload;
        }
      }

      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      return true;
    } catch (err) {
      console.warn('[CloudinaryStorageAdapter] Remove error:', err.message);
      return false;
    }
  }
}

export function getStorageAdapter() {
  const provider = (process.env.STORAGE_PROVIDER || config.storageProvider || 'local').toLowerCase();
  if (provider === 'cloudinary') {
    return new CloudinaryStorageAdapter();
  }
  return new LocalStorageAdapter();
}

export const storageAdapter = getStorageAdapter();
export default storageAdapter;
