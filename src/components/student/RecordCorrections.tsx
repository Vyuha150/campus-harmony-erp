import { useEffect, useState } from 'react';
import { FilePen, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadField } from '@/components/ui/upload-field';
import { fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/**
 * A student asks the Registrar to correct an official record (name, date of
 * birth …). The profile itself is read-only for these fields: they appear on
 * certificates, so the Registrar verifies the proof and applies the change.
 */
export const CORRECTABLE_FIELDS: Record<string, string> = {
  name: 'Full name',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  category: 'Category (GEN / OBC / SC / ST / EWS)',
  home_state: 'Home state (domicile)',
  nationality: 'Nationality'
};

const STATUS_STYLE: Record<string, 'default' | 'secondary' | 'destructive'> = { approved: 'default', pending: 'secondary', rejected: 'destructive' };

export function RecordCorrections() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ field: 'name', newValue: '', reason: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => fetchApi<any[]>('/students/record-changes').then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.newValue.trim()) {
      toast({ title: 'Enter the corrected value', variant: 'destructive' });
      return;
    }
    if (form.reason.trim().length < 10) {
      toast({ title: 'Explain the correction', description: 'At least 10 characters, e.g. which document shows the right value.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let documentUrl: string | undefined;
      if (file) {
        const up: any = await uploadApi(file, 'record-changes', { visibility: 'role_restricted', allowedRoles: ['registrar'] });
        documentUrl = up?.url;
      }
      await postApi('/students/record-changes', { field: form.field, newValue: form.newValue.trim(), reason: form.reason.trim(), ...(documentUrl ? { documentUrl } : {}) });
      toast({ title: 'Correction requested', description: 'The Registrar checks your proof and updates your record.' });
      setOpen(false);
      setForm({ field: 'name', newValue: '', reason: '' });
      setFile(null);
      load();
    } catch (e: any) {
      toast({ title: 'Request failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><FilePen className="h-5 w-5" /> Record Corrections</CardTitle>
            <CardDescription>Your name, date of birth and similar details appear on certificates — the Registrar corrects them after checking proof.</CardDescription>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Request a correction</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No correction requests yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{CORRECTABLE_FIELDS[r.field] ?? r.field}</p>
              <p className="text-xs text-muted-foreground">{r.oldValue || '—'} → <span className="font-medium text-foreground">{r.newValue}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Requested {new Date(r.requestedAt).toLocaleDateString('en-IN')}</p>
            </div>
            <Badge variant={STATUS_STYLE[r.status] ?? 'secondary'} className="capitalize">{r.status === 'pending' ? 'With Registrar' : r.status}</Badge>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a record correction</DialogTitle>
            <DialogDescription>Attach the document that shows the correct value (10th certificate, Aadhaar, caste certificate …).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What is wrong?</Label>
              <Select value={form.field} onValueChange={(v) => setForm({ ...form, field: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CORRECTABLE_FIELDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Correct value</Label>
              <Input type={form.field === 'date_of_birth' ? 'date' : 'text'} value={form.newValue} onChange={(e) => setForm({ ...form, newValue: e.target.value })} placeholder={form.field === 'name' ? 'As on your 10th certificate' : ''} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Spelling of my surname differs from my 10th certificate" />
            </div>
            <UploadField label="Proof (recommended)" file={file} accept=".pdf,.jpg,.jpeg,.png" helperText="Only the Registrar's office can open it." onFileSelect={setFile} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
