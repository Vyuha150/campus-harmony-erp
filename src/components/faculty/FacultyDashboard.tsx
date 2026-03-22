import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Clock, MapPin, Users, CheckCircle2, AlertTriangle, Bell,
  BookOpen, ClipboardCheck, FileText, TrendingUp, Calendar,
  MessageSquare, ChevronRight, Brain, BarChart3
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FacultyDashboard() {
  const [todaySchedule, setTodaySchedule] = useState<any>([]);
  const [facultyAssignments, setFacultyAssignments] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [menteeStudents, setMenteeStudents] = useState<any>([]);
  const [facultyProfile, setFacultyProfile] = useState<any>({
    name: '',
    designation: '',
    department: '',
    coursesThisSemester: 0,
    totalStudents: 0,
    weeklyHours: 0,
    totalPublications: 0
  });
  const [announcements, setAnnouncements] = useState<any>([]);
  const [pendingTasks, setPendingTasks] = useState<any>([]);
  const [performanceAlerts, setPerformanceAlerts] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadDashboardData = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const [sessions, assignments, tasks] = await Promise.all([
      fetchApi(`/faculty/attendance/sessions${semesterQuery}`),
      fetchApi(`/faculty/assignments${semesterQuery}`),
      fetchApi(`/faculty/dashboard/tasks${semesterQuery}`)
    ]);
    setTodaySchedule(Array.isArray(sessions) ? sessions : []);
    setFacultyAssignments(Array.isArray(assignments) ? assignments : []);
    setPendingTasks(Array.isArray(tasks) ? tasks : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [allCoursesResponse, currentSemesterResponse, menteesResponse, profileResponse, announcementsResponse, alertsResponse] = await Promise.all([
          fetchApi('/faculty/courses'),
          fetchApi('/faculty/current-semester'),
          fetchApi('/faculty/mentees'),
          fetchApi('/faculty/profile'),
          fetchApi('/faculty/dashboard/announcements'),
          fetchApi('/faculty/dashboard/alerts')
        ]);
        const semesters = Array.from(new Set((Array.isArray(allCoursesResponse) ? allCoursesResponse : []).map((course: any) => Number(course?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        setSemesterOptions(semesters);
        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        setMenteeStudents(Array.isArray(menteesResponse) ? menteesResponse : []);
        setFacultyProfile(profileResponse || {});
        setAnnouncements(Array.isArray(announcementsResponse) ? announcementsResponse : []);
        setPerformanceAlerts(Array.isArray(alertsResponse) ? alertsResponse : []);
        await loadDashboardData(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadDashboardData(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const pendingAssignments = facultyAssignments.filter(a => a.pendingEvaluation > 0);
  const atRiskStudents = menteeStudents.filter(m => m.riskLevel === 'high');
  const displayName = facultyProfile.name
    ? (facultyProfile.name.split('.')[1]?.trim() || facultyProfile.name)
    : 'Faculty';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="text-muted-foreground">
            {facultyProfile.designation} • {facultyProfile.department} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="w-[220px]">
          <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterOptions.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Courses', value: facultyProfile.coursesThisSemester, icon: BookOpen, color: 'text-primary' },
            { label: 'Students', value: facultyProfile.totalStudents, icon: Users, color: 'text-blue-600' },
            { label: 'Weekly Hours', value: `${facultyProfile.weeklyHours}h`, icon: Clock, color: 'text-amber-600' },
            { label: 'Publications', value: facultyProfile.totalPublications, icon: TrendingUp, color: 'text-green-600' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2 border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Schedule
              </CardTitle>
              <Link to="/faculty/courses">
                <Button variant="ghost" size="sm" className="text-xs">View All <ChevronRight className="ml-1 h-3 w-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySchedule.map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center rounded-lg bg-primary/10 px-3 py-2">
                      <span className="text-xs font-medium text-primary">{session.startTime}</span>
                      <span className="text-[10px] text-muted-foreground">{session.endTime}</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{session.courseCode} – {session.courseName}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.room}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.totalStudents} students</span>
                        <Badge variant="outline" className="text-[10px]">{session.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    {session.status === 'completed' ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Done
                      </Badge>
                    ) : (
                      <Link to="/faculty/attendance">
                        <Button size="sm" className="text-xs">Take Attendance</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
                Pending Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <ClipboardCheck className={`mt-0.5 h-4 w-4 shrink-0 ${task.urgent ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{task.task}</p>
                    <p className="text-xs text-muted-foreground">{task.course}</p>
                  </div>
                  {task.urgent && <Badge variant="destructive" className="text-[10px]">Urgent</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Announcements */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ann.priority === 'high' ? 'bg-destructive' : ann.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ann.title}</p>
                    <p className="text-xs text-muted-foreground">{ann.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance Alerts (AI) */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-purple-600" />
                AI Performance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {atRiskStudents.map((s) => (
                <div key={s.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-foreground">{s.name} ({s.rollNumber})</span>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">High Risk</Badge>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>CGPA: {s.cgpa}</span>
                    <span>Attendance: {s.attendance}%</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={s.attendance} className="h-1.5" />
                  </div>
                </div>
              ))}
              {performanceAlerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-amber-300/30 bg-amber-50/50 p-3 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-foreground">{alert.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
