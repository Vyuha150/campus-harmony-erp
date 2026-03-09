import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, MapPin, Trophy, Users, Plus, Download, Eye } from 'lucide-react';
import { sportsEvents } from '@/data/sportsMockData';

export default function SportsEvents() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sports Events & Tournaments</h1>
            <p className="text-muted-foreground">Schedule events, manage registrations, and track results</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export Results</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Event</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Sports Event</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Event Name</Label><Input placeholder="e.g. Annual Sports Day 2026" /></div>
                  <div><Label>Type</Label><Input placeholder="Tournament / Championship / Friendly / Trials" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Start Date</Label><Input type="date" /></div>
                    <div><Label>End Date</Label><Input type="date" /></div>
                  </div>
                  <div><Label>Venue</Label><Input placeholder="Location" /></div>
                  <div><Label>Sports Included</Label><Input placeholder="Comma separated list" /></div>
                  <div><Label>Description</Label><Textarea placeholder="Event details..." /></div>
                  <Button className="w-full">Create Event</Button>
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
                      <span><Calendar className="inline h-4 w-4 mr-1" />{event.startDate.toLocaleDateString('en-IN')} – {event.endDate.toLocaleDateString('en-IN')}</span>
                      <span><MapPin className="inline h-4 w-4 mr-1" />{event.venue}</span>
                      <span><Users className="inline h-4 w-4 mr-1" />{event.participants.length} registered</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.sports.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" />Details</Button>
                    {event.status === 'registration' && <Button size="sm">Manage Registration</Button>}
                    {event.status === 'ongoing' && <Button size="sm">Update Results</Button>}
                    {event.status === 'completed' && <Button variant="outline" size="sm">View Results</Button>}
                  </div>
                </div>

                {event.results.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Results</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {event.results.slice(0, 3).map((r, i) => (
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
      </div>
    </DashboardLayout>
  );
}
