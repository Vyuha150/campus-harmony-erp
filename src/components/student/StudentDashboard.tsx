import { useState, useEffect } from 'react';
import {
  BookOpen, Calendar, Clock, Bell, CheckCircle, AlertCircle,
  TrendingUp, Award, FileText, Wallet, ArrowRight, MessageSquare,
  Briefcase, GraduationCap, Library, Building2, Loader2, Megaphone, Users
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { fetchApi } from '@/lib/apiService';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchApi('/students/dashboard'),
      fetchApi('/students/courses'),
      fetchApi('/students/attendance'),
      fetchApi('/students/assignments'),
    ]).then(([dashData, coursesData, attendanceData, assignmentsData]) => {
      const attendanceByCourseId = new Map(
        safeArray(attendanceData).map((item: any) => [safeString(item?.courseId), safeNumber(item?.percentage)])
      );

      const mergedCourses = safeArray(coursesData).map((course: any) => ({
        ...course,
        attendance: attendanceByCourseId.get(safeString(course?.id)) ?? safeNumber(course?.attendance)
      }));

      setDashboard(dashData ?? {});
      setCourses(mergedCourses);
      setAssignments(safeArray(assignmentsData));
      setLoading(false);
    }).catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  const stats = safeArray(dashboard?.stats);
  const profile = {
    name: safeString(dashboard?.profile?.name, user.name),
    cgpa: safeNumber(dashboard?.profile?.cgpa),
    program: safeString(dashboard?.profile?.program),
    branch: safeString(dashboard?.profile?.branch),
    semester: safeNumber(dashboard?.profile?.semester),
    rollNumber: safeString(dashboard?.profile?.rollNumber),
    earnedCredits: safeNumber(dashboard?.profile?.earnedCredits),
    totalCredits: safeNumber(dashboard?.profile?.totalCredits, 1),
  };

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

  const pendingAssignments = assignments.filter((a: any) => {
    const status = safeString(a?.status);
    return status === 'pending' || status === 'overdue';
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {(profile.name || user.name || '').split(' ').map((n: string) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {getGreeting()}, {(profile.name || user.name || '').split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                {profile.program} {profile.branch} • Semester {profile.semester} • {profile.rollNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled>
              <Calendar className="mr-2 h-4 w-4" />
              {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat: any, i: number) => (
            <StatCard
              key={i}
              title={stat.label}
              value={stat.value}
              icon={stat.icon === 'TrendingUp' ? <TrendingUp className="h-6 w-6" /> :
                    stat.icon === 'Calendar' ? <CheckCircle className="h-6 w-6" /> :
                    stat.icon === 'BookOpen' ? <BookOpen className="h-6 w-6" /> :
                    <Wallet className="h-6 w-6" />}
              variant={stat.changeType === 'increase' ? 'success' : 'default'}
            />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
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
                {courses.slice(0, 5).map((course: any) => (
                  <div key={course.id || course.code} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{course.code}</span>
                        <span className="text-muted-foreground">{course.name}</span>
                      </div>
                      <span className={cn('font-semibold', getAttendanceColor(course.attendance || 0))}>
                        {course.attendance || 0}%
                      </span>
                    </div>
                    <Progress 
                      value={course.attendance || 0} 
                      className={cn(
                        'h-2',
                        (course.attendance || 0) >= 90 && '[&>div]:bg-success',
                        (course.attendance || 0) >= 75 && (course.attendance || 0) < 90 && '[&>div]:bg-warning',
                        (course.attendance || 0) < 75 && '[&>div]:bg-destructive'
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
                {pendingAssignments.slice(0, 4).map((assignment: any) => (
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
                          Due: {safeDate(assignment.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                {pendingAssignments.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No pending assignments</p>
                )}
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
                <Link to="/student/communication">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <Megaphone className="h-5 w-5 text-primary" />
                    <span className="text-xs">Messages</span>
                  </Button>
                </Link>
                <Link to="/student/mentoring">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 p-4">
                    <Users className="h-5 w-5 text-info" />
                    <span className="text-xs">Mentoring</span>
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
                    <p className="text-3xl font-bold text-primary">{(profile.cgpa || 0).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">CGPA</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold">{profile.earnedCredits || 0}/{profile.totalCredits || 0}</p>
                    <p className="text-sm text-muted-foreground">Credits Earned</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Credit Completion</span>
                    <span className="font-medium">{Math.round(((profile.earnedCredits || 0) / (profile.totalCredits || 1)) * 100)}%</span>
                  </div>
                  <Progress value={((profile.earnedCredits || 0) / (profile.totalCredits || 1)) * 100} className="h-2" />
                </div>
              </div>
            </WidgetCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
