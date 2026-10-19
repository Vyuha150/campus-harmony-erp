import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { UploadField } from '@/components/ui/upload-field';
import { fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const WHO: Record<string, string> = { faculty: 'course teacher', hod: 'HOD', dean: 'Dean', coe: 'Controller of Examinations' };

/** The student's exam registration: papers, eligibility, condonation, hall ticket. */
export function ExamRegistration() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetchApi<any[]>('/students/exam-registrations').then((d) => setSessions(Array.isArray(d) ? d : [])).catch(() => setSessions([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const request = async () => {
    if (reason.trim().length < 20) { toast({ title: 'Explain the shortage', description: 'At least 20 characters.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      let documentUrl: string | undefined;
      if (file) documentUrl = (await uploadApi<any>(file, 'condonation', { visibility: 'role_restricted', allowedRoles: ['faculty', 'hod', 'dean', 'coe'] }))?.url;
      await postApi(`/students/exam-registrations/${asking.registrationId}/condonation`, { reason: reason.trim(), ...(documentUrl ? { documentUrl } : {}) });
      toast({ title: 'Condonation requested', description: 'Your course teacher, HOD, Dean and the CoE review it in turn.' });
      setAsking(null); setReason(''); setFile(null);
      load();
    } catch (e: any) {
      toast({ title: 'Request failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!sessions.length) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">You are not registered for any exam session yet. The exam branch registers students when registration opens.</CardContent></Card>;

  return (
    <div className="space-y-6">
      {sessions.map((s) => {
        const blocked = s.papers.filter((p: any) => !p.isEligible);
        return (
          <Card key={s.sessionId}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>Semester {s.semester} · {s.academicYear} · minimum attendance {s.minAttendancePercentage}%</CardDescription>
                </div>
                {s.hallTicket ? (
                  <Button onClick={() => window.open(`/print/hall-ticket/${s.sessionId}`, '_blank', 'noopener')}><Download className="mr-1 h-4 w-4" />Hall ticket {s.hallTicket.ticketNumber}</Button>
                ) : (
                  <Badge variant={blocked.length ? 'destructive' : 'secondary'} className="gap-1">
                    {blocked.length ? <><AlertTriangle className="h-3 w-3" />{blocked.length} paper(s) blocked</> : <><Ticket className="h-3 w-3" />Hall ticket not issued yet</>}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Course</TableHead><TableHead>Venue</TableHead><TableHead>Attendance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {s.papers.map((p: any) => (
                    <TableRow key={p.registrationId}>
                      <TableCell>{day(p.examDate)}</TableCell><TableCell>{p.startTime}–{p.endTime}</TableCell>
                      <TableCell><p className="font-medium">{p.courseCode}</p><p className="text-xs text-muted-foreground">{p.courseName}</p></TableCell>
                      <TableCell>{p.venue ?? '—'}</TableCell>
                      <TableCell>{p.attendancePercentage != null ? `${p.attendancePercentage}%` : '—'}</TableCell>
                      <TableCell>
                        {p.isEligible ? (
                          <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />{p.status === 'condoned' ? 'Condoned' : 'Eligible'}</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="destructive">Blocked</Badge>
                            <p className="max-w-xs text-xs text-muted-foreground">{Array.isArray(p.reasons) ? p.reasons.join(' ') : ''}</p>
                            {p.condonation?.status === 'pending' && <p className="text-xs">Condonation with the {WHO[p.condonation.waitingOn] ?? p.condonation.waitingOn}</p>}
                            {p.condonation?.status === 'rejected' && <p className="text-xs text-destructive">Condonation refused{p.condonation.note ? `: ${p.condonation.note}` : ''}</p>}
                            {p.feesCleared && p.condonation?.status !== 'pending' && <Button size="sm" variant="outline" onClick={() => { setAsking({ ...p, session: s.name }); setReason(''); setFile(null); }}>Request condonation</Button>}
                            {!p.feesCleared && <p className="text-xs">Clear your dues with the Finance office to unblock.</p>}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!asking} onOpenChange={(o) => { if (!o) setAsking(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request condonation — {asking?.courseCode}</DialogTitle>
            <DialogDescription>Attendance {asking?.attendancePercentage}% · {asking?.session}. Your course teacher, HOD, Dean and the CoE decide in turn.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why were you absent? e.g. hospitalised 12–20 Sep (certificate attached); represented the college at the inter-university meet" rows={4} />
          <UploadField label="Supporting document (medical certificate, OD letter …)" file={file} accept=".pdf,.jpg,.jpeg,.png" helperText="Visible only to those who decide." onFileSelect={setFile} />
          <DialogFooter><Button variant="outline" onClick={() => setAsking(null)}>Cancel</Button><Button onClick={request} disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
