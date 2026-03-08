import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Award, CheckCircle, AlertTriangle, Clock, FileText,
  Download, Send, BarChart3, TrendingUp, Shield, Edit, Save
} from 'lucide-react';
import { complianceReports as initialReports } from '@/data/vcMockData';
import { ComplianceReport, CriterionScore } from '@/types/vc';

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
  const [reports, setReports] = useState(initialReports);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [editingNIRF, setEditingNIRF] = useState(false);
  const [nirfScores, setNirfScores] = useState<Record<string, number>>({});
  const [editingNAAC, setEditingNAAC] = useState(false);
  const [naacScores, setNaacScores] = useState<Record<string, number>>({});

  const nirfReport = reports.find(r => r.framework === 'NIRF');
  const naacReport = reports.find(r => r.framework === 'NAAC');

  // Initialize scores from report data
  const getNirfScore = (id: string, defaultVal: number) => nirfScores[id] ?? defaultVal;
  const getNaacScore = (id: string, defaultVal: number) => naacScores[id] ?? defaultVal;

  const nirfTotal = nirfReport ? nirfReport.criteria.reduce((sum, c) => sum + (getNirfScore(c.id, c.score)), 0) / nirfReport.criteria.length : 0;
  const naacTotal = naacReport ? naacReport.criteria.reduce((sum, c) => sum + getNaacScore(c.id, c.score), 0) / naacReport.criteria.length : 0;

  const handleApproveReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
    toast({ title: 'Report Approved', description: 'Report has been approved and digitally signed by the Vice Chancellor.' });
    setSelectedReport(null);
  };

  const handleSubmitReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'submitted' as const } : r));
    toast({ title: 'Report Submitted', description: 'Report submitted to the respective authority.' });
  };

  const handleSaveNirfSimulation = () => {
    setEditingNIRF(false);
    toast({ title: 'NIRF Simulation Saved', description: `Projected score: ${nirfTotal.toFixed(1)}/100. Estimated rank: #${Math.max(1, Math.round(150 - nirfTotal * 2))}.` });
  };

  const handleSaveNaacSimulation = () => {
    setEditingNAAC(false);
    const grade = naacTotal >= 3.51 ? 'A++' : naacTotal >= 3.26 ? 'A+' : naacTotal >= 3.01 ? 'A' : naacTotal >= 2.76 ? 'B++' : 'B+';
    toast({ title: 'NAAC Simulation Saved', description: `Projected CGPA: ${naacTotal.toFixed(2)}/4.00 — Grade: ${grade}` });
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> NIRF Score Simulator</CardTitle>
                <CardDescription>Current projected rank: #{Math.max(1, Math.round(150 - nirfTotal * 2))} (Score: {nirfTotal.toFixed(1)}/100)</CardDescription>
              </div>
              <Button variant={editingNIRF ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => editingNIRF ? handleSaveNirfSimulation() : setEditingNIRF(true)}>
                {editingNIRF ? <><Save className="h-3 w-3" /> Save</> : <><Edit className="h-3 w-3" /> Simulate</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              {(nirfReport?.criteria || []).map(c => (
                <div key={c.id} className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                  {editingNIRF ? (
                    <div className="mt-2">
                      <p className="text-lg font-bold text-primary">{getNirfScore(c.id, c.score)}</p>
                      <Slider value={[getNirfScore(c.id, c.score)]} onValueChange={v => setNirfScores(prev => ({ ...prev, [c.id]: v[0] }))} min={0} max={100} step={1} className="mt-2" />
                    </div>
                  ) : (
                    <>
                      <p className="text-lg font-bold mt-1">{getNirfScore(c.id, c.score)}</p>
                      <Progress value={getNirfScore(c.id, c.score)} className="h-1.5 mt-1" />
                    </>
                  )}
                  <Badge variant="outline" className={`text-[10px] mt-1 ${criterionStatusColors[c.status]}`}>{c.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="gap-1" onClick={() => {
                const gaps = (nirfReport?.criteria || []).filter(c => getNirfScore(c.id, c.score) < 60);
                const msg = gaps.length > 0
                  ? `Focus areas: ${gaps.map(g => `${g.name} (${getNirfScore(g.id, g.score)}/100)`).join(', ')}`
                  : 'All criteria above 60. Focus on Perception and Research for Top 40.';
                toast({ title: 'NIRF Gap Analysis', description: msg });
              }}>
                <TrendingUp className="h-4 w-4" /> Gap Analysis
              </Button>
              <Button variant="outline" className="gap-1" onClick={() => toast({ title: 'Report Generated', description: 'NIRF gap analysis report downloaded.' })}>
                <Download className="h-4 w-4" /> Download Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* NAAC Criteria Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> NAAC Criteria Breakdown</CardTitle>
                <CardDescription>
                  Projected CGPA: {naacTotal.toFixed(2)} / 4.00 — Target: {naacTotal >= 3.51 ? 'A++ ✓' : `A++ (3.51+) — Need +${(3.51 - naacTotal).toFixed(2)}`}
                </CardDescription>
              </div>
              <Button variant={editingNAAC ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => editingNAAC ? handleSaveNaacSimulation() : setEditingNAAC(true)}>
                {editingNAAC ? <><Save className="h-3 w-3" /> Save</> : <><Edit className="h-3 w-3" /> Simulate</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(naacReport?.criteria || []).map(c => (
                <div key={c.id} className="flex items-center gap-4">
                  <div className="w-48 text-sm truncate">{c.name}</div>
                  <div className="flex-1">
                    {editingNAAC ? (
                      <Slider value={[getNaacScore(c.id, c.score) * 25]} onValueChange={v => setNaacScores(prev => ({ ...prev, [c.id]: v[0] / 25 }))} min={0} max={100} step={1} />
                    ) : (
                      <Progress value={(getNaacScore(c.id, c.score) / c.maxScore) * 100} className="h-2.5" />
                    )}
                  </div>
                  <div className="w-16 text-right text-sm font-medium">{getNaacScore(c.id, c.score).toFixed(1)}/{c.maxScore}</div>
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
              {selectedReport?.status === 'draft' && (
                <Button onClick={() => { setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: 'in_review' as const } : r)); setSelectedReport(null); toast({ title: 'Sent for Review', description: 'Report sent to IQAC for review.' }); }} className="gap-1">
                  <Send className="h-4 w-4" /> Send for Review
                </Button>
              )}
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
