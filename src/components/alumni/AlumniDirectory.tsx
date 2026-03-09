import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Filter, Download, Edit, Eye, CheckCircle, XCircle, Merge, Users, MapPin, Briefcase, GraduationCap, Globe } from 'lucide-react';
import { alumniProfiles } from '@/data/alumniMockData';

export default function AlumniDirectory() {
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = alumniProfiles.filter(a => {
    const matchSearch = `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()) || (a.currentCompany || '').toLowerCase().includes(search.toLowerCase());
    const matchBatch = batchFilter === 'all' || a.graduationYear.toString() === batchFilter;
    const matchIndustry = industryFilter === 'all' || a.industry === industryFilter;
    const matchStatus = statusFilter === 'all' || a.verificationStatus === statusFilter;
    return matchSearch && matchBatch && matchIndustry && matchStatus;
  });

  const alumni = selected ? alumniProfiles.find(a => a.id === selected) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni Directory</h1>
            <p className="text-muted-foreground">Search, verify, and manage alumni profiles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button variant="outline" size="sm"><Merge className="mr-2 h-4 w-4" />Merge Duplicates</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Alumni</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add Alumni Record</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>First Name</Label><Input /></div>
                    <div><Label>Last Name</Label><Input /></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Program</Label><Input placeholder="e.g. B.Tech CSE" /></div>
                    <div><Label>Graduation Year</Label><Input type="number" placeholder="e.g. 2020" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Current Company</Label><Input /></div>
                    <div><Label>Designation</Label><Input /></div>
                  </div>
                  <div><Label>Industry</Label><Input placeholder="e.g. Technology" /></div>
                  <div><Label>Location</Label><Input placeholder="City, Country" /></div>
                  <Button className="w-full">Add Alumni</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">15,200</p><p className="text-xs text-muted-foreground">Total Alumni</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">8,450</p><p className="text-xs text-muted-foreground">Verified Profiles</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">342</p><p className="text-xs text-muted-foreground">Pending Verification</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">24</p><p className="text-xs text-muted-foreground">Countries</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, email, company..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Batches</SelectItem><SelectItem value="2024">2024</SelectItem><SelectItem value="2023">2023</SelectItem><SelectItem value="2020">2020</SelectItem><SelectItem value="2018">2018</SelectItem><SelectItem value="2015">2015</SelectItem><SelectItem value="2010">2010</SelectItem></SelectContent>
          </Select>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Industry" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Industries</SelectItem><SelectItem value="Technology">Technology</SelectItem><SelectItem value="Consulting">Consulting</SelectItem><SelectItem value="Startups">Startups</SelectItem><SelectItem value="Finance">Finance</SelectItem></SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
          </Select>
        </div>

        {/* List + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {filtered.map(a => (
              <Card key={a.id} className={`cursor-pointer transition-colors ${selected === a.id ? 'ring-2 ring-primary' : 'hover:bg-muted/30'}`} onClick={() => setSelected(a.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{a.firstName[0]}{a.lastName[0]}</div>
                    <div>
                      <p className="font-semibold text-foreground">{a.firstName} {a.lastName}</p>
                      <p className="text-sm text-muted-foreground">{a.currentDesignation} at {a.currentCompany}</p>
                      <p className="text-xs text-muted-foreground">{a.program} • Batch {a.graduationYear} • {a.industry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.verificationStatus === 'verified' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                    <Badge variant={a.verificationStatus === 'verified' ? 'default' : 'secondary'} className="capitalize">{a.verificationStatus}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            {alumni ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center justify-between"><span>{alumni.firstName} {alumni.lastName}</span><Button variant="outline" size="sm"><Edit className="mr-1 h-3 w-3" />Edit</Button></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Email:</span><p className="text-foreground font-medium">{alumni.email}</p></div>
                    <div><span className="text-muted-foreground">Phone:</span><p className="text-foreground font-medium">{alumni.phone || 'N/A'}</p></div>
                    <div><span className="text-muted-foreground">Program:</span><p className="text-foreground font-medium">{alumni.program}</p></div>
                    <div><span className="text-muted-foreground">Batch:</span><p className="text-foreground font-medium">{alumni.graduationYear}</p></div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Current Position</h4>
                    <p className="text-sm text-foreground"><Briefcase className="inline h-3 w-3 mr-1" />{alumni.currentDesignation} at {alumni.currentCompany}</p>
                    <p className="text-sm text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{alumni.workLocation}</p>
                    <p className="text-sm text-muted-foreground"><Globe className="inline h-3 w-3 mr-1" />{alumni.industry}</p>
                  </div>
                  {alumni.achievements.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Achievements</h4>
                      {alumni.achievements.map((ach, i) => <p key={i} className="text-sm text-muted-foreground">• {ach}</p>)}
                    </div>
                  )}
                  {alumni.linkedInProfile && <a href={alumni.linkedInProfile} target="_blank" className="text-sm text-primary hover:underline">View LinkedIn Profile →</a>}
                  <div className="flex gap-2">
                    {alumni.verificationStatus === 'pending' && <>
                      <Button size="sm" className="flex-1">Verify</Button>
                      <Button variant="destructive" size="sm" className="flex-1">Reject</Button>
                    </>}
                    <Button variant="outline" size="sm" className="flex-1"><Eye className="mr-1 h-3 w-3" />Full Profile</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Select an alumni to view details</CardContent></Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
