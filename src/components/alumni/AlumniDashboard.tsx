import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Mail, Calendar, Heart, GraduationCap, Briefcase, Gift, BarChart3, MapPin, Download, Plus, Send, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { alumniProfiles, alumniEvents, mentorshipPrograms, alumniDonations, progressionMetrics, alumniCommunications, alumniJobPostings } from '@/data/alumniMockData';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444'];

export default function AlumniDashboard() {
  const pm = progressionMetrics;
  const progressionPie = [
    { name: 'Employed', value: pm.employed },
    { name: 'Higher Education', value: pm.higherEducation },
    { name: 'Entrepreneur', value: pm.entrepreneur },
    { name: 'Others', value: pm.totalGraduates - pm.employed - pm.higherEducation - pm.entrepreneur },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni & Progression Portal</h1>
            <p className="text-muted-foreground">Directory, events, mentorship, and progression tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Send className="mr-2 h-4 w-4" />Send Newsletter</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Alumni</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Total Alumni</p><p className="text-2xl font-bold">15,200</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Globe className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Active Profiles</p><p className="text-2xl font-bold">8,450</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Heart className="h-8 w-8 text-pink-600" /><div><p className="text-xs text-muted-foreground">Active Mentors</p><p className="text-2xl font-bold">45</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Gift className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Donations (FY)</p><p className="text-2xl font-bold">₹60 L</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-amber-600" /><div><p className="text-xs text-muted-foreground">Response Rate</p><p className="text-2xl font-bold">{pm.responseRate}%</p></div></div></CardContent></Card>
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
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search alumni by name, batch, company..." className="pl-10" /></div>
            {alumniProfiles.map((a) => (
              <Card key={a.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{a.firstName[0]}{a.lastName[0]}</div>
                  <div>
                    <p className="font-semibold text-foreground">{a.firstName} {a.lastName}</p>
                    <p className="text-sm text-muted-foreground">{a.currentDesignation} at {a.currentCompany}</p>
                    <p className="text-xs text-muted-foreground">{a.program} • Batch {a.graduationYear} • {a.industry}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.verificationStatus === 'verified' ? 'default' : 'secondary'} className="capitalize">{a.verificationStatus}</Badge>
                  <Button variant="outline" size="sm">View</Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {alumniEvents.map((e) => (
              <Card key={e.id}><CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Calendar className="h-6 w-6 text-primary" /></div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{e.title}</h3>
                      <p className="text-sm text-muted-foreground">{e.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span><Calendar className="mr-1 inline h-3 w-3" />{e.date.toLocaleDateString('en-IN')}</span>
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
            {mentorshipPrograms.map((mp) => (
              <Card key={mp.id}><CardContent className="p-5">
                <h3 className="text-lg font-semibold text-foreground">{mp.title}</h3>
                <p className="text-sm text-muted-foreground">{mp.description}</p>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Duration: {mp.duration}</span>
                  <span>Mentors: {mp.mentors.length}</span>
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
              {alumniDonations.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{d.alumniName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.purpose}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">₹{d.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.donationDate.toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge variant="default" className="capitalize">{d.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="progression">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle>Graduate Progression</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart><Pie data={progressionPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({name,value}) => `${name}: ${value}`}>
                    {progressionPie.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle>Top Employers</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pm.topEmployers} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="companyName" type="category" width={100} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0,4,4,0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            {alumniJobPostings.map((j) => (
              <Card key={j.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Briefcase className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="font-semibold text-foreground">{j.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">{j.companyName} • {j.location}</p>
                    <p className="text-xs text-muted-foreground">{j.salaryRange} • Deadline: {j.applicationDeadline.toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{j.applications} applications</span>
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