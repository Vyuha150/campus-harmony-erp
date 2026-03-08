import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays, Users, Megaphone, Send, Plus, Trophy,
  Laptop, Music, Dumbbell, BookOpen, Eye, CheckCircle
} from 'lucide-react';
import { interDeptEvents as initialEvents } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';
import { InterDeptEvent } from '@/types/dean';

const typeIcons: Record<string, React.ElementType> = {
  technical: Laptop, cultural: Music, sports: Dumbbell, seminar: BookOpen, workshop: BookOpen,
};
const typeColors: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-700', cultural: 'bg-purple-100 text-purple-700',
  sports: 'bg-green-100 text-green-700', seminar: 'bg-amber-100 text-amber-700',
  workshop: 'bg-pink-100 text-pink-700',
};

export default function DeanCoordination() {
  const { toast } = useToast();
  const [events, setEvents] = useState<InterDeptEvent[]>(initialEvents);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', type: 'technical', date: '', budget: '', coordinator: '' });

  const sendBroadcast = () => {
    if (!broadcastSubject.trim()) { toast({ title: 'Subject required', variant: 'destructive' }); return; }
    toast({ title: 'Broadcast Sent', description: `"${broadcastSubject}" sent to all department HODs` });
    setBroadcastOpen(false);
    setBroadcastSubject('');
    setBroadcastMessage('');
  };

  const createEvent = () => {
    if (!newEvent.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    const ev: InterDeptEvent = {
      id: `ev-${Date.now()}`,
      title: newEvent.title,
      type: newEvent.type as InterDeptEvent['type'],
      date: newEvent.date || '2026-05-01',
      departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'],
      coordinator: newEvent.coordinator || 'TBD',
      budget: parseInt(newEvent.budget) || 0,
      participants: 0,
      status: 'planned',
    };
    setEvents(prev => [ev, ...prev]);
    toast({ title: 'Event Created', description: newEvent.title });
    setCreateOpen(false);
    setNewEvent({ title: '', type: 'technical', date: '', budget: '', coordinator: '' });
  };

  const detailEvent = events.find(e => e.id === detailId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inter-Department Coordination</h1>
            <p className="text-muted-foreground">Cross-department events, communication, and activities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBroadcastOpen(true)}><Megaphone className="mr-1 h-4 w-4" />Broadcast to All HODs</Button>
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />Create Event</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Planned Events', count: events.filter(e => e.status === 'planned').length, icon: CalendarDays, color: 'text-blue-600 bg-blue-100' },
            { label: 'Ongoing', count: events.filter(e => e.status === 'ongoing').length, icon: Trophy, color: 'text-green-600 bg-green-100' },
            { label: 'Completed', count: events.filter(e => e.status === 'completed').length, icon: Users, color: 'text-primary bg-primary/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {events.map(event => {
            const Icon = typeIcons[event.type] || CalendarDays;
            const colorClass = typeColors[event.type] || '';
            return (
              <Card key={event.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-center shrink-0">
                      <p className="text-xs font-bold text-primary">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                      <p className="text-2xl font-bold text-foreground">{new Date(event.date).getDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] capitalize ${colorClass}`} variant="outline">
                          <Icon className="mr-1 h-3 w-3" />{event.type}
                        </Badge>
                        <Badge variant={event.status === 'ongoing' ? 'default' : event.status === 'completed' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                          {event.status}
                        </Badge>
                      </div>
                      <p className="font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Coordinator: {event.coordinator} • Budget: ₹{(event.budget / 1000).toFixed(0)}K • {event.participants} participants
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {event.departments.map(d => (
                          <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setDetailId(event.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast Message</DialogTitle>
            <DialogDescription>Send a message to all department HODs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Subject</Label><Input placeholder="Message subject..." value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} /></div>
            <div><Label>Message</Label><Textarea placeholder="Type your message to all HODs..." rows={4} value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} /></div>
            <Button className="w-full" onClick={sendBroadcast}><Send className="mr-1 h-4 w-4" />Send</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inter-Department Event</DialogTitle>
            <DialogDescription>Plan a new cross-department activity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Event Title</Label><Input placeholder="e.g., TechVista 2026" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Type</Label>
              <Select value={newEvent.type} onValueChange={v => setNewEvent(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="cultural">Cultural</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="seminar">Seminar</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} /></div>
            <div><Label>Budget (₹)</Label><Input type="number" placeholder="e.g., 500000" value={newEvent.budget} onChange={e => setNewEvent(p => ({ ...p, budget: e.target.value }))} /></div>
            <div><Label>Coordinator</Label><Input placeholder="Faculty coordinator name" value={newEvent.coordinator} onChange={e => setNewEvent(p => ({ ...p, coordinator: e.target.value }))} /></div>
            <Button className="w-full" onClick={createEvent}><Plus className="mr-1 h-4 w-4" />Create Event</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailEvent?.title}</DialogTitle>
            <DialogDescription>Event details and management</DialogDescription>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <span className="capitalize font-medium">{detailEvent.type}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="capitalize ml-1">{detailEvent.status}</Badge></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{detailEvent.date}</span></div>
                <div><span className="text-muted-foreground">Budget:</span> <span className="font-medium">₹{(detailEvent.budget / 1000).toFixed(0)}K</span></div>
                <div><span className="text-muted-foreground">Coordinator:</span> <span className="font-medium">{detailEvent.coordinator}</span></div>
                <div><span className="text-muted-foreground">Participants:</span> <span className="font-medium">{detailEvent.participants}</span></div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Departments:</span>
                <div className="flex flex-wrap gap-1 mt-1">{detailEvent.departments.map(d => <Badge key={d} variant="outline">{d}</Badge>)}</div>
              </div>
              {detailEvent.status === 'planned' && (
                <Button className="w-full" onClick={() => {
                  setEvents(prev => prev.map(e => e.id === detailEvent.id ? { ...e, status: 'ongoing' } : e));
                  toast({ title: 'Event Started', description: detailEvent.title });
                  setDetailId(null);
                }}><CheckCircle className="mr-1 h-4 w-4" />Mark as Ongoing</Button>
              )}
              {detailEvent.status === 'ongoing' && (
                <Button className="w-full" onClick={() => {
                  setEvents(prev => prev.map(e => e.id === detailEvent.id ? { ...e, status: 'completed' } : e));
                  toast({ title: 'Event Completed', description: detailEvent.title });
                  setDetailId(null);
                }}><CheckCircle className="mr-1 h-4 w-4" />Mark as Completed</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
