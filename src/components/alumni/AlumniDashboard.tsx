import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Calendar, Heart, Briefcase, Gift, BarChart3, MapPin, Plus, Send, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444'];

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniDashboard() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [progressionMetrics, setProgressionMetrics] = useState<any>({ totalAlumni: 0, employedCount: 0, topEmployers: [] });
  const [alumniProfiles, setAlumniProfiles] = useState<any[]>([]);
  const [mentorshipPrograms, setMentorshipPrograms] = useState<any[]>([]);
  const [alumniDonations, setAlumniDonations] = useState<any[]>([]);
  const [alumniJobPostings, setAlumniJobPostings] = useState<any[]>([]);
  const [alumniEvents, setAlumniEvents] = useState<any[]>([]);

  const loadData = async () => {
    const [metrics, directory, events, mentorship, donations, jobs] = await Promise.all([
      fetchApi('/alumni/progression/metrics'),
      fetchApi('/alumni/directory'),
      fetchApi('/alumni/events'),
      fetchApi('/alumni/mentorship/programs'),
      fetchApi('/alumni/donations'),
      fetchApi('/alumni/jobs'),
    ]);
    setProgressionMetrics(metrics || {});
    setAlumniProfiles(Array.isArray(directory) ? directory : []);
    setAlumniEvents(Array.isArray(events) ? events : []);
    setMentorshipPrograms(Array.isArray(mentorship) ? mentorship : []);
    setAlumniDonations(Array.isArray(donations) ? donations : []);
    setAlumniJobPostings(Array.isArray(jobs) ? jobs : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load dashboard data', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const pm = progressionMetrics;
  const totalAlumni = alumniProfiles.length;
  const activeProfiles = alumniProfiles.filter((a: any) => String(a.currentCompany || '').trim().length > 0).length;
  const activeMentors = mentorshipPrograms.reduce((count: number, program: any) => count + (Array.isArray(program.mentors) ? program.mentors.length : 0), 0);
  const donationTotal = alumniDonations.reduce((sum: number, donation: any) => sum + Number(donation.amount || 0), 0);
  const responseRate = totalAlumni > 0 ? Math.round((Number(pm.employedCount || 0) / totalAlumni) * 100) : 0;

  const progressionPie = [
    { name: 'Employed', value: Number(pm.employedCount || 0) },
    { name: 'Other', value: Math.max(Number(pm.totalAlumni || 0) - Number(pm.employedCount || 0), 0) },
  ];

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumniProfiles;
    return alumniProfiles.filter((a: any) => {
      return String(a.name || '').toLowerCase().includes(q)
        || String(a.email || '').toLowerCase().includes(q)
        || String(a.currentCompany || '').toLowerCase().includes(q)
        || String(a.program || '').toLowerCase().includes(q);
    });
  }, [alumniProfiles, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni & Progression Portal</h1>
            <p className="text-muted-foreground">Directory, events, mentorship, and progression tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><Send className="mr-2 h-4 w-4" />Refresh Data</Button>
            <Button size="sm" onClick={loadData}><Plus className="mr-2 h-4 w-4" />Sync Alumni</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Total Alumni</p><p className="text-2xl font-bold">{totalAlumni.toLocaleString('en-IN')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Globe className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Active Profiles</p><p className="text-2xl font-bold">{activeProfiles.toLocaleString('en-IN')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Heart className="h-8 w-8 text-pink-600" /><div><p className="text-xs text-muted-foreground">Active Mentors</p><p className="text-2xl font-bold">{activeMentors.toLocaleString('en-IN')}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Gift className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Donations (FY)</p><p className="text-2xl font-bold">₹{(donationTotal / 100000).toFixed(1)} L</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-amber-600" /><div><p className="text-xs text-muted-foreground">Response Rate</p><p className="text-2xl font-bold">{responseRate}%</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="directory">
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="mentorship">Mentorship</TabsTrigger>
            <TabsTrigger value="donations">Donations</TabsTrigger>
            <TabsTrigger value="progression">Progression Data</TabsTrigger>
            <TabsTrigger value="jobs">Job Board</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search alumni by name, batch, company..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            {filteredProfiles.map((a: any) => (
              <Card key={a.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{String(a.name || 'A').slice(0, 1)}</div>
                  <div>
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-sm text-muted-foreground">{a.currentRole || 'Role not set'} at {a.currentCompany || 'Company not set'}</p>
                    <p className="text-xs text-muted-foreground">{a.program || 'Program N/A'} • Batch {a.graduationYear || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.currentCompany ? 'default' : 'secondary'}>{a.currentCompany ? 'active' : 'basic'}</Badge>
                  <Button variant="outline" size="sm" onClick={loadData}>View</Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {alumniEvents.map((e: any) => (
              <Card key={e.id}><CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Calendar className="h-6 w-6 text-primary" /></div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{e.title}</h3>
                      <p className="text-sm text-muted-foreground">{e.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(e.date)}</span>
                        <span><MapPin className="mr-1 inline h-3 w-3" />{e.venue}</span>
                        <span>{e.isVirtual ? '🌐 Virtual' : '📍 In-person'}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={e.status === 'published' ? 'default' : 'secondary'} className="capitalize">{e.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="mentorship" className="space-y-4">
            {mentorshipPrograms.map((mp: any) => (
              <Card key={mp.id}><CardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground">{mp.title}</h3>
                <p className="text-sm text-muted-foreground">{mp.description}</p>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Duration: {mp.duration}</span>
                  <span>Mentors: {Array.isArray(mp.mentors) ? mp.mentors.length : 0}</span>
                  <span>Max Mentees: {mp.maxMentees}</span>
                </div>
                <Badge className="mt-2 capitalize">{mp.status}</Badge>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="donations">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Donor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {alumniDonations.map((d: any) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{d.donorName || 'Unknown Donor'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.purpose}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(d.donatedAt || d.date)}</td>
                  <td className="px-4 py-3"><Badge variant="default" className="capitalize">{d.status || 'completed'}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="progression">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card><CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart><Pie data={progressionPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({name,value}) => `${name}: ${value}`}>
                    {progressionPie.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Array.isArray(pm.topEmployers) ? pm.topEmployers : []} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0,4,4,0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            {alumniJobPostings.map((j: any) => (
              <Card key={j.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Briefcase className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="font-semibold text-foreground">{j.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">{j.companyName} • {j.location}</p>
                    <p className="text-xs text-muted-foreground">{j.salaryRange || 'Salary not listed'} • Deadline: {formatDate(j.applicationDeadline)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{Number(j.applications || 0)} applications</span>
                  <Badge variant="default" className="capitalize">{j.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
