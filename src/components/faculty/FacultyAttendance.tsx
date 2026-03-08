import { useState } from 'react';
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
import { todaySchedule, sampleStudentRoster, facultyCourses } from '@/data/facultyMockData';
import type { StudentAttendanceEntry } from '@/types/faculty';
import { useToast } from '@/hooks/use-toast';

export default function FacultyAttendance() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [roster, setRoster] = useState<StudentAttendanceEntry[]>(sampleStudentRoster);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const { toast } = useToast();

  const session = todaySchedule.find(s => s.id === selectedSession);

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

  const saveAttendance = () => {
    toast({ title: 'Attendance Saved', description: `Attendance recorded for ${session?.courseCode} – ${roster.filter(s => s.status === 'present').length}/${roster.length} present.` });
    setSelectedSession(null);
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
                <Button size="sm" variant="outline" onClick={() => setRoster(sampleStudentRoster)}>
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
                <Button onClick={saveAttendance}>
                  <Save className="mr-1 h-4 w-4" />Save Attendance
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
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {facultyCourses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today's Sessions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-3">
            {todaySchedule.map((session) => (
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
                    {[
                      { date: '2026-03-07', code: 'CS301', type: 'Lecture', present: 60, absent: 5 },
                      { date: '2026-03-06', code: 'CS501', type: 'Lab', present: 52, absent: 6 },
                      { date: '2026-03-06', code: 'CS601', type: 'Lecture', present: 30, absent: 2 },
                      { date: '2026-03-05', code: 'CS301', type: 'Tutorial', present: 58, absent: 7 },
                      { date: '2026-03-04', code: 'CS501', type: 'Lecture', present: 54, absent: 4 },
                    ].map((h, i) => (
                      <TableRow key={i}>
                        <TableCell>{h.date}</TableCell>
                        <TableCell className="font-medium">{h.code}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{h.type}</Badge></TableCell>
                        <TableCell className="text-green-600">{h.present}</TableCell>
                        <TableCell className="text-destructive">{h.absent}</TableCell>
                        <TableCell>{Math.round((h.present / (h.present + h.absent)) * 100)}%</TableCell>
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
