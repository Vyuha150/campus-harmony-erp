import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * Each staff member's pay structure. Monthly payroll is generated from these
 * with PF (12% on the ₹15,000 wage ceiling), AP professional tax and TDS
 * under the new tax regime computed on the server.
 */
export function SalaryStructures() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetchApi<any[]>('/finance/salary-structures').then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const open = (r: any) => setEdit({
    userId: r.userId, name: r.name, employeeId: r.employeeId ?? '', basic: String(r.structure?.basic ?? ''), daPercent: String(r.structure?.daPercent ?? 46),
    hraPercent: String(r.structure?.hraPercent ?? 16), otherAllowances: String(r.structure?.otherAllowances ?? 0), pfApplicable: r.structure?.pfApplicable ?? true,
    ptApplicable: r.structure?.ptApplicable ?? true, bankAccount: r.structure?.bankAccount ?? '', ifsc: r.structure?.ifsc ?? '', pan: r.structure?.pan ?? ''
  });
  const save = async () => {
    setBusy(true);
    try {
      const out: any = await putApi(`/finance/salary-structures/${edit.userId}`, {
        employeeId: edit.employeeId.trim(), basic: Number(edit.basic), daPercent: Number(edit.daPercent), hraPercent: Number(edit.hraPercent), otherAllowances: Number(edit.otherAllowances) || 0,
        pfApplicable: edit.pfApplicable, ptApplicable: edit.ptApplicable,
        ...(edit.bankAccount.trim() ? { bankAccount: edit.bankAccount.trim() } : {}), ...(edit.ifsc.trim() ? { ifsc: edit.ifsc.trim().toUpperCase() } : {}), ...(edit.pan.trim() ? { pan: edit.pan.trim().toUpperCase() } : {})
      });
      toast({ title: `${edit.name}: structure saved`, description: `Gross ${inr(out.monthly.gross)} · net ${inr(out.monthly.net)} a month` });
      setEdit(null); load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary structures</CardTitle>
        <CardDescription>Basic, DA and HRA (% of basic) and other allowances. Deductions: PF 12% of basic + DA up to the ₹15,000 ceiling, Andhra Pradesh professional tax, and income tax (TDS) under the new regime with the ₹75,000 standard deduction.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Employee ID</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Gross / month</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net / month</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell><p className="text-sm font-medium">{r.name}</p><p className="text-xs capitalize text-muted-foreground">{r.designation ?? r.role.replace(/_/g, ' ')}{r.department ? ` · ${r.department}` : ''}</p></TableCell>
                <TableCell className="text-xs">{r.employeeId ?? '—'}</TableCell>
                <TableCell className="text-right">{r.structure ? inr(r.structure.basic) : <Badge variant="outline">Not set</Badge>}</TableCell>
                <TableCell className="text-right">{r.monthly ? inr(r.monthly.gross) : '—'}</TableCell>
                <TableCell className="text-right text-xs text-destructive">{r.monthly ? r.monthly.deductions.map((d: any) => `${d.name.split(' (')[0]} ${inr(d.amount)}`).join(' · ') || '—' : '—'}</TableCell>
                <TableCell className="text-right font-semibold">{r.monthly ? inr(r.monthly.net) : '—'}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => open(r)}>{r.structure ? 'Edit' : 'Set up'}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Salary structure — {edit?.name}</DialogTitle><DialogDescription>Monthly figures; the payslip shows each component.</DialogDescription></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Employee ID</Label><Input value={edit.employeeId} onChange={(e) => setEdit({ ...edit, employeeId: e.target.value })} /></div>
            <div className="space-y-1"><Label>Basic pay (₹)</Label><Input type="number" value={edit.basic} onChange={(e) => setEdit({ ...edit, basic: e.target.value })} /></div>
            <div className="space-y-1"><Label>DA (% of basic)</Label><Input type="number" value={edit.daPercent} onChange={(e) => setEdit({ ...edit, daPercent: e.target.value })} /></div>
            <div className="space-y-1"><Label>HRA (% of basic)</Label><Input type="number" value={edit.hraPercent} onChange={(e) => setEdit({ ...edit, hraPercent: e.target.value })} /></div>
            <div className="space-y-1"><Label>Other allowances (₹)</Label><Input type="number" value={edit.otherAllowances} onChange={(e) => setEdit({ ...edit, otherAllowances: e.target.value })} /></div>
            <div className="space-y-1"><Label>PAN</Label><Input value={edit.pan} onChange={(e) => setEdit({ ...edit, pan: e.target.value })} maxLength={10} /></div>
            <div className="space-y-1"><Label>Bank account</Label><Input value={edit.bankAccount} onChange={(e) => setEdit({ ...edit, bankAccount: e.target.value })} /></div>
            <div className="space-y-1"><Label>IFSC</Label><Input value={edit.ifsc} onChange={(e) => setEdit({ ...edit, ifsc: e.target.value })} maxLength={11} /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.pfApplicable} onCheckedChange={(v) => setEdit({ ...edit, pfApplicable: !!v })} />Deduct PF</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.ptApplicable} onCheckedChange={(v) => setEdit({ ...edit, ptApplicable: !!v })} />Deduct professional tax</label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={busy || !edit?.employeeId || !Number(edit?.basic)}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
