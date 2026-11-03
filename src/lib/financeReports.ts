import { fetchApi, postApi } from '@/lib/apiService';
import { downloadCsv } from '@/lib/download';

export interface FinanceReport { title: string; columns: string[]; rows: Array<Array<string | number>>; recordCount: number }

/** Build a finance report on the server without downloading it (for on-screen preview). */
export async function buildFinanceReport(type: string, startDate?: string, endDate?: string): Promise<FinanceReport> {
  const r = await postApi<any>('/finance/reports/generate', { type, ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) });
  return { title: String(r?.title ?? type), columns: r?.columns ?? [], rows: r?.rows ?? [], recordCount: Number(r?.recordCount ?? 0) };
}

/** Build a finance report on the server and download it as CSV. Returns the row count. */
export async function downloadFinanceReport(type: string, startDate?: string, endDate?: string): Promise<number> {
  const r = await postApi<any>('/finance/reports/generate', { type, ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) });
  const name = String(r?.title ?? type).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadCsv(`${name || 'report'}.csv`, r?.columns ?? [], r?.rows ?? []);
  return Number(r?.recordCount ?? 0);
}

/** Tally Prime / ERP 9 voucher import file (XML) for a period. */
export async function downloadTallyExport(from: string, to: string): Promise<{ receipts: number; journals: number; payments: number }> {
  const r = await fetchApi<any>(`/finance/tally-export?from=${from}&to=${to}`);
  const blob = new Blob([r.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tally-vouchers-${from}-to-${to}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return r.counts;
}
