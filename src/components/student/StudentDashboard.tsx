import { 
  BookOpen, Calendar, Clock, Bell, CheckCircle, AlertCircle, 
  TrendingUp, Award, FileText, Wallet, ArrowRight, MessageSquare,
  Briefcase, GraduationCap, Library, Building2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  mockStudentProfile, mockCourses, mockAssignments, 
  mockTodaySchedule, mockNotifications, mockFeeRecords,
  mockExaminations, mockPlacementDrives
} from '@/data/studentMockData';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function StudentDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const profile = mockStudentProfile;
  const overallAttendance = Math.round(
    mockCourses.reduce((sum, c) => sum + c.attendance, 0) / mockCourses.length
  );
  const pendingAssignments = mockAssignments.filter(a => a.status === 'pending' || a.status === 'overdue').length;
  const pendingFees = mockFeeRecords.filter(f => f.status === 'pending' || f.status === 'overdue')
    .reduce((sum, f) => sum + f.amount, 0);
  const upcomingExams = mockExaminations.filter(e => e.status === 'upcoming').length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getAttendanceColor = (attendance: number) => {
    if (attendance >= 90) return 'text-success';
    if (attendance >= 75) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {getGreeting()}, {profile.name.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                {profile.program} {profile.branch} • Semester {profile.semester} • {profile.rollNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Dec 10, 2024
            </Button>
            <Button size="sm" className="relative">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                {mockNotifications.filter(n => !n.read).length}
              </span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="CGPA"
            value={profile.cgpa.toFixed(2)}
            change={0.3}
            changeLabel="vs last sem"
            icon={<TrendingUp className="h-6 w-6" />}
            trend="up"
            variant="success"
          />
          <StatCard
            title="Attendance"
            value={`${overallAttendance}%`}
            icon={<CheckCircle className="h-6 w-6" />}
            variant={overallAttendance >= 75 ? 'default' : 'warning'}
          />
          <StatCard
            title="Pending Assignments"
            value={pendingAssignments}
            icon={<FileText className="h-6 w-6" />}
            variant={pendingAssignments > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Pending Fees"
            value={`₹${(pendingFees / 1000).toFixed(0)}K`}
            icon={<Wallet className="h-6 w-6" />}
            variant={pendingFees > 0 ? 'warning' : 'success'}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Today's Schedule */}
            <WidgetCard
              title="Today's Schedule"
              description="Your classes and activities for today"
              action={
                <Link to="/student/timetable">
                  <Button variant="ghost" size="sm" className="text-primary">
                    Full Timetable <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            >
              <div className="space-y-3">
                {mockTodaySchedule.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                      event.type === 'deadline' && 'border-warning/50 bg-warning/5'
                    )}
                  >
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-muted">
                      <span className="text-xs font-medium text-muted-foreground">
                        {event.startTime.split(':')[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {parseInt(event.startTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.title}</span>
                        {event.courseCode && (
                          <Badge variant="secondary" className="text-xs">
                            {event.courseCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.startTime} - {event.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {event.venue}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        event.type === 'class' && 'border-primary/50 text-primary',
                        event.type === 'lab' && 'border-success/50 text-success',
                        event.type === 'deadline' && 'border-warning/50 text-warning',
                        event.type === 'event' && 'border-muted-foreground/50 text-muted-foreground'
                      )}
                    >
                      {event.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </WidgetCard>

            {/* Course Attendance Overview */}
            <WidgetCard
              title="Course Attendance"
              description="Your attendance across all courses"
              action={
                <Link to="/student/attendance">
                  <Button variant="ghost" size="sm" className="text-primary">
                    View Details <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            >
              <div className="space-y-4">
                {mockCourses.slice(0, 5).map((course) => (
                  <div key={course.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{course.code}</span>
                        <span className="text-muted-foreground">{course.name}</span>
                      </div>
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
                  </div>
                ))}
              </div>
            </WidgetCard>

            {/* Pending Assignments */}
            <WidgetCard
              title="Pending Assignments"
              description="Upcoming and overdue submissions"
              action={
                <Link to="/student/assignments">
                  <Button variant="ghost" size="sm" className="text-primary">
                    All Assignments <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            >
              <div className="space-y-3">
                {mockAssignments
                  .filter(a => a.status === 'pending' || a.status === 'overdue')
                  .slice(0, 4)
                  .map((assignment) => (
                    <div
                      key={assignment.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3',
                        assignment.status === 'overdue' && 'border-destructive/50 bg-destructive/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          assignment.status === 'overdue' ? 'bg-destructive/10' : 'bg-primary/10'
                        )}>
                          <FileText className={cn(
                            'h-5 w-5',
                            assignment.status === 'overdue' ? 'text-destructive' : 'text-primary'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">{assignment.courseCode}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={assignment.status === 'overdue' ? 'destructive' : 'outline'}>
                          {assignment.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due: {assignment.dueDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </WidgetCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <WidgetCard title="Quick Actions">
              <div className="grid grid-cols-2 gap-2">
                <Link to="/student/courses">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-xs">My Courses</span>
                  </Button>
                </Link>
                <Link to="/student/examinations">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <GraduationCap className="h-5 w-5 text-info" />
                    <span className="text-xs">Exams</span>
                  </Button>
                </Link>
                <Link to="/student/fees">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <Wallet className="h-5 w-5 text-success" />
                    <span className="text-xs">Pay Fees</span>
                  </Button>
                </Link>
                <Link to="/student/library">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <Library className="h-5 w-5 text-warning" />
                    <span className="text-xs">Library</span>
                  </Button>
                </Link>
                <Link to="/student/placements">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <Briefcase className="h-5 w-5 text-accent" />
                    <span className="text-xs">Placements</span>
                  </Button>
                </Link>
                <Link to="/student/grievances">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <MessageSquare className="h-5 w-5 text-destructive" />
                    <span className="text-xs">Grievance</span>
                  </Button>
                </Link>
              </div>
            </WidgetCard>

            {/* Academic Performance */}
            <WidgetCard title="Academic Performance" description="Semester-wise progress">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-primary">{profile.cgpa.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">CGPA</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold">{profile.earnedCredits}/{profile.totalCredits}</p>
                    <p className="text-sm text-muted-foreground">Credits Earned</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Credit Completion</span>
                    <span className="font-medium">{Math.round((profile.earnedCredits / profile.totalCredits) * 100)}%</span>
                  </div>
                  <Progress value={(profile.earnedCredits / profile.totalCredits) * 100} className="h-2" />
                </div>
              </div>
            </WidgetCard>

            {/* Upcoming Exams */}
            <WidgetCard
              title="Upcoming Exams"
              action={
                <Link to="/student/examinations">
                  <Button variant="ghost" size="sm" className="text-primary">
                    All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              }
            >
              <div className="space-y-3">
                {mockExaminations
                  .filter(e => e.status === 'upcoming')
                  .slice(0, 3)
                  .map((exam) => (
                    <div key={exam.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-background">
                        <span className="text-lg font-bold text-primary">
                          {exam.date.getDate()}
                        </span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {exam.date.toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{exam.courseCode}</p>
                        <p className="text-xs text-muted-foreground">{exam.courseName}</p>
                        <p className="text-xs text-muted-foreground">{exam.venue}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </WidgetCard>

            {/* Notifications */}
            <WidgetCard title="Recent Notifications">
              <div className="space-y-3">
                {mockNotifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg p-3 transition-colors',
                      notif.read ? 'bg-muted/30' : 'bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full',
                      notif.type === 'success' && 'bg-success/10',
                      notif.type === 'warning' && 'bg-warning/10',
                      notif.type === 'info' && 'bg-info/10',
                      notif.type === 'error' && 'bg-destructive/10'
                    )}>
                      {notif.type === 'success' && <CheckCircle className="h-4 w-4 text-success" />}
                      {notif.type === 'warning' && <AlertCircle className="h-4 w-4 text-warning" />}
                      {notif.type === 'info' && <Bell className="h-4 w-4 text-info" />}
                      {notif.type === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn('text-sm font-medium', !notif.read && 'text-foreground')}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                ))}
              </div>
            </WidgetCard>

            {/* Placement Highlight */}
            {mockPlacementDrives.some(d => d.applicationStatus === 'selected') && (
              <WidgetCard title="🎉 Placement Offer">
                <div className="rounded-lg bg-success/10 p-4 text-center">
                  <Award className="mx-auto h-12 w-12 text-success" />
                  <p className="mt-2 text-lg font-bold text-success">Congratulations!</p>
                  <p className="text-sm text-muted-foreground">
                    Selected for Amazon SDE Internship
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">₹1.2 LPA Stipend</p>
                </div>
              </WidgetCard>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
