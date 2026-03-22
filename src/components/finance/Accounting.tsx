import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Plus, Search, Lock, Unlock, Download, FileText, Calculator } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default function Accounting() {
  const [journalEntries, setJournalEntries] = useState<any>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadJournalEntries = async () => {
    const entries = await fetchApi('/finance/journal-entries');
    setJournalEntries(entries);
  };

  useEffect(() => {
    loadJournalEntries().catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const totalDebits = journalEntries.reduce((sum: number, je: any) => sum + Number(je.totalDebit || 0), 0);
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
    const formatDate = (value: any) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN');
    };

    const postEntry = async (id: string) => {
      try {
        await putApi(`/finance/journal-entries/${id}`, { status: 'posted' });
        setJournalEntries((prev: any[]) => prev.map((entry: any) => entry.id === id ? { ...entry, status: 'posted' } : entry));
        toast({ title: 'Entry posted', description: 'Journal entry has been posted.' });
      } catch (error) {
        console.error('Failed to post journal entry', error);
        toast({ title: 'Post failed', description: 'Could not post journal entry.', variant: 'destructive' });
      }
    };

    const createJournalEntry = async () => {
      const description = window.prompt('Journal description:', 'Manual adjustment entry');
      if (!description) return;
      const debit = Number(window.prompt('Total debit amount:', '1000') || 0);
      const credit = Number(window.prompt('Total credit amount:', '1000') || 0);
      if (debit <= 0 || credit <= 0 || debit !== credit) {
        toast({ title: 'Invalid entry', description: 'Debit and credit must be equal and greater than zero.', variant: 'destructive' });
        return;
      }

      try {
        const payload = {
          description,
          reference: `MAN-${Date.now()}`,
          totalDebit: debit,
          totalCredit: credit,
          status: 'draft',
          accounts: [
            { accountCode: '1001', accountName: 'Cash', debitAmount: debit, creditAmount: 0 },
            { accountCode: '2001', accountName: 'Adjustment', debitAmount: 0, creditAmount: credit },
          ],
        };
        await postApi<any>('/finance/journal-entries', payload);
        await loadJournalEntries();
        toast({ title: 'Journal created', description: 'Draft journal entry created successfully.' });
      } catch (error: any) {
        toast({ title: 'Create failed', description: error.message || 'Could not create journal entry.', variant: 'destructive' });
      }
    };

    const generateAccountingReport = async (type: string) => {
      try {
        await postApi('/finance/reports/generate', { type });
        toast({ title: 'Report generated', description: `${type} generated successfully.` });
      } catch (error: any) {
        toast({ title: 'Generation failed', description: error.message || 'Could not generate report.', variant: 'destructive' });
      }
    };

  const filteredEntries = journalEntries.filter((entry: any) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return String(entry.entryNumber || '').toLowerCase().includes(query)
      || String(entry.description || '').toLowerCase().includes(query)
      || String(entry.reference || '').toLowerCase().includes(query);
  });

  const totalCredits = journalEntries.reduce((sum: number, je: any) => sum + Number(je.totalCredit || 0), 0);
  const pendingEntries = journalEntries.filter((je: any) => String(je.status || '').toLowerCase() === 'draft').length;
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const booksStatus = pendingEntries > 0 ? 'Open' : 'Closed';

  const editEntry = async (entry: any) => {
    const description = window.prompt('Update description:', String(entry.description || ''));
    if (description === null) return;
    const reference = window.prompt('Update reference:', String(entry.reference || ''));
    if (reference === null) return;

    try {
      await putApi(`/finance/journal-entries/${entry.id}`, { description, reference });
      await loadJournalEntries();
      toast({ title: 'Entry updated', description: 'Journal entry updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message || 'Could not update journal entry.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounting & Ledger</h1>
            <p className="text-muted-foreground">Journal entries, book closing, and financial statements</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => generateAccountingReport('ledger_export')}><Download className="mr-2 h-4 w-4" />Export Ledger</Button>
            <Button size="sm" onClick={createJournalEntry}><Plus className="mr-2 h-4 w-4" />New Journal Entry</Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Debits</p><p className="text-2xl font-bold text-foreground">{formatCurrency(totalDebits)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Credits</p><p className="text-2xl font-bold text-foreground">{formatCurrency(totalCredits)}</p><p className={`text-xs ${balanced ? 'text-green-600' : 'text-amber-600'}`}>{balanced ? 'Balanced ✓' : 'Unbalanced'}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Entries</p><p className="text-2xl font-bold text-amber-600">{pendingEntries}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Books Status</p><p className="text-2xl font-bold text-foreground">{booksStatus}</p><p className="text-xs text-muted-foreground">Based on pending draft entries</p></CardContent></Card>
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
                <Input placeholder="Search journal entries..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            {filteredEntries.map((je) => (
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
                    <span>Date: {formatDate(je.date)}</span>
                    {je.reference && <span>Ref: {je.reference}</span>}
                    <span>By: {je.createdBy}</span>
                    {je.approvedBy && <span>Approved: {je.approvedBy}</span>}
                  </div>
                  <table className="w-full">
                    <thead><tr className="border-b"><th className="py-1.5 text-left text-xs text-muted-foreground">Code</th><th className="py-1.5 text-left text-xs text-muted-foreground">Account</th><th className="py-1.5 text-right text-xs text-muted-foreground">Debit</th><th className="py-1.5 text-right text-xs text-muted-foreground">Credit</th></tr></thead>
                    <tbody>
                      {toArray(je.accounts).map((acc: any, i: number) => (
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
                      <Button variant="outline" size="sm" onClick={() => editEntry(je)}>Edit</Button>
                      <Button size="sm" onClick={() => postEntry(je.id)}>Post Entry</Button>
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
              <Button className="mt-4" onClick={() => loadJournalEntries().then(() => toast({ title: 'Ledger refreshed', description: 'Journal entries synced from backend.' }))}>Refresh Ledger</Button>
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
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => generateAccountingReport(s.title)}>Generate</Button>
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
                <Button variant="outline" disabled>Close March 2026</Button>
                <Button disabled>Annual Closing (FY 2025-26)</Button>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}