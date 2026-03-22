import { useState, useEffect } from 'react';
import { 
  Library, BookOpen, Search, Clock, AlertCircle, 
  RefreshCw, Calendar, Filter, BookMarked, History,
  QrCode, CheckCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { fetchApi, postApi } from '@/lib/apiService';
import { cn } from '@/lib/utils';
import { safeArray, safeDate, safeNumber, safeString } from '@/lib/normalize';
import { toast } from '@/hooks/use-toast';

export default function StudentLibrary() {
  const [libraryBooks, setLibraryBooks] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('borrowed');
  const [renewingBookId, setRenewingBookId] = useState<string | null>(null);

  const normalizeBook = (raw: any) => ({
    id: safeString(raw?.id),
    isbn: safeString(raw?.isbn),
    title: safeString(raw?.title),
    author: safeString(raw?.author),
    category: safeString(raw?.category),
    issuedDate: safeDate(raw?.issuedDate),
    dueDate: safeDate(raw?.dueDate),
    returnedDate: raw?.returnedDate ? safeDate(raw.returnedDate) : undefined,
    fine: safeNumber(raw?.fine),
    renewalCount: safeNumber(raw?.renewalCount),
    maxRenewals: safeNumber(raw?.maxRenewals),
    status: safeString(raw?.status),
  });

  useEffect(() => {
    fetchApi('/students/library')
      .then((d) => setLibraryBooks(safeArray(d).map(normalizeBook)))
      .catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');

  const issuedBooks = libraryBooks.filter(b => b.status === 'issued');
  const overdueBooks = libraryBooks.filter(b => b.status === 'overdue');
  const returnedBooks = libraryBooks.filter(b => b.status === 'returned');
  const totalFines = libraryBooks.reduce((sum, b) => sum + (b.fine || 0), 0);
  const catalogResults = libraryBooks.filter((book) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return false;
    return [book.title, book.author, book.isbn, book.category].some((value) =>
      safeString(value).toLowerCase().includes(query)
    );
  });

  const getDaysRemaining = (dueDate: Date) => {
    const today = new Date();
    const diff = dueDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (status: string, dueDate?: Date) => {
    if (status === 'issued' && dueDate) {
      const days = getDaysRemaining(dueDate);
      if (days < 0) {
        return <Badge variant="destructive">Overdue ({Math.abs(days)} days)</Badge>;
      }
      if (days <= 3) {
        return <Badge className="bg-warning/10 text-warning">Due Soon ({days} days)</Badge>;
      }
    }
    
    switch (status) {
      case 'issued':
        return <Badge className="bg-info/10 text-info">Issued</Badge>;
      case 'returned':
        return <Badge className="bg-success/10 text-success">Returned</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'reserved':
        return <Badge className="bg-primary/10 text-primary">Reserved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCardDownload = () => {
    const cardText = [
      'Campus Harmony ERP - Library Card',
      '',
      `Issued Books: ${issuedBooks.length}`,
      `Outstanding Fine: INR ${totalFines}`,
      `Generated On: ${new Date().toLocaleString()}`
    ].join('\n');

    const blob = new Blob([cardText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'library_card.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleRenew = async (book: any) => {
    try {
      setRenewingBookId(book.id);
      const updated = await postApi(`/students/library/${book.id}/renew`, {});
      setLibraryBooks((prev) => prev.map((item) => item.id === book.id ? normalizeBook(updated) : item));
      toast({ title: 'Book renewed', description: `${book.title} renewed successfully.` });
    } catch (error: any) {
      toast({ title: 'Renewal failed', description: safeString(error?.message, 'Unable to renew this book.'), variant: 'destructive' });
    } finally {
      setRenewingBookId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Library</h1>
            <p className="page-description">Manage your library books and search catalog</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCardDownload}>
              <QrCode className="mr-2 h-4 w-4" />
              My Library Card
            </Button>
            <Button onClick={() => setActiveTab('search')}>
              <Search className="mr-2 h-4 w-4" />
              Search Catalog
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Books Borrowed</p>
                <p className="text-3xl font-bold">{issuedBooks.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </CardContent>
          </Card>
          <Card className={cn(overdueBooks.length > 0 && 'border-destructive/50')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className={cn('text-3xl font-bold', overdueBooks.length > 0 ? 'text-destructive' : 'text-success')}>
                  {overdueBooks.length}
                </p>
              </div>
              <AlertCircle className={cn('h-8 w-8', overdueBooks.length > 0 ? 'text-destructive' : 'text-success')} />
            </CardContent>
          </Card>
          <Card className={cn(totalFines > 0 && 'border-warning/50')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Fine</p>
                <p className={cn('text-3xl font-bold', totalFines > 0 ? 'text-warning' : 'text-success')}>
                  ₹{totalFines}
                </p>
              </div>
              <Clock className={cn('h-8 w-8', totalFines > 0 ? 'text-warning' : 'text-success')} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Max Allowed</p>
                <p className="text-3xl font-bold">5</p>
              </div>
              <BookMarked className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="borrowed" className="relative">
              Currently Borrowed
              {issuedBooks.length > 0 && (
                <span className="ml-2 text-xs">({issuedBooks.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Borrowing History</TabsTrigger>
            <TabsTrigger value="search">Search Catalog</TabsTrigger>
          </TabsList>

          {/* Currently Borrowed */}
          <TabsContent value="borrowed" className="space-y-4">
            {issuedBooks.length > 0 ? (
              <div className="space-y-4">
                {issuedBooks.map((book) => {
                  const daysLeft = getDaysRemaining(book.dueDate);
                  const isNearDue = daysLeft <= 3 && daysLeft >= 0;
                  const isOverdue = daysLeft < 0;
                  
                  return (
                    <Card key={book.id} className={cn(
                      isOverdue && 'border-destructive/50',
                      isNearDue && !isOverdue && 'border-warning/50'
                    )}>
                      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-16 w-12 items-center justify-center rounded bg-muted">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-sm text-muted-foreground">by {book.author}</p>
                            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>ISBN: {book.isbn}</span>
                              <Badge variant="outline">{book.category}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 md:items-end">
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Due Date</p>
                              <p className={cn(
                                'font-medium',
                                isOverdue ? 'text-destructive' : isNearDue ? 'text-warning' : ''
                              )}>
                                {book.dueDate.toLocaleDateString()}
                              </p>
                            </div>
                            {getStatusBadge(book.status, book.dueDate)}
                          </div>
                          <div className="flex gap-2">
                            {book.renewalCount < book.maxRenewals && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRenew(book)}
                                disabled={renewingBookId === book.id}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {renewingBookId === book.id
                                  ? 'Renewing...'
                                  : `Renew (${book.maxRenewals - book.renewalCount} left)`}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No Books Borrowed</p>
                  <p className="text-sm text-muted-foreground">Visit the library to borrow books</p>
                  <Button className="mt-4" onClick={() => setActiveTab('search')}>
                    <Search className="mr-2 h-4 w-4" />
                    Search Catalog
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Borrowing History */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Borrowing History</CardTitle>
                <CardDescription>Your past library transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Issued On</TableHead>
                      <TableHead>Returned On</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnedBooks.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell className="font-medium">{book.title}</TableCell>
                        <TableCell>{book.author}</TableCell>
                        <TableCell>{book.issuedDate.toLocaleDateString()}</TableCell>
                        <TableCell>{book.returnedDate?.toLocaleDateString() || '-'}</TableCell>
                        <TableCell>
                          {book.fine ? (
                            <span className="text-warning">₹{book.fine}</span>
                          ) : (
                            <span className="text-success">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(book.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Catalog */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>Library Catalog</CardTitle>
                <CardDescription>Search for books, journals, and e-resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, author, ISBN, or keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setActiveTab('search')}>Search</Button>
                </div>
                {catalogResults.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {catalogResults.map((book) => (
                      <div key={book.id} className="rounded-lg border p-3">
                        <p className="font-medium">{book.title}</p>
                        <p className="text-sm text-muted-foreground">{book.author} • {book.category}</p>
                        <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
                    <Library className="h-16 w-16 text-muted-foreground" />
                    <p className="mt-4 text-lg font-medium">Search Our Collection</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Enter a title, author, ISBN, or category to find matching resources.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
