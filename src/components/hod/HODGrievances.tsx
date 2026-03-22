import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, MessageSquare, Shield, FileWarning, CheckCircle,
  Clock, Send, Forward, XCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchApi, putApi } from '@/lib/apiService';

interface Grievance {
  id: string;
  type: 'student_complaint' | 'faculty_complaint' | 'disciplinary';
  subject: string;
  description: string;
  filedBy: string;
  filedAt: string;
  status: 'new' | 'under_review' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  response?: string;
}

const typeIcons: Record<string, React.ElementType> = {
  student_complaint: MessageSquare,
  faculty_complaint: AlertTriangle,
  disciplinary: Shield,
};

const statusColors: Record<string, string> = {
  new: 'destructive',
  under_review: 'secondary',
  resolved: 'default',
  closed: 'outline',
};

export default function HODGrievances() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchApi('/hod/grievances')
      .then((data) => setGrievances(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  const item = grievances.find(g => g.id === selected);

  const handleSubmitResponse = async () => {
    if (item && response) {
      try {
        await putApi(`/hod/grievances/${item.id}`, { status: 'resolved', response });
        setGrievances(prev => prev.map(g => g.id === item.id ? { ...g, status: 'resolved', response } : g));
        toast({ title: '✅ Response Submitted', description: `Grievance "${item.subject}" resolved` });
        setResponse('');
        setSelected(null);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to submit response', variant: 'destructive' });
      }
    }
  };

  const handleIssueWarning = async () => {
    if (item) {
      try {
        await putApi(`/hod/grievances/${item.id}`, { status: 'resolved', response: response || 'Disciplinary warning issued' });
        setGrievances(prev => prev.map(g => g.id === item.id ? { ...g, status: 'resolved', response: response || 'Disciplinary warning issued' } : g));
        toast({ title: '⚠️ Warning Issued', description: `Disciplinary warning recorded for "${item.subject}"` });
        setSelected(null);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to issue warning', variant: 'destructive' });
      }
    }
  };

  const handleForwardToDean = async () => {
    if (item) {
      try {
        await putApi(`/hod/grievances/${item.id}`, { status: 'under_review', response: response || 'Escalated to Dean for review' });
        setGrievances(prev => prev.map(g => g.id === item.id ? { ...g, status: 'under_review', response: response || g.response } : g));
        toast({ title: '📤 Forwarded to Dean', description: `"${item.subject}" escalated to Dean for review` });
        setSelected(null);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to forward grievance', variant: 'destructive' });
      }
    }
  };

  const handleMarkUnderReview = async () => {
    if (item) {
      try {
        await putApi(`/hod/grievances/${item.id}`, { status: 'under_review' });
        setGrievances(prev => prev.map(g => g.id === item.id ? { ...g, status: 'under_review' } : g));
        toast({ title: 'Status Updated', description: 'Marked as Under Review' });
      } catch (error: any) {
        toast({ title: 'Update failed', description: error?.message || 'Unable to update grievance status', variant: 'destructive' });
      }
    }
  };

  if (item) {
    const Icon = typeIcons[item.type] || MessageSquare;
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Back to Grievances</Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{item.subject}</h1>
                <p className="text-sm text-muted-foreground">Filed by {item.filedBy} • {item.filedAt}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={statusColors[item.status] as any} className="capitalize">{item.status.replace('_', ' ')}</Badge>
              <Badge variant={item.priority === 'high' ? 'destructive' : 'outline'} className="capitalize">{item.priority}</Badge>
            </div>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{item.description}</p></CardContent>
          </Card>

          {item.response && (
            <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" />HOD Response</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{item.response}</p></CardContent>
            </Card>
          )}

          {item.status !== 'resolved' && item.status !== 'closed' && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">HOD Response / Action</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {item.status === 'new' && (
                  <Button variant="outline" size="sm" onClick={handleMarkUnderReview}>
                    <Clock className="mr-1 h-4 w-4" />Mark as Under Review
                  </Button>
                )}
                <Textarea placeholder="Enter your response or action taken..." rows={4} value={response} onChange={e => setResponse(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleIssueWarning}>
                    <FileWarning className="mr-1 h-4 w-4" />Issue Warning
                  </Button>
                  <Button variant="outline" onClick={handleForwardToDean}>
                    <Forward className="mr-1 h-4 w-4" />Forward to Dean
                  </Button>
                  <Button onClick={handleSubmitResponse} disabled={!response}>
                    <Send className="mr-1 h-4 w-4" />Submit & Resolve
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Grievances & Disciplinary</h1>
        <p className="text-muted-foreground">Handle escalated complaints, grievances, and disciplinary actions</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'New/Open', count: grievances.filter(g => g.status === 'new').length, color: 'text-destructive bg-destructive/10', icon: AlertTriangle },
            { label: 'Under Review', count: grievances.filter(g => g.status === 'under_review').length, color: 'text-amber-600 bg-amber-100', icon: Clock },
            { label: 'Resolved', count: grievances.filter(g => g.status === 'resolved').length, color: 'text-green-600 bg-green-100', icon: CheckCircle },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {grievances.map(g => {
            const Icon = typeIcons[g.type] || MessageSquare;
            return (
              <Card key={g.id} className="border-border cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(g.id)}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{g.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">By {g.filedBy} • {g.filedAt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={g.priority === 'high' ? 'destructive' : 'outline'} className="capitalize text-[10px]">{g.priority}</Badge>
                    <Badge variant={statusColors[g.status] as any} className="capitalize text-[10px]">{g.status.replace('_', ' ')}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
