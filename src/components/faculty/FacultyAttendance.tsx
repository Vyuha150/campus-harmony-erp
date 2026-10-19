import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock, FlaskConical, MapPin, RotateCcw, Send, UserCheck, UserX, Users
} from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Mark = 'present' | 'absent' | null;
interface ScheduledClass {
  courseId: string; courseCode: string; courseName: string; semester: number;
  startTime: string; endTime: string; room: string; type: string;
  totalStudents: number; sessionId: string | null; taken: boolean; presentCount: number; absentCount: number;
  /** I am covering this class for a colleague (HOD-arranged). */
  substitution?: boolean;
  /** Someone else is covering my class that day. */
  coveredBy?: string;
}
interface RosterEntry { studentId: string; rollNumber: string; name: string; status: Mark }

/** YYYY-MM-DD in the viewer's own time zone. */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, m! - 1, d!); };
const shift = (s: string, days: number) => { const d = parseYmd(s); d.setDate(d.getDate() + days); return ymd(d); };
const to12h = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! >= 12 ? 'PM' : 'AM'}`; };
const longDate = (s: string) => parseYmd(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Attendance, class by class. Pick a date, and every class on the faculty
 * member's timetable that day is listed — not only classes already recorded.
 * Any past or today's class can be posted, and posted ones can be updated.
 */
export default function FacultyAttendance() {
  const { toast } = useToast();
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [active, setActive] = useState<ScheduledClass | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [original, setOriginal] = useState<RosterEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadClasses = (day: string) => {
    setLoadingClasses(true);
    fetchApi<{ classes: ScheduledClass[] }>(`/faculty/attendance/classes?date=${day}`)
      .then((data) => setClasses(Array.isArray(data?.classes) ? data.classes : []))
      .catch((error) => toast({ title: 'Could not load classes', description: error?.message, variant: 'destructive' }))
      .finally(() => setLoadingClasses(false));
  };
  const loadHistory = () =>
    fetchApi<any[]>('/faculty/attendance/sessions').then((rows) => setHistory(Array.isArray(rows) ? rows : [])).catch(() => undefined);

  useEffect(() => { loadClasses(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadHistory(); }, []);

  const openClass = async (cls: ScheduledClass) => {
    setActive(cls);
    setRoster([]);
    try {
      const rows = await fetchApi<RosterEntry[]>(`/faculty/attendance/roster?courseId=${cls.courseId}&date=${date}&startTime=${encodeURIComponent(cls.startTime)}`);
      const list = Array.isArray(rows) ? rows : [];
      setRoster(list);
      setOriginal(list);
    } catch (error: any) {
      toast({ title: 'Could not load students', description: error?.message, variant: 'destructive' });
    }
  };

  const setMark = (studentId: string, status: Mark) =>
    setRoster((prev) => prev.map((s) => (s.studentId === studentId ? { ...s, status: s.status === status ? null : status } : s)));
  const markAll = (status: Mark) => setRoster((prev) => prev.map((s) => ({ ...s, status })));

  const counts = useMemo(() => ({
    present: roster.filter((s) => s.status === 'present').length,
    absent: roster.filter((s) => s.status === 'absent').length,
    unmarked: roster.filter((s) => s.status === null).length
  }), [roster]);

  const submit = async () => {
    if (!active || counts.unmarked > 0) return;
    setSaving(true);
    try {
      await postApi('/faculty/attendance/mark', {
        courseId: active.courseId,
        date,
        startTime: active.startTime,
        endTime: active.endTime,
        type: active.type,
        students: roster.map((s) => ({ studentId: s.studentId, status: s.status }))
      });
      toast({
        title: active.taken ? 'Attendance updated' : 'Attendance posted',
        description: `${active.courseCode} · ${longDate(date)} · ${counts.present}/${roster.length} present`
      });
      setActive(null);
      loadClasses(date);
      loadHistory();
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error?.message || 'Unable to save attendance.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Marking a class ────────────────────────────────────────────────────────
  if (active) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)}>← Back to classes</Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{active.taken ? 'Update attendance' : 'Post attendance'}</h1>
              <p className="text-muted-foreground">
                {active.courseCode} – {active.courseName} · {longDate(date)} · {to12h(active.startTime)}–{to12h(active.endTime)} · {active.room}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-green-600 hover:bg-green-600">{counts.present} Present</Badge>
              <Badge variant="destructive">{counts.absent} Absent</Badge>
              <Badge variant="outline">{counts.unmarked} Not marked</Badge>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">Tap P or A for each roll number</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => markAll('present')}><UserCheck className="mr-1 h-4 w-4" />All present</Button>
                <Button size="sm" variant="outline" onClick={() => markAll('absent')}><UserX className="mr-1 h-4 w-4" />All absent</Button>
                <Button size="sm" variant="outline" onClick={() => setRoster(original)}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
              </div>
            </CardHeader>
            <CardContent>
              {roster.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading students…</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                  {roster.map((s) => (
                    <div
                      key={s.studentId}
                      title={s.name}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors',
                        s.status === 'present' && 'border-green-500 bg-green-50 dark:bg-green-950/40',
                        s.status === 'absent' && 'border-red-500 bg-red-50 dark:bg-red-950/40'
                      )}
                    >
                      <span className="font-mono text-xs font-semibold">{s.rollNumber}</span>
                      <div className="grid w-full grid-cols-2 gap-1">
                        <button
                          type="button"
                          aria-label={`Mark ${s.rollNumber} present`}
                          onClick={() => setMark(s.studentId, 'present')}
                          className={cn('h-8 rounded-md border text-sm font-bold', s.status === 'present' ? 'border-green-600 bg-green-600 text-white' : 'hover:bg-green-100 dark:hover:bg-green-900')}
                        >P</button>
                        <button
                          type="button"
                          aria-label={`Mark ${s.rollNumber} absent`}
                          onClick={() => setMark(s.studentId, 'absent')}
                          className={cn('h-8 rounded-md border text-sm font-bold', s.status === 'absent' ? 'border-red-600 bg-red-600 text-white' : 'hover:bg-red-100 dark:hover:bg-red-900')}
                        >A</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                {counts.unmarked > 0 && roster.length > 0 && (
                  <span className="text-sm text-muted-foreground">Mark all {counts.unmarked} remaining roll number{counts.unmarked === 1 ? '' : 's'} to submit.</span>
                )}
                <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
                <Button onClick={submit} disabled={saving || roster.length === 0 || counts.unmarked > 0}>
                  <Send className="mr-1 h-4 w-4" />{saving ? 'Submitting…' : active.taken ? 'Update attendance' : 'Submit attendance'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── Classes on a date ──────────────────────────────────────────────────────
  const monday = shift(date, -((parseYmd(date).getDay() + 6) % 7));
  const week = Array.from({ length: 6 }, (_, i) => shift(monday, i));
  const isFuture = date > today;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Pick a date to post or update attendance for any of your classes that day.</p>
        </div>

        <Tabs defaultValue="classes">
          <TabsList>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="classes" className="mt-4 space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setDate(shift(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
                  <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[170px]" />
                  <Button variant="outline" size="icon" onClick={() => setDate(shift(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDate(today)} disabled={date === today}>Today</Button>
                  <span className="ml-auto text-sm font-medium">{longDate(date)}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto">
                  {week.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDate(d)}
                      className={cn('flex min-w-[60px] flex-col items-center rounded-lg border px-3 py-1.5 text-xs', d === date ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >
                      <span className="font-semibold">{parseYmd(d).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      <span>{parseYmd(d).getDate()}{d === today ? ' · Today' : ''}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {loadingClasses ? (
              <p className="text-sm text-muted-foreground">Loading classes…</p>
            ) : classes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                You have no classes on {longDate(date)}.
              </p>
            ) : (
              <div className="space-y-3">
                {classes.map((cls) => (
                  <Card key={`${cls.courseId}-${cls.startTime}`}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex w-20 flex-col items-center rounded-lg bg-primary/10 px-2 py-2">
                          <span className="text-sm font-bold text-primary">{to12h(cls.startTime)}</span>
                          <span className="text-[10px] text-muted-foreground">{to12h(cls.endTime)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{cls.courseCode} – {cls.courseName}</p>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{cls.room}</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cls.totalStudents} students</span>
                            <Badge variant="outline" className="gap-1 text-[10px]">{/lab/i.test(cls.type) && <FlaskConical className="h-3 w-3" />}{cls.type}</Badge>
                            {cls.substitution && <Badge className="bg-blue-600 text-[10px] hover:bg-blue-600">Substitution</Badge>}
                            {cls.coveredBy && <Badge variant="secondary" className="text-[10px]">Covered by {cls.coveredBy}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {cls.taken ? (
                          <div className="text-right">
                            <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />{cls.presentCount}/{cls.presentCount + cls.absentCount} present</Badge>
                            <p className="mt-1 text-[11px] text-muted-foreground">Posted</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="mr-1 h-3 w-3" />Not taken</Badge>
                        )}
                        <Button onClick={() => openClass(cls)} disabled={isFuture} variant={cls.taken ? 'outline' : 'default'}>
                          {isFuture ? 'Not held yet' : cls.taken ? 'Update' : 'Take attendance'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.filter((h) => h.totalStudents > 0).map((h) => (
                      <TableRow key={h.id} className="cursor-pointer" onClick={() => setDate(String(h.date).slice(0, 10))}>
                        <TableCell>{h.date ? new Date(h.date).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : '-'}</TableCell>
                        <TableCell>{h.startTime ? to12h(h.startTime) : '-'}</TableCell>
                        <TableCell className="font-medium">{h.courseCode}</TableCell>
                        <TableCell className="text-green-600">{h.presentCount}</TableCell>
                        <TableCell className="text-destructive">{h.absentCount}</TableCell>
                        <TableCell>{Math.round((h.presentCount / h.totalStudents) * 100)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-muted-foreground">Click a row to open that day and update it.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
