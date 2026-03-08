import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays, Users, Megaphone, Send, Plus, Trophy,
  Laptop, Music, Dumbbell, BookOpen, Eye
} from 'lucide-react';
import { interDeptEvents } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inter-Department Coordination</h1>
            <p className="text-muted-foreground">Cross-department events, communication, and activities</p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline"><Megaphone className="mr-1 h-4 w-4" />Broadcast to All HODs</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Broadcast Message</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Subject</Label><Input placeholder="Message subject..." /></div>
                  <div><Label>Message</Label><Textarea placeholder="Type your message to all HODs..." rows={4} /></div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" />Email</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" />WhatsApp</label>
                  </div>
                  <Button className="w-full" onClick={() => toast({ title: 'Broadcast Sent', description: 'Message sent to all department HODs' })}>
                    <Send className="mr-1 h-4 w-4" />Send
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" />Create Event</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Inter-Department Event</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Event Title</Label><Input placeholder="e.g., TechVista 2026" /></div>
                  <div><Label>Type</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="cultural">Cultural</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="seminar">Seminar</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" /></div>
                  <div><Label>Budget (₹)</Label><Input type="number" placeholder="e.g., 500000" /></div>
                  <div><Label>Coordinator</Label><Input placeholder="Faculty coordinator name" /></div>
                  <Button className="w-full" onClick={() => toast({ title: 'Event Created' })}>Create Event</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Planned Events', count: interDeptEvents.filter(e => e.status === 'planned').length, icon: CalendarDays, color: 'text-blue-600 bg-blue-100' },
            { label: 'Ongoing', count: interDeptEvents.filter(e => e.status === 'ongoing').length, icon: Trophy, color: 'text-green-600 bg-green-100' },
            { label: 'Completed', count: interDeptEvents.filter(e => e.status === 'completed').length, icon: Users, color: 'text-primary bg-primary/10' },
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

        {/* Events List */}
        <div className="space-y-4">
          {interDeptEvents.map(event => {
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
                    <Button variant="ghost" size="sm" className="shrink-0"><Eye className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
