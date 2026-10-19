import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, FileText, Lightbulb, Award, Plus,
  ExternalLink, TrendingUp, BarChart3, IndianRupee
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export default function FacultyResearch() {
  const [publications, setPublications] = useState<any>([]);
  const [researchProjects, setResearchProjects] = useState<any>([]);
  const [patents, setPatents] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [savingPublication, setSavingPublication] = useState(false);
  const [publicationForm, setPublicationForm] = useState({ title: '', journal: '', year: '', status: 'submitted' });
  const { toast } = useToast();
  useEffect(() => {
    fetchApi('/faculty/research/publications').then(d => setPublications(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/faculty/research/projects').then(d => setResearchProjects(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/faculty/research/patents').then(d => setPatents(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const totalCitations = publications.reduce((sum, p) => sum + Number(p.citations || 0), 0);

  // Projects & Grants had a create API but no button; Patents had neither a
  // button handler nor a table. Both forms below raise the record and route it
  // for approval (RESEARCH_PROJECT_SANCTION / INNOVATION_IPR_FILING).
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', fundingAgency: '', amount: '', startDate: '', endDate: '', coInvestigators: '' });
  const [patentOpen, setPatentOpen] = useState(false);
  const [patentForm, setPatentForm] = useState({ title: '', applicationNumber: '', filingDate: '', jurisdiction: 'India', inventors: '' });
  const [savingResearch, setSavingResearch] = useState(false);

  const saveProject = async () => {
    if (!projectForm.title.trim() || !projectForm.fundingAgency.trim() || !projectForm.amount) {
      toast({ title: 'Missing details', description: 'Title, funding agency and amount are required.', variant: 'destructive' });
      return;
    }
    setSavingResearch(true);
    try {
      await postApi('/faculty/research/projects', {
        title: projectForm.title.trim(),
        fundingAgency: projectForm.fundingAgency.trim(),
        amount: Number(projectForm.amount),
        ...(projectForm.startDate ? { startDate: projectForm.startDate } : {}),
        ...(projectForm.endDate ? { endDate: projectForm.endDate } : {}),
        coInvestigators: projectForm.coInvestigators.split(',').map((x) => x.trim()).filter(Boolean)
      });
      setResearchProjects(await fetchApi('/faculty/research/projects'));
      setProjectOpen(false);
      setProjectForm({ title: '', fundingAgency: '', amount: '', startDate: '', endDate: '', coInvestigators: '' });
      toast({ title: 'Project submitted', description: 'Sent for sanction: HOD, then Dean (Research), Finance and the Vice-Chancellor.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save the project.', variant: 'destructive' });
    } finally {
      setSavingResearch(false);
    }
  };

  const savePatent = async () => {
    if (!patentForm.title.trim()) {
      toast({ title: 'Missing details', description: 'The invention title is required.', variant: 'destructive' });
      return;
    }
    setSavingResearch(true);
    try {
      await postApi('/faculty/research/patents', {
        title: patentForm.title.trim(),
        ...(patentForm.applicationNumber.trim() ? { applicationNumber: patentForm.applicationNumber.trim() } : {}),
        ...(patentForm.filingDate ? { filingDate: patentForm.filingDate } : {}),
        ...(patentForm.jurisdiction.trim() ? { jurisdiction: patentForm.jurisdiction.trim() } : {}),
        inventors: patentForm.inventors.split(',').map((x) => x.trim()).filter(Boolean)
      });
      setPatents(await fetchApi('/faculty/research/patents'));
      setPatentOpen(false);
      setPatentForm({ title: '', applicationNumber: '', filingDate: '', jurisdiction: 'India', inventors: '' });
      toast({ title: 'Patent recorded', description: 'Sent for review: HOD, then the IPR cell (Dean), then Finance for the filing fee.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save the patent.', variant: 'destructive' });
    } finally {
      setSavingResearch(false);
    }
  };

  const savePublication = async () => {
    if (!publicationForm.title.trim() || !publicationForm.journal.trim() || !publicationForm.year) {
      toast({ title: 'Missing details', description: 'Title, journal, and year are required.', variant: 'destructive' });
      return;
    }

    try {
      setSavingPublication(true);
      const created = await postApi('/faculty/research/publications', {
        title: publicationForm.title.trim(),
        journal: publicationForm.journal.trim(),
        year: Number(publicationForm.year),
        status: publicationForm.status
      });
      setPublications((prev: any[]) => [{ ...created, authors: [], indexing: null, citations: null }, ...prev]);
      setPublicationForm({ title: '', journal: '', year: '', status: 'submitted' });
      toast({ title: 'Publication saved' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save publication.', variant: 'destructive' });
    } finally {
      setSavingPublication(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Research & Publications</h1>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Publications', value: publications.length, icon: FileText, color: 'text-primary' },
            { label: 'Citations', value: totalCitations, icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Active Projects', value: researchProjects.filter(p => p.status === 'ongoing').length, icon: Lightbulb, color: 'text-amber-600' },
            { label: 'Patents', value: patents.length, icon: Award, color: 'text-green-600' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="publications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="publications">Publications</TabsTrigger>
            <TabsTrigger value="projects">Projects & Grants</TabsTrigger>
            <TabsTrigger value="patents">Patents & IPR</TabsTrigger>
          </TabsList>

          <TabsContent value="publications">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Publication Record</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Publication</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Publication</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Title</Label><Input placeholder="Paper title" value={publicationForm.title} onChange={(event) => setPublicationForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
                      <div><Label>Authors</Label><Input placeholder="Author1, Author2, ..." disabled value="Primary Author" /></div>
                      <div><Label>Journal / Conference</Label><Input placeholder="Journal name" value={publicationForm.journal} onChange={(event) => setPublicationForm((prev) => ({ ...prev, journal: event.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Year</Label><Input type="number" placeholder="2026" value={publicationForm.year} onChange={(event) => setPublicationForm((prev) => ({ ...prev, year: event.target.value }))} /></div>
                        <div><Label>DOI</Label><Input placeholder="10.xxxx/..." /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Type</Label>
                          <Select><SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="journal">Journal</SelectItem>
                              <SelectItem value="conference">Conference</SelectItem>
                              <SelectItem value="book_chapter">Book Chapter</SelectItem>
                              <SelectItem value="book">Book</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Indexing</Label>
                          <Select><SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SCI">SCI</SelectItem>
                              <SelectItem value="Scopus">Scopus</SelectItem>
                              <SelectItem value="UGC">UGC</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button className="w-full" onClick={savePublication} disabled={savingPublication}>{savingPublication ? 'Saving...' : 'Save Publication'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Journal</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Indexing</TableHead>
                      <TableHead>Citations</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publications.map(pub => (
                      <TableRow key={pub.id}>
                        <TableCell>
                          <p className="max-w-[300px] truncate font-medium">{pub.title}</p>
                          <p className="text-xs text-muted-foreground">{pub.authors.join(', ')}</p>
                        </TableCell>
                        <TableCell className="text-sm">{pub.journal}</TableCell>
                        <TableCell>{pub.year}</TableCell>
                        <TableCell><Badge variant="outline">{pub.indexing}</Badge></TableCell>
                        <TableCell className="font-medium">{pub.citations}</TableCell>
                        <TableCell>
                          <Badge variant={pub.status === 'verified' || pub.status === 'published' ? 'default' : pub.status === 'rejected' ? 'destructive' : pub.status === 'accepted' ? 'secondary' : 'outline'} className="capitalize">
                            {pub.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Project / Grant</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add a research project or grant</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Project title</Label><Input value={projectForm.title} onChange={(e) => setProjectForm((p) => ({ ...p, title: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Funding agency</Label><Input placeholder="e.g. DST-SERB, AICTE, Industry" value={projectForm.fundingAgency} onChange={(e) => setProjectForm((p) => ({ ...p, fundingAgency: e.target.value }))} /></div>
                        <div><Label>Sanctioned amount (₹)</Label><Input type="number" min={0} value={projectForm.amount} onChange={(e) => setProjectForm((p) => ({ ...p, amount: e.target.value }))} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Start date</Label><Input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
                        <div><Label>End date</Label><Input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
                      </div>
                      <div><Label>Co-investigators</Label><Input placeholder="Names, separated by commas" value={projectForm.coInvestigators} onChange={(e) => setProjectForm((p) => ({ ...p, coInvestigators: e.target.value }))} /></div>
                      <Button className="w-full" onClick={saveProject} disabled={savingResearch}>{savingResearch ? 'Saving…' : 'Submit for sanction'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {researchProjects.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No research projects recorded yet.</p>}
              {researchProjects.map(proj => (
                <Card key={proj.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium text-foreground">{proj.title}</h3>
                        <p className="text-sm text-muted-foreground">Funded by: {proj.fundingAgency}</p>
                        {proj.coInvestigators.length > 0 && (
                          <p className="text-xs text-muted-foreground">Co-PIs: {proj.coInvestigators.join(', ')}</p>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{proj.startDate || 'Start not set'} → {proj.endDate || 'End not set'}</span>
                        </div>
                      </div>
                      <Badge variant={proj.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{proj.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground"><IndianRupee className="h-3 w-3" />Budget Utilization</span>
                        <span className="font-medium">₹{(proj.amountSpent / 100000).toFixed(1)}L / ₹{(proj.amount / 100000).toFixed(1)}L</span>
                      </div>
                      <Progress value={proj.amount > 0 ? (proj.amountSpent / proj.amount) * 100 : 0} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="patents">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Patents & IPR</CardTitle>
                <Dialog open={patentOpen} onOpenChange={setPatentOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Patent</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record a patent / IPR filing</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Title of the invention</Label><Input value={patentForm.title} onChange={(e) => setPatentForm((p) => ({ ...p, title: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Application number</Label><Input placeholder="If already filed" value={patentForm.applicationNumber} onChange={(e) => setPatentForm((p) => ({ ...p, applicationNumber: e.target.value }))} /></div>
                        <div><Label>Filing date</Label><Input type="date" value={patentForm.filingDate} onChange={(e) => setPatentForm((p) => ({ ...p, filingDate: e.target.value }))} /></div>
                      </div>
                      <div><Label>Jurisdiction</Label><Input value={patentForm.jurisdiction} onChange={(e) => setPatentForm((p) => ({ ...p, jurisdiction: e.target.value }))} /></div>
                      <div><Label>Co-inventors</Label><Input placeholder="Names, separated by commas (you are added automatically)" value={patentForm.inventors} onChange={(e) => setPatentForm((p) => ({ ...p, inventors: e.target.value }))} /></div>
                      <Button className="w-full" onClick={savePatent} disabled={savingResearch}>{savingResearch ? 'Saving…' : 'Submit for review'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Application No</TableHead>
                      <TableHead>Filing Date</TableHead>
                      <TableHead>Inventors</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patents.map(pat => (
                      <TableRow key={pat.id}>
                        <TableCell className="font-medium">{pat.title}</TableCell>
                        <TableCell className="font-mono text-xs">{pat.applicationNumber || '—'}</TableCell>
                        <TableCell>{pat.filingDate || '—'}</TableCell>
                        <TableCell className="text-sm">{(pat.inventors || []).join(', ')}</TableCell>
                        <TableCell>
                          <Badge variant={pat.status === 'granted' ? 'default' : pat.status === 'published' ? 'secondary' : 'outline'} className="capitalize">
                            {pat.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
