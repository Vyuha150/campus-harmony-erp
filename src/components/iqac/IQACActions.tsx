import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Plus, Filter, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createIQACAction, fetchIQACActions, updateIQACAction } from '@/lib/iqacApi';
import { useToast } from '@/hooks/use-toast';

export default function IQACActions() {
  const { toast } = useToast();
  const [iqacActionItems, setIqacActionItems] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    category: 'governance',
    priority: 'medium',
    assignedTo: '',
    department: '',
    dueDate: '',
    impact: ''
  });

  const loadActions = async () => {
    try {
      setApiLoading(true);
      const actions = await fetchIQACActions();
      setIqacActionItems(actions);
    } catch (error: any) {
      toast({
        title: 'Unable to load action items',
        description: error?.message || 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = iqacActionItems.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchTerm && !a.title.toLowerCase().includes(searchTerm.toLowerCase()) && !a.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: iqacActionItems.length,
    completed: iqacActionItems.filter(a => a.status === 'completed').length,
    inProgress: iqacActionItems.filter(a => a.status === 'in_progress').length,
    pending: iqacActionItems.filter(a => a.status === 'pending').length,
    overdue: iqacActionItems.filter(a => a.status === 'overdue').length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleCreateAction = async () => {
    if (!newAction.title.trim() || !newAction.description.trim() || !newAction.assignedTo.trim() || !newAction.dueDate) {
      toast({ title: 'Missing details', description: 'Title, description, assignee, and due date are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      await createIQACAction({
        title: newAction.title.trim(),
        description: newAction.description.trim(),
        category: newAction.category,
        priority: newAction.priority,
        assignedTo: newAction.assignedTo.trim(),
        department: newAction.department.trim() || undefined,
        dueDate: newAction.dueDate,
        impact: newAction.impact.trim() || undefined
      });

      await loadActions();
      setShowCreateDialog(false);
      setNewAction({
        title: '',
        description: '',
        category: 'governance',
        priority: 'medium',
        assignedTo: '',
        department: '',
        dueDate: '',
        impact: ''
      });
      toast({ title: 'Action item created', description: 'The new IQAC action has been saved.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create action item.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (action: any) => {
    const nextStatus = action.status === 'pending'
      ? 'in_progress'
      : action.status === 'in_progress'
        ? 'completed'
        : 'pending';

    try {
      const updated = await updateIQACAction(action.id, { status: nextStatus });
      setIqacActionItems((prev: any[]) => prev.map((item) => (
        item.id === action.id
          ? {
              ...item,
              ...updated,
              dueDate: updated?.dueDate ? new Date(updated.dueDate) : item.dueDate,
              createdDate: updated?.createdDate ? new Date(updated.createdDate) : item.createdDate,
              completedDate: updated?.completedDate ? new Date(updated.completedDate) : item.completedDate
            }
          : item
      )));
      toast({ title: 'Status updated', description: `Action marked as ${nextStatus.replace('_', ' ')}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update status.', variant: 'destructive' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-amber-600';
      case 'medium': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default' as const;
      case 'overdue': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">IQAC Action Items</h1>
            <p className="text-muted-foreground">Track recommendations and their implementation for continuous improvement</p>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}><Plus className="mr-2 h-4 w-4" />New Action Item</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-muted-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-primary">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
              <Progress value={completionRate} className="h-1.5 mt-2 w-full" />
            </div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search action items..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Items List */}
        <div className="space-y-3">
          {!apiLoading && filtered.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No action items match your filters.</CardContent></Card>
          )}
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{a.title}</h3>
                      <Badge variant="outline" className={`capitalize ${getPriorityColor(a.priority)}`}>{a.priority}</Badge>
                      <Badge variant="outline" className="capitalize">{a.category.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>👤 {a.assignedTo}</span>
                      {a.department && <span>🏢 {a.department}</span>}
                      <span>📅 Due: {a.dueDate.toLocaleDateString('en-IN')}</span>
                      <span>📌 Created: {a.createdDate.toLocaleDateString('en-IN')}</span>
                      {a.impact && <span className="text-primary font-medium">→ {a.impact}</span>}
                    </div>
                    {a.implementationStatus && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{a.implementationStatus}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getStatusVariant(a.status)} className="capitalize">{a.status.replace('_', ' ')}</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(a)}>Update Status</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create IQAC Action Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Action title"
                value={newAction.title}
                onChange={(event) => setNewAction((prev) => ({ ...prev, title: event.target.value }))}
              />
              <Textarea
                placeholder="Action description"
                value={newAction.description}
                onChange={(event) => setNewAction((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newAction.category} onValueChange={(value) => setNewAction((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curriculum">Curriculum</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="student_support">Student Support</SelectItem>
                    <SelectItem value="governance">Governance</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newAction.priority} onValueChange={(value) => setNewAction((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Assigned to"
                value={newAction.assignedTo}
                onChange={(event) => setNewAction((prev) => ({ ...prev, assignedTo: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Department"
                  value={newAction.department}
                  onChange={(event) => setNewAction((prev) => ({ ...prev, department: event.target.value }))}
                />
                <Input
                  type="date"
                  value={newAction.dueDate}
                  onChange={(event) => setNewAction((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
              <Input
                placeholder="Impact (optional)"
                value={newAction.impact}
                onChange={(event) => setNewAction((prev) => ({ ...prev, impact: event.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateAction} disabled={submitting}>{submitting ? 'Saving...' : 'Create Action'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
