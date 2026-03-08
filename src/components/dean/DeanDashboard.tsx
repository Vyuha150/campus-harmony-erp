import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Users, GraduationCap, Building2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, ArrowRight, BarChart3,
  Award, Calendar, Briefcase, Target, Minus
} from 'lucide-react';
import { departmentSummaries, deanApprovals, qualityMetrics } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function DeanDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const totalStudents = departmentSummaries.reduce((s, d) => s + d.totalStudents, 0);
  const totalFaculty = departmentSummaries.reduce((s, d) => s + d.totalFaculty, 0);
  const totalVacancies = departmentSummaries.reduce((s, d) => s + d.vacancies, 0);
  const avgPass = Math.round(departmentSummaries.reduce((s, d) => s + d.avgPassPercentage, 0) / departmentSummaries.length * 10) / 10;
  const pendingApprovals = deanApprovals.filter(a => a.status === 'pending').length;

  const trendIcon = (t: string) => t === 'up' ? <TrendingUp className="h-3 w-3 text-green-600" /> : t === 'down' ? <TrendingDown className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3 text-muted-foreground" />;

  const approvalIcons: Record<string, React.ElementType> = {
    purchase: Briefcase, leave: Calendar, curriculum: GraduationCap,
    transfer: Users, results: BarChart3, budget: Target, recruitment: Users,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dean's Dashboard</h1>
          <p className="text-muted-foreground">Faculty of Engineering • Academic Year 2025-26</p>
        </div>

        {/* Top Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Departments', value: departmentSummaries.length, icon: Building2, color: 'text-blue-600 bg-blue-100' },
            { label: 'Total Students', value: totalStudents.toLocaleString(), icon: GraduationCap, color: 'text-green-600 bg-green-100' },
            { label: 'Total Faculty', value: totalFaculty, icon: Users, color: 'text-purple-600 bg-purple-100' },
            { label: 'Vacancies', value: totalVacancies, icon: AlertTriangle, color: 'text-amber-600 bg-amber-100' },
            { label: 'Pending Approvals', value: pendingApprovals, icon: Bell, color: 'text-destructive bg-destructive/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Department Comparison + Approvals */}
          <div className="lg:col-span-3 space-y-6">
            {/* Department Comparison */}
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Department Overview
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/dean/academics')}>
                  Details <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {departmentSummaries.map(dept => (
                  <div key={dept.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{dept.name}</p>
                        <p className="text-[10px] text-muted-foreground">HOD: {dept.hod} • {dept.totalStudents} students • {dept.totalFaculty} faculty</p>
                      </div>
                      {dept.vacancies > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{dept.vacancies} vacancies</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'Pass %', value: `${dept.avgPassPercentage}%`, ok: dept.avgPassPercentage >= 85 },
                        { label: 'Attendance', value: `${dept.avgAttendance}%`, ok: dept.avgAttendance >= 75 },
                        { label: 'Publications', value: dept.researchOutput, ok: true },
                        { label: 'Placement', value: `${dept.placementRate}%`, ok: dept.placementRate >= 80 },
                      ].map(m => (
                        <div key={m.label}>
                          <p className={`text-sm font-bold ${m.ok ? 'text-foreground' : 'text-destructive'}`}>{m.value}</p>
                          <p className="text-[10px] text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Pending Approvals */}
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Pending Approvals ({pendingApprovals})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deanApprovals.filter(a => a.status === 'pending').slice(0, 5).map(item => {
                  const Icon = approvalIcons[item.type] || Bell;
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.details}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.department} • {item.requestedBy} • {item.requestedAt}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.amount && <span className="text-xs font-mono text-muted-foreground">₹{(item.amount / 100000).toFixed(1)}L</span>}
                        <Badge variant={item.priority === 'high' || item.priority === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{item.priority}</Badge>
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
          </div>

          {/* Right: Quality Metrics */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Quality Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {qualityMetrics.slice(0, 8).map(qm => (
                  <div key={qm.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{qm.metric}</p>
                        {trendIcon(qm.trend)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Target: {qm.target} • Prev: {qm.previousValue}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{qm.currentValue}</p>
                      <Badge variant={qm.status === 'on_track' ? 'default' : qm.status === 'at_risk' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">{qm.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Academic Oversight', icon: GraduationCap, path: '/dean/academics' },
                  { label: 'Faculty HR', icon: Users, path: '/dean/faculty-hr' },
                  { label: 'Student Affairs', icon: Users, path: '/dean/student-affairs' },
                  { label: 'Exams & Results', icon: BarChart3, path: '/dean/results' },
                  { label: 'Finance', icon: Target, path: '/dean/finance' },
                  { label: 'Accreditation', icon: Award, path: '/dean/accreditation' },
                ].map(a => (
                  <Button key={a.label} variant="outline" className="h-auto flex-col gap-1.5 py-3 text-xs" onClick={() => navigate(a.path)}>
                    <a.icon className="h-5 w-5 text-primary" />
                    {a.label}
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
