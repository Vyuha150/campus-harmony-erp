/**
 * Notification channel providers.
 *
 * THE DEFECT THIS ADDRESSES: the system stored messages, displayed `readCount`
 * and `totalRecipients`, and sent nothing. It reported delivery statistics for
 * messages that had never been delivered.
 *
 * DESIGN RULE — a provider either delivers or FAILS LOUDLY.
 *
 * There is deliberately no silent no-op. A provider that quietly discards
 * messages while returning success is how the original defect looked from the
 * outside: everything appeared fine, and nothing arrived. Unconfigured
 * providers therefore throw with an actionable message, and the delivery row
 * records the failure.
 *
 * `in_app` is fully implemented — it needs no external service. `email` (SMTP
 * via nodemailer) and `sms` (Twilio) are real implementations that activate
 * the moment their credentials are set — see `EmailProvider` and
 * `SmsProvider` below. `push` and `whatsapp` remain stubs until someone
 * provisions them. `log` exists for development so the pipeline can be
 * exercised end-to-end without a vendor.
 */

import nodemailer from 'nodemailer';
import { config } from '../../lib/config-notifications.js';
import { logger } from '../../lib/logger.js';
import { IntegrationError } from '../../lib/errors.js';

export interface OutboundMessage {
  to: string;
  recipientName?: string | undefined;
  subject?: string | undefined;
  body: string;
}

export interface DeliveryOutcome {
  delivered: boolean;
  provider: string;
  providerMessageId?: string | undefined;
  /** Present when `delivered` is false. */
  failureReason?: string | undefined;
}

export interface ChannelProvider {
  readonly channel: string;
  readonly name: string;
  send(message: OutboundMessage): Promise<DeliveryOutcome>;
}

/**
 * In-app delivery.
 *
 * "Delivery" here means the record exists and is queryable by the recipient —
 * which is genuinely true, so this reports success honestly.
 */
export class InAppProvider implements ChannelProvider {
  readonly channel = 'in_app';
  readonly name = 'in_app';

  async send(_message: OutboundMessage): Promise<DeliveryOutcome> {
    return { delivered: true, provider: this.name };
  }
}

/**
 * Development provider: writes the message to the structured log.
 *
 * Lets the whole pipeline — policy, template, recipients, delivery tracking —
 * be exercised and verified without a vendor account. It is explicitly a
 * development channel and reports itself as such.
 */
export class LogProvider implements ChannelProvider {
  readonly channel: string;
  readonly name = 'log';

  constructor(channel: string) {
    this.channel = channel;
  }

  async send(message: OutboundMessage): Promise<DeliveryOutcome> {
    logger.info('Notification dispatched (log provider)', {
      module: 'notifications',
      operation: 'send',
      channel: this.channel,
      to: message.to,
      subject: message.subject
    });

    return {
      delivered: true,
      provider: this.name,
      providerMessageId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
  }
}

/**
 * Real email delivery over SMTP.
 *
 * Failure is not caught and downgraded to `delivered: false` — it is
 * rethrown as `IntegrationError` so the caller's retry/failure-recording path
 * (see `notifications.service.ts`) runs, exactly as for `UnconfiguredProvider`.
 * The only difference from that class is that this one can also succeed.
 */
export class EmailProvider implements ChannelProvider {
  readonly channel = 'email';
  readonly name = 'smtp';

  private readonly transport: ReturnType<typeof nodemailer.createTransport>;

  constructor(smtp: { host: string; port: number; secure: boolean; user: string; password: string }) {
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined
    });
  }

  async send(message: OutboundMessage): Promise<DeliveryOutcome> {
    try {
      const info = await this.transport.sendMail({
        from: `"${config.notifications.fromName}" <${config.notifications.fromEmail}>`,
        to: message.to,
        subject: message.subject ?? '(no subject)',
        text: message.body
      });
      return { delivered: true, provider: this.name, providerMessageId: info.messageId };
    } catch (error) {
      throw new IntegrationError(
        `SMTP delivery to "${message.to}" failed: ${(error as Error).message}`,
        { channel: 'email' }
      );
    }
  }
}

/**
 * Real SMS delivery via Twilio's REST API.
 *
 * Twilio's contract (POST .../Messages.json, Basic Auth, To/From/Body form
 * fields) was verified against Twilio's own API reference before writing
 * this, rather than assumed.
 *
 * DLT template registration for Indian transactional SMS is a TRAI-mandated
 * compliance step the SENDING INSTITUTION must complete directly with their
 * chosen route — it is not something this or any code path can satisfy. The
 * `body` passed to `send()` must be the exact text of a template the
 * institution has registered, or the carrier will reject it regardless of
 * what this provider does.
 */
export class SmsProvider implements ChannelProvider {
  readonly channel = 'sms';
  readonly name = 'twilio';

  constructor(
    private readonly cfg: { accountSid: string; authToken: string; fromNumber: string }
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryOutcome> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: message.to,
        From: this.cfg.fromNumber,
        Body: message.body
      }).toString()
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new IntegrationError(`Twilio SMS delivery to "${message.to}" failed: ${detail}`, {
        channel: 'sms',
        status: response.status
      });
    }

    const payload = (await response.json()) as { sid?: string };
    return { delivered: true, provider: this.name, providerMessageId: payload.sid };
  }
}

/**
 * Provider awaiting configuration.
 *
 * Throws rather than pretending. The thrown error names exactly what is missing
 * and what to do, so the failure is actionable instead of mysterious.
 */
class UnconfiguredProvider implements ChannelProvider {
  readonly name = 'unconfigured';

  constructor(
    readonly channel: string,
    private readonly requirement: string
  ) {}

  async send(_message: OutboundMessage): Promise<DeliveryOutcome> {
    throw new IntegrationError(
      `The "${this.channel}" channel is not configured. ${this.requirement} ` +
        `Alternatively set NOTIFICATION_DRIVER=log to route this channel to the ` +
        `development log while integration is pending.`,
      { channel: this.channel }
    );
  }
}

const REQUIREMENTS: Record<string, string> = {
  email: 'Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.',
  sms:
    'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER. Note DLT template registration is mandatory for transactional SMS to Indian numbers regardless of gateway.',
  push:
    'Configure Firebase Cloud Messaging and implement PushProvider.',
  whatsapp:
    'Configure a WhatsApp Business API provider and implement WhatsappProvider. Template approval is required before sending.'
};

const providers = new Map<string, ChannelProvider>();

/**
 * Current driver, read at CALL TIME.
 *
 * It was originally resolved once at module load, which had two problems: the
 * setting could not be changed without a restart, and — more tellingly — it
 * could not be tested, because the module was already loaded by the time a test
 * set the variable. A setting that cannot be exercised is a setting nobody
 * verifies.
 */
function currentDriver(): string {
  return process.env.NOTIFICATION_DRIVER ?? config.notifications.driver;
}

/**
 * SMTP settings, read at CALL TIME — same rationale as `currentDriver()`.
 * `config.notifications.smtp` is a snapshot taken at module load and cannot
 * be exercised by a test that sets `SMTP_HOST` afterward.
 */
function currentSmtp() {
  return {
    host: process.env.SMTP_HOST ?? config.notifications.smtp.host,
    port: Number(process.env.SMTP_PORT ?? config.notifications.smtp.port),
    secure: (process.env.SMTP_SECURE ?? String(config.notifications.smtp.secure)) === 'true',
    user: process.env.SMTP_USER ?? config.notifications.smtp.user,
    password: process.env.SMTP_PASSWORD ?? config.notifications.smtp.password
  };
}

/** Twilio settings, read at CALL TIME — same rationale as `currentSmtp()`. */
function currentSms() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? config.notifications.sms.accountSid,
    authToken: process.env.TWILIO_AUTH_TOKEN ?? config.notifications.sms.authToken,
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? config.notifications.sms.fromNumber
  };
}

/**
 * Resolve the provider for a channel.
 *
 * `NOTIFICATION_DRIVER=log` routes every external channel to the log provider,
 * which is how the pipeline is exercised in development and CI.
 */
export function providerFor(channel: string): ChannelProvider {
  const cached = providers.get(channel);
  if (cached) return cached;

  let provider: ChannelProvider;

  // A real provider takes priority over the log driver whenever it is
  // genuinely configured — NOTIFICATION_DRIVER=log then means "everything
  // WITHOUT its own credentials goes to the log", not "ignore credentials
  // that are actually set". Checked before the `channel === 'in_app'` branch
  // is irrelevant to in_app, which has no external config to find.
  const smtp = currentSmtp();
  const sms = currentSms();

  if (channel === 'email' && smtp.host) {
    provider = new EmailProvider(smtp);
  } else if (channel === 'sms' && sms.accountSid) {
    provider = new SmsProvider(sms);
  } else if (channel === 'in_app') {
    provider = new InAppProvider();
  } else if (currentDriver() === 'log') {
    provider = new LogProvider(channel);
  } else {
    provider = new UnconfiguredProvider(
      channel,
      REQUIREMENTS[channel] ?? 'No provider implementation exists for this channel.'
    );
  }

  providers.set(channel, provider);
  return provider;
}

/** Test seam. */
export function resetProviders(): void {
  providers.clear();
}
