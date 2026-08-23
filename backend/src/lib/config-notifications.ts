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
    fromName: process.env.NOTIFICATION_FROM_NAME ?? 'Campus Harmony ERP'
  }
} as const;
