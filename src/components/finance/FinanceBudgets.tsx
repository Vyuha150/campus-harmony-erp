import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, Plus, Download,
  Calculator, PieChart, ArrowUpRight, ArrowDownRight, Settings, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export default function FinanceBudgets() {
  const [budgetAllocations, setBudgetAllocations] = useState<any>([]);
  const [expenditureTrend, setExpenditureTrend] = useState<any[]>([]);
  const [revenueStreams, setRevenueStreams] = useState<any[]>([]);
  const [yearFilter, setYearFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [_apiLoading, _setApiLoading] = useState(true);
  const { toast } = useToast();

  const loadBudgetData = async () => {
    const [budgets, trend, streams] = await Promise.all([
      fetchApi('/finance/budgets'),
      fetchApi('/finance/expenditure-trend'),
      fetchApi('/finance/revenue-streams'),
    ]);
    setBudgetAllocations(budgets);
    setExpenditureTrend(trend);
    setRevenueStreams(streams);
  };

  useEffect(() => {
    loadBudgetData().catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const totalAllocated = budgetAllocations.reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
  const totalSpent = budgetAllocations.reduce((s, b) => s + Number(b.spentAmount || 0), 0);
  const totalAvailable = budgetAllocations.reduce((s, b) => s + Number(b.availableAmount || 0), 0);
  const overallUtilization = totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : '0.0';
  const baseRevenueCr = Number((totalAllocated / 10000000).toFixed(2));
  const baseExpensesCr = Number((totalSpent / 10000000).toFixed(2));
  const scenarioData = [
    { scenario: 'Base Case', revenue: baseRevenueCr, expenses: baseExpensesCr, surplus: Number((baseRevenueCr - baseExpensesCr).toFixed(2)) },
    { scenario: '+10% Intake', revenue: Number((baseRevenueCr * 1.1).toFixed(2)), expenses: Number((baseExpensesCr * 1.055).toFixed(2)), surplus: Number(((baseRevenueCr * 1.1) - (baseExpensesCr * 1.055)).toFixed(2)) },
    { scenario: '-5% Fees', revenue: Number((baseRevenueCr * 0.95).toFixed(2)), expenses: baseExpensesCr, surplus: Number(((baseRevenueCr * 0.95) - baseExpensesCr).toFixed(2)) },
    { scenario: 'Cost Cut 8%', revenue: baseRevenueCr, expenses: Number((baseExpensesCr * 0.92).toFixed(2)), surplus: Number((baseRevenueCr - (baseExpensesCr * 0.92)).toFixed(2)) },
  ];
  const varianceData = budgetAllocations.map((ba: any) => ({
    name: ba.department.length > 12 ? ba.department.slice(0, 12) + '…' : ba.department,
    allocated: ba.allocatedAmount / 100000,
    spent: ba.spentAmount / 100000,
    variance: ba.allocatedAmount > 0 ? ((ba.spentAmount / ba.allocatedAmount) * 100) - 50 : 0,
  }));

  const filteredBudgetAllocations = budgetAllocations.filter((ba: any) => {
    const year = String(ba.budgetYear || '').toLowerCase();
    const department = String(ba.department || '').toLowerCase();
    const matchesYear = yearFilter === 'all' || year === yearFilter;
    const matchesDepartment = departmentFilter === 'all' || department === departmentFilter;
    return matchesYear && matchesDepartment;
  });

  const filteredVarianceData = filteredBudgetAllocations.map((ba: any) => ({
    name: ba.department.length > 12 ? ba.department.slice(0, 12) + '…' : ba.department,
    allocated: ba.allocatedAmount / 100000,
    spent: ba.spentAmount / 100000,
    variance: ba.allocatedAmount > 0 ? ((ba.spentAmount / ba.allocatedAmount) * 100) - 50 : 0,
  }));

  const yearOptions = Array.from(new Set(budgetAllocations.map((ba: any) => String(ba.budgetYear || '').trim()).filter(Boolean)));
  const departmentOptions = Array.from(new Set(budgetAllocations.map((ba: any) => String(ba.department || '').trim()).filter(Boolean)));

  const generateBudgetReport = async (type: string) => {
    try {
      await postApi('/finance/reports/generate', { type });
      toast({ title: 'Report generated', description: `${type} generated successfully.` });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error.message || 'Could not generate report.', variant: 'destructive' });
    }
  };

  const createAllocation = async () => {
    const department = window.prompt('Department:', 'General Administration');
    if (!department) return;
    const category = window.prompt('Category:', 'General');
    if (!category) return;
    const budgetYear = window.prompt('Budget year:', '2025-26');
    if (!budgetYear) return;
    const allocatedAmount = Number(window.prompt('Allocated amount:', '1000000') || 0);
    const spentAmount = Number(window.prompt('Spent amount:', '0') || 0);
    if (allocatedAmount <= 0 || spentAmount < 0) {
      toast({ title: 'Invalid input', description: 'Allocated amount must be > 0 and spent amount >= 0.', variant: 'destructive' });
      return;
    }

    try {
      await postApi<any>('/finance/budgets', {
        department,
        category,
        budgetYear,
        allocatedAmount,
        spentAmount,
        utilizationPercentage: allocatedAmount > 0 ? Number(((spentAmount / allocatedAmount) * 100).toFixed(1)) : 0,
      });
      await loadBudgetData();
      toast({ title: 'Allocation created', description: 'New budget allocation added.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error.message || 'Could not create allocation.', variant: 'destructive' });
    }
  };

  const adjustBudget = async (budget: any) => {
    const allocated = Number(window.prompt(`Allocated amount for ${budget.department}:`, String(budget.allocatedAmount || 0)) || 0);
    const spent = Number(window.prompt(`Spent amount for ${budget.department}:`, String(budget.spentAmount || 0)) || 0);
    if (allocated <= 0 || spent < 0) {
      toast({ title: 'Invalid input', description: 'Allocated amount must be > 0 and spent amount >= 0.', variant: 'destructive' });
      return;
    }

    try {
      const available = Math.max(0, allocated - spent);
      const utilization = allocated > 0 ? Number(((spent / allocated) * 100).toFixed(1)) : 0;
      await putApi<any>(`/finance/budgets/${budget.id}`, {
        allocatedAmount: allocated,
        spentAmount: spent,
        availableAmount: available,
        utilizationPercentage: utilization,
      });
      await loadBudgetData();
      toast({ title: 'Budget synced', description: `${budget.department} allocation synchronized.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message || 'Could not update budget.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Budget Management</h1>
            <p className="text-muted-foreground">Department allocations, variance analysis, and scenario planning – FY 2025-26</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateBudgetReport('budget_export')}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={createAllocation}><Plus className="mr-2 h-4 w-4" />New Allocation</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{budgetAllocations.length} departments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
              <div className="mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-amber-600" />
                <span className="text-xs text-amber-600">{overallUtilization}% utilized</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAvailable)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Remaining this FY</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Over-budget Depts</p>
              <p className="text-2xl font-bold text-destructive">{budgetAllocations.filter(b => b.utilizationPercentage > 75).length}</p>
              <p className="mt-1 text-xs text-destructive">Needs attention</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="allocations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="allocations">Department Allocations</TabsTrigger>
            <TabsTrigger value="variance">Variance Analysis</TabsTrigger>
            <TabsTrigger value="scenario">Scenario Planning</TabsTrigger>
            <TabsTrigger value="trends">Trends & Insights</TabsTrigger>
          </TabsList>

          {/* Allocations Tab */}
          <TabsContent value="allocations" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toLowerCase()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department} value={department.toLowerCase()}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {filteredBudgetAllocations.map((ba) => (
                <Card key={ba.id} className={ba.utilizationPercentage > 80 ? 'border-destructive/50' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-foreground">{ba.department}</h3>
                          <Badge variant={ba.utilizationPercentage > 80 ? 'destructive' : ba.utilizationPercentage < 30 ? 'secondary' : 'default'}>
                            {ba.utilizationPercentage}% used
                          </Badge>
                          {ba.utilizationPercentage > 80 && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">Allocated: </span>
                            <span className="font-medium text-foreground">{formatCurrency(ba.allocatedAmount)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Spent: </span>
                            <span className="font-medium text-foreground">{formatCurrency(ba.spentAmount)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Available: </span>
                            <span className="font-medium text-green-600">{formatCurrency(ba.availableAmount)}</span>
                          </div>
                        </div>
                        <Progress value={ba.utilizationPercentage} className="mt-3 h-2" />
                      </div>
                      <div className="ml-6 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => adjustBudget(ba)}><Settings className="mr-1 h-3 w-3" />Adjust</Button>
                        <Button variant="ghost" size="sm" onClick={() => generateBudgetReport(`budget_details_${ba.department}`)}>Details</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Variance Analysis Tab */}
          <TabsContent value="variance" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Budget vs Actual – Department-wise (₹ in Lakhs)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={filteredVarianceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `₹${v}L`} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(v: number) => `₹${v.toFixed(0)} L`} />
                    <Bar dataKey="allocated" fill="hsl(var(--muted))" name="Allocated" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="spent" name="Spent" radius={[0, 4, 4, 0]}>
                      {filteredVarianceData.map((entry, index) => (
                        <Cell key={index} fill={entry.spent > entry.allocated * 0.8 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="border-destructive/30">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-destructive" />Over-utilized (&gt;75%)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {budgetAllocations.filter(b => b.utilizationPercentage > 75).map(b => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-destructive/5 p-3">
                      <div>
                        <p className="font-medium text-foreground">{b.department}</p>
                        <p className="text-xs text-muted-foreground">₹{(b.availableAmount / 100000).toFixed(0)}L remaining</p>
                      </div>
                      <Badge variant="destructive">{b.utilizationPercentage}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-amber-300/30">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4 text-amber-600" />Under-utilized (&lt;40%)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {budgetAllocations.filter(b => b.utilizationPercentage < 40).map(b => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
                      <div>
                        <p className="font-medium text-foreground">{b.department}</p>
                        <p className="text-xs text-muted-foreground">₹{(b.availableAmount / 100000).toFixed(0)}L unspent</p>
                      </div>
                      <Badge variant="secondary">{b.utilizationPercentage}%</Badge>
                    </div>
                  ))}
                  {budgetAllocations.filter(b => b.utilizationPercentage < 40).length === 0 && (
                    <p className="text-sm text-muted-foreground">No significantly under-utilized departments</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Scenario Planning Tab */}
          <TabsContent value="scenario" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-primary" />
                  What-If Scenario Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Project next year's finances based on different assumptions. Adjust intake, fees, or costs to see projected impact.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Scenario</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Revenue (₹ Cr)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Expenses (₹ Cr)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Surplus (₹ Cr)</th>
                        <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioData.map((s) => (
                        <tr key={s.scenario} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{s.scenario}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">₹{s.revenue} Cr</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">₹{s.expenses} Cr</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                            <span className={s.surplus > 3 ? 'text-green-600' : s.surplus < 1 ? 'text-destructive' : ''}>
                              ₹{s.surplus} Cr
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {s.surplus > 3 ? (
                              <div className="flex items-center gap-1 text-green-600"><ArrowUpRight className="h-4 w-4" /><span className="text-xs">Favorable</span></div>
                            ) : s.surplus < 1 ? (
                              <div className="flex items-center gap-1 text-destructive"><ArrowDownRight className="h-4 w-4" /><span className="text-xs">Risk</span></div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Baseline</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => generateBudgetReport('custom_scenario')}><RefreshCw className="mr-1 h-3 w-3" />Run Custom Scenario</Button>
                  <Button size="sm" onClick={() => generateBudgetReport('scenario_projection_export')}><Download className="mr-1 h-3 w-3" />Export Projections</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Per-Student Expenditure Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expenditureTrend.map((t: any) => (
                      <div key={t.year} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <span className="text-sm font-medium text-foreground">{t.year}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-foreground">{formatCurrency(t.amount)}</span>
                          <Badge variant="secondary">{t.changePercentage > 0 ? '+' : ''}{t.changePercentage}%</Badge>
                        </div>
                      </div>
                    ))}
                    {expenditureTrend.length === 0 && <p className="text-sm text-muted-foreground">No trend data available.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Stream Analysis</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {revenueStreams.map((r: any) => (
                      <div key={r.stream} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">{r.stream}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({r.percentage}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{formatCurrency(r.amount)}</span>
                          {r.trend === 'up' ? <TrendingUp className="h-3 w-3 text-green-600" /> : r.trend === 'down' ? <TrendingDown className="h-3 w-3 text-destructive" /> : <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </div>
                    ))}
                    {revenueStreams.length === 0 && <p className="text-sm text-muted-foreground">No revenue stream data available.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <PieChart className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">AI-Powered Budget Insights</h3>
                <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                  Analyze multi-year budget trends, predict variances, and receive AI recommendations for optimal resource allocation across departments.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => generateBudgetReport('historical_trends')}>View Historical Trends</Button>
                  <Button onClick={() => generateBudgetReport('ai_budget_insights')}>Generate AI Insights</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
