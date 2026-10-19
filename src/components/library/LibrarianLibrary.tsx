import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';
import { BookOpen, Search, Plus, Undo2, RotateCcw, Loader2, BadgeIndianRupee } from 'lucide-react';

/**
 * Librarian circulation desk.
 *
 * REWRITTEN after the library API migration (T-203b) changed its contract and
 * left this screen broken. What changed, and why the screen looks different:
 *
 *  - A row is now a PHYSICAL COPY identified by accession number, not a title.
 *    A library can hold several copies of one ISBN; previously it could not.
 *
 *  - Borrower, due date and fine belong to the LOAN, not the copy. They are
 *    nested under `loan`, which is null when the copy is on the shelf.
 *
 *  - THE FINE INPUT IS GONE. This screen used to post a librarian-typed fine to
 *    the server, which accepted it unchallenged — so whoever was at the desk
 *    decided what a student owed, with no calculation and no record. The fine is
 *    now computed from the institution's circulation policy and shown read-only.
 *    Reducing one is a separate, audited action that requires a reason.
 *
 *  - Overdue is derived from the due date rather than being a stored status, so
 *    it is no longer possible for a book to be overdue and not say so.
 */

type CopyStatus = 'available' | 'issued' | 'lost' | 'damaged' | 'withdrawn';

interface ActiveLoan {
  id: string;
  studentName: string;
  rollNumber: string;
  dueAt?: Date;
  overdue: boolean;
  accruedFine: number;
}

interface LibraryCopy {
  id: string;
  accessionNumber: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  status: string;
  loan: ActiveLoan | null;
}

interface BorrowerOption {
  id: string;
  rollNumber: string;
  name: string;
  openLoans: number;
}

interface LibraryDashboardData {
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueLoans: number;
  outstandingFines: number;
  activeBorrowers: number;
}

const defaultDashboard: LibraryDashboardData = {
  totalCopies: 0,
  availableCopies: 0,
  issuedCopies: 0,
  overdueLoans: 0,
  outstandingFines: 0,
  activeBorrowers: 0,
};

function normalizeCopy(raw: any): LibraryCopy {
  const loan = raw?.loan;
  return {
    id: safeString(raw?.id),
    accessionNumber: safeString(raw?.accessionNumber),
    isbn: safeString(raw?.isbn),
    title: safeString(raw?.title),
    author: safeString(raw?.author),
    category: safeString(raw?.category),
    status: safeString(raw?.status),
    loan: loan
      ? {
          id: safeString(loan.id),
          studentName: safeString(loan.studentName),
          rollNumber: safeString(loan.rollNumber),
          dueAt: loan.dueAt ? safeDate(loan.dueAt) : undefined,
          overdue: Boolean(loan.overdue),
          accruedFine: safeNumber(loan.accruedFine),
        }
      : null,
  };
}

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Status badge for a copy.
 *
 * Overdue is a property of the loan, not the copy, so it is passed separately
 * rather than read from `status` — which is what made the old overdue count
 * permanently zero.
 */
function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge variant="destructive">Overdue</Badge>;
  const value = status.toLowerCase();
  if (value === 'available') return <Badge className="bg-success/10 text-success">On shelf</Badge>;
  if (value === 'issued') return <Badge className="bg-info/10 text-info">Issued</Badge>;
  if (value === 'lost') return <Badge variant="destructive">Lost</Badge>;
  if (value === 'damaged') return <Badge variant="destructive">Damaged</Badge>;
  if (value === 'withdrawn') return <Badge variant="secondary">Withdrawn</Badge>;
  return <Badge variant="outline">{status || 'Unknown'}</Badge>;
}

/** Shown instead of a blank table body, so an empty result reads as an answer. */
function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export default function LibrarianLibrary({ initialTab = 'catalog' }: { initialTab?: 'catalog' | 'circulation' | 'acquisitions' }) {
  const [tab, setTab] = useState<'catalog' | 'circulation' | 'acquisitions'>(initialTab);
  const [dashboard, setDashboard] = useState<LibraryDashboardData>(defaultDashboard);
  const [copies, setCopies] = useState<LibraryCopy[]>([]);
  const [borrowers, setBorrowers] = useState<BorrowerOption[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CopyStatus>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState<LibraryCopy | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [actionCopyId, setActionCopyId] = useState<string | null>(null);

  const [waiveTarget, setWaiveTarget] = useState<LibraryCopy | null>(null);
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');

  const [createForm, setCreateForm] = useState({
    accessionNumber: '',
    isbn: '',
    title: '',
    author: '',
    category: '',
    publisher: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetched independently rather than through one Promise.all: when the
      // borrower lookup failed, an all-or-nothing load blanked the whole screen
      // and reported only "failed to load".
      const [dashboardResult, copiesResult, borrowersResult] = await Promise.allSettled([
        fetchApi<LibraryDashboardData>('/library/dashboard'),
        fetchApi<any[]>('/library/books?pageSize=100'),
        fetchApi<any[]>('/library/students?pageSize=100'),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setDashboard(dashboardResult.value || defaultDashboard);
      }

      if (copiesResult.status === 'fulfilled') {
        setCopies(safeArray<any>(copiesResult.value).map(normalizeCopy));
      } else {
        // The catalogue is the screen's reason to exist; its failure is the one
        // worth surfacing prominently.
        setLoadError(safeString((copiesResult.reason as any)?.message, 'The catalogue could not be loaded.'));
      }

      if (borrowersResult.status === 'fulfilled') {
        setBorrowers(
          safeArray<any>(borrowersResult.value).map((item: any) => ({
            id: safeString(item?.id),
            rollNumber: safeString(item?.rollNumber),
            name: safeString(item?.name),
            openLoans: safeNumber(item?.openLoans),
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filteredCopies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return copies.filter((copy) => {
      const statusOk = statusFilter === 'all' || copy.status === statusFilter;
      const haystack = [
        copy.title,
        copy.author,
        copy.isbn,
        copy.accessionNumber,
        copy.category,
        copy.loan?.studentName ?? '',
        copy.loan?.rollNumber ?? '',
      ];
      const queryOk = !query || haystack.some((value) => value.toLowerCase().includes(query));
      return statusOk && queryOk;
    });
  }, [copies, search, statusFilter]);

  const onLoan = useMemo(() => copies.filter((copy) => copy.loan !== null), [copies]);

  /** Surface the API's own message — it explains what to do about the failure. */
  const reportFailure = (title: string, error: any, fallback: string) => {
    toast({
      title,
      description: safeString(error?.message, fallback),
      variant: 'destructive',
    });
  };

  const createCopy = async () => {
    try {
      await postApi('/library/books', {
        accessionNumber: createForm.accessionNumber,
        isbn: createForm.isbn,
        title: createForm.title,
        author: createForm.author,
        category: createForm.category,
        ...(createForm.publisher ? { publisher: createForm.publisher } : {}),
      });
      toast({ title: 'Copy catalogued', description: `${createForm.title} added as ${createForm.accessionNumber}.` });
      setIsCreateOpen(false);
      setCreateForm({ accessionNumber: '', isbn: '', title: '', author: '', category: '', publisher: '' });
      await loadData();
    } catch (error: any) {
      reportFailure('Could not catalogue this copy', error, 'Check the details and try again.');
    }
  };

  const issueCopy = async () => {
    if (!selectedCopy) return;
    if (!selectedStudentId) {
      toast({ title: 'Choose a borrower', description: 'Select a student before issuing.', variant: 'destructive' });
      return;
    }

    try {
      setActionCopyId(selectedCopy.id);
      // No due date is sent: the loan period comes from the institution's
      // circulation policy, so the desk cannot quietly extend it per issue.
      const result: any = await postApi(`/library/books/${selectedCopy.id}/issue`, {
        studentProfileId: selectedStudentId,
      });
      // `postApi` unwraps to the `data` object, so the envelope's message is not
      // available here — the description is built from the returned fields.
      const due = result?.dueAt ? safeDate(result.dueAt).toLocaleDateString('en-IN') : null;
      toast({
        title: 'Issued',
        description: due
          ? `${selectedCopy.title} issued to ${safeString(result?.rollNumber)} — due ${due}.`
          : `${selectedCopy.title} issued.`,
      });
      setIsIssueOpen(false);
      setSelectedCopy(null);
      setSelectedStudentId('');
      await loadData();
    } catch (error: any) {
      reportFailure('Could not issue this copy', error, 'Unable to issue.');
    } finally {
      setActionCopyId(null);
    }
  };

  const renewCopy = async (copy: LibraryCopy) => {
    try {
      setActionCopyId(copy.id);
      const result: any = await postApi(`/library/books/${copy.id}/renew`, {});
      const due = result?.dueAt ? safeDate(result.dueAt).toLocaleDateString('en-IN') : null;
      toast({
        title: 'Renewed',
        description: due
          ? `Due ${due} — renewal ${safeNumber(result?.renewalCount)} of ${safeNumber(result?.maxRenewals)}.`
          : `${copy.title} renewed.`,
      });
      await loadData();
    } catch (error: any) {
      // The server explains refusals precisely — renewal limit reached, or the
      // loan is already overdue and must be returned. Show that, not a generic
      // failure.
      reportFailure('Could not renew', error, 'Unable to renew this loan.');
    } finally {
      setActionCopyId(null);
    }
  };

  const returnCopy = async (copy: LibraryCopy) => {
    try {
      setActionCopyId(copy.id);
      // Empty body. The fine is computed server-side from days overdue and the
      // institution's rate — this screen no longer decides it.
      const result: any = await postApi(`/library/books/${copy.id}/return`, {});
      // The server returns its own derivation of the fine. Showing it means a
      // student who disputes a charge can be told how it was calculated.
      toast({
        title: 'Returned',
        description: safeString(result?.fineExplanation, `${copy.title} returned.`),
      });
      await loadData();
    } catch (error: any) {
      reportFailure('Could not return', error, 'Unable to return this copy.');
    } finally {
      setActionCopyId(null);
    }
  };

  const waiveFine = async () => {
    if (!waiveTarget?.loan) return;
    const amount = Number(waiveAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Enter an amount', description: 'The amount to waive must be greater than zero.', variant: 'destructive' });
      return;
    }
    if (waiveReason.trim().length < 10) {
      toast({
        title: 'A reason is required',
        description: 'Give at least 10 characters. A written-off charge with no recorded reason is an audit finding.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setActionCopyId(waiveTarget.id);
      const result: any = await postApi(`/library/loans/${waiveTarget.loan.id}/waive-fine`, {
        amount,
        reason: waiveReason.trim(),
      });
      toast({
        title: 'Fine waived',
        description: `Waived ${formatInr(safeNumber(result?.waived))}; ${formatInr(safeNumber(result?.remaining))} remains.`,
      });
      setWaiveTarget(null);
      setWaiveAmount('');
      setWaiveReason('');
      await loadData();
    } catch (error: any) {
      reportFailure('Could not waive this fine', error, 'Unable to waive.');
    } finally {
      setActionCopyId(null);
    }
  };

  const canCreate =
    createForm.accessionNumber.trim() !== '' &&
    createForm.isbn.trim() !== '' &&
    createForm.title.trim() !== '' &&
    createForm.author.trim() !== '' &&
    createForm.category.trim() !== '';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Library Operations</h1>
            <p className="page-description">Catalogue, circulation and acquisitions</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add copy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a copy to the catalogue</DialogTitle>
                  <DialogDescription>
                    Each physical copy has its own accession number. Two copies of the same
                    title share an ISBN and differ by accession number.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Accession number (e.g. ACC-000123)"
                    value={createForm.accessionNumber}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, accessionNumber: e.target.value }))}
                  />
                  <Input placeholder="ISBN" value={createForm.isbn} onChange={(e) => setCreateForm((prev) => ({ ...prev, isbn: e.target.value }))} />
                  <Input placeholder="Title" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
                  <Input placeholder="Author" value={createForm.author} onChange={(e) => setCreateForm((prev) => ({ ...prev, author: e.target.value }))} />
                  <Input placeholder="Category" value={createForm.category} onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))} />
                  <Input placeholder="Publisher (optional)" value={createForm.publisher} onChange={(e) => setCreateForm((prev) => ({ ...prev, publisher: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={createCopy} disabled={!canCreate}>Add copy</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </div>

        {loadError ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm">
              <p className="font-medium text-destructive">The catalogue could not be loaded</p>
              <p className="mt-1 text-muted-foreground">{loadError}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Copies held</p>
              <p className="text-3xl font-bold">{dashboard.totalCopies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">On shelf</p>
              <p className="text-3xl font-bold text-success">{dashboard.availableCopies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">On loan</p>
              <p className="text-3xl font-bold text-info">{dashboard.issuedCopies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-3xl font-bold text-destructive">{dashboard.overdueLoans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Fines outstanding</p>
              <p className="text-3xl font-bold">{formatInr(dashboard.outstandingFines)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="catalog">Catalogue</TabsTrigger>
            <TabsTrigger value="circulation">Circulation</TabsTrigger>
            <TabsTrigger value="acquisitions">Recent additions</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Catalogue</CardTitle>
                <CardDescription>Every physical copy, by accession number.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr,200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search title, author, ISBN, accession number or borrower"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | CopyStatus)}
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="available">On shelf</option>
                    <option value="issued">On loan</option>
                    <option value="lost">Lost</option>
                    <option value="damaged">Damaged</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Accession</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <EmptyRow colSpan={6} message="Loading the catalogue…" />
                    ) : filteredCopies.length === 0 ? (
                      <EmptyRow
                        colSpan={6}
                        message={
                          copies.length === 0
                            ? 'No copies catalogued yet. Use “Add copy” to start.'
                            : 'No copies match this search.'
                        }
                      />
                    ) : (
                      filteredCopies.map((copy) => (
                        <TableRow key={copy.id}>
                          <TableCell>
                            <p className="font-medium">{copy.title}</p>
                            <p className="text-xs text-muted-foreground">{copy.author} • {copy.category}</p>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{copy.accessionNumber}</TableCell>
                          <TableCell><StatusBadge status={copy.status} overdue={copy.loan?.overdue} /></TableCell>
                          <TableCell>
                            {copy.loan ? `${copy.loan.studentName} (${copy.loan.rollNumber})` : '—'}
                          </TableCell>
                          <TableCell>{copy.loan?.dueAt ? copy.loan.dueAt.toLocaleDateString('en-IN') : '—'}</TableCell>
                          <TableCell className="text-right">
                            {copy.status === 'available' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCopy(copy);
                                  setIsIssueOpen(true);
                                }}
                              >
                                Issue
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {copy.loan ? 'On loan' : copy.status}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="circulation">
            <Card>
              <CardHeader>
                <CardTitle>Circulation desk</CardTitle>
                <CardDescription>
                  Fines are calculated from the institution's circulation policy — days overdue
                  beyond the grace period, at the recorded daily rate.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Fine accrued</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <EmptyRow colSpan={5} message="Loading loans…" />
                    ) : onLoan.length === 0 ? (
                      <EmptyRow colSpan={5} message="Nothing is currently on loan." />
                    ) : (
                      onLoan.map((copy) => (
                        <TableRow key={copy.id}>
                          <TableCell>
                            <p className="font-medium">{copy.title}</p>
                            <p className="font-mono text-xs text-muted-foreground">{copy.accessionNumber}</p>
                          </TableCell>
                          <TableCell>
                            {copy.loan?.studentName}
                            <span className="block text-xs text-muted-foreground">{copy.loan?.rollNumber}</span>
                          </TableCell>
                          <TableCell>
                            {copy.loan?.dueAt ? copy.loan.dueAt.toLocaleDateString('en-IN') : '—'}
                            {copy.loan?.overdue ? (
                              <Badge variant="destructive" className="ml-2">Overdue</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {copy.loan && copy.loan.accruedFine > 0 ? (
                              <span className="font-medium text-destructive">{formatInr(copy.loan.accruedFine)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              {copy.loan && copy.loan.accruedFine > 0 ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={actionCopyId === copy.id}
                                  onClick={() => {
                                    setWaiveTarget(copy);
                                    setWaiveAmount(String(copy.loan?.accruedFine ?? ''));
                                    setWaiveReason('');
                                  }}
                                >
                                  <BadgeIndianRupee className="mr-1 h-3 w-3" />
                                  Waive
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionCopyId === copy.id || Boolean(copy.loan?.overdue)}
                                title={copy.loan?.overdue ? 'An overdue loan must be returned, not renewed' : undefined}
                                onClick={() => void renewCopy(copy)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Renew
                              </Button>
                              <Button
                                size="sm"
                                disabled={actionCopyId === copy.id}
                                onClick={() => void returnCopy(copy)}
                              >
                                <Undo2 className="mr-1 h-3 w-3" />
                                Return
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acquisitions">
            <Card>
              <CardHeader>
                <CardTitle>Recent additions</CardTitle>
                <CardDescription>The most recently catalogued copies.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {copies.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nothing catalogued yet.
                  </p>
                ) : (
                  copies.slice(0, 8).map((copy) => (
                    <div key={copy.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{copy.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {copy.author} • {copy.category} • {copy.isbn} • {copy.accessionNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <StatusBadge status={copy.status} overdue={copy.loan?.overdue} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Issue */}
        <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue a copy</DialogTitle>
              <DialogDescription>
                The loan period comes from the institution's circulation policy, so no due
                date is set here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{selectedCopy?.title || 'No copy selected'}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedCopy?.accessionNumber} • {selectedCopy?.isbn}
                </p>
              </div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                aria-label="Borrower"
              >
                <option value="">Select a borrower</option>
                {borrowers.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.rollNumber} — {student.name}
                    {student.openLoans > 0 ? ` (${student.openLoans} on loan)` : ''}
                  </option>
                ))}
              </select>
              {borrowers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No borrowers could be loaded. Refresh, or check that students are enrolled.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIssueOpen(false)}>Cancel</Button>
              <Button onClick={issueCopy} disabled={!selectedCopy || actionCopyId === selectedCopy?.id}>
                Issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Waive a fine — separate and audited, replacing the old free-text fine box */}
        <Dialog open={waiveTarget !== null} onOpenChange={(open) => { if (!open) setWaiveTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Waive a fine</DialogTitle>
              <DialogDescription>
                This is recorded against your account with the reason you give. A written-off
                charge with no recorded justification is an audit finding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{waiveTarget?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {waiveTarget?.loan?.studentName} ({waiveTarget?.loan?.rollNumber}) •
                  {' '}accrued {formatInr(waiveTarget?.loan?.accruedFine ?? 0)}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount to waive"
                value={waiveAmount}
                onChange={(e) => setWaiveAmount(e.target.value)}
                aria-label="Amount to waive"
              />
              <Textarea
                placeholder="Reason (at least 10 characters)"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                aria-label="Reason for waiving"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWaiveTarget(null)}>Cancel</Button>
              <Button onClick={waiveFine} disabled={actionCopyId === waiveTarget?.id}>Waive fine</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
