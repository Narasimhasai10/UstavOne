import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl) {
    return `file:${path.resolve(__dirname, '../../../database/utsavora.db')}`;
  }
  if (envUrl.startsWith('file:') && !path.isAbsolute(envUrl.slice(5).replace(/^\/([a-zA-Z]:)/, '$1'))) {
    // Relative file URL
    const rel = envUrl.slice(5).replace(/^\.\.\//, '');
    const absPath = path.resolve(__dirname, '../../..', rel);
    return `file:${absPath}`;
  }
  return envUrl;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});
