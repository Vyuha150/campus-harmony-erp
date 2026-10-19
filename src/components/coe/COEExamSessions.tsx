import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle, Plus, Send, Ticket, Trash2, Users, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteApi, fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/**
 * Exam timetable, registration and hall tickets (the CoE's exam branch):
 * create a session → add papers → open registration → register students
 * (attendance and fee checks run per paper) → close registration → issue hall
 * tickets. Students short of attendance can request condonation, which goes
 * course teacher → HOD → Dean → CoE.
 */
const STATUS: Record<string, string> = {
  draft: 'Draft', registration_open: 'Registration open', registration_closed: 'Registration closed', results_published: 'Results published'
};
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function COEExamSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const today = new Date();
  const [form, setForm] = useState({ code: '', name: '', type: 'end_semester', academicYear: '2026-27', semester: '5', registrationStartsAt: iso(today), registrationEndsAt: iso(new Date(Date.now() + 7 * 864e5)), examStartsAt: iso(new Date(Date.now() + 14 * 864e5)), examEndsAt: iso(new Date(Date.now() + 28 * 864e5)), minAttendancePercentage: '75', requireFeeClearance: true });
  const [paper, setPaper] = useState({ courseId: '', examDate: '', startTime: '10:00', endTime: '13:00', venue: '', maxMarks: '100' });

  const loadSessions = () => fetchApi<any[]>('/coe/sessions').then((d) => {
    const list = Array.isArray(d) ? d : [];
    setSessions(list);
    setSelected((cur) => cur ?? list[0]?.id ?? null);
  }).catch(() => setSessions([]));
  const loadDetail = (id = selected) => { if (id) fetchApi<any>(`/coe/sessions/${id}`).then(setDetail).catch(() => setDetail(null)); };
  useEffect(() => { loadSessions(); fetchApi<any[]>('/coe/courses').then((d) => setCourses(Array.isArray(d) ? d : [])).catch(() => setCourses([])); }, []);
  useEffect(() => { loadDetail(); }, [selected]);

  const run = async (label: string, fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(label);
    try {
      const r = await fn();
      toast({ title: ok(r) });
      await loadSessions();
      loadDetail();
    } catch (e: any) {
      toast({ title: 'Could not complete', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const createSession = () => run('create', () => postApi<any>('/coe/sessions', {
    code: form.code.trim(), name: form.name.trim(), type: form.type, academicYear: form.academicYear.trim(), semester: Number(form.semester),
    registrationStartsAt: form.registrationStartsAt, registrationEndsAt: form.registrationEndsAt, examStartsAt: form.examStartsAt, examEndsAt: form.examEndsAt,
    minAttendancePercentage: Number(form.minAttendancePercentage), requireFeeClearance: form.requireFeeClearance
  }).then((r) => { setNewOpen(false); setSelected(r.id); return r; }), (r) => `Session ${r.code} created`);

  const addPaper = () => run('paper', () => postApi(`/coe/sessions/${selected}/schedules`, {
    courseId: paper.courseId, examDate: paper.examDate, startTime: paper.startTime, endTime: paper.endTime, ...(paper.venue.trim() ? { venue: paper.venue.trim() } : {}), maxMarks: Number(paper.maxMarks)
  }).then(() => setPaperOpen(false)), () => 'Paper added to the timetable');

  const s = detail;
  const semesterCourses = courses.filter((c) => !s || c.semester === s.semester);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exam timetable & registration</h1>
            <p className="text-muted-foreground">Schedule papers, register students (attendance and fee checks per paper), handle condonation and issue hall tickets.</p>
          </div>
          <Button onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" />New exam session</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {sessions.map((x) => (
            <Button key={x.id} variant={x.id === selected ? 'default' : 'outline'} size="sm" onClick={() => setSelected(x.id)}>
              {x.code}<span className="ml-2 text-[10px] font-normal opacity-80">· {STATUS[x.status] ?? x.status}</span>
            </Button>
          ))}
          {!sessions.length && <p className="text-sm text-muted-foreground">No exam sessions yet.</p>}
        </div>

        {s && (
          <>
            <div className="grid gap-4 sm:grid-cols-5">
              {[
                { label: 'Papers', value: s.schedules.length, icon: CalendarClock },
                { label: 'Students registered', value: s.students.length, icon: Users },
                { label: 'Fully eligible', value: s.students.filter((x: any) => x.papers.every((p: any) => p.isEligible)).length, icon: CheckCircle },
                { label: 'Blocked (any paper)', value: s.students.filter((x: any) => x.papers.some((p: any) => !p.isEligible)).length, icon: XCircle },
                { label: 'Hall tickets', value: s.students.filter((x: any) => x.hallTicket).length, icon: Ticket }
              ].map((k) => (
                <Card key={k.label}><CardContent className="flex items-center gap-3 p-4"><k.icon className="h-6 w-6 text-primary" /><div><p className="text-2xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div></CardContent></Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{s.name} <Badge variant="secondary" className="ml-2">{STATUS[s.status] ?? s.status}</Badge></CardTitle>
                    <CardDescription>
                      Semester {s.semester} · {s.academicYear} · Registration {day(s.registrationStartsAt)} – {day(s.registrationEndsAt)} · Exams {day(s.examStartsAt)} – {day(s.examEndsAt)} · Minimum attendance {s.minAttendancePercentage}%{s.requireFeeClearance ? ' · fees must be cleared' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.status === 'draft' && <Button size="sm" variant="outline" onClick={() => setPaperOpen(true)}><Plus className="mr-1 h-4 w-4" />Add paper</Button>}
                    {s.status === 'draft' && <Button size="sm" disabled={!!busy || !s.schedules.length} onClick={() => run('open', () => postApi(`/coe/sessions/${s.id}/open-registration`, {}), () => 'Registration opened')}><Send className="mr-1 h-4 w-4" />Open registration</Button>}
                    {s.status === 'registration_open' && <Button size="sm" disabled={!!busy} onClick={() => run('reg', () => postApi<any>(`/coe/sessions/${s.id}/register-all`, {}), (r) => `Registered ${r.students} student(s): ${r.fullyEligible} fully eligible, ${r.withBlocks} with a blocked paper`)}><Users className="mr-1 h-4 w-4" />{busy === 'reg' ? 'Registering…' : 'Register all students'}</Button>}
                    {s.status === 'registration_open' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('close', () => postApi(`/coe/sessions/${s.id}/close-registration`, {}), () => 'Registration closed')}>Close registration</Button>}
                    {['registration_open', 'registration_closed'].includes(s.status) && s.students.length > 0 && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run('tickets', () => postApi<any>(`/coe/sessions/${s.id}/hall-tickets`, {}), (r) => `Issued ${r.issued} hall ticket(s)${r.blocked ? `; ${r.blocked} student(s) still blocked` : ''}`)}><Ticket className="mr-1 h-4 w-4" />{busy === 'tickets' ? 'Issuing…' : 'Issue hall tickets'}</Button>}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="timetable">
              <TabsList>
                <TabsTrigger value="timetable">Timetable ({s.schedules.length})</TabsTrigger>
                <TabsTrigger value="students">Students ({s.students.length})</TabsTrigger>
                <TabsTrigger value="blocked">Blocked & condonation ({s.students.filter((x: any) => x.papers.some((p: any) => !p.isEligible || p.status === 'condoned')).length})</TabsTrigger>
              </TabsList>
              <TabsContent value="timetable" className="mt-4">
                <Card><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Course</TableHead><TableHead>Venue</TableHead><TableHead className="text-center">Max</TableHead><TableHead className="text-center">Registered / eligible</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {s.schedules.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>{day(p.examDate)}</TableCell><TableCell>{p.startTime}–{p.endTime}</TableCell>
                          <TableCell><p className="font-medium">{p.courseCode}</p><p className="text-xs text-muted-foreground">{p.courseName}{p.department ? ` · ${p.department}` : ''}</p></TableCell>
                          <TableCell>{p.venue ?? '—'}</TableCell><TableCell className="text-center">{p.maxMarks}</TableCell><TableCell className="text-center">{p.registered} / {p.eligible}</TableCell>
                          <TableCell className="text-right">{p.registered === 0 && <Button size="icon" variant="ghost" title="Remove paper" onClick={() => { if (window.confirm(`Remove ${p.courseCode} from the timetable?`)) run('rm', () => deleteApi(`/coe/schedules/${p.id}`), () => 'Paper removed'); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
                        </TableRow>
                      ))}
                      {!s.schedules.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No papers yet. Add each course's exam with its date, time and hall.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="students" className="mt-4">
                <Card><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Roll no</TableHead><TableHead>Name</TableHead><TableHead>Papers</TableHead><TableHead>Hall ticket</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {s.students.map((x: any) => (
                        <TableRow key={x.studentProfileId}>
                          <TableCell className="font-mono text-xs">{x.rollNumber}</TableCell><TableCell>{x.name}</TableCell>
                          <TableCell><div className="flex flex-wrap gap-1">{x.papers.map((p: any) => <Badge key={p.registrationId} variant={p.isEligible ? 'secondary' : 'destructive'} className="text-[10px]">{p.courseCode}{p.status === 'condoned' ? ' (condoned)' : ''}</Badge>)}</div></TableCell>
                          <TableCell className="text-xs">{x.hallTicket ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                      {!s.students.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No one registered yet.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="blocked" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Students short of attendance can request condonation from their Examinations page. It goes to the course teacher, then the HOD, the Dean and finally the CoE, all in Approvals & Workflows. Unpaid fees are not condonable.</p>
                {s.students.flatMap((x: any) => x.papers.filter((p: any) => !p.isEligible || p.status === 'condoned').map((p: any) => ({ ...p, name: x.name, rollNumber: x.rollNumber }))).map((p: any) => (
                  <Card key={p.registrationId}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="text-sm font-medium">{p.name} ({p.rollNumber}) · {p.courseCode}</p>
                      <p className="text-xs text-muted-foreground">{Array.isArray(p.reasons) ? p.reasons.join(' ') : p.attendancePercentage != null ? `Attendance ${p.attendancePercentage}%` : ''}</p>
                      {p.condonationRequest && <p className="mt-1 text-xs">Student: “{p.condonationRequest}”</p>}
                    </div>
                    <Badge variant={p.status === 'condoned' ? 'default' : p.condonation?.status === 'pending' ? 'secondary' : 'outline'}>
                      {p.status === 'condoned' ? 'Condoned' : p.condonation?.status === 'pending' ? `Condonation with ${String(p.condonation.waitingOn).replace(/_/g, ' ')}` : p.condonation?.status === 'rejected' ? 'Condonation refused' : 'No request'}
                    </Badge>
                  </CardContent></Card>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New exam session</DialogTitle><DialogDescription>Registration must close before the exams start.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ES-2026-S5" /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['end_semester', 'mid_semester', 'internal', 'supplementary', 'special'].map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="End Semester Examination — Semester 5" /></div>
              <div className="space-y-1"><Label>Academic year</Label><Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
              <div className="space-y-1"><Label>Semester</Label><Input type="number" min={1} max={12} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} /></div>
              <div className="space-y-1"><Label>Registration opens</Label><Input type="date" value={form.registrationStartsAt} onChange={(e) => setForm({ ...form, registrationStartsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Registration closes</Label><Input type="date" value={form.registrationEndsAt} onChange={(e) => setForm({ ...form, registrationEndsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exams start</Label><Input type="date" value={form.examStartsAt} onChange={(e) => setForm({ ...form, examStartsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Exams end</Label><Input type="date" value={form.examEndsAt} onChange={(e) => setForm({ ...form, examEndsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Minimum attendance %</Label><Input type="number" min={0} max={100} value={form.minAttendancePercentage} onChange={(e) => setForm({ ...form, minAttendancePercentage: e.target.value })} /></div>
              <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={form.requireFeeClearance} onCheckedChange={(v) => setForm({ ...form, requireFeeClearance: !!v })} />Fees must be cleared</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button disabled={!!busy || !form.code || !form.name} onClick={createSession}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paperOpen} onOpenChange={setPaperOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a paper</DialogTitle><DialogDescription>Semester {s?.semester} courses. The date must fall inside the exam window.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Course</Label>
                <Select value={paper.courseId} onValueChange={(v) => setPaper({ ...paper, courseId: v })}><SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>{semesterCourses.filter((c) => !s?.schedules.some((x: any) => x.courseId === c.id)).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={paper.examDate} onChange={(e) => setPaper({ ...paper, examDate: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max marks</Label><Input type="number" value={paper.maxMarks} onChange={(e) => setPaper({ ...paper, maxMarks: e.target.value })} /></div>
              <div className="space-y-1"><Label>Starts</Label><Input type="time" value={paper.startTime} onChange={(e) => setPaper({ ...paper, startTime: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="time" value={paper.endTime} onChange={(e) => setPaper({ ...paper, endTime: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Hall / venue</Label><Input value={paper.venue} onChange={(e) => setPaper({ ...paper, venue: e.target.value })} placeholder="Main Examination Hall" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setPaperOpen(false)}>Cancel</Button><Button disabled={!!busy || !paper.courseId || !paper.examDate} onClick={addPaper}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
