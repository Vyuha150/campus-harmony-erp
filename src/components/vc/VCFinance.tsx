import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp, Download, PieChart, Wallet, Receipt, Eye
} from 'lucide-react';
import { financialOverview } from '@/data/vcMockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DeptBudget { dept: string; allocated: number; spent: number; util: number; categories: { name: string; amount: number }[]; }

const deptBudgets: DeptBudget[] = [
  { dept: 'Computer Science', allocated: 450, spent: 380, util: 84, categories: [{ name: 'Faculty Salaries', amount: 220 }, { name: 'Lab Equipment', amount: 85 }, { name: 'Research', amount: 45 }, { name: 'Events', amount: 30 }] },
  { dept: 'Electronics', allocated: 380, spent: 340, util: 89, categories: [{ name: 'Faculty Salaries', amount: 190 }, { name: 'Lab Equipment', amount: 90 }, { name: 'Research', amount: 35 }, { name: 'Events', amount: 25 }] },
  { dept: 'Mechanical', allocated: 420, spent: 390, util: 93, categories: [{ name: 'Faculty Salaries', amount: 200 }, { name: 'Workshop/Lab', amount: 120 }, { name: 'Research', amount: 40 }, { name: 'Maintenance', amount: 30 }] },
  { dept: 'Civil Engineering', allocated: 350, spent: 395, util: 113, categories: [{ name: 'Faculty Salaries', amount: 180 }, { name: 'Lab Equipment', amount: 100 }, { name: 'Field Trips', amount: 65 }, { name: 'Research', amount: 50 }] },
  { dept: 'Business Admin', allocated: 280, spent: 245, util: 88, categories: [{ name: 'Faculty Salaries', amount: 150 }, { name: 'Case Licenses', amount: 45 }, { name: 'Industry Events', amount: 30 }, { name: 'Research', amount: 20 }] },
  { dept: 'Physics', allocated: 200, spent: 175, util: 88, categories: [{ name: 'Faculty Salaries', amount: 100 }, { name: 'Lab Equipment', amount: 50 }, { name: 'Research', amount: 25 }] },
  { dept: 'Chemistry', allocated: 220, spent: 195, util: 89, categories: [{ name: 'Faculty Salaries', amount: 95 }, { name: 'Lab Consumables', amount: 60 }, { name: 'Research', amount: 40 }] },
];

const revenueStreams = [
  { source: 'Tuition Fees', amount: 9500, percentage: 60, trend: '+5%' },
  { source: 'Government Grants', amount: 2500, percentage: 16, trend: '0%' },
  { source: 'Research Grants', amount: 1000, percentage: 6, trend: '+22%' },
  { source: 'Self-Financed Courses', amount: 1800, percentage: 11, trend: '+12%' },
  { source: 'Consultancy & Services', amount: 500, percentage: 3, trend: '+8%' },
  { source: 'Other Income', amount: 600, percentage: 4, trend: '+3%' },
];

export default function VCFinance() {
  const { toast } = useToast();
  const [selectedDept, setSelectedDept] = useState<DeptBudget | null>(null);

  const totalBudget = financialOverview.reduce((sum, f) => sum + f.budget, 0);
  const totalActual = financialOverview.reduce((sum, f) => sum + f.actual, 0);
  const utilizationPct = Math.round((totalActual / totalBudget) * 100);

  const chartData = financialOverview.map(f => ({
    name: f.category.length > 12 ? f.category.slice(0, 12) + '…' : f.category,
    Budget: f.budget,
    Actual: f.actual,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Overview</h1>
            <p className="text-muted-foreground">Institution-wide budget, revenue, and expenditure tracking</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Exported', description: 'Financial summary report downloaded as PDF.' })}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Budget', value: `₹${(totalBudget / 100).toFixed(0)} Cr`, icon: Wallet, color: 'text-primary' },
            { label: 'Actual Spend', value: `₹${(totalActual / 100).toFixed(0)} Cr`, icon: Receipt, color: 'text-amber-600' },
            { label: 'Utilization', value: `${utilizationPct}%`, icon: PieChart, color: 'text-emerald-600' },
            { label: 'Revenue YTD', value: '₹142 Cr', icon: TrendingUp, color: 'text-blue-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="budget">
          <TabsList>
            <TabsTrigger value="budget">Budget vs Actuals</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Streams</TabsTrigger>
            <TabsTrigger value="departments">Department Budgets</TabsTrigger>
          </TabsList>

          <TabsContent value="budget" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Budget vs Actual Expenditure (₹ Lakhs)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.6} />
                    <Bar dataKey="Actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="grid gap-3 mt-4">
              {financialOverview.map(item => (
                <div key={item.category} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={(item.actual / item.budget) * 100} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{Math.round((item.actual / item.budget) * 100)}%</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">₹{item.actual} L</p>
                    <p className="text-xs text-muted-foreground">of ₹{item.budget} L</p>
                  </div>
                  <Badge variant={item.variance <= 0 ? 'default' : 'destructive'} className="text-[10px]">
                    {item.variance <= 0 ? 'Under' : 'Over'} ₹{Math.abs(item.variance)} L
                  </Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Revenue Streams (₹ Lakhs)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueStreams.map(r => (
                    <div key={r.source} className="flex items-center gap-4 rounded-lg border p-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">{r.source}</p>
                          <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" /> {r.trend}
                          </span>
                        </div>
                        <Progress value={r.percentage} className="h-2" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">₹{r.amount} L</p>
                        <p className="text-[10px] text-muted-foreground">{r.percentage}% of total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Department-wise Budget Allocation & Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptBudgets.map(d => (
                    <div key={d.dept} className="flex items-center gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedDept(d)}>
                      <div className="w-36 text-sm font-medium">{d.dept}</div>
                      <div className="flex-1">
                        <Progress value={Math.min(d.util, 100)} className="h-2" />
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-medium">₹{d.spent}L / ₹{d.allocated}L</p>
                      </div>
                      <Badge variant={d.util > 100 ? 'destructive' : d.util > 90 ? 'default' : 'secondary'} className="text-[10px] w-14 justify-center">
                        {d.util}%
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setSelectedDept(d); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Department Drill-down Dialog */}
        <Dialog open={!!selectedDept} onOpenChange={() => setSelectedDept(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedDept?.dept} — Budget Breakdown</DialogTitle>
              <DialogDescription>
                Allocated: ₹{selectedDept?.allocated}L • Spent: ₹{selectedDept?.spent}L • Utilization: {selectedDept?.util}%
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Progress value={Math.min(selectedDept?.util || 0, 100)} className="h-3 flex-1" />
                <Badge variant={(selectedDept?.util || 0) > 100 ? 'destructive' : 'default'} className="text-xs">
                  {(selectedDept?.util || 0) > 100 ? 'Over Budget' : 'Within Budget'}
                </Badge>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Spending Categories</h4>
                {selectedDept?.categories.map(cat => (
                  <div key={cat.name} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">{cat.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <Progress value={(cat.amount / (selectedDept?.spent || 1)) * 100} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">₹{cat.amount}L</span>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">{Math.round((cat.amount / (selectedDept?.spent || 1)) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              {(selectedDept?.util || 0) > 100 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive font-medium">⚠ Budget Overrun Alert</p>
                  <p className="text-xs text-muted-foreground mt-1">This department has exceeded its allocated budget by ₹{(selectedDept?.spent || 0) - (selectedDept?.allocated || 0)}L. Review recommended.</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => toast({ title: 'Exported', description: `${selectedDept?.dept} budget report exported.` })}>
                <Download className="h-3 w-3" /> Export Department Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
