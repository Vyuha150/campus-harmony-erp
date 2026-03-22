import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';
import { BookOpen, Search, Plus, Undo2, RotateCcw, Loader2 } from 'lucide-react';

type LibraryStatus = 'available' | 'issued' | 'overdue' | 'returned';

interface LibrarianBook {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  status: string;
  fine: number;
  renewalCount: number;
  maxRenewals: number;
  issuedDate?: Date;
  dueDate?: Date;
  returnedDate?: Date;
  studentProfileId?: string;
  studentName?: string | null;
  studentRollNumber?: string | null;
}

interface StudentOption {
  id: string;
  rollNumber: string;
  name: string;
}

interface LibraryDashboardData {
  totalBooks: number;
  availableBooks: number;
  issuedBooks: number;
  overdueBooks: number;
  collectedFines: number;
}

const defaultDashboard: LibraryDashboardData = {
  totalBooks: 0,
  availableBooks: 0,
  issuedBooks: 0,
  overdueBooks: 0,
  collectedFines: 0,
};

function normalizeBook(raw: any): LibrarianBook {
  return {
    id: safeString(raw?.id),
    isbn: safeString(raw?.isbn),
    title: safeString(raw?.title),
    author: safeString(raw?.author),
    category: safeString(raw?.category),
    status: safeString(raw?.status),
    fine: safeNumber(raw?.fine),
    renewalCount: safeNumber(raw?.renewalCount),
    maxRenewals: safeNumber(raw?.maxRenewals),
    issuedDate: raw?.issuedDate ? safeDate(raw.issuedDate) : undefined,
    dueDate: raw?.dueDate ? safeDate(raw.dueDate) : undefined,
    returnedDate: raw?.returnedDate ? safeDate(raw.returnedDate) : undefined,
    studentProfileId: safeString(raw?.studentProfileId),
    studentName: raw?.studentName ? safeString(raw.studentName) : null,
    studentRollNumber: raw?.studentRollNumber ? safeString(raw.studentRollNumber) : null,
  };
}

function getStatusBadge(status: string) {
  const value = status.toLowerCase();
  if (value === 'available') return <Badge className="bg-success/10 text-success">Available</Badge>;
  if (value === 'issued') return <Badge className="bg-info/10 text-info">Issued</Badge>;
  if (value === 'overdue') return <Badge variant="destructive">Overdue</Badge>;
  if (value === 'returned') return <Badge variant="secondary">Returned</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function LibrarianLibrary({ initialTab = 'catalog' }: { initialTab?: 'catalog' | 'circulation' | 'acquisitions' }) {
  const [tab, setTab] = useState<'catalog' | 'circulation' | 'acquisitions'>(initialTab);
  const [dashboard, setDashboard] = useState<LibraryDashboardData>(defaultDashboard);
  const [books, setBooks] = useState<LibrarianBook[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LibraryStatus>('all');
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [selectedIssueBook, setSelectedIssueBook] = useState<LibrarianBook | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [fineByBookId, setFineByBookId] = useState<Record<string, string>>({});
  const [actionBookId, setActionBookId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    isbn: '',
    title: '',
    author: '',
    category: '',
    maxRenewals: '2',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardData, booksData, studentsData] = await Promise.all([
        fetchApi<LibraryDashboardData>('/library/dashboard'),
        fetchApi<any[]>('/library/books'),
        fetchApi<any[]>('/library/students')
      ]);

      setDashboard(dashboardData || defaultDashboard);
      setBooks(safeArray(booksData).map(normalizeBook));
      setStudents(
        safeArray<any>(studentsData).map((item: any) => ({
          id: safeString(item?.id),
          rollNumber: safeString(item?.rollNumber),
          name: safeString(item?.user?.name),
        }))
      );
    } catch (error: any) {
      toast({ title: 'Failed to load library data', description: safeString(error?.message, 'Please retry.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return books.filter((book) => {
      const statusOk = statusFilter === 'all' || book.status === statusFilter;
      const queryOk = !query || [book.title, book.author, book.isbn, book.category, book.studentName || '', book.studentRollNumber || '']
        .some((value) => value.toLowerCase().includes(query));
      return statusOk && queryOk;
    });
  }, [books, search, statusFilter]);

  const circulationBooks = useMemo(
    () => books.filter((book) => book.status === 'issued' || book.status === 'overdue'),
    [books]
  );

  const createBook = async () => {
    try {
      const payload = {
        isbn: createForm.isbn,
        title: createForm.title,
        author: createForm.author,
        category: createForm.category,
        maxRenewals: Number(createForm.maxRenewals),
      };
      await postApi('/library/books', payload);
      toast({ title: 'Book added', description: `${createForm.title} has been added to catalog.` });
      setIsCreateOpen(false);
      setCreateForm({ isbn: '', title: '', author: '', category: '', maxRenewals: '2' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Unable to add book', description: safeString(error?.message, 'Please check the details and retry.'), variant: 'destructive' });
    }
  };

  const issueBook = async () => {
    if (!selectedIssueBook) return;
    if (!selectedStudentId) {
      toast({ title: 'Select a student', description: 'Choose a student before issuing the book.', variant: 'destructive' });
      return;
    }

    try {
      setActionBookId(selectedIssueBook.id);
      await postApi(`/library/books/${selectedIssueBook.id}/issue`, {
        studentProfileId: selectedStudentId,
        dueDate: dueDate || undefined,
      });
      toast({ title: 'Book issued', description: `${selectedIssueBook.title} issued successfully.` });
      setIsIssueOpen(false);
      setSelectedIssueBook(null);
      setSelectedStudentId('');
      setDueDate('');
      await loadData();
    } catch (error: any) {
      toast({ title: 'Issue failed', description: safeString(error?.message, 'Unable to issue this book.'), variant: 'destructive' });
    } finally {
      setActionBookId(null);
    }
  };

  const renewBook = async (book: LibrarianBook) => {
    try {
      setActionBookId(book.id);
      await postApi(`/library/books/${book.id}/renew`, {});
      toast({ title: 'Book renewed', description: `${book.title} renewed.` });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Renew failed', description: safeString(error?.message, 'Unable to renew this book.'), variant: 'destructive' });
    } finally {
      setActionBookId(null);
    }
  };

  const returnBook = async (book: LibrarianBook) => {
    try {
      setActionBookId(book.id);
      await postApi(`/library/books/${book.id}/return`, {
        fine: Number(fineByBookId[book.id] || '0')
      });
      toast({ title: 'Book returned', description: `${book.title} marked as returned.` });
      setFineByBookId((prev) => ({ ...prev, [book.id]: '' }));
      await loadData();
    } catch (error: any) {
      toast({ title: 'Return failed', description: safeString(error?.message, 'Unable to return this book.'), variant: 'destructive' });
    } finally {
      setActionBookId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Library Operations</h1>
            <p className="page-description">Catalog, circulation, and acquisition workflows for librarian role</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Book to Catalog</DialogTitle>
                  <DialogDescription>Creates a new catalog record using /library/books.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="ISBN" value={createForm.isbn} onChange={(e) => setCreateForm((prev) => ({ ...prev, isbn: e.target.value }))} />
                  <Input placeholder="Title" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
                  <Input placeholder="Author" value={createForm.author} onChange={(e) => setCreateForm((prev) => ({ ...prev, author: e.target.value }))} />
                  <Input placeholder="Category" value={createForm.category} onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))} />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max renewals"
                    value={createForm.maxRenewals}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, maxRenewals: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={createBook}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Books</p>
              <p className="text-3xl font-bold">{dashboard.totalBooks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-3xl font-bold text-success">{dashboard.availableBooks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Issued</p>
              <p className="text-3xl font-bold text-info">{dashboard.issuedBooks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-3xl font-bold text-destructive">{dashboard.overdueBooks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Outstanding Fines</p>
              <p className="text-3xl font-bold">INR {dashboard.collectedFines.toFixed(0)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="circulation">Circulation</TabsTrigger>
            <TabsTrigger value="acquisitions">Acquisitions</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Catalog Search</CardTitle>
                <CardDescription>Search and issue books using library APIs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr,200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search by title, author, category, ISBN, student" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | LibraryStatus)}
                  >
                    <option value="all">All statuses</option>
                    <option value="available">Available</option>
                    <option value="issued">Issued</option>
                    <option value="overdue">Overdue</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>ISBN</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBooks.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.author} • {book.category}</p>
                          </div>
                        </TableCell>
                        <TableCell>{book.isbn}</TableCell>
                        <TableCell>{getStatusBadge(book.status)}</TableCell>
                        <TableCell>{book.studentName ? `${book.studentName} (${book.studentRollNumber || 'N/A'})` : '-'}</TableCell>
                        <TableCell>{book.dueDate ? book.dueDate.toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-right">
                          {(book.status === 'available' || book.status === 'returned') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedIssueBook(book);
                                setIsIssueOpen(true);
                              }}
                            >
                              Issue
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">In circulation</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="circulation">
            <Card>
              <CardHeader>
                <CardTitle>Circulation Desk</CardTitle>
                <CardDescription>Renew and return issued/overdue books.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Renewals</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {circulationBooks.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{getStatusBadge(book.status)}</p>
                          </div>
                        </TableCell>
                        <TableCell>{book.studentName || '-'} {book.studentRollNumber ? `(${book.studentRollNumber})` : ''}</TableCell>
                        <TableCell>{book.dueDate ? book.dueDate.toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{book.renewalCount}/{book.maxRenewals}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24"
                            value={fineByBookId[book.id] ?? (book.fine > 0 ? String(book.fine) : '')}
                            onChange={(e) => setFineByBookId((prev) => ({ ...prev, [book.id]: e.target.value }))}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionBookId === book.id || book.renewalCount >= book.maxRenewals}
                              onClick={() => void renewBook(book)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Renew
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionBookId === book.id}
                              onClick={() => void returnBook(book)}
                            >
                              <Undo2 className="mr-1 h-3 w-3" />
                              Return
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acquisitions">
            <Card>
              <CardHeader>
                <CardTitle>Acquisitions</CardTitle>
                <CardDescription>Latest catalog additions and inventory state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {books.slice(0, 8).map((book) => (
                  <div key={book.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author} • {book.category} • {book.isbn}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        {getStatusBadge(book.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue Book</DialogTitle>
              <DialogDescription>Assign this catalog book to a student profile using /library/books/:id/issue.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{selectedIssueBook?.title || 'No book selected'}</p>
                <p className="text-xs text-muted-foreground">{selectedIssueBook?.isbn}</p>
              </div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.rollNumber} - {student.name}
                  </option>
                ))}
              </select>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIssueOpen(false)}>Cancel</Button>
              <Button onClick={issueBook} disabled={!selectedIssueBook || actionBookId === selectedIssueBook?.id}>Issue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
