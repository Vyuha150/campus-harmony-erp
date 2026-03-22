import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, FileText, Users, Download, Plus, MapPin, CheckCircle2, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';
import { createIQACMeeting, fetchAQARReports, fetchIQACCriteriaProgress, fetchIQACMeetings, generateAQAR, updateAQAR, updateIQACMeeting } from '@/lib/iqacApi';
import { useToast } from '@/hooks/use-toast';

export default function IQACReports() {
  const { toast } = useToast();
  const [iqacMeetings, setIqacMeetings] = useState<any>([]);
  const [aqarSections, setAqarSections] = useState<any>([]);
  const [reportMetrics, setReportMetrics] = useState<any>([]);
  const [activeAqar, setActiveAqar] = useState<any>(null);
  const [qualitativeNotes, setQualitativeNotes] = useState('');

  const loadData = async () => {
    try {
      const [meetings, reports, criteriaProgress, dashboard] = await Promise.all([
        fetchIQACMeetings(),
        fetchAQARReports(),
        fetchIQACCriteriaProgress(),
        fetchApi<any>('/iqac/dashboard')
      ]);

      setIqacMeetings(meetings);
      setAqarSections(criteriaProgress.map((item) => ({
        section: item.title,
        progress: item.dataProgress,
        status: item.status
      })));

      const latestReport = Array.isArray(reports) && reports.length > 0 ? reports[0] : null;
      setActiveAqar(latestReport);
      if (latestReport?.bestPractices) {
        const notes = Array.isArray(latestReport.bestPractices)
          ? latestReport.bestPractices.join('\n')
          : '';
        setQualitativeNotes(notes);
      }

      setReportMetrics(Array.isArray(dashboard?.stats)
        ? dashboard.stats.map((stat: any) => ({ label: stat.label, value: stat.value }))
        : []);
    } catch (error: any) {
      toast({ title: 'Unable to load reports', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const overallAQAR = aqarSections.length > 0
    ? Math.round(aqarSections.reduce((a, b) => a + b.progress, 0) / aqarSections.length)
    : 0;

  const handleScheduleMeeting = async () => {
    const title = window.prompt('Meeting title', 'IQAC Review Meeting');
    if (!title) return;
    const date = window.prompt('Meeting date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
    if (!date) return;
    const venue = window.prompt('Venue', 'Board Room');
    if (!venue) return;

    try {
      await createIQACMeeting({
        title,
        date: new Date(date).toISOString(),
        venue,
        agenda: ['AQAR progress review']
      });
      toast({ title: 'Meeting scheduled', description: 'IQAC meeting has been created.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Schedule failed', description: error?.message || 'Unable to schedule meeting.', variant: 'destructive' });
    }
  };

  const handleGenerateAQAR = async () => {
    try {
      const now = new Date();
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const academicYear = `${year}-${String(year + 1).slice(-2)}`;
      await generateAQAR(academicYear);
      toast({ title: 'AQAR generated', description: `Draft created for ${academicYear}.` });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate AQAR.', variant: 'destructive' });
    }
  };

  const handleSaveDraft = async () => {
    if (!activeAqar?.id) return;
    try {
      await updateAQAR(activeAqar.id, {
        status: 'draft',
        bestPractices: qualitativeNotes.split('\n').map((line) => line.trim()).filter(Boolean)
      });
      toast({ title: 'Draft saved', description: 'AQAR notes were saved as draft.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save draft.', variant: 'destructive' });
    }
  };

  const handleSubmitForReview = async () => {
    if (!activeAqar?.id) return;
    try {
      await updateAQAR(activeAqar.id, {
        status: 'under_review',
        submissionDate: new Date().toISOString(),
        bestPractices: qualitativeNotes.split('\n').map((line) => line.trim()).filter(Boolean)
      });
      toast({ title: 'Submitted for review', description: 'AQAR has been submitted for review.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error?.message || 'Unable to submit AQAR.', variant: 'destructive' });
    }
  };

  const handleEditSection = async (section: any) => {
    if (!activeAqar?.id) return;
    try {
      const existing = activeAqar.criteria && typeof activeAqar.criteria === 'object' ? activeAqar.criteria : {};
      await updateAQAR(activeAqar.id, {
        criteria: {
          ...existing,
          [section.section]: {
            progress: section.progress,
            status: section.status,
            updatedAt: new Date().toISOString()
          }
        }
      });
      toast({ title: 'Section updated', description: `${section.section} was synced into AQAR criteria.` });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update section.', variant: 'destructive' });
    }
  };

  const handleEditAgenda = async (meeting: any) => {
    const value = window.prompt('Edit agenda (comma separated)', Array.isArray(meeting.agenda) ? meeting.agenda.join(', ') : '');
    if (value === null) return;
    const agenda = value.split(',').map((item) => item.trim()).filter(Boolean);
    try {
      await updateIQACMeeting(meeting.id, { agenda });
      toast({ title: 'Agenda updated', description: 'Meeting agenda has been updated.' });
      await loadData();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update agenda.', variant: 'destructive' });
    }
  };

  const handleSendInvites = async (meeting: any) => {
    try {
      await updateIQACMeeting(meeting.id, { status: 'scheduled' });
      toast({ title: 'Invites sent', description: 'Meeting invite status has been recorded.' });
    } catch (error: any) {
      toast({ title: 'Invite failed', description: error?.message || 'Unable to send invites.', variant: 'destructive' });
    }
  };

  const handleViewMinutes = async (meeting: any) => {
    try {
      if (!meeting.minutes) {
        await updateIQACMeeting(meeting.id, {
          minutes: `Minutes generated on ${new Date().toLocaleString('en-IN')}`
        });
        await loadData();
      }
      toast({ title: 'Minutes ready', description: 'Meeting minutes are available for review.' });
    } catch (error: any) {
      toast({ title: 'Minutes failed', description: error?.message || 'Unable to load minutes.', variant: 'destructive' });
    }
  };

  const handleDownloadMeeting = (meeting: any) => {
    const lines = [
      `Title: ${meeting.title}`,
      `Date: ${new Date(meeting.date).toLocaleString('en-IN')}`,
      `Venue: ${meeting.venue}`,
      `Status: ${meeting.status}`,
      '',
      'Agenda:',
      ...(Array.isArray(meeting.agenda) ? meeting.agenda : []).map((item: string, index: number) => `${index + 1}. ${item}`),
      '',
      'Minutes:',
      meeting.minutes || 'Not yet available'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/\s+/g, '-').toLowerCase()}-minutes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AQAR & Reports</h1>
            <p className="text-muted-foreground">Meeting management and Annual Quality Assurance Report generation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleScheduleMeeting}><Plus className="mr-2 h-4 w-4" />Schedule Meeting</Button>
            <Button size="sm" onClick={handleGenerateAQAR}><Download className="mr-2 h-4 w-4" />Generate AQAR</Button>
          </div>
        </div>

        <Tabs defaultValue="aqar">
          <TabsList>
            <TabsTrigger value="aqar">AQAR Generation</TabsTrigger>
            <TabsTrigger value="meetings">IQAC Meetings</TabsTrigger>
          </TabsList>

          <TabsContent value="aqar" className="space-y-4">
            {/* AQAR Progress */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">AQAR 2025-26 – Section-wise Progress</CardTitle>
                  <Badge variant="outline" className="text-sm">Overall: {overallAQAR}%</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aqarSections.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-foreground">{s.section}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${s.progress >= 90 ? 'bg-green-500' : s.progress >= 70 ? 'bg-amber-500' : 'bg-destructive'}`}
                                style={{ width: `${s.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{s.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={s.status === 'completed' ? 'default' : s.status === 'needs_attention' ? 'destructive' : s.status === 'not_started' ? 'outline' : 'secondary'}
                            className="capitalize"
                          >
                            {s.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSection(s)}>Edit Section</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Qualitative Input */}
            <Card>
              <CardHeader><CardTitle className="text-base">Qualitative Commentary (IQAC Coordinator)</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add qualitative remarks for the AQAR report – institutional achievements, innovations, distinctive features..."
                  value={qualitativeNotes}
                  onChange={(e) => setQualitativeNotes(e.target.value)}
                  className="min-h-[120px] mb-3"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveDraft}>Save Draft</Button>
                  <Button size="sm" onClick={handleSubmitForReview}><Send className="mr-2 h-4 w-4" />Submit for Review</Button>
                </div>
              </CardContent>
            </Card>

            {/* System Computed Metrics */}
            <Card>
              <CardHeader><CardTitle className="text-base">Auto-Computed Metrics from ERP Data</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {reportMetrics.map((metric: any) => (
                    <div key={metric.label} className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{metric.value}</p>
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4">
            {iqacMeetings.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{m.title}</h3>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{m.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{m.venue}</span>
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" />{m.attendees.length} members</span>
                      </div>
                    </div>
                    <Badge variant={m.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{m.status}</Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">📋 Agenda</h4>
                      {m.agenda.map((a, i) => (
                        <p key={i} className="text-sm text-muted-foreground">{i + 1}. {a}</p>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">👥 Attendees</h4>
                      {m.attendees.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm mb-1">
                          <CheckCircle2 className={`h-3.5 w-3.5 ${a.attended ? 'text-green-600' : 'text-muted-foreground'}`} />
                          <span className="text-foreground">{a.name}</span>
                          <span className="text-muted-foreground">– {a.designation}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {m.decisions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">✅ Decisions</h4>
                      {m.decisions.map((d, i) => <p key={i} className="text-sm text-muted-foreground">• {d}</p>)}
                    </div>
                  )}
                  {m.actionItems.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-foreground mb-2">📌 Action Items</h4>
                      {m.actionItems.map((a, i) => <p key={i} className="text-sm text-muted-foreground">• {a}</p>)}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {m.status === 'completed' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleViewMinutes(m)}><FileText className="mr-1 h-4 w-4" />View Minutes</Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadMeeting(m)}><Download className="mr-1 h-4 w-4" />Download</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEditAgenda(m)}>Edit Agenda</Button>
                        <Button size="sm" onClick={() => handleSendInvites(m)}><Send className="mr-1 h-4 w-4" />Send Invites</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
