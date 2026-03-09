import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, Send, Plus, Mail, Eye, Clock } from 'lucide-react';
import { systemNotifications } from '@/data/adminMockData';
import { useState } from 'react';

export default function AdminNotifications() {
  const [showCompose, setShowCompose] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notifications Management</h1>
            <p className="text-muted-foreground">Broadcast system-wide announcements and notifications</p>
          </div>
          <Dialog open={showCompose} onOpenChange={setShowCompose}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Notification</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Compose Notification</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input placeholder="Notification title" /></div>
                <div><Label>Message</Label><Textarea placeholder="Write your notification message..." className="min-h-[100px]" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Audience</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="All users" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="students">Students Only</SelectItem>
                        <SelectItem value="faculty">Faculty Only</SelectItem>
                        <SelectItem value="staff">Staff Only</SelectItem>
                        <SelectItem value="admin">Admin Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCompose(false)}>Save Draft</Button>
                  <Button><Send className="mr-2 h-4 w-4" />Send Now</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{systemNotifications.length}</p>
            <p className="text-xs text-muted-foreground">Total Notifications</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{systemNotifications.filter(n => n.status === 'sent').length}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{systemNotifications.filter(n => n.status === 'draft').length}</p>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent></Card>
        </div>

        {/* Notification List */}
        <div className="space-y-3">
          {systemNotifications.map(n => (
            <Card key={n.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-1 rounded-lg p-2 ${n.type === 'warning' ? 'bg-amber-500/10' : n.type === 'error' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      <Bell className={`h-5 w-5 ${n.type === 'warning' ? 'text-amber-500' : n.type === 'error' ? 'text-destructive' : 'text-primary'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{n.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{n.sentBy}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{n.sentDate.toLocaleDateString('en-IN')}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{n.readCount.toLocaleString()}/{n.totalRecipients.toLocaleString()} read</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {n.targetRoles.slice(0, 4).map(r => (
                          <Badge key={r} variant="outline" className="text-xs capitalize">{r.replace('_', ' ')}</Badge>
                        ))}
                        {n.targetRoles.length > 4 && <Badge variant="outline" className="text-xs">+{n.targetRoles.length - 4} more</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={n.status === 'sent' ? 'default' : n.status === 'scheduled' ? 'secondary' : 'outline'} className="capitalize">{n.status}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {Math.round((n.readCount / n.totalRecipients) * 100)}% read rate
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
