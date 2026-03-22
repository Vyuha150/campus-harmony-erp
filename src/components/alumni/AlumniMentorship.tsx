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
import { useEffect, useMemo, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniMentorship() {
  const { toast } = useToast();
  const [mentorshipPrograms, setMentorshipPrograms] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('career');
  const [duration, setDuration] = useState('3 months');
  const [startDate, setStartDate] = useState('');
  const [maxMentees, setMaxMentees] = useState('20');

  const loadData = async () => {
    const [programs, fetchedMatches] = await Promise.all([
      fetchApi<any[]>('/alumni/mentorship/programs'),
      fetchApi<any[]>('/alumni/mentorship/matches'),
    ]);
    setMentorshipPrograms(Array.isArray(programs) ? programs : []);
    setMatches(Array.isArray(fetchedMatches) ? fetchedMatches : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load mentorship data', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const mentorshipStats = useMemo(() => {
    const mentors = mentorshipPrograms.reduce((sum, p) => sum + (Array.isArray(p.mentors) ? p.mentors.length : 0), 0);
    const mentees = mentorshipPrograms.reduce((sum, p) => sum + (Array.isArray(p.mentees) ? p.mentees.length : 0), 0);
    const ratings = mentorshipPrograms.flatMap((p) => Array.isArray(p.mentors) ? p.mentors.map((m: any) => Number(m.rating || 0)) : []);
    const averageRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '0.0';
    return {
      activeMentors: mentors,
      activeMentees: mentees,
      activeMatches: matches.length,
      averageRating,
    };
  }, [mentorshipPrograms, matches]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('career');
    setDuration('3 months');
    setStartDate('');
    setMaxMentees('20');
  };

  const handleCreateProgram = async () => {
    if (!title.trim() || !description.trim() || !startDate) {
      toast({ title: 'Missing fields', description: 'Title, description and start date are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/alumni/mentorship/programs', {
        title: title.trim(),
        description: description.trim(),
        type,
        duration: duration.trim() || '3 months',
        maxMentees: Number(maxMentees || 0),
        startDate: new Date(startDate).toISOString(),
        status: 'active',
      });
      await loadData();
      setOpen(false);
      resetForm();
      toast({ title: 'Program created', description: 'Mentorship program saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create program.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mentorship Programs</h1>
            <p className="text-muted-foreground">Match alumni mentors with student mentees, and track outcomes</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Program</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Mentorship Program</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Program Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Career Launchpad 2026" /></div>
                <div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="career">Career Guidance</SelectItem><SelectItem value="entrepreneurship">Entrepreneurship</SelectItem><SelectItem value="skills">Skills Development</SelectItem><SelectItem value="industry">Industry Specific</SelectItem></SelectContent></Select></div>
                  <div><Label>Duration</Label><Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 months" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div><Label>Max Mentees</Label><Input type="number" value={maxMentees} onChange={(e) => setMaxMentees(e.target.value)} /></div>
                </div>
                <Button className="w-full" disabled={saving} onClick={handleCreateProgram}>Create Program</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4"><Heart className="h-8 w-8 text-pink-600" /><div><p className="text-2xl font-bold text-foreground">{mentorshipStats.activeMentors}</p><p className="text-xs text-muted-foreground">Active Mentors</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">{mentorshipStats.activeMentees}</p><p className="text-xs text-muted-foreground">Active Mentees</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><ArrowRightLeft className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">{mentorshipStats.activeMatches}</p><p className="text-xs text-muted-foreground">Active Matches</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Star className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">{mentorshipStats.averageRating}</p><p className="text-xs text-muted-foreground">Avg Rating</p></div></CardContent></Card>
        </div>

        <Tabs defaultValue="programs">
          <TabsList>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="matches">Matches ({matches.length})</TabsTrigger>
            <TabsTrigger value="mentors">Mentors</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="mt-4 space-y-4">
            {mentorshipPrograms.map((mp) => {
              const mentors = Array.isArray(mp.mentors) ? mp.mentors : [];
              return (
                <Card key={mp.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{mp.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{mp.description}</p>
                        <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                          <span>Duration: {mp.duration}</span>
                          <span>Mentors: {mentors.length}</span>
                          <span>Max Mentees: {mp.maxMentees}</span>
                          <span>Start: {formatDate(mp.startDate)}</span>
                        </div>
                      </div>
                      <Badge variant={mp.status === 'active' ? 'default' : 'secondary'} className="capitalize">{mp.status}</Badge>
                    </div>
                    {mentors.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">Mentors</h4>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {mentors.map((m: any, idx: number) => (
                            <div key={`${mp.id}-${idx}`} className="flex items-center justify-between rounded-lg border p-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{m.name || 'Mentor'}</p>
                                <p className="text-xs text-muted-foreground">{m.designation || 'Role'} at {m.company || 'Company'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{Number(m.currentMentees || 0)}/{Number(m.maxMentees || mp.maxMentees || 0)} mentees</p>
                                <Badge variant="outline" className="mt-1 capitalize">{m.status || 'active'}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="matches" className="mt-4 space-y-3">
            {matches.map((me, idx) => (
              <Card key={`${me.programId || 'program'}-${me.menteeId || idx}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-foreground">{me.menteeName || me.mentee || 'Mentee'} ↔ {me.mentorName || me.mentor || 'Mentor'}</p>
                    <p className="text-sm text-muted-foreground">Program: {me.programTitle || 'Mentorship Program'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm"><ArrowRightLeft className="mr-1 h-3 w-3" />Track</Button>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="mentors" className="mt-4">
            <Card><CardContent className="p-6 text-center">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Mentor Directory</h3>
              <p className="text-sm text-muted-foreground">Browse mentors, expertise, availability, and active mentees</p>
              <div className="relative mx-auto mt-4 max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search mentors by name, industry, expertise..." className="pl-10" /></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="feedback" className="mt-4">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Mentorship Feedback</h3>
              <p className="text-sm text-muted-foreground">Feedback capture endpoint is not exposed yet in this API module.</p>
              <Button className="mt-4" onClick={loadData}>Refresh</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
