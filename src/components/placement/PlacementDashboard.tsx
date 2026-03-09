import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Briefcase, TrendingUp, Users, Building2, Search, Calendar, ArrowUpRight, Target, GraduationCap, BarChart3, MessageSquare, Award, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { placementMetrics, placementDrives, recentOffers, companies, trainingSessions } from '@/data/placementMockData';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const formatPackage = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} LPA`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export default function PlacementDashboard() {
  const m = placementMetrics;
  const deptData = [
    { dept: 'CSE', placed: 92, total: 180 },
    { dept: 'ECE', placed: 78, total: 150 },
    { dept: 'ME', placed: 65, total: 120 },
    { dept: 'EE', placed: 55, total: 100 },
    { dept: 'IT', placed: 88, total: 140 },
    { dept: 'MBA', placed: 120, total: 160 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Placement Dashboard</h1>
            <p className="text-muted-foreground">Academic Year 2025-26 • Batch 2026</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />NIRF Report</Button>
            <Button size="sm"><MessageSquare className="mr-2 h-4 w-4" />Bulk Notify</Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Placement %</p><p className="text-2xl font-bold text-foreground">{m.placementPercentage}%</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Students Placed</p><p className="text-2xl font-bold text-foreground">{m.placedStudents}/{m.eligibleStudents}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Companies Visited</p><p className="text-2xl font-bold text-foreground">{m.companiesVisited}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><ArrowUpRight className="h-8 w-8 text-amber-600" /><div><p className="text-xs text-muted-foreground">Highest Package</p><p className="text-2xl font-bold text-foreground">{formatPackage(m.highestPackage)}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-purple-600" /><div><p className="text-xs text-muted-foreground">Average Package</p><p className="text-2xl font-bold text-foreground">{formatPackage(m.averagePackage)}</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="drives">
          <TabsList>
            <TabsTrigger value="drives">Upcoming Drives</TabsTrigger>
            <TabsTrigger value="offers">Recent Offers ({recentOffers.length})</TabsTrigger>
            <TabsTrigger value="companies">Companies ({companies.length})</TabsTrigger>
            <TabsTrigger value="training">Training Sessions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="drives" className="space-y-4">
            {placementDrives.map((drive) => (
              <Card key={drive.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{drive.company.name}</h3>
                        <p className="text-sm text-muted-foreground">{drive.jobRole} • {drive.jobType.replace('_', ' ')}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">CTC: {formatPackage(drive.package.ctc)}</Badge>
                          <Badge variant="outline">Min CGPA: {drive.eligibilityCriteria.minCGPA}</Badge>
                          <Badge variant="outline">{drive.registeredStudents} registered</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{drive.driveDate.toLocaleDateString('en-IN')}</span>
                          <span>Venue: {drive.venue}</span>
                          <span>Rounds: {drive.rounds.length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={drive.status === 'upcoming' ? 'default' : 'secondary'} className="capitalize">{drive.status}</Badge>
                      <Button size="sm">Manage Drive</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="offers">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Student</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Package</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {recentOffers.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{o.studentName}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{o.companyName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{o.jobRole}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatPackage(o.package)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{o.offerDate.toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge variant={o.status === 'accepted' ? 'default' : 'secondary'} className="capitalize">{o.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="companies">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Industry</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contact</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total Hires</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Visit</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">{c.companySize} employees</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.industry}</td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{c.contactPerson}</p><p className="text-xs text-muted-foreground">{c.email}</p></td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{c.totalHires}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.lastVisit?.toLocaleDateString('en-IN') || '-'}</td>
                  <td className="px-4 py-3"><Badge variant="default" className="capitalize">{c.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            {trainingSessions.map((ts) => (
              <Card key={ts.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><GraduationCap className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="font-medium text-foreground">{ts.title}</p>
                    <p className="text-sm text-muted-foreground">{ts.instructor} • {ts.venue}</p>
                    <p className="text-xs text-muted-foreground">{ts.date.toLocaleDateString('en-IN')} • {ts.duration} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><p className="text-sm font-semibold">{ts.registeredCount}/{ts.maxCapacity}</p><p className="text-xs text-muted-foreground">registered</p></div>
                  <Badge variant="default" className="capitalize">{ts.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="analytics">
            <Card><CardHeader><CardTitle>Department-wise Placements</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dept" /><YAxis /><Tooltip /><Bar dataKey="placed" fill="hsl(var(--primary))" name="Placed" radius={[4,4,0,0]} /><Bar dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[4,4,0,0]} /></BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}