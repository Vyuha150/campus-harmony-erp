/**
 * Utility functions to safely normalize API response values.
 *
 * These helpers ensure components never receive undefined/NaN values and
 * provide consistent defaults for missing data.
 */

export function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function safeDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (value === null || value === undefined) return fallback;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? fallback : date;
}
