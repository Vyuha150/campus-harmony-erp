import { useState, useEffect } from 'react';
import { 
  BookOpen, User, Clock, MapPin, Calendar, 
  FileText, Download, ExternalLink, Mail, ChevronRight,
  CheckCircle, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi } from '@/lib/apiService';
import { Course } from '@/types/student';
import { cn } from '@/lib/utils';
import { safeArray, safeNumber, safeString } from '@/lib/normalize';

type StudentCourseState = Course & {
  attendance: number;
  internalMarks: number;
  maxInternalMarks: number;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
};

type AttendanceSummaryState = {
  courseId: string;
  percentage: number;
  totalClasses: number;
  present: number;
  absent: number;
};

type StudentProfileState = {
  program: string;
  branch: string;
  semester: number;
};

const DEFAULT_PROFILE: StudentProfileState = {
  program: 'Program',
  branch: 'Branch',
  semester: 1,
};

function normalizeCourses(raw: any): StudentCourseState[] {
  if (!Array.isArray(raw)) return [];

  return safeArray(raw).map((course: any): StudentCourseState => {
    const schedule = safeArray(course?.schedules)
      ? safeArray(course?.schedules).map((s: any) => ({
          day: safeString(s?.day, '-'),
          startTime: safeString(s?.startTime, '-'),
          endTime: safeString(s?.endTime, '-'),
          room: safeString(s?.room, 'TBA'),
          type: (s?.type ?? 'lecture') as 'lecture' | 'lab' | 'tutorial',
        }))
      : [];

    const attendance = safeNumber(course?.attendance);
    const maxInternalMarks = safeNumber(course?.maxInternalMarks, 50);
    const internalMarks = safeNumber(course?.internalMarks);

    return {
      id: safeString(course?.id),
      code: safeString(course?.code, '-'),
      name: safeString(course?.name, 'Course'),
      credits: safeNumber(course?.credits),
      faculty: safeString(course?.faculty?.user?.name ?? course?.faculty?.user?.email, '-'),
      facultyEmail: safeString(course?.faculty?.user?.email, '-'),
      schedule,
      attendance,
      internalMarks,
      maxInternalMarks,
      totalClasses: 0,
      presentClasses: 0,
      absentClasses: 0,
      semester: safeNumber(course?.semester, 1),
      department: safeString(course?.department?.name, '-'),
    };
  });
}

function normalizeAttendanceSummaries(raw: any): AttendanceSummaryState[] {
  if (!Array.isArray(raw)) return [];

  return safeArray(raw).map((item: any) => ({
    courseId: safeString(item?.courseId),
    percentage: safeNumber(item?.percentage),
    totalClasses: safeNumber(item?.totalClasses),
    present: safeNumber(item?.present),
    absent: safeNumber(item?.absent),
  }));
}

function normalizeProfile(raw: any): StudentProfileState {
  return {
    program: safeString(raw?.program, DEFAULT_PROFILE.program),
    branch: safeString(raw?.branch, DEFAULT_PROFILE.branch),
    semester: safeNumber(raw?.semester, DEFAULT_PROFILE.semester),
  };
}

export default function StudentCourses() {
  const [courses, setCourses] = useState<StudentCourseState[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfileState>(DEFAULT_PROFILE);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      Promise.all([fetchApi('/students/courses'), fetchApi('/students/attendance')]).then(([coursesData, attendanceData]) => {
        const normalizedCourses = normalizeCourses(coursesData);
        const summaries = normalizeAttendanceSummaries(attendanceData);
        const summaryByCourseId = new Map(summaries.map((summary) => [summary.courseId, summary]));

        const mergedCourses = normalizedCourses.map((course) => {
          const summary = summaryByCourseId.get(course.id);
          if (!summary) return course;
          return {
            ...course,
            attendance: summary.percentage,
            totalClasses: summary.totalClasses,
            presentClasses: summary.present,
            absentClasses: summary.absent,
          };
        });

        setCourses(mergedCourses);
      }),
      fetchApi('/students/profile').then((d) => {
        const normalized = normalizeProfile(d);
        setStudentProfile(normalized);
      }),
      fetchApi('/students/current-semester').then((d: any) => {
        if (d?.currentSemester) setSelectedSemester(String(d.currentSemester));
      })
    ])
      .catch((error) => {
        console.error('API request failed', error);
      })
      .finally(() => _setApiLoading(false));
  }, []);

  const [selectedCourse, setSelectedCourse] = useState<StudentCourseState | null>(null);
  const profile = studentProfile;

  useEffect(() => {
    if (!selectedSemester && profile.semester) {
      setSelectedSemester(String(profile.semester));
    }
  }, [selectedSemester, profile.semester]);

  const semesterOptions = Array.from(new Set(courses.map((course) => Number(course.semester)).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  const visibleCourses = selectedSemester === 'all' || !selectedSemester
    ? courses
    : courses.filter((course) => String(course.semester) === selectedSemester);

  const totalCredits = visibleCourses.reduce((sum, c) => sum + Number(c.credits || 0), 0);
  const avgAttendance = visibleCourses.length > 0
    ? Math.round(visibleCourses.reduce((sum, c) => sum + Number(c.attendance || 0), 0) / visibleCourses.length)
    : 0;

  const getAttendanceColor = (attendance: number) => {
    if (attendance >= 90) return 'text-success';
    if (attendance >= 75) return 'text-warning';
    return 'text-destructive';
  };

  const getAttendanceStatus = (attendance: number) => {
    if (attendance >= 90) return { label: 'Excellent', variant: 'success' as const };
    if (attendance >= 75) return { label: 'Good', variant: 'warning' as const };
    return { label: 'Low', variant: 'destructive' as const };
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSyllabus = (course: StudentCourseState) => {
    const content = [
      `Syllabus - ${course.code}`,
      `Course: ${course.name}`,
      `Faculty: ${course.faculty}`,
      `Department: ${course.department}`,
      `Semester: ${course.semester}`
    ].join('\n');
    downloadTextFile(`${course.code}_syllabus.txt`, content);
  };

  const downloadMaterial = (courseCode: string, materialTitle: string) => {
    const content = `Material: ${materialTitle}\nCourse: ${courseCode}\nGenerated: ${new Date().toLocaleString()}`;
    downloadTextFile(`${courseCode}_${materialTitle.replace(/\s+/g, '_')}.txt`, content);
  };

  const openLectureLink = () => {
    window.open('https://www.youtube.com/results?search_query=university+lecture', '_blank', 'noopener,noreferrer');
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">My Courses</h1>
            <p className="page-description">
              {profile.program} {profile.branch} • Semester {profile.semester}
            </p>
          </div>
          <div className="flex gap-4">
            <Select value={selectedSemester || 'all'} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-lg bg-primary/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-primary">{visibleCourses.length}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>
            <div className="rounded-lg bg-muted px-4 py-2 text-center">
              <p className="text-2xl font-bold">{totalCredits}</p>
              <p className="text-xs text-muted-foreground">Credits</p>
            </div>
            <div className={cn('rounded-lg px-4 py-2 text-center', avgAttendance >= 75 ? 'bg-success/10' : 'bg-destructive/10')}>
              <p className={cn('text-2xl font-bold', getAttendanceColor(avgAttendance))}>{avgAttendance}%</p>
              <p className="text-xs text-muted-foreground">Avg Attendance</p>
            </div>
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map((course) => {
            const status = getAttendanceStatus(course.attendance);
            return (
              <Card key={course.id} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <Badge variant="secondary">{course.code}</Badge>
                    <Badge variant="outline">{course.credits} Credits</Badge>
                  </div>
                  <CardTitle className="mt-2 text-lg">{course.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {course.faculty}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Attendance */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Attendance</span>
                      <span className={cn('font-semibold', getAttendanceColor(course.attendance))}>
                        {course.attendance}%
                      </span>
                    </div>
                    <Progress 
                      value={course.attendance} 
                      className={cn(
                        'h-2',
                        course.attendance >= 90 && '[&>div]:bg-success',
                        course.attendance >= 75 && course.attendance < 90 && '[&>div]:bg-warning',
                        course.attendance < 75 && '[&>div]:bg-destructive'
                      )}
                    />
                    <div className="flex items-center gap-1 text-xs">
                      {course.attendance >= 75 ? (
                        <CheckCircle className="h-3 w-3 text-success" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                      <span className={course.attendance >= 75 ? 'text-success' : 'text-destructive'}>
                        {course.attendance >= 75 ? 'Eligible for exam' : 'Attendance shortage'}
                      </span>
                    </div>
                  </div>

                  {/* Internal Marks */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Internal Marks</p>
                      <p className="text-lg font-semibold">
                        {course.internalMarks}/{course.maxInternalMarks}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Percentage</p>
                      <p className="text-lg font-semibold text-primary">
                        {course.maxInternalMarks > 0 ? Math.round((course.internalMarks / course.maxInternalMarks) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Schedule Preview */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Schedule</p>
                    {course.schedule.slice(0, 2).map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{s.day} {s.startTime}-{s.endTime}</span>
                        <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setSelectedCourse(course)}
                      >
                        View Details
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{course.code}</Badge>
                          <Badge variant="outline">{course.credits} Credits</Badge>
                        </div>
                        <DialogTitle className="text-xl">{course.name}</DialogTitle>
                        <DialogDescription>
                          {course.department} • Semester {course.semester}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <Tabs defaultValue="details" className="mt-4">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="schedule">Schedule</TabsTrigger>
                          <TabsTrigger value="attendance">Attendance</TabsTrigger>
                          <TabsTrigger value="materials">Materials</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4 pt-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg bg-muted/50 p-4">
                              <p className="text-sm text-muted-foreground">Faculty</p>
                              <p className="font-medium">{course.faculty}</p>
                              <a 
                                href={`mailto:${course.facultyEmail}`}
                                className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <Mail className="h-3 w-3" />
                                {course.facultyEmail}
                              </a>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-4">
                              <p className="text-sm text-muted-foreground">Internal Assessment</p>
                              <p className="text-2xl font-bold">
                                {course.internalMarks}/{course.maxInternalMarks}
                              </p>
                              <Progress
                                value={course.maxInternalMarks > 0 ? (course.internalMarks / course.maxInternalMarks) * 100 : 0}
                                className="mt-2 h-2"
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border p-4">
                            <h4 className="font-medium">Syllabus</h4>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Click to download or view the complete syllabus for this course.
                            </p>
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => downloadSyllabus(course)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Syllabus
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="schedule" className="pt-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Day</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Room</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {course.schedule.map((s, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{s.day}</TableCell>
                                  <TableCell>{s.startTime} - {s.endTime}</TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      s.type === 'lecture' ? 'default' :
                                      s.type === 'lab' ? 'secondary' : 'outline'
                                    }>
                                      {s.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{s.room}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TabsContent>

                        <TabsContent value="attendance" className="pt-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Overall Attendance</p>
                                <p className={cn('text-3xl font-bold', getAttendanceColor(course.attendance))}>
                                  {course.attendance}%
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant={status.variant === 'success' ? 'default' : status.variant === 'warning' ? 'secondary' : 'destructive'}>
                                  {status.label}
                                </Badge>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {course.attendance >= 75 ? 'Eligible for exam' : 'Shortage warning'}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-lg border p-4">
                              <h4 className="font-medium">Attendance Summary</h4>
                              <div className="mt-3 grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-success">{course.presentClasses}</p>
                                  <p className="text-xs text-muted-foreground">Present</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-destructive">{course.absentClasses}</p>
                                  <p className="text-xs text-muted-foreground">Absent</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold">{course.totalClasses}</p>
                                  <p className="text-xs text-muted-foreground">Total Classes</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="materials" className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-lg border p-3">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" />
                                <div>
                                  <p className="font-medium">Unit 1 Notes - Introduction</p>
                                  <p className="text-xs text-muted-foreground">PDF • 2.4 MB</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => downloadMaterial(course.code, 'Unit 1 Notes - Introduction')}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" />
                                <div>
                                  <p className="font-medium">Unit 2 Notes - Advanced Topics</p>
                                  <p className="text-xs text-muted-foreground">PDF • 3.1 MB</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => downloadMaterial(course.code, 'Unit 2 Notes - Advanced Topics')}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3">
                              <div className="flex items-center gap-3">
                                <ExternalLink className="h-5 w-5 text-info" />
                                <div>
                                  <p className="font-medium">Video Lecture - Week 5</p>
                                  <p className="text-xs text-muted-foreground">YouTube Link</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={openLectureLink}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
