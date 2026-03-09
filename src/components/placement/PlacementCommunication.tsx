import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Mail, Send, Users, Bell, Calendar, FileText,
  Phone, CheckCircle2, Clock, Plus, Filter, Megaphone
} from 'lucide-react';

const recentMessages = [
  { id: 'M001', subject: 'Goldman Sachs Drive – Registration Open', recipients: 'B.Tech CSE, ECE (CGPA ≥ 8.0)', channel: 'email+sms', sentAt: new Date('2026-03-08'), status: 'delivered', readRate: '87%' },
  { id: 'M002', subject: 'Wipro Drive Schedule – 18 March', recipients: 'All eligible B.Tech, MCA', channel: 'email', sentAt: new Date('2026-03-07'), status: 'delivered', readRate: '72%' },
  { id: 'M003', subject: 'Aptitude Training – Mandatory for Batch 2026', recipients: 'All final year students', channel: 'email+whatsapp', sentAt: new Date('2026-03-06'), status: 'delivered', readRate: '91%' },
  { id: 'M004', subject: 'Resume Submission Reminder', recipients: 'Students with unverified resumes', channel: 'sms', sentAt: new Date('2026-03-05'), status: 'delivered', readRate: '68%' },
];

const templates = [
  { id: 'T001', name: 'Company Invitation Letter', desc: 'Formal invitation to company with university profile and student data', category: 'company' },
  { id: 'T002', name: 'Drive Registration Notice', desc: 'Notify eligible students about upcoming placement drive', category: 'student' },
  { id: 'T003', name: 'Interview Schedule', desc: 'Send interview slot details with venue and panel info', category: 'student' },
  { id: 'T004', name: 'Selection Congratulations', desc: 'Congratulate placed students with offer details', category: 'student' },
  { id: 'T005', name: 'Company Thank You Letter', desc: 'Post-drive thank you note to recruiting companies', category: 'company' },
  { id: 'T006', name: 'Training Reminder', desc: 'Reminder for upcoming aptitude/soft skills training sessions', category: 'student' },
];

export default function PlacementCommunication() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Communication Hub</h1>
            <p className="text-muted-foreground">Bulk notifications, email templates, and WhatsApp integration for placement activities</p>
          </div>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Message</Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Messages Sent</p><p className="text-2xl font-bold text-foreground">248</p><p className="text-xs text-muted-foreground">This month</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Read Rate</p><p className="text-2xl font-bold text-green-600">79.5%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">WhatsApp Delivered</p><p className="text-2xl font-bold text-foreground">1,420</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Sends</p><p className="text-2xl font-bold text-amber-600">3</p></CardContent></Card>
        </div>

        <Tabs defaultValue="compose">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="sent">Sent Messages</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <Card>
              <CardHeader><CardTitle className="text-lg">Compose Notification</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Target Audience</label>
                    <Select defaultValue="eligible">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eligible">All Eligible Students</SelectItem>
                        <SelectItem value="unplaced">Unplaced Students Only</SelectItem>
                        <SelectItem value="cse">CSE Students</SelectItem>
                        <SelectItem value="ece">ECE Students</SelectItem>
                        <SelectItem value="custom">Custom Filter...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Channel</label>
                    <Select defaultValue="email">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="all">All Channels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Subject</label>
                  <Input className="mt-1" placeholder="Enter message subject..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Message</label>
                  <Textarea className="mt-1" rows={5} placeholder="Type your message here. Use {{student_name}}, {{company_name}}, {{date}} for personalization..." />
                </div>
                <div className="flex gap-2">
                  <Button><Send className="mr-2 h-4 w-4" />Send Now</Button>
                  <Button variant="outline"><Clock className="mr-2 h-4 w-4" />Schedule</Button>
                  <Button variant="ghost"><FileText className="mr-2 h-4 w-4" />Save as Template</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent" className="space-y-3">
            {recentMessages.map((msg) => (
              <Card key={msg.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {msg.channel.includes('whatsapp') ? <Phone className="h-5 w-5 text-green-600" /> :
                       msg.channel.includes('sms') ? <MessageSquare className="h-5 w-5 text-primary" /> :
                       <Mail className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground">To: {msg.recipients}</p>
                      <p className="text-xs text-muted-foreground">{msg.sentAt.toLocaleDateString('en-IN')} • {msg.channel.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{msg.readRate}</p>
                      <p className="text-xs text-muted-foreground">read rate</p>
                    </div>
                    <Badge variant="default"><CheckCircle2 className="mr-1 h-3 w-3" />{msg.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{t.name}</h3>
                          <Badge variant="outline" className="capitalize">{t.category}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline">Preview</Button>
                          <Button size="sm">Use Template</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
