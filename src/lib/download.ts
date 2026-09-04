/**
 * Client-side file downloads.
 *
 * Extracted because a dozen screens carried a "report exported" toast with no
 * file behind it — the button claimed a download that never happened. Several
 * others hand-rolled the same Blob/createObjectURL/revoke dance. One helper
 * makes the real thing as little work as the fake one was.
 */

/** Escape a single CSV cell: quote it, and double any embedded quote. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Download `rows` as a CSV file.
 *
 * `headers` are written verbatim as the first line; every data cell is quoted,
 * so commas, quotes and newlines inside a value are safe.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>
): void {
  const csv = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

/** Download an arbitrary blob under `filename`. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
