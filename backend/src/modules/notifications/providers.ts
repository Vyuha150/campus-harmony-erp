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
 * `in_app` is fully implemented — it needs no external service. `email`, `sms`,
 * `push` and `whatsapp` require credentials and a vendor account, so they are
 * stubs until someone provisions them. `log` exists for development so the
 * pipeline can be exercised end-to-end without a vendor.
 */

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
  email:
    'Install an email client (e.g. `npm install nodemailer`), implement EmailProvider, and set SMTP_HOST / SMTP_USER / SMTP_PASSWORD.',
  sms:
    'Choose an Indian SMS gateway (MSG91, Gupshup, Twilio), implement SmsProvider, and set the gateway credentials. Note DLT template registration is mandatory for transactional SMS in India.',
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
 * Resolve the provider for a channel.
 *
 * `NOTIFICATION_DRIVER=log` routes every external channel to the log provider,
 * which is how the pipeline is exercised in development and CI.
 */
export function providerFor(channel: string): ChannelProvider {
  const cached = providers.get(channel);
  if (cached) return cached;

  let provider: ChannelProvider;

  if (channel === 'in_app') {
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
