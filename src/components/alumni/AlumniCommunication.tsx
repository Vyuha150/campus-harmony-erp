import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, Plus, Mail, Eye, BarChart3, Users, Clock, MessageSquare } from 'lucide-react';
import { alumniCommunications } from '@/data/alumniMockData';

const templates = [
  { id: 'T1', name: 'Monthly Newsletter', type: 'newsletter' },
  { id: 'T2', name: 'Event Invitation', type: 'invitation' },
  { id: 'T3', name: 'Survey Request', type: 'update' },
  { id: 'T4', name: 'Fundraising Appeal', type: 'announcement' },
];

export default function AlumniCommunication() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Communication Hub</h1>
            <p className="text-muted-foreground">Newsletters, bulk emails, social media outreach, and engagement tracking</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Campaign</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Communication Campaign</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Campaign Title</Label><Input placeholder="e.g. April Newsletter" /></div>
                <div><Label>Type</Label>
                  <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="newsletter">Newsletter</SelectItem><SelectItem value="announcement">Announcement</SelectItem><SelectItem value="invitation">Event Invitation</SelectItem><SelectItem value="update">Update</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Template</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger><SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent></Select>
                </div>
                <div><Label>Target Audience</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger><SelectContent>
                    <SelectItem value="all">All Alumni (15,200)</SelectItem><SelectItem value="batch2024">Batch 2024 (520)</SelectItem><SelectItem value="batch2023">Batch 2023 (480)</SelectItem><SelectItem value="tech">Technology Industry (4,200)</SelectItem><SelectItem value="mentors">Active Mentors (45)</SelectItem>
                  </SelectContent></Select>
                </div>
                <div><Label>Subject Line</Label><Input placeholder="Email subject" /></div>
                <div><Label>Content</Label><Textarea rows={6} placeholder="Write your message..." /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Channel</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger><SelectContent>
                      <SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="push">Push Notification</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div><Label>Schedule</Label><Input type="datetime-local" /></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">Save Draft</Button>
                  <Button className="flex-1"><Send className="mr-2 h-4 w-4" />Send Now</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><Mail className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">156</p><p className="text-xs text-muted-foreground">Campaigns Sent</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">42%</p><p className="text-xs text-muted-foreground">Avg Open Rate</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><BarChart3 className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">12%</p><p className="text-xs text-muted-foreground">Avg Click Rate</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><MessageSquare className="h-8 w-8 text-blue-600" /><div><p className="text-2xl font-bold text-foreground">3</p><p className="text-xs text-muted-foreground">Drafts Pending</p></div></CardContent></Card>
        </div>

        {/* Templates */}
        <Card>
          <CardHeader><CardTitle>Quick Templates</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {templates.map(t => (
                <Button key={t.id} variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="text-sm">{t.name}</span>
                  <Badge variant="outline" className="capitalize text-xs">{t.type}</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent campaigns */}
        <Card>
          <CardHeader><CardTitle>Recent Campaigns</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sent</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Recipients</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Open Rate</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Click Rate</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {alumniCommunications.map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{c.title}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{c.type}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.sentDate?.toLocaleDateString('en-IN') || '–'}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{c.recipientCount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{c.openRate}%</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{c.clickRate}%</td>
                      <td className="px-4 py-3"><Badge variant={c.status === 'sent' ? 'default' : 'secondary'} className="capitalize">{c.status}</Badge></td>
                      <td className="px-4 py-3"><Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" />View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
