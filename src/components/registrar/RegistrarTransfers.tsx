import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeftRight, ArrowRight, ArrowLeft, CheckCircle, XCircle,
  FileText, Clock, Building2, GraduationCap, Send
} from 'lucide-react';
import { transferRequests as initialTransfers } from '@/data/registrarMockData';
import { TransferRequest } from '@/types/registrar';

const statusSteps = ['pending', 'noc_issued', 'migration_issued', 'completed'];

export default function RegistrarTransfers() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState(initialTransfers);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [remarks, setRemarks] = useState('');

  const handleAdvanceStatus = (id: string) => {
    setTransfers(prev => prev.map(t => {
      if (t.id !== id) return t;
      const idx = statusSteps.indexOf(t.status);
      if (idx < statusSteps.length - 1) {
        const next = statusSteps[idx + 1] as TransferRequest['status'];
        return { ...t, status: next };
      }
      return t;
    }));
    toast({ title: 'Status Updated', description: 'Transfer request advanced to next stage.' });
    setSelectedTransfer(null);
  };

  const handleReject = (id: string) => {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'rejected' as const } : t));
    toast({ title: 'Rejected', description: 'Transfer request has been rejected.' });
    setSelectedTransfer(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transfers & Migration</h1>
          <p className="text-muted-foreground">Process student transfers, migration certificates, and NOCs</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Incoming Transfers', value: transfers.filter(t => t.type === 'incoming').length, icon: ArrowLeft, color: 'text-emerald-600' },
            { label: 'Outgoing Transfers', value: transfers.filter(t => t.type === 'outgoing').length, icon: ArrowRight, color: 'text-amber-600' },
            { label: 'Pending Action', value: transfers.filter(t => !['completed', 'rejected'].includes(t.status)).length, icon: Clock, color: 'text-primary' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="incoming">Incoming</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
          </TabsList>

          {['all', 'incoming', 'outgoing'].map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
              {transfers.filter(t => tab === 'all' || t.type === tab).map(transfer => (
                <Card key={transfer.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${transfer.type === 'incoming' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        {transfer.type === 'incoming' ? <ArrowLeft className="h-5 w-5 text-emerald-700" /> : <ArrowRight className="h-5 w-5 text-amber-700" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{transfer.studentName}</p>
                          <Badge variant={transfer.type === 'incoming' ? 'default' : 'secondary'} className="text-[10px]">{transfer.type}</Badge>
                          <Badge variant={transfer.status === 'completed' ? 'default' : transfer.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">{transfer.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{transfer.program}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {transfer.fromInstitution}</span>
                          <ArrowLeftRight className="h-3 w-3 text-primary" />
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {transfer.toInstitution}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Reason: {transfer.reason}</p>
                        <div className="flex gap-1 mt-2">
                          {transfer.documents.map(d => (
                            <Badge key={d} variant="outline" className="text-[10px] gap-1"><FileText className="h-3 w-3" /> {d}</Badge>
                          ))}
                        </div>
                        {/* Progress Steps */}
                        {!['completed', 'rejected'].includes(transfer.status) && (
                          <div className="flex items-center gap-1 mt-3">
                            {statusSteps.map((step, i) => (
                              <div key={step} className="flex items-center gap-1">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${statusSteps.indexOf(transfer.status) >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                  {i + 1}
                                </div>
                                {i < statusSteps.length - 1 && <div className={`h-0.5 w-6 ${statusSteps.indexOf(transfer.status) > i ? 'bg-primary' : 'bg-muted'}`} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {!['completed', 'rejected'].includes(transfer.status) && (
                        <div className="flex flex-col gap-1">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleAdvanceStatus(transfer.id)}>
                            <Send className="h-3 w-3" /> {transfer.status === 'pending' ? 'Issue NOC' : transfer.status === 'noc_issued' ? 'Issue Migration' : 'Complete'}
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleReject(transfer.id)}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
