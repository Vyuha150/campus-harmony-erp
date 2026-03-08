import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Award, CheckCircle, AlertTriangle, Clock, FileText,
  Eye, Download, Send, BarChart3, TrendingUp, Shield
} from 'lucide-react';
import { complianceReports } from '@/data/vcMockData';
import { ComplianceReport } from '@/types/vc';

const frameworkColors: Record<string, string> = {
  NAAC: 'bg-blue-50 text-blue-700',
  NIRF: 'bg-purple-50 text-purple-700',
  UGC: 'bg-green-50 text-green-700',
  AQAR: 'bg-amber-50 text-amber-700',
  SSR: 'bg-red-50 text-red-700',
};

const statusBadge: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_review: 'bg-amber-50 text-amber-700',
  submitted: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
};

const criterionStatusColors: Record<string, string> = {
  on_track: 'text-emerald-600',
  at_risk: 'text-amber-600',
  behind: 'text-red-600',
};

export default function VCCompliance() {
  const { toast } = useToast();
  const [reports, setReports] = useState(complianceReports);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const handleApproveReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
    toast({ title: 'Report Approved', description: 'Report has been approved and digitally signed by the Vice Chancellor.' });
    setSelectedReport(null);
  };

  const handleSubmitReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'submitted' as const } : r));
    toast({ title: 'Report Submitted', description: 'Report submitted to the respective authority.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance & Accreditation</h1>
          <p className="text-muted-foreground">NAAC, NIRF, UGC compliance tracking, SSR review, and AQAR management</p>
        </div>

        {/* Framework Overview */}
        <div className="grid gap-4 sm:grid-cols-3">
          {reports.map(report => (
            <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport(report)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${frameworkColors[report.framework]}`}>{report.framework}</Badge>
                  <Badge className={`text-[10px] ${statusBadge[report.status]}`}>{report.status.replace('_', ' ')}</Badge>
                </div>
                <CardTitle className="text-sm mt-2">{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {report.score !== undefined && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Score</span>
                      <span className="font-bold">{report.score} / {report.maxScore}</span>
                    </div>
                    <Progress value={(report.score / report.maxScore) * 100} className="h-2" />
                  </div>
                )}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Last updated: {report.lastUpdated.toLocaleDateString('en-IN')}
                </div>
                {report.criteria.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {report.criteria.filter(c => c.status !== 'on_track').map(c => (
                      <Badge key={c.id} variant="outline" className={`text-[10px] ${criterionStatusColors[c.status]}`}>
                        <AlertTriangle className="h-3 w-3 mr-0.5" /> {c.name.split(' ').slice(0, 2).join(' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* NIRF Score Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> NIRF Score Simulator</CardTitle>
            <CardDescription>Current projected rank: #48 (Score: 52.8/100)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              {(reports.find(r => r.framework === 'NIRF')?.criteria || []).map(c => (
                <div key={c.id} className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                  <p className="text-lg font-bold mt-1">{c.score}</p>
                  <Progress value={c.score} className="h-1.5 mt-1" />
                  <Badge variant="outline" className={`text-[10px] mt-1 ${criterionStatusColors[c.status]}`}>{c.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="gap-1" onClick={() => toast({ title: 'NIRF Simulation', description: 'To reach Top 40: improve Research score by +12 and Perception by +8.' })}>
                <TrendingUp className="h-4 w-4" /> Simulate Improvement
              </Button>
              <Button variant="outline" className="gap-1" onClick={() => toast({ title: 'Report Generated', description: 'NIRF gap analysis report downloaded.' })}>
                <Download className="h-4 w-4" /> Gap Analysis Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* NAAC Criteria Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> NAAC Criteria Breakdown</CardTitle>
            <CardDescription>Projected CGPA: 3.42 / 4.00 — Target: A++ (3.51+)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(reports.find(r => r.framework === 'NAAC')?.criteria || []).map(c => (
                <div key={c.id} className="flex items-center gap-4">
                  <div className="w-48 text-sm truncate">{c.name}</div>
                  <div className="flex-1">
                    <Progress value={(c.score / c.maxScore) * 100} className="h-2.5" />
                  </div>
                  <div className="w-16 text-right text-sm font-medium">{c.score}/{c.maxScore}</div>
                  <Badge variant="outline" className={`text-[10px] w-20 justify-center ${criterionStatusColors[c.status]}`}>{c.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Report Detail Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedReport?.title}</DialogTitle>
              <DialogDescription>{selectedReport?.framework} • Status: {selectedReport?.status.replace('_', ' ')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedReport?.score !== undefined && (
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-bold">{selectedReport.score} / {selectedReport.maxScore}</p>
                  <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
                </div>
              )}
              {selectedReport?.criteria.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.score}/{c.maxScore}</span>
                    <Badge variant="outline" className={`text-[10px] ${criterionStatusColors[c.status]}`}>{c.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
              ))}
              {selectedReport?.status === 'in_review' && (
                <div>
                  <Textarea placeholder="VC remarks before approval..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
              {selectedReport?.status === 'in_review' && (
                <Button onClick={() => selectedReport && handleApproveReport(selectedReport.id)} className="gap-1">
                  <Shield className="h-4 w-4" /> Approve & Sign
                </Button>
              )}
              {selectedReport?.status === 'approved' && (
                <Button onClick={() => selectedReport && handleSubmitReport(selectedReport.id)} className="gap-1">
                  <Send className="h-4 w-4" /> Submit to Authority
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
