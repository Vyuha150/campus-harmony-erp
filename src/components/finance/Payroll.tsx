import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Lock, Download, CreditCard, Calculator, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default function Payroll() {
  const [payrollRecords, setPayrollRecords] = useState<any>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [_apiLoading, _setApiLoading] = useState(true);
  const { toast } = useToast();

  const loadPayrollData = async () => {
    const records = await fetchApi('/finance/payroll');
    setPayrollRecords(records);
  };

  useEffect(() => {
    loadPayrollData().catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const toArray = (value: any) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const totalGross = payrollRecords.reduce((a, b) => a + b.grossSalary, 0);
  const totalNet = payrollRecords.reduce((a, b) => a + b.netSalary, 0);
  const totalEmployees = payrollRecords.length;
  const draftCount = payrollRecords.filter((r: any) => String(r.status || '').toLowerCase() === 'draft').length;
  const approvedCount = payrollRecords.filter((r: any) => String(r.status || '').toLowerCase() === 'approved').length;
  const paidCount = payrollRecords.filter((r: any) => String(r.status || '').toLowerCase() === 'paid').length;

  const disbursePayroll = async () => {
    try {
      await postApi('/finance/payroll/disburse', { month: 'March', year: 2026 });
      await loadPayrollData();
      toast({ title: 'Payroll disbursed', description: 'Eligible payroll records marked as paid.' });
    } catch (error) {
      console.error('Failed to disburse payroll', error);
      toast({ title: 'Disbursement failed', description: 'Could not disburse payroll.', variant: 'destructive' });
    }
  };

  const processPayrollRecord = async () => {
    const employeeId = window.prompt('Employee ID:', `EMP-${Date.now()}`);
    if (!employeeId) return;
    const employeeName = window.prompt('Employee name:', 'New Employee');
    if (!employeeName) return;
    const department = window.prompt('Department:', 'General');
    if (!department) return;
    const designation = window.prompt('Designation:', 'Staff');
    if (!designation) return;
    const basicSalary = Number(window.prompt('Basic salary:', '30000') || 0);
    const allowanceAmount = Number(window.prompt('Allowance amount:', '6000') || 0);
    const deductionAmount = Number(window.prompt('Deduction amount:', '1800') || 0);
    if (basicSalary <= 0) {
      toast({ title: 'Invalid salary', description: 'Basic salary must be greater than zero.', variant: 'destructive' });
      return;
    }

    const grossSalary = basicSalary + allowanceAmount;
    const netSalary = grossSalary - deductionAmount;

    try {
      const now = new Date();
      await postApi<any>('/finance/payroll/process', {
        employeeId,
        employeeName,
        department,
        designation,
        month: now.toLocaleString('en-IN', { month: 'long' }),
        year: now.getFullYear(),
        basicSalary,
        allowances: [{ name: 'Allowance', amount: allowanceAmount }],
        deductions: [{ name: 'Deduction', amount: deductionAmount }],
        grossSalary,
        netSalary,
        status: 'draft',
        paymentMethod: 'bank_transfer',
      });
      await loadPayrollData();
      toast({ title: 'Payroll processed', description: 'A new payroll record has been generated.' });
    } catch (error: any) {
      toast({ title: 'Process failed', description: error.message || 'Could not process payroll record.', variant: 'destructive' });
    }
  };

  const exportBankFile = async () => {
    try {
      await postApi('/finance/reports/generate', { type: 'bank_transfer_file' });
      toast({ title: 'Bank file generated', description: 'Bank transfer file has been generated.' });
    } catch (error: any) {
      toast({ title: 'Export failed', description: error.message || 'Could not generate bank file.', variant: 'destructive' });
    }
  };

  const filteredPayroll = payrollRecords.filter((record: any) => {
    const query = searchTerm.trim().toLowerCase();
    const department = String(record.department || '').toLowerCase();
    const matchesDepartment = departmentFilter === 'all' || department === departmentFilter;
    const matchesSearch = query.length === 0
      || String(record.employeeName || '').toLowerCase().includes(query)
      || String(record.employeeId || '').toLowerCase().includes(query)
      || String(record.designation || '').toLowerCase().includes(query);
    return matchesDepartment && matchesSearch;
  });

  const departmentOptions = Array.from(
    new Set(payrollRecords.map((record: any) => String(record.department || '').trim()).filter(Boolean))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll Processing</h1>
            <p className="text-muted-foreground">March 2026 payroll – Review, approve, and disburse salaries</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportBankFile}><Download className="mr-2 h-4 w-4" />Bank File</Button>
            <Button variant="outline" size="sm" onClick={processPayrollRecord}><Calculator className="mr-2 h-4 w-4" />Process Record</Button>
            <Button size="sm" onClick={disbursePayroll}><Lock className="mr-2 h-4 w-4" />Lock & Disburse</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Employees</p><p className="text-2xl font-bold text-foreground">{totalEmployees}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Gross Payroll</p><p className="text-2xl font-bold text-foreground">{formatCurrency(totalGross)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Net Payable</p><p className="text-2xl font-bold text-foreground">{formatCurrency(totalNet)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Status</p><p className="text-2xl font-bold text-amber-600">{draftCount > 0 ? 'Draft' : approvedCount > 0 ? 'Approved' : 'Paid'}</p><p className="text-xs text-muted-foreground">{draftCount} draft • {approvedCount} approved • {paidCount} paid</p></CardContent></Card>
        </div>

        <Tabs defaultValue="register">
          <TabsList>
            <TabsTrigger value="register">Payroll Register</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
            <TabsTrigger value="settings">Payroll Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search employee..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{departmentOptions.map((department) => <SelectItem key={department} value={department.toLowerCase()}>{department}</SelectItem>)}</SelectContent></Select>
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
                    {filteredPayroll.map((pr) => {
                      const allowances = toArray(pr.allowances);
                      const deductions = toArray(pr.deductions);
                      const totalAllowance = allowances.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);
                      const totalDeduction = deductions.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);
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