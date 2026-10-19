import { useEffect, useState } from 'react';
import { BadgePercent, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadField } from '@/components/ui/upload-field';
import { downloadUpload, fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const WAIVER_CATEGORIES: Record<string, string> = {
  merit: 'Merit scholarship',
  need_based: 'Need-based (family income)',
  sc_st_freeship: 'SC / ST / OBC freeship',
  sports: 'Sports quota',
  single_girl_child: 'Single girl child',
  other: 'Other'
};
const ROLE: Record<string, string> = { hod: 'HOD', dean: 'Dean', finance_officer: 'Finance Officer' };
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export interface WaivableFee { id: string; description: string; type: string; outstanding: number }

/**
 * Fee waiver / scholarship applications. The student applies against one fee;
 * HOD recommends, Dean recommends, Finance sanctions (SCHOLARSHIP_FEE_WAIVER).
 * A sanctioned amount comes off what is owed.
 */
export function FeeWaivers({ fees, onChanged }: { fees: WaivableFee[]; onChanged: () => void }) {
  const [requests, setRequests] = useState<any[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ feeRecordId: '', category: 'merit', requestedAmount: '', reason: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => fetchApi<any[]>('/students/fee-waivers').then((r) => setRequests(Array.isArray(r) ? r : [])).catch(() => setRequests([]));
  useEffect(() => { load(); }, []);

  const eligible = fees.filter((f) => f.outstanding > 0 && !(requests ?? []).some((r) => r.feeRecordId === f.id && r.status === 'pending'));
  const chosen = fees.find((f) => f.id === form.feeRecordId);

  const submit = async () => {
    const amount = Number(form.requestedAmount);
    if (!chosen || !(amount > 0) || form.reason.trim().length < 20) {
      toast({ title: 'Check the form', description: 'Choose a fee, an amount, and explain the request in at least 20 characters.', variant: 'destructive' });
      return;
    }
    if (amount > chosen.outstanding) {
      toast({ title: 'Amount too high', description: `At most ${rupees(chosen.outstanding)} is still owed on this fee.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let documentUrl: string | undefined;
      if (file) {
        // Readable by the people who decide it.
        const up: any = await uploadApi(file, 'fee-waivers', { visibility: 'role_restricted', allowedRoles: ['hod', 'dean', 'finance_officer', 'principal', 'registrar'] });
        documentUrl = up?.url;
      }
      await postApi('/students/fee-waivers', {
        feeRecordId: chosen.id, category: form.category, requestedAmount: amount, reason: form.reason.trim(),
        ...(documentUrl ? { documentUrl, documentName: file?.name } : {})
      });
      toast({ title: 'Application submitted', description: 'Your HOD reviews it first, then the Dean, then the Finance Officer.' });
      setOpen(false);
      setForm({ feeRecordId: '', category: 'merit', requestedAmount: '', reason: '' });
      setFile(null);
      load();
      onChanged();
    } catch (e: any) {
      toast({ title: 'Could not submit', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><BadgePercent className="h-5 w-5 text-primary" />Fee waivers & scholarships</CardTitle>
          <CardDescription>Apply for a waiver on a fee. It is reviewed by your HOD, the Dean, and then sanctioned by the Finance Officer.</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)} disabled={eligible.length === 0} title={eligible.length === 0 ? 'No fee with an amount owed' : undefined}>
          <Plus className="mr-1 h-4 w-4" />Apply for a waiver
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {requests?.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            You have not applied for a waiver.{eligible.length === 0 ? ' There is no fee with an amount still owed.' : ''}
          </p>
        )}
        {requests?.map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{WAIVER_CATEGORIES[r.category] ?? r.category} · {rupees(r.requestedAmount)}</p>
                <p className="text-xs text-muted-foreground">{r.fee?.description ?? 'Fee'} · applied {new Date(r.appliedAt).toLocaleDateString('en-IN')}</p>
              </div>
              <Badge className={cn('capitalize', r.status === 'approved' && 'bg-green-600 hover:bg-green-600', r.status === 'rejected' && 'bg-destructive hover:bg-destructive')} variant={r.status === 'pending' ? 'secondary' : 'default'}>
                {r.status === 'approved' ? `Sanctioned ${rupees(r.sanctionedAmount ?? r.requestedAmount)}` : r.status === 'pending' ? `With ${ROLE[r.steps.find((s: any) => s.state === 'current')?.role] ?? 'reviewer'}` : r.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">“{r.reason}”</p>
            {r.documentUrl && (
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => downloadUpload(r.documentUrl, r.documentName || 'document').catch(() => undefined)}>
                <FileText className="h-3.5 w-3.5" />{r.documentName || 'Supporting document'}
              </button>
            )}
            {r.steps?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {r.steps.map((s: any, i: number) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">→</span>}
                    <span className={cn(s.state === 'approved' && 'text-green-600', s.state === 'rejected' && 'text-destructive', s.state === 'current' && 'font-semibold text-amber-600', s.state === 'upcoming' && 'text-muted-foreground')}>
                      {s.state === 'approved' ? '✓' : s.state === 'rejected' ? '✗' : s.state === 'current' ? '●' : '○'} {ROLE[s.role] ?? s.role}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {r.steps?.filter((s: any) => s.note).map((s: any, i: number) => <p key={i} className="text-xs italic text-muted-foreground">{ROLE[s.role] ?? s.role}: “{s.note}”</p>)}
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for a fee waiver</DialogTitle>
            <DialogDescription>Your HOD, the Dean and the Finance Officer review it in that order. You are notified at each step.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fee</Label>
              <Select value={form.feeRecordId} onValueChange={(v) => setForm((p) => ({ ...p, feeRecordId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose the fee" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((f) => <SelectItem key={f.id} value={f.id}>{f.description} — {rupees(f.outstanding)} owed</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(WAIVER_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" min={1} max={chosen?.outstanding} value={form.requestedAmount} placeholder={chosen ? `up to ${chosen.outstanding}` : ''}
                  onChange={(e) => setForm((p) => ({ ...p, requestedAmount: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Why are you applying?</Label>
              <Textarea rows={3} placeholder="e.g. Family income below ₹2.5 lakh; certificate attached." value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
              <p className="mt-1 text-xs text-muted-foreground">{form.reason.trim().length}/20 characters minimum</p>
            </div>
            <UploadField label="Supporting document (optional)" file={file} accept=".pdf,.jpg,.jpeg,.png" helperText="Income / category certificate, mark sheet, sports certificate…" onFileSelect={setFile} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit application'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
