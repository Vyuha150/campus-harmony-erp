import { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, Clock, CheckCircle, AlertCircle, 
  Plus, Filter, Search, FileText, Paperclip, Eye
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { UploadField } from '@/components/ui/upload-field';
import { fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { cn } from '@/lib/utils';
import { safeArray, safeDate, safeString } from '@/lib/normalize';
import { toast } from '@/hooks/use-toast';

export default function StudentGrievances() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [feedbackForms, setFeedbackForms] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);
  const [selectedGrievanceDetail, setSelectedGrievanceDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const normalizeGrievance = (raw: any) => ({
    id: safeString(raw?.id),
    category: safeString(raw?.category),
    subject: safeString(raw?.subject),
    description: safeString(raw?.description),
    submittedAt: safeDate(raw?.submittedAt),
    status: safeString(raw?.status),
    priority: safeString(raw?.priority),
    assignedTo: raw?.assignedTo ? safeString(raw.assignedTo) : undefined,
    resolution: raw?.resolution ? safeString(raw.resolution) : undefined,
    resolvedAt: raw?.resolvedAt ? safeDate(raw.resolvedAt) : undefined,
    attachments: safeArray(raw?.attachments).map((a: any) => safeString(a)),
  });

  const normalizeFeedback = (raw: any) => ({
    id: safeString(raw?.id),
    courseId: safeString(raw?.courseId),
    courseName: safeString(raw?.courseName),
    facultyName: safeString(raw?.facultyName),
    semester: safeString(raw?.semester),
    status: safeString(raw?.status),
    deadline: safeDate(raw?.deadline),
    questions: safeArray(raw?.questions).map((q: any) => ({
      id: safeString(q?.id),
      question: safeString(q?.question),
      type: safeString(q?.type),
      options: safeArray(q?.options).map((o: any) => safeString(o)),
      required: Boolean(q?.required),
    })),
  });

  useEffect(() => {
    fetchApi('/students/grievances')
      .then((d) => setGrievances(safeArray(d).map(normalizeGrievance)))
      .catch((error) => { console.error('API request failed', error); });

    fetchApi('/students/feedback')
      .then((d) => setFeedbackForms(safeArray(d).map(normalizeFeedback)))
      .catch((error) => { console.error('API request failed', error); });

    _setApiLoading(false);
  }, []);

  const [isNewGrievance, setIsNewGrievance] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('grievances');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submittingGrievance, setSubmittingGrievance] = useState(false);
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null);
  const [activeFeedbackForm, setActiveFeedbackForm] = useState<any | null>(null);
  const [feedbackResponses, setFeedbackResponses] = useState<Record<string, string>>({});
  const [grievanceFile, setGrievanceFile] = useState<File | null>(null);
  const [grievanceForm, setGrievanceForm] = useState({
    category: 'academic',
    subject: '',
    description: '',
    priority: 'medium'
  });

  const pendingGrievances = grievances.filter(g => g.status !== 'resolved' && g.status !== 'closed');
  const resolvedGrievances = grievances.filter(g => g.status === 'resolved' || g.status === 'closed');
  const pendingFeedback = feedbackForms.filter(f => f.status === 'pending');
  const filteredGrievances = grievances.filter((grievance) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const matchesQuery = `${grievance.subject} ${grievance.description} ${grievance.category}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || grievance.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const submitGrievance = async () => {
    if (!grievanceForm.subject.trim() || !grievanceForm.description.trim()) {
      toast({ title: 'Missing details', description: 'Subject and description are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingGrievance(true);
      let attachments: string[] = [];
      if (grievanceFile) {
        const uploaded: any = await uploadApi(grievanceFile, 'student-grievances');
        const uploadedUrl = safeString(uploaded?.url || uploaded?.storagePath);
        attachments = uploadedUrl ? [uploadedUrl] : [];
      }

      const created = await postApi('/students/grievances', {
        ...grievanceForm,
        attachments
      });
      setGrievances((prev) => [normalizeGrievance(created), ...prev]);
      setIsNewGrievance(false);
      setGrievanceForm({ category: 'academic', subject: '', description: '', priority: 'medium' });
      setGrievanceFile(null);
      toast({ title: 'Grievance submitted', description: 'Your grievance was submitted successfully.' });
    } catch (error: any) {
      toast({ title: 'Submission failed', description: safeString(error?.message, 'Unable to submit grievance.'), variant: 'destructive' });
    } finally {
      setSubmittingGrievance(false);
    }
  };

  const openFeedbackForm = (form: any) => {
    const initialResponses: Record<string, string> = {};
    for (const question of form.questions) {
      initialResponses[question.id] = '';
    }
    setFeedbackResponses(initialResponses);
    setActiveFeedbackForm(form);
  };

  const submitFeedback = async () => {
    if (!activeFeedbackForm) {
      return;
    }

    const missingRequired = activeFeedbackForm.questions.some((question: any) => {
      if (!question.required) return false;
      return !safeString(feedbackResponses[question.id]).trim();
    });

    if (missingRequired) {
      toast({
        title: 'Incomplete feedback',
        description: 'Please answer all required questions before submitting.',
        variant: 'destructive'
      });
      return;
    }

    const payloadResponses = Object.fromEntries(
      activeFeedbackForm.questions.map((question: any) => {
        const value = safeString(feedbackResponses[question.id]);
        if (question.type === 'rating') {
          return [question.id, Number(value || 0)];
        }
        return [question.id, value.trim()];
      })
    );

    try {
      setSubmittingFeedbackId(activeFeedbackForm.id);
      await postApi(`/students/feedback/${activeFeedbackForm.id}/submit`, {
        responses: payloadResponses
      });

      setFeedbackForms((prev) => prev.map((item) => (
        item.id === activeFeedbackForm.id ? { ...item, status: 'completed' } : item
      )));
      toast({ title: 'Feedback submitted', description: `Feedback for ${activeFeedbackForm.courseName} submitted.` });
      setActiveFeedbackForm(null);
      setFeedbackResponses({});
    } catch (error: any) {
      toast({ title: 'Feedback failed', description: safeString(error?.message, 'Unable to submit feedback.'), variant: 'destructive' });
    } finally {
      setSubmittingFeedbackId(null);
    }
  };

  const openGrievanceDetails = async (grievanceId: string) => {
    try {
      setDetailLoading(true);
      setSelectedGrievanceId(grievanceId);
      const detail = await fetchApi(`/students/grievances/${grievanceId}`);
      setSelectedGrievanceDetail(detail);
    } catch (error: any) {
      setSelectedGrievanceId(null);
      setSelectedGrievanceDetail(null);
      toast({
        title: 'Unable to load details',
        description: safeString(error?.message, 'Failed to fetch grievance details.'),
        variant: 'destructive'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge className="bg-info/10 text-info">Under Review</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning/10 text-warning">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-success/10 text-success">Resolved</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-warning/10 text-warning">High</Badge>;
      case 'medium':
        return <Badge variant="outline">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic':
        return '📚';
      case 'hostel':
        return '🏠';
      case 'fees':
        return '💰';
      case 'faculty':
        return '👨‍🏫';
      case 'infrastructure':
        return '🏗️';
      case 'ragging':
        return '⚠️';
      default:
        return '📝';
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Grievances & Feedback</h1>
            <p className="page-description">Submit and track your grievances, provide course feedback</p>
          </div>
          <Dialog open={isNewGrievance} onOpenChange={setIsNewGrievance}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Grievance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Submit New Grievance</DialogTitle>
                <DialogDescription>
                  Describe your issue and we'll address it promptly
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={grievanceForm.category} onValueChange={(value) => setGrievanceForm((prev) => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">📚 Academic</SelectItem>
                      <SelectItem value="hostel">🏠 Hostel</SelectItem>
                      <SelectItem value="fees">💰 Fees</SelectItem>
                      <SelectItem value="faculty">👨‍🏫 Faculty</SelectItem>
                      <SelectItem value="infrastructure">🏗️ Infrastructure</SelectItem>
                      <SelectItem value="ragging">⚠️ Ragging</SelectItem>
                      <SelectItem value="other">📝 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="Brief subject of your grievance"
                    value={grievanceForm.subject}
                    onChange={(event) => setGrievanceForm((prev) => ({ ...prev, subject: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe your grievance in detail..." 
                    className="min-h-[120px]"
                    value={grievanceForm.description}
                    onChange={(event) => setGrievanceForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={grievanceForm.priority} onValueChange={(value) => setGrievanceForm((prev) => ({ ...prev, priority: value }))}>
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
                <UploadField
                  label="Attachments (Optional)"
                  file={grievanceFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                  helperText="Max 5MB per file. Supported: PDF, JPG, PNG"
                  onFileSelect={setGrievanceFile}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewGrievance(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitGrievance}
                  disabled={submittingGrievance}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submittingGrievance ? 'Submitting...' : 'Submit Grievance'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Active Grievances</p>
                <p className="text-3xl font-bold">{pendingGrievances.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-3xl font-bold text-success">{resolvedGrievances.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </CardContent>
          </Card>
          <Card className={cn(pendingFeedback.length > 0 && 'border-warning/50')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Pending Feedback</p>
                <p className={cn(
                  'text-3xl font-bold',
                  pendingFeedback.length > 0 ? 'text-warning' : 'text-success'
                )}>
                  {pendingFeedback.length}
                </p>
              </div>
              <FileText className={cn(
                'h-8 w-8',
                pendingFeedback.length > 0 ? 'text-warning' : 'text-success'
              )} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Avg Resolution</p>
                <p className="text-3xl font-bold">3 days</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Pending Feedback Alert */}
        {pendingFeedback.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-warning" />
                <div>
                  <p className="font-medium">Course Feedback Pending</p>
                  <p className="text-sm text-muted-foreground">
                    You have {pendingFeedback.length} course feedback form(s) to complete
                  </p>
                </div>
              </div>
              <Button onClick={() => setActiveTab('feedback')}>
                Complete Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="grievances">My Grievances</TabsTrigger>
            <TabsTrigger value="feedback" className="relative">
              Course Feedback
              {pendingFeedback.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[10px] text-white">
                  {pendingFeedback.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Grievances */}
          <TabsContent value="grievances" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search grievances..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredGrievances.length > 0 ? (
              <div className="space-y-4">
                {filteredGrievances.map((grievance) => (
                  <Card key={grievance.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getCategoryIcon(grievance.category)}</span>
                            <span className="font-medium">{grievance.subject}</span>
                            {getStatusBadge(grievance.status)}
                            {getPriorityBadge(grievance.priority)}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {grievance.description}
                          </p>
                          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Submitted: {grievance.submittedAt.toLocaleDateString()}</span>
                            {grievance.assignedTo && (
                              <span>Assigned to: {grievance.assignedTo}</span>
                            )}
                          </div>
                        </div>
                        <Dialog
                          open={selectedGrievanceId === grievance.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setSelectedGrievanceId(null);
                              setSelectedGrievanceDetail(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => openGrievanceDetails(grievance.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{getCategoryIcon(grievance.category)}</span>
                                {getStatusBadge(grievance.status)}
                                {getPriorityBadge(grievance.priority)}
                              </div>
                              <DialogTitle>{selectedGrievanceDetail?.subject || grievance.subject}</DialogTitle>
                              <DialogDescription>
                                Submitted on {(selectedGrievanceDetail?.submissionDate ? new Date(selectedGrievanceDetail.submissionDate) : grievance.submittedAt).toLocaleDateString()}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              {detailLoading ? (
                                <p className="text-sm text-muted-foreground">Loading full details...</p>
                              ) : (
                                <>
                              <div>
                                <h4 className="font-medium">Description</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {selectedGrievanceDetail?.description || grievance.description}
                                </p>
                              </div>
                              {selectedGrievanceDetail?.grievanceNumber && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Reference Number</p>
                                  <p className="font-medium">{selectedGrievanceDetail.grievanceNumber}</p>
                                </div>
                              )}
                              {(selectedGrievanceDetail?.assignedTo || grievance.assignedTo) && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Assigned To</p>
                                  <p className="font-medium">{selectedGrievanceDetail?.assignedTo || grievance.assignedTo}</p>
                                </div>
                              )}
                              {selectedGrievanceDetail?.timeline?.length > 0 && (
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs text-muted-foreground mb-2">Activity Timeline</p>
                                  <div className="space-y-2 max-h-36 overflow-auto">
                                    {selectedGrievanceDetail.timeline.slice(-3).reverse().map((item: any, idx: number) => (
                                      <div key={`${item.date}-${idx}`} className="text-xs">
                                        <p className="font-medium">{item.action}</p>
                                        <p className="text-muted-foreground">{item.notes || 'No notes'} • {new Date(item.date).toLocaleString()}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(selectedGrievanceDetail?.resolution || grievance.resolution) && (
                                <div className="rounded-lg bg-success/10 p-3">
                                  <p className="text-xs text-muted-foreground">Resolution</p>
                                  <p className="font-medium text-success">{selectedGrievanceDetail?.resolution || grievance.resolution}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Resolved on: {(selectedGrievanceDetail?.actualResolutionDate ? new Date(selectedGrievanceDetail.actualResolutionDate) : grievance.resolvedAt)?.toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                                </>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No Grievances</p>
                  <p className="text-sm text-muted-foreground">You haven't submitted any grievances yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Course Feedback */}
          <TabsContent value="feedback" className="space-y-4">
            {feedbackForms.map((form) => (
              <Card key={form.id} className={cn(
                form.status === 'pending' && 'border-warning/50'
              )}>
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{form.courseName}</span>
                      <Badge variant={form.status === 'pending' ? 'outline' : 'secondary'}>
                        {form.status === 'pending' ? 'Pending' : 'Completed'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Faculty: {form.facultyName} • Semester {form.semester}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deadline: {form.deadline.toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    variant={form.status === 'pending' ? 'default' : 'outline'}
                    disabled={form.status === 'completed'}
                    onClick={() => openFeedbackForm(form)}
                  >
                    {submittingFeedbackId === form.id ? 'Submitting...' : form.status === 'pending' ? 'Give Feedback' : 'Completed'}
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Dialog
              open={Boolean(activeFeedbackForm)}
              onOpenChange={(open) => {
                if (!open && !submittingFeedbackId) {
                  setActiveFeedbackForm(null);
                  setFeedbackResponses({});
                }
              }}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Course Feedback</DialogTitle>
                  <DialogDescription>
                    {activeFeedbackForm
                      ? `${activeFeedbackForm.courseName} • ${activeFeedbackForm.facultyName}`
                      : 'Provide your feedback'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {(activeFeedbackForm?.questions ?? []).map((question: any, index: number) => (
                    <div key={question.id} className="space-y-2 rounded-md border p-4">
                      <Label className="text-sm font-medium">
                        {index + 1}. {question.question}
                        {question.required ? ' *' : ''}
                      </Label>

                      {question.type === 'rating' ? (
                        <Select
                          value={safeString(feedbackResponses[question.id])}
                          onValueChange={(value) => {
                            setFeedbackResponses((prev) => ({
                              ...prev,
                              [question.id]: value
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select rating" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options.map((option: string) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Textarea
                          placeholder="Share your comments"
                          value={safeString(feedbackResponses[question.id])}
                          onChange={(event) => {
                            const value = event.target.value;
                            setFeedbackResponses((prev) => ({
                              ...prev,
                              [question.id]: value
                            }));
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (submittingFeedbackId) return;
                      setActiveFeedbackForm(null);
                      setFeedbackResponses({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitFeedback}
                    disabled={!activeFeedbackForm || submittingFeedbackId === activeFeedbackForm?.id}
                  >
                    {submittingFeedbackId === activeFeedbackForm?.id ? 'Submitting...' : 'Submit Feedback'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
