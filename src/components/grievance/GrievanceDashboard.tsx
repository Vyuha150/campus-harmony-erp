import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Search, AlertTriangle, CheckCircle2, Clock, Users, Download, BarChart3, Shield, FileText, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { grievanceCases, grievanceTrends, categoryStats, complianceItems } from '@/data/iqacMockData';

export default function GrievanceDashboard() {
  const open = grievanceCases.filter(g => !['resolved','closed'].includes(g.status)).length;
  const resolved = grievanceCases.filter(g => ['resolved','closed'].includes(g.status)).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Grievance & Compliance Portal</h1>
            <p className="text-muted-foreground">Case management, resolution tracking, and compliance oversight</p>
          </div>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Annual Report</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><MessageSquare className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Total Grievances</p><p className="text-2xl font-bold">{grievanceCases.length + 74}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-amber-500" /><div><p className="text-xs text-muted-foreground">Open Cases</p><p className="text-2xl font-bold text-amber-600">{open + 7}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-green-600">{resolved + 65}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Avg Resolution</p><p className="text-2xl font-bold">12 days</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Shield className="h-8 w-8 text-purple-600" /><div><p className="text-xs text-muted-foreground">Compliance</p><p className="text-2xl font-bold text-green-600">92%</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="cases">
          <TabsList>
            <TabsTrigger value="cases">Case Management</TabsTrigger>
            <TabsTrigger value="trends">Trends & Analytics</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search grievances..." className="pl-10" /></div>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem><SelectItem value="academic">Academic</SelectItem><SelectItem value="facility">Facility</SelectItem><SelectItem value="harassment">Harassment</SelectItem></SelectContent></Select>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent></Select>
            </div>

            {grievanceCases.map((g) => (
              <Card key={g.id} className={g.severity === 'urgent' ? 'border-destructive' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        g.severity === 'urgent' ? 'bg-destructive/10' : g.severity === 'high' ? 'bg-amber-100' : 'bg-muted'
                      }`}>
                        <Scale className={`h-5 w-5 ${g.severity === 'urgent' ? 'text-destructive' : g.severity === 'high' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{g.grievanceNumber}</p>
                          {g.isAnonymous && <Badge variant="outline">Anonymous</Badge>}
                        </div>
                        <p className="text-sm font-medium text-foreground">{g.subject}</p>
                        <p className="text-sm text-muted-foreground">{g.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Category: <span className="capitalize">{g.category}</span></span>
                          <span>Filed: {g.submissionDate.toLocaleDateString('en-IN')}</span>
                          {g.assignedTo && <span>Assigned: {g.assignedTo}</span>}
                          {g.resolutionDays && <span>Resolved in {g.resolutionDays} days</span>}
                        </div>
                        {g.timeline.length > 0 && (
                          <div className="mt-2 border-l-2 border-muted pl-3">
                            {g.timeline.slice(-2).map((t) => (
                              <p key={t.id} className="text-xs text-muted-foreground"><span className="font-medium">{t.date.toLocaleDateString('en-IN')}:</span> {t.activity}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={g.severity === 'urgent' ? 'destructive' : g.severity === 'high' ? 'default' : 'secondary'} className="capitalize">{g.severity}</Badge>
                      <Badge variant={['resolved','closed'].includes(g.status) ? 'default' : 'outline'} className="capitalize">{g.status.replace('_',' ')}</Badge>
                      <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle>Monthly Grievance Trends</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={grievanceTrends}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="received" stroke="hsl(var(--primary))" name="Received" /><Line type="monotone" dataKey="resolved" stroke="#10b981" name="Resolved" /><Line type="monotone" dataKey="pending" stroke="#f59e0b" name="Pending" /></LineChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" name="Cases" radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            {complianceItems.map((ci) => (
              <Card key={ci.id}><CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{ci.title}</h3>
                    <p className="text-sm text-muted-foreground">{ci.description}</p>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>Applicable to: <span className="capitalize">{ci.applicableTo}</span></span>
                      {ci.renewalPeriod && <span>Renewal: {ci.renewalPeriod}</span>}
                      {ci.dueDate && <span>Due: {ci.dueDate.toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                  <Badge variant={ci.status === 'active' ? 'default' : 'secondary'} className="capitalize">{ci.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}