import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Clock, FileText, Send, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { criteriaProgress, qualityDocuments } from '@/data/iqacMockData';
import { useState } from 'react';

export default function IQACCriteria() {
  const [expandedCriteria, setExpandedCriteria] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

  const overallProgress = Math.round(criteriaProgress.reduce((a, b) => a + b.dataProgress, 0) / criteriaProgress.length);
  const totalDocs = criteriaProgress.reduce((a, b) => a + b.documentsUploaded, 0);
  const totalRequired = criteriaProgress.reduce((a, b) => a + b.requiredDocuments, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'needs_attention': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default' as const;
      case 'needs_attention': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  const criterionDocs = (criteriaNum: number) =>
    qualityDocuments.filter(d => d.criteriaNumber === criteriaNum);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">NAAC Criteria Progress</h1>
            <p className="text-muted-foreground">Track SSR data compilation across all 7 NAAC criteria</p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Overall: {overallProgress}% • Docs: {totalDocs}/{totalRequired}
          </Badge>
        </div>

        {/* Summary Bar */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Overall SSR Readiness</span>
                  <span className="font-semibold text-foreground">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{criteriaProgress.filter(c => c.status === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">{criteriaProgress.filter(c => c.status === 'in_progress').length}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{criteriaProgress.filter(c => c.status === 'needs_attention').length}</p>
                  <p className="text-xs text-muted-foreground">Needs Attention</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Criteria Cards */}
        {criteriaProgress.map((c) => (
          <Card key={c.criteriaNumber} className={c.status === 'needs_attention' ? 'border-destructive/50' : ''}>
            <CardContent className="p-5">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedCriteria(expandedCriteria === c.criteriaNumber ? null : c.criteriaNumber)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(c.status)}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.criteriaNumber}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{c.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Docs: {c.documentsUploaded}/{c.requiredDocuments} uploaded • Last updated: {c.lastUpdated.toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-40">
                      <Progress value={c.dataProgress} className="h-2" />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right text-foreground">{c.dataProgress}%</span>
                    <Badge variant={getStatusVariant(c.status)} className="capitalize w-28 justify-center">
                      {c.status.replace('_', ' ')}
                    </Badge>
                    {expandedCriteria === c.criteriaNumber ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </div>

              {expandedCriteria === c.criteriaNumber && (
                <div className="mt-4 border-t pt-4 space-y-4">
                  {/* Issues */}
                  {c.issues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Pending Issues</h4>
                      <div className="space-y-1">
                        {c.issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Documents */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Uploaded Documents</h4>
                    {criterionDocs(c.criteriaNumber).length > 0 ? (
                      <div className="space-y-2">
                        {criterionDocs(c.criteriaNumber).map(d => (
                          <div key={d.id} className="flex items-center justify-between rounded-md border p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{d.title}</p>
                                <p className="text-xs text-muted-foreground">v{d.version} • {d.uploadedBy} • {d.uploadDate.toLocaleDateString('en-IN')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={d.status === 'approved' ? 'default' : d.status === 'needs_revision' ? 'destructive' : 'secondary'} className="capitalize">
                                {d.status.replace('_', ' ')}
                              </Badge>
                              <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No documents uploaded for this criterion yet.</p>
                    )}
                  </div>

                  {/* Send Note to Department */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Send Note to Department</h4>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="E.g., Please update research publications list – discrepancy noted in Criterion 3"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <Button size="sm" className="self-end">
                        <Send className="mr-1 h-4 w-4" /> Send
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
