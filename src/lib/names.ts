/**
 * The name to greet someone by.
 *
 * `name.split(' ')[0]` greeted Dr. S. Menon as "Dr." — the title, taken for a
 * first name. Titles and bare initials are skipped; if nothing else is left
 * the full name is used.
 */
const TITLE = /^(dr|mr|mrs|ms|miss|prof|professor|shri|smt|sri)\.?$/i;

export function firstName(fullName: string | null | undefined): string {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const given = parts.find((part) => !TITLE.test(part) && !/^[A-Za-z]\.?$/.test(part));
  return given ?? parts.filter((part) => !TITLE.test(part)).join(' ') ?? '';
}
