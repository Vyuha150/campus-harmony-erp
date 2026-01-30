import { useState } from 'react';
import { 
  FileText, Upload, Clock, CheckCircle, AlertCircle, 
  Calendar, Filter, Search, Eye, Download, MessageSquare
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { mockAssignments } from '@/data/studentMockData';
import { Assignment } from '@/types/student';
import { cn } from '@/lib/utils';

export default function StudentAssignments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const filteredAssignments = mockAssignments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === 'all' || a.courseCode === courseFilter;
    return matchesSearch && matchesCourse;
  });

  const pendingAssignments = filteredAssignments.filter(a => a.status === 'pending');
  const submittedAssignments = filteredAssignments.filter(a => a.status === 'submitted');
  const gradedAssignments = filteredAssignments.filter(a => a.status === 'graded');
  const overdueAssignments = filteredAssignments.filter(a => a.status === 'overdue');

  const getStatusBadge = (status: Assignment['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-warning/50 text-warning">Pending</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="border-info/50 text-info">Submitted</Badge>;
      case 'graded':
        return <Badge variant="outline" className="border-success/50 text-success">Graded</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'late':
        return <Badge variant="outline" className="border-warning/50 text-warning">Late Submission</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysRemaining = (dueDate: Date) => {
    const today = new Date();
    const diff = dueDate.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const uniqueCourses = [...new Set(mockAssignments.map(a => a.courseCode))];

  const AssignmentCard = ({ assignment }: { assignment: Assignment }) => {
    const daysRemaining = getDaysRemaining(assignment.dueDate);
    const isPastDue = daysRemaining < 0;
    const isUrgent = daysRemaining <= 2 && daysRemaining >= 0;

    return (
      <Card className={cn(
        'transition-shadow hover:shadow-lg',
        assignment.status === 'overdue' && 'border-destructive/50',
        isUrgent && assignment.status === 'pending' && 'border-warning/50'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <Badge variant="secondary">{assignment.courseCode}</Badge>
            {getStatusBadge(assignment.status)}
          </div>
          <CardTitle className="mt-2 text-lg">{assignment.title}</CardTitle>
          <CardDescription>{assignment.courseName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {assignment.description}
          </p>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Due: {assignment.dueDate.toLocaleDateString()}
            </div>
            {assignment.status === 'pending' && (
              <span className={cn(
                'font-medium',
                isPastDue ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-muted-foreground'
              )}>
                {isPastDue ? `${Math.abs(daysRemaining)} days overdue` :
                 daysRemaining === 0 ? 'Due today' :
                 daysRemaining === 1 ? 'Due tomorrow' :
                 `${daysRemaining} days left`}
              </span>
            )}
          </div>

          {assignment.status === 'graded' && assignment.obtainedMarks !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-success/10 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-xl font-bold text-success">
                  {assignment.obtainedMarks}/{assignment.maxMarks}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Percentage</p>
                <p className="text-xl font-bold">
                  {Math.round((assignment.obtainedMarks / assignment.maxMarks) * 100)}%
                </p>
              </div>
            </div>
          )}

          {assignment.status === 'submitted' && (
            <div className="flex items-center gap-2 rounded-lg bg-info/10 p-3 text-sm text-info">
              <CheckCircle className="h-4 w-4" />
              Submitted on {assignment.submittedAt?.toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedAssignment(assignment)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{assignment.courseCode}</Badge>
                    {getStatusBadge(assignment.status)}
                  </div>
                  <DialogTitle>{assignment.title}</DialogTitle>
                  <DialogDescription>{assignment.courseName}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <h4 className="font-medium">Description</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{assignment.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">{assignment.dueDate.toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Maximum Marks</p>
                      <p className="font-medium">{assignment.maxMarks}</p>
                    </div>
                  </div>

                  {assignment.status === 'graded' && (
                    <>
                      <div className="rounded-lg bg-success/10 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Your Score</p>
                            <p className="text-2xl font-bold text-success">
                              {assignment.obtainedMarks}/{assignment.maxMarks}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Grade</p>
                            <p className="text-2xl font-bold">
                              {Math.round((assignment.obtainedMarks! / assignment.maxMarks) * 100)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      {assignment.feedback && (
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <h4 className="font-medium">Faculty Feedback</h4>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{assignment.feedback}</p>
                        </div>
                      )}
                    </>
                  )}

                  {(assignment.status === 'pending' || assignment.status === 'overdue') && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h4 className="font-medium">Submit Assignment</h4>
                      <div className="space-y-2">
                        <Label>Upload File</Label>
                        <Input type="file" />
                        <p className="text-xs text-muted-foreground">
                          Accepted formats: PDF, DOC, DOCX, ZIP (Max 10MB)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Comments (Optional)</Label>
                        <Textarea placeholder="Add any comments for the faculty..." />
                      </div>
                      <Button className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Submit Assignment
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {assignment.status === 'pending' && (
              <Button className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                Submit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Assignments & Assessments</h1>
            <p className="page-description">View, submit, and track your assignments</p>
          </div>
          <div className="flex gap-4">
            <div className={cn(
              'rounded-lg px-4 py-2 text-center',
              overdueAssignments.length > 0 ? 'bg-destructive/10' : 'bg-success/10'
            )}>
              <p className={cn(
                'text-2xl font-bold',
                overdueAssignments.length > 0 ? 'text-destructive' : 'text-success'
              )}>
                {pendingAssignments.length}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg bg-info/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-info">{submittedAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
            <div className="rounded-lg bg-success/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-success">{gradedAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Graded</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {uniqueCourses.map((code) => (
                <SelectItem key={code} value={code}>{code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">
              All ({filteredAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending ({pendingAssignments.length + overdueAssignments.length})
              {overdueAssignments.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                  {overdueAssignments.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Submitted ({submittedAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="graded">
              Graded ({gradedAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...overdueAssignments, ...pendingAssignments].map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="submitted">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {submittedAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="graded">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {gradedAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
