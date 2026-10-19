import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchApi } from '@/lib/apiService';

/** The signed-in staff member's paid payslips, each printable as a PDF. */
export function MyPayslips() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetchApi<any[]>('/account/payslips').then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])); }, []);
  if (rows === null) return <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-6">
        {!rows.length && <p className="py-4 text-center text-sm text-muted-foreground">No payslips yet. They appear here once Finance disburses your salary.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Salary slip – {p.month} {p.year}</p>
                <p className="text-xs text-muted-foreground">Net ₹{Number(p.netSalary).toLocaleString('en-IN')} · paid {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.open(`/print/payslip/${p.id}`, '_blank', 'noopener')}><Download className="mr-1 h-4 w-4" />Download</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
