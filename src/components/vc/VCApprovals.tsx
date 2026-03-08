import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle, XCircle, Clock, FileText, AlertTriangle,
  ChevronRight, Eye, Forward, IndianRupee, Users, BookOpen,
  Building2, Handshake, FlaskConical, Scale
} from 'lucide-react';
import { executiveApprovals } from '@/data/vcMockData';
import { ExecutiveApproval } from '@/types/vc';

const typeIcons: Record<string, React.ElementType> = {
  faculty_hire: Users,
  capital_expenditure: Building2,
  new_program: BookOpen,
  mou: Handshake,
  research_center: FlaskConical,
  budget_allocation: IndianRupee,
  policy_change: Scale,
};

export default function VCApprovals() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState(executiveApprovals);
  const [selectedApproval, setSelectedApproval] = useState<ExecutiveApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'forward' | null>(null);
  const [comment, setComment] = useState('');
  const [filterTab, setFilterTab] = useState('pending');

  const filtered = approvals.filter(a => {
    if (filterTab === 'pending') return a.status === 'pending';
    if (filterTab === 'approved') return a.status === 'approved';
    if (filterTab === 'rejected') return a.status === 'rejected';
    return true;
  });

  const handleAction = () => {
    if (!selectedApproval || !actionType) return;
    if (actionType === 'forward') {
      toast({ title: 'Forwarded', description: `"${selectedApproval.title}" forwarded to Board of Management for review.` });
    } else {
      setApprovals(prev => prev.map(a => a.id === selectedApproval.id ? { ...a, status: actionType === 'approve' ? 'approved' as const : 'rejected' as const } : a));
      toast({ title: actionType === 'approve' ? 'Approved' : 'Rejected', description: `"${selectedApproval.title}" has been ${actionType === 'approve' ? 'approved' : 'rejected'}.` });
    }
    setSelectedApproval(null);
    setActionType(null);
    setComment('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals & Decisions</h1>
          <p className="text-muted-foreground">Review and act on institutional requests requiring executive authorization</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Pending', count: approvals.filter(a => a.status === 'pending').length, icon: Clock, color: 'text-amber-600' },
            { label: 'Approved', count: approvals.filter(a => a.status === 'approved').length, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Rejected', count: approvals.filter(a => a.status === 'rejected').length, icon: XCircle, color: 'text-red-600' },
            { label: 'Critical', count: approvals.filter(a => a.priority === 'critical' && a.status === 'pending').length, icon: AlertTriangle, color: 'text-destructive' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Approvals List */}
        <Card>
          <CardHeader>
            <Tabs value={filterTab} onValueChange={setFilterTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No items in this category.</p>}
              {filtered.map(item => {
                const TypeIcon = typeIcons[item.type] || FileText;
                return (
                  <div key={item.id} className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <TypeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{item.title}</p>
                        <Badge variant={item.priority === 'critical' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">{item.priority}</Badge>
                        <Badge variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">{item.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{item.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>From: {item.requestedBy}</span>
                        {item.forwardedFrom && <span>• Via: {item.forwardedFrom}</span>}
                        <span>• {item.requestedAt.toLocaleDateString('en-IN')}</span>
                        {item.amount && <span>• ₹{(item.amount / 10000000).toFixed(1)} Cr</span>}
                      </div>
                      {item.documents && (
                        <div className="flex gap-1 mt-2">
                          {item.documents.map(doc => (
                            <Badge key={doc} variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-muted">
                              <FileText className="h-3 w-3" />{doc}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedApproval(item); setActionType('approve'); }}>
                          <CheckCircle className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => { setSelectedApproval(item); setActionType('reject'); }}>
                          <XCircle className="h-3 w-3" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setSelectedApproval(item); setActionType('forward'); }}>
                          <Forward className="h-3 w-3" /> Forward
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={!!selectedApproval && !!actionType} onOpenChange={() => { setSelectedApproval(null); setActionType(null); setComment(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Approve Request' : actionType === 'reject' ? 'Reject Request' : 'Forward to Board'}
              </DialogTitle>
              <DialogDescription>{selectedApproval?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedApproval?.description}</p>
              <Textarea placeholder={`Add ${actionType === 'reject' ? 'reason for rejection' : 'remarks'}...`} value={comment} onChange={e => setComment(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedApproval(null); setActionType(null); setComment(''); }}>Cancel</Button>
              <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={handleAction}>
                {actionType === 'approve' ? 'Confirm Approval' : actionType === 'reject' ? 'Confirm Rejection' : 'Forward'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
