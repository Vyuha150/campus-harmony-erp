import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Mail, Send, Users, Bell, Calendar, FileText,
  Phone, CheckCircle2, Clock, Plus, Filter, Megaphone
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '-';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN');
};

export default function PlacementCommunication() {
  const { toast } = useToast();
  const [recentMessages, setRecentMessages] = useState<any>([]);
  const [templates, setTemplates] = useState<any>([]);
  const [commStats, setCommStats] = useState<any>({
    messagesSent: 0,
    averageReadRate: '0%',
    whatsappDelivered: 0,
    pendingSends: 0,
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [targetAudience, setTargetAudience] = useState('eligible');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    const [recent, tpls, stats] = await Promise.all([
      fetchApi('/placements/communication/recent'),
      fetchApi('/placements/communication/templates'),
      fetchApi('/placements/communication/stats')
    ]);
    setRecentMessages(Array.isArray(recent) ? recent : []);
    setTemplates(Array.isArray(tpls) ? tpls : []);
    setCommStats(stats || {});
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load communication data', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'Missing fields', description: 'Subject and message are required.', variant: 'destructive' });
      return;
    }

    try {
      await postApi('/placements/messages', {
        subject: subject.trim(),
        message: message.trim(),
        channel,
        targetAudience,
      });
      setSubject('');
      setMessage('');
      await loadData();
      toast({ title: 'Message sent', description: 'Placement communication sent successfully.' });
    } catch (error: any) {
      toast({ title: 'Send failed', description: error?.message || 'Unable to send message.', variant: 'destructive' });
    }
  };

  const handleUseTemplate = (template: any) => {
    setComposeOpen(true);
    setSubject(String(template?.name || 'Placement Update'));
    setMessage(String(template?.desc || ''));
  };

  const handleSchedule = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'Missing fields', description: 'Subject and message are required.', variant: 'destructive' });
      return;
    }

    try {
      await postApi('/placements/messages', {
        subject: `[Scheduled] ${subject.trim()}`,
        message: message.trim(),
        channel,
        targetAudience,
      });
      await loadData();
      toast({ title: 'Message scheduled', description: 'Message queued successfully.' });
    } catch (error: any) {
      toast({ title: 'Schedule failed', description: error?.message || 'Unable to schedule message.', variant: 'destructive' });
    }
  };

  const handleSaveTemplate = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'Missing fields', description: 'Subject and message are required to save a template.', variant: 'destructive' });
      return;
    }

    try {
      await postApi('/placements/communication/templates', {
        name: subject.trim(),
        category: 'custom',
        desc: message.trim()
      });
      await loadData();
      toast({ title: 'Template saved', description: 'Template added to placement templates.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save template.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Communication Hub</h1>
            <p className="text-muted-foreground">Bulk notifications, email templates, and WhatsApp integration for placement activities</p>
          </div>
          <Button size="sm" onClick={() => setComposeOpen(true)}><Plus className="mr-2 h-4 w-4" />New Message</Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Messages Sent</p><p className="text-2xl font-bold text-foreground">{commStats.messagesSent}</p><p className="text-xs text-muted-foreground">This month</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Read Rate</p><p className="text-2xl font-bold text-green-600">{commStats.averageReadRate}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">WhatsApp Delivered</p><p className="text-2xl font-bold text-foreground">{commStats.whatsappDelivered?.toLocaleString?.() ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Sends</p><p className="text-2xl font-bold text-amber-600">{commStats.pendingSends}</p></CardContent></Card>
        </div>

        <Tabs defaultValue={composeOpen ? 'compose' : 'sent'}>
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="sent">Sent Messages</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <Card>
              <CardHeader><CardTitle className="text-lg">Compose Notification</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Target Audience</label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eligible">All Eligible Students</SelectItem>
                        <SelectItem value="unplaced">Unplaced Students Only</SelectItem>
                        <SelectItem value="cse">CSE Students</SelectItem>
                        <SelectItem value="ece">ECE Students</SelectItem>
                        <SelectItem value="custom">Custom Filter...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Channel</label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="all">All Channels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Subject</label>
                  <Input className="mt-1" placeholder="Enter message subject..." value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Message</label>
                  <Textarea className="mt-1" rows={5} placeholder="Type your message here. Use {{student_name}}, {{company_name}}, {{date}} for personalization..." value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSend}><Send className="mr-2 h-4 w-4" />Send Now</Button>
                  <Button variant="outline" onClick={handleSchedule}><Clock className="mr-2 h-4 w-4" />Schedule</Button>
                  <Button variant="ghost" onClick={handleSaveTemplate}><FileText className="mr-2 h-4 w-4" />Save as Template</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent" className="space-y-3">
            {recentMessages.map((msg) => (
              <Card key={msg.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {String(msg.channel || '').includes('whatsapp') ? <Phone className="h-5 w-5 text-green-600" /> :
                       String(msg.channel || '').includes('sms') ? <MessageSquare className="h-5 w-5 text-primary" /> :
                       <Mail className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground">To: {msg.recipients}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(msg.sentAt)} • {String(msg.channel || 'email').toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{msg.readRate}</p>
                      <p className="text-xs text-muted-foreground">read rate</p>
                    </div>
                    <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />{msg.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{t.name}</h3>
                          <Badge variant="outline" className="capitalize">{t.category}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => toast({ title: t.name, description: t.desc })}>Preview</Button>
                          <Button size="sm" onClick={() => handleUseTemplate(t)}>Use Template</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
