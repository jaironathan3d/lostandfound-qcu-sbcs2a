import { prisma } from '../config/prisma';

export function logAudit(userId: string, action: string, entity: string, entityId: string) {
  return prisma.auditLog.create({ data: { userId, action, entity, entityId } });
}

export function notify(userId: string, message: string) {
  return prisma.notification.create({ data: { userId, message } });
}