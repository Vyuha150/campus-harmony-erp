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
  Search, CheckCircle, Clock, Eye, Send,
  Building2, FileText, Mail, Phone, MessageSquare,
  Scale, AlertTriangle, Users
} from 'lucide-react';
import { verificationRequests as initialRequests } from '@/data/registrarMockData';
import { VerificationRequest } from '@/types/registrar';

const typeLabels: Record<string, string> = {
  employer: 'Employer Verification',
  rti: 'RTI Query',
  court: 'Court Order',
  internal: 'Internal Request',
  transcript: 'Transcript Request',
};

const typeIcons: Record<string, React.ElementType> = {
  employer: Building2,
  rti: Scale,
  court: Scale,
  internal: Users,
  transcript: FileText,
};

const typeColors: Record<string, string> = {
  employer: 'bg-blue-50 text-blue-700',
  rti: 'bg-amber-50 text-amber-700',
  court: 'bg-red-50 text-red-700',
  internal: 'bg-purple-50 text-purple-700',
  transcript: 'bg-emerald-50 text-emerald-700',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  responded: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
};

export default function RegistrarQueries() {
  const { toast } = useToast();
  const [requests, setRequests] = useState(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [response, setResponse] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const filtered = requests.filter(r => {
    if (filterTab === 'pending') return ['pending', 'processing'].includes(r.status);
    if (filterTab === 'responded') return r.status === 'responded';
    return true;
  });

  const handleRespond = () => {
    if (!selectedRequest || !response) return;
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: 'responded' as const, respondedAt: new Date(), response } : r));
    toast({ title: 'Response Sent', description: `Verification response sent to ${selectedRequest.requesterOrg}.` });
    setSelectedRequest(null);
    setResponse('');
  };

  const handleStartProcessing = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'processing' as const } : r));
    toast({ title: 'Processing Started', description: 'Request marked as being processed.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Query & Verification</h1>
          <p className="text-muted-foreground">Handle employer verifications, RTI queries, transcript requests, and external inquiries</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Requests', value: requests.length, icon: MessageSquare },
            { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: Clock },
            { label: 'Processing', value: requests.filter(r => r.status === 'processing').length, icon: AlertTriangle },
            { label: 'Responded', value: requests.filter(r => r.status === 'responded').length, icon: CheckCircle },
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

        {/* Request Type Breakdown */}
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(typeLabels).map(([key, label]) => (
            <Card key={key}>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">{requests.filter(r => r.type === key).length}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending & Processing</TabsTrigger>
            <TabsTrigger value="responded">Responded</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Requests List */}
        <div className="space-y-3">
          {filtered.map(req => {
            const TypeIcon = typeIcons[req.type] || MessageSquare;
            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[req.type]}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{typeLabels[req.type]}</p>
                        <Badge className={`text-[10px] ${statusColors[req.status]}`}>{req.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{req.details}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {req.requesterOrg}</span>
                        <span>•</span>
                        <span>{req.requesterName}</span>
                        {req.studentName !== 'N/A' && (
                          <>
                            <span>•</span>
                            <span>Student: {req.studentName} ({req.studentId})</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{req.receivedAt.toLocaleDateString('en-IN')}</span>
                      </div>
                      {req.response && (
                        <div className="rounded-lg bg-emerald-50 p-2 mt-2">
                          <p className="text-xs text-emerald-700"><strong>Response:</strong> {req.response}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Responded: {req.respondedAt?.toLocaleDateString('en-IN')}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {req.status === 'pending' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleStartProcessing(req.id)}>
                          <Clock className="h-3 w-3" /> Process
                        </Button>
                      )}
                      {['pending', 'processing'].includes(req.status) && (
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setSelectedRequest(req)}>
                          <Send className="h-3 w-3" /> Respond
                        </Button>
                      )}
                      {req.status === 'responded' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSelectedRequest(req)}>
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Respond Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => { setSelectedRequest(null); setResponse(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedRequest ? typeLabels[selectedRequest.type] : ''}</DialogTitle>
              <DialogDescription>From: {selectedRequest?.requesterName} ({selectedRequest?.requesterOrg})</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">{selectedRequest?.details}</p>
              </div>
              {selectedRequest?.studentName !== 'N/A' && (
                <div className="rounded-lg border p-3 text-sm">
                  <p><strong>Student:</strong> {selectedRequest?.studentName}</p>
                  <p><strong>ID:</strong> {selectedRequest?.studentId}</p>
                </div>
              )}
              {selectedRequest?.response ? (
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-700">{selectedRequest.response}</p>
                </div>
              ) : (
                <Textarea placeholder="Type your verification response..." value={response} onChange={e => setResponse(e.target.value)} rows={4} />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedRequest(null); setResponse(''); }}>Close</Button>
              {!selectedRequest?.response && (
                <Button onClick={handleRespond} disabled={!response} className="gap-1">
                  <Send className="h-4 w-4" /> Send Response
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
