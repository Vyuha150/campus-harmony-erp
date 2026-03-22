import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Search, AlertTriangle, CheckCircle2, Clock, Download, BarChart3, Shield, FileText, Scale, Plus, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';
import GrievanceDetail from './GrievanceDetail';
import GrievanceForm from './GrievanceForm';
import ComplianceTracking from './ComplianceTracking';
import type { GrievanceCase, GrievanceTab, ReportResponse } from '@/types/grievance';

function formatDate(value: unknown): string {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN');
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

export default function GrievanceDashboard({ initialTab = 'cases' }: { initialTab?: GrievanceTab }) {
  const [activeTab, setActiveTab] = useState<GrievanceTab>(initialTab);
  const [grievanceCases, setGrievanceCases] = useState<GrievanceCase[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  // Dialog states
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showGrievanceForm, setShowGrievanceForm] = useState(false);

  useEffect(() => {
    loadDashboardData();
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadDashboardData = async () => {
    try {
      setApiLoading(true);
      setError(null);

      const [casesData, reportsData] = await Promise.all([
        fetchApi('/grievances/cases'),
        fetchApi('/grievances/reports')
      ]);

      setGrievanceCases(Array.isArray(casesData) ? casesData : []);
      setReportSummary(reportsData || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load grievance dashboard');
      console.error('Error loading dashboard:', err);
      setGrievanceCases([]);
      setReportSummary(null);
    } finally {
      setApiLoading(false);
    }
  };

  // Filter grievance cases
  const filteredCases = grievanceCases.filter((g) => {
    const matchesSearch =
      g.grievanceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.complainantName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || g.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || g.category === filterCategory;
    const matchesSeverity = filterSeverity === 'all' || g.severity === filterSeverity;

    return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
  });

  // Calculate statistics
  const open = reportSummary?.pendingCases ??
    grievanceCases.filter((g) => !['resolved', 'closed'].includes(g.status)).length;
  const resolved = reportSummary?.resolvedCases ??
    grievanceCases.filter((g) => ['resolved', 'closed'].includes(g.status)).length;
  const totalCases = reportSummary?.totalCases ?? grievanceCases.length;
  const urgent = grievanceCases.filter((g) => g.severity === 'urgent').length;

  // If viewing details, show the detail component
  if (selectedCaseId) {
    return (
      <DashboardLayout>
        <GrievanceDetail caseId={selectedCaseId} onBack={() => setSelectedCaseId(null)} />
      </DashboardLayout>
    );
  }

  // If showing form, show the form component
  if (showGrievanceForm) {
    return (
      <DashboardLayout>
        <GrievanceForm
          onSubmitSuccess={() => {
            setShowGrievanceForm(false);
            loadDashboardData();
          }}
          onCancel={() => setShowGrievanceForm(false)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Grievance & Compliance Portal</h1>
            <p className="text-muted-foreground">Case management, resolution tracking, and compliance oversight</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Annual Report
            </Button>
            <Button size="sm" onClick={() => setShowGrievanceForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              File Grievance
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Grievances</p>
                  <p className="text-2xl font-bold">{totalCases}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Open Cases</p>
                  <p className="text-2xl font-bold text-amber-600">{open}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{resolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Urgent Cases</p>
                  <p className="text-2xl font-bold text-destructive">{urgent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Resolution Rate</p>
                  <p className="text-2xl font-bold text-green-600">{reportSummary?.resolutionRate ?? 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GrievanceTab)}>
          <TabsList>
            <TabsTrigger value="cases">Case Management</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Tracking</TabsTrigger>
            <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
          </TabsList>

          {/* Case Management Tab */}
          <TabsContent value="cases" className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search grievances..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="administrative">Administrative</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="discrimination">Discrimination</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="pending_action">Pending Action</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cases List */}
            {apiLoading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Loading grievances...</p>
              </div>
            ) : filteredCases.length > 0 ? (
              <div className="space-y-3">
                {filteredCases.map((g) => (
                  <Card key={g.id} className={g.severity === 'urgent' ? 'border-destructive' : ''}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              g.severity === 'urgent'
                                ? 'bg-destructive/10'
                                : g.severity === 'high'
                                  ? 'bg-amber-100'
                                  : 'bg-muted'
                            }`}
                          >
                            <Scale
                              className={`h-5 w-5 ${
                                g.severity === 'urgent'
                                  ? 'text-destructive'
                                  : g.severity === 'high'
                                    ? 'text-amber-600'
                                    : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground">{g.grievanceNumber}</p>
                              {g.isAnonymous && <Badge variant="outline">Anonymous</Badge>}
                            </div>
                            <p className="text-sm font-medium text-foreground">{g.subject}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                            <div className="mt-2 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                              <span>
                                Category: <span className="capitalize font-medium">{g.category}</span>
                              </span>
                              <span>Filed: {formatDate(g.submissionDate)}</span>
                              {g.assignedTo && <span>Assigned: {g.assignedTo}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                          <Badge
                            variant={
                              g.severity === 'urgent'
                                ? 'destructive'
                                : g.severity === 'high'
                                  ? 'default'
                                  : 'secondary'
                            }
                            className="capitalize"
                          >
                            {g.severity}
                          </Badge>
                          <Badge variant={getStatusColor(g.status)} className="capitalize">
                            {g.status.replace('_', ' ')}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCaseId(g.id)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No grievances found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-4">
            <ComplianceTracking activeTab="items" />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            {reportSummary?.byCategory && reportSummary.byCategory.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportSummary.byCategory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" name="Cases" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Summary Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cases</p>
                      <p className="text-3xl font-bold text-foreground">{reportSummary.totalCases}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved Cases</p>
                      <p className="text-3xl font-bold text-green-600">{reportSummary.resolvedCases}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Cases</p>
                      <p className="text-3xl font-bold text-amber-600">{reportSummary.pendingCases}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolution Rate</p>
                      <p className="text-3xl font-bold text-blue-600">{reportSummary.resolutionRate}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No report data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}