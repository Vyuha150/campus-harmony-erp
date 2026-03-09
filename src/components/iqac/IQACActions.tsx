import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertTriangle, Plus, Filter, Search } from 'lucide-react';
import { iqacActionItems } from '@/data/iqacMockData';
import { useState } from 'react';

export default function IQACActions() {
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
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Action Item</Button>
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
                    <Button variant="outline" size="sm">Update Status</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No action items match your filters.</CardContent></Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
