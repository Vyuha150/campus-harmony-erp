import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Send } from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { ResultSummary } from '@/types/dean';

export default function COEResultSubmission() {
  const { toast } = useToast();
  const [results, setResults] = useState<ResultSummary[]>([]);

  useEffect(() => {
    fetchApi<ResultSummary[]>('/coe/results')
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('API request failed', error);
        toast({ title: 'Unable to load results', description: error?.message || 'Please retry', variant: 'destructive' });
      });
  }, [toast]);

  const submitForApproval = async (result: ResultSummary) => {
    const identifier = result.departmentId || result.department;
    try {
      await postApi(`/coe/results/${encodeURIComponent(identifier)}/submit`, {});
      setResults((prev) => prev.map((row) => ((row.departmentId || row.department) === identifier ? { ...row, status: 'pending_approval' } : row)));
      toast({ title: 'Submitted to Dean', description: `${result.department} results sent for approval.` });
    } catch (error: any) {
      toast({ title: 'Submission failed', description: error?.message || 'Unable to submit request', variant: 'destructive' });
    }
  };

  const pending = results.filter((row) => row.status === 'pending_approval').length;
  const published = results.filter((row) => row.status === 'published').length;
  const draft = results.filter((row) => row.status !== 'pending_approval' && row.status !== 'published').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">COE Result Submission</h1>
          <p className="text-muted-foreground">Submit department results to Dean for publication approval.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-7 w-7 text-amber-600" /><div><p className="text-xs text-muted-foreground">Pending Dean Approval</p><p className="text-2xl font-bold text-amber-600">{pending}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-7 w-7 text-green-600" /><div><p className="text-xs text-muted-foreground">Published</p><p className="text-2xl font-bold text-green-600">{published}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Send className="h-7 w-7 text-blue-600" /><div><p className="text-xs text-muted-foreground">Ready To Submit</p><p className="text-2xl font-bold text-blue-600">{draft}</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Department Result Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Pass %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.departmentId || row.department}>
                    <TableCell className="font-medium">{row.department}</TableCell>
                    <TableCell className="text-center">{row.totalStudents}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={row.passPercentage} className="h-1.5 w-16" />
                        <span className="text-xs">{row.passPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'published' ? 'default' : row.status === 'pending_approval' ? 'secondary' : 'outline'} className="capitalize">
                        {String(row.status || 'draft').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => submitForApproval(row)}
                        disabled={row.status === 'pending_approval' || row.status === 'published'}
                      >
                        <Send className="mr-1 h-4 w-4" />Submit To Dean
                      </Button>
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
