import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Clock, Users, FileText, CheckCircle,
  Plus, AlertTriangle, Eye, ListChecks, Download,
  PlayCircle, StopCircle, ArrowRightLeft
} from 'lucide-react';
import { meetingAgendas as initialMeetings } from '@/data/vcMockData';
import { MeetingAgenda, ActionItem } from '@/types/vc';

const meetingTypeLabels: Record<string, string> = {
  board_of_management: 'Board of Management',
  academic_council: 'Academic Council',
  finance_committee: 'Finance Committee',
  executive_council: 'Executive Council',
  senate: 'Senate',
};

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
};

export default function VCMeetings() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingAgenda | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showCreateMeetingDialog, setShowCreateMeetingDialog] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [selectedAgendaId, setSelectedAgendaId] = useState('');

  // New meeting form
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingType, setNewMeetingType] = useState('academic_council');
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [newMeetingVenue, setNewMeetingVenue] = useState('');

  const handleMarkDiscussed = (meetingId: string, agendaId: string) => {
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? {
        ...m,
        agendaItems: m.agendaItems.map(a => a.id === agendaId ? { ...a, status: 'discussed' as const } : a)
      } : m
    ));
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, agendaItems: prev.agendaItems.map(a => a.id === agendaId ? { ...a, status: 'discussed' as const } : a) } : null);
    }
    toast({ title: 'Updated', description: 'Agenda item marked as discussed.' });
  };

  const handleDeferAgenda = (meetingId: string, agendaId: string) => {
    setMeetings(prev => prev.map(m =>
      m.id === meetingId ? {
        ...m,
        agendaItems: m.agendaItems.map(a => a.id === agendaId ? { ...a, status: 'deferred' as const } : a)
      } : m
    ));
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, agendaItems: prev.agendaItems.map(a => a.id === agendaId ? { ...a, status: 'deferred' as const } : a) } : null);
    }
    toast({ title: 'Deferred', description: 'Agenda item deferred to next meeting.' });
  };

  const handleStartMeeting = (meetingId: string) => {
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status: 'in_progress' as const } : m));
    toast({ title: 'Meeting Started', description: 'Meeting is now in progress.' });
  };

  const handleCompleteMeeting = (meetingId: string) => {
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status: 'completed' as const } : m));
    setSelectedMeeting(null);
    toast({ title: 'Meeting Completed', description: 'Meeting marked as completed. Minutes will be generated.' });
  };

  const handleAddActionItem = () => {
    if (!newTask || !newAssignee || !selectedMeeting || !selectedAgendaId) return;
    const actionItem: ActionItem = {
      id: `ai_${Date.now()}`,
      task: newTask,
      assignedTo: newAssignee,
      deadline: new Date(newDeadline || Date.now() + 30 * 86400000),
      status: 'pending',
    };
    const updater = (m: MeetingAgenda) =>
      m.id === selectedMeeting.id ? {
        ...m,
        agendaItems: m.agendaItems.map(a => a.id === selectedAgendaId ? {
          ...a,
          actionItems: [...(a.actionItems || []), actionItem]
        } : a)
      } : m;

    setMeetings(prev => prev.map(updater));
    setSelectedMeeting(prev => prev ? updater(prev) : null);
    setShowActionDialog(false);
    setNewTask('');
    setNewAssignee('');
    setNewDeadline('');
    toast({ title: 'Action Item Added', description: `Task assigned to ${newAssignee}.` });
  };

  const handleToggleActionStatus = (meetingId: string, agendaId: string, actionId: string) => {
    const updater = (m: MeetingAgenda) =>
      m.id === meetingId ? {
        ...m,
        agendaItems: m.agendaItems.map(a => a.id === agendaId ? {
          ...a,
          actionItems: a.actionItems?.map(ai => ai.id === actionId ? { ...ai, status: ai.status === 'completed' ? 'pending' as const : 'completed' as const } : ai)
        } : a)
      } : m;

    setMeetings(prev => prev.map(updater));
    setSelectedMeeting(prev => prev ? updater(prev) : null);
  };

  const handleCreateMeeting = () => {
    if (!newMeetingTitle || !newMeetingDate) return;
    const newMeeting: MeetingAgenda = {
      id: `m${meetings.length + 1}`,
      meetingType: newMeetingType as any,
      title: newMeetingTitle,
      date: new Date(newMeetingDate),
      time: newMeetingTime || '10:00 AM',
      venue: newMeetingVenue || 'TBD',
      status: 'upcoming',
      agendaItems: [],
      attendees: ['Vice Chancellor', 'Pro-VC', 'Registrar'],
      documents: [],
    };
    setMeetings(prev => [...prev, newMeeting]);
    setShowCreateMeetingDialog(false);
    setNewMeetingTitle('');
    setNewMeetingDate('');
    setNewMeetingTime('');
    setNewMeetingVenue('');
    toast({ title: 'Meeting Scheduled', description: `"${newMeetingTitle}" has been scheduled.` });
  };

  const allActionItems = meetings.flatMap(m =>
    m.agendaItems.flatMap(a => (a.actionItems || []).map(ai => ({ ...ai, meeting: m.title, agenda: a.title })))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meetings & Workflow</h1>
            <p className="text-muted-foreground">Manage statutory body meetings, agendas, and follow-up actions</p>
          </div>
          <Button onClick={() => setShowCreateMeetingDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Schedule Meeting
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Meetings', value: meetings.length, icon: Calendar },
            { label: 'Upcoming', value: meetings.filter(m => m.status === 'upcoming').length, icon: Clock },
            { label: 'In Progress', value: meetings.filter(m => m.status === 'in_progress').length, icon: PlayCircle },
            { label: 'Pending Actions', value: allActionItems.filter(a => a.status !== 'completed').length, icon: AlertTriangle },
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

        {/* Meeting Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {meetings.map(meeting => (
            <Card key={meeting.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMeeting(meeting)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{meetingTypeLabels[meeting.meetingType]}</Badge>
                  <Badge className={`text-[10px] ${statusColors[meeting.status]}`}>{meeting.status.replace('_', ' ')}</Badge>
                </div>
                <CardTitle className="text-sm mt-2">{meeting.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {meeting.date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {meeting.time} • {meeting.venue}</div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {meeting.attendees.length} attendees</div>
                  <div className="flex items-center gap-2"><ListChecks className="h-3.5 w-3.5" /> {meeting.agendaItems.length} agenda items</div>
                  <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> {meeting.documents.length} documents</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelectedMeeting(meeting); }}>
                    <Eye className="h-3 w-3" /> View
                  </Button>
                  {meeting.status === 'upcoming' && (
                    <Button size="sm" className="flex-1 text-xs gap-1" onClick={e => { e.stopPropagation(); handleStartMeeting(meeting.id); }}>
                      <PlayCircle className="h-3 w-3" /> Start
                    </Button>
                  )}
                  {meeting.status === 'in_progress' && (
                    <Button size="sm" variant="destructive" className="flex-1 text-xs gap-1" onClick={e => { e.stopPropagation(); handleCompleteMeeting(meeting.id); }}>
                      <StopCircle className="h-3 w-3" /> End
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Items Summary */}
        {allActionItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> All Action Items Across Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allActionItems.map(ai => (
                  <div key={ai.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{ai.task}</p>
                      <p className="text-xs text-muted-foreground">{ai.meeting} • {ai.agenda} • → {ai.assignedTo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ai.status === 'completed' ? 'default' : ai.status === 'overdue' ? 'destructive' : 'outline'} className="text-[10px]">{ai.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{ai.deadline.toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meeting Detail Dialog */}
        <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedMeeting?.title}</DialogTitle>
              <DialogDescription>
                {selectedMeeting && meetingTypeLabels[selectedMeeting.meetingType]} • {selectedMeeting?.date.toLocaleDateString('en-IN')} at {selectedMeeting?.time}
                <Badge className={`ml-2 text-[10px] ${statusColors[selectedMeeting?.status || 'upcoming']}`}>{selectedMeeting?.status?.replace('_', ' ')}</Badge>
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="agenda">
              <TabsList className="w-full">
                <TabsTrigger value="agenda" className="flex-1">Agenda</TabsTrigger>
                <TabsTrigger value="attendees" className="flex-1">Attendees</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">Action Items</TabsTrigger>
              </TabsList>

              <TabsContent value="agenda" className="space-y-3 mt-3">
                {selectedMeeting?.agendaItems.map((item, idx) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge variant={item.status === 'discussed' ? 'default' : item.status === 'deferred' ? 'destructive' : 'outline'} className="text-[10px]">{item.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Presenter: {item.presenter} • Duration: {item.duration}</p>
                      </div>
                      <div className="flex gap-1">
                        {item.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectedMeeting && handleMarkDiscussed(selectedMeeting.id, item.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Discussed
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-amber-600" onClick={() => selectedMeeting && handleDeferAgenda(selectedMeeting.id, item.id)}>
                              <ArrowRightLeft className="h-3 w-3 mr-1" /> Defer
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setSelectedAgendaId(item.id); setShowActionDialog(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Action
                        </Button>
                      </div>
                    </div>
                    {item.actionItems && item.actionItems.length > 0 && (
                      <div className="mt-2 pl-4 space-y-1">
                        {item.actionItems.map(ai => (
                          <div key={ai.id} className="flex items-center gap-2 text-xs">
                            <Checkbox checked={ai.status === 'completed'} onCheckedChange={() => selectedMeeting && handleToggleActionStatus(selectedMeeting.id, item.id, ai.id)} />
                            <span className={ai.status === 'completed' ? 'line-through text-muted-foreground' : ''}>{ai.task}</span>
                            <span className="text-muted-foreground">→ {ai.assignedTo}</span>
                            <span className="text-muted-foreground">by {ai.deadline.toLocaleDateString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="attendees" className="mt-3">
                <div className="space-y-2">
                  {selectedMeeting?.attendees.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {a}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-3">
                <div className="space-y-2">
                  {selectedMeeting?.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc}
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => toast({ title: 'Opening', description: `${doc} opened in viewer.` })}>
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    </div>
                  ))}
                  {selectedMeeting?.documents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No documents attached.</p>}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="mt-3">
                <div className="space-y-2">
                  {selectedMeeting?.agendaItems.flatMap(a => (a.actionItems || []).map(ai => ({ ...ai, agenda: a.title }))).map(ai => (
                    <div key={ai.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{ai.task}</p>
                        <p className="text-xs text-muted-foreground">Re: {ai.agenda} • Assigned to: {ai.assignedTo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ai.status === 'completed' ? 'default' : ai.status === 'overdue' ? 'destructive' : 'outline'} className="text-[10px]">{ai.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{ai.deadline.toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                  {selectedMeeting?.agendaItems.every(a => !a.actionItems || a.actionItems.length === 0) && (
                    <p className="text-center text-muted-foreground py-4 text-sm">No action items recorded yet.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              {selectedMeeting?.status === 'upcoming' && (
                <Button onClick={() => { if (selectedMeeting) handleStartMeeting(selectedMeeting.id); setSelectedMeeting(null); }} className="gap-1">
                  <PlayCircle className="h-4 w-4" /> Start Meeting
                </Button>
              )}
              {selectedMeeting?.status === 'in_progress' && (
                <Button variant="destructive" onClick={() => { if (selectedMeeting) handleCompleteMeeting(selectedMeeting.id); }} className="gap-1">
                  <StopCircle className="h-4 w-4" /> End Meeting
                </Button>
              )}
              <Button variant="outline" onClick={() => toast({ title: 'Minutes Generated', description: 'Draft minutes of meeting have been generated and saved.' })} className="gap-1">
                <Download className="h-4 w-4" /> Generate Minutes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Action Item Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Action Item</DialogTitle>
              <DialogDescription>Assign a follow-up task from this agenda item</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Task Description</Label><Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g., Submit revised budget proposal" /></div>
              <div><Label>Assign To</Label><Input value={newAssignee} onChange={e => setNewAssignee(e.target.value)} placeholder="e.g., Dean of Engineering" /></div>
              <div><Label>Deadline</Label><Input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
              <Button onClick={handleAddActionItem}>Add Action Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Meeting Dialog */}
        <Dialog open={showCreateMeetingDialog} onOpenChange={setShowCreateMeetingDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
              <DialogDescription>Create a statutory body meeting</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Meeting Title</Label><Input value={newMeetingTitle} onChange={e => setNewMeetingTitle(e.target.value)} placeholder="e.g., 48th Board of Management Meeting" /></div>
              <div>
                <Label>Meeting Type</Label>
                <Select value={newMeetingType} onValueChange={setNewMeetingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="board_of_management">Board of Management</SelectItem>
                    <SelectItem value="academic_council">Academic Council</SelectItem>
                    <SelectItem value="finance_committee">Finance Committee</SelectItem>
                    <SelectItem value="executive_council">Executive Council</SelectItem>
                    <SelectItem value="senate">Senate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={newMeetingDate} onChange={e => setNewMeetingDate(e.target.value)} /></div>
              <div><Label>Time</Label><Input value={newMeetingTime} onChange={e => setNewMeetingTime(e.target.value)} placeholder="e.g., 10:00 AM" /></div>
              <div><Label>Venue</Label><Input value={newMeetingVenue} onChange={e => setNewMeetingVenue(e.target.value)} placeholder="e.g., Senate Hall" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateMeetingDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateMeeting}>Schedule Meeting</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
