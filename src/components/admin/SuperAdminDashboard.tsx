import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity, Users, Server, Database, Shield, Clock, AlertTriangle, CheckCircle2,
  HardDrive, Cpu, MemoryStick, Globe, ArrowUpRight, Bell, Zap, TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { systemHealth, auditLogs, userActivities, systemUsers } from '@/data/adminMockData';

const loginTrend = [
  { time: '6AM', users: 45 }, { time: '8AM', users: 180 }, { time: '10AM', users: 342 },
  { time: '12PM', users: 290 }, { time: '2PM', users: 310 }, { time: '4PM', users: 265 },
  { time: '6PM', users: 190 }, { time: '8PM', users: 120 }, { time: '10PM', users: 80 },
];

const moduleUsage = [
  { name: 'Student', usage: 4250 }, { name: 'Faculty', usage: 1890 },
  { name: 'Finance', usage: 1200 }, { name: 'Exam', usage: 980 },
  { name: 'Library', usage: 750 }, { name: 'Placement', usage: 520 },
  { name: 'Research', usage: 380 }, { name: 'Sports', usage: 180 },
];

const roleDistribution = [
  { role: 'Students', count: 12458 }, { role: 'Faculty', count: 847 },
  { role: 'Staff', count: 1240 }, { role: 'Admin', count: 45 },
  { role: 'Officers', count: 32 }, { role: 'Others', count: 225 },
];

export default function SuperAdminDashboard() {
  const recentLogs = auditLogs.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Administration</h1>
            <p className="text-muted-foreground">Enterprise ERP – System Health & Administration Overview</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Activity className="mr-1 h-3 w-3" /> System Online
            </Badge>
            <Badge variant="outline">Uptime: {systemHealth.uptime}</Badge>
          </div>
        </div>

        {/* System Health Metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Cpu className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">CPU Usage</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.cpuUsage}%</p>
                </div>
              </div>
              <Progress value={systemHealth.cpuUsage} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2"><MemoryStick className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Memory</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.memoryUsage}%</p>
                </div>
              </div>
              <Progress value={systemHealth.memoryUsage} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2"><HardDrive className="h-5 w-5 text-amber-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Disk</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.diskUsage}%</p>
                </div>
              </div>
              <Progress value={systemHealth.diskUsage} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2"><Users className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.activeUsers}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">of {systemHealth.totalUsers.toLocaleString()} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2"><Zap className="h-5 w-5 text-purple-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">API Latency</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.apiResponseTime}ms</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Error rate: {systemHealth.errorRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Active Users – Today</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={loginTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Module Usage (Sessions Today)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={moduleUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip />
                  <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">User Distribution by Role</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {roleDistribution.map(r => (
                <div key={r.role} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.role}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-secondary rounded-full h-2">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.count / 12458) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-foreground w-16 text-right">{r.count.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">System Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Database Size</span><span className="font-medium text-foreground">{systemHealth.databaseSize}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last Backup</span><span className="font-medium text-foreground">{systemHealth.lastBackup.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Users</span><span className="font-medium text-foreground">{systemHealth.totalUsers.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Error Rate</span><span className="font-medium text-foreground">{systemHealth.errorRate}%</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">API Avg Latency</span><span className="font-medium text-foreground">{systemHealth.apiResponseTime}ms</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Uptime</span><span className="font-medium text-foreground">{systemHealth.uptime}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${log.severity === 'critical' ? 'bg-destructive' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="text-xs text-foreground">{log.details}</p>
                    <p className="text-xs text-muted-foreground">{log.userName} • {log.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
