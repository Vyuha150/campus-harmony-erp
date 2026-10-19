import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Undo2, Save, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/**
 * End-semester results, one screen per step of the chain:
 *   faculty — enter paper marks (total = 40% internals + 60% paper)
 *   hod     — verify a paper, or return it to the faculty
 *   coe     — moderate a verified paper (accept, or revise a total with a reason)
 * then the CoE submits the department to the Dean, whose approval publishes.
 */
type Mode = 'faculty' | 'hod' | 'coe';

const SOURCE: Record<Mode, string> = { faculty: '/faculty/exam-marks', hod: '/hod/exam-results', coe: '/coe/moderation' };

export const STAGE: Record<string, { label: string; tone: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  awaiting_marks: { label: 'Awaiting marks', tone: 'outline' },
  entry_in_progress: { label: 'Entry in progress', tone: 'secondary' },
  entered: { label: 'Entered — with HOD', tone: 'secondary' },
  verified: { label: 'Verified — with CoE', tone: 'secondary' },
  moderated: { label: 'Moderated — ready for Dean', tone: 'default' },
  published: { label: 'Published', tone: 'default' },
  no_candidates: { label: 'No eligible candidates', tone: 'outline' }
};

const ROW_STATUS: Record<string, string> = { pending: '—', submitted: 'Entered', verified: 'Verified', moderated: 'Moderated', published: 'Published', revalued: 'Revalued' };

export function ExamResultSheets({ mode }: { mode: Mode }) {
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [dept, setDept] = useState('all');
  // faculty: paper marks being typed; coe: revised totals + reasons
  const [draft, setDraft] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [revise, setRevise] = useState<Record<string, { total: string; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const load = async (keep?: string) => {
    try {
      const d = await fetchApi<any[]>(SOURCE[mode]);
      const list = Array.isArray(d) ? d : [];
      setSheets(list);
      setSelected((cur) => keep ?? (list.some((x) => x.scheduleId === cur) ? cur : list[0]?.scheduleId ?? ''));
    } catch (e: any) {
      toast({ title: 'Could not load results', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [mode]);

  const visible = useMemo(() => (mode === 'coe' && dept !== 'all' ? sheets.filter((x) => x.department === dept) : sheets), [sheets, dept, mode]);
  const sheet = sheets.find((x) => x.scheduleId === selected) ?? null;

  useEffect(() => {
    if (!sheet) return;
    setDraft(Object.fromEntries(sheet.rows.map((r: any) => [r.studentProfileId, { marks: r.externalMarks === null ? '' : String(r.externalMarks), absent: !!r.absent && r.status !== 'pending' }])));
    setRevise({});
  }, [selected, sheets]);

  const editable = (r: any) => mode === 'faculty' && r.eligible && ['pending', 'submitted'].includes(r.status);
  const preview = (r: any) => {
    const d = draft[r.studentProfileId];
    if (!d || d.absent || d.marks === '' || r.internalMarks === null) return null;
    return Math.round(sheet.internalWeight * r.internalMarks + (1 - sheet.internalWeight) * (Number(d.marks) / sheet.maxMarks) * 100);
  };

  const saveMarks = async () => {
    if (!sheet) return;
    const entries = sheet.rows.filter(editable).map((r: any) => {
      const d = draft[r.studentProfileId];
      return d?.absent ? { studentProfileId: r.studentProfileId, absent: true } : { studentProfileId: r.studentProfileId, externalMarks: d?.marks === '' || d?.marks === undefined ? null : Number(d.marks) };
    });
    if (!entries.length) return;
    setBusy(true);
    try {
      const out: any = await putApi(`/faculty/exam-marks/${sheet.scheduleId}`, { entries });
      toast({ title: `Saved ${out.saved} result(s)`, description: out.skipped?.length ? `Skipped: ${out.skipped.map((s: any) => `${s.rollNumber} (${s.reason})`).join('; ')}` : 'Your HOD verifies them next.', variant: out.skipped?.length ? 'destructive' : 'default' });
      await load(sheet.scheduleId);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      await postApi(`/hod/exam-results/${sheet.scheduleId}/verify`, {});
      toast({ title: `${sheet.courseCode} verified`, description: 'Sent to the Controller of Examinations for moderation.' });
      await load(sheet.scheduleId);
    } catch (e: any) {
      toast({ title: 'Cannot verify yet', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    if (!sheet) return;
    if (returnReason.trim().length < 10) { toast({ title: 'Say what needs correcting', description: 'At least 10 characters.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await postApi(`/hod/exam-results/${sheet.scheduleId}/return`, { reason: returnReason.trim() });
      toast({ title: 'Returned to faculty', description: `${sheet.faculty} has been notified.` });
      setReturning(false); setReturnReason('');
      await load(sheet.scheduleId);
    } catch (e: any) {
      toast({ title: 'Could not return', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const moderate = async () => {
    if (!sheet) return;
    const adjustments = Object.entries(revise).filter(([, v]) => v.total !== '').map(([courseResultId, v]) => ({ courseResultId, revisedTotal: Number(v.total), reason: v.reason.trim() }));
    if (adjustments.some((a) => a.reason.length < 10)) { toast({ title: 'Each revision needs a reason', description: 'At least 10 characters; it is kept in the grade history.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await postApi(`/coe/moderation/${sheet.scheduleId}`, { adjustments });
      toast({ title: `${sheet.courseCode} moderated`, description: adjustments.length ? `${adjustments.length} total(s) revised.` : 'Accepted as verified.' });
      await load(sheet.scheduleId);
    } catch (e: any) {
      toast({ title: 'Cannot moderate yet', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!sheets.length) return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No end-semester papers are open for results right now.</p>;

  const departments = [...new Set(sheets.map((x) => x.department).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'coe' && departments.length > 1 && (
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-wrap gap-2">
          {visible.map((x) => (
            <Button key={x.scheduleId} size="sm" variant={x.scheduleId === selected ? 'default' : 'outline'} onClick={() => setSelected(x.scheduleId)}>
              {x.courseCode}
              <span className="ml-2 text-[10px] font-normal opacity-80">· {STAGE[x.stage]?.label ?? x.stage}</span>
            </Button>
          ))}
        </div>
      </div>

      {sheet && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{sheet.courseCode} – {sheet.courseName}</CardTitle>
                <CardDescription>
                  {sheet.sessionName} · Semester {sheet.semester} · {sheet.academicYear} · Paper out of {sheet.maxMarks} · Faculty: {sheet.faculty}
                  <br />Course total = {Math.round(sheet.internalWeight * 100)}% internals + {Math.round((1 - sheet.internalWeight) * 100)}% paper, rounded. {sheet.entered}/{sheet.eligibleCount} eligible candidates entered.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {mode === 'faculty' && <Button onClick={saveMarks} disabled={busy || !sheet.rows.some(editable)}><Save className="mr-1 h-4 w-4" />{busy ? 'Saving…' : 'Save marks'}</Button>}
                {mode === 'hod' && (
                  <>
                    <Button variant="outline" onClick={() => setReturning(true)} disabled={busy || !['entered', 'verified', 'entry_in_progress'].includes(sheet.stage)}><Undo2 className="mr-1 h-4 w-4" />Return to faculty</Button>
                    <Button onClick={verify} disabled={busy || sheet.stage !== 'entered'}><CheckCircle className="mr-1 h-4 w-4" />Verify & send to CoE</Button>
                  </>
                )}
                {mode === 'coe' && <Button onClick={moderate} disabled={busy || sheet.stage !== 'verified'}><ShieldCheck className="mr-1 h-4 w-4" />{Object.values(revise).some((v) => v.total !== '') ? 'Apply revisions & moderate' : 'Accept & moderate'}</Button>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Internal /100</TableHead>
                  <TableHead className="text-center">Paper /{sheet.maxMarks}</TableHead>
                  {mode === 'faculty' && <TableHead className="text-center">Absent</TableHead>}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead>Status</TableHead>
                  {mode === 'coe' && sheet.stage === 'verified' && <TableHead>Revise total (optional)</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.rows.map((r: any) => (
                  <TableRow key={r.studentProfileId} className={r.eligible ? '' : 'opacity-50'}>
                    <TableCell className="font-mono text-xs">{r.rollNumber}</TableCell>
                    <TableCell className="text-sm">{r.name}{!r.eligible && <Badge variant="outline" className="ml-2 text-[10px]">Not eligible</Badge>}</TableCell>
                    <TableCell className="text-center">{r.internalMarks ?? <span className="text-xs text-destructive">missing</span>}</TableCell>
                    <TableCell className="text-center">
                      {editable(r) ? (
                        <Input type="number" min={0} max={sheet.maxMarks} className="mx-auto w-20 text-center" disabled={draft[r.studentProfileId]?.absent}
                          value={draft[r.studentProfileId]?.marks ?? ''} onChange={(e) => setDraft((p) => ({ ...p, [r.studentProfileId]: { ...p[r.studentProfileId], marks: e.target.value } }))} />
                      ) : r.absent ? 'AB' : r.externalMarks ?? '—'}
                    </TableCell>
                    {mode === 'faculty' && (
                      <TableCell className="text-center">
                        {editable(r) && <Checkbox checked={!!draft[r.studentProfileId]?.absent} onCheckedChange={(v) => setDraft((p) => ({ ...p, [r.studentProfileId]: { ...p[r.studentProfileId], absent: !!v } }))} />}
                      </TableCell>
                    )}
                    <TableCell className="text-center font-medium">{editable(r) ? preview(r) ?? r.totalMarks ?? '—' : r.totalMarks ?? '—'}</TableCell>
                    <TableCell className="text-center">{r.grade ? <Badge variant={r.grade === 'F' ? 'destructive' : 'secondary'}>{r.grade}</Badge> : '—'}</TableCell>
                    <TableCell className="text-xs">{r.eligible ? ROW_STATUS[r.status] ?? r.status : 'Attendance shortage'}</TableCell>
                    {mode === 'coe' && sheet.stage === 'verified' && (
                      <TableCell>
                        {r.status === 'verified' && (
                          <div className="flex gap-1">
                            <Input type="number" className="h-8 w-20" placeholder={String(r.totalMarks ?? '')} value={revise[r.courseResultId]?.total ?? ''}
                              onChange={(e) => setRevise((p) => ({ ...p, [r.courseResultId]: { total: e.target.value, reason: p[r.courseResultId]?.reason ?? '' } }))} />
                            {revise[r.courseResultId]?.total && (
                              <Input className="h-8 w-48" placeholder="Reason (min 10 chars)" value={revise[r.courseResultId]?.reason ?? ''}
                                onChange={(e) => setRevise((p) => ({ ...p, [r.courseResultId]: { total: p[r.courseResultId]?.total ?? '', reason: e.target.value } }))} />
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={returning} onOpenChange={setReturning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {sheet?.courseCode} marks to {sheet?.faculty}</DialogTitle>
            <DialogDescription>The faculty member is notified and can correct the marks; verify again afterwards.</DialogDescription>
          </DialogHeader>
          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. Paper totals for CH2024CS005 and CS011 look swapped" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(false)}>Cancel</Button>
            <Button onClick={sendBack} disabled={busy}>Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
