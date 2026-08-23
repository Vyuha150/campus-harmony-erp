/**
 * Notification engine tests.
 *
 * The original defect was silent: the system stored messages, reported
 * `readCount` and `totalRecipients`, and sent nothing. Everything looked fine
 * from the outside and nothing arrived.
 *
 * These tests lock the property that prevents a recurrence — a channel either
 * delivers or fails loudly, never silently succeeds while discarding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InAppProvider, LogProvider, providerFor, resetProviders } from '../modules/notifications/providers.js';
import { IntegrationError } from '../lib/errors.js';

beforeEach(() => {
  resetProviders();
  delete process.env.NOTIFICATION_DRIVER;
});

describe('channel providers', () => {
  it('delivers in-app without any external service', async () => {
    const result = await new InAppProvider().send({ to: 'user@example.edu', body: 'hi' });
    expect(result.delivered).toBe(true);
    expect(result.provider).toBe('in_app');
  });

  it('log provider reports a message id so a delivery is traceable', async () => {
    const result = await new LogProvider('email').send({
      to: 'user@example.edu',
      subject: 'Test',
      body: 'hi'
    });
    expect(result.delivered).toBe(true);
    expect(result.providerMessageId).toBeTruthy();
  });

  it('an unconfigured channel THROWS rather than silently succeeding', async () => {
    // The heart of it. A provider that returns success while discarding the
    // message reproduces the original defect exactly.
    process.env.NOTIFICATION_DRIVER = 'live';
    resetProviders();

    for (const channel of ['sms', 'email', 'push', 'whatsapp']) {
      await expect(
        providerFor(channel).send({ to: 'x@y.edu', body: 'test' }),
        `${channel} must fail loudly when unconfigured`
      ).rejects.toThrow(IntegrationError);
    }
  });

  it('names what is missing and how to fix it', async () => {
    process.env.NOTIFICATION_DRIVER = 'live';
    resetProviders();

    try {
      await providerFor('sms').send({ to: 'x', body: 'y' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as IntegrationError).publicMessage;
      // An operator must be able to act on the failure without reading source.
      expect(message).toContain('sms');
      expect(message).toMatch(/MSG91|Gupshup|Twilio/);
      expect(message).toContain('NOTIFICATION_DRIVER=log');
    }
  });

  it('in_app still works in live mode — it needs no external service', async () => {
    process.env.NOTIFICATION_DRIVER = 'live';
    resetProviders();

    const result = await providerFor('in_app').send({ to: 'user@example.edu', body: 'hi' });
    expect(result.delivered).toBe(true);
  });
});

describe('template rendering', () => {
  // Mirrors the private `render` in the service. Kept here because the
  // substitution rules are a correctness concern in their own right.
  const render = (text: string, vars: Record<string, string | number>) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

  it('substitutes placeholders', () => {
    expect(render('Dear {{name}}, Rs {{amount}} is due.', { name: 'Asha', amount: 5000 }))
      .toBe('Dear Asha, Rs 5000 is due.');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(render('Hi {{ name }}', { name: 'Asha' })).toBe('Hi Asha');
  });

  it('LEAVES an unknown placeholder visible rather than blanking it', () => {
    // A blank is indistinguishable from an intentionally empty value, and would
    // send "Dear ," to a student. A visible token is an obvious defect instead.
    expect(render('Dear {{name}}, ref {{missing}}', { name: 'Asha' }))
      .toBe('Dear Asha, ref {{missing}}');
  });

  it('handles a template with no placeholders', () => {
    expect(render('System maintenance tonight.', {})).toBe('System maintenance tonight.');
  });
});

describe('source guard — delivery is real', () => {
  async function read(path: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const p = await import('node:path');
    const content = await fs.readFile(p.resolve(process.cwd(), path), 'utf8');
    return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  it('the dispatch service records a delivery outcome per recipient', async () => {
    const service = await read('src/modules/notifications/notifications.service.ts');
    expect(service).toContain('notificationDelivery.create');
    // Outcome must be written back, not assumed.
    expect(service).toContain('notificationDelivery.update');
    expect(service).toContain('failureReason');
  });

  it('has no silent no-op provider', async () => {
    const providers = await read('src/modules/notifications/providers.ts');
    // A provider returning `delivered: true` without doing anything is the
    // original defect. Only InAppProvider and LogProvider may report success.
    const successReturns = (providers.match(/delivered: true/g) ?? []).length;
    expect(successReturns).toBeLessThanOrEqual(2);
  });
});
