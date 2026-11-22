import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * StorageAdapter interface:
 * - save({ buffer, originalname, mime, isPublic }): Promise<{ path: string, filename: string, url: string, mime: string, sizeBytes: number }>
 * - getUrl(pathOrFilename: string): string
 * - remove(pathOrFilename: string): Promise<boolean>
 */
export class LocalStorageAdapter {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.resolve(__dirname, '../../../uploads/public');
    this.publicPrefix = options.publicPrefix || '/uploads/public';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
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
      mime,
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
      console.warn('[Storage] Remove error:', err.message);
      return false;
    }
  }
}

export const storageAdapter = new LocalStorageAdapter();
export default storageAdapter;
