import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, GraduationCap, BookOpen, AlertTriangle, Calendar,
  CheckCircle, XCircle, Clock, ArrowRight, Bell, TrendingUp,
  FileText, ShoppingCart, UserX, Megaphone, BarChart3
} from 'lucide-react';
import { departmentFaculty, departmentStudents, hodApprovals, departmentCalendar } from '@/data/hodMockData';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function HODDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const permanentFaculty = departmentFaculty.filter(f => f.type === 'permanent').length;
  const adjunctFaculty = departmentFaculty.filter(f => f.type !== 'permanent').length;
  const totalStudents = departmentStudents.length;
  const onLeaveFaculty = departmentFaculty.filter(f => f.isOnLeave).length;
  const atRiskStudents = departmentStudents.filter(s => s.cgpa < 6 || s.attendance < 65).length;
  const pendingApprovals = hodApprovals.filter(a => a.status === 'pending').length;

  const studentsByYear = [1, 2, 3, 4].map(y => ({
    year: y,
    count: departmentStudents.filter(s => s.year === y).length,
  }));

  const approvalIcons: Record<string, React.ElementType> = {
    leave: Clock, od: Calendar, purchase: ShoppingCart,
    section_change: Users, grievance: AlertTriangle,
    grade_change: FileText, elective: BookOpen,
  };

  const upcomingEvents = departmentCalendar
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HOD Dashboard</h1>
          <p className="text-muted-foreground">
            Department of Computer Science & Engineering • Academic Year 2025-26
          </p>
        </div>

        {/* Department Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Faculty (Permanent)', value: permanentFaculty, sub: `+${adjunctFaculty} adjunct/visiting`, icon: Users, color: 'text-blue-600 bg-blue-100' },
            { label: 'Total Students', value: totalStudents, sub: studentsByYear.map(s => `Y${s.year}: ${s.count}`).join(' | '), icon: GraduationCap, color: 'text-green-600 bg-green-100' },
            { label: 'Pending Approvals', value: pendingApprovals, sub: 'Requires your action', icon: Bell, color: 'text-amber-600 bg-amber-100' },
            { label: 'At-Risk Students', value: atRiskStudents, sub: 'Low CGPA or attendance', icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs font-medium text-foreground/80">{stat.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Alerts/Approvals – left 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Pending Approvals
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/hod/approvals')}>
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {hodApprovals.filter(a => a.status === 'pending').slice(0, 5).map((item) => {
                  const Icon = approvalIcons[item.type] || FileText;
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.details}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">By {item.requestedBy} • {item.requestedAt}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                          {item.priority}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-100"
                          onClick={() => toast({ title: 'Approved', description: item.title })}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => toast({ title: 'Rejected', description: item.title })}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Faculty On Leave Alert */}
            {onLeaveFaculty > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserX className="h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {onLeaveFaculty} faculty member(s) on leave today
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {departmentFaculty.filter(f => f.isOnLeave).map(f => `${f.name} (${f.leaveType})`).join(', ')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/hod/workload')}>Manage Substitution</Button>
                </CardContent>
              </Card>
            )}

            {/* Announcements from higher-ups */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { from: 'Dean – Faculty of Engineering', msg: 'Submit departmental NIRF data by 31 March 2026', date: '2026-03-05', priority: 'high' as const },
                  { from: 'Registrar Office', msg: 'End-semester exam timetable finalized. Please ensure question papers are submitted by 15 March.', date: '2026-03-04', priority: 'medium' as const },
                  { from: 'IQAC', msg: 'NAAC Peer Team visit scheduled for May 2026. Prepare departmental SSR sections.', date: '2026-03-01', priority: 'high' as const },
                ].map((ann, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-primary">{ann.from}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{ann.date}</span>
                        {ann.priority === 'high' && <Badge variant="destructive" className="text-[10px]">Important</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{ann.msg}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Department Calendar – right 2 cols */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Department Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.map((event) => {
                  const typeColors: Record<string, string> = {
                    deadline: 'bg-destructive/10 text-destructive',
                    meeting: 'bg-blue-100 text-blue-700',
                    seminar: 'bg-purple-100 text-purple-700',
                    exam: 'bg-amber-100 text-amber-700',
                    appraisal: 'bg-green-100 text-green-700',
                  };
                  return (
                    <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="text-center">
                        <p className="text-xs font-bold text-primary">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                        <p className="text-lg font-bold text-foreground">{new Date(event.date).getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
                        {event.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{event.description}</p>}
                      </div>
                      <Badge className={`shrink-0 text-[10px] capitalize ${typeColors[event.type] || ''}`} variant="outline">
                        {event.type}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Faculty Management', icon: Users, path: '/hod/faculty' },
                  { label: 'Workload & Timetable', icon: Calendar, path: '/hod/workload' },
                  { label: 'Student Academics', icon: GraduationCap, path: '/hod/students' },
                  { label: 'Results Analysis', icon: BarChart3, path: '/hod/results' },
                  { label: 'Accreditation Data', icon: FileText, path: '/hod/accreditation' },
                  { label: 'Lab & Inventory', icon: ShoppingCart, path: '/hod/inventory' },
                ].map((action) => (
                  <Button key={action.label} variant="outline" className="h-auto flex-col gap-1.5 py-3 text-xs" onClick={() => navigate(action.path)}>
                    <action.icon className="h-5 w-5 text-primary" />
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
