import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Plus, Search, Lock, Unlock, Download, FileText, Calculator } from 'lucide-react';
import { journalEntries } from '@/data/financeMockData';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default function Accounting() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounting & Ledger</h1>
            <p className="text-muted-foreground">Journal entries, book closing, and financial statements</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export Ledger</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Journal Entry</Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Debits (Mar)</p><p className="text-2xl font-bold text-foreground">₹4.82 Cr</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Credits (Mar)</p><p className="text-2xl font-bold text-foreground">₹4.82 Cr</p><p className="text-xs text-green-600">Balanced ✓</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Entries</p><p className="text-2xl font-bold text-amber-600">3</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Books Status</p><p className="text-2xl font-bold text-foreground">Feb Closed</p><p className="text-xs text-muted-foreground">Mar – Open</p></CardContent></Card>
        </div>

        <Tabs defaultValue="journal">
          <TabsList>
            <TabsTrigger value="journal">Journal Entries</TabsTrigger>
            <TabsTrigger value="ledger">General Ledger</TabsTrigger>
            <TabsTrigger value="statements">Financial Statements</TabsTrigger>
            <TabsTrigger value="closing">Book Closing</TabsTrigger>
          </TabsList>

          <TabsContent value="journal" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search journal entries..." className="pl-10" />
              </div>
            </div>

            {journalEntries.map((je) => (
              <Card key={je.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">{je.entryNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">{je.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={je.status === 'posted' ? 'default' : je.status === 'approved' ? 'default' : 'secondary'}>
                      {je.status === 'posted' ? <Lock className="mr-1 h-3 w-3" /> : <Unlock className="mr-1 h-3 w-3" />}
                      {je.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Date: {je.date.toLocaleDateString('en-IN')}</span>
                    {je.reference && <span>Ref: {je.reference}</span>}
                    <span>By: {je.createdBy}</span>
                    {je.approvedBy && <span>Approved: {je.approvedBy}</span>}
                  </div>
                  <table className="w-full">
                    <thead><tr className="border-b"><th className="py-1.5 text-left text-xs text-muted-foreground">Code</th><th className="py-1.5 text-left text-xs text-muted-foreground">Account</th><th className="py-1.5 text-right text-xs text-muted-foreground">Debit</th><th className="py-1.5 text-right text-xs text-muted-foreground">Credit</th></tr></thead>
                    <tbody>
                      {je.accounts.map((acc, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 text-sm text-muted-foreground">{acc.accountCode}</td>
                          <td className="py-1.5 text-sm text-foreground">{acc.accountName}</td>
                          <td className="py-1.5 text-right text-sm text-foreground">{acc.debitAmount ? formatCurrency(acc.debitAmount) : '-'}</td>
                          <td className="py-1.5 text-right text-sm text-foreground">{acc.creditAmount ? formatCurrency(acc.creditAmount) : '-'}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold">
                        <td colSpan={2} className="py-1.5 text-sm">Total</td>
                        <td className="py-1.5 text-right text-sm">{formatCurrency(je.totalDebit)}</td>
                        <td className="py-1.5 text-right text-sm">{formatCurrency(je.totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {je.status === 'draft' && (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button size="sm">Post Entry</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="ledger">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">General Ledger</h3>
              <p className="text-sm text-muted-foreground">View chart of accounts and transaction history per account</p>
              <Button className="mt-4">Open Ledger</Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="statements">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { title: 'Balance Sheet', desc: 'Assets, liabilities, and equity position', icon: FileText },
                { title: 'Income & Expenditure', desc: 'Revenue vs expenses for the period', icon: Calculator },
                { title: 'Cash Flow Statement', desc: 'Operating, investing, financing activities', icon: BookOpen },
              ].map((s) => (
                <Card key={s.title} className="cursor-pointer hover:bg-muted/30">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <s.icon className="h-12 w-12 text-primary/50" />
                    <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                    <Button variant="outline" size="sm" className="mt-4">Generate</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="closing">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <Lock className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">Book Closing</h3>
              <p className="text-sm text-muted-foreground">Close monthly/annual books and freeze period entries</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline">Close March 2026</Button>
                <Button>Annual Closing (FY 2025-26)</Button>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}