import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, MapPin, Trophy, Users, Plus, Download, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

export default function SportsEvents() {
  const [sportsEvents, setSportsEvents] = useState<any>([]);
  const [selectedEventResults, setSelectedEventResults] = useState<any[] | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultTarget, setResultTarget] = useState<any | null>(null);
  const [resultForm, setResultForm] = useState({
    studentName: '',
    sport: '',
    position: '',
    medal: ''
  });
  const [_apiLoading, _setApiLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    type: 'tournament',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    venue: '',
    sports: '',
    organizer: 'Sports Department'
  });

  const loadEvents = async () => {
    try {
      const data = await fetchApi('/sports/events');
      setSportsEvents(data);
    } catch (error) {
      console.error('API request failed', error);
      toast({ title: 'Failed to load events', description: String((error as any)?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      _setApiLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const createEvent = async () => {
    if (!form.name.trim() || !form.venue.trim()) {
      toast({ title: 'Missing fields', description: 'Event name and venue are required.', variant: 'destructive' });
      return;
    }
    try {
      await postApi('/sports/events', {
        name: form.name.trim(),
        type: form.type,
        sports: form.sports.split(',').map((sport) => sport.trim()).filter(Boolean),
        startDate: form.startDate,
        endDate: form.endDate,
        venue: form.venue.trim(),
        organizer: form.organizer.trim(),
        participants: [],
        results: [],
        status: 'planning'
      });
      setForm({
        name: '',
        type: 'tournament',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        venue: '',
        sports: '',
        organizer: 'Sports Department'
      });
      await loadEvents();
      toast({ title: 'Event created', description: 'Sports event created successfully.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const viewResults = async (eventId: string) => {
    try {
      const data = await fetchApi<{ results?: any[] }>(`/sports/events/${eventId}/results`);
      setSelectedEventResults(Array.isArray(data?.results) ? data.results : []);
    } catch (error: any) {
      toast({ title: 'Failed to load results', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const exportResults = () => {
    const rows = sportsEvents.flatMap((event: any) => {
      const results = Array.isArray(event.results) ? event.results : [];
      if (results.length === 0) {
        return [{
          eventName: event.name,
          status: event.status,
          sport: '',
          studentName: '',
          position: '',
          medal: ''
        }];
      }
      return results.map((result: any) => ({
        eventName: event.name,
        status: event.status,
        sport: result.sport || '',
        studentName: result.studentName || '',
        position: result.position ?? '',
        medal: result.medal || ''
      }));
    });
    const header = ['eventName', 'status', 'sport', 'studentName', 'position', 'medal'];
    const csv = [
      header.join(','),
      ...rows.map((row: any) => header.map((key) => JSON.stringify(row[key] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sports-event-results-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: 'Event results exported as CSV.' });
  };

  const deleteEvent = async (eventId: string, eventName: string) => {
    if (!window.confirm(`Delete event ${eventName}?`)) return;
    try {
      await deleteApi(`/sports/events/${eventId}`);
      setSportsEvents((prev: any[]) => prev.filter((event) => event.id !== eventId));
      toast({ title: 'Event deleted', description: 'Sports event removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const openResultDialog = (event: any) => {
    setResultTarget(event);
    setResultForm({ studentName: '', sport: '', position: '', medal: '' });
    setIsResultOpen(true);
  };

  const saveResult = async () => {
    if (!resultTarget) return;
    if (!resultForm.studentName.trim() || !resultForm.sport.trim() || !resultForm.position.trim()) {
      toast({ title: 'Missing fields', description: 'Student name, sport, and position are required.', variant: 'destructive' });
      return;
    }
    try {
      const existingResults = Array.isArray(resultTarget.results) ? resultTarget.results : [];
      const updatedPayload = {
        name: resultTarget.name,
        type: resultTarget.type,
        sports: Array.isArray(resultTarget.sports) ? resultTarget.sports : [],
        startDate: resultTarget.startDate,
        endDate: resultTarget.endDate,
        venue: resultTarget.venue,
        organizer: resultTarget.organizer,
        participants: Array.isArray(resultTarget.participants) ? resultTarget.participants : [],
        results: [
          ...existingResults,
          {
            studentName: resultForm.studentName.trim(),
            sport: resultForm.sport.trim(),
            position: Number(resultForm.position),
            medal: resultForm.medal.trim() || null
          }
        ],
        status: 'completed'
      };
      const updated = await putApi(`/sports/events/${resultTarget.id}`, updatedPayload);
      setSportsEvents((prev: any[]) => prev.map((item) => item.id === resultTarget.id ? updated : item));
      setIsResultOpen(false);
      setResultTarget(null);
      toast({ title: 'Results updated', description: 'Event results saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sports Events & Tournaments</h1>
            <p className="text-muted-foreground">Schedule events, manage registrations, and track results</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportResults}><Download className="mr-2 h-4 w-4" />Export Results</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Event</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Sports Event</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Event Name</Label><Input placeholder="e.g. Annual Sports Day 2026" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
                  <div><Label>Type</Label><Input placeholder="Tournament / Championship / Friendly / Trials" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></div>
                    <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} /></div>
                  </div>
                  <div><Label>Venue</Label><Input placeholder="Location" value={form.venue} onChange={(e) => setForm((prev) => ({ ...prev, venue: e.target.value }))} /></div>
                  <div><Label>Sports Included</Label><Input placeholder="Comma separated list" value={form.sports} onChange={(e) => setForm((prev) => ({ ...prev, sports: e.target.value }))} /></div>
                  <Button className="w-full" onClick={createEvent}>Create Event</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{sportsEvents.length}</p><p className="text-xs text-muted-foreground">Total Events</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{sportsEvents.filter(e => e.status === 'ongoing').length}</p><p className="text-xs text-muted-foreground">Ongoing</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{sportsEvents.filter(e => e.status === 'registration').length}</p><p className="text-xs text-muted-foreground">Open Registration</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{sportsEvents.filter(e => e.status === 'planning').length}</p><p className="text-xs text-muted-foreground">Planning</p></CardContent></Card>
        </div>

        {/* Events list */}
        <div className="space-y-4">
          {sportsEvents.map(event => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-semibold text-foreground">{event.name}</h3>
                      <Badge variant={event.status === 'ongoing' ? 'default' : event.status === 'registration' ? 'secondary' : event.status === 'completed' ? 'default' : 'outline'} className="capitalize">{event.status}</Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span><Calendar className="inline h-4 w-4 mr-1" />{new Date(event.startDate).toLocaleDateString('en-IN')} – {new Date(event.endDate).toLocaleDateString('en-IN')}</span>
                      <span><MapPin className="inline h-4 w-4 mr-1" />{event.venue}</span>
                      <span><Users className="inline h-4 w-4 mr-1" />{(Array.isArray(event.participants) ? event.participants.length : 0)} registered</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(Array.isArray(event.sports) ? event.sports : []).map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewResults(event.id)}><Eye className="mr-1 h-3 w-3" />Details</Button>
                    <Button variant="outline" size="sm" onClick={() => openResultDialog(event)}>Update Results</Button>
                    {event.status === 'completed' && <Button variant="outline" size="sm" onClick={() => viewResults(event.id)}>View Results</Button>}
                    <Button variant="destructive" size="sm" onClick={() => deleteEvent(event.id, event.name)}>Delete</Button>
                  </div>
                </div>

                {(Array.isArray(event.results) ? event.results : []).length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Results</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {(Array.isArray(event.results) ? event.results : []).slice(0, 3).map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {r.medal && <Trophy className={`h-4 w-4 ${r.medal === 'gold' ? 'text-amber-500' : r.medal === 'silver' ? 'text-gray-400' : 'text-orange-700'}`} />}
                          <span className="text-foreground">{r.studentName}</span>
                          <span className="text-muted-foreground">– {r.sport} #{r.position}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedEventResults && (
          <Card>
            <CardHeader><CardTitle>Selected Event Results</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedEventResults.length === 0 && <p className="text-sm text-muted-foreground">No results published for this event.</p>}
              {selectedEventResults.map((result: any, index: number) => (
                <div key={index} className="rounded-md border p-3 text-sm">
                  <p className="font-medium text-foreground">{result.studentName || 'Participant'} - {result.sport || 'Sport'}</p>
                  <p className="text-muted-foreground">Position: {result.position ?? '-'} {result.medal ? `• Medal: ${result.medal}` : ''}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Update Event Results</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div><Label>Student Name</Label><Input value={resultForm.studentName} onChange={(e) => setResultForm((prev) => ({ ...prev, studentName: e.target.value }))} /></div>
              <div><Label>Sport</Label><Input value={resultForm.sport} onChange={(e) => setResultForm((prev) => ({ ...prev, sport: e.target.value }))} /></div>
              <div><Label>Position</Label><Input type="number" value={resultForm.position} onChange={(e) => setResultForm((prev) => ({ ...prev, position: e.target.value }))} /></div>
              <div><Label>Medal (optional)</Label><Input placeholder="gold/silver/bronze" value={resultForm.medal} onChange={(e) => setResultForm((prev) => ({ ...prev, medal: e.target.value }))} /></div>
              <Button onClick={saveResult}>Save Result</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
