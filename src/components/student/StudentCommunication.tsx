import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MailOpen, User, BookOpen, Calendar } from 'lucide-react';
import { fetchApi } from '@/lib/apiService';

export default function StudentCommunication() {
  const [messages, setMessages] = useState<any[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadMessages = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const messagesData = await fetchApi(`/students/messages${semesterQuery}`);
    setMessages(Array.isArray(messagesData) ? messagesData : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [allCourses, currentSemesterResponse] = await Promise.all([
          fetchApi('/students/courses'),
          fetchApi('/students/current-semester')
        ]);

        const semesters = Array.from(
          new Set(
            (Array.isArray(allCourses) ? allCourses : [])
              .map((course: any) => Number(course?.semester))
              .filter((value) => Number.isFinite(value))
          )
        ).sort((a: any, b: any) => a - b);

        setSemesterOptions(semesters);

        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');

        setSelectedSemester(defaultSemester);
        await loadMessages(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (loading) return;
    loadMessages(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication</h1>
            <p className="text-muted-foreground">Messages shared by your faculty for enrolled courses</p>
          </div>
          <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterOptions.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {messages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <MailOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No messages available</p>
              <p className="text-sm text-muted-foreground">You will see faculty communications here as they are posted.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <Card key={msg.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{msg.courseCode || 'Course'}</Badge>
                        {msg.semester ? <Badge variant="secondary">Semester {msg.semester}</Badge> : null}
                      </div>
                      <h3 className="font-medium text-foreground">{msg.subject}</h3>
                      <p className="text-sm text-muted-foreground">{msg.message}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{msg.courseName || 'Course'}</span>
                        <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{msg.facultyName || 'Faculty'}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(msg.sentAt).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}