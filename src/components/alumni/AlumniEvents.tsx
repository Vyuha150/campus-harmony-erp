import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, MapPin, Users, Plus, Download, Eye, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniEvents() {
  const { toast } = useToast();
  const [alumniEvents, setAlumniEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('reunion');
  const [date, setDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [venue, setVenue] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [targetAudience, setTargetAudience] = useState('all');

  const loadData = async () => {
    const rows = await fetchApi<any[]>('/alumni/events');
    setAlumniEvents(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load events', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('reunion');
    setDate('');
    setRegistrationDeadline('');
    setMaxCapacity('');
    setVenue('');
    setIsVirtual(false);
    setTargetAudience('all');
  };

  const handleCreateEvent = async (status: 'draft' | 'published') => {
    if (!title.trim() || !description.trim() || !date || !registrationDeadline || !venue.trim()) {
      toast({ title: 'Missing fields', description: 'Title, description, date, registration deadline and venue are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/alumni/events', {
        title: title.trim(),
        description: description.trim(),
        type,
        date: new Date(date).toISOString(),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        venue: venue.trim(),
        isVirtual,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
        organizer: 'Alumni Office',
        targetAudience: { segment: targetAudience },
        status,
      });
      await loadData();
      setOpen(false);
      resetForm();
      toast({ title: status === 'published' ? 'Event published' : 'Event draft saved' });
    } catch (error: any) {
      toast({ title: 'Event action failed', description: error?.message || 'Please retry', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const upcomingCount = alumniEvents.filter((e) => new Date(String(e.date)) >= now && String(e.status || '').toLowerCase() === 'published').length;
  const totalRsvps = alumniEvents.reduce((sum, e) => sum + (Array.isArray(e.registrations) ? e.registrations.length : 0), 0);
  const completedEvents = alumniEvents.filter((e) => String(e.status || '').toLowerCase() === 'completed');
  const attendanceRate = completedEvents.length > 0
    ? Math.round(completedEvents.reduce((sum, e) => {
      const cap = Number(e.maxCapacity || 0);
      const reg = Array.isArray(e.registrations) ? e.registrations.length : 0;
      return sum + (cap > 0 ? (reg / cap) * 100 : 0);
    }, 0) / completedEvents.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Events & Reunions</h1>
            <p className="text-muted-foreground">Create events, track RSVPs, and manage attendee lists</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><Download className="mr-2 h-4 w-4" />Refresh</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Event</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Alumni Event</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Event Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Silver Jubilee Reunion" /></div>
                  <div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <div><Label>Type</Label>
                    <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="reunion">Reunion</SelectItem><SelectItem value="networking">Networking</SelectItem><SelectItem value="webinar">Webinar</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="fundraising">Fundraising</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    <div><Label>Max Capacity</Label><Input type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} /></div>
                  </div>
                  <div><Label>Venue</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Location or online link" /></div>
                  <div className="flex items-center gap-2"><Checkbox id="virtual" checked={isVirtual} onCheckedChange={(v) => setIsVirtual(Boolean(v))} /><Label htmlFor="virtual">Virtual Event</Label></div>
                  <div><Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="all">All Alumni</SelectItem><SelectItem value="batch">Specific Batch</SelectItem><SelectItem value="program">Specific Program</SelectItem><SelectItem value="industry">Specific Industry</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div><Label>Registration Deadline</Label><Input type="date" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} /></div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" disabled={saving} onClick={() => handleCreateEvent('draft')}>Save Draft</Button>
                    <Button className="flex-1" disabled={saving} onClick={() => handleCreateEvent('published')}>Publish Event</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{alumniEvents.length}</p><p className="text-xs text-muted-foreground">Total Events (FY)</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{upcomingCount}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{totalRsvps}</p><p className="text-xs text-muted-foreground">Total RSVPs</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{attendanceRate}%</p><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
        </div>

        <div className="space-y-4">
          {alumniEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                      <Calendar className="h-7 w-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(event.date)}</span>
                        <span><MapPin className="mr-1 inline h-3 w-3" />{event.venue}</span>
                        <span>{event.isVirtual ? '🌐 Virtual' : '📍 In-person'}</span>
                        {event.maxCapacity && <span><Users className="mr-1 inline h-3 w-3" />Capacity: {event.maxCapacity}</span>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Badge variant="outline" className="capitalize">{event.type}</Badge>
                        {event.targetAudience?.segment && <Badge variant="secondary" className="capitalize">{event.targetAudience.segment}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={event.status === 'published' ? 'default' : event.status === 'completed' ? 'secondary' : 'outline'} className="capitalize">{event.status}</Badge>
                    <p className="text-sm text-muted-foreground">{Array.isArray(event.registrations) ? event.registrations.length : 0} RSVPs</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={loadData}><ClipboardList className="mr-1 h-3 w-3" />Attendees</Button>
                      <Button variant="outline" size="sm" onClick={loadData}><Eye className="mr-1 h-3 w-3" />Manage</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
