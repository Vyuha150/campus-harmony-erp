import { useState } from 'react';
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
import { mockFeeRecords, mockStudentProfile } from '@/data/studentMockData';
import { cn } from '@/lib/utils';

export default function StudentFees() {
  const [yearFilter, setYearFilter] = useState('all');
  const profile = mockStudentProfile;

  const pendingFees = mockFeeRecords.filter(f => f.status === 'pending' || f.status === 'overdue');
  const paidFees = mockFeeRecords.filter(f => f.status === 'paid');
  const totalPending = pendingFees.reduce((sum, f) => sum + f.amount, 0);
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

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Fees & Payments</h1>
            <p className="page-description">View and pay your fees, download receipts</p>
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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay Now
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Make Payment</DialogTitle>
                      <DialogDescription>Select fees to pay</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {pendingFees.map((fee) => (
                        <div key={fee.id} className="flex items-center justify-between rounded-lg border p-4">
                          <div>
                            <p className="font-medium">{fee.description}</p>
                            <p className="text-sm text-muted-foreground">
                              Due: {fee.dueDate.toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-lg font-bold">₹{fee.amount.toLocaleString()}</p>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total Amount</span>
                        <span className="text-xl font-bold text-primary">
                          ₹{totalPending.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="w-full">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Proceed to Payment Gateway
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
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
          </TabsList>

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
                              Due: {fee.dueDate.toLocaleDateString()}
                            </span>
                            {fee.semester && (
                              <span>Semester {fee.semester}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">₹{fee.amount.toLocaleString()}</p>
                          {getStatusBadge(fee.status)}
                        </div>
                        <Button>
                          Pay Now
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
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
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2023-24">2023-24</SelectItem>
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
                    {paidFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.description}</TableCell>
                        <TableCell className="capitalize">{fee.type}</TableCell>
                        <TableCell>{fee.paidDate?.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <code className="text-xs">{fee.transactionId}</code>
                        </TableCell>
                        <TableCell className="font-medium">₹{fee.amount.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(fee.status)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
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
                <CardDescription>Academic Year 2024-25</CardDescription>
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
