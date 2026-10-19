import { useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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

const TYPE: Record<string, string> = { leave: 'Leave', medical: 'Medical leave', on_duty: 'On duty (OD)' };
const VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { approved: 'default', pending: 'secondary', rejected: 'destructive', cancelled: 'outline' };
const d = (x: string) => new Date(x).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Leave, medical leave and on-duty requests; the HOD approves. Approved OD counts as attendance. */
export default function StudentLeave() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'leave', fromDate: '', toDate: '', reason: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetchApi<any[]>('/students/leave-requests').then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.fromDate || !form.toDate) { toast({ title: 'Choose the dates', variant: 'destructive' }); return; }
    if (form.reason.trim().length < 10) { toast({ title: 'Give a reason', description: 'At least 10 characters.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      let documentUrl: string | undefined;
      if (file) documentUrl = (await uploadApi<any>(file, 'student-leave', { visibility: 'role_restricted', allowedRoles: ['hod', 'faculty'] }))?.url;
      await postApi('/students/leave-requests', { ...form, reason: form.reason.trim(), ...(documentUrl ? { documentUrl } : {}) });
      toast({ title: 'Request sent to your HOD' });
      setOpen(false); setForm({ type: 'leave', fromDate: '', toDate: '', reason: '' }); setFile(null);
      load();
    } catch (e: any) {
      toast({ title: 'Could not submit', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="page-title">Leave & On-duty</h1>
            <p className="page-description">Apply for leave, medical leave or on-duty. Your HOD approves; approved on-duty counts as attendance.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New request</Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />My requests</CardTitle><CardDescription>Most recent first</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>}
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{TYPE[r.type] ?? r.type} · {d(r.fromDate)}{r.toDate !== r.fromDate ? ` – ${d(r.toDate)}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                  {r.note && <p className="mt-1 text-xs">HOD: {r.note}</p>}
                </div>
                <Badge variant={VARIANT[r.status] ?? 'outline'} className="capitalize">{r.status === 'pending' ? 'With HOD' : r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New leave / on-duty request</DialogTitle><DialogDescription>On-duty is for college work — competitions, events, placement drives.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>From</Label><Input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
              <div className="space-y-1"><Label>To</Label><Input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={form.type === 'on_duty' ? 'e.g. Representing the college at the IEEE hackathon, JNTU Kakinada' : 'e.g. Sister’s wedding at Guntur'} /></div>
            </div>
            <UploadField label={form.type === 'medical' ? 'Medical certificate' : 'Supporting document (optional)'} file={file} accept=".pdf,.jpg,.jpeg,.png" helperText="Visible to your HOD and faculty." onFileSelect={setFile} />
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
