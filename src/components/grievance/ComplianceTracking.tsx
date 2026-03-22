import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle2, Clock, AlertTriangle, Filter, Download, Search, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';
import type { ComplianceItem, AntiRaggingAffidavit } from '@/types/grievance';

interface ComplianceTrackingProps {
  activeTab: 'items' | 'affidavits';
}

function formatDate(value: unknown): string {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN');
}

function getCompletionPercentage(tracking: any[]): number {
  if (!tracking || tracking.length === 0) return 0;
  const completed = tracking.filter((t) => t.status === 'completed').length;
  return Math.round((completed / tracking.length) * 100);
}

export default function ComplianceTracking({ activeTab }: ComplianceTrackingProps) {
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [affidavits, setAffidavits] = useState<AntiRaggingAffidavit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadComplianceData();
  }, [activeTab]);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'items') {
        const data = await fetchApi('/grievances/compliance');
        setComplianceItems(data.complianceItems || []);
      } else {
        const data = await fetchApi('/grievances/affidavits');
        setAffidavits(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance data');
      console.error('Error loading compliance:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = complianceItems.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredAffidavits = affidavits.filter((affidavit) => {
    const matchesSearch = affidavit.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affidavit.program.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || affidavit.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading compliance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (activeTab === 'items') {
    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search compliance items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="anti_ragging">Anti-Ragging</SelectItem>
              <SelectItem value="sexual_harassment">Sexual Harassment</SelectItem>
              <SelectItem value="code_of_conduct">Code of Conduct</SelectItem>
              <SelectItem value="safety_training">Safety Training</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{complianceItems.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{complianceItems.filter((i) => i.status === 'active').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Soon</p>
                  <p className="text-2xl font-bold">
                    {complianceItems.filter((i) => {
                      if (!i.dueDate) return false;
                      const daysUntilDue = Math.floor(
                        (new Date(i.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return daysUntilDue <= 7 && daysUntilDue >= 0;
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">
                    {complianceItems.filter((i) => {
                      if (!i.dueDate) return false;
                      const daysUntilDue = Math.floor(
                        (new Date(i.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return daysUntilDue < 0;
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items List */}
        <div className="space-y-4">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const completionPercentage = getCompletionPercentage(item.completionTracking);
              const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();

              return (
                <Card key={item.id} className={isOverdue ? 'border-destructive' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {item.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {item.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{item.description}</p>

                        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Applicable To</p>
                            <p className="font-medium text-foreground capitalize">{item.applicableTo}</p>
                          </div>
                          {item.renewalPeriod && (
                            <div>
                              <p className="text-xs text-muted-foreground">Renewal Period</p>
                              <p className="font-medium text-foreground">{item.renewalPeriod}</p>
                            </div>
                          )}
                        </div>

                        {/* Completion Tracking */}
                        {item.completionTracking && item.completionTracking.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-foreground">Completion Status</p>
                              <p className="text-xs text-muted-foreground">{completionPercentage}% Complete</p>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${completionPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Due Date */}
                        {item.dueDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className={`h-4 w-4 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                            <p className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                              {isOverdue ? 'Overdue: ' : 'Due: '}
                              {formatDate(item.dueDate)}
                            </p>
                          </div>
                        )}
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Users className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>{item.title}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Description</p>
                              <p className="text-foreground">{item.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <p className="font-medium capitalize text-foreground">{item.type.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                  {item.status}
                                </Badge>
                              </div>
                            </div>
                            {item.completionTracking && item.completionTracking.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-foreground mb-2">Completion Tracking</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {item.completionTracking.map((tracking, index) => (
                                    <div key={index} className="text-sm p-2 bg-muted rounded">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-medium text-foreground">{tracking.userName}</p>
                                          <p className="text-xs text-muted-foreground capitalize">{tracking.userType}</p>
                                        </div>
                                        <Badge
                                          variant={
                                            tracking.status === 'completed'
                                              ? 'default'
                                              : tracking.status === 'expired'
                                                ? 'destructive'
                                                : 'outline'
                                          }
                                          className="capitalize text-xs"
                                        >
                                          {tracking.status}
                                        </Badge>
                                      </div>
                                      {tracking.completionDate && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Completed: {formatDate(tracking.completionDate)}
                                        </p>
                                      )}
                                      {tracking.validUntil && (
                                        <p className="text-xs text-muted-foreground">Valid Until: {formatDate(tracking.validUntil)}</p>
                                      )}
                                      {tracking.score !== undefined && (
                                        <p className="text-xs text-muted-foreground">Score: {tracking.score}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <Button className="w-full" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Download Report
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No compliance items found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Affidavits Tab
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Affidavits</p>
                <p className="text-2xl font-bold">{affidavits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">{affidavits.filter((a) => a.status === 'verified').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{affidavits.filter((a) => a.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affidavits List */}
      <div className="space-y-4">
        {filteredAffidavits.length > 0 ? (
          filteredAffidavits.map((affidavit) => (
            <Card key={affidavit.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{affidavit.studentName}</h3>
                      <Badge variant={affidavit.status === 'verified' ? 'default' : 'outline'} className="capitalize">
                        {affidavit.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Program</p>
                        <p className="font-medium text-foreground">{affidavit.program}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Academic Year</p>
                        <p className="font-medium text-foreground">{affidavit.academicYear}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Student Affidavit</p>
                        <Badge variant={affidavit.studentAffidavit ? 'default' : 'outline'} className="text-xs">
                          {affidavit.studentAffidavit ? 'Submitted' : 'Pending'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Parent Affidavit</p>
                        <Badge variant={affidavit.parentAffidavit ? 'default' : 'outline'} className="text-xs">
                          {affidavit.parentAffidavit ? 'Submitted' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Submitted: {formatDate(affidavit.submissionDate)}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No affidavits found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
