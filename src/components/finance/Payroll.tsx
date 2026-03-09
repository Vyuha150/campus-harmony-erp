import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Lock, Download, CreditCard, Calculator, FileText } from 'lucide-react';
import { payrollRecords } from '@/data/financeMockData';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default function Payroll() {
  const totalGross = payrollRecords.reduce((a, b) => a + b.grossSalary, 0);
  const totalNet = payrollRecords.reduce((a, b) => a + b.netSalary, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll Processing</h1>
            <p className="text-muted-foreground">March 2026 payroll – Review, approve, and disburse salaries</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Bank File</Button>
            <Button size="sm"><Lock className="mr-2 h-4 w-4" />Lock & Disburse</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Employees</p><p className="text-2xl font-bold text-foreground">487</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Gross Payroll</p><p className="text-2xl font-bold text-foreground">₹7.85 Cr</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Net Payable</p><p className="text-2xl font-bold text-foreground">₹6.42 Cr</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Status</p><p className="text-2xl font-bold text-amber-600">Draft</p><p className="text-xs text-muted-foreground">Pending CFO approval</p></CardContent></Card>
        </div>

        <Tabs defaultValue="register">
          <TabsList>
            <TabsTrigger value="register">Payroll Register</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
            <TabsTrigger value="settings">Payroll Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search employee..." className="pl-10" /></div>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem><SelectItem value="cs">Computer Science</SelectItem><SelectItem value="ece">Electronics</SelectItem></SelectContent></Select>
            </div>

            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Employee</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Department</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Basic</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Allowances</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Deductions</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Gross</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Net Pay</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {payrollRecords.map((pr) => {
                      const totalAllowance = pr.allowances.reduce((a, b) => a + b.amount, 0);
                      const totalDeduction = pr.deductions.reduce((a, b) => a + b.amount, 0);
                      return (
                        <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{pr.employeeName}</p><p className="text-xs text-muted-foreground">{pr.designation}</p></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{pr.department}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(pr.basicSalary)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-600">+{formatCurrency(totalAllowance)}</td>
                          <td className="px-4 py-3 text-right text-sm text-destructive">-{formatCurrency(totalDeduction)}</td>
                          <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(pr.grossSalary)}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-foreground">{formatCurrency(pr.netSalary)}</td>
                          <td className="px-4 py-3"><Badge variant={pr.status === 'paid' ? 'default' : pr.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{pr.status}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="history">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">Payment History</h3>
              <p className="text-sm text-muted-foreground">View past payroll cycles, payment details, and tax computations</p>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <Calculator className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">Payroll Configuration</h3>
              <p className="text-sm text-muted-foreground">Manage salary components, tax slabs, PF rates, and payment schedules</p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}