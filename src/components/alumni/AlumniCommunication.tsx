import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, Plus, Mail, Eye, BarChart3, Users, MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniCommunication() {
  const { toast } = useToast();
  const [alumniCommunications, setAlumniCommunications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('newsletter');
  const [targetAudience, setTargetAudience] = useState('all');
  const [content, setContent] = useState('');
  const [schedule, setSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const rows = await fetchApi<any[]>('/alumni/communications');
    setAlumniCommunications(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load communications', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const communicationStats = useMemo(() => {
    const sent = alumniCommunications.filter((c) => String(c.status || '').toLowerCase() === 'sent');
    const drafts = alumniCommunications.filter((c) => String(c.status || '').toLowerCase() === 'draft').length;
    const openRateAvg = sent.length > 0
      ? Math.round(sent.reduce((sum, c) => sum + Number(c.openRate || 0), 0) / sent.length)
      : 0;
    const clickRateAvg = sent.length > 0
      ? Math.round(sent.reduce((sum, c) => sum + Number(c.clickRate || 0), 0) / sent.length)
      : 0;
    return {
      campaignsSent: sent.length,
      averageOpenRate: `${openRateAvg}%`,
      averageClickRate: `${clickRateAvg}%`,
      draftsPending: drafts,
    };
  }, [alumniCommunications]);

  const resetForm = () => {
    setTitle('');
    setType('newsletter');
    setTargetAudience('all');
    setContent('');
    setSchedule('');
  };

  const handleCreateCampaign = async (status: 'draft' | 'sent') => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Missing fields', description: 'Campaign title and content are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/alumni/communications', {
        title: title.trim(),
        type,
        content: content.trim(),
        targetAudience: { segment: targetAudience },
        status,
        ...(status === 'sent' ? { sentDate: new Date().toISOString() } : {}),
        ...(schedule ? { scheduledDate: new Date(schedule).toISOString() } : {}),
      });
      await loadData();
      setOpen(false);
      resetForm();
      toast({ title: status === 'sent' ? 'Campaign sent' : 'Draft saved' });
    } catch (error: any) {
      toast({ title: 'Campaign action failed', description: error?.message || 'Please retry', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Communication Hub</h1>
            <p className="text-muted-foreground">Newsletters, bulk emails, and alumni engagement tracking</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Campaign</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Communication Campaign</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Campaign Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. April Newsletter" /></div>
                <div><Label>Type</Label>
                  <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="newsletter">Newsletter</SelectItem><SelectItem value="announcement">Announcement</SelectItem><SelectItem value="invitation">Event Invitation</SelectItem><SelectItem value="update">Update</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="all">All Alumni</SelectItem>
                    <SelectItem value="batch2024">Batch 2024</SelectItem>
                    <SelectItem value="batch2023">Batch 2023</SelectItem>
                    <SelectItem value="mentors">Active Mentors</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Message Content</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your message..." /></div>
                <div><Label>Schedule (optional)</Label><Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} /></div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={saving} onClick={() => handleCreateCampaign('draft')}>Save Draft</Button>
                  <Button className="flex-1" disabled={saving} onClick={() => handleCreateCampaign('sent')}><Send className="mr-2 h-4 w-4" />Send Now</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4"><Mail className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">{communicationStats.campaignsSent}</p><p className="text-xs text-muted-foreground">Campaigns Sent</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">{communicationStats.averageOpenRate}</p><p className="text-xs text-muted-foreground">Avg Open Rate</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><BarChart3 className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">{communicationStats.averageClickRate}</p><p className="text-xs text-muted-foreground">Avg Click Rate</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><MessageSquare className="h-8 w-8 text-blue-600" /><div><p className="text-2xl font-bold text-foreground">{communicationStats.draftsPending}</p><p className="text-xs text-muted-foreground">Drafts Pending</p></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Campaigns</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sent</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Recipients</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Open Rate</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Click Rate</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {alumniCommunications.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{c.title}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{c.type}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(c.sentDate)}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{Number(c.recipientCount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{Number(c.openRate || 0)}%</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{Number(c.clickRate || 0)}%</td>
                      <td className="px-4 py-3"><Badge variant={c.status === 'sent' ? 'default' : 'secondary'} className="capitalize">{c.status}</Badge></td>
                      <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={loadData}><Eye className="mr-1 h-3 w-3" />View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
