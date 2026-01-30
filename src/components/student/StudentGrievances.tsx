import { useState } from 'react';
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
import { mockGrievances, mockFeedbackForms } from '@/data/studentMockData';
import { cn } from '@/lib/utils';

export default function StudentGrievances() {
  const [isNewGrievance, setIsNewGrievance] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pendingGrievances = mockGrievances.filter(g => g.status !== 'resolved' && g.status !== 'closed');
  const resolvedGrievances = mockGrievances.filter(g => g.status === 'resolved' || g.status === 'closed');
  const pendingFeedback = mockFeedbackForms.filter(f => f.status === 'pending');

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
                  <Select>
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
                  <Input placeholder="Brief subject of your grievance" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe your grievance in detail..." 
                    className="min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attachments (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" className="flex-1" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Max 5MB per file. Supported: PDF, JPG, PNG
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewGrievance(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsNewGrievance(false)}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Grievance
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
              <Button>
                Complete Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="grievances" className="space-y-6">
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
              <Select defaultValue="all">
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

            {mockGrievances.length > 0 ? (
              <div className="space-y-4">
                {mockGrievances.map((grievance) => (
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
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
                              <DialogTitle>{grievance.subject}</DialogTitle>
                              <DialogDescription>
                                Submitted on {grievance.submittedAt.toLocaleDateString()}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <h4 className="font-medium">Description</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {grievance.description}
                                </p>
                              </div>
                              {grievance.assignedTo && (
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Assigned To</p>
                                  <p className="font-medium">{grievance.assignedTo}</p>
                                </div>
                              )}
                              {grievance.resolution && (
                                <div className="rounded-lg bg-success/10 p-3">
                                  <p className="text-xs text-muted-foreground">Resolution</p>
                                  <p className="font-medium text-success">{grievance.resolution}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Resolved on: {grievance.resolvedAt?.toLocaleDateString()}
                                  </p>
                                </div>
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
            {mockFeedbackForms.map((form) => (
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
                  >
                    {form.status === 'pending' ? 'Give Feedback' : 'Completed'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
