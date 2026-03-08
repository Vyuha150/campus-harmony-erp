import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Award, CheckCircle, Clock, AlertTriangle, FileText,
  Upload, Send, Eye, Calendar, Building2
} from 'lucide-react';
import { accreditationChecklist as initialChecklist } from '@/data/registrarMockData';
import { AccreditationChecklist } from '@/types/registrar';

const statusColors: Record<string, string> = {
  not_started: 'bg-red-50 text-red-700',
  in_progress: 'bg-amber-50 text-amber-700',
  submitted: 'bg-blue-50 text-blue-700',
  verified: 'bg-emerald-50 text-emerald-700',
};

const frameworkColors: Record<string, string> = {
  NAAC: 'bg-blue-50 text-blue-700',
  NIRF: 'bg-purple-50 text-purple-700',
  UGC: 'bg-green-50 text-green-700',
  NBA: 'bg-orange-50 text-orange-700',
};

export default function RegistrarAccreditation() {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [selectedItem, setSelectedItem] = useState<AccreditationChecklist | null>(null);
  const [remarks, setRemarks] = useState('');

  const handleVerify = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, status: 'verified' as const } : c));
    toast({ title: 'Verified', description: 'Criterion data verified by Registrar.' });
    setSelectedItem(null);
  };

  const handleSendReminder = (office: string) => {
    toast({ title: 'Reminder Sent', description: `Reminder sent to ${office} for pending data submission.` });
  };

  const naacItems = checklist.filter(c => c.framework === 'NAAC');
  const nirfItems = checklist.filter(c => c.framework === 'NIRF');
  const naacComplete = naacItems.filter(c => ['submitted', 'verified'].includes(c.status)).length;
  const nirfComplete = nirfItems.filter(c => ['submitted', 'verified'].includes(c.status)).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accreditation Coordination</h1>
          <p className="text-muted-foreground">Track NAAC, NIRF, UGC data submission progress and ensure completeness</p>
        </div>

        {/* Progress Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-blue-50 text-blue-700">NAAC</Badge>
                <span className="text-sm font-bold">{naacComplete}/{naacItems.length}</span>
              </div>
              <Progress value={(naacComplete / naacItems.length) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Peer team visit in 28 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-purple-50 text-purple-700">NIRF</Badge>
                <span className="text-sm font-bold">{nirfComplete}/{nirfItems.length}</span>
              </div>
              <Progress value={(nirfComplete / Math.max(nirfItems.length, 1)) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Submission deadline: Mar 15</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-green-50 text-green-700">UGC</Badge>
                <span className="text-sm font-bold">{checklist.filter(c => c.framework === 'UGC' && ['submitted', 'verified'].includes(c.status)).length}/{checklist.filter(c => c.framework === 'UGC').length}</span>
              </div>
              <Progress value={50} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">AQAR deadline: Jun 30</p>
            </CardContent>
          </Card>
        </div>

        {/* Checklist */}
        <Tabs defaultValue="NAAC">
          <TabsList>
            <TabsTrigger value="NAAC">NAAC</TabsTrigger>
            <TabsTrigger value="NIRF">NIRF</TabsTrigger>
            <TabsTrigger value="UGC">UGC</TabsTrigger>
          </TabsList>

          {['NAAC', 'NIRF', 'UGC'].map(framework => (
            <TabsContent key={framework} value={framework} className="space-y-3 mt-4">
              {checklist.filter(c => c.framework === framework).map(item => (
                <Card key={item.id} className={`${item.status === 'not_started' ? 'border-red-200' : item.status === 'in_progress' ? 'border-amber-200' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusColors[item.status]}`}>
                        {item.status === 'verified' ? <CheckCircle className="h-5 w-5" /> :
                         item.status === 'not_started' ? <AlertTriangle className="h-5 w-5" /> :
                         <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{item.criterion}</p>
                          <Badge className={`text-[10px] ${statusColors[item.status]}`}>{item.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {item.responsibleOffice}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Deadline: {item.deadline.toLocaleDateString('en-IN')}</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {item.documents.length} docs</span>
                        </div>
                        {item.remarks && <p className="text-xs text-muted-foreground mt-1 italic">Note: {item.remarks}</p>}
                        {item.documents.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.documents.map(d => (
                              <Badge key={d} variant="outline" className="text-[10px] gap-1"><FileText className="h-3 w-3" /> {d}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {item.status === 'submitted' && (
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleVerify(item.id)}>
                            <CheckCircle className="h-3 w-3" /> Verify
                          </Button>
                        )}
                        {['not_started', 'in_progress'].includes(item.status) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSendReminder(item.responsibleOffice)}>
                            <Send className="h-3 w-3" /> Remind
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSelectedItem(item)}>
                          <Eye className="h-3 w-3" /> Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>

        {/* Detail Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedItem?.criterion}</DialogTitle>
              <DialogDescription>{selectedItem?.framework} • {selectedItem?.responsibleOffice}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedItem?.description}</p>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Deadline: {selectedItem?.deadline.toLocaleDateString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">Status: {selectedItem?.status.replace(/_/g, ' ')}</p>
                {selectedItem?.remarks && <p className="text-xs text-muted-foreground mt-1">Remarks: {selectedItem.remarks}</p>}
              </div>
              {selectedItem?.documents.length === 0 && (
                <div className="rounded-lg border-2 border-dashed p-4 text-center text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto mb-1" />
                  <p className="text-xs">No documents uploaded yet</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>Close</Button>
              {selectedItem?.status === 'submitted' && (
                <Button onClick={() => selectedItem && handleVerify(selectedItem.id)}>Verify & Approve</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
