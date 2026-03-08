import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, FileText, Upload, Download, CheckCircle2, Clock,
  AlertTriangle, Eye, MessageSquare
} from 'lucide-react';
import { facultyAssignments, sampleSubmissions } from '@/data/facultyMockData';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function FacultyAssignments() {
  const { toast } = useToast();
  const [gradingId, setGradingId] = useState<string | null>(null);

  const statusIcon = {
    draft: <FileText className="h-4 w-4 text-muted-foreground" />,
    published: <Clock className="h-4 w-4 text-amber-500" />,
    closed: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    graded: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Assignments & Assessments</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Create Assessment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Assessment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Course</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cs301">CS301 – Data Structures</SelectItem>
                      <SelectItem value="cs501">CS501 – Machine Learning</SelectItem>
                      <SelectItem value="cs601">CS601 – Deep Learning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Type</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="lab_report">Lab Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input placeholder="Assessment title" /></div>
                <div><Label>Description</Label><Textarea placeholder="Instructions..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Due Date</Label><Input type="date" /></div>
                  <div><Label>Max Marks</Label><Input type="number" placeholder="100" /></div>
                </div>
                <div><Label>Attachments</Label><Input type="file" /></div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">Save as Draft</Button>
                  <Button className="flex-1">Publish</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="graded">Graded</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'published').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{asn.courseCode}</Badge>
                        <Badge variant="secondary" className="capitalize text-[10px]">{asn.type.replace('_', ' ')}</Badge>
                      </div>
                      <h3 className="text-lg font-medium text-foreground">{asn.title}</h3>
                      <p className="text-sm text-muted-foreground">{asn.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Due: {asn.dueDate}</span>
                        <span>Max Marks: {asn.maxMarks}</span>
                        <span className="font-medium text-foreground">{asn.totalSubmissions} submissions</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {asn.pendingEvaluation > 0 && (
                        <Badge variant="destructive">{asn.pendingEvaluation} pending</Badge>
                      )}
                      <Button size="sm" onClick={() => setGradingId(asn.id)}>
                        <Eye className="mr-1 h-4 w-4" />View Submissions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="graded" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'graded').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{asn.courseCode}</Badge>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <h3 className="mt-1 font-medium text-foreground">{asn.title}</h3>
                    <p className="text-xs text-muted-foreground">{asn.totalSubmissions} submissions graded • Max: {asn.maxMarks}</p>
                  </div>
                  <Button size="sm" variant="outline"><Download className="mr-1 h-4 w-4" />Export</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="drafts" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'draft').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{asn.courseCode}</Badge>
                      <Badge variant="secondary">Draft</Badge>
                    </div>
                    <h3 className="mt-1 font-medium text-foreground">{asn.title}</h3>
                    <p className="text-xs text-muted-foreground">Due: {asn.dueDate} • Max: {asn.maxMarks}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Edit</Button>
                    <Button size="sm">Publish</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Submissions Dialog */}
        <Dialog open={!!gradingId} onOpenChange={() => setGradingId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Student Submissions</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleSubmissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono">{sub.rollNumber}</TableCell>
                    <TableCell>{sub.studentName}</TableCell>
                    <TableCell className="text-xs">{new Date(sub.submittedAt).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'evaluated' ? 'default' : sub.status === 'late' ? 'destructive' : 'secondary'} className="capitalize">
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.marks !== undefined ? (
                        <span className="font-medium">{sub.marks}/20</span>
                      ) : (
                        <Input type="number" className="w-20" placeholder="—" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost"><MessageSquare className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGradingId(null)}>Cancel</Button>
              <Button onClick={() => { toast({ title: 'Grades Saved' }); setGradingId(null); }}>Save Grades</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
