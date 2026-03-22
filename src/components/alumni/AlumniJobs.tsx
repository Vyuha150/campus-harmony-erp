import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Plus, Search, Eye, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniJobs() {
  const { toast } = useToast();
  const [alumniJobPostings, setAlumniJobPostings] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [location, setLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [jobType, setJobType] = useState('full_time');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const loadData = async () => {
    const rows = await fetchApi<any[]>('/alumni/jobs');
    setAlumniJobPostings(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load jobs', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const resetForm = () => {
    setJobTitle('');
    setCompanyName('');
    setDescription('');
    setRequirements('');
    setLocation('');
    setSalaryRange('');
    setJobType('full_time');
    setApplicationDeadline('');
    setContactEmail('');
  };

  const handlePublishJob = async () => {
    if (!jobTitle.trim() || !companyName.trim() || !description.trim() || !location.trim() || !applicationDeadline || !contactEmail.trim()) {
      toast({ title: 'Missing fields', description: 'Title, company, description, location, deadline and contact email are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/alumni/jobs', {
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        description: description.trim(),
        requirements: requirements.split(',').map((item) => item.trim()).filter(Boolean),
        location: location.trim(),
        salaryRange: salaryRange.trim() || null,
        jobType,
        applicationDeadline: new Date(applicationDeadline).toISOString(),
        contactEmail: contactEmail.trim().toLowerCase(),
        status: 'active',
      });
      await loadData();
      setOpen(false);
      resetForm();
      toast({ title: 'Job posted', description: 'Alumni job posting published successfully.' });
    } catch (error: any) {
      toast({ title: 'Publish failed', description: error?.message || 'Unable to publish job.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumniJobPostings;
    return alumniJobPostings.filter((job) => {
      return String(job.jobTitle || '').toLowerCase().includes(q)
        || String(job.companyName || '').toLowerCase().includes(q)
        || String(job.location || '').toLowerCase().includes(q);
    });
  }, [alumniJobPostings, search]);

  const activeListings = alumniJobPostings.filter((job) => String(job.status || '').toLowerCase() === 'active').length;
  const applications = alumniJobPostings.reduce((sum, job) => sum + Number(job.applications || 0), 0);
  const companies = new Set(alumniJobPostings.map((job) => String(job.companyName || '').trim()).filter(Boolean)).size;
  const thisMonthHires = 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni Job Board</h1>
            <p className="text-muted-foreground">Job postings by alumni for current students and fellow alumni</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Post Job</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Post a Job Opportunity</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Job Title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
                <div><Label>Company Name</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div><Label>Requirements</Label><Textarea rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Comma separated skills" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                  <div><Label>Salary Range</Label><Input value={salaryRange} onChange={(e) => setSalaryRange(e.target.value)} placeholder="e.g. ₹15-25 LPA" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Job Type</Label><Select value={jobType} onValueChange={setJobType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full_time">Full Time</SelectItem><SelectItem value="part_time">Part Time</SelectItem><SelectItem value="contract">Contract</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent></Select></div>
                  <div><Label>Deadline</Label><Input type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} /></div>
                </div>
                <div><Label>Contact Email</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
                <Button className="w-full" disabled={saving} onClick={handlePublishJob}>Publish Job</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{activeListings}</p><p className="text-xs text-muted-foreground">Active Listings</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{applications}</p><p className="text-xs text-muted-foreground">Applications</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{companies}</p><p className="text-xs text-muted-foreground">Companies</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{thisMonthHires}</p><p className="text-xs text-muted-foreground">Hires This Month</p></CardContent></Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search jobs by title, company, location..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Briefcase className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{job.jobTitle}</h3>
                      <p className="text-sm text-muted-foreground">{job.companyName}</p>
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        <span><MapPin className="mr-1 inline h-3 w-3" />{job.location}</span>
                        <span>{job.salaryRange || 'Not specified'}</span>
                        <Badge variant="outline" className="capitalize">{String(job.jobType || '').replace('_', ' ')}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(Array.isArray(job.requirements) ? job.requirements : []).map((r: any, i: number) => <Badge key={`${job.id}-req-${i}`} variant="secondary" className="text-xs">{String(r)}</Badge>)}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <Calendar className="mr-1 inline h-3 w-3" />Deadline: {formatDate(job.applicationDeadline)} • {Number(job.views || 0)} views • {Number(job.applications || 0)} applications
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={job.status === 'active' ? 'default' : 'secondary'} className="capitalize">{job.status}</Badge>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={loadData}><Eye className="mr-1 h-3 w-3" />View</Button>
                      <Button variant="outline" size="sm" onClick={loadData}><ExternalLink className="mr-1 h-3 w-3" />Share</Button>
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
