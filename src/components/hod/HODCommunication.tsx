import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Send, MessageSquare, Users, GraduationCap, Megaphone, Plus, Eye, Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const messages = [
  {
    id: 'hm-1', subject: 'Department Faculty Meeting – Monday 3 PM',
    message: 'All faculty members are requested to attend the monthly department meeting on Monday, 10 March at 3 PM in Conference Room 2. Agenda: Exam preparation, NIRF data review.',
    sentAt: '2026-03-07', recipients: 'All Faculty', recipientCount: 7, readCount: 5,
  },
  {
    id: 'hm-2', subject: 'Placement Training Session for Final Year',
    message: 'A mandatory placement aptitude training session is scheduled for all 4th year CSE students on 12 March from 2–4 PM in LH-401. Attendance is compulsory.',
    sentAt: '2026-03-06', recipients: '4th Year Students', recipientCount: 58, readCount: 42,
  },
  {
    id: 'hm-3', subject: 'Mid-Semester Exam Schedule Finalized',
    message: 'The mid-semester exam timetable has been finalized and published. Please check the exam portal for your schedule. Any conflicts must be reported by 15 March.',
    sentAt: '2026-03-05', recipients: 'All Students', recipientCount: 245, readCount: 180,
  },
  {
    id: 'hm-4', subject: 'Submit Question Papers by 15 March',
    message: 'All course instructors are reminded to submit their end-semester question papers to the Exam Cell by 15 March 2026. Please follow the question paper template.',
    sentAt: '2026-03-03', recipients: 'All Faculty', recipientCount: 7, readCount: 7,
  },
];

export default function HODCommunication() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication</h1>
            <p className="text-muted-foreground">Broadcast messages to department faculty and students</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />New Message</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Recipients</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_faculty">All Department Faculty</SelectItem>
                      <SelectItem value="all_students">All Department Students</SelectItem>
                      <SelectItem value="year1">1st Year Students</SelectItem>
                      <SelectItem value="year2">2nd Year Students</SelectItem>
                      <SelectItem value="year3">3rd Year Students</SelectItem>
                      <SelectItem value="year4">4th Year Students</SelectItem>
                      <SelectItem value="pg">PG Students</SelectItem>
                      <SelectItem value="everyone">Everyone (Faculty + Students)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input placeholder="Message subject..." />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea placeholder="Type your message..." rows={5} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded border-border" />
                    Send via Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded border-border" />
                    Send via WhatsApp
                  </label>
                </div>
                <Button className="w-full" onClick={() => toast({ title: 'Message Sent', description: 'Notification delivered to all recipients.' })}>
                  <Send className="mr-1 h-4 w-4" />Send Message
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Targets */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Message All Faculty', icon: Users, count: 7 },
            { label: 'Message All Students', icon: GraduationCap, count: 245 },
            { label: 'Post Notice', icon: Megaphone, count: 0 },
          ].map(t => (
            <Button key={t.label} variant="outline" className="h-auto flex-col gap-1 py-4 text-xs"
              onClick={() => toast({ title: 'Compose', description: `Opening compose for: ${t.label}` })}>
              <t.icon className="h-5 w-5 text-primary" />
              {t.label}
              {t.count > 0 && <span className="text-[10px] text-muted-foreground">{t.count} recipients</span>}
            </Button>
          ))}
        </div>

        {/* Sent Messages */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sent Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{msg.recipients}</Badge>
                    <span className="text-xs text-muted-foreground">{msg.sentAt}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />{msg.recipientCount}
                    <Eye className="h-3 w-3 text-green-600" />{msg.readCount} read
                  </div>
                </div>
                <h3 className="mt-2 font-medium text-foreground">{msg.subject}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
