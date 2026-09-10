/**
 * Notification configuration.
 *
 * Kept separate from `config/env.ts` so notification settings can be extended
 * without touching the security-critical config module, whose fail-fast
 * behaviour should stay easy to review.
 */

import { config as baseConfig } from '../config/env.js';

export const config = {
  ...baseConfig,
  notifications: {
    /**
     * `log`  — route external channels to the structured log (development/CI)
     * `live` — use real providers; unconfigured channels FAIL LOUDLY
     *
     * Defaults to `log` outside production so the pipeline is exercisable, and
     * to `live` in production so a missing integration is caught rather than
     * silently swallowing messages.
     */
    driver: process.env.NOTIFICATION_DRIVER ?? (baseConfig.isProduction ? 'live' : 'log'),

    /** Retry attempts before a delivery is marked failed. */
    maxAttempts: Number(process.env.NOTIFICATION_MAX_ATTEMPTS ?? 3),

    /** Sender identity, where the channel needs one. */
    fromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? 'noreply@campusharmony.local',
    fromName: process.env.NOTIFICATION_FROM_NAME ?? 'Campus Harmony ERP',

    /**
     * Origin of the deployed frontend, used only to build links this backend
     * sends outward (password reset, and any future email/SMS link) — the
     * API otherwise never needs to know where its frontend lives, since the
     * frontend always calls IN, never the reverse.
     */
    appUrl: process.env.FRONTEND_URL ?? 'http://localhost:8080',

    /**
     * SMTP transport for the `email` channel.
     *
     * `host` is the presence check `providerFor` uses to decide whether email
     * is configured — an empty host means "not configured", regardless of
     * whether the other fields carry stale values.
     */
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      /** Implicit TLS (port 465). Port 587 uses STARTTLS, which nodemailer negotiates itself. */
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? ''
    },

    /**
     * SMS transport for the `sms` channel — Twilio's REST API, chosen because
     * its contract is stable and independently verifiable, unlike several
     * India-specific gateways whose current API shape could not be confirmed
     * from documentation at the time this was written.
     *
     * DLT template registration (mandatory for transactional SMS to Indian
     * numbers, TRAI-mandated) is the institution's own compliance step —
     * no gateway or code path can satisfy it on their behalf, and the message
     * `body` passed to `send()` must match a template they have registered.
     */
    sms: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromNumber: process.env.TWILIO_FROM_NUMBER ?? ''
    }
  }
} as const;
