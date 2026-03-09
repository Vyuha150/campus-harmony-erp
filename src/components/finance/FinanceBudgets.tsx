import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, Plus, Download,
  Calculator, PieChart, ArrowUpRight, ArrowDownRight, Settings, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { budgetAllocations } from '@/data/financeMockData';

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const scenarioData = [
  { scenario: 'Base Case', revenue: 48, expenses: 45, surplus: 3 },
  { scenario: '+10% Intake', revenue: 52.8, expenses: 47.5, surplus: 5.3 },
  { scenario: '-5% Fees', revenue: 45.6, expenses: 45, surplus: 0.6 },
  { scenario: 'Cost Cut 8%', revenue: 48, expenses: 41.4, surplus: 6.6 },
];

const varianceData = budgetAllocations.map(ba => ({
  name: ba.department.length > 12 ? ba.department.slice(0, 12) + '…' : ba.department,
  allocated: ba.allocatedAmount / 100000,
  spent: ba.spentAmount / 100000,
  variance: ((ba.spentAmount / ba.allocatedAmount) * 100) - 50,
}));

export default function FinanceBudgets() {
  const totalAllocated = budgetAllocations.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalSpent = budgetAllocations.reduce((s, b) => s + b.spentAmount, 0);
  const totalAvailable = totalAllocated - totalSpent;
  const overallUtilization = ((totalSpent / totalAllocated) * 100).toFixed(1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Budget Management</h1>
            <p className="text-muted-foreground">Department allocations, variance analysis, and scenario planning – FY 2025-26</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Allocation</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
              <p className="mt-1 text-xs text-muted-foreground">8 departments</p>
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
              <Select defaultValue="2025-26">
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-26">FY 2025-26</SelectItem>
                  <SelectItem value="2024-25">FY 2024-25</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {budgetAllocations.map(b => (
                    <SelectItem key={b.id} value={b.department}>{b.department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {budgetAllocations.map((ba) => (
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
                        <Button variant="outline" size="sm"><Settings className="mr-1 h-3 w-3" />Adjust</Button>
                        <Button variant="ghost" size="sm">Details</Button>
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
                  <BarChart data={varianceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `₹${v}L`} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(v: number) => `₹${v.toFixed(0)} L`} />
                    <Bar dataKey="allocated" fill="hsl(var(--muted))" name="Allocated" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="spent" name="Spent" radius={[0, 4, 4, 0]}>
                      {varianceData.map((entry, index) => (
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
                  <Button variant="outline" size="sm"><RefreshCw className="mr-1 h-3 w-3" />Run Custom Scenario</Button>
                  <Button size="sm"><Download className="mr-1 h-3 w-3" />Export Projections</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Per-Student Expenditure Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { year: '2023-24', amount: '₹1.85 L', change: '+5.7%' },
                      { year: '2024-25', amount: '₹1.92 L', change: '+3.8%' },
                      { year: '2025-26 (Proj)', amount: '₹2.01 L', change: '+4.7%' },
                    ].map(t => (
                      <div key={t.year} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <span className="text-sm font-medium text-foreground">{t.year}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-foreground">{t.amount}</span>
                          <Badge variant="secondary">{t.change}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Stream Analysis</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { stream: 'Tuition Fees', amount: '₹32.5 Cr', pct: '67.7%', trend: 'stable' },
                      { stream: 'Hostel & Mess', amount: '₹8.2 Cr', pct: '17.1%', trend: 'up' },
                      { stream: 'Research Grants', amount: '₹4.8 Cr', pct: '10.0%', trend: 'up' },
                      { stream: 'Other Income', amount: '₹2.5 Cr', pct: '5.2%', trend: 'down' },
                    ].map(r => (
                      <div key={r.stream} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">{r.stream}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({r.pct})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{r.amount}</span>
                          {r.trend === 'up' ? <TrendingUp className="h-3 w-3 text-green-600" /> : r.trend === 'down' ? <TrendingDown className="h-3 w-3 text-destructive" /> : <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </div>
                    ))}
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
                  <Button variant="outline">View Historical Trends</Button>
                  <Button>Generate AI Insights</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
