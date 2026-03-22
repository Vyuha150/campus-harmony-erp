import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList, CheckCircle, Clock, AlertTriangle, Send,
  BarChart3, Users, Calendar, FileText, Download
} from 'lucide-react';
import { fetchApi, putApi } from '@/lib/apiService';
import { ExamProgress } from '@/types/registrar';

const statusColors: Record<string, string> = {
  scheduling: 'bg-blue-50 text-blue-700',
  ongoing: 'bg-amber-50 text-amber-700',
  evaluation: 'bg-purple-50 text-purple-700',
  mark_entry: 'bg-purple-50 text-purple-700',
  moderation: 'bg-orange-50 text-orange-700',
  published: 'bg-emerald-50 text-emerald-700',
};

function normalizeStatus(status: string): ExamProgress['status'] {
  if (status === 'evaluation') return 'mark_entry';
  if (status === 'completed') return 'published';
  if (status === 'scheduling' || status === 'ongoing' || status === 'mark_entry' || status === 'moderation' || status === 'published') {
    return status;
  }
  return 'scheduling';
}

function getSafeCounts(exam: any) {
  const totalStudents = Math.max(0, Number(exam.totalStudents) || 0);
  const enteredRaw = Math.max(0, Number(exam.marksEntered) || 0);
  const status = normalizeStatus(String(exam.status || 'scheduling'));
  const marksEntered = status === 'published' || exam.resultsPublished ? totalStudents : Math.min(enteredRaw, totalStudents);
  return { totalStudents, marksEntered, status };
}

export default function RegistrarExamOversight() {
  const [examProgress, setExamProgress] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/registrar/exams').then(d => setExamProgress(d)).catch((error) => { console.error('API request failed', error); });
    setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamProgress | null>(null);
  const [publishComment, setPublishComment] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    setExams(examProgress || []);
  }, [examProgress]);

  const handlePublish = async (id: string) => {
    try {
      setIsPublishing(true);
      const exam = exams.find(e => e.id === id);
      const { totalStudents } = getSafeCounts(exam);
      await putApi(`/registrar/exams/${id}`, {
        status: 'published',
        resultsPublished: true,
        marksEntered: totalStudents
      });
      setExams(prev => prev.map(e => {
        if (e.id !== id) return e;
        return { ...e, status: 'published' as const, resultsPublished: true, marksEntered: totalStudents };
      }));
      toast({ title: 'Results Published', description: 'Results have been published and students notified.' });
      setSelectedExam(null);
      setPublishComment('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAdvanceStatus = async (id: string) => {
    const steps = ['scheduling', 'ongoing', 'mark_entry', 'moderation', 'published'];
    try {
      setIsAdvancing(true);
      const exam = exams.find(e => e.id === id);
      const idx = steps.indexOf(normalizeStatus(String(exam?.status || 'scheduling')));
      if (idx >= 0 && idx < steps.length - 1) {
        const newStatus = steps[idx + 1];
        await putApi(`/registrar/exams/${id}`, { status: newStatus });
        setExams(prev => prev.map(e => {
          if (e.id !== id) return e;
          return { ...e, status: newStatus as ExamProgress['status'] };
        }));
        toast({ title: 'Status Advanced', description: 'Examination moved to next stage.' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Examination Oversight</h1>
            <p className="text-muted-foreground">Monitor exam schedules, mark entry progress, and result publication</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Exported', description: 'Exam progress report downloaded.' })}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Exams', value: exams.length, icon: ClipboardList },
            { label: 'Results Published', value: exams.filter(e => getSafeCounts(e).status === 'published' || e.resultsPublished).length, icon: CheckCircle },
            { label: 'In Progress', value: exams.filter(e => ['ongoing', 'mark_entry', 'moderation'].includes(getSafeCounts(e).status)).length, icon: Clock },
            { label: 'Upcoming', value: exams.filter(e => getSafeCounts(e).status === 'scheduling').length, icon: Calendar },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Exam Cards */}
        <div className="space-y-4">
          {exams.map(exam => (
            <Card key={exam.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {(() => {
                  const { totalStudents, marksEntered, status } = getSafeCounts(exam);
                  const completion = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;
                  const startDate = new Date(exam.startDate);
                  const endDate = new Date(exam.endDate);
                  return (
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusColors[status] || statusColors.scheduling}`}>
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{exam.examName} — {exam.semester}</p>
                      <Badge className={`text-[10px] ${statusColors[status] || statusColors.scheduling}`}>{status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{exam.program} • Coordinator: {exam.coordinator}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" /> {startDate.toLocaleDateString('en-IN')} — {endDate.toLocaleDateString('en-IN')}
                      <span>•</span>
                      <Users className="h-3 w-3" /> {totalStudents} students
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={completion} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{completion}% marks entered</span>
                    </div>
                    {marksEntered < totalStudents && status === 'mark_entry' && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {totalStudents - marksEntered} marks pending entry
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {status !== 'published' && (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        if (status === 'moderation') { setSelectedExam(exam); }
                        else handleAdvanceStatus(exam.id);
                      }} disabled={isAdvancing || isPublishing}>
                        {isAdvancing || isPublishing ? 'Updating...' : status === 'moderation' ? <><Send className="h-3 w-3" /> Publish</> : <><CheckCircle className="h-3 w-3" /> Advance</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast({ title: 'Hall Tickets', description: `Hall tickets generated for ${exam.totalStudents} students.` })}>
                      <FileText className="h-3 w-3" /> Hall Tickets
                    </Button>
                  </div>
                </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Publish Confirmation Dialog */}
        <Dialog open={!!selectedExam} onOpenChange={() => { setSelectedExam(null); setPublishComment(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish Results</DialogTitle>
              <DialogDescription>{selectedExam?.semester} — {selectedExam?.program}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Students:</span> <strong>{selectedExam?.totalStudents}</strong></div>
                  <div><span className="text-muted-foreground">Marks Entered:</span> <strong>{selectedExam?.marksEntered}</strong></div>
                  <div><span className="text-muted-foreground">Coordinator:</span> <strong>{selectedExam?.coordinator}</strong></div>
                  <div><span className="text-muted-foreground">Status:</span> <strong>Moderation Complete</strong></div>
                </div>
              </div>
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Publishing results is irreversible. Ensure all moderation is complete.</p>
              </div>
              <Textarea placeholder="Add remarks (optional)..." value={publishComment} onChange={e => setPublishComment(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedExam(null); setPublishComment(''); }} disabled={isPublishing}>Cancel</Button>
              <Button onClick={() => selectedExam && handlePublish(selectedExam.id)} disabled={isPublishing} className="gap-1">
                <Send className="h-4 w-4" /> {isPublishing ? 'Publishing...' : 'Confirm & Publish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
