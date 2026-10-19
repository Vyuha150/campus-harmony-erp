/**
 * In-app notifications: rows in NotificationDelivery with channel `in_app`,
 * which is what `/api/notifications/inbox` (the header bell) reads.
 *
 * Best effort by design — a failed notification is logged, never thrown, so
 * it cannot undo the approval or reminder that triggered it.
 */
import { basePrisma } from './prisma.js';
import { logger } from './logger.js';

export interface InAppMessage {
  eventType: string;
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface Audience {
  userIds?: string[];
  roles?: string[];
  /** Narrows `roles` to one department (a CSE leave should not reach the ECE HOD). */
  departmentId?: string | null;
  /** Never notify the person who caused the event. */
  excludeUserId?: string;
}

export async function notifyInApp(institutionId: string, audience: Audience, message: InAppMessage): Promise<number> {
  try {
    const or: Record<string, unknown>[] = [];
    if (audience.userIds?.length) or.push({ id: { in: audience.userIds } });
    if (audience.roles?.length) {
      or.push({ role: { in: audience.roles }, ...(audience.departmentId ? { departmentId: audience.departmentId } : {}) });
    }
    if (or.length === 0) return 0;

    const users = await basePrisma.user.findMany({
      where: { institutionId, OR: or as never },
      select: { id: true, name: true, email: true }
    });
    const recipients = users.filter((u) => u.id !== audience.excludeUserId);
    if (recipients.length === 0) return 0;

    const now = new Date();
    await basePrisma.notificationDelivery.createMany({
      data: recipients.map((u) => ({
        institutionId,
        eventType: message.eventType,
        userId: u.id,
        recipientName: u.name,
        recipientAddress: u.email,
        channel: 'in_app',
        subject: message.subject,
        body: message.body,
        status: 'sent',
        provider: 'in_app',
        attempts: 1,
        lastAttemptAt: now,
        sentAt: now,
        readAt: null,
        relatedEntityType: message.relatedEntityType ?? null,
        relatedEntityId: message.relatedEntityId ?? null
      }))
    });
    return recipients.length;
  } catch (error) {
    logger.warn('In-app notification failed', { module: 'notifications', eventType: message.eventType, error: String(error) });
    return 0;
  }
}
