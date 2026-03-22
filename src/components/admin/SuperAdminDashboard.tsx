import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';

export default function SuperAdminDashboard() {
  const [systemHealth, setSystemHealth] = useState<any>({
    activeUsers: 0,
    totalUsers: 0,
    uptime: '0h',
  });
  const [auditLogs, setAuditLogs] = useState<any>([]);
  const [userActivities, setUserActivities] = useState<any>([]);
  const [systemUsers, setSystemUsers] = useState<any>([]);
  const [loginTrend, setLoginTrend] = useState<any>([]);
  const [moduleUsage, setModuleUsage] = useState<any>([]);
  const [roleDistribution, setRoleDistribution] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const normalizeAuditLog = (raw: any) => ({
    id: safeString(raw?.id),
    details: safeString(raw?.details),
    userName: safeString(raw?.userName, 'System'),
    severity: safeString(raw?.severity, 'info'),
    timestamp: safeDate(raw?.timestamp),
    action: safeString(raw?.action),
    module: safeString(raw?.module)
  });

  useEffect(() => {
    fetchApi('/admin/dashboard').then((d: any) => {
      const stats = safeArray(d?.stats);
      const totalUsers = safeNumber(stats.find((s: any) => safeString(s?.label).toLowerCase() === 'total users')?.value);
      const students = safeNumber(stats.find((s: any) => safeString(s?.label).toLowerCase() === 'students')?.value);
      const faculty = safeNumber(stats.find((s: any) => safeString(s?.label).toLowerCase() === 'faculty')?.value);
      setSystemHealth({
        ...systemHealth,
        totalUsers,
        activeUsers: students + faculty,
        uptime: safeString(d?.systemHealth?.uptime, '0h')
      });
    }).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/audit-logs').then((d: any) => {
      const logs = safeArray(d).map(normalizeAuditLog);
      setAuditLogs(logs);
      setUserActivities(logs);
    }).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/users').then((d: any) => setSystemUsers(safeArray(d))).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/analytics/login-trend').then((d: any) => setLoginTrend(safeArray(d))).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/analytics/module-usage').then((d: any) => setModuleUsage(safeArray(d))).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/analytics/role-distribution').then((d: any) => setRoleDistribution(safeArray(d))).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2"><Users className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                  <p className="text-xl font-bold text-foreground">{systemHealth.activeUsers}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">of {systemHealth.totalUsers?.toLocaleString?.() ?? 0} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">System Uptime</p>
                <p className="text-xl font-bold text-foreground">{systemHealth.uptime}</p>
              </div>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">User Distribution by Role</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {roleDistribution.map(r => (
                <div key={r.role} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.role}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-secondary rounded-full h-2">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${systemHealth.totalUsers > 0 ? (r.count / systemHealth.totalUsers) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-foreground w-16 text-right">{r.count.toLocaleString()}</span>
                  </div>
                </div>
              ))}
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
