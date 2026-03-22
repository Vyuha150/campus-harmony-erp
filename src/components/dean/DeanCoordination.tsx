import { useState, useEffect } from 'react';
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
  CalendarDays, Users, Plus, Trophy,
  Laptop, Music, Dumbbell, BookOpen, Eye, CheckCircle, Pencil
} from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
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
  const [interDeptEvents, setInterDeptEvents] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/dean/events').then(d => setInterDeptEvents(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [events, setEvents] = useState<InterDeptEvent[]>([]);
  useEffect(() => {
    setEvents(interDeptEvents);
  }, [interDeptEvents]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({ title: '', type: 'technical', date: '', budget: '', coordinator: '' });
  const [editEvent, setEditEvent] = useState({ id: '', title: '', type: 'technical', date: '', budget: '', coordinator: '', participants: '', status: 'planned' });

  const createEvent = async () => {
    if (!newEvent.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    try {
      const created = await postApi('/dean/events', {
        title: newEvent.title,
        type: newEvent.type,
        date: newEvent.date || new Date().toISOString().slice(0, 10),
        departments: ['CSE', 'ECE', 'EEE', 'ME', 'CE'],
        coordinator: newEvent.coordinator || 'TBD',
        budget: parseInt(newEvent.budget || '0', 10) || 0,
      });
      setEvents((prev) => [{ ...created, participants: created.participants || 0 }, ...prev]);
      toast({ title: 'Event Created', description: newEvent.title });
      setCreateOpen(false);
      setNewEvent({ title: '', type: 'technical', date: '', budget: '', coordinator: '' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create event', variant: 'destructive' });
    }
  };

  const detailEvent = events.find(e => e.id === detailId);

  const openEditDialog = (event: InterDeptEvent) => {
    setEditEvent({
      id: event.id,
      title: event.title,
      type: event.type,
      date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
      budget: String(event.budget || 0),
      coordinator: event.coordinator || '',
      participants: String(event.participants || 0),
      status: event.status || 'planned',
    });
    setEditOpen(true);
  };

  const saveEvent = async () => {
    if (!editEvent.id) return;
    try {
      const updated = await putApi<InterDeptEvent>(`/dean/events/${editEvent.id}`, {
        title: editEvent.title,
        type: editEvent.type,
        date: editEvent.date,
        coordinator: editEvent.coordinator,
        budget: parseInt(editEvent.budget || '0', 10) || 0,
        participants: parseInt(editEvent.participants || '0', 10) || 0,
        status: editEvent.status,
      });
      setEvents((prev) => prev.map((event) => (event.id === updated.id ? { ...event, ...updated } : event)));
      setEditOpen(false);
      toast({ title: 'Event updated', description: updated.title });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update event', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inter-Department Coordination</h1>
            <p className="text-muted-foreground">Cross-department events, communication, and activities</p>
          </div>
          <div className="flex gap-2">
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
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openEditDialog(event)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

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
              <p className="text-xs text-muted-foreground">
                Use Edit to update status, participants, and scheduling details.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details and progress.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Event Title</Label><Input value={editEvent.title} onChange={e => setEditEvent(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Type</Label>
              <Select value={editEvent.type} onValueChange={v => setEditEvent(p => ({ ...p, type: v }))}>
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
            <div><Label>Date</Label><Input type="date" value={editEvent.date} onChange={e => setEditEvent(p => ({ ...p, date: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={editEvent.status} onValueChange={v => setEditEvent(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Budget (₹)</Label><Input type="number" value={editEvent.budget} onChange={e => setEditEvent(p => ({ ...p, budget: e.target.value }))} /></div>
            <div><Label>Participants</Label><Input type="number" value={editEvent.participants} onChange={e => setEditEvent(p => ({ ...p, participants: e.target.value }))} /></div>
            <div><Label>Coordinator</Label><Input value={editEvent.coordinator} onChange={e => setEditEvent(p => ({ ...p, coordinator: e.target.value }))} /></div>
            <Button className="w-full" onClick={saveEvent}>Save Event</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
