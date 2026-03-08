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
import { publications, researchProjects, patents } from '@/data/facultyMockData';

export default function FacultyResearch() {
  const totalCitations = publications.reduce((sum, p) => sum + p.citations, 0);

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
                      <div><Label>Title</Label><Input placeholder="Paper title" /></div>
                      <div><Label>Authors</Label><Input placeholder="Author1, Author2, ..." /></div>
                      <div><Label>Journal / Conference</Label><Input placeholder="Journal name" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Year</Label><Input type="number" placeholder="2026" /></div>
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
                      <Button className="w-full">Save Publication</Button>
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
                          <Badge variant={pub.status === 'published' ? 'default' : pub.status === 'accepted' ? 'secondary' : 'outline'} className="capitalize">
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
                          <span>{proj.startDate} → {proj.endDate}</span>
                        </div>
                      </div>
                      <Badge variant={proj.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{proj.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground"><IndianRupee className="h-3 w-3" />Budget Utilization</span>
                        <span className="font-medium">₹{(proj.amountSpent / 100000).toFixed(1)}L / ₹{(proj.amount / 100000).toFixed(1)}L</span>
                      </div>
                      <Progress value={(proj.amountSpent / proj.amount) * 100} className="h-2" />
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
                <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Patent</Button>
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
                        <TableCell className="font-mono text-xs">{pat.applicationNumber}</TableCell>
                        <TableCell>{pat.filingDate}</TableCell>
                        <TableCell className="text-sm">{pat.inventors.join(', ')}</TableCell>
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
