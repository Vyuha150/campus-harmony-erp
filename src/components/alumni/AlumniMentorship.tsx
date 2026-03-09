import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Plus, Users, UserCheck, Star, MessageSquare, Search, ArrowRightLeft } from 'lucide-react';
import { mentorshipPrograms } from '@/data/alumniMockData';

const pendingMentees = [
  { id: 'ME001', name: 'Anita Sharma', program: 'B.Tech CSE', year: 4, interests: ['AI/ML', 'Product Management'], goals: ['Career transition to PM'], preferredIndustries: ['Technology', 'Consulting'], status: 'seeking_mentor' as const },
  { id: 'ME002', name: 'Rohan Gupta', program: 'MBA', year: 2, interests: ['Entrepreneurship', 'Fintech'], goals: ['Launch own startup'], preferredIndustries: ['Startups', 'Finance'], status: 'seeking_mentor' as const },
  { id: 'ME003', name: 'Kavya Nair', program: 'B.Tech ECE', year: 3, interests: ['Hardware Design', 'IoT'], goals: ['MS abroad'], preferredIndustries: ['Technology', 'Research'], status: 'seeking_mentor' as const },
];

export default function AlumniMentorship() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mentorship Programs</h1>
            <p className="text-muted-foreground">Match alumni mentors with student mentees, track sessions and feedback</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Program</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Mentorship Program</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Program Title</Label><Input placeholder="e.g. Career Launchpad 2026" /></div>
                <div><Label>Description</Label><Textarea rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="career">Career Guidance</SelectItem><SelectItem value="entrepreneurship">Entrepreneurship</SelectItem><SelectItem value="skills">Skills Development</SelectItem><SelectItem value="industry">Industry Specific</SelectItem></SelectContent></Select></div>
                  <div><Label>Duration</Label><Input placeholder="e.g. 3 months" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start Date</Label><Input type="date" /></div>
                  <div><Label>Max Mentees</Label><Input type="number" /></div>
                </div>
                <Button className="w-full">Create Program</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><Heart className="h-8 w-8 text-pink-600" /><div><p className="text-2xl font-bold text-foreground">45</p><p className="text-xs text-muted-foreground">Active Mentors</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">78</p><p className="text-xs text-muted-foreground">Active Mentees</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><ArrowRightLeft className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">62</p><p className="text-xs text-muted-foreground">Active Matches</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Star className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">4.6</p><p className="text-xs text-muted-foreground">Avg Rating</p></div></CardContent></Card>
        </div>

        <Tabs defaultValue="programs">
          <TabsList>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="mentors">Mentors</TabsTrigger>
            <TabsTrigger value="pending">Pending Mentees ({pendingMentees.length})</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="mt-4 space-y-4">
            {mentorshipPrograms.map(mp => (
              <Card key={mp.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{mp.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{mp.description}</p>
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Duration: {mp.duration}</span>
                        <span>Mentors: {mp.mentors.length}</span>
                        <span>Max Mentees: {mp.maxMentees}</span>
                        <span>Start: {mp.startDate.toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <Badge variant={mp.status === 'active' ? 'default' : 'secondary'} className="capitalize">{mp.status}</Badge>
                  </div>
                  {mp.mentors.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Mentors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {mp.mentors.map(m => (
                          <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium text-foreground">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.designation} at {m.company}</p>
                              <div className="flex gap-1 mt-1">{m.expertise.map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}</div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">{m.currentMentees}/{m.maxMentees} mentees</p>
                              <Badge variant={m.status === 'active' ? 'default' : m.status === 'full' ? 'secondary' : 'destructive'} className="capitalize mt-1">{m.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="mentors" className="mt-4">
            <Card><CardContent className="p-6 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Mentor Directory</h3>
              <p className="text-sm text-muted-foreground">Browse all registered mentors, their expertise, availability, and active mentees</p>
              <div className="mt-4 relative max-w-md mx-auto"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search mentors by name, industry, expertise..." className="pl-10" /></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pendingMentees.map(me => (
              <Card key={me.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-foreground">{me.name}</p>
                    <p className="text-sm text-muted-foreground">{me.program} – Year {me.year}</p>
                    <div className="flex gap-1 mt-1">{me.interests.map((int, i) => <Badge key={i} variant="outline" className="text-xs">{int}</Badge>)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Goals: {me.goals.join(', ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm"><ArrowRightLeft className="mr-1 h-3 w-3" />Match Mentor</Button>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="feedback" className="mt-4">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Mentorship Feedback</h3>
              <p className="text-sm text-muted-foreground">View feedback from mentors and mentees across all programs</p>
              <Button className="mt-4">View All Feedback</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
