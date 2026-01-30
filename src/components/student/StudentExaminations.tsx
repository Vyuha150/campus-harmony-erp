import { useState } from 'react';
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
import { mockExaminations, mockSemesterResults, mockStudentProfile } from '@/data/studentMockData';
import { cn } from '@/lib/utils';

export default function StudentExaminations() {
  const [semesterFilter, setSemesterFilter] = useState('all');
  const profile = mockStudentProfile;

  const upcomingExams = mockExaminations.filter(e => e.status === 'upcoming');
  const completedExams = mockExaminations.filter(e => e.status === 'result_declared' || e.status === 'completed');

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
              <p className="text-2xl font-bold text-success">{profile.cgpa.toFixed(2)}</p>
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
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Download Hall Ticket
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none">
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
                  <p className="mt-2 text-3xl font-bold text-primary">{profile.cgpa.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">CGPA</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <TrendingUp className="h-8 w-8 text-success" />
                  <p className="mt-2 text-3xl font-bold">
                    {mockSemesterResults[0]?.sgpa.toFixed(2) || '-'}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Semester Results</CardTitle>
                    <CardDescription>Your academic performance by semester</CardDescription>
                  </div>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download Transcript
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {mockSemesterResults.map((result) => (
                  <div key={result.semester} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <span className="text-xl font-bold text-primary">{result.semester}</span>
                        </div>
                        <div>
                          <p className="font-medium">Semester {result.semester}</p>
                          <p className="text-sm text-muted-foreground">{result.year}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-center">
                        <div>
                          <p className="text-2xl font-bold text-success">{result.sgpa.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">SGPA</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{result.cgpa.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">CGPA</p>
                        </div>
                        <div>
                          <p className="text-lg font-medium">{result.earnedCredits}/{result.totalCredits}</p>
                          <p className="text-xs text-muted-foreground">Credits</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
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
                              <div className="mb-4 flex items-center justify-between rounded-lg bg-muted/50 p-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">SGPA</p>
                                  <p className="text-2xl font-bold text-success">{result.sgpa.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">CGPA</p>
                                  <p className="text-2xl font-bold">{result.cgpa.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Credits Earned</p>
                                  <p className="text-2xl font-bold">{result.earnedCredits}/{result.totalCredits}</p>
                                </div>
                              </div>
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
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <Progress value={(result.sgpa / 10) * 100} className="h-2" />
                  </div>
                ))}
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
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 font-medium">No Revaluation Window Open</p>
                  <p className="text-sm text-muted-foreground">
                    Revaluation requests can be submitted within 15 days of result declaration.
                  </p>
                  <Button className="mt-4" disabled>
                    Apply for Revaluation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
