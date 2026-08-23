/**
 * Notification dispatch service.
 *
 * Implements the blueprint chain:
 *
 *   event → policy → recipients → channel → template → provider → delivery status
 *
 * THE DEFECT THIS CLOSES: the system stored messages and displayed `readCount`
 * and `totalRecipients`, but nothing ever sent anything. It reported delivery
 * statistics for messages that were never delivered.
 *
 * Every dispatch now creates one `NotificationDelivery` row per recipient per
 * channel, and that row carries the REAL outcome — including the failure reason
 * when a provider is unconfigured. "Sent" now means sent.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext } from '../../lib/service.js';
import { config } from '../../lib/config-notifications.js';
import { logger } from '../../lib/logger.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';
import { providerFor } from './providers.js';

const MODULE = 'notifications';

// ─── Templates ────────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  code: string;
  name: string;
  eventType: string;
  channel: string;
  subject?: string;
  body: string;
  version?: string;
}

/** Placeholders a template body/subject references, e.g. `{{studentName}}`. */
function extractPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))];
}

export async function createTemplate(input: CreateTemplateInput) {
  const ctx = requireContext();

  const placeholders = [
    ...new Set([
      ...extractPlaceholders(input.body),
      ...extractPlaceholders(input.subject ?? '')
    ])
  ];

  // Email and push carry a subject; SMS and in-app do not.
  if (['email', 'push'].includes(input.channel) && !input.subject) {
    throw new ValidationError(`A ${input.channel} template requires a subject.`);
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `NotificationTemplate:${(r as { id: string }).id}`,
      details: `Created ${input.channel} template ${input.code} for event ${input.eventType}`,
      newValue: { code: input.code, channel: input.channel, placeholders }
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.notificationTemplate.findFirst({
        where: {
          institutionId: ctx.institutionId,
          code: input.code,
          version: input.version ?? '1.0'
        }
      });
      if (existing) {
        throw new ConflictError(`Template ${input.code} v${input.version ?? '1.0'} already exists.`);
      }

      return db.notificationTemplate.create({
        data: {
          institutionId: ctx.institutionId,
          code: input.code,
          name: input.name,
          eventType: input.eventType,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          requiredVariables: placeholders,
          version: input.version ?? '1.0',
          isActive: true,
          createdBy: ctx.userId
        }
      });
    }
  );
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export interface CreatePolicyInput {
  code: string;
  name: string;
  eventType: string;
  channels: string[];
  targetRoles?: string[];
  notifySubject?: boolean;
  notifyGuardian?: boolean;
  delayMinutes?: number;
}

export async function createPolicy(input: CreatePolicyInput) {
  const ctx = requireContext();

  if (input.channels.length === 0) {
    throw new ValidationError('A notification policy must specify at least one channel.');
  }

  // A policy is useless if no template can render it — catch that at creation
  // rather than at 2am when a fee reminder silently produces nothing.
  const templates = await basePrisma.notificationTemplate.findMany({
    where: {
      institutionId: ctx.institutionId,
      eventType: input.eventType,
      channel: { in: input.channels },
      isActive: true
    },
    select: { channel: true }
  });

  const covered = new Set(templates.map((t) => t.channel));
  const missing = input.channels.filter((c) => !covered.has(c));

  if (missing.length > 0) {
    throw new BusinessRuleError(
      `No active template exists for event "${input.eventType}" on channel(s): ${missing.join(', ')}. ` +
        'Create the template before the policy that depends on it.',
      { missingChannels: missing }
    );
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `NotificationPolicy:${(r as { id: string }).id}`,
      details: `Created policy ${input.code} for ${input.eventType} on ${input.channels.join(', ')}`,
      newValue: { code: input.code, channels: input.channels, roles: input.targetRoles ?? [] },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.notificationPolicy.findFirst({
        where: { institutionId: ctx.institutionId, code: input.code }
      });
      if (existing) throw new ConflictError(`Policy ${input.code} already exists.`);

      return db.notificationPolicy.create({
        data: {
          institutionId: ctx.institutionId,
          code: input.code,
          name: input.name,
          eventType: input.eventType,
          channels: input.channels,
          targetRoles: input.targetRoles ?? [],
          notifySubject: input.notifySubject ?? true,
          notifyGuardian: input.notifyGuardian ?? false,
          delayMinutes: input.delayMinutes ?? 0,
          isActive: true,
          createdBy: ctx.userId
        }
      });
    }
  );
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface DispatchInput {
  eventType: string;
  /** Values substituted into the template's `{{placeholders}}`. */
  variables: Record<string, string | number>;
  /** The user the event concerns — notified when the policy says so. */
  subjectUserId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface DispatchResult {
  eventType: string;
  policiesMatched: number;
  deliveriesCreated: number;
  sent: number;
  failed: number;
  failures: Array<{ channel: string; recipient: string; reason: string }>;
}

/** Substitute `{{name}}` tokens, leaving unknown tokens visible rather than blank. */
function render(text: string, variables: Record<string, string | number>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in variables ? String(variables[key]) : match
  );
}

/**
 * Dispatch an event.
 *
 * Resolves every matching policy, expands it to recipients, renders the
 * template per channel, attempts delivery, and records the outcome.
 *
 * A provider failure does NOT abort the dispatch: one unconfigured channel must
 * not prevent the others from delivering. Failures are recorded per delivery
 * with their reason.
 */
export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  const ctx = requireContext();

  const policies = await basePrisma.notificationPolicy.findMany({
    where: { institutionId: ctx.institutionId, eventType: input.eventType, isActive: true }
  });

  if (policies.length === 0) {
    // Not an error — an event with no policy simply notifies nobody. Logged so
    // a missing policy is discoverable rather than invisible.
    logger.debug('Event dispatched with no matching policy', {
      module: MODULE,
      operation: 'dispatch',
      eventType: input.eventType
    });
    return {
      eventType: input.eventType,
      policiesMatched: 0,
      deliveriesCreated: 0,
      sent: 0,
      failed: 0,
      failures: []
    };
  }

  const failures: DispatchResult['failures'] = [];
  let deliveriesCreated = 0;
  let sent = 0;

  for (const policy of policies) {
    const channels = Array.isArray(policy.channels) ? (policy.channels as string[]) : [];
    const roles = Array.isArray(policy.targetRoles) ? (policy.targetRoles as string[]) : [];

    // ── Resolve recipients ────────────────────────────────────────────────
    const recipients: Array<{ userId: string | null; name: string; email: string }> = [];

    if (roles.length > 0) {
      const roleUsers = await basePrisma.user.findMany({
        where: { institutionId: ctx.institutionId, role: { in: roles } },
        select: { id: true, name: true, email: true }
      });
      recipients.push(
        ...roleUsers.map((u) => ({ userId: u.id, name: u.name, email: u.email }))
      );
    }

    if (policy.notifySubject && input.subjectUserId) {
      const subject = await basePrisma.user.findFirst({
        where: { id: input.subjectUserId, institutionId: ctx.institutionId },
        select: { id: true, name: true, email: true }
      });
      if (subject && !recipients.some((r) => r.userId === subject.id)) {
        recipients.push({ userId: subject.id, name: subject.name, email: subject.email });
      }
    }

    if (recipients.length === 0) continue;

    for (const channel of channels) {
      const template = await basePrisma.notificationTemplate.findFirst({
        where: {
          institutionId: ctx.institutionId,
          eventType: input.eventType,
          channel,
          isActive: true
        },
        orderBy: { version: 'desc' }
      });

      if (!template) continue; // policy creation already guards this

      const subject = template.subject ? render(template.subject, input.variables) : null;
      const body = render(template.body, input.variables);

      for (const recipient of recipients) {
        const delivery = await basePrisma.notificationDelivery.create({
          data: {
            institutionId: ctx.institutionId,
            eventType: input.eventType,
            templateId: template.id,
            policyCode: policy.code,
            userId: recipient.userId,
            recipientName: recipient.name,
            recipientAddress: recipient.email,
            channel,
            subject,
            body,
            status: 'pending',
            relatedEntityType: input.relatedEntityType ?? null,
            relatedEntityId: input.relatedEntityId ?? null
          }
        });
        deliveriesCreated += 1;

        // ── Attempt delivery ──────────────────────────────────────────────
        try {
          const provider = providerFor(channel);
          const outcome = await provider.send({
            to: recipient.email,
            recipientName: recipient.name,
            subject: subject ?? undefined,
            body
          });

          await basePrisma.notificationDelivery.updateMany({
            where: { id: delivery.id, institutionId: ctx.institutionId },
            data: {
              status: outcome.delivered ? 'sent' : 'failed',
              provider: outcome.provider,
              providerMessageId: outcome.providerMessageId ?? null,
              attempts: 1,
              lastAttemptAt: new Date(),
              sentAt: outcome.delivered ? new Date() : null,
              failedAt: outcome.delivered ? null : new Date(),
              failureReason: outcome.failureReason ?? null
            }
          });

          if (outcome.delivered) sent += 1;
        } catch (error) {
          // An unconfigured or failing provider must not abort the dispatch —
          // the other channels still have to go out.
          const reason = error instanceof Error ? error.message : String(error);

          await basePrisma.notificationDelivery.updateMany({
            where: { id: delivery.id, institutionId: ctx.institutionId },
            data: {
              status: 'failed',
              attempts: 1,
              lastAttemptAt: new Date(),
              failedAt: new Date(),
              failureReason: reason.slice(0, 500)
            }
          });

          failures.push({ channel, recipient: recipient.email, reason: reason.slice(0, 160) });

          logger.warn('Notification delivery failed', {
            module: MODULE,
            operation: 'dispatch',
            eventType: input.eventType,
            channel,
            errorCode: 'DELIVERY_FAILED'
          });
        }
      }
    }
  }

  return {
    eventType: input.eventType,
    policiesMatched: policies.length,
    deliveriesCreated,
    sent,
    failed: deliveriesCreated - sent,
    failures
  };
}

/**
 * Retry deliveries that previously failed.
 *
 * Stops at `maxAttempts` so a permanently misconfigured channel does not retry
 * forever. Intended to be driven by a scheduled job once one exists.
 */
export async function retryFailedDeliveries(limit = 50) {
  const ctx = requireContext();

  const pending = await basePrisma.notificationDelivery.findMany({
    where: {
      institutionId: ctx.institutionId,
      status: 'failed',
      attempts: { lt: config.notifications.maxAttempts }
    },
    take: limit,
    orderBy: { createdAt: 'asc' }
  });

  let recovered = 0;

  for (const delivery of pending) {
    try {
      const provider = providerFor(delivery.channel);
      const outcome = await provider.send({
        to: delivery.recipientAddress,
        recipientName: delivery.recipientName ?? undefined,
        subject: delivery.subject ?? undefined,
        body: delivery.body
      });

      await basePrisma.notificationDelivery.updateMany({
        where: { id: delivery.id, institutionId: ctx.institutionId },
        data: {
          status: outcome.delivered ? 'sent' : 'failed',
          provider: outcome.provider,
          providerMessageId: outcome.providerMessageId ?? null,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          sentAt: outcome.delivered ? new Date() : null
        }
      });

      if (outcome.delivered) recovered += 1;
    } catch (error) {
      await basePrisma.notificationDelivery.updateMany({
        where: { id: delivery.id, institutionId: ctx.institutionId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          failureReason: (error instanceof Error ? error.message : String(error)).slice(0, 500)
        }
      });
    }
  }

  return { attempted: pending.length, recovered };
}

/**
 * Delivery statistics.
 *
 * Unlike the previous `readCount`/`totalRecipients` figures, these are derived
 * from actual delivery attempts.
 */
export async function getDeliveryStatistics(eventType?: string) {
  const ctx = requireContext();

  const where = {
    institutionId: ctx.institutionId,
    ...(eventType ? { eventType } : {})
  };

  const [byStatus, byChannel, total] = await Promise.all([
    basePrisma.notificationDelivery.groupBy({
      by: ['status'],
      where,
      _count: { _all: true }
    }),
    basePrisma.notificationDelivery.groupBy({
      by: ['channel'],
      where,
      _count: { _all: true }
    }),
    basePrisma.notificationDelivery.count({ where })
  ]);

  const sentCount =
    byStatus.find((s) => s.status === 'sent')?._count._all ??
    0;

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    byChannel: Object.fromEntries(byChannel.map((c) => [c.channel, c._count._all])),
    deliveryRate: total > 0 ? Number(((sentCount / total) * 100).toFixed(1)) : 0
  };
}

/** A user's in-app inbox. */
export async function getInbox(userId: string, unreadOnly = false) {
  const ctx = requireContext();

  return basePrisma.notificationDelivery.findMany({
    where: {
      institutionId: ctx.institutionId,
      userId,
      channel: 'in_app',
      status: { in: ['sent', 'delivered'] },
      ...(unreadOnly ? { readAt: null } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function markRead(deliveryId: string, userId: string) {
  const ctx = requireContext();

  const delivery = await basePrisma.notificationDelivery.findFirst({
    where: { id: deliveryId, institutionId: ctx.institutionId, userId }
  });
  if (!delivery) throw new NotFoundError('Notification');

  const readAt = delivery.readAt ?? new Date();

  await basePrisma.notificationDelivery.updateMany({
    where: { id: deliveryId, institutionId: ctx.institutionId, userId },
    data: { readAt }
  });

  return { ...delivery, readAt };
}
