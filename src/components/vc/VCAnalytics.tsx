import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Users, GraduationCap, Briefcase,
  BarChart3, Eye, FlaskConical, Download, TrendingUp, TrendingDown
} from 'lucide-react';
import { departmentPerformance } from '@/data/vcMockData';
import { DepartmentPerformance } from '@/types/vc';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function VCAnalytics() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<DepartmentPerformance | null>(null);
  const [sortBy, setSortBy] = useState<string>('passRate');

  const filtered = departmentPerformance
    .filter(d => d.department.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (b as any)[sortBy] - (a as any)[sortBy]);

  const comparisonData = departmentPerformance.map(d => ({
    name: d.department.length > 8 ? d.department.slice(0, 8) + '…' : d.department,
    'Pass Rate': d.passRate,
    'Placement': d.placementRate,
    'Satisfaction': d.studentSatisfaction * 20,
  }));

  const avgPassRate = (departmentPerformance.reduce((s, d) => s + d.passRate, 0) / departmentPerformance.length).toFixed(1);
  const avgPlacement = (departmentPerformance.reduce((s, d) => s + d.placementRate, 0) / departmentPerformance.length).toFixed(1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
            <p className="text-muted-foreground">Institution-wide performance analytics and department comparisons</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Report Generated', description: 'Comprehensive analytics report exported as PDF.' })}>
            <Download className="h-4 w-4" /> Export Full Report
          </Button>
        </div>

        {/* Search & Sort */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search departments..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'passRate', label: 'Pass Rate' },
              { key: 'placementRate', label: 'Placement' },
              { key: 'researchOutput', label: 'Research' },
            ].map(s => (
              <Button key={s.key} size="sm" variant={sortBy === s.key ? 'default' : 'outline'} className="text-xs" onClick={() => setSortBy(s.key)}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          {[
            { label: 'Total Students', value: departmentPerformance.reduce((s, d) => s + d.studentCount, 0).toLocaleString(), icon: Users },
            { label: 'Total Faculty', value: departmentPerformance.reduce((s, d) => s + d.facultyCount, 0), icon: GraduationCap },
            { label: 'Avg Pass Rate', value: `${avgPassRate}%`, icon: BarChart3 },
            { label: 'Avg Placement', value: `${avgPlacement}%`, icon: Briefcase },
            { label: 'Research Papers', value: departmentPerformance.reduce((s, d) => s + d.researchOutput, 0), icon: FlaskConical },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Department Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Department Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Pass Rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Placement" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Cards — Drill Down */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Department Details (sorted by {sortBy.replace(/([A-Z])/g, ' $1')})</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {filtered.map((dept, idx) => (
              <Card key={dept.department} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedDept(dept)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-sm">{dept.department}</p>
                    <Badge variant={idx === 0 ? 'default' : 'outline'} className="text-[10px]">#{idx + 1}</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Students</span>
                      <span className="font-medium">{dept.studentCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Faculty</span>
                      <span className="font-medium">{dept.facultyCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pass Rate</span>
                      <span className="font-medium">{dept.passRate}%</span>
                    </div>
                    <Progress value={dept.passRate} className="h-1.5" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Placement</span>
                      <span className="font-medium">{dept.placementRate}%</span>
                    </div>
                    <Progress value={dept.placementRate} className="h-1.5" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Satisfaction</span>
                      <span className="font-medium">{dept.studentSatisfaction}/5</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-xs gap-1">
                    <Eye className="h-3 w-3" /> Drill Down
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Drill Down Dialog */}
        <Dialog open={!!selectedDept} onOpenChange={() => setSelectedDept(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedDept?.department} — Detailed View</DialogTitle>
              <DialogDescription>Complete performance metrics for this department</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Students', value: selectedDept?.studentCount, icon: Users },
                  { label: 'Total Faculty', value: selectedDept?.facultyCount, icon: GraduationCap },
                  { label: 'F:S Ratio', value: `1:${Math.round((selectedDept?.studentCount || 1) / (selectedDept?.facultyCount || 1))}`, icon: BarChart3 },
                  { label: 'Research Papers', value: selectedDept?.researchOutput, icon: FlaskConical },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border p-3 text-center">
                    <item.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Pass Rate', value: selectedDept?.passRate, avg: Number(avgPassRate), icon: selectedDept && selectedDept.passRate >= Number(avgPassRate) ? TrendingUp : TrendingDown },
                  { label: 'Placement Rate', value: selectedDept?.placementRate, avg: Number(avgPlacement), icon: selectedDept && selectedDept.placementRate >= Number(avgPlacement) ? TrendingUp : TrendingDown },
                  { label: 'Student Satisfaction', value: (selectedDept?.studentSatisfaction || 0) * 20, avg: 78, icon: TrendingUp },
                ].map(metric => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-1">{metric.label} {metric.icon && <metric.icon className={`h-3 w-3 ${(metric.value || 0) >= metric.avg ? 'text-emerald-600' : 'text-red-600'}`} />}</span>
                      <span className="font-medium">{metric.value}% <span className="text-[10px] text-muted-foreground">(avg: {metric.avg}%)</span></span>
                    </div>
                    <Progress value={metric.value} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => toast({ title: 'Exported', description: `${selectedDept?.department} analytics report exported.` })}>
                <Download className="h-3 w-3" /> Export Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
