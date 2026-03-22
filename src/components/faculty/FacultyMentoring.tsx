import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Users, AlertTriangle, Phone, Mail, Calendar, FileText,
  Plus, Eye, MessageSquare, TrendingDown, TrendingUp
} from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function FacultyMentoring() {
  const [menteeStudents, setMenteeStudents] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/faculty/mentees').then(d => setMenteeStudents(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [selectedMentee, setSelectedMentee] = useState<string | null>(null);
  const { toast } = useToast();
  const [savingNote, setSavingNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ topic: '', notes: '', followUpDate: '' });
  const mentee = menteeStudents.find(m => m.id === selectedMentee);

  const saveCounselingNote = async () => {
    if (!selectedMentee || !noteForm.topic.trim() || !noteForm.notes.trim()) {
      toast({ title: 'Missing details', description: 'Topic and notes are required.', variant: 'destructive' });
      return;
    }

    try {
      setSavingNote(true);
      const created = await postApi(`/faculty/mentees/${selectedMentee}/notes`, {
        topic: noteForm.topic.trim(),
        notes: noteForm.notes.trim(),
        followUpDate: noteForm.followUpDate || null
      });

      setMenteeStudents((prev: any[]) => prev.map((student) => (
        student.id === selectedMentee
          ? {
              ...student,
              counselingNotes: [
                {
                  id: created.id,
                  date: new Date(created.date || Date.now()).toLocaleDateString('en-IN'),
                  topic: created.topic,
                  notes: created.notes,
                  followUpDate: created.followUpDate ? new Date(created.followUpDate).toLocaleDateString('en-IN') : null,
                  status: created.status || 'open'
                },
                ...(student.counselingNotes || [])
              ],
              lastMeetingDate: new Date().toLocaleDateString('en-IN')
            }
          : student
      )));

      setNoteForm({ topic: '', notes: '', followUpDate: '' });
      toast({ title: 'Note added', description: 'Counseling note saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save note.', variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  if (mentee) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMentee(null)}>← Back to Mentees</Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{mentee.name}</h1>
              <p className="text-muted-foreground">{mentee.rollNumber} • {mentee.program} • Sem {mentee.semester}</p>
            </div>
            <Badge variant={mentee.riskLevel === 'high' ? 'destructive' : mentee.riskLevel === 'medium' ? 'secondary' : 'default'} className="capitalize">
              {mentee.riskLevel} Risk
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'CGPA', value: mentee.cgpa, color: mentee.cgpa < 6 ? 'text-destructive' : 'text-foreground' },
              { label: 'Attendance', value: `${mentee.attendance}%`, color: mentee.attendance < 75 ? 'text-destructive' : 'text-foreground' },
              { label: 'Section', value: mentee.section, color: 'text-foreground' },
              { label: 'Semester', value: mentee.semester, color: 'text-foreground' },
            ].map(s => (
              <Card key={s.label} className="border-border">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{mentee.email}</div>
            <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{mentee.phone}</div>
            <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />Last Meeting: {mentee.lastMeetingDate || 'Never'}</div>
          </div>

          {/* Counseling Notes */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Counseling Notes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Note</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Counseling Note</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Topic</Label><Input placeholder="e.g., Academic Progress" value={noteForm.topic} onChange={(event) => setNoteForm((prev) => ({ ...prev, topic: event.target.value }))} /></div>
                    <div><Label>Notes</Label><Textarea placeholder="Session details..." rows={4} value={noteForm.notes} onChange={(event) => setNoteForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
                    <div><Label>Follow-up Date</Label><Input type="date" value={noteForm.followUpDate} onChange={(event) => setNoteForm((prev) => ({ ...prev, followUpDate: event.target.value }))} /></div>
                    <Button className="w-full" onClick={saveCounselingNote} disabled={savingNote}>{savingNote ? 'Saving...' : 'Save Note'}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {mentee.counselingNotes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No counseling notes yet</p>
              ) : (
                mentee.counselingNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{note.date}</span>
                        <Badge variant="outline">{note.topic}</Badge>
                      </div>
                      <Badge variant={note.status === 'open' ? 'secondary' : 'default'} className="capitalize">{note.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{note.notes}</p>
                    {note.followUpDate && (
                      <p className="mt-1 text-xs text-amber-600">Follow-up: {note.followUpDate}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Advisory / Mentoring</h1>
        <p className="text-muted-foreground">Manage your mentee students and track their academic progress.</p>

        {/* Risk Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'High Risk', count: menteeStudents.filter(m => m.riskLevel === 'high').length, color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertTriangle },
            { label: 'Medium Risk', count: menteeStudents.filter(m => m.riskLevel === 'medium').length, color: 'text-amber-600', bg: 'bg-amber-100', icon: TrendingDown },
            { label: 'Low Risk', count: menteeStudents.filter(m => m.riskLevel === 'low').length, color: 'text-green-600', bg: 'bg-green-100', icon: TrendingUp },
          ].map(r => (
            <Card key={r.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${r.bg}`}>
                  <r.icon className={`h-5 w-5 ${r.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{r.count}</p>
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mentee Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menteeStudents.map((student) => (
            <Card key={student.id} className="cursor-pointer border-border transition-shadow hover:shadow-md" onClick={() => setSelectedMentee(student.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.rollNumber} • {student.program}</p>
                  </div>
                  <Badge variant={student.riskLevel === 'high' ? 'destructive' : student.riskLevel === 'medium' ? 'secondary' : 'default'} className="capitalize text-[10px]">
                    {student.riskLevel}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">CGPA</p>
                    <p className={`text-lg font-bold ${student.cgpa < 6 ? 'text-destructive' : 'text-foreground'}`}>{student.cgpa}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                    <p className={`text-lg font-bold ${student.attendance < 75 ? 'text-destructive' : 'text-foreground'}`}>{student.attendance}%</p>
                  </div>
                </div>
                <Progress value={student.attendance} className="mt-2 h-1.5" />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{student.counselingNotes.length} notes</span>
                  <span>Last: {student.lastMeetingDate || 'Never'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
