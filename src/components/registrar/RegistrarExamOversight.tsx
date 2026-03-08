import { useState } from 'react';
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
import { examProgress as initialExams } from '@/data/registrarMockData';
import { ExamProgress } from '@/types/registrar';

const statusColors: Record<string, string> = {
  scheduling: 'bg-blue-50 text-blue-700',
  ongoing: 'bg-amber-50 text-amber-700',
  mark_entry: 'bg-purple-50 text-purple-700',
  moderation: 'bg-orange-50 text-orange-700',
  published: 'bg-emerald-50 text-emerald-700',
};

export default function RegistrarExamOversight() {
  const { toast } = useToast();
  const [exams, setExams] = useState(initialExams);
  const [selectedExam, setSelectedExam] = useState<ExamProgress | null>(null);
  const [publishComment, setPublishComment] = useState('');

  const handlePublish = (id: string) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, status: 'published' as const, resultsPublished: true, marksEntered: e.totalStudents } : e));
    toast({ title: 'Results Published', description: 'Results have been published and students notified.' });
    setSelectedExam(null);
    setPublishComment('');
  };

  const handleAdvanceStatus = (id: string) => {
    const steps = ['scheduling', 'ongoing', 'mark_entry', 'moderation', 'published'];
    setExams(prev => prev.map(e => {
      if (e.id !== id) return e;
      const idx = steps.indexOf(e.status);
      if (idx < steps.length - 1) return { ...e, status: steps[idx + 1] as ExamProgress['status'] };
      return e;
    }));
    toast({ title: 'Status Advanced', description: 'Examination moved to next stage.' });
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
            { label: 'Results Published', value: exams.filter(e => e.resultsPublished).length, icon: CheckCircle },
            { label: 'In Progress', value: exams.filter(e => ['mark_entry', 'moderation'].includes(e.status)).length, icon: Clock },
            { label: 'Upcoming', value: exams.filter(e => e.status === 'scheduling').length, icon: Calendar },
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
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusColors[exam.status]}`}>
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{exam.examName} — {exam.semester}</p>
                      <Badge className={`text-[10px] ${statusColors[exam.status]}`}>{exam.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{exam.program} • Coordinator: {exam.coordinator}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" /> {exam.startDate.toLocaleDateString('en-IN')} — {exam.endDate.toLocaleDateString('en-IN')}
                      <span>•</span>
                      <Users className="h-3 w-3" /> {exam.totalStudents} students
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={(exam.marksEntered / exam.totalStudents) * 100} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{Math.round((exam.marksEntered / exam.totalStudents) * 100)}% marks entered</span>
                    </div>
                    {exam.marksEntered < exam.totalStudents && exam.status === 'mark_entry' && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {exam.totalStudents - exam.marksEntered} marks pending entry
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {exam.status !== 'published' && (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        if (exam.status === 'moderation') { setSelectedExam(exam); }
                        else handleAdvanceStatus(exam.id);
                      }}>
                        {exam.status === 'moderation' ? <><Send className="h-3 w-3" /> Publish</> : <><CheckCircle className="h-3 w-3" /> Advance</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast({ title: 'Hall Tickets', description: `Hall tickets generated for ${exam.totalStudents} students.` })}>
                      <FileText className="h-3 w-3" /> Hall Tickets
                    </Button>
                  </div>
                </div>
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
              <Button variant="outline" onClick={() => { setSelectedExam(null); setPublishComment(''); }}>Cancel</Button>
              <Button onClick={() => selectedExam && handlePublish(selectedExam.id)} className="gap-1">
                <Send className="h-4 w-4" /> Confirm & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
