import { prisma } from './db';
import { newId } from '../domain/hash';

export async function audit(params: {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  detail?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      id: newId('evt'),
      actorId: params.actorId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      detail: (params.detail ?? '').slice(0, 2000),
    },
  });
}

export async function notify(userId: string, title: string, body: string, href = '') {
  return prisma.notification.create({ data: { id: newId('ntf'), userId, title, body, href } });
}
