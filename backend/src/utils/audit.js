import { prisma } from './prisma.js';
import { logger } from './logger.js';

export async function createAuditLog({ actorId, action, entity, entityId, meta }) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        meta: meta ? JSON.stringify(meta) : null
      }
    });
  } catch (err) {
    logger.error({ err, action, entity }, 'Failed to create audit log');
    return null;
  }
}
