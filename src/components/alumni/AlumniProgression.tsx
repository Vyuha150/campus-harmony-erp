import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Send, Download, FileText, GraduationCap, Briefcase, TrendingUp, Users, MapPin, Globe } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { progressionMetrics } from '@/data/alumniMockData';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AlumniProgression() {
  const pm = progressionMetrics;
  const progressionPie = [
    { name: 'Employed', value: pm.employed },
    { name: 'Higher Education', value: pm.higherEducation },
    { name: 'Entrepreneur', value: pm.entrepreneur },
    { name: 'Unemployed', value: pm.unemployed },
    { name: 'Others', value: pm.totalGraduates - pm.employed - pm.higherEducation - pm.entrepreneur - pm.unemployed },
  ];

  const surveys = [
    { id: 'S1', title: '6-Month Post-Graduation Survey – Batch 2025', batch: 2025, period: '6 months', responses: 320, total: 500, status: 'active' },
    { id: 'S2', title: '1-Year Alumni Survey – Batch 2024', batch: 2024, period: '1 year', responses: 410, total: 480, status: 'closed' },
    { id: 'S3', title: '5-Year Career Progression – Batch 2020', batch: 2020, period: '5 years', responses: 180, total: 450, status: 'active' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Progression Data & Analytics</h1>
            <p className="text-muted-foreground">NAAC/NIRF progression metrics, surveys, and graduate outcome tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />NIRF Report</Button>
            <Button size="sm"><Send className="mr-2 h-4 w-4" />Launch Survey</Button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{pm.totalGraduates}</p><p className="text-xs text-muted-foreground">Graduates (Last Batch)</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{pm.employed}</p><p className="text-xs text-muted-foreground">Employed</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{pm.higherEducation}</p><p className="text-xs text-muted-foreground">Higher Education</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{pm.entrepreneur}</p><p className="text-xs text-muted-foreground">Entrepreneurs</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{pm.responseRate}%</p><p className="text-xs text-muted-foreground">Survey Response Rate</p></CardContent></Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="employers">Top Employers</TabsTrigger>
            <TabsTrigger value="education">Higher Education</TabsTrigger>
            <TabsTrigger value="geography">Geographic</TabsTrigger>
            <TabsTrigger value="surveys">Surveys</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Graduate Outcomes Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart><Pie data={progressionPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {progressionPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Key Ratios (for NIRF/NAAC)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm text-foreground">Placement Rate</span>
                    <span className="text-lg font-bold text-foreground">{((pm.employed / pm.totalGraduates) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm text-foreground">Higher Education Rate</span>
                    <span className="text-lg font-bold text-foreground">{((pm.higherEducation / pm.totalGraduates) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm text-foreground">Entrepreneurship Rate</span>
                    <span className="text-lg font-bold text-foreground">{((pm.entrepreneur / pm.totalGraduates) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm text-foreground">Average Salary</span>
                    <span className="text-lg font-bold text-foreground">₹{((pm.averageSalary || 0) / 100000).toFixed(1)} LPA</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm text-foreground">Survey Response Rate</span>
                    <span className="text-lg font-bold text-foreground">{pm.responseRate}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employers" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Top Recruiters</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pm.topEmployers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="companyName" type="category" width={100} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Company</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">Hired</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">Avg Package</th>
                    </tr></thead>
                    <tbody>
                      {pm.topEmployers.map((e, i) => (
                        <tr key={i} className="border-b last:border-0"><td className="px-4 py-2 text-sm text-foreground">{e.companyName}</td><td className="px-4 py-2 text-center text-sm text-foreground">{e.count}</td><td className="px-4 py-2 text-right text-sm text-foreground">{e.averagePackage ? `₹${(e.averagePackage / 100000).toFixed(1)} LPA` : '–'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Higher Education Destinations</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Institution</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Program</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Count</th>
                    </tr></thead>
                    <tbody>
                      {pm.higherEducationInstitutions.map((inst, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{inst.institutionName}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{inst.program}</td>
                          <td className="px-4 py-3 text-center text-sm text-foreground">{inst.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geography" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Geographic Distribution</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">City</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">State</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Country</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Alumni Count</th>
                    </tr></thead>
                    <tbody>
                      {pm.geographicDistribution.map((loc, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground"><MapPin className="inline h-3 w-3 mr-1" />{loc.city}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{loc.state}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{loc.country}</td>
                          <td className="px-4 py-3 text-center text-sm font-medium text-foreground">{loc.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="surveys" className="mt-4 space-y-4">
            {surveys.map(s => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-foreground">{s.title}</p>
                    <p className="text-sm text-muted-foreground">Period: {s.period} • Responses: {s.responses}/{s.total} ({((s.responses / s.total) * 100).toFixed(0)}%)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="capitalize">{s.status}</Badge>
                    {s.status === 'active' && <Button size="sm"><Send className="mr-1 h-3 w-3" />Send Reminder</Button>}
                    <Button variant="outline" size="sm"><FileText className="mr-1 h-3 w-3" />Report</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
