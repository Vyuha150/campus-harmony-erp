import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/**
 * Revaluation requests students raise from Examinations → Revaluation after
 * results are published. The CoE records the re-marked paper; a changed mark
 * becomes a new attempt (the original stays on record) and the CGPA is
 * recomputed. There was no screen for this: requests were filed and never seen.
 */
export function COERevaluations() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [paper, setPaper] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchApi<any[]>('/coe/revaluations').then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const complete = async () => {
    if (!open || paper === '') return;
    setBusy(true);
    try {
      const out: any = await postApi(`/coe/revaluations/${open.id}/complete`, { revisedExternal: Number(paper), ...(remarks.trim() ? { remarks: remarks.trim() } : {}) });
      toast({ title: `${open.requestNumber} completed`, description: out?.marksChanged ? `Grade ${out.oldGrade} → ${out.newGrade}; CGPA ${out.cgpa}. The student has been notified.` : 'Marks unchanged. The student has been notified.' });
      setOpen(null); setPaper(''); setRemarks('');
      load();
    } catch (e: any) {
      toast({ title: 'Could not complete', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status !== 'completed');
  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No revaluation requests.</p>}
      {[...pending, ...rows.filter((r) => r.status === 'completed')].map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{r.requestNumber} · {r.courseCode} {r.courseName}</p>
              <p className="text-xs text-muted-foreground">{r.studentName} ({r.rollNumber}) · requested {new Date(r.requestedAt).toLocaleDateString('en-IN')}</p>
              <p className="mt-1 text-xs">Internal {r.internalMarks ?? '—'} · Paper {r.externalMarks ?? '—'}/{r.maxMarks} · Total {r.originalMarks} ({r.grade})</p>
              {r.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {r.reason}</p>}
              {r.status === 'completed' && <p className="mt-1 text-xs">Outcome: {r.marksChanged ? `total ${r.originalMarks} → ${r.revisedMarks}` : 'unchanged'}{r.remarks ? ` — ${r.remarks}` : ''}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{String(r.status).replace(/_/g, ' ')}</Badge>
              {r.status !== 'completed' && <Button size="sm" onClick={() => { setOpen(r); setPaper(String(r.externalMarks ?? '')); setRemarks(''); }}>Record outcome</Button>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revaluation {open?.requestNumber}</DialogTitle>
            <DialogDescription>{open?.studentName} · {open?.courseCode}. Enter the paper marks after re-evaluation; the total is recomputed with the internals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Paper marks after revaluation (out of {open?.maxMarks})</Label>
              <Input type="number" min={0} max={open?.maxMarks} value={paper} onChange={(e) => setPaper(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Q4(b) re-marked by second examiner" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={complete} disabled={busy || paper === ''}>{busy ? 'Saving…' : 'Complete revaluation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
