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
import { useState, useEffect } from 'react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export default function FinanceDashboard() {
  const [financialSnapshot, setFinancialSnapshot] = useState<any>({
    budgetSpent: 0,
    budgetAllocated: 0,
    revenueCollected: 0,
    outstandingDues: 0,
    salaryPercentage: 0,
    lastUpdated: new Date(),
    cashFlow: [],
  });
  const [financeAlerts, setFinanceAlerts] = useState<any>([]);
  const [financeTasks, setFinanceTasks] = useState<any>([]);
  const [budgetAllocations, setBudgetAllocations] = useState<any>([]);
  const { toast } = useToast();
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/finance/snapshot').then(d => setFinancialSnapshot(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/finance/alerts').then(d => setFinanceAlerts(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/finance/tasks').then(d => setFinanceTasks(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/finance/budgets').then(d => setBudgetAllocations(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const toDate = (value: any) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await putApi(`/finance/alerts/${id}/ack`, {});
      setFinanceAlerts((prev: any[]) => prev.map((alert: any) => alert.id === id ? { ...alert, acknowledged: true } : alert));
    } catch (error) {
      console.error('Failed to acknowledge alert', error);
    }
  };

  const handleTaskDecision = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await putApi(`/finance/tasks/${id}`, { status });
      setFinanceTasks((prev: any[]) => prev.map((task: any) => task.id === id ? { ...task, status } : task));
    } catch (error) {
      console.error('Failed to update task', error);
    }
  };

  const generateDashboardReport = async (type: string) => {
    try {
      await postApi('/finance/reports/generate', { type });
      toast({ title: 'Report generated', description: `${type} report generated successfully.` });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error.message || 'Could not generate report.', variant: 'destructive' });
    }
  };

  const snapshot = financialSnapshot;
  const snapshotLastUpdated = toDate(snapshot.lastUpdated);
  const budgetUtilization = snapshot.budgetAllocated > 0
    ? ((snapshot.budgetSpent / snapshot.budgetAllocated) * 100).toFixed(1)
    : '0.0';
  const revenueBase = snapshot.revenueCollected + snapshot.outstandingDues;
  const revenuePercentage = revenueBase > 0
    ? ((snapshot.revenueCollected / revenueBase) * 100).toFixed(1)
    : '0.0';

  const totalSpentAcrossDepartments = budgetAllocations.reduce((sum: number, item: any) => sum + (item.spentAmount || 0), 0);

  const pieData = budgetAllocations.map((item: any) => ({
    name: item.department,
    value: totalSpentAcrossDepartments > 0 ? Number((((item.spentAmount || 0) / totalSpentAcrossDepartments) * 100).toFixed(1)) : 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
            <p className="text-muted-foreground">Financial Year 2025-26 • Updated {snapshotLastUpdated.toLocaleDateString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateDashboardReport('dashboard_export')}><FileText className="mr-2 h-4 w-4" />Export Report</Button>
            <Button size="sm" onClick={() => generateDashboardReport('financial_statement')}><BarChart3 className="mr-2 h-4 w-4" />Generate Statement</Button>
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
                    <span className="text-xs text-destructive">{snapshot.defaulterCount || 0} students defaulting</span>
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
                    {!alert.acknowledged && <Button size="sm" variant="outline" onClick={() => handleAcknowledgeAlert(alert.id)}>Acknowledge</Button>}
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
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleTaskDecision(task.id, 'rejected')}>Reject</Button>
                      <Button size="sm" onClick={() => handleTaskDecision(task.id, 'approved')}>Approve</Button>
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