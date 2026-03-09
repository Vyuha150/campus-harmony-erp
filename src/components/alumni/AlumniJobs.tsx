import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Plus, Search, Eye, MapPin, Calendar, ExternalLink } from 'lucide-react';
import { alumniJobPostings } from '@/data/alumniMockData';

export default function AlumniJobs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni Job Board</h1>
            <p className="text-muted-foreground">Job postings by alumni for current students and fellow alumni</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Post Job</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Post a Job Opportunity</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Job Title</Label><Input /></div>
                <div><Label>Company Name</Label><Input /></div>
                <div><Label>Description</Label><Textarea rows={4} /></div>
                <div><Label>Requirements</Label><Textarea rows={2} placeholder="Comma separated skills" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Location</Label><Input /></div>
                  <div><Label>Salary Range</Label><Input placeholder="e.g. ₹15-25 LPA" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Job Type</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full_time">Full Time</SelectItem><SelectItem value="part_time">Part Time</SelectItem><SelectItem value="contract">Contract</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent></Select></div>
                  <div><Label>Deadline</Label><Input type="date" /></div>
                </div>
                <div><Label>Contact Email</Label><Input type="email" /></div>
                <Button className="w-full">Publish Job</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{alumniJobPostings.length + 24}</p><p className="text-xs text-muted-foreground">Active Listings</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">156</p><p className="text-xs text-muted-foreground">Applications</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">42</p><p className="text-xs text-muted-foreground">Companies</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">18</p><p className="text-xs text-muted-foreground">Hires This Month</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search jobs by title, company, location..." className="pl-10" />
        </div>

        {/* Job cards */}
        <div className="space-y-4">
          {alumniJobPostings.map(job => (
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
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span><MapPin className="inline h-3 w-3 mr-1" />{job.location}</span>
                        <span>{job.salaryRange}</span>
                        <Badge variant="outline" className="capitalize">{job.jobType.replace('_', ' ')}</Badge>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {job.requirements.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <Calendar className="inline h-3 w-3 mr-1" />Deadline: {job.applicationDeadline.toLocaleDateString('en-IN')} • {job.views} views • {job.applications} applications
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={job.status === 'active' ? 'default' : 'secondary'} className="capitalize">{job.status}</Badge>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" />View</Button>
                      <Button variant="outline" size="sm"><ExternalLink className="mr-1 h-3 w-3" />Share</Button>
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
