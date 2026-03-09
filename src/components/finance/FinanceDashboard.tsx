import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IndianRupee, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, FileText, ArrowUpRight, ArrowDownRight, Wallet, PieChart,
  BarChart3, Bell, ClipboardList
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RPieChart, Pie, Cell, Legend } from 'recharts';
import { financialSnapshot, financeAlerts, financeTasks, budgetAllocations } from '@/data/financeMockData';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export default function FinanceDashboard() {
  const snapshot = financialSnapshot;
  const budgetUtilization = ((snapshot.budgetSpent / snapshot.budgetAllocated) * 100).toFixed(1);
  const revenuePercentage = ((snapshot.revenueCollected / (snapshot.revenueCollected + snapshot.outstandingDues)) * 100).toFixed(1);

  const pieData = [
    { name: 'Salary & Wages', value: 62.4 },
    { name: 'Infrastructure', value: 12.5 },
    { name: 'Academic', value: 8.3 },
    { name: 'Administration', value: 6.2 },
    { name: 'Research', value: 5.1 },
    { name: 'Others', value: 5.5 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
            <p className="text-muted-foreground">Financial Year 2025-26 • Updated {snapshot.lastUpdated.toLocaleDateString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" />Export Report</Button>
            <Button size="sm"><BarChart3 className="mr-2 h-4 w-4" />Generate Statement</Button>
          </div>
        </div>

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Budget Allocated</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(snapshot.budgetAllocated)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{budgetUtilization}% utilized</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
              <Progress value={parseFloat(budgetUtilization)} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Collected</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(snapshot.revenueCollected)}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">{revenuePercentage}% collected</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Dues</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(snapshot.outstandingDues)}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive">156 students defaulting</span>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Salary % of Expenses</p>
                  <p className="text-2xl font-bold text-foreground">{snapshot.salaryPercentage}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">Target: ≤65%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <PieChart className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alerts">Alerts ({financeAlerts.filter(a => !a.acknowledged).length})</TabsTrigger>
            <TabsTrigger value="tasks">Pending Tasks ({financeTasks.filter(t => t.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="budgets">Department Budgets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Cash Flow Chart */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Cash Flow – FY 2025-26</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={snapshot.cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="income" fill="hsl(var(--primary))" name="Income" radius={[4,4,0,0]} />
                      <Bar dataKey="expenses" fill="hsl(var(--muted))" name="Expenses" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Expense Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RPieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-3">
            {financeAlerts.map((alert) => (
              <Card key={alert.id} className={alert.severity === 'critical' ? 'border-destructive' : ''}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      alert.severity === 'critical' ? 'bg-destructive/10' : alert.severity === 'high' ? 'bg-amber-100' : 'bg-muted'
                    }`}>
                      <AlertTriangle className={`h-5 w-5 ${
                        alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'high' ? 'text-amber-600' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      {alert.amount && <p className="text-sm font-semibold text-foreground">{formatCurrency(alert.amount)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'high' ? 'default' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                    {!alert.acknowledged && <Button size="sm" variant="outline">Acknowledge</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-3">
            {financeTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>By: {task.requestedBy}</span>
                          <span>Amount: {formatCurrency(task.amount)}</span>
                          <span>Dept: {task.department}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-destructive">Reject</Button>
                      <Button size="sm">Approve</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="budgets">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Department</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Allocated</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Spent</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Available</th>
                        <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Utilization</th>
                        <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetAllocations.map((ba) => (
                        <tr key={ba.id} className="border-b last:border-0">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{ba.department}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(ba.allocatedAmount)}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(ba.spentAmount)}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(ba.availableAmount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={ba.utilizationPercentage} className="h-2 w-24" />
                              <span className="text-xs text-muted-foreground">{ba.utilizationPercentage}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={ba.utilizationPercentage > 80 ? 'destructive' : ba.utilizationPercentage < 30 ? 'secondary' : 'default'}>
                              {ba.utilizationPercentage > 80 ? 'High' : ba.utilizationPercentage < 30 ? 'Low' : 'Normal'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}