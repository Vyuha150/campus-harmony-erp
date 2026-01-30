import { useState } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCourses, mockStudentProfile } from '@/data/studentMockData';
import { Course } from '@/types/student';
import { cn } from '@/lib/utils';

export default function StudentCourses() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const profile = mockStudentProfile;

  const totalCredits = mockCourses.reduce((sum, c) => sum + c.credits, 0);
  const avgAttendance = Math.round(mockCourses.reduce((sum, c) => sum + c.attendance, 0) / mockCourses.length);

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
            <div className="rounded-lg bg-primary/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-primary">{mockCourses.length}</p>
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
          {mockCourses.map((course) => {
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
                        {Math.round((course.internalMarks / course.maxInternalMarks) * 100)}%
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
                                value={(course.internalMarks / course.maxInternalMarks) * 100} 
                                className="mt-2 h-2"
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border p-4">
                            <h4 className="font-medium">Syllabus</h4>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Click to download or view the complete syllabus for this course.
                            </p>
                            <Button variant="outline" size="sm" className="mt-3">
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
                                  <p className="text-2xl font-bold text-success">42</p>
                                  <p className="text-xs text-muted-foreground">Present</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-destructive">4</p>
                                  <p className="text-xs text-muted-foreground">Absent</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold">46</p>
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
                              <Button size="sm" variant="outline">
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
                              <Button size="sm" variant="outline">
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
                              <Button size="sm" variant="outline">
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
