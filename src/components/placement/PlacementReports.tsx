import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, Download, FileText, PieChart, TrendingUp, Users, Printer,
  Building2, GraduationCap, IndianRupee, Target, Award
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell } from 'recharts';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const formatPackage = (amount: number) => `₹${(amount / 100000).toFixed(1)} LPA`;

export default function PlacementReports() {
  const { toast } = useToast();
  const [placementMetrics, setPlacementMetrics] = useState<any>({
    placementPercentage: 0,
    placedStudents: 0,
    eligibleStudents: 0,
    companiesVisited: 0,
    minimumPackage: 0,
    highestPackage: 0,
    averagePackage: 0,
    medianPackage: 0,
  });
  const [deptData, setDeptData] = useState<any>([]);
  const [outcomeData, setOutcomeData] = useState<any>([]);
  const [salaryBands, setSalaryBands] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadReports = async () => {
    const [metrics, dept, outcomes, salaries] = await Promise.all([
      fetchApi('/placements/reports'),
      fetchApi('/placements/reports/department-wise'),
      fetchApi('/placements/reports/outcomes'),
      fetchApi('/placements/reports/salary-bands')
    ]);

    const m = metrics || {};
    setPlacementMetrics({
      placementPercentage: Number(m.placementPercentage || 0),
      placedStudents: Number(m.totalPlaced || 0),
      eligibleStudents: Number(m.totalStudents || 0),
      companiesVisited: Number(m.totalCompanies || 0),
      minimumPackage: Number(m.minimumPackage ?? m.minPackage ?? 0),
      highestPackage: Number(m.highestPackage || 0),
      averagePackage: Number(m.averagePackage || 0),
      medianPackage: Number(m.medianPackage || 0),
    });
    setDeptData(Array.isArray(dept) ? dept : []);
    setOutcomeData(Array.isArray(outcomes) ? outcomes : []);
    setSalaryBands(Array.isArray(salaries) ? salaries : []);
  };

  useEffect(() => {
    loadReports().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load reports', description: error?.message || 'Please retry', variant: 'destructive' });
    });
    _setApiLoading(false);
  }, []);

  const handleGenerateReport = async (type: string, title: string) => {
    try {
      await postApi('/placements/reports/generate', { type });
      toast({ title: `${title} generated`, description: 'Report generated successfully.' });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate report.', variant: 'destructive' });
    }
  };

  const m = placementMetrics;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Placement Reports</h1>
            <p className="text-muted-foreground">Generate reports for VC/Principal, NIRF submission, and stakeholder presentations</p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="2025-26">
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-26">2025-26</SelectItem>
                <SelectItem value="2024-25">2024-25</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button size="sm" onClick={() => handleGenerateReport('overall', 'Overall report')}><Download className="mr-2 h-4 w-4" />Export PDF</Button>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card><CardContent className="p-4 text-center"><Target className="mx-auto h-6 w-6 text-primary" /><p className="mt-1 text-2xl font-bold text-foreground">{m.placementPercentage}%</p><p className="text-xs text-muted-foreground">Placement Rate</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Users className="mx-auto h-6 w-6 text-green-600" /><p className="mt-1 text-2xl font-bold text-foreground">{m.placedStudents}</p><p className="text-xs text-muted-foreground">Students Placed</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Building2 className="mx-auto h-6 w-6 text-blue-600" /><p className="mt-1 text-2xl font-bold text-foreground">{m.companiesVisited}</p><p className="text-xs text-muted-foreground">Companies</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><TrendingUp className="mx-auto h-6 w-6 text-amber-600" /><p className="mt-1 text-2xl font-bold text-foreground">{formatPackage(m.highestPackage)}</p><p className="text-xs text-muted-foreground">Highest CTC</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><BarChart3 className="mx-auto h-6 w-6 text-purple-600" /><p className="mt-1 text-2xl font-bold text-foreground">{formatPackage(m.averagePackage)}</p><p className="text-xs text-muted-foreground">Average CTC</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Award className="mx-auto h-6 w-6 text-primary" /><p className="mt-1 text-2xl font-bold text-foreground">{formatPackage(m.medianPackage)}</p><p className="text-xs text-muted-foreground">Median CTC</p><p className="mt-1 text-xs text-muted-foreground">Min: {formatPackage(m.minimumPackage)}</p></CardContent></Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Department-wise Placements</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" fill="hsl(var(--primary))" name="Placed" radius={[4,4,0,0]} />
                  <Bar dataKey="total" fill="hsl(var(--muted))" name="Total Eligible" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Student Outcomes</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RPieChart>
                  <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {outcomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </RPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Salary Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salaryBands}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Students" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Report Types */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Downloadable Reports</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: 'NIRF Placement Data', desc: 'Median salary, placement %, higher studies data for NIRF submission', icon: GraduationCap },
              { title: 'Company-wise Summary', desc: 'Offers, CTC, and selections by each recruiting company', icon: Building2 },
              { title: 'Placement Brochure', desc: 'Auto-generated PDF brochure with charts and stats for companies', icon: FileText },
              { title: 'Unplaced Students List', desc: 'Students still seeking placement with their profiles and skills', icon: Users },
              { title: 'Year-on-Year Comparison', desc: 'Placement trends over 3-5 years with growth analysis', icon: TrendingUp },
              { title: 'Internship Report', desc: 'Internship completion rates, company coverage, stipend analysis', icon: Award },
            ].map((r) => (
              <Card key={r.title} className="cursor-pointer hover:bg-muted/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <r.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{r.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleGenerateReport('overall', r.title)}><Printer className="mr-1 h-3 w-3" />Preview</Button>
                        <Button size="sm" onClick={() => handleGenerateReport('overall', r.title)}><Download className="mr-1 h-3 w-3" />Export</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
