import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Forward, XCircle } from 'lucide-react';
import { HODApprovalItem } from '@/types/hod';

export default function HODApprovals() {
  const { toast } = useToast();
  const [items, setItems] = useState<HODApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<HODApprovalItem[]>('/hod/hodapprovals')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('API request failed', error);
        toast({ title: 'Unable to load approvals', description: error?.message || 'Please retry', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const pending = useMemo(() => items.filter((item) => item.status === 'pending'), [items]);
  const processed = useMemo(() => items.filter((item) => item.status !== 'pending'), [items]);

  const updateStatus = async (id: string, status: HODApprovalItem['status']) => {
    try {
      await putApi(`/hod/hodapprovals/${id}/status`, { status });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      toast({ title: `Marked ${status}`, description: 'Approval status updated.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update status', variant: 'destructive' });
    }
  };

  const priorityVariant = (priority: HODApprovalItem['priority']) => {
    if (priority === 'high') return 'destructive';
    if (priority === 'medium') return 'secondary';
    return 'outline';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HOD Approvals</h1>
          <p className="text-muted-foreground">Review and process departmental approval requests.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Processed</p>
              <p className="text-2xl font-bold text-green-600">{processed.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {loading && <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading approvals...</CardContent></Card>}
            {!loading && pending.length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">No pending requests.</CardContent></Card>}
            {pending.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Type: <span className="capitalize">{item.type.replace('_', ' ')}</span></span>
                    <span>Requested By: {item.requestedBy}</span>
                    <span>On: {item.requestedAt}</span>
                    <Badge variant={priorityVariant(item.priority)} className="capitalize">{item.priority}</Badge>
                  </div>
                  <p className="text-sm text-foreground">{item.details}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-700" onClick={() => updateStatus(item.id, 'approved')}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-blue-700" onClick={() => updateStatus(item.id, 'forwarded')}>
                      <Forward className="mr-1 h-4 w-4" />Forward
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(item.id, 'rejected')}>
                      <XCircle className="mr-1 h-4 w-4" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {processed.length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">No processed requests yet.</CardContent></Card>}
            {processed.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.requestedBy} • {item.requestedAt}</p>
                  </div>
                  <Badge variant={item.status === 'approved' ? 'default' : item.status === 'forwarded' ? 'secondary' : 'destructive'} className="capitalize">
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
