import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Clock, MapPin, Plus, Users } from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type MeetingItem = {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  attendees?: string[];
  meetingType?: string;
  agenda?: string;
  minutes?: string;
  status?: string;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DeanMeetings() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(null);
  const [form, setForm] = useState({
    title: '',
    meetingType: 'dean_council',
    date: '',
    time: '',
    venue: '',
    status: 'upcoming',
    attendees: '',
    agenda: '',
    minutes: '',
  });

  useEffect(() => {
    fetchApi<MeetingItem[]>('/dean/meetings')
      .then((data) => setMeetings(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('API request failed', error);
        toast({ title: 'Unable to load meetings', description: error?.message || 'Please retry', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const resetForm = () => {
    setForm({
      title: '',
      meetingType: 'dean_council',
      date: '',
      time: '',
      venue: '',
      status: 'upcoming',
      attendees: '',
      agenda: '',
      minutes: '',
    });
  };

  const toAttendeeJson = (raw: string) => raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const createMeeting = async () => {
    if (!form.title.trim() || !form.date || !form.time || !form.venue.trim()) {
      toast({ title: 'Missing fields', description: 'Title, date, time and venue are required.', variant: 'destructive' });
      return;
    }

    try {
      const created = await postApi<MeetingItem>('/dean/meetings', {
        title: form.title,
        meetingType: form.meetingType,
        date: form.date,
        time: form.time,
        venue: form.venue,
        status: form.status,
        attendees: toAttendeeJson(form.attendees),
        agendaItems: form.agenda ? [form.agenda] : [],
        minutes: form.minutes || null,
      });

      setMeetings((prev) => [created, ...prev]);
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Meeting created', description: created.title });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create meeting', variant: 'destructive' });
    }
  };

  const openEdit = (meeting: MeetingItem) => {
    setSelectedMeeting(meeting);
    setForm({
      title: meeting.title || '',
      meetingType: meeting.meetingType || 'dean_council',
      date: meeting.date ? new Date(meeting.date).toISOString().slice(0, 10) : '',
      time: meeting.time || '',
      venue: meeting.venue || '',
      status: meeting.status || 'upcoming',
      attendees: Array.isArray(meeting.attendees) ? meeting.attendees.join(', ') : '',
      agenda: meeting.agenda || '',
      minutes: meeting.minutes || '',
    });
    setEditOpen(true);
  };

  const updateMeeting = async () => {
    if (!selectedMeeting) return;

    try {
      const updated = await putApi<MeetingItem>(`/dean/meetings/${selectedMeeting.id}`, {
        title: form.title,
        meetingType: form.meetingType,
        date: form.date,
        time: form.time,
        venue: form.venue,
        status: form.status,
        attendees: toAttendeeJson(form.attendees),
        agendaItems: form.agenda ? [form.agenda] : [],
        minutes: form.minutes || null,
      });

      setMeetings((prev) => prev.map((meeting) => (meeting.id === selectedMeeting.id ? updated : meeting)));
      setEditOpen(false);
      setSelectedMeeting(null);
      resetForm();
      toast({ title: 'Meeting updated', description: updated.title });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update meeting', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dean Meetings</h1>
            <p className="text-muted-foreground">Review upcoming and completed coordination meetings.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />Create Meeting
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Meetings</p>
              <p className="text-2xl font-bold">{meetings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600">{meetings.filter((m) => (m.status || 'scheduled') === 'scheduled').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{meetings.filter((m) => (m.status || '') === 'completed').length}</p>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">Loading meetings...</CardContent>
          </Card>
        )}

        {!loading && meetings.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No meetings found.</CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{meeting.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(meeting.date)}</span>
                  {meeting.time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{meeting.time}</span>}
                  {meeting.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{meeting.venue}</span>}
                  {Array.isArray(meeting.attendees) && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{meeting.attendees.length} attendees</span>}
                  <Badge variant="outline" className="capitalize">{meeting.meetingType || 'meeting'}</Badge>
                  <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{meeting.status || 'scheduled'}</Badge>
                </div>
                {meeting.agenda && <p className="text-sm text-foreground">{meeting.agenda}</p>}
                <div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(meeting)}>Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Meeting</DialogTitle>
              <DialogDescription>Add a new dean-level meeting.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Meeting Type</Label>
                <Select value={form.meetingType} onValueChange={(value) => setForm((p) => ({ ...p, meetingType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dean_council">Dean Council</SelectItem>
                    <SelectItem value="inter_department">Inter-Department</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
                <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} /></div>
              </div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Attendees (comma separated)</Label><Input value={form.attendees} onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))} /></div>
              <div><Label>Agenda</Label><Textarea value={form.agenda} onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))} /></div>
              <div><Label>Minutes</Label><Textarea value={form.minutes} onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))} /></div>
              <Button className="w-full" onClick={createMeeting}>Create Meeting</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
              <DialogDescription>Update meeting details and status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Meeting Type</Label>
                <Select value={form.meetingType} onValueChange={(value) => setForm((p) => ({ ...p, meetingType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dean_council">Dean Council</SelectItem>
                    <SelectItem value="inter_department">Inter-Department</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
                <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} /></div>
              </div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Attendees (comma separated)</Label><Input value={form.attendees} onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))} /></div>
              <div><Label>Agenda</Label><Textarea value={form.agenda} onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))} /></div>
              <div><Label>Minutes</Label><Textarea value={form.minutes} onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))} /></div>
              <Button className="w-full" onClick={updateMeeting}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
