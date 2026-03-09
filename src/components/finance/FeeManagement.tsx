import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, Search, Download, Plus, Filter, CheckCircle2, XCircle, Clock, CreditCard, Banknote, Receipt } from 'lucide-react';
import { feePayments, feeStructures } from '@/data/financeMockData';

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

export default function FeeManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fee Management</h1>
            <p className="text-muted-foreground">Record payments, manage fee structures, and generate reports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Daily Report</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Record Payment</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Today's Collection</p><p className="text-2xl font-bold text-foreground">₹4,62,500</p><p className="text-xs text-green-600">+12% vs yesterday</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Payments Today</p><p className="text-2xl font-bold text-foreground">28</p><p className="text-xs text-muted-foreground">Online: 22 | Offline: 6</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Failed Transactions</p><p className="text-2xl font-bold text-destructive">3</p><p className="text-xs text-destructive">Needs rectification</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Semester Collection</p><p className="text-2xl font-bold text-foreground">₹3.8 Cr</p><p className="text-xs text-muted-foreground">89.4% of target</p></CardContent></Card>
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
                <Input placeholder="Search by student name, ID, or transaction..." className="pl-10" />
              </div>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="dd">DD</SelectItem></SelectContent></Select>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="successful">Successful</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select>
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
                      {feePayments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.studentId}</p></td>
                          <td className="px-4 py-3 text-sm text-foreground">{p.program}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2 text-sm">{methodIcon(p.paymentMethod)}<span className="capitalize">{p.paymentMethod.replace('_', ' ')}</span></div></td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{p.paymentDate.toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">{statusIcon(p.status)}<Badge variant={p.status === 'successful' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">{p.status}</Badge></div></td>
                          <td className="px-4 py-3"><Button variant="ghost" size="sm">View</Button>{p.status === 'failed' && <Button variant="outline" size="sm" className="ml-1">Rectify</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structures" className="space-y-4">
            {feeStructures.map((fs) => (
              <Card key={fs.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{fs.program} – {fs.semester} Semester {fs.academicYear}</CardTitle>
                    <p className="text-sm text-muted-foreground">Due: {fs.dueDate.toLocaleDateString('en-IN')} | Late Fee: {formatCurrency(fs.lateFeePenalty)}/day</p>
                  </div>
                  <Badge variant={fs.active ? 'default' : 'secondary'}>{fs.active ? 'Active' : 'Inactive'}</Badge>
                </CardHeader>
                <CardContent>
                  <table className="w-full">
                    <thead><tr className="border-b"><th className="py-2 text-left text-sm text-muted-foreground">Component</th><th className="py-2 text-left text-sm text-muted-foreground">Category</th><th className="py-2 text-right text-sm text-muted-foreground">Amount</th><th className="py-2 text-center text-sm text-muted-foreground">Mandatory</th></tr></thead>
                    <tbody>
                      {fs.feeComponents.map((fc) => (
                        <tr key={fc.id} className="border-b last:border-0">
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
            <Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" />Create New Fee Structure</Button>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Daily Reconciliation</h3>
              <p className="text-sm text-muted-foreground">Match online payments with bank statements and resolve discrepancies</p>
              <Button className="mt-4">Start Reconciliation</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}