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
import { alumniEvents } from '@/data/alumniMockData';

export default function AlumniEvents() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Events & Reunions</h1>
            <p className="text-muted-foreground">Create events, track RSVPs, and manage attendee lists</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export Attendees</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Event</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Alumni Event</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Event Title</Label><Input placeholder="e.g. Silver Jubilee Reunion" /></div>
                  <div><Label>Description</Label><Textarea rows={3} /></div>
                  <div><Label>Type</Label>
                    <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="reunion">Reunion</SelectItem><SelectItem value="networking">Networking</SelectItem><SelectItem value="webinar">Webinar</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="fundraising">Fundraising</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Date</Label><Input type="date" /></div>
                    <div><Label>Max Capacity</Label><Input type="number" /></div>
                  </div>
                  <div><Label>Venue</Label><Input placeholder="Location or online link" /></div>
                  <div className="flex items-center gap-2"><Checkbox id="virtual" /><Label htmlFor="virtual">Virtual Event</Label></div>
                  <div><Label>Target Audience</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>
                      <SelectItem value="all">All Alumni</SelectItem><SelectItem value="batch">Specific Batch</SelectItem><SelectItem value="program">Specific Program</SelectItem><SelectItem value="industry">Specific Industry</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div><Label>Registration Deadline</Label><Input type="date" /></div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">Save Draft</Button>
                    <Button className="flex-1">Publish Event</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{alumniEvents.length + 6}</p><p className="text-xs text-muted-foreground">Total Events (FY)</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{alumniEvents.filter(e => e.status === 'published').length}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">1,240</p><p className="text-xs text-muted-foreground">Total RSVPs</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">78%</p><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
        </div>

        {/* Event cards */}
        <div className="space-y-4">
          {alumniEvents.map(event => (
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
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span><Calendar className="inline h-3 w-3 mr-1" />{event.date.toLocaleDateString('en-IN')}</span>
                        <span><MapPin className="inline h-3 w-3 mr-1" />{event.venue}</span>
                        <span>{event.isVirtual ? '🌐 Virtual' : '📍 In-person'}</span>
                        {event.maxCapacity && <span><Users className="inline h-3 w-3 mr-1" />Capacity: {event.maxCapacity}</span>}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="capitalize">{event.type}</Badge>
                        {event.targetAudience.graduationYears && <Badge variant="secondary">Batch {event.targetAudience.graduationYears.join(', ')}</Badge>}
                        {event.targetAudience.allAlumni && <Badge variant="secondary">All Alumni</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={event.status === 'published' ? 'default' : event.status === 'completed' ? 'secondary' : 'outline'} className="capitalize">{event.status}</Badge>
                    <p className="text-sm text-muted-foreground">{event.registrations.length} RSVPs</p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm"><ClipboardList className="mr-1 h-3 w-3" />Attendees</Button>
                      <Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" />Manage</Button>
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
