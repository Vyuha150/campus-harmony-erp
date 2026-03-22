import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Mail, MessageSquare, Users, Eye, Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export default function FacultyCommunication() {
  const [classMessages, setClassMessages] = useState<any>([]);
  const [facultyCourses, setFacultyCourses] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadCommunicationData = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const [messagesData, coursesData] = await Promise.all([
      fetchApi(`/faculty/messages${semesterQuery}`),
      fetchApi(`/faculty/courses${semesterQuery}`)
    ]);
    setClassMessages(Array.isArray(messagesData) ? messagesData : []);
    setFacultyCourses(Array.isArray(coursesData) ? coursesData : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [allCourses, currentSemesterResponse] = await Promise.all([
          fetchApi('/faculty/courses'),
          fetchApi('/faculty/current-semester')
        ]);
        const semesters = Array.from(new Set((Array.isArray(allCourses) ? allCourses : []).map((course: any) => Number(course?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        setSemesterOptions(semesters);
        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        await loadCommunicationData(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadCommunicationData(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ courseId: '', subject: '', message: '' });

  const sendMessage = async () => {
    if (!form.courseId || !form.subject.trim() || !form.message.trim()) {
      toast({ title: 'Missing details', description: 'Course, subject, and message are required.', variant: 'destructive' });
      return;
    }

    const course = facultyCourses.find((item: any) => item.id === form.courseId);
    try {
      setSending(true);
      const created = await postApi('/faculty/messages', {
        courseId: form.courseId,
        courseCode: course?.code || '',
        subject: form.subject.trim(),
        message: form.message.trim()
      });
      setClassMessages((prev: any[]) => [created, ...prev]);
      setForm({ courseId: '', subject: '', message: '' });
      toast({ title: 'Message sent', description: 'Your message has been delivered to recipients.' });
    } catch (error: any) {
      toast({ title: 'Send failed', description: error?.message || 'Unable to send message.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Communication</h1>
          <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterOptions.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />New Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Message to Students</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Course / Group</Label>
                  <Select value={form.courseId} onValueChange={(value) => setForm((prev) => ({ ...prev, courseId: value }))}><SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                    <SelectContent>
                      {facultyCourses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} – {c.name} ({c.totalStudents} students)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Subject</Label><Input placeholder="Message subject" value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} /></div>
                <div><Label>Message</Label><Textarea placeholder="Type your message..." rows={4} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))} /></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="rounded" />
                  <span>Also send via Email</span>
                </div>
                <Button className="w-full" onClick={sendMessage} disabled={sending}>
                  <Send className="mr-1 h-4 w-4" />{sending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {classMessages.map((msg) => (
            <Card key={msg.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{msg.courseCode}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(msg.sentAt).toLocaleString('en-IN')}</span>
                    </div>
                    <h3 className="font-medium text-foreground">{msg.subject}</h3>
                    <p className="text-sm text-muted-foreground">{msg.message}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />{msg.recipients}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Eye className="h-3 w-3" />{msg.readCount} read
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
