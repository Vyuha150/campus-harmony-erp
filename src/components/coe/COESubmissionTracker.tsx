import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi } from '@/lib/apiService';

type SubmissionItem = {
  id: string;
  department: string;
  status: string;
  requestedAt: string;
  requestedByName: string;
  title: string;
  priority: string;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export default function COESubmissionTracker() {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);

  useEffect(() => {
    fetchApi<SubmissionItem[]>('/coe/submissions')
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('API request failed', error);
        setSubmissions([]);
      });
  }, []);

  const summary = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter((item) => item.status === 'pending').length,
    published: submissions.filter((item) => item.status === 'published').length,
  }), [submissions]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">COE Submission Tracker</h1>
          <p className="text-muted-foreground">Track all result-publication requests sent for Dean approval.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Requests</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{summary.pending}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Published</p><p className="text-2xl font-bold text-green-600">{summary.published}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submission History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.department}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.requestedByName}</TableCell>
                    <TableCell>{formatDate(item.requestedAt)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{item.priority}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'published' ? 'default' : item.status === 'pending' ? 'secondary' : 'outline'} className="capitalize">
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
