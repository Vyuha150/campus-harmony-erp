import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, AlertTriangle, FileText, BarChart3, Download, ClipboardList, Star, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createIQACFeedbackForm, fetchIQACActions, fetchIQACCriteriaProgress, fetchIQACDocuments, fetchIQACFeedbackSummaries, generateAQAR } from '@/lib/iqacApi';
import { useToast } from '@/hooks/use-toast';

export default function IQACDashboard() {
  const { toast } = useToast();
  const [criteriaProgress, setCriteriaProgress] = useState<any>([]);
  const [iqacActionItems, setIqacActionItems] = useState<any>([]);
  const [feedbackSummaries, setFeedbackSummaries] = useState<any>([]);
  const [qualityDocuments, setQualityDocuments] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setApiLoading(true);
      const [criteria, actions, feedback, documents] = await Promise.all([
        fetchIQACCriteriaProgress(),
        fetchIQACActions(),
        fetchIQACFeedbackSummaries(),
        fetchIQACDocuments()
      ]);
      setCriteriaProgress(criteria);
      setIqacActionItems(actions);
      setFeedbackSummaries(feedback);
      setQualityDocuments(documents);
    } catch (error: any) {
      toast({ title: 'Unable to load dashboard', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleGenerateAQAR = async () => {
    try {
      const now = new Date();
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const academicYear = `${year}-${String(year + 1).slice(-2)}`;
      await generateAQAR(academicYear);
      toast({ title: 'AQAR generated', description: `AQAR draft created for ${academicYear}.` });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate AQAR.', variant: 'destructive' });
    }
  };

  const handleSendReminder = async () => {
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      await createIQACFeedbackForm({
        title: `Quality Reminder Form - ${new Date().toLocaleDateString('en-IN')}`,
        deadline: deadline.toISOString(),
        status: 'open'
      });
      toast({ title: 'Reminder sent', description: 'A feedback reminder form has been created.' });
      await loadDashboardData();
    } catch (error: any) {
      toast({ title: 'Reminder failed', description: error?.message || 'Unable to send reminder.', variant: 'destructive' });
    }
  };

  const overallProgress = criteriaProgress.length > 0
    ? Math.round(criteriaProgress.reduce((a, b) => a + b.dataProgress, 0) / criteriaProgress.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">IQAC Quality Dashboard</h1>
            <p className="text-muted-foreground">Internal Quality Assurance – NAAC/NIRF Compliance Tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateAQAR}><Download className="mr-2 h-4 w-4" />Generate AQAR</Button>
            <Button size="sm" onClick={handleSendReminder}><Send className="mr-2 h-4 w-4" />Send Reminder</Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Award className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">NAAC Grade</p><p className="text-2xl font-bold">A+</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Data Progress</p><p className="text-2xl font-bold">{overallProgress}%</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Star className="h-8 w-8 text-amber-500" /><div><p className="text-xs text-muted-foreground">Feedback Score</p><p className="text-2xl font-bold">4.1/5</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Action Items</p><p className="text-2xl font-bold">{iqacActionItems.length}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-purple-600" /><div><p className="text-xs text-muted-foreground">Documents</p><p className="text-2xl font-bold">{qualityDocuments.length}</p></div></div></CardContent></Card>
        </div>

        {!apiLoading && criteriaProgress.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No IQAC dashboard data available.</CardContent></Card>
        )}

        <Tabs defaultValue="criteria">
          <TabsList>
            <TabsTrigger value="criteria">NAAC Criteria</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="feedback">Feedback Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="criteria" className="space-y-4">
            {criteriaProgress.map((c) => (
              <Card key={c.criteriaNumber}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{c.criteriaNumber}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">{c.title}</h3>
                          <p className="text-xs text-muted-foreground">Docs: {c.documentsUploaded}/{c.requiredDocuments} • Updated: {c.lastUpdated.toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={c.dataProgress} className="h-2 flex-1" />
                        <span className="text-sm font-medium text-foreground">{c.dataProgress}%</span>
                      </div>
                      {c.issues.length > 0 && (
                        <div className="mt-2">{c.issues.map((issue,i) => (
                          <p key={i} className="text-xs text-amber-600"><AlertTriangle className="mr-1 inline h-3 w-3" />{issue}</p>
                        ))}</div>
                      )}
                    </div>
                    <Badge variant={c.status === 'completed' ? 'default' : c.status === 'needs_attention' ? 'destructive' : 'secondary'} className="ml-4 capitalize">{c.status.replace('_',' ')}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="actions" className="space-y-3">
            {iqacActionItems.map((a) => (
              <Card key={a.id}><CardContent className="flex items-start justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    <span>Assigned: {a.assignedTo}</span>
                    <span>Due: {a.dueDate.toLocaleDateString('en-IN')}</span>
                    <span>Impact: {a.impact}</span>
                  </div>
                  {a.implementationStatus && <p className="mt-1 text-xs text-green-600">✓ {a.implementationStatus}</p>}
                </div>
                <Badge variant={a.status === 'completed' ? 'default' : a.status === 'overdue' ? 'destructive' : 'secondary'} className="capitalize">{a.status}</Badge>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="documents">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Document</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Criteria</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Uploaded By</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr></thead><tbody>
              {qualityDocuments.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{d.title}</p>{d.reviewComments && <p className="text-xs text-amber-600">⚠ {d.reviewComments}</p>}</td>
                  <td className="px-4 py-3 text-center text-sm text-foreground">{d.criteriaNumber}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{d.documentType}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.uploadedBy}</td>
                  <td className="px-4 py-3"><Badge variant={d.status === 'approved' ? 'default' : d.status === 'needs_revision' ? 'destructive' : 'secondary'} className="capitalize">{d.status.replace('_',' ')}</Badge></td>
                  <td className="px-4 py-3"><Button variant="ghost" size="sm">Review</Button></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="feedback">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {feedbackSummaries.map((f) => (
                <Card key={f.type}><CardContent className="p-5">
                  <h3 className="font-semibold capitalize text-foreground">{f.type} Feedback</h3>
                  <p className="text-3xl font-bold text-primary mt-2">{f.averageRating}/5</p>
                  <p className="text-sm text-muted-foreground">{f.respondents} respondents</p>
                  <Badge className="mt-2 capitalize">{f.satisfactionLevel.replace('_',' ')}</Badge>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground">Key Findings:</p>
                    {f.keyFindings.map((k,i) => <p key={i} className="text-xs text-foreground">• {k}</p>)}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}