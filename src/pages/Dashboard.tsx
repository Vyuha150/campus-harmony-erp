import { 
  Users, GraduationCap, BookOpen, FileText, 
  TrendingUp, Clock, CheckCircle, AlertCircle,
  Calendar, Bell, ArrowRight, Building2, Wallet
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { ScheduleWidget } from '@/components/dashboard/ScheduleWidget';
import { AnnouncementsWidget } from '@/components/dashboard/AnnouncementsWidget';
import { TasksWidget } from '@/components/dashboard/TasksWidget';
import { AttendanceChart, EnrollmentChart, PlacementChart, ResearchChart } from '@/components/dashboard/Charts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_INFO } from '@/types/erp';

// Role-specific stats configurations
const getRoleStats = (role: string) => {
  const commonStats = {
    vice_chancellor: [
      { title: 'Total Students', value: '12,458', change: 8.2, trend: 'up' as const, icon: <Users className="h-6 w-6" /> },
      { title: 'Faculty Members', value: '847', change: 3.1, trend: 'up' as const, icon: <GraduationCap className="h-6 w-6" /> },
      { title: 'Research Publications', value: '1,247', change: 15.4, trend: 'up' as const, icon: <BookOpen className="h-6 w-6" /> },
      { title: 'NIRF Rank', value: '#42', change: 5, trend: 'up' as const, icon: <TrendingUp className="h-6 w-6" />, variant: 'primary' as const },
    ],
    registrar: [
      { title: 'Pending Approvals', value: '23', icon: <Clock className="h-6 w-6" />, variant: 'warning' as const },
      { title: 'Certificates Issued', value: '1,847', change: 12, trend: 'up' as const, icon: <FileText className="h-6 w-6" /> },
      { title: 'Active Programs', value: '68', icon: <BookOpen className="h-6 w-6" /> },
      { title: 'Exam Results Pending', value: '5', icon: <AlertCircle className="h-6 w-6" /> },
    ],
    faculty: [
      { title: 'My Courses', value: '4', icon: <BookOpen className="h-6 w-6" /> },
      { title: 'Students Enrolled', value: '248', icon: <Users className="h-6 w-6" /> },
      { title: 'Attendance Today', value: '89%', change: 2.1, trend: 'up' as const, icon: <CheckCircle className="h-6 w-6" /> },
      { title: 'Pending Evaluations', value: '32', icon: <FileText className="h-6 w-6" />, variant: 'warning' as const },
    ],
    student: [
      { title: 'CGPA', value: '8.74', change: 0.3, trend: 'up' as const, icon: <TrendingUp className="h-6 w-6" />, variant: 'success' as const },
      { title: 'Attendance', value: '87%', icon: <CheckCircle className="h-6 w-6" /> },
      { title: 'Courses This Sem', value: '6', icon: <BookOpen className="h-6 w-6" /> },
      { title: 'Library Books', value: '3', icon: <BookOpen className="h-6 w-6" /> },
    ],
    hod: [
      { title: 'Department Faculty', value: '24', icon: <GraduationCap className="h-6 w-6" /> },
      { title: 'Department Students', value: '580', change: 5.2, trend: 'up' as const, icon: <Users className="h-6 w-6" /> },
      { title: 'Leave Requests', value: '3', icon: <Clock className="h-6 w-6" />, variant: 'warning' as const },
      { title: 'Research Projects', value: '12', icon: <BookOpen className="h-6 w-6" /> },
    ],
    finance_officer: [
      { title: 'Fee Collection (FY)', value: '₹24.5 Cr', change: 12.3, trend: 'up' as const, icon: <Wallet className="h-6 w-6" />, variant: 'success' as const },
      { title: 'Pending Dues', value: '₹1.2 Cr', icon: <AlertCircle className="h-6 w-6" />, variant: 'warning' as const },
      { title: 'Budget Utilization', value: '72%', icon: <TrendingUp className="h-6 w-6" /> },
      { title: 'Pending Approvals', value: '8', icon: <Clock className="h-6 w-6" /> },
    ],
    placement_officer: [
      { title: 'Companies Visited', value: '87', change: 22, trend: 'up' as const, icon: <Building2 className="h-6 w-6" /> },
      { title: 'Offers Made', value: '456', change: 18, trend: 'up' as const, icon: <CheckCircle className="h-6 w-6" />, variant: 'success' as const },
      { title: 'Placement Rate', value: '78%', change: 5, trend: 'up' as const, icon: <TrendingUp className="h-6 w-6" /> },
      { title: 'Avg. Package', value: '₹8.2 LPA', change: 12, trend: 'up' as const, icon: <Wallet className="h-6 w-6" /> },
    ],
  };

  return commonStats[role as keyof typeof commonStats] || commonStats.vice_chancellor;
};

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];
  const stats = getRoleStats(user.role);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">
              {getGreeting()}, {user.name.split(' ')[0]}!
            </h1>
            <p className="page-description">
              Welcome to your {roleInfo.label} dashboard. Here's what's happening today.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Dec 10, 2024
            </Button>
            <Button size="sm" className="bg-primary">
              <Bell className="mr-2 h-4 w-4" />
              3 Alerts
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard
              key={index}
              title={stat.title}
              value={stat.value}
              change={stat.change}
              changeLabel="vs last month"
              icon={stat.icon}
              trend={stat.trend}
              variant={stat.variant || 'default'}
            />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Schedule & Tasks */}
          <div className="space-y-6 lg:col-span-2">
            {/* Today's Schedule */}
            <WidgetCard
              title="Today's Schedule"
              description="Your classes and meetings for today"
              action={
                <Button variant="ghost" size="sm" className="text-primary">
                  View Calendar <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              }
            >
              <ScheduleWidget />
            </WidgetCard>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
              <WidgetCard title="Attendance Trend" description="Monthly attendance overview">
                <AttendanceChart />
              </WidgetCard>
              
              {user.role === 'vice_chancellor' || user.role === 'registrar' || user.role === 'dean' ? (
                <WidgetCard title="Enrollment Trend" description="Year-wise student intake">
                  <EnrollmentChart />
                </WidgetCard>
              ) : user.role === 'placement_officer' ? (
                <WidgetCard title="Placement Statistics" description="Batch 2024 outcomes">
                  <PlacementChart />
                </WidgetCard>
              ) : (
                <WidgetCard title="Research Output" description="Publications, patents & projects">
                  <ResearchChart />
                </WidgetCard>
              )}
            </div>

            {/* Tasks */}
            <WidgetCard
              title="Pending Tasks"
              description="Your action items and deadlines"
              action={
                <Button variant="ghost" size="sm" className="text-primary">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              }
            >
              <TasksWidget />
            </WidgetCard>
          </div>

          {/* Right Column - Announcements & Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <WidgetCard title="Quick Actions">
              <div className="grid grid-cols-2 gap-2">
                {user.role === 'faculty' && (
                  <>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <span className="text-xs">Mark Attendance</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <FileText className="h-5 w-5 text-info" />
                      <span className="text-xs">Upload Marks</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="text-xs">Course Material</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Users className="h-5 w-5 text-accent" />
                      <span className="text-xs">Mentees</span>
                    </Button>
                  </>
                )}
                {user.role === 'student' && (
                  <>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="text-xs">View Courses</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <FileText className="h-5 w-5 text-info" />
                      <span className="text-xs">Results</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Wallet className="h-5 w-5 text-success" />
                      <span className="text-xs">Pay Fees</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Calendar className="h-5 w-5 text-warning" />
                      <span className="text-xs">Exam Schedule</span>
                    </Button>
                  </>
                )}
                {(user.role === 'vice_chancellor' || user.role === 'registrar' || user.role === 'hod' || user.role === 'dean') && (
                  <>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Clock className="h-5 w-5 text-warning" />
                      <span className="text-xs">Approvals</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <FileText className="h-5 w-5 text-info" />
                      <span className="text-xs">Reports</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="text-xs">Directory</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <span className="text-xs">Analytics</span>
                    </Button>
                  </>
                )}
                {(user.role === 'finance_officer' || user.role === 'placement_officer' || user.role === 'super_admin') && (
                  <>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <FileText className="h-5 w-5 text-info" />
                      <span className="text-xs">Reports</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <span className="text-xs">Analytics</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Clock className="h-5 w-5 text-warning" />
                      <span className="text-xs">Pending</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="text-xs">Directory</span>
                    </Button>
                  </>
                )}
              </div>
            </WidgetCard>

            {/* Announcements */}
            <WidgetCard
              title="Announcements"
              description="Latest updates and notices"
              action={
                <Button variant="ghost" size="sm" className="text-primary">
                  All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              }
            >
              <AnnouncementsWidget />
            </WidgetCard>

            {/* Compliance Status (for admin roles) */}
            {(user.role === 'vice_chancellor' || user.role === 'registrar' || user.role === 'iqac_coordinator') && (
              <WidgetCard title="Compliance Status" description="NAAC/UGC/NIRF readiness">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span className="text-sm font-medium">NAAC SSR</span>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">92% Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-warning" />
                      <span className="text-sm font-medium">NIRF Data</span>
                    </div>
                    <Badge variant="outline" className="bg-warning/10 text-warning">78% Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span className="text-sm font-medium">UGC DCF</span>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">Submitted</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-info" />
                      <span className="text-sm font-medium">AQAR 2024</span>
                    </div>
                    <Badge variant="outline" className="bg-info/10 text-info">In Progress</Badge>
                  </div>
                </div>
              </WidgetCard>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
