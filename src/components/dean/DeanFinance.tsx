import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Wallet, IndianRupee, PieChart, Target
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';

export default function DeanFinance() {
  const [departmentBudgets, setDepartmentBudgets] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/dean/finance').then(d => setDepartmentBudgets(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
  const totalSpent = departmentBudgets.reduce((s, d) => s + d.spent, 0);
  const utilization = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  const fmt = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finance Overview</h1>
            <p className="text-muted-foreground">Budget allocation and utilization across departments</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Allocated', value: fmt(totalAllocated), icon: Target, color: 'text-blue-600 bg-blue-100' },
            { label: 'Total Spent', value: fmt(totalSpent), icon: Wallet, color: 'text-green-600 bg-green-100' },
            { label: 'Remaining', value: fmt(totalAllocated - totalSpent), icon: IndianRupee, color: 'text-amber-600 bg-amber-100' },
            { label: 'Utilization', value: `${utilization}%`, icon: PieChart, color: 'text-primary bg-primary/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Budget Utilization by Department</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {departmentBudgets.map(db => {
              const pct = Math.round((db.spent / db.allocated) * 100);
              return (
                <div key={db.department} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">{db.department}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Allocated: {fmt(db.allocated)}</span>
                      <span>Spent: {fmt(db.spent)}</span>
                      <Badge variant={pct > 85 ? 'destructive' : pct > 60 ? 'secondary' : 'default'} className="text-[10px]">
                        {pct}% used
                      </Badge>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2 mb-3" />
                  <div className="grid grid-cols-5 gap-2">
                    {db.categories.map(cat => {
                      const catPct = Math.round((cat.spent / cat.allocated) * 100);
                      return (
                        <div key={cat.name} className="text-center">
                          <p className="text-[10px] text-muted-foreground truncate">{cat.name}</p>
                          <p className="text-xs font-bold text-foreground">{fmt(cat.spent)}</p>
                          <p className="text-[10px] text-muted-foreground">of {fmt(cat.allocated)}</p>
                          <Progress value={catPct} className="h-1 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
