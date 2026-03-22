import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, Search, Download, Plus, Filter, CheckCircle2, XCircle, Clock, CreditCard, Banknote, Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const statusIcon = (status: string) => {
  switch (status) {
    case 'successful': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
    default: return null;
  }
};

const methodIcon = (method: string) => {
  switch (method) {
    case 'online': return <CreditCard className="h-4 w-4" />;
    case 'cash': return <Banknote className="h-4 w-4" />;
    default: return <Receipt className="h-4 w-4" />;
  }
};

const normalizeFeeComponents = (value: any) => {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.feeComponents)) return parsed.feeComponents;
      if (parsed && Array.isArray(parsed.components)) return parsed.components;
    } catch {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.feeComponents)) return value.feeComponents;
    if (Array.isArray(value.components)) return value.components;
  }

  return [];
};

export default function FeeManagement() {
  const [feePayments, setFeePayments] = useState<any>([]);
  const [feeStructures, setFeeStructures] = useState<any>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [_apiLoading, _setApiLoading] = useState(true);
  const { toast } = useToast();

  const loadFinanceData = async () => {
    const [payments, structures] = await Promise.all([
      fetchApi('/finance/fee-payments'),
      fetchApi('/finance/fee-structures'),
    ]);
    setFeePayments(payments);
    setFeeStructures(structures);
  };

  useEffect(() => {
    loadFinanceData().catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const successfulPayments = feePayments.filter((p: any) => String(p.status || '').toLowerCase() === 'successful');
  const todayPayments = feePayments.filter((p: any) => {
    const d = new Date(p.paymentDate);
    return !Number.isNaN(d.getTime()) && d >= startOfToday && d < startOfTomorrow;
  });
  const todayCollection = todayPayments
    .filter((p: any) => String(p.status || '').toLowerCase() === 'successful')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const onlineToday = todayPayments.filter((p: any) => String(p.paymentMethod || '').toLowerCase() === 'online').length;
  const offlineToday = todayPayments.length - onlineToday;
  const failedTransactions = feePayments.filter((p: any) => String(p.status || '').toLowerCase() === 'failed').length;
  const semesterCollection = successfulPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const formatDate = (value: any) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN');
  };

  const rectifyPayment = async (id: string) => {
    try {
      await putApi(`/finance/fee-payments/${id}`, { status: 'successful' });
      setFeePayments((prev: any[]) => prev.map((payment: any) => payment.id === id ? { ...payment, status: 'successful', paymentDate: new Date() } : payment));
      toast({ title: 'Payment rectified', description: 'Payment status updated successfully.' });
    } catch (error) {
      console.error('Failed to rectify payment', error);
    }
  };

  const generateFeeReport = async (type: string) => {
    try {
      await postApi('/finance/reports/generate', { type });
      toast({ title: 'Report generated', description: `${type} generated successfully.` });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error.message || 'Could not generate report.', variant: 'destructive' });
    }
  };

  const createFeeStructure = async () => {
    const academicYear = window.prompt('Academic year (e.g. 2025-26):', '2025-26');
    if (!academicYear) return;
    const semester = window.prompt('Semester (e.g. odd/even):', 'odd');
    if (!semester) return;
    const program = window.prompt('Program (e.g. B.Tech CSE):', 'B.Tech CSE');
    if (!program) return;
    const totalAmount = Number(window.prompt('Total amount:', '85000') || 0);
    const lateFeePenalty = Number(window.prompt('Late fee per day:', '100') || 0);
    const dueDateRaw = window.prompt('Due date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!dueDateRaw) return;
    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime()) || totalAmount <= 0) {
      toast({ title: 'Invalid input', description: 'Please enter valid amount and due date.', variant: 'destructive' });
      return;
    }

    try {
      await postApi<any>('/finance/fee-structures', {
        academicYear,
        semester,
        program,
        feeComponents: [
          { id: `fc-${Date.now()}-1`, name: 'Tuition Fee', category: 'tuition', amount: totalAmount, mandatory: true },
        ],
        totalAmount,
        dueDate,
        lateFeePenalty,
        active: true,
      });
      await loadFinanceData();
      toast({ title: 'Fee structure created', description: 'A new fee structure has been added.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error.message || 'Could not create fee structure.', variant: 'destructive' });
    }
  };

  const normalizedFeeStructures = feeStructures.map((structure: any) => ({
    ...structure,
    feeComponents: normalizeFeeComponents(structure.feeComponents),
  }));

  const filteredPayments = feePayments.filter((p: any) => {
    const method = String(p.paymentMethod || '').toLowerCase();
    const status = String(p.status || '').toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const matchesMethod = methodFilter === 'all' || method === methodFilter;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesSearch = query.length === 0
      || String(p.studentName || '').toLowerCase().includes(query)
      || String(p.studentId || '').toLowerCase().includes(query)
      || String(p.transactionId || '').toLowerCase().includes(query);
    return matchesMethod && matchesStatus && matchesSearch;
  });

  const viewPayment = async (payment: any) => {
    toast({
      title: `${payment.studentName} - ${payment.studentId}`,
      description: `Amount: ${formatCurrency(Number(payment.amount || 0))} | Method: ${payment.paymentMethod} | Status: ${payment.status}`
    });
  };

  const refreshReconciliation = async () => {
    try {
      await loadFinanceData();
      toast({ title: 'Reconciliation refreshed', description: 'Latest payment and fee structure data loaded.' });
    } catch (error: any) {
      toast({ title: 'Refresh failed', description: error.message || 'Could not refresh reconciliation data.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fee Management</h1>
            <p className="text-muted-foreground">Record payments, manage fee structures, and generate reports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateFeeReport('daily_collection')}><Download className="mr-2 h-4 w-4" />Daily Report</Button>
            <Button size="sm" onClick={() => generateFeeReport('payment_register')}><Plus className="mr-2 h-4 w-4" />Payment Register</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Today's Collection</p><p className="text-2xl font-bold text-foreground">{formatCurrency(todayCollection)}</p><p className="text-xs text-muted-foreground">Based on successful payments today</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Payments Today</p><p className="text-2xl font-bold text-foreground">{todayPayments.length}</p><p className="text-xs text-muted-foreground">Online: {onlineToday} | Offline: {offlineToday}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Failed Transactions</p><p className="text-2xl font-bold text-destructive">{failedTransactions}</p><p className="text-xs text-destructive">Needs rectification</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Semester Collection</p><p className="text-2xl font-bold text-foreground">{formatCurrency(semesterCollection)}</p><p className="text-xs text-muted-foreground">Successful recorded collections</p></CardContent></Card>
        </div>

        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by student name, ID, or transaction..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="successful">Successful</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Student</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Program</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Method</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.studentId}</p></td>
                          <td className="px-4 py-3 text-sm text-foreground">{p.program}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2 text-sm">{methodIcon(p.paymentMethod)}<span className="capitalize">{p.paymentMethod.replace('_', ' ')}</span></div></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(p.paymentDate)}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">{statusIcon(p.status)}<Badge variant={p.status === 'successful' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">{p.status}</Badge></div></td>
                          <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => viewPayment(p)}>View</Button>{p.status === 'failed' && <Button variant="outline" size="sm" className="ml-1" onClick={() => rectifyPayment(p.id)}>Rectify</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structures" className="space-y-4">
            {normalizedFeeStructures.map((fs) => (
              <Card key={fs.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{fs.program} – {fs.semester} Semester {fs.academicYear}</CardTitle>
                    <p className="text-sm text-muted-foreground">Due: {formatDate(fs.dueDate)} | Late Fee: {formatCurrency(fs.lateFeePenalty)}/day</p>
                  </div>
                  <Badge variant={fs.active ? 'default' : 'secondary'}>{fs.active ? 'Active' : 'Inactive'}</Badge>
                </CardHeader>
                <CardContent>
                  <table className="w-full">
                    <thead><tr className="border-b"><th className="py-2 text-left text-sm text-muted-foreground">Component</th><th className="py-2 text-left text-sm text-muted-foreground">Category</th><th className="py-2 text-right text-sm text-muted-foreground">Amount</th><th className="py-2 text-center text-sm text-muted-foreground">Mandatory</th></tr></thead>
                    <tbody>
                      {fs.feeComponents.map((fc: any, index: number) => (
                        <tr key={fc.id || `${fs.id}-${index}`} className="border-b last:border-0">
                          <td className="py-2 text-sm font-medium text-foreground">{fc.name}</td>
                          <td className="py-2"><Badge variant="outline" className="capitalize">{fc.category}</Badge></td>
                          <td className="py-2 text-right text-sm font-semibold text-foreground">{formatCurrency(fc.amount)}</td>
                          <td className="py-2 text-center">{fc.mandatory ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" /> : <span className="text-xs text-muted-foreground">Optional</span>}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30"><td colSpan={2} className="py-2 text-sm font-bold text-foreground">Total</td><td className="py-2 text-right text-sm font-bold text-foreground">{formatCurrency(fs.totalAmount)}</td><td /></tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={createFeeStructure}><Plus className="mr-2 h-4 w-4" />Create New Fee Structure</Button>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Daily Reconciliation</h3>
              <p className="text-sm text-muted-foreground">Match online payments with bank statements and resolve discrepancies</p>
              <Button className="mt-4" onClick={refreshReconciliation}>Refresh Reconciliation Data</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}