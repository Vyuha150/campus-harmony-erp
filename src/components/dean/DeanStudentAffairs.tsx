import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, Shield, CheckCircle, Clock, Gavel, FileWarning,
  Send, UserX
} from 'lucide-react';
import { disciplinaryCases as initialCases } from '@/data/deanMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DisciplinaryCase } from '@/types/dean';

const severityColors: Record<string, string> = {
  minor: 'secondary', major: 'destructive', critical: 'destructive',
};
const statusColors: Record<string, string> = {
  escalated: 'destructive', under_review: 'secondary', action_taken: 'default', closed: 'outline',
};
const typeIcons: Record<string, React.ElementType> = {
  malpractice: FileWarning, misconduct: Gavel, ragging: Shield, attendance_shortage: Clock,
};

export default function DeanStudentAffairs() {
  const [cases, setCases] = useState<DisciplinaryCase[]>(initialCases);
  const [selected, setSelected] = useState<string | null>(null);
  const [decision, setDecision] = useState('');
  const { toast } = useToast();

  const item = cases.find(c => c.id === selected);

  const takeAction = (action: string, newStatus: DisciplinaryCase['status']) => {
    if (!item) return;
    setCases(prev => prev.map(c => c.id === item.id ? { ...c, status: newStatus } : c));
    toast({ title: action, description: `${item.studentName} – ${decision || 'No remarks'}` });
    setDecision('');
    setSelected(null);
  };

  if (item) {
    const Icon = typeIcons[item.type] || AlertTriangle;
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setDecision(''); }}>← Back to Cases</Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{item.studentName} – {item.type.replace('_', ' ')}</h1>
                <p className="text-sm text-muted-foreground">{item.rollNumber} • {item.department} • Reported by {item.reportedBy}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={severityColors[item.severity] as any} className="capitalize">{item.severity}</Badge>
              <Badge variant={statusColors[item.status] as any} className="capitalize">{item.status.replace('_', ' ')}</Badge>
            </div>
          </div>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Case Details</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{item.description}</p></CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Dean's Decision / Action</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Enter your decision or remarks..." rows={4} value={decision} onChange={e => setDecision(e.target.value)} />
              <div className="flex justify-end gap-2">
                {item.type === 'attendance_shortage' && (
                  <Button variant="outline" onClick={() => takeAction('Attendance Condoned', 'action_taken')}>
                    <CheckCircle className="mr-1 h-4 w-4" />Condone Attendance
                  </Button>
                )}
                <Button variant="outline" className="text-destructive" onClick={() => takeAction('Suspension Issued', 'action_taken')}>
                  <UserX className="mr-1 h-4 w-4" />Suspend
                </Button>
                <Button variant="outline" onClick={() => takeAction('Warning Issued', 'action_taken')}>
                  <FileWarning className="mr-1 h-4 w-4" />Issue Warning
                </Button>
                <Button onClick={() => takeAction('Case Closed', 'closed')}>
                  <Send className="mr-1 h-4 w-4" />Submit & Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const escalated = cases.filter(c => c.status === 'escalated').length;
  const underReview = cases.filter(c => c.status === 'under_review').length;
  const resolved = cases.filter(c => c.status === 'action_taken' || c.status === 'closed').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Student Affairs</h1>
        <p className="text-muted-foreground">Disciplinary cases, scholarships, and student welfare</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Escalated Cases', count: escalated, color: 'text-destructive bg-destructive/10', icon: AlertTriangle },
            { label: 'Under Review', count: underReview, color: 'text-amber-600 bg-amber-100', icon: Clock },
            { label: 'Resolved', count: resolved, color: 'text-green-600 bg-green-100', icon: CheckCircle },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {cases.map(c => {
            const Icon = typeIcons[c.type] || AlertTriangle;
            return (
              <Card key={c.id} className="border-border cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(c.id)}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{c.studentName} ({c.rollNumber}) – {c.type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{c.department} • {c.reportedAt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={severityColors[c.severity] as any} className="capitalize text-[10px]">{c.severity}</Badge>
                    <Badge variant={statusColors[c.status] as any} className="capitalize text-[10px]">{c.status.replace('_', ' ')}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
