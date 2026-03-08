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
import { classMessages, facultyCourses } from '@/data/facultyMockData';
import { useToast } from '@/hooks/use-toast';

export default function FacultyCommunication() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Communication</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />New Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Message to Students</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Course / Group</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select recipients" /></SelectTrigger>
                    <SelectContent>
                      {facultyCourses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} – {c.name} ({c.totalStudents} students)</SelectItem>
                      ))}
                      <SelectItem value="mentees">My Mentees (5 students)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Subject</Label><Input placeholder="Message subject" /></div>
                <div><Label>Message</Label><Textarea placeholder="Type your message..." rows={4} /></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="rounded" />
                  <span>Also send via Email</span>
                </div>
                <Button className="w-full" onClick={() => toast({ title: 'Message Sent', description: 'Your message has been delivered to all recipients.' })}>
                  <Send className="mr-1 h-4 w-4" />Send Message
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
