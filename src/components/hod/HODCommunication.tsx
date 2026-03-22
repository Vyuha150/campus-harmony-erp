import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Send, Users, GraduationCap, Megaphone, Plus, Eye, Trash2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { deleteApi, fetchApi, postApi } from '@/lib/apiService';

interface Message {
  id: string;
  subject: string;
  message: string;
  sentAt: string;
  recipients: string;
  to?: string;
  recipientCount: number;
  readCount: number;
  viaEmail: boolean;
  viaWhatsApp: boolean;
}

export default function HODCommunication() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientOptions, setRecipientOptions] = useState<any[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState<Message | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');
  const [viaEmail, setViaEmail] = useState(true);
  const [viaWhatsApp, setViaWhatsApp] = useState(false);

  useEffect(() => {
    fetchApi('/hod/communication/messages').then((data) => setMessages(data)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/communication/recipient-options').then((data) => setRecipientOptions(data)).catch((error) => { console.error('API request failed', error); });
  }, []);

  const handleSend = async () => {
    if (!subject || !body || !to) {
      toast({ title: 'Missing Fields', description: 'Please fill subject, message, and select recipients', variant: 'destructive' });
      return;
    }
    try {
      const rec = recipientOptions.find(r => r.value === to);
      const msg = await postApi<Message>('/hod/communication/messages', {
        subject,
        message: body,
        to,
        viaEmail,
        viaWhatsApp,
      });
      setMessages(prev => [msg, ...prev]);
      toast({ title: '✅ Message Sent', description: `Delivered to ${rec?.count || 0} recipients${viaEmail ? ' via Email' : ''}${viaWhatsApp ? ' + WhatsApp' : ''}` });
      setShowCompose(false);
      setSubject('');
      setBody('');
      setTo('');
    } catch (error: any) {
      toast({ title: 'Send failed', description: error?.message || 'Unable to send message', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApi(`/hod/communication/messages/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast({ title: 'Message Deleted' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete message', variant: 'destructive' });
    }
  };

  const handleQuickMessage = (target: string) => {
    setTo(target);
    setShowCompose(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication</h1>
            <p className="text-muted-foreground">Broadcast messages to department faculty and students</p>
          </div>
          <Button onClick={() => setShowCompose(true)}>
            <Plus className="mr-1 h-4 w-4" />New Message
          </Button>
        </div>

        {/* Quick Targets */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Message All Faculty', icon: Users, count: recipientOptions.find((r) => r.value === 'faculties')?.count ?? 0, target: 'faculties' },
            { label: 'Message All Students', icon: GraduationCap, count: recipientOptions.find((r) => r.value === 'students')?.count ?? 0, target: 'students' },
            { label: 'Post Notice to All', icon: Megaphone, count: recipientOptions.find((r) => r.value === 'all')?.count ?? 0, target: 'all' },
          ].map(t => (
            <Button key={t.label} variant="outline" className="h-auto flex-col gap-1 py-4 text-xs"
              onClick={() => handleQuickMessage(t.target)}>
              <t.icon className="h-5 w-5 text-primary" />
              {t.label}
              <span className="text-[10px] text-muted-foreground">{t.count} recipients</span>
            </Button>
          ))}
        </div>

        {/* Sent Messages */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sent Messages ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className="rounded-lg border border-border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{msg.recipients}</Badge>
                    <span className="text-xs text-muted-foreground">{msg.sentAt}</span>
                    {msg.viaEmail && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
                    {msg.viaWhatsApp && <Badge variant="secondary" className="text-[10px]">WhatsApp</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />{msg.recipientCount}
                    <Eye className="h-3 w-3 text-green-600" />{msg.readCount} read
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(msg.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 font-medium text-foreground cursor-pointer hover:underline" onClick={() => setShowDetail(msg)}>{msg.subject}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipients</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                <SelectContent>
                  {recipientOptions.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label} ({r.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input placeholder="Message subject..." value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea placeholder="Type your message..." rows={5} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="email" checked={viaEmail} onCheckedChange={(c) => setViaEmail(!!c)} />
                <label htmlFor="email" className="text-sm">Send via Email</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="whatsapp" checked={viaWhatsApp} onCheckedChange={(c) => setViaWhatsApp(!!c)} />
                <label htmlFor="whatsapp" className="text-sm">Send via WhatsApp</label>
              </div>
            </div>
            <Button className="w-full" onClick={handleSend} disabled={!subject || !body || !to}>
              <Send className="mr-1 h-4 w-4" />Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{showDetail?.subject}</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Badge variant="outline">{showDetail.to || showDetail.recipients}</Badge>
                <Badge variant="secondary">{showDetail.sentAt}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Recipients: {showDetail.recipientCount} • Read: {showDetail.readCount}</p>
                <p>Channels: {showDetail.viaEmail ? 'Email' : ''} {showDetail.viaWhatsApp ? 'WhatsApp' : ''}</p>
              </div>
              <p className="text-sm">{showDetail.message}</p>
              <Button variant="outline" className="w-full" onClick={() => { setShowDetail(null); setTo(''); setSubject(`Re: ${showDetail.subject}`); setShowCompose(true); }}>
                <Send className="mr-1 h-4 w-4" />Resend / Forward
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
