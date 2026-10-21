import { SalaryStructures } from '@/components/finance/SalaryStructures';
import { downloadCsv } from '@/lib/download';
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
      // Was hard-coded to March 2026, whatever month it was.
      const now = new Date();
      const month = now.toLocaleString('en-IN', { month: 'long' });
      if (!window.confirm(`Disburse approved payroll for ${month} ${now.getFullYear()}?`)) return;
      await postApi('/finance/payroll/disburse', { month, year: now.getFullYear() });
      await loadPayrollData();
      toast({ title: 'Payroll disbursed', description: `Approved ${month} ${now.getFullYear()} payroll marked as paid.` });
    } catch (error) {
      console.error('Failed to disburse payroll', error);
      toast({ title: 'Disbursement failed', description: 'Could not disburse payroll.', variant: 'destructive' });
    }
  };

  const thisMonth = { month: new Date().toLocaleString('en-IN', { month: 'long' }), year: new Date().getFullYear() };
  const generateMonth = async () => {
    try {
      const r: any = await postApi('/finance/payroll/generate', thisMonth);
      await loadPayrollData();
      toast({ title: `${thisMonth.month} payroll generated`, description: `${r.created} draft record(s)${r.alreadyThere ? `; ${r.alreadyThere} already existed` : ''}. Review, then approve.` });
    } catch (error: any) {
      toast({ title: 'Could not generate', description: error.message, variant: 'destructive' });
    }
  };
  const approveMonth = async () => {
    try {
      const r: any = await postApi('/finance/payroll/approve', thisMonth);
      await loadPayrollData();
      toast({ title: `Approved ${r.approved} record(s)`, description: 'Disburse when the bank transfer is made.' });
    } catch (error: any) {
      toast({ title: 'Could not approve', description: error.message, variant: 'destructive' });
    }
  };
  // Bank upload file: employee, net pay — for the bank's bulk-transfer portal.
  const exportBankFile = () => {
    const due = payrollRecords.filter((r: any) => r.month === thisMonth.month && r.year === thisMonth.year && r.status === 'approved');
    if (!due.length) { toast({ title: 'Nothing approved this month', description: 'Approve the drafts first.' }); return; }
    downloadCsv(`bank-transfer-${thisMonth.month}-${thisMonth.year}.csv`, ['Employee ID', 'Name', 'Department', 'Net pay'], due.map((r: any) => [r.employeeId, r.employeeName, r.department, Number(r.netSalary).toFixed(2)]));
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

  // Annotated because `payrollRecords` is `any`, so Set and Array.from collapse the
  // result to unknown[] and each option fails as a React key and child.
  const departmentOptions: string[] = Array.from(
    new Set(
      payrollRecords.map((record: any) => String(record.department || '').trim()).filter(Boolean) as string[]
    )
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll Processing</h1>
            <p className="text-muted-foreground">{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} payroll – Review, approve, and disburse salaries</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateMonth}><Calculator className="mr-2 h-4 w-4" />Generate {thisMonth.month}</Button>
            <Button variant="outline" size="sm" onClick={approveMonth} disabled={!draftCount}>Approve drafts</Button>
            <Button variant="outline" size="sm" onClick={exportBankFile}><Download className="mr-2 h-4 w-4" />Bank file</Button>
            <Button size="sm" onClick={disbursePayroll} disabled={!approvedCount}><Lock className="mr-2 h-4 w-4" />Disburse approved</Button>
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
            <TabsTrigger value="settings">Salary structures</TabsTrigger>
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
            <Card><CardContent className="space-y-2 p-4">
              {!payrollRecords.some((r: any) => r.status === 'paid') && <p className="py-8 text-center text-sm text-muted-foreground">No salaries disbursed yet.</p>}
              {Array.from(new Set(payrollRecords.filter((r: any) => r.status === 'paid').map((r: any) => `${r.month} ${r.year}`))).map((m: any) => {
                const rs = payrollRecords.filter((r: any) => r.status === 'paid' && `${r.month} ${r.year}` === m);
                return (
                  <details key={m} className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">{m} — {rs.length} paid · net {formatCurrency(rs.reduce((a: number, r: any) => a + Number(r.netSalary || 0), 0))}</summary>
                    <div className="mt-2 space-y-1">{rs.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-sm"><span>{r.employeeName} · {r.designation}</span><span className="flex items-center gap-2">{formatCurrency(r.netSalary)}<Button size="sm" variant="ghost" onClick={() => window.open(`/print/payslip/${r.id}?as=finance`, '_blank', 'noopener')}>Payslip</Button></span></div>
                    ))}</div>
                  </details>
                );
              })}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="settings"><SalaryStructures /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}