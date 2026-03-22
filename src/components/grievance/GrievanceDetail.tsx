import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale, FileText, Clock, User, CheckCircle2, AlertTriangle, MessageSquare, Download, ArrowLeft, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import type { GrievanceCase } from '@/types/grievance';

interface GrievanceDetailProps {
  caseId: string;
  onBack: () => void;
}

function formatDate(value: unknown): string {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusColor(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'default';
    case 'escalated':
      return 'destructive';
    case 'under_review':
    case 'investigating':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function GrievanceDetail({ caseId, onBack }: GrievanceDetailProps) {
  const [grievance, setGrievance] = useState<GrievanceCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadGrievanceDetails();
  }, [caseId]);

  const loadGrievanceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApi(`/grievances/cases/${caseId}`);
      setGrievance(data);
      setNewStatus(data.status);
    } catch (err: any) {
      setError(err.message || 'Failed to load grievance details');
      console.error('Error loading grievance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!grievance || !newStatus || newStatus === grievance.status) {
      setError('Please select a different status');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await putApi(`/grievances/cases/${caseId}`, { status: newStatus });
      setGrievance(updated);
      setSuccessMessage('Status updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddActivity = async () => {
    if (!grievance || !newActivity) {
      setError('Please enter an activity');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await postApi(`/grievances/cases/${caseId}/activity`, {
        action: newActivity,
        notes: activityNotes
      });
      setGrievance(updated);
      setNewActivity('');
      setActivityNotes('');
      setSuccessMessage('Activity added successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading grievance details...</p>
      </div>
    );
  }

  if (error || !grievance) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error || 'Grievance not found'}</AlertDescription>
      </Alert>
    );
  }

  const resolutionDays = grievance.actualResolutionDate
    ? Math.floor((new Date(grievance.actualResolutionDate).getTime() - new Date(grievance.submissionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{grievance.grievanceNumber}</h2>
          <p className="text-sm text-muted-foreground">{grievance.subject}</p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-semibold text-foreground capitalize">{grievance.category}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`h-5 w-5 ${
                  grievance.severity === 'urgent'
                    ? 'text-destructive'
                    : grievance.severity === 'high'
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                }`}
              />
              <div>
                <p className="text-xs text-muted-foreground">Severity</p>
                <p className="font-semibold text-foreground capitalize">{grievance.severity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="font-semibold text-foreground text-sm">{formatDate(grievance.submissionDate).split(',')[0]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Resolution</p>
                <p className="font-semibold text-foreground">{resolutionDays !== null ? `${resolutionDays} days` : 'Pending'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Case Information */}
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Complainant Name</p>
                  <p className="font-medium text-foreground">{grievance.complainantName}</p>
                  {grievance.isAnonymous && <Badge className="mt-1" variant="outline">Anonymous</Badge>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Complainant Type</p>
                  <p className="font-medium capitalize text-foreground">{grievance.complainantType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium text-foreground">{grievance.department || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium text-foreground">{grievance.assignedTo || 'Unassigned'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-foreground mt-1 whitespace-pre-wrap">{grievance.description}</p>
              </div>
              {grievance.resolution && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolution</p>
                  <p className="text-foreground mt-1 whitespace-pre-wrap">{grievance.resolution}</p>
                </div>
              )}
              {grievance.satisfactionRating && (
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction Rating</p>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 w-4 rounded-full ${i < grievance.satisfactionRating! ? 'bg-yellow-400' : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(grievance.timeline) && grievance.timeline.length > 0 ? (
                  grievance.timeline
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((activity, index) => (
                      <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex flex-col items-center">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          {index < (grievance.timeline as any[]).length - 1 && <div className="w-0.5 h-8 bg-border my-2" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(activity.date)}</p>
                          {activity.notes && <p className="text-sm mt-2 text-foreground">{activity.notes}</p>}
                          {activity.by && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" /> {activity.by}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">No activities recorded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-4">
          {/* Status Update */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={getStatusColor(grievance.status)} className="capitalize">
                  {grievance.status.replace('_', ' ')}
                </Badge>
              </div>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="pending_action">Pending Action</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={handleStatusUpdate}
                disabled={isSubmitting || newStatus === grievance.status}
              >
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </Button>
            </CardContent>
          </Card>

          {/* Add Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Activity/Action..."
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
              />
              <Textarea
                placeholder="Notes (optional)"
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                rows={3}
              />
              <Button
                className="w-full"
                onClick={handleAddActivity}
                disabled={isSubmitting || !newActivity}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Adding...' : 'Add Activity'}
              </Button>
            </CardContent>
          </Card>

          {/* Evidence Files */}
          {grievance.evidenceFiles && grievance.evidenceFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Evidence Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {grievance.evidenceFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm text-foreground truncate">{file}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium text-foreground">{formatDate(grievance.submissionDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium text-foreground">{formatDate(grievance.lastUpdated)}</p>
              </div>
              {grievance.expectedResolutionDate && (
                <div>
                  <p className="text-muted-foreground">Expected Resolution</p>
                  <p className="font-medium text-foreground">{formatDate(grievance.expectedResolutionDate)}</p>
                </div>
              )}
              {grievance.actualResolutionDate && (
                <div>
                  <p className="text-muted-foreground">Actual Resolution</p>
                  <p className="font-medium text-foreground">{formatDate(grievance.actualResolutionDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
