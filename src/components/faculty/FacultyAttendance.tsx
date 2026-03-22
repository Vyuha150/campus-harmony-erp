import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, Users, Clock, MapPin, Save, UserCheck, UserX, RotateCcw
} from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import type { StudentAttendanceEntry } from '@/types/faculty';
import { useToast } from '@/hooks/use-toast';

export default function FacultyAttendance() {
  const [todaySchedule, setTodaySchedule] = useState<any>([]);
  const [facultyCourses, setFacultyCourses] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [originalRoster, setOriginalRoster] = useState<StudentAttendanceEntry[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadAttendanceData = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const [sessionsData, coursesData] = await Promise.all([
      fetchApi(`/faculty/attendance/sessions${semesterQuery}`),
      fetchApi(`/faculty/courses${semesterQuery}`)
    ]);
    setTodaySchedule(Array.isArray(sessionsData) ? sessionsData : []);
    setFacultyCourses(Array.isArray(coursesData) ? coursesData : []);

    const firstCourseId = Array.isArray(coursesData) && coursesData.length > 0 ? coursesData[0].id : undefined;
    const rosterQuery = firstCourseId ? `?courseId=${firstCourseId}${semester ? `&semester=${semester}` : ''}` : semesterQuery;
    const rosterData = await fetchApi(`/faculty/attendance/roster${rosterQuery}`);
    setOriginalRoster(Array.isArray(rosterData) ? rosterData : []);
    setRoster(Array.isArray(rosterData) ? rosterData : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [allCourses, currentSemesterResponse] = await Promise.all([
          fetchApi('/faculty/courses'),
          fetchApi('/faculty/current-semester')
        ]);
        const semesters = Array.from(new Set((Array.isArray(allCourses) ? allCourses : []).map((course: any) => Number(course?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        setSemesterOptions(semesters);
        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        await loadAttendanceData(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadAttendanceData(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [roster, setRoster] = useState<StudentAttendanceEntry[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [savingAttendance, setSavingAttendance] = useState(false);
  const { toast } = useToast();

  const session = todaySchedule.find(s => s.id === selectedSession);
  const filteredSessions = selectedCourse === 'all' ? todaySchedule : todaySchedule.filter((item: any) => item.courseId === selectedCourse);

  useEffect(() => {
    if (!session?.courseId) return;
    const semesterPart = selectedSemester ? `&semester=${selectedSemester}` : '';
    fetchApi(`/faculty/attendance/roster?courseId=${session.courseId}${semesterPart}`).then((data) => {
      setOriginalRoster(Array.isArray(data) ? data : []);
      setRoster(Array.isArray(data) ? data : []);
    }).catch((error) => { console.error('API request failed', error); });
  }, [selectedSession]);

  const markAll = (status: 'present' | 'absent') => {
    setRoster(prev => prev.map(s => ({ ...s, status })));
  };

  const toggleStudent = (studentId: string) => {
    setRoster(prev => prev.map(s =>
      s.studentId === studentId
        ? { ...s, status: s.status === 'present' ? 'absent' : 'present' }
        : s
    ));
  };

  const saveAttendance = async () => {
    if (!session) return;
    try {
      setSavingAttendance(true);
      await postApi('/faculty/attendance/mark', {
        courseId: session.courseId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        type: session.type,
        students: roster.map((student) => ({ studentId: student.studentId, status: student.status }))
      });

      const present = roster.filter((student) => student.status === 'present' || student.status === 'late').length;
      const absent = roster.length - present;
      setTodaySchedule((prev: any[]) => prev.map((item) => item.id === session.id ? { ...item, status: 'completed', presentCount: present, absentCount: absent } : item));
      toast({ title: 'Attendance Saved', description: `Attendance recorded for ${session.courseCode} – ${present}/${roster.length} present.` });
      setSelectedSession(null);
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save attendance.', variant: 'destructive' });
    } finally {
      setSavingAttendance(false);
    }
  };

  const presentCount = roster.filter(s => s.status === 'present' || s.status === 'late').length;

  if (selectedSession && session) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>← Back</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Take Attendance</h1>
              <p className="text-muted-foreground">{session.courseCode} – {session.courseName} • {session.date} • {session.startTime}–{session.endTime} • {session.room}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700">{presentCount} Present</Badge>
              <Badge variant="destructive">{roster.length - presentCount} Absent</Badge>
            </div>
          </div>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Student Roster</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => markAll('present')}>
                  <UserCheck className="mr-1 h-4 w-4" />Mark All Present
                </Button>
                <Button size="sm" variant="outline" onClick={() => markAll('absent')}>
                  <UserX className="mr-1 h-4 w-4" />Mark All Absent
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRoster(originalRoster)}>
                  <RotateCcw className="mr-1 h-4 w-4" />Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Present</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((student) => (
                    <TableRow key={student.studentId} className={student.status === 'absent' ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={student.status === 'present' || student.status === 'late'}
                          onCheckedChange={() => toggleStudent(student.studentId)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{student.rollNumber}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          student.status === 'present' ? 'default' :
                          student.status === 'late' ? 'secondary' : 'destructive'
                        } className="capitalize">
                          {student.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedSession(null)}>Cancel</Button>
                <Button onClick={saveAttendance} disabled={savingAttendance}>
                  <Save className="mr-1 h-4 w-4" />{savingAttendance ? 'Saving...' : 'Save Attendance'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Attendance Management</h1>
          <div className="flex gap-2">
            <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {facultyCourses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today's Sessions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-3">
            {filteredSessions.map((session) => (
              <Card key={session.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center rounded-lg bg-primary/10 px-3 py-2">
                      <span className="text-sm font-bold text-primary">{session.startTime}</span>
                      <span className="text-[10px] text-muted-foreground">{session.endTime}</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{session.courseCode} – {session.courseName}</p>
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.room}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.totalStudents}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{session.type}</Badge>
                      </div>
                    </div>
                  </div>
                  {session.status === 'completed' ? (
                    <div className="text-right">
                      <Badge className="bg-green-100 text-green-700">{session.presentCount}/{session.totalStudents} Present</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">Completed</p>
                    </div>
                  ) : (
                    <Button onClick={() => setSelectedSession(session.id)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />Take Attendance
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.filter((item: any) => item.status === 'completed').map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.date ? new Date(h.date).toLocaleDateString('en-IN') : '-'}</TableCell>
                        <TableCell className="font-medium">{h.courseCode}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] capitalize">{h.type}</Badge></TableCell>
                        <TableCell className="text-green-600">{h.presentCount}</TableCell>
                        <TableCell className="text-destructive">{h.absentCount}</TableCell>
                        <TableCell>{h.totalStudents > 0 ? Math.round((h.presentCount / h.totalStudents) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
