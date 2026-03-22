import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Filter, Download, Clock, AlertTriangle, Activity, LogIn, FileText
} from 'lucide-react';
import { fetchApi } from '@/lib/apiService';
import { ROLE_INFO } from '@/types/erp';
import { useState, useEffect } from 'react';
import { safeArray, safeDate, safeString } from '@/lib/normalize';

export default function AdminAuditLogs() {
  const [auditLogs, setAuditLogs] = useState<any>([]);
  const [userActivities, setUserActivities] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const normalizeAuditLog = (raw: any) => ({
    id: safeString(raw?.id),
    timestamp: safeDate(raw?.timestamp),
    userName: safeString(raw?.userName, 'System'),
    role: safeString(raw?.role),
    action: safeString(raw?.action),
    module: safeString(raw?.module),
    details: safeString(raw?.details),
    ipAddress: safeString(raw?.ipAddress, '0.0.0.0'),
    severity: safeString(raw?.severity, 'info'),
    status: 'success'
  });

  useEffect(() => {
    fetchApi('/admin/audit-logs').then((d: any) => {
      const logs = safeArray(d).map(normalizeAuditLog);
      setAuditLogs(logs);
      setUserActivities(logs);
    }).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const exportLogs = () => {
    const rows = filteredLogs.map((log) => ({
      timestamp: log.timestamp.toISOString(),
      userName: log.userName,
      role: log.role,
      action: log.action,
      module: log.module,
      details: log.details,
      ipAddress: log.ipAddress,
      severity: log.severity
    }));

    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = auditLogs.filter(l => {
    if (severityFilter !== 'all' && l.severity !== severityFilter) return false;
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (searchTerm && !l.userName.toLowerCase().includes(searchTerm.toLowerCase()) && !l.details.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive' as const;
      case 'warning': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': case 'logout': return <LogIn className="h-4 w-4" />;
      case 'create': return <FileText className="h-4 w-4 text-green-600" />;
      case 'delete': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Audit & Monitoring</h1>
            <p className="text-muted-foreground">System audit logs and user activity</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportLogs}><Download className="mr-2 h-4 w-4" />Export Logs</Button>
        </div>

        <Tabs defaultValue="audit">
          <TabsList>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="activity">User Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{auditLogs.length}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{auditLogs.filter(l => l.severity === 'critical').length}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-500">{auditLogs.filter(l => l.severity === 'warning').length}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{auditLogs.filter(l => l.severity === 'info').length}</p>
                <p className="text-xs text-muted-foreground">Informational</p>
              </CardContent></Card>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search logs..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Audit Log Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow key={log.id} className={log.severity === 'critical' ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.timestamp.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{log.userName}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_INFO[log.role]?.label}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getActionIcon(log.action)}
                            <span className="text-sm capitalize text-foreground">{log.action}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
                        <TableCell className="max-w-[250px] text-sm text-muted-foreground truncate">{log.details}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{log.ipAddress}</TableCell>
                        <TableCell><Badge variant={getSeverityVariant(log.severity)} className="capitalize">{log.severity}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent User Sessions</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActivities.map(a => (
                      <TableRow key={a.id} className={a.status === 'failed' ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {a.timestamp.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{a.userName}</TableCell>
                        <TableCell className="text-sm text-foreground">{a.action}</TableCell>
                        <TableCell><Badge variant="outline">{a.module}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.details}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{a.ipAddress}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'success' ? 'default' : 'destructive'} className="capitalize">{a.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
