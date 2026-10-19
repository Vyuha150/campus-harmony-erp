import { useTabParam } from '@/hooks/useTabParam';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Plus, Shuffle, Trash2, UserCheck, UserMinus } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Workload & Timetable (blueprint, HOD portal): assign subjects to faculty,
 * manage the department timetable with conflict checking, and arrange cover
 * when a faculty member is on leave — the system suggests who is free.
 * Affected teachers and students are notified of every change.
 */

interface AllocCourse { id: string; code: string; name: string; semester: number; credits: number; facultyId: string | null; facultyName: string | null; students: number; weeklyHours: number; slots: number }
interface AllocFaculty { id: string; name: string; designation: string | null; courses: string[]; weeklyHours: number }
interface Slot { scheduleId: string; courseId: string; courseCode: string; courseName: string; semester: number; day: string; startTime: string; endTime: string; room: string; type: string; facultyId: string | null; facultyName: string | null }
interface DayClass extends Omit<Slot, 'day'> { facultyOnLeave: { status: string; type: string } | null; substitution: { id: string; substituteFacultyId: string; substituteName: string | null; reason: string | null } | null }
interface Change { id: string; kind: string; summary: string; status: string; requestedAt: string; appliedAt: string | null; failureReason: string | null; decisionNote: string | null; payload: any }
interface Candidate { facultyId: string; name: string; designation: string | null; weeklyHours: number; free: boolean; reason: string | null }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UNASSIGNED = '__none__';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (v: string, n: number) => { const [y, m, d] = v.split('-').map(Number); const x = new Date(y!, m! - 1, d!); x.setDate(x.getDate() + n); return ymd(x); };
const longDate = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y!, m! - 1, d!).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); };
const emptySlot = { scheduleId: '', courseId: '', day: 'Monday', startTime: '09:00', endTime: '10:00', room: '', type: 'Lecture' };

export default function HODWorkload() {
  const tabParam = useTabParam('allocation');
  const { toast } = useToast();
  const [courses, setCourses] = useState<AllocCourse[]>([]);
  const [faculty, setFaculty] = useState<AllocFaculty[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [semester, setSemester] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);

  const reload = useCallback(async () => {
    const [alloc, tt, ch] = await Promise.all([
      fetchApi<{ courses: AllocCourse[]; faculty: AllocFaculty[] }>('/hod/planning/allocation'),
      fetchApi<Slot[]>('/hod/planning/timetable'),
      fetchApi<Change[]>('/hod/planning/changes')
    ]);
    setCourses(alloc?.courses ?? []);
    setFaculty(alloc?.faculty ?? []);
    setSlots(Array.isArray(tt) ? tt : []);
    setChanges(Array.isArray(ch) ? ch : []);
  }, []);

  // Changes waiting for the Dean, by what they touch, to mark them on screen.
  const pending = changes.filter((c) => c.status === 'pending');
  const pendingForCourse = (courseId: string) => pending.find((c) => c.kind === 'allocation' && c.payload?.courseId === courseId);
  const pendingForSlot = (scheduleId: string) => pending.find((c) => c.payload?.scheduleId === scheduleId);
  const sentToDean = (summary: string) => toast({ title: 'Sent to the Dean for approval', description: `${summary}. It takes effect when the Dean approves; the teacher and students are notified then.` });

  const withdraw = async (change: Change) => {
    if (!window.confirm(`Withdraw this request?\n\n${change.summary}`)) return;
    try {
      await deleteApi(`/hod/planning/changes/${change.id}`);
      toast({ title: 'Request withdrawn' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Could not withdraw', description: e?.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    reload().catch((e) => toast({ title: 'Could not load the department', description: e?.message, variant: 'destructive' }));
  }, [reload, toast]);

  // Default to the semester that has a timetable.
  const semesters = useMemo(() => [...new Set(courses.map((c) => c.semester))].sort((a, b) => a - b), [courses]);
  useEffect(() => {
    if (!semester && slots.length) setSemester(String(slots[0]!.semester));
  }, [slots, semester]);

  const fail = (title: string, e: any) => toast({ title, description: e?.message || 'Please try again.', variant: 'destructive' });

  // ── Allocation ─────────────────────────────────────────────────────────────
  const allocate = async (course: AllocCourse, value: string) => {
    const facultyId = value === UNASSIGNED ? null : value;
    if (facultyId === course.facultyId) return;
    if (!facultyId && !window.confirm(`Remove ${course.facultyName} from ${course.code}? The course will have no teacher until you assign one.`)) return;
    setSaving(course.id);
    try {
      const r = await putApi<{ summary: string }>(`/hod/planning/allocation/${course.id}`, { facultyId });
      sentToDean(r.summary);
      await reload();
    } catch (e) { fail('Allocation failed', e); } finally { setSaving(null); }
  };

  // ── Timetable ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<typeof emptySlot | null>(null);
  const semSlots = slots.filter((s) => !semester || String(s.semester) === semester);
  const semCourses = courses.filter((c) => !semester || String(c.semester) === semester);
  const columns = useMemo(() => {
    const bounds = [...new Set(semSlots.flatMap((s) => [s.startTime, s.endTime]))].sort();
    return bounds.slice(0, -1).map((start, i) => ({ start, end: bounds[i + 1]!, isBreak: !semSlots.some((s) => s.startTime <= start && s.endTime >= bounds[i + 1]!) }));
  }, [semSlots]);

  const saveSlot = async () => {
    if (!editing) return;
    if (!editing.courseId || !editing.room.trim()) { toast({ title: 'Missing details', description: 'Choose a course and a room.', variant: 'destructive' }); return; }
    setSaving('slot');
    try {
      const body = { courseId: editing.courseId, day: editing.day, startTime: editing.startTime, endTime: editing.endTime, room: editing.room.trim(), type: editing.type };
      const r = editing.scheduleId
        ? await putApi<{ summary: string }>(`/hod/planning/timetable/${editing.scheduleId}`, body)
        : await postApi<{ summary: string }>('/hod/planning/timetable', body);
      sentToDean(r.summary);
      setEditing(null);
      await reload();
    } catch (e) { fail('Timetable clash', e); } finally { setSaving(null); }
  };
  const removeSlot = async () => {
    if (!editing?.scheduleId || !window.confirm('Ask the Dean to remove this class from the timetable?')) return;
    setSaving('slot');
    try {
      await deleteApi(`/hod/planning/timetable/${editing.scheduleId}`);
      sentToDean(`Remove ${courses.find((c) => c.id === editing.courseId)?.code ?? 'the class'} on ${editing.day} ${editing.startTime}–${editing.endTime}`);
      setEditing(null);
      await reload();
    } catch (e) { fail('Remove failed', e); } finally { setSaving(null); }
  };

  // ── Substitution ───────────────────────────────────────────────────────────
  const [subDate, setSubDate] = useState(ymd(new Date()));
  const [dayClasses, setDayClasses] = useState<DayClass[]>([]);
  const [covering, setCovering] = useState<DayClass | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [reason, setReason] = useState('');
  const loadDay = useCallback((d: string) => {
    fetchApi<{ classes: DayClass[] }>(`/hod/planning/substitutions?date=${d}`).then((r) => setDayClasses(r?.classes ?? [])).catch((e) => fail('Could not load the day', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadDay(subDate); }, [subDate, loadDay]);

  const openCover = async (cls: DayClass) => {
    setCovering(cls);
    setCandidates(null);
    setReason(cls.facultyOnLeave ? `${cls.facultyName} on ${cls.facultyOnLeave.type} leave` : '');
    try {
      setCandidates(await fetchApi<Candidate[]>(`/hod/planning/substitutions/suggest?scheduleId=${cls.scheduleId}&date=${subDate}`));
    } catch (e) { fail('Could not find free faculty', e); }
  };
  const arrange = async (c: Candidate) => {
    if (!covering) return;
    setSaving('cover');
    try {
      await postApi('/hod/planning/substitutions', { scheduleId: covering.scheduleId, date: subDate, substituteFacultyId: c.facultyId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      toast({ title: `${c.name} will take ${covering.courseCode}`, description: 'The substitute, the regular teacher and the students have been notified.' });
      setCovering(null);
      loadDay(subDate);
    } catch (e) { fail('Could not arrange cover', e); } finally { setSaving(null); }
  };
  const cancelCover = async (cls: DayClass) => {
    if (!cls.substitution || !window.confirm(`Cancel ${cls.substitution.substituteName}'s cover for ${cls.courseCode}?`)) return;
    try {
      await deleteApi(`/hod/planning/substitutions/${cls.substitution.id}`);
      toast({ title: 'Cover cancelled' });
      loadDay(subDate);
    } catch (e) { fail('Cancel failed', e); }
  };
  const onLeaveToday = dayClasses.filter((c) => c.facultyOnLeave && !c.substitution).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workload & Timetable</h1>
            <p className="text-muted-foreground">Allocate subjects, edit the department timetable, and arrange cover for faculty on leave.</p>
          </div>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>{semesters.map((s) => <SelectItem key={s} value={String(s)}>Semester {s}{slots.some((x) => x.semester === s) ? '' : ' (no timetable)'}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            [`Semester ${semester || '—'} courses`, semCourses.length],
            ['Without a teacher', semCourses.filter((c) => !c.facultyId).length],
            ['Weekly classes', semSlots.length],
            ['Faculty', faculty.length]
          ].map(([label, value]) => (
            <Card key={label as string}><CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>
          ))}
        </div>

        <Tabs key={tabParam.key} defaultValue={tabParam.defaultValue}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="allocation">Subject Allocation</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="changes">Dean approvals{pending.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{pending.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="cover">Substitutions{onLeaveToday > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{onLeaveToday}</Badge>}</TabsTrigger>
            <TabsTrigger value="workload">Faculty Workload</TabsTrigger>
          </TabsList>

          {/* ── Allocation ── */}
          <TabsContent value="allocation" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Who teaches what</CardTitle>
                <CardDescription>Change the teacher of any subject. The new teacher must be free at all of its slots, and the change takes effect when the Dean approves it.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead><TableHead>Course</TableHead><TableHead className="text-center">Sem</TableHead>
                      <TableHead className="text-center">Credits</TableHead><TableHead className="text-center">Hrs/week</TableHead>
                      <TableHead className="text-center">Students</TableHead><TableHead className="min-w-[220px]">Teacher</TableHead><TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semCourses.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-medium">{c.code}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-center">{c.semester}</TableCell>
                        <TableCell className="text-center">{c.credits}</TableCell>
                        <TableCell className="text-center">{c.weeklyHours || '—'}</TableCell>
                        <TableCell className="text-center">{c.students}</TableCell>
                        <TableCell>
                          {pendingForCourse(c.id) && <p className="mb-1 text-[11px] font-medium text-amber-600">Waiting for the Dean: {pendingForCourse(c.id)!.summary.split(': teacher ').pop()}</p>}
                          <Select value={c.facultyId ?? UNASSIGNED} onValueChange={(v) => allocate(c, v)} disabled={saving === c.id || !!pendingForCourse(c.id)}>
                            <SelectTrigger className={cn('h-8', !c.facultyId && 'border-amber-500 text-amber-700')}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
                              {faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} ({f.weeklyHours}h)</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {c.facultyId && (
                            <Button size="sm" variant="ghost" className="h-8 text-destructive" title="Remove the teacher" onClick={() => allocate(c, UNASSIGNED)}>
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Changes sent to the Dean ── */}
          <TabsContent value="changes" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Changes sent to the Dean</CardTitle>
                <CardDescription>Timetable and subject-allocation changes take effect when the Dean approves them. Substitutions do not need approval.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {changes.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No changes requested yet.</p>}
                {changes.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(c.requestedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {c.appliedAt ? ` · applied ${new Date(c.appliedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                      {c.decisionNote && <p className="text-xs italic text-muted-foreground">Dean: “{c.decisionNote}”</p>}
                      {c.failureReason && <p className="text-xs text-destructive">Could not be applied: {c.failureReason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('capitalize',
                        c.status === 'applied' && 'bg-green-600 hover:bg-green-600',
                        (c.status === 'rejected' || c.status === 'failed') && 'bg-destructive hover:bg-destructive')}
                        variant={c.status === 'pending' ? 'secondary' : c.status === 'cancelled' ? 'outline' : 'default'}>
                        {c.status === 'pending' ? 'Waiting for the Dean' : c.status === 'applied' ? 'Approved & applied' : c.status === 'cancelled' ? 'Withdrawn' : c.status}
                      </Badge>
                      {c.status === 'pending' && <Button size="sm" variant="outline" onClick={() => withdraw(c)}>Withdraw</Button>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Timetable ── */}
          <TabsContent value="timetable" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-lg">Department timetable</CardTitle>
                  <CardDescription>Click a class to move or remove it, or + to add one. Changes go to the Dean for approval; clashes (same students, teacher or room) are refused.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setEditing({ ...emptySlot, courseId: semCourses[0]?.id ?? '' })}><Plus className="mr-1 h-4 w-4" />Add class</Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {semSlots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No classes scheduled for this semester yet. Use “Add class”.</p>
                ) : (
                  <table className="w-full min-w-[900px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="w-20 border-b p-2 text-left">Day</th>
                        {columns.map((c) => (
                          <th key={c.start} className={cn('border-b border-l p-2 text-center font-medium', c.isBreak && 'w-8 bg-muted')}>
                            {c.isBreak ? '' : <>{c.start}<br /><span className="font-normal text-muted-foreground">{c.end}</span></>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => {
                        const cells: JSX.Element[] = [];
                        for (let i = 0; i < columns.length; i++) {
                          const col = columns[i]!;
                          if (col.isBreak) { cells.push(<td key={col.start} className="border-l bg-muted/60" />); continue; }
                          const slot = semSlots.find((s) => s.day === day && s.startTime <= col.start && s.endTime >= col.end);
                          if (!slot) {
                            cells.push(
                              <td key={col.start} className="border-l p-1 text-center">
                                <button type="button" className="h-full w-full rounded py-3 text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                                  title="Add a class here" onClick={() => setEditing({ ...emptySlot, day, startTime: col.start, endTime: col.end, courseId: semCourses[0]?.id ?? '' })}>+</button>
                              </td>
                            );
                            continue;
                          }
                          let span = 1;
                          while (i + span < columns.length && columns[i + span]!.end <= slot.endTime) span++;
                          cells.push(
                            <td key={col.start} colSpan={span} className="border-l p-1">
                              <button type="button" onClick={() => setEditing({ scheduleId: slot.scheduleId, courseId: slot.courseId, day: slot.day, startTime: slot.startTime, endTime: slot.endTime, room: slot.room, type: slot.type })}
                                className={cn('w-full rounded p-1.5 text-left hover:ring-2 hover:ring-primary', slot.type === 'Lab' ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200' : 'bg-primary/10', !slot.facultyId && 'ring-1 ring-amber-500')}>
                                <p className="flex items-center justify-between font-semibold">{slot.courseCode}{pendingForSlot(slot.scheduleId) && <span className="rounded bg-amber-500 px-1 text-[9px] text-white" title={pendingForSlot(slot.scheduleId)!.summary}>change pending</span>}</p>
                                <p className="truncate text-[10px]">{slot.facultyName ?? 'No teacher'}</p>
                                <p className="truncate text-[10px] text-muted-foreground">{slot.type !== 'Lecture' ? `${slot.type} · ` : ''}{slot.room}</p>
                              </button>
                            </td>
                          );
                          i += span - 1;
                        }
                        return <tr key={day} className="border-b"><td className="p-2 font-medium">{day.slice(0, 3)}</td>{cells}</tr>;
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Substitutions ── */}
          <TabsContent value="cover" className="mt-4 space-y-4">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 p-4">
                <Button variant="outline" size="icon" onClick={() => setSubDate(shift(subDate, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
                <Input type="date" value={subDate} onChange={(e) => e.target.value && setSubDate(e.target.value)} className="w-[170px]" />
                <Button variant="outline" size="icon" onClick={() => setSubDate(shift(subDate, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setSubDate(ymd(new Date()))}>Today</Button>
                <span className="ml-auto text-sm font-medium">{longDate(subDate)}</span>
              </CardContent>
            </Card>
            {dayClasses.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No department classes on {longDate(subDate)}.</p>}
            {dayClasses.map((cls) => (
              <Card key={cls.scheduleId} className={cn(cls.facultyOnLeave && !cls.substitution && 'border-destructive/50')}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 rounded-lg bg-primary/10 px-2 py-2 text-center">
                      <p className="text-sm font-bold text-primary">{cls.startTime}</p>
                      <p className="text-[10px] text-muted-foreground">{cls.endTime}</p>
                    </div>
                    <div>
                      <p className="font-medium">{cls.courseCode} – {cls.courseName} <span className="text-xs text-muted-foreground">(Sem {cls.semester} · {cls.type} · {cls.room})</span></p>
                      <p className="text-sm text-muted-foreground">
                        {cls.facultyName ?? 'No teacher assigned'}
                        {cls.facultyOnLeave && <Badge variant="destructive" className="ml-2 text-[10px]">On {cls.facultyOnLeave.type} leave{cls.facultyOnLeave.status === 'pending' ? ' (pending approval)' : ''}</Badge>}
                      </p>
                      {cls.substitution && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                          <UserCheck className="h-4 w-4" />Covered by {cls.substitution.substituteName}{cls.substitution.reason ? ` · ${cls.substitution.reason}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {cls.substitution && <Button size="sm" variant="outline" onClick={() => cancelCover(cls)}>Cancel cover</Button>}
                    <Button size="sm" variant={cls.facultyOnLeave && !cls.substitution ? 'default' : 'outline'} onClick={() => openCover(cls)}>
                      <Shuffle className="mr-1 h-4 w-4" />{cls.substitution ? 'Change' : 'Arrange cover'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Workload ── */}
          <TabsContent value="workload" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Faculty workload</CardTitle>
                <CardDescription>Weekly contact hours from the timetable. Above 18 hours is flagged.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Faculty</TableHead><TableHead>Designation</TableHead><TableHead>Subjects</TableHead><TableHead className="text-center">Hours / week</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {faculty.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.designation ?? '—'}</TableCell>
                        <TableCell className="text-sm">{f.courses.length ? f.courses.join(', ') : <span className="text-muted-foreground">None</span>}</TableCell>
                        <TableCell className="text-center">{f.weeklyHours}h</TableCell>
                        <TableCell>
                          {f.weeklyHours > 18 ? <Badge variant="destructive" className="text-[10px]">Overloaded</Badge>
                            : f.courses.length === 0 ? <Badge variant="secondary" className="text-[10px]">No subjects</Badge>
                            : <Badge className="text-[10px]">Normal</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / move a class */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />{editing?.scheduleId ? 'Move or remove a class' : 'Add a class'}</DialogTitle>
            <DialogDescription>The change goes to the Dean for approval. The course's teacher and students are notified when it is applied.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Course</Label>
                <Select value={editing.courseId} onValueChange={(v) => setEditing({ ...editing, courseId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>{(semCourses.length ? semCourses : courses).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Day</Label>
                  <Select value={editing.day} onValueChange={(v) => setEditing({ ...editing, day: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Starts</Label><Input type="time" value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} /></div>
                <div><Label>Ends</Label><Input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Room</Label><Input value={editing.room} placeholder="e.g. CSE-301" onChange={(e) => setEditing({ ...editing, room: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['Lecture', 'Lab', 'Tutorial'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.scheduleId ? <Button variant="outline" className="text-destructive" onClick={removeSlot} disabled={saving === 'slot'}><Trash2 className="mr-1 h-4 w-4" />Request removal</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveSlot} disabled={saving === 'slot'}>{saving === 'slot' ? 'Checking…' : 'Send to Dean'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arrange cover */}
      <Dialog open={covering !== null} onOpenChange={(open) => { if (!open) setCovering(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cover {covering?.courseCode} · {covering && longDate(subDate)}</DialogTitle>
            <DialogDescription>{covering?.startTime}–{covering?.endTime} in {covering?.room}. Free faculty first, least-loaded first.</DialogDescription>
          </DialogHeader>
          <div><Label>Reason (shown to the substitute)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dr. X on medical leave" /></div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {candidates === null && <p className="text-sm text-muted-foreground">Finding free faculty…</p>}
            {candidates?.length === 0 && <p className="text-sm text-muted-foreground">No other faculty in the department.</p>}
            {candidates?.map((c) => (
              <div key={c.facultyId} className={cn('flex items-center justify-between rounded-lg border p-3', !c.free && 'opacity-60')}>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.designation ?? 'Faculty'} · {c.weeklyHours}h/week</p>
                  {!c.free && <p className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3 w-3" />{c.reason}</p>}
                </div>
                <Button size="sm" disabled={!c.free || saving === 'cover'} onClick={() => arrange(c)}>{c.free ? 'Assign' : 'Busy'}</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
