import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/download';
import type { FinanceReport } from '@/lib/financeReports';

/** On-screen view of a server-built finance report, with a CSV download. */
export function ReportPreviewDialog({ report, subtitle, onClose }: { report: FinanceReport | null; subtitle?: string; onClose: () => void }) {
  const fileName = `${(report?.title ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'}.csv`;
  return (
    <Dialog open={!!report} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report?.title}</DialogTitle>
          <DialogDescription>{[subtitle, `${report?.recordCount ?? 0} rows`].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        {report && (report.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No records for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="report-preview-table">
              <thead><tr className="border-b bg-muted/50">{report.columns.map((c) => <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">{c}</th>)}</tr></thead>
              <tbody>{report.rows.map((row, i) => <tr key={i} className="border-b last:border-0">{row.map((v, j) => <td key={j} className="px-3 py-2">{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ))}
        {report && report.rows.length > 0 && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => downloadCsv(fileName, report.columns, report.rows)}><Download className="mr-1 h-3 w-3" />Download CSV</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
