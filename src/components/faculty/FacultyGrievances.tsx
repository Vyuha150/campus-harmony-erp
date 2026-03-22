import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Star, MessageSquare, AlertTriangle, ThumbsUp, TrendingUp, Plus, Send, Eye
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export default function FacultyGrievancesFeedback() {
  const [facultyGrievances, setFacultyGrievances] = useState<any>([]);
  const [feedbackSummaries, setFeedbackSummaries] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadFeedbackSummaries = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const summaries = await fetchApi(`/faculty/feedback-summaries${semesterQuery}`);
    setFeedbackSummaries(Array.isArray(summaries) ? summaries : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [grievances, allCourses, currentSemesterResponse] = await Promise.all([
          fetchApi('/faculty/grievances'),
          fetchApi('/faculty/courses'),
          fetchApi('/faculty/current-semester')
        ]);
        setFacultyGrievances(Array.isArray(grievances) ? grievances : []);
        const semesters = Array.from(new Set((Array.isArray(allCourses) ? allCourses : []).map((course: any) => Number(course?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        setSemesterOptions(semesters);
        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        await loadFeedbackSummaries(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadFeedbackSummaries(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isNewGrievance, setIsNewGrievance] = useState(false);
  const [submittingGrievance, setSubmittingGrievance] = useState(false);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);
  const [selectedGrievanceDetail, setSelectedGrievanceDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grievanceForm, setGrievanceForm] = useState({
    category: 'administrative',
    subject: '',
    description: '',
    priority: 'medium'
  });

  const submitResponse = async (grievanceId: string) => {
    const resolution = (responses[grievanceId] || '').trim();
    if (!resolution) {
      toast({ title: 'Response required', description: 'Please enter a response before submitting.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingId(grievanceId);
      const updated = await postApi(`/faculty/grievances/${grievanceId}/respond`, { resolution });
      setFacultyGrievances((prev: any[]) => prev.map((item) => item.id === grievanceId ? { ...item, ...updated, status: 'resolved', response: resolution } : item));
      setResponses((prev) => ({ ...prev, [grievanceId]: '' }));
      toast({ title: 'Response submitted', description: 'Grievance response submitted successfully.' });
    } catch (error: any) {
      toast({ title: 'Submission failed', description: error?.message || 'Unable to submit response.', variant: 'destructive' });
    } finally {
      setSubmittingId(null);
    }
  };

  const submitGrievance = async () => {
    if (!grievanceForm.subject.trim() || !grievanceForm.description.trim()) {
      toast({
        title: 'Missing details',
        description: 'Subject and description are required.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmittingGrievance(true);
      const created = await postApi('/faculty/grievances', grievanceForm);
      setFacultyGrievances((prev: any[]) => [created, ...prev]);
      setIsNewGrievance(false);
      setGrievanceForm({
        category: 'administrative',
        subject: '',
        description: '',
        priority: 'medium'
      });
      toast({ title: 'Grievance submitted', description: 'Your grievance has been submitted successfully.' });
    } catch (error: any) {
      toast({
        title: 'Submission failed',
        description: error?.message || 'Unable to submit grievance.',
        variant: 'destructive'
      });
    } finally {
      setSubmittingGrievance(false);
    }
  };

  const openGrievanceDetails = async (grievanceId: string) => {
    try {
      setDetailLoading(true);
      setSelectedGrievanceId(grievanceId);
      const detail = await fetchApi(`/faculty/grievances/${grievanceId}`);
      setSelectedGrievanceDetail(detail);
    } catch (error: any) {
      setSelectedGrievanceId(null);
      setSelectedGrievanceDetail(null);
      toast({
        title: 'Unable to load details',
        description: error?.message || 'Failed to fetch grievance details.',
        variant: 'destructive'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Grievances & Feedback</h1>
          <div className="flex items-center gap-2">
            <Dialog open={isNewGrievance} onOpenChange={setIsNewGrievance}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Raise Grievance
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Raise New Grievance</DialogTitle>
                  <DialogDescription>
                    Submit your issue to the grievance office for resolution.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={grievanceForm.category}
                      onValueChange={(value) => setGrievanceForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrative">Administrative</SelectItem>
                        <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        <SelectItem value="hr">HR & Service</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      placeholder="Brief subject"
                      value={grievanceForm.subject}
                      onChange={(event) => setGrievanceForm((prev) => ({ ...prev, subject: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe the grievance in detail"
                      className="min-h-[120px]"
                      value={grievanceForm.description}
                      onChange={(event) => setGrievanceForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={grievanceForm.priority}
                      onValueChange={(value) => setGrievanceForm((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewGrievance(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submitGrievance} disabled={submittingGrievance}>
                    <Send className="mr-2 h-4 w-4" />
                    {submittingGrievance ? 'Submitting...' : 'Submit'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="feedback" className="space-y-4">
          <TabsList>
            <TabsTrigger value="feedback">Student Feedback</TabsTrigger>
            <TabsTrigger value="grievances">Grievances</TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="space-y-4">
            {feedbackSummaries.map((fb) => (
              <Card key={fb.courseId} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{fb.courseCode} – {fb.courseName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{fb.semester} • {fb.totalResponses} responses</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="text-2xl font-bold text-foreground">{fb.overallRating}</span>
                      <span className="text-sm text-muted-foreground">/ {fb.maxRating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {fb.categories.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="w-40 text-sm text-muted-foreground">{cat.name}</span>
                        <Progress value={(cat.score / cat.maxScore) * 100} className="h-2 flex-1" />
                        <span className="w-12 text-right text-sm font-medium">{cat.score}/{cat.maxScore}</span>
                      </div>
                    ))}
                  </div>
                  {fb.suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Student Suggestions</p>
                      <div className="space-y-1">
                        {fb.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="grievances" className="space-y-3">
            {facultyGrievances.map((g) => (
              <Card key={g.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={g.type === 'assigned_review' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                          {g.type.replace('_', ' ')}
                        </Badge>
                        <Badge variant={g.status === 'new' || g.status === 'received' ? 'destructive' : g.status === 'under_review' ? 'secondary' : 'default'} className="capitalize">
                          {g.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-foreground">{g.subject}</h3>
                      <p className="text-sm text-muted-foreground">{g.description}</p>
                      <p className="text-xs text-muted-foreground">Filed by: {g.filedBy} • {g.filedAt}</p>
                    </div>
                    <Dialog
                      open={selectedGrievanceId === g.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setSelectedGrievanceId(null);
                          setSelectedGrievanceDetail(null);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => openGrievanceDetails(g.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{selectedGrievanceDetail?.subject || g.subject}</DialogTitle>
                          <DialogDescription>
                            Reference: {selectedGrievanceDetail?.grievanceNumber || g.id}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          {detailLoading ? (
                            <p className="text-sm text-muted-foreground">Loading full details...</p>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs text-muted-foreground">Description</p>
                                <p className="text-sm">{selectedGrievanceDetail?.description || g.description}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Category</p>
                                  <p className="text-sm capitalize">{selectedGrievanceDetail?.category || g.category}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Status</p>
                                  <p className="text-sm capitalize">{selectedGrievanceDetail?.status || g.status}</p>
                                </div>
                              </div>
                              {(selectedGrievanceDetail?.assignedTo || g.assignedTo) && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Assigned To</p>
                                  <p className="text-sm">{selectedGrievanceDetail?.assignedTo || g.assignedTo}</p>
                                </div>
                              )}
                              {(selectedGrievanceDetail?.resolution || g.response) && (
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-xs text-muted-foreground">Resolution</p>
                                  <p className="text-sm">{selectedGrievanceDetail?.resolution || g.response}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {g.response && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Response</p>
                      <p className="text-sm">{g.response}</p>
                    </div>
                  )}
                  {g.status === 'under_review' && (
                    <div className="mt-3 space-y-2">
                      <Textarea placeholder="Enter your response..." value={responses[g.id] || ''} onChange={(event) => setResponses((prev) => ({ ...prev, [g.id]: event.target.value }))} />
                      <Button size="sm" onClick={() => submitResponse(g.id)} disabled={submittingId === g.id}>{submittingId === g.id ? 'Submitting...' : 'Submit Response'}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
