import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, Send, Pin, PinOff, Users, Eye, Plus, Search,
  Mail, Bell, MessageSquare, Globe
} from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { BroadcastMessage } from '@/types/vc';

const typeIcons: Record<string, React.ElementType> = {
  announcement: Bell,
  congratulation: Globe,
  directive: Megaphone,
  notice: Mail,
};

const typeColors: Record<string, string> = {
  announcement: 'bg-blue-50 text-blue-700',
  congratulation: 'bg-emerald-50 text-emerald-700',
  directive: 'bg-amber-50 text-amber-700',
  notice: 'bg-purple-50 text-purple-700',
};

export default function VCCommunication() {
  const [broadcastMessages, setBroadcastMessages] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/vc/broadcastmessages').then(d => setBroadcastMessages(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<BroadcastMessage | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipients, setRecipients] = useState('');
  const [msgType, setMsgType] = useState<string>('announcement');
  const [searchTerm, setSearchTerm] = useState('');

  const toDate = (value: any) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  useEffect(() => {
    setMessages((broadcastMessages || []).map((message: any) => ({
      ...message,
      sentAt: toDate(message.sentAt),
    })));
  }, [broadcastMessages]);

  const handleSendBroadcast = async () => {
    if (!subject || !content) return;
    try {
      const created = await postApi<BroadcastMessage>('/vc/messages', {
        subject,
        content,
        recipients: recipients || 'All University',
        type: msgType,
      });
      const normalized = { ...created, sentAt: toDate(created.sentAt) };
      setMessages(prev => [normalized, ...prev]);
      setShowComposeDialog(false);
      setSubject('');
      setContent('');
      setRecipients('');
      toast({ title: 'Message Sent', description: `Broadcast "${subject}" sent to ${recipients || 'All University'}.` });
    } catch (error: any) {
      toast({ title: 'Send failed', description: error.message || 'Could not send message.', variant: 'destructive' });
    }
  };

  const handleTogglePin = async (id: string) => {
    const existing = messages.find((message) => message.id === id);
    if (!existing) return;
    try {
      const updated = await putApi<BroadcastMessage>(`/vc/messages/${id}`, { pinned: !existing.pinned });
      setMessages(prev => prev.map(message => message.id === id ? { ...updated, sentAt: toDate(updated.sentAt) } : message));
      toast({ title: 'Updated', description: 'Pin status changed.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message || 'Could not update message.', variant: 'destructive' });
    }
  };

  const filtered = messages.filter(m =>
    m.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication & Outreach</h1>
            <p className="text-muted-foreground">Broadcast messages, directives, and institutional announcements</p>
          </div>
          <Button onClick={() => setShowComposeDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Compose Broadcast
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Broadcasts', count: messages.length, icon: Megaphone },
            { label: 'Pinned', count: messages.filter(m => m.pinned).length, icon: Pin },
            { label: 'Directives', count: messages.filter(m => m.type === 'directive').length, icon: Send },
            { label: 'This Month', count: messages.filter(m => m.sentAt.getMonth() === new Date().getMonth()).length, icon: Mail },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {/* Messages List */}
        <div className="space-y-3">
          {filtered.map(msg => {
            const TypeIcon = typeIcons[msg.type] || Megaphone;
            return (
              <Card key={msg.id} className={`hover:shadow-md transition-shadow ${msg.pinned ? 'border-primary/40' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[msg.type]}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{msg.subject}</p>
                        {msg.pinned && <Pin className="h-3 w-3 text-primary" />}
                        <Badge variant="outline" className={`text-[10px] ${typeColors[msg.type]}`}>{msg.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{msg.content}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {msg.recipients}</span>
                        <span>{msg.sentAt.toLocaleDateString('en-IN')} at {msg.sentAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleTogglePin(msg.id)} title={msg.pinned ? 'Unpin' : 'Pin'}>
                        {msg.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedMessage(msg)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* View Message Dialog */}
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedMessage?.subject}</DialogTitle>
              <DialogDescription>
                From: {selectedMessage?.sender} • To: {selectedMessage?.recipients} • {selectedMessage?.sentAt.toLocaleDateString('en-IN')}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm whitespace-pre-wrap">{selectedMessage?.content}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedMessage(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Compose Dialog */}
        <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Compose Broadcast</DialogTitle>
              <DialogDescription>Send a message from the Vice Chancellor's office</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Message subject..." />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={msgType} onValueChange={setMsgType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="congratulation">Congratulation</SelectItem>
                    <SelectItem value="directive">Directive</SelectItem>
                    <SelectItem value="notice">Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipients</Label>
                <Select value={recipients} onValueChange={setRecipients}>
                  <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All University">All University</SelectItem>
                    <SelectItem value="All Deans & HODs">All Deans & HODs</SelectItem>
                    <SelectItem value="All Faculty">All Faculty</SelectItem>
                    <SelectItem value="All Students">All Students</SelectItem>
                    <SelectItem value="Board Members">Board Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Compose your message..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComposeDialog(false)}>Cancel</Button>
              <Button onClick={handleSendBroadcast} className="gap-2"><Send className="h-4 w-4" /> Send Broadcast</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
