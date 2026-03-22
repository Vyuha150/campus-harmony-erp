import { useState, useEffect } from 'react';
import {
  GraduationCap, Calendar, Clock, MapPin, Download,
  FileText, Eye, AlertCircle, CheckCircle, Award,
  TrendingUp, BookOpen, Filter
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { fetchApi, postApi } from '@/lib/apiService';
import { cn } from '@/lib/utils';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

type Exam = {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  type: string;
  date: Date;
  startTime: string;
  endTime: string;
  venue: string;
  seatNumber?: string;
  status: string;
  maxMarks: number;
  obtainedMarks?: number;
  grade?: string;
};

type SemesterResult = {
  semester: number;
  year: string;
  sgpa: number;
  cgpa: number;
  earnedCredits: number;
  totalCredits: number;
  courses: Array<{
    courseId: string;
    courseCode: string;
    courseName: string;
    credits: number;
    internalMarks: number;
    externalMarks: number;
    totalMarks: number;
    grade: string;
  }>;
};

type StudentProfileState = {
  cgpa: number;
  earnedCredits: number;
  semester: number;
};

function parseDate(value: any): Date {
  return safeDate(value);
}

function normalizeExam(raw: any): Exam {
  const examDate = parseDate(raw?.date);
  const derivedStatus = raw?.status
    ? safeString(raw.status)
    : examDate < new Date() ? 'completed' : 'upcoming';

  return {
    id: safeString(raw?.id),
    courseId: safeString(raw?.courseId),
    courseName: safeString(raw?.courseName ?? raw?.course?.name, 'Course'),
    courseCode: safeString(raw?.courseCode ?? raw?.course?.code, '-'),
    type: safeString(raw?.type, 'internal'),
    date: examDate,
    startTime: safeString(raw?.startTime),
    endTime: safeString(raw?.endTime),
    venue: safeString(raw?.venue),
    seatNumber: raw?.seatNumber ? safeString(raw.seatNumber) : undefined,
    status: derivedStatus,
    maxMarks: safeNumber(raw?.maxMarks),
    obtainedMarks: raw?.obtainedMarks != null ? safeNumber(raw.obtainedMarks) : undefined,
    grade: raw?.grade ? safeString(raw.grade) : undefined,
  };
}

function normalizeSemesterResult(raw: any): SemesterResult {
  return {
    semester: safeNumber(raw?.semester, 1),
    year: safeString(raw?.year, new Date().getFullYear().toString()),
    sgpa: safeNumber(raw?.sgpa),
    cgpa: safeNumber(raw?.cgpa),
    earnedCredits: safeNumber(raw?.earnedCredits),
    totalCredits: safeNumber(raw?.totalCredits),
    courses: safeArray(raw?.courses).map((course: any) => ({
      courseId: safeString(course?.courseId),
      courseCode: safeString(course?.courseCode),
      courseName: safeString(course?.courseName),
      credits: safeNumber(course?.credits),
      internalMarks: safeNumber(course?.internalMarks),
      externalMarks: safeNumber(course?.externalMarks),
      totalMarks: safeNumber(course?.totalMarks),
      grade: safeString(course?.grade),
    })),
  };
}

function normalizeProfile(raw: any): StudentProfileState {
  return {
    cgpa: safeNumber(raw?.cgpa),
    earnedCredits: safeNumber(raw?.earnedCredits),
    semester: safeNumber(raw?.semester, 1),
  };
}

function gradeToPoints(grade: string): number {
  const normalized = grade.trim().toUpperCase();
  const pointsMap: Record<string, number> = {
    'A+': 10,
    A: 9,
    'B+': 8,
    B: 7,
    'C+': 6,
    C: 5,
    D: 4,
    E: 3,
    F: 0
  };
  return pointsMap[normalized] ?? 0;
}

function marksToLetterGrade(totalMarks: number): string {
  if (totalMarks >= 90) return 'A+';
  if (totalMarks >= 80) return 'A';
  if (totalMarks >= 70) return 'B+';
  if (totalMarks >= 60) return 'B';
  if (totalMarks >= 50) return 'C+';
  if (totalMarks >= 40) return 'C';
  if (totalMarks >= 35) return 'D';
  if (totalMarks > 0) return 'E';
  return 'F';
}

function resolveGradeMetrics(rawGrade: string): { grade: string; totalMarks: number; gradePoints: number } {
  const asNumber = Number(rawGrade);
  if (Number.isFinite(asNumber)) {
    const boundedMarks = Math.max(0, Math.min(100, Math.round(asNumber)));
    const grade = marksToLetterGrade(boundedMarks);
    return {
      grade,
      totalMarks: boundedMarks,
      gradePoints: gradeToPoints(grade)
    };
  }

  const grade = safeString(rawGrade, 'NA');
  const gradePoints = gradeToPoints(grade);
  return {
    grade,
    totalMarks: Math.round(gradePoints * 10),
    gradePoints
  };
}

function buildSemesterResults(enrollments: any[], profileCgpa: number): SemesterResult[] {
  const grouped = new Map<number, any[]>();
  enrollments.forEach((row: any) => {
    const semester = safeNumber(row?.semester, 1);
    const list = grouped.get(semester) ?? [];
    list.push(row);
    grouped.set(semester, list);
  });

  const sortedSemesters = Array.from(grouped.keys()).sort((a, b) => b - a);
  return sortedSemesters.map((semester, index) => {
    const rows = grouped.get(semester) ?? [];
    const courses = rows.map((row: any) => {
      const rawGrade = safeString(row?.grade, 'NA');
      const credits = safeNumber(row?.course?.credits, 0);
      const metrics = resolveGradeMetrics(rawGrade);
      const grade = metrics.grade;
      const totalMarks = metrics.totalMarks;
      const gradePoints = metrics.gradePoints;
      return {
        courseId: safeString(row?.courseId),
        courseCode: safeString(row?.course?.code, '-'),
        courseName: safeString(row?.course?.name, 'Course'),
        credits,
        internalMarks: Math.round(totalMarks * 0.4),
        externalMarks: Math.round(totalMarks * 0.6),
        totalMarks,
        grade,
      };
    });

    const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
    const weightedPoints = courses.reduce((sum, course) => sum + (gradeToPoints(course.grade) * course.credits), 0);
    const sgpa = totalCredits > 0 ? weightedPoints / totalCredits : 0;
    const fallbackCgpa = profileCgpa;

    return normalizeSemesterResult({
      semester,
      year: `${new Date().getFullYear() - index}`,
      sgpa,
      cgpa: fallbackCgpa,
      earnedCredits: courses.reduce((sum, course) => sum + (course.grade === 'F' ? 0 : course.credits), 0),
      totalCredits,
      courses,
    });
  });
}

export default function StudentExaminations() {
  const [examinations, setExaminations] = useState<Exam[]>([]);
  const [semesterResults, setSemesterResults] = useState<SemesterResult[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfileState>({ cgpa: 0, earnedCredits: 0, semester: 1 });
  const [apiError, setApiError] = useState<string | null>(null);
  const [revaluationReason, setRevaluationReason] = useState<Record<string, string>>({});
  const [revaluationRequested, setRevaluationRequested] = useState<Record<string, boolean>>({});
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [_apiLoading, _setApiLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi('/students/examinations'),
      fetchApi('/students/profile'),
      fetchApi('/students/results'),
      fetchApi('/students/current-semester')
    ])
      .then(([examData, profileData, resultData, currentSemesterData]) => {
        const normalizedProfile = normalizeProfile(profileData);
        setStudentProfile(normalizedProfile);
        const currentSemester = Number((currentSemesterData as any)?.currentSemester);
        setSemesterFilter(String(Number.isFinite(currentSemester) ? currentSemester : (normalizedProfile.semester || 'all')));
        setExaminations(Array.isArray(examData) ? examData.map(normalizeExam) : []);
        setSemesterResults(buildSemesterResults(Array.isArray(resultData) ? resultData : [], normalizedProfile.cgpa));
      })
      .catch((error: Error) => {
        setApiError(error.message);
      })
      .finally(() => _setApiLoading(false));
  }, []);

  const [semesterFilter, setSemesterFilter] = useState('all');
  const profile = studentProfile;

  const upcomingExams = examinations.filter(e => e.status === 'upcoming');
  const completedExams = examinations.filter(e => e.status === 'result_declared' || e.status === 'completed');
  const filteredSemesterResults = semesterFilter === 'all'
    ? semesterResults
    : semesterResults.filter((result) => String(result.semester) === semesterFilter);

  const revaluableExams = completedExams.filter((exam) => !revaluationRequested[exam.id]);

  const handleApiTextDownload = async (endpoint: string, filename: string, title: string) => {
    try {
      const payload = await fetchApi<any>(endpoint);
      const lines = [title, ''];

      if (payload?.student) {
        lines.push(`Name: ${safeString(payload.student.name)}`);
        lines.push(`Roll Number: ${safeString(payload.student.rollNumber)}`);
        lines.push(`Program: ${safeString(payload.student.program)}`);
        lines.push(`Branch: ${safeString(payload.student.branch)}`);
        lines.push(`Semester: ${safeNumber(payload.student.semester)}`);
        lines.push('');
      }

      const records = safeArray<any>(payload?.exams ?? payload?.records);
      records.forEach((record: any) => {
        lines.push(
          `${safeString(record?.course?.code ?? record?.courseCode, '-')} | ${safeString(record?.course?.name ?? record?.courseName, 'Course')} | ${safeDate(record?.date ?? record?.courseDate).toLocaleDateString()}`
        );
      });

      lines.push('');
      lines.push(`Generated On: ${safeDate(payload?.generatedAt, new Date()).toLocaleString()}`);
      downloadTextFile(filename, lines.join('\n'));
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: safeString(error?.message, 'Unable to fetch download data.'),
        variant: 'destructive'
      });
    }
  };

  const getExamTypeBadge = (type: string) => {
    switch (type) {
      case 'midterm':
        return <Badge variant="secondary">Mid-Term</Badge>;
      case 'endterm':
        return <Badge>End-Term</Badge>;
      case 'internal':
        return <Badge variant="outline">Internal</Badge>;
      case 'practical':
        return <Badge variant="outline" className="border-success/50 text-success">Practical</Badge>;
      case 'viva':
        return <Badge variant="outline" className="border-info/50 text-info">Viva</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'text-success';
    if (grade === 'B+' || grade === 'B') return 'text-info';
    if (grade === 'C+' || grade === 'C') return 'text-warning';
    return 'text-destructive';
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

  const downloadHallTicket = () => {
    handleApiTextDownload('/students/examinations/hall-ticket', 'hall_ticket.txt', 'Campus Harmony ERP - Hall Ticket');
  };

  const downloadTranscript = () => {
    handleApiTextDownload('/students/results/transcript', 'transcript_summary.txt', 'Campus Harmony ERP - Transcript Summary');
  };

  const handleRevaluationRequest = async (exam: Exam) => {
    try {
      setRequestingId(exam.id);
      await postApi(`/students/examinations/${exam.id}/revaluation`, {
        reason: revaluationReason[exam.id] || `Revaluation requested for ${exam.courseCode}`
      });
      setRevaluationRequested((prev) => ({ ...prev, [exam.id]: true }));
      toast({ title: 'Request submitted', description: `Revaluation request submitted for ${exam.courseCode}.` });
    } catch (error: any) {
      toast({ title: 'Request failed', description: safeString(error?.message, 'Unable to submit revaluation request.'), variant: 'destructive' });
    } finally {
      setRequestingId(null);
    }
  };

  if (apiError) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {apiError}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Examinations</h1>
            <p className="page-description">View exam schedules, hall tickets, and results</p>
          </div>
          <div className="flex gap-4">
            <div className="rounded-lg bg-primary/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-primary">{upcomingExams.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
            <div className="rounded-lg bg-success/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-success">
                {Number.isFinite(profile.cgpa) ? profile.cgpa.toFixed(2) : '-'}
              </p>
              <p className="text-xs text-muted-foreground">CGPA</p>
            </div>
          </div>
        </div>

        {/* Exam Registration Alert */}
        {upcomingExams.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-4 p-4">
              <AlertCircle className="h-8 w-8 text-warning" />
              <div className="flex-1">
                <p className="font-medium">End Semester Examinations</p>
                <p className="text-sm text-muted-foreground">
                  Exams starting from Dec 20, 2024. Download your hall ticket below.
                </p>
              </div>
              <Button onClick={downloadHallTicket}>
                <Download className="mr-2 h-4 w-4" />
                Download Hall Ticket
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="schedule">Exam Schedule</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="revaluation">Revaluation</TabsTrigger>
          </TabsList>

          {/* Exam Schedule */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Examinations
                </CardTitle>
                <CardDescription>Your scheduled exams for this semester</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingExams.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingExams.map((exam) => (
                      <div 
                        key={exam.id}
                        className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg bg-primary/10">
                            <span className="text-2xl font-bold text-primary">
                              {exam.date.getDate()}
                            </span>
                            <span className="text-xs uppercase text-muted-foreground">
                              {exam.date.toLocaleString('default', { month: 'short' })}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{exam.courseCode}</span>
                              {getExamTypeBadge(exam.type)}
                            </div>
                            <p className="text-sm text-muted-foreground">{exam.courseName}</p>
                            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {exam.startTime} - {exam.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {exam.venue}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {exam.seatNumber && (
                            <div className="rounded-lg bg-muted px-4 py-2 text-center">
                              <p className="text-xs text-muted-foreground">Seat No.</p>
                              <p className="font-bold">{exam.seatNumber}</p>
                            </div>
                          )}
                          <div className="rounded-lg bg-muted px-4 py-2 text-center">
                            <p className="text-xs text-muted-foreground">Max Marks</p>
                            <p className="font-bold">{exam.maxMarks}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-success" />
                    <p className="mt-4 text-lg font-medium">No Upcoming Exams</p>
                    <p className="text-sm text-muted-foreground">You're all caught up!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past Exams */}
            <Card>
              <CardHeader>
                <CardTitle>Past Examinations</CardTitle>
                <CardDescription>View your completed exams and scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedExams.map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{exam.courseCode}</span>
                              <p className="text-xs text-muted-foreground">{exam.courseName}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getExamTypeBadge(exam.type)}</TableCell>
                          <TableCell>{exam.date.toLocaleDateString()}</TableCell>
                          <TableCell>
                            {exam.obtainedMarks !== undefined ? (
                              <span className="font-medium">
                                {exam.obtainedMarks}/{exam.maxMarks}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {exam.grade ? (
                              <span className={cn('font-bold', getGradeColor(exam.grade))}>
                                {exam.grade}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results */}
          <TabsContent value="results" className="space-y-6">
            {/* Overall Performance */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <Award className="h-8 w-8 text-primary" />
                  <p className="mt-2 text-3xl font-bold text-primary">
                    {Number.isFinite(profile.cgpa) ? profile.cgpa.toFixed(2) : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">CGPA</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <TrendingUp className="h-8 w-8 text-success" />
                  <p className="mt-2 text-3xl font-bold">
                    {Number.isFinite(semesterResults[0]?.sgpa) ? semesterResults[0].sgpa.toFixed(2) : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Last SGPA</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <BookOpen className="h-8 w-8 text-info" />
                  <p className="mt-2 text-3xl font-bold">{profile.earnedCredits}</p>
                  <p className="text-sm text-muted-foreground">Credits Earned</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <GraduationCap className="h-8 w-8 text-warning" />
                  <p className="mt-2 text-3xl font-bold">{profile.semester}</p>
                  <p className="text-sm text-muted-foreground">Current Semester</p>
                </CardContent>
              </Card>
            </div>

            {/* Semester Results */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Semester Results</CardTitle>
                    <CardDescription>Your academic performance by semester</CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Filter semester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Semesters</SelectItem>
                        {semesterResults.map((result) => (
                          <SelectItem key={result.semester} value={String(result.semester)}>
                            Semester {result.semester}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={downloadTranscript} className="w-full sm:w-auto">
                      <Download className="mr-2 h-4 w-4" />
                      Download Transcript
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {filteredSemesterResults.map((result) => (
                  <div key={result.semester} className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <span className="text-xl font-bold text-primary">{result.semester}</span>
                        </div>
                        <div>
                          <p className="font-medium">Semester {result.semester}</p>
                          <p className="text-sm text-muted-foreground">{result.year}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:gap-6 sm:text-center">
                        <div>
                          <p className="text-2xl font-bold text-success">
                            {Number.isFinite(result.sgpa) ? result.sgpa.toFixed(2) : '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">SGPA</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {Number.isFinite(result.cgpa) ? result.cgpa.toFixed(2) : '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">CGPA</p>
                        </div>
                        <div>
                          <p className="text-lg font-medium">{result.earnedCredits}/{result.totalCredits}</p>
                          <p className="text-xs text-muted-foreground">Credits</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="col-span-3 sm:col-span-1">
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Semester {result.semester} Results</DialogTitle>
                              <DialogDescription>Academic Year: {result.year}</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="mb-4 grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-3">
                                <div>
                                  <p className="text-sm text-muted-foreground">SGPA</p>
                                  <p className="text-2xl font-bold text-success">
                                    {Number.isFinite(result.sgpa) ? result.sgpa.toFixed(2) : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">CGPA</p>
                                  <p className="text-2xl font-bold">
                                    {Number.isFinite(result.cgpa) ? result.cgpa.toFixed(2) : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Credits Earned</p>
                                  <p className="text-2xl font-bold">{result.earnedCredits}/{result.totalCredits}</p>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Course Code</TableHead>
                                      <TableHead>Course Name</TableHead>
                                      <TableHead>Credits</TableHead>
                                      <TableHead>Internal</TableHead>
                                      <TableHead>External</TableHead>
                                      <TableHead>Total</TableHead>
                                      <TableHead>Grade</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {result.courses.map((course) => (
                                      <TableRow key={course.courseId}>
                                        <TableCell className="font-medium">{course.courseCode}</TableCell>
                                        <TableCell>{course.courseName}</TableCell>
                                        <TableCell>{course.credits}</TableCell>
                                        <TableCell>{course.internalMarks}</TableCell>
                                        <TableCell>{course.externalMarks}</TableCell>
                                        <TableCell>{course.totalMarks}</TableCell>
                                        <TableCell>
                                          <span className={cn('font-bold', getGradeColor(course.grade))}>
                                            {course.grade}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <Progress value={(result.sgpa / 10) * 100} className="h-2" />
                  </div>
                ))}
                {filteredSemesterResults.length === 0 && (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    No semester results found for the selected filter.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revaluation */}
          <TabsContent value="revaluation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Revaluation</CardTitle>
                <CardDescription>
                  Apply for revaluation of answer scripts within the allowed timeframe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {revaluableExams.length > 0 ? (
                  <div className="space-y-4">
                    {revaluableExams.map((exam) => (
                      <div key={exam.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{exam.courseCode} - {exam.courseName}</p>
                            <p className="text-sm text-muted-foreground">Exam Date: {exam.date.toLocaleDateString()}</p>
                          </div>
                          <Badge variant="outline">{exam.type}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Label htmlFor={`revaluation-reason-${exam.id}`}>Reason</Label>
                          <Textarea
                            id={`revaluation-reason-${exam.id}`}
                            placeholder="Enter reason for revaluation request"
                            value={revaluationReason[exam.id] || ''}
                            onChange={(event) => {
                              setRevaluationReason((prev) => ({ ...prev, [exam.id]: event.target.value }));
                            }}
                          />
                        </div>
                        <Button
                          className="mt-3"
                          onClick={() => handleRevaluationRequest(exam)}
                          disabled={requestingId === exam.id}
                        >
                          {requestingId === exam.id ? 'Submitting...' : 'Apply for Revaluation'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 font-medium">No Eligible Exams</p>
                    <p className="text-sm text-muted-foreground">
                      Revaluation is available for completed exams that do not already have a pending request.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
