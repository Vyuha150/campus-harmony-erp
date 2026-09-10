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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InAppProvider,
  LogProvider,
  EmailProvider,
  SmsProvider,
  providerFor,
  resetProviders
} from '../modules/notifications/providers.js';
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
      expect(message).toContain('TWILIO_ACCOUNT_SID');
      expect(message).toContain('NOTIFICATION_DRIVER=log');
    }
  });

  it('in_app still works in live mode — it needs no external service', async () => {
    process.env.NOTIFICATION_DRIVER = 'live';
    resetProviders();

    const result = await providerFor('in_app').send({ to: 'user@example.edu', body: 'hi' });
    expect(result.delivered).toBe(true);
  });

  describe('EmailProvider — real SMTP attempt, no mocked success', () => {
    it('fails loudly when the SMTP server is unreachable, rather than reporting delivered', async () => {
      // Port 1 refuses the connection immediately — a real network failure,
      // not a stubbed one. This is the property that matters: a
      // misconfigured SMTP host must surface as a thrown error, never as a
      // false `delivered: true`.
      const provider = new EmailProvider({
        host: '127.0.0.1',
        port: 1,
        secure: false,
        user: '',
        password: ''
      });

      await expect(
        provider.send({ to: 'student@example.edu', subject: 'Test', body: 'hi' })
      ).rejects.toThrow(IntegrationError);
    }, 15000);

    it('resolves to the real EmailProvider once SMTP_HOST is set', () => {
      process.env.NOTIFICATION_DRIVER = 'live';
      process.env.SMTP_HOST = '127.0.0.1';
      resetProviders();

      try {
        expect(providerFor('email')).toBeInstanceOf(EmailProvider);
      } finally {
        delete process.env.SMTP_HOST;
      }
    });
  });

  describe('SmsProvider — real Twilio request shape, network boundary stubbed', () => {
    const realFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('sends the exact Twilio contract: Basic auth, To/From/Body form fields', async () => {
      let captured: { url: string; init: RequestInit } | null = null;
      globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
        captured = { url: String(url), init: init! };
        return new Response(JSON.stringify({ sid: 'SM123' }), { status: 200 });
      }) as typeof fetch;

      const provider = new SmsProvider({
        accountSid: 'AC_test',
        authToken: 'secret_token',
        fromNumber: '+10000000000'
      });

      const result = await provider.send({ to: '+919999999999', body: 'OTP is 1234' });

      expect(result.delivered).toBe(true);
      expect(result.providerMessageId).toBe('SM123');
      expect(captured!.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json');
      expect(captured!.init.method).toBe('POST');
      const headers = captured!.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Basic ${Buffer.from('AC_test:secret_token').toString('base64')}`);
      const body = new URLSearchParams(captured!.init.body as string);
      expect(body.get('To')).toBe('+919999999999');
      expect(body.get('From')).toBe('+10000000000');
      expect(body.get('Body')).toBe('OTP is 1234');
    });

    it('fails loudly on a non-2xx Twilio response, rather than reporting delivered', async () => {
      globalThis.fetch = vi.fn(async () =>
        new Response('Authentication Error', { status: 401, statusText: 'Unauthorized' })
      ) as typeof fetch;

      const provider = new SmsProvider({ accountSid: 'bad', authToken: 'bad', fromNumber: '+1' });

      await expect(provider.send({ to: '+919999999999', body: 'hi' })).rejects.toThrow(IntegrationError);
    });
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

    // UnconfiguredProvider must NEVER be able to report success — that is
    // the exact shape of the original defect. Isolate its class body (up to
    // the next top-level `class`/`export function`) and check directly,
    // rather than a whole-file count, so adding a legitimately-succeeding
    // provider elsewhere in the file cannot loosen this check by accident.
    const unconfiguredBody = providers
      .split('class UnconfiguredProvider')[1]
      ?.split(/\nclass |\nexport function /)[0] ?? '';
    expect(unconfiguredBody).not.toContain('delivered: true');

    // EmailProvider and SmsProvider may report `delivered: true`, but only
    // after actually attempting the external call their name promises —
    // never unconditionally.
    const emailBody = providers.split('class EmailProvider')[1]?.split(/\nclass /)[0] ?? '';
    expect(emailBody.indexOf('sendMail')).toBeGreaterThan(-1);
    expect(emailBody.indexOf('sendMail')).toBeLessThan(emailBody.indexOf('delivered: true'));

    const smsBody = providers.split('class SmsProvider')[1]?.split(/\nclass /)[0] ?? '';
    expect(smsBody.indexOf('fetch(url')).toBeGreaterThan(-1);
    expect(smsBody.indexOf('fetch(url')).toBeLessThan(smsBody.indexOf('delivered: true'));
  });
});
