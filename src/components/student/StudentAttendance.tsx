import { useState } from 'react';
import { 
  CheckCircle, XCircle, Clock, Calendar, Filter, 
  TrendingUp, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCourses } from '@/data/studentMockData';
import { cn } from '@/lib/utils';

export default function StudentAttendance() {
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('december');

  const overallAttendance = Math.round(
    mockCourses.reduce((sum, c) => sum + c.attendance, 0) / mockCourses.length
  );

  const lowAttendanceCourses = mockCourses.filter(c => c.attendance < 75);
  const totalClasses = 46;
  const presentClasses = Math.round((overallAttendance / 100) * totalClasses);

  const getAttendanceColor = (attendance: number) => {
    if (attendance >= 90) return 'text-success';
    if (attendance >= 75) return 'text-warning';
    return 'text-destructive';
  };

  const getAttendanceBg = (attendance: number) => {
    if (attendance >= 90) return 'bg-success/10';
    if (attendance >= 75) return 'bg-warning/10';
    return 'bg-destructive/10';
  };

  // Mock daily attendance data for calendar view
  const generateMonthData = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      const dayOfWeek = new Date(2024, 11, i).getDay();
      if (dayOfWeek === 0) { // Sunday
        days.push({ date: i, status: 'holiday' });
      } else if (i === 25) { // Christmas
        days.push({ date: i, status: 'holiday' });
      } else if (i > 20) { // Exam days - no classes
        days.push({ date: i, status: 'exam' });
      } else {
        const rand = Math.random();
        if (rand > 0.15) {
          days.push({ date: i, status: 'present' });
        } else if (rand > 0.05) {
          days.push({ date: i, status: 'absent' });
        } else {
          days.push({ date: i, status: 'late' });
        }
      }
    }
    return days;
  };

  const monthData = generateMonthData();

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Attendance</h1>
            <p className="page-description">View your attendance records across all courses</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className={cn(getAttendanceBg(overallAttendance))}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Overall Attendance</p>
                <p className={cn('text-3xl font-bold', getAttendanceColor(overallAttendance))}>
                  {overallAttendance}%
                </p>
              </div>
              <TrendingUp className={cn('h-8 w-8', getAttendanceColor(overallAttendance))} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Classes Attended</p>
                <p className="text-3xl font-bold">{presentClasses}/{totalClasses}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </CardContent>
          </Card>
          <Card className={cn(lowAttendanceCourses.length > 0 && 'border-destructive/50')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Low Attendance</p>
                <p className={cn(
                  'text-3xl font-bold',
                  lowAttendanceCourses.length > 0 ? 'text-destructive' : 'text-success'
                )}>
                  {lowAttendanceCourses.length} courses
                </p>
              </div>
              <AlertCircle className={cn(
                'h-8 w-8',
                lowAttendanceCourses.length > 0 ? 'text-destructive' : 'text-success'
              )} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Required</p>
                <p className="text-3xl font-bold">75%</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Low Attendance Warning */}
        {lowAttendanceCourses.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <AlertCircle className="mt-1 h-6 w-6 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Attendance Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Your attendance is below 75% in the following courses. This may affect your exam eligibility.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lowAttendanceCourses.map((course) => (
                      <Badge key={course.id} variant="destructive">
                        {course.code} - {course.attendance}%
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Course-wise Attendance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Course-wise Attendance</CardTitle>
                <CardDescription>Your attendance percentage for each course</CardDescription>
              </div>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {mockCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mockCourses
                .filter(c => selectedCourse === 'all' || c.id === selectedCourse)
                .map((course) => (
                  <div key={course.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{course.code}</Badge>
                        <span className="font-medium">{course.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={cn('text-lg font-bold', getAttendanceColor(course.attendance))}>
                            {course.attendance}%
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {Math.round((course.attendance / 100) * 46)}/46 classes
                          </p>
                        </div>
                        {course.attendance >= 75 ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={course.attendance} 
                      className={cn(
                        'h-3',
                        course.attendance >= 90 && '[&>div]:bg-success',
                        course.attendance >= 75 && course.attendance < 90 && '[&>div]:bg-warning',
                        course.attendance < 75 && '[&>div]:bg-destructive'
                      )}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Faculty: {course.faculty}</span>
                      <span className={course.attendance >= 75 ? 'text-success' : 'text-destructive'}>
                        {course.attendance >= 75 ? 'Eligible for exam' : `Need ${Math.ceil((75 - course.attendance) * 0.46)} more classes`}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Calendar View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance Calendar</CardTitle>
                <CardDescription>Daily attendance view</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-32 text-center font-medium">December 2024</span>
                <Button variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {/* Empty cells for start of month (Dec 2024 starts on Sunday) */}
              {monthData.map((day, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center rounded-lg text-sm',
                    day.status === 'present' && 'bg-success/10 text-success',
                    day.status === 'absent' && 'bg-destructive/10 text-destructive',
                    day.status === 'late' && 'bg-warning/10 text-warning',
                    day.status === 'holiday' && 'bg-muted text-muted-foreground',
                    day.status === 'exam' && 'bg-info/10 text-info'
                  )}
                >
                  <span className="font-medium">{day.date}</span>
                  <span className="text-[10px]">
                    {day.status === 'present' && '✓'}
                    {day.status === 'absent' && '✗'}
                    {day.status === 'late' && 'L'}
                    {day.status === 'holiday' && 'H'}
                    {day.status === 'exam' && 'E'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-success/20" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-destructive/20" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-warning/20" />
                <span>Late</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-muted" />
                <span>Holiday</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-info/20" />
                <span>Exam</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
