import { useTabParam } from '@/hooks/useTabParam';
import { useState, useEffect } from 'react';
import { 
  Wallet, CreditCard, Download, CheckCircle, AlertCircle, 
  Clock, Calendar, FileText, ArrowRight, Receipt,
  Building2, History, Filter, Search
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { fetchApi, postApi } from '@/lib/apiService';
import { cn } from '@/lib/utils';
import { safeArray, safeBoolean, safeDate, safeNumber, safeString } from '@/lib/normalize';
import { toast } from '@/hooks/use-toast';
import { FeeWaivers } from './FeeWaivers';

export default function StudentFees() {
  const tabParam = useTabParam('pending');
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>({});
  const [_apiLoading, _setApiLoading] = useState(true);

  const normalizeFee = (raw: any) => ({
    id: safeString(raw?.id),
    type: safeString(raw?.type),
    description: safeString(raw?.description),
    amount: safeNumber(raw?.amount),
    dueDate: safeDate(raw?.dueDate),
    paidDate: raw?.paidDate ? safeDate(raw.paidDate) : undefined,
    status: safeString(raw?.status),
    semester: safeNumber(raw?.semester),
    transactionId: raw?.transactionId ? safeString(raw.transactionId) : undefined,
    // What is still owed after payments and any granted waiver.
    outstanding: raw?.outstanding != null ? safeNumber(raw.outstanding) : safeNumber(raw?.amount),
    waivedAmount: safeNumber(raw?.waivedAmount),
    academicYear: safeString(raw?.academicYear),
  });

  const loadFees = () => fetchApi('/students/fees')
    .then((d) => setFeeRecords(safeArray(d).map(normalizeFee)))
    .catch((error) => { console.error('API request failed', error); });

  useEffect(() => {
    loadFees();

    fetchApi('/students/profile')
      .then((d) => setStudentProfile({
        ...d,
        scholarshipHolder: safeBoolean(d?.scholarshipHolder),
        scholarshipName: safeString(d?.scholarshipName)
      }))
      .catch((error) => { console.error('API request failed', error); });

    _setApiLoading(false);
  }, []);

  const [yearFilter, setYearFilter] = useState('all');
  const profile = studentProfile;

  // `partial` was missing, so a part-paid fee vanished from "Pending".
  const pendingFees = feeRecords.filter(f => ['pending', 'overdue', 'partial'].includes(f.status) && f.outstanding > 0);
  const paidFees = feeRecords.filter(f => f.status === 'paid');
  const filteredPaidFees = paidFees.filter((fee) => {
    if (yearFilter === 'all') return true;
    return fee.academicYear === yearFilter;
  });
  const totalPending = pendingFees.reduce((sum, f) => sum + f.outstanding, 0);
  const totalPaid = paidFees.reduce((sum, f) => sum + f.amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning">Pending</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'partial':
        return <Badge className="bg-info/10 text-info">Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFeeTypeIcon = (type: string) => {
    switch (type) {
      case 'tuition':
        return <Building2 className="h-5 w-5" />;
      case 'hostel':
        return <Building2 className="h-5 w-5" />;
      case 'exam':
        return <FileText className="h-5 w-5" />;
      case 'library':
        return <FileText className="h-5 w-5" />;
      default:
        return <Receipt className="h-5 w-5" />;
    }
  };

  // A printable receipt with the college letterhead (Save as PDF from the print dialog).
  const downloadReceipt = (fee: any) => {
    window.open(`/print/fee-receipt/${fee.id}`, '_blank', 'noopener');
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Fees & Payments</h1>
            <p className="page-description">Your dues, payments and receipts</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={cn(totalPending > 0 && 'border-warning/50')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
                <p className={cn('text-3xl font-bold', totalPending > 0 ? 'text-warning' : 'text-success')}>
                  ₹{totalPending.toLocaleString()}
                </p>
              </div>
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                totalPending > 0 ? 'bg-warning/10' : 'bg-success/10'
              )}>
                {totalPending > 0 ? (
                  <AlertCircle className="h-6 w-6 text-warning" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-success" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid (FY)</p>
                <p className="text-3xl font-bold text-success">₹{totalPaid.toLocaleString()}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <Wallet className="h-6 w-6 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Scholarship</p>
                <p className="text-lg font-bold text-primary">
                  {profile.scholarshipHolder ? profile.scholarshipName : 'Not Applicable'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Fee Alert */}
        {pendingFees.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <AlertCircle className="h-8 w-8 text-warning" />
                  <div>
                    <p className="font-medium">Fee Payment Due</p>
                    <p className="text-sm text-muted-foreground">
                      You have {pendingFees.length} pending fee(s) totaling ₹{totalPending.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Pay at the Finance office (cash, DD or bank transfer). Finance records the payment and your receipt appears under Payment History.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs key={tabParam.key} defaultValue={tabParam.defaultValue} className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingFees.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[10px] text-white">
                  {pendingFees.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
            <TabsTrigger value="structure">Fee Structure</TabsTrigger>
            <TabsTrigger value="waivers">Waivers & Scholarships</TabsTrigger>
          </TabsList>

          <TabsContent value="waivers">
            <FeeWaivers fees={feeRecords} onChanged={loadFees} />
          </TabsContent>

          {/* Pending Fees */}
          <TabsContent value="pending" className="space-y-4">
            {pendingFees.length > 0 ? (
              <div className="space-y-4">
                {pendingFees.map((fee) => (
                  <Card key={fee.id} className={cn(
                    fee.status === 'overdue' && 'border-destructive/50'
                  )}>
                    <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-lg',
                          fee.status === 'overdue' ? 'bg-destructive/10' : 'bg-warning/10'
                        )}>
                          {getFeeTypeIcon(fee.type)}
                        </div>
                        <div>
                          <p className="font-medium">{fee.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {fee.dueDate.toLocaleDateString('en-IN')}
                            </span>
                            {fee.semester && (
                              <span>Semester {fee.semester}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">₹{fee.outstanding.toLocaleString()}</p>
                          {fee.outstanding !== fee.amount && (
                            <p className="text-xs text-muted-foreground">of ₹{fee.amount.toLocaleString()}{fee.waivedAmount > 0 ? ` · ₹${fee.waivedAmount.toLocaleString()} waived` : ''}</p>
                          )}
                          {getStatusBadge(fee.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-success" />
                  <p className="mt-4 text-lg font-medium">All Fees Paid</p>
                  <p className="text-sm text-muted-foreground">You have no pending payments</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Payment History */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Payment History</CardTitle>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {[...new Set(paidFees.map((f: any) => f.academicYear).filter(Boolean))].sort().reverse().map((y: any) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaidFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.description}</TableCell>
                        <TableCell className="capitalize">{fee.type}</TableCell>
                        <TableCell>{fee.paidDate ? fee.paidDate.toLocaleDateString('en-IN') : '-'}</TableCell>
                        <TableCell>
                          <code className="text-xs">{fee.transactionId || '-'}</code>
                        </TableCell>
                        <TableCell className="font-medium">₹{fee.amount.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(fee.status)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => downloadReceipt(fee)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee Structure */}
          <TabsContent value="structure">
            <Card>
              <CardHeader>
                <CardTitle>Fee Structure - {profile.program} {profile.branch}</CardTitle>
                <CardDescription>Fees on your account, by type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee Component</TableHead>
                      <TableHead>Semester Fee</TableHead>
                      <TableHead>Annual Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Tuition Fee</TableCell>
                      <TableCell>₹75,000</TableCell>
                      <TableCell>₹1,50,000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Development Fee</TableCell>
                      <TableCell>₹10,000</TableCell>
                      <TableCell>₹20,000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Lab Fee</TableCell>
                      <TableCell>₹5,000</TableCell>
                      <TableCell>₹10,000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Library Fee</TableCell>
                      <TableCell>₹2,500</TableCell>
                      <TableCell>₹5,000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Examination Fee</TableCell>
                      <TableCell>₹1,500</TableCell>
                      <TableCell>₹3,000</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell>₹94,000</TableCell>
                      <TableCell>₹1,88,000</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="mt-4 rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Hostel and transport fees are separate and applicable based on enrollment.
                    Scholarship holders may have reduced fee components.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
