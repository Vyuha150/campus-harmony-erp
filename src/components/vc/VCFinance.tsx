import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  IndianRupee, TrendingUp, TrendingDown, Download, PieChart,
  ArrowUpRight, ArrowDownRight, BarChart3, Wallet, Receipt, FileText
} from 'lucide-react';
import { financialOverview } from '@/data/vcMockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export default function VCFinance() {
  const { toast } = useToast();

  const totalBudget = financialOverview.reduce((sum, f) => sum + f.budget, 0);
  const totalActual = financialOverview.reduce((sum, f) => sum + f.actual, 0);
  const utilizationPct = Math.round((totalActual / totalBudget) * 100);

  const chartData = financialOverview.map(f => ({
    name: f.category.length > 12 ? f.category.slice(0, 12) + '…' : f.category,
    Budget: f.budget,
    Actual: f.actual,
  }));

  const revenueStreams = [
    { source: 'Tuition Fees', amount: 9500, percentage: 60, trend: '+5%' },
    { source: 'Government Grants', amount: 2500, percentage: 16, trend: '0%' },
    { source: 'Research Grants', amount: 1000, percentage: 6, trend: '+22%' },
    { source: 'Self-Financed Courses', amount: 1800, percentage: 11, trend: '+12%' },
    { source: 'Consultancy & Services', amount: 500, percentage: 3, trend: '+8%' },
    { source: 'Other Income', amount: 600, percentage: 4, trend: '+3%' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Overview</h1>
            <p className="text-muted-foreground">Institution-wide budget, revenue, and expenditure tracking</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Exported', description: 'Financial summary report downloaded.' })}>
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
                  {[
                    { dept: 'Computer Science', allocated: 450, spent: 380, util: 84 },
                    { dept: 'Electronics', allocated: 380, spent: 340, util: 89 },
                    { dept: 'Mechanical', allocated: 420, spent: 390, util: 93 },
                    { dept: 'Civil Engineering', allocated: 350, spent: 395, util: 113 },
                    { dept: 'Business Admin', allocated: 280, spent: 245, util: 88 },
                    { dept: 'Physics', allocated: 200, spent: 175, util: 88 },
                    { dept: 'Chemistry', allocated: 220, spent: 195, util: 89 },
                  ].map(d => (
                    <div key={d.dept} className="flex items-center gap-4 rounded-lg border p-3">
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
