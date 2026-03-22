import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Award, Search, CheckCircle, Printer, Send, Package,
  Eye, Download, Shield, FileText, GraduationCap
} from 'lucide-react';
import { fetchApi, putApi } from '@/lib/apiService';
import { DegreeRecord } from '@/types/registrar';

const statusColors: Record<string, string> = {
  eligible: 'bg-blue-50 text-blue-700',
  generated: 'bg-amber-50 text-amber-700',
  printed: 'bg-purple-50 text-purple-700',
  dispatched: 'bg-emerald-50 text-emerald-700',
  collected: 'bg-emerald-50 text-emerald-700',
};

const statusSteps = ['eligible', 'generated', 'printed', 'dispatched', 'collected'];

export default function RegistrarCertificates() {
  const [degreeRecords, setDegreeRecords] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/registrar/certificates').then(d => setDegreeRecords(d)).catch((error) => { console.error('API request failed', error); });
    setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [degrees, setDegrees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDegree, setSelectedDegree] = useState<DegreeRecord | null>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<DegreeRecord | null | 'not_found'>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setDegrees(degreeRecords || []);
  }, [degreeRecords]);

  const filtered = degrees.filter(d =>
    d.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.rollNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.certificateNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdvanceStatus = async (id: string) => {
    try {
      setIsUpdating(true);
      const deg = degrees.find(d => d.id === id);
      const idx = statusSteps.indexOf(deg?.status || 'eligible');
      if (idx >= 0 && idx < statusSteps.length - 1) {
        const newStatus = statusSteps[idx + 1];
        await putApi(`/registrar/certificates/${id}`, {
          status: newStatus,
          ...(newStatus === 'collected' ? { collectedAt: new Date() } : {})
        });
        setDegrees(prev => prev.map(d => {
          if (d.id !== id) return d;
          return { ...d, status: newStatus as DegreeRecord['status'], ...(newStatus === 'collected' ? { collectedAt: new Date() } : {}) };
        }));
        toast({ title: 'Status Updated', description: 'Certificate status advanced.' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerify = () => {
    const found = degrees.find(d =>
      d.certificateNo.toLowerCase() === verifyInput.toLowerCase() ||
      d.rollNo.toLowerCase() === verifyInput.toLowerCase()
    );
    setVerifyResult(found || 'not_found');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Degree & Certificates</h1>
          <p className="text-muted-foreground">Convocation management, certificate issuance, and verification</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          {statusSteps.map(step => (
            <Card key={step}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{degrees.filter(d => d.status === step).length}</p>
                <p className="text-xs text-muted-foreground capitalize">{step}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="certificates">
          <TabsList>
            <TabsTrigger value="certificates">Certificate Register</TabsTrigger>
            <TabsTrigger value="verify">Verify Certificate</TabsTrigger>
            <TabsTrigger value="convocation">Convocation</TabsTrigger>
          </TabsList>

          <TabsContent value="certificates" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, roll no, or certificate no..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Certificate No</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Program</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Year</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Verifications</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => (
                        <tr key={d.id} className="border-b hover:bg-muted/20">
                          <td className="py-3 px-4 font-mono text-xs">{d.certificateNo}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium">{d.studentName}</p>
                            <p className="text-xs text-muted-foreground">{d.rollNo}</p>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{d.program}</td>
                          <td className="py-3 px-4 text-center">{d.graduationYear}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`text-[10px] ${statusColors[d.status]}`}>{d.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">{d.verificationCount}</td>
                          <td className="py-3 px-4 text-center">
                            {d.status !== 'collected' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAdvanceStatus(d.id)} disabled={isUpdating}>
                                {isUpdating ? 'Updating...' : d.status === 'eligible' ? 'Generate' : d.status === 'generated' ? 'Print' : d.status === 'printed' ? 'Dispatch' : 'Mark Collected'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Certificate Verification</CardTitle>
                <CardDescription>Verify authenticity of a degree certificate by certificate number or roll number</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <Input placeholder="Enter Certificate No or Roll No..." value={verifyInput} onChange={e => setVerifyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerify()} />
                  <Button onClick={handleVerify} className="gap-2"><Search className="h-4 w-4" /> Verify</Button>
                </div>

                {verifyResult === 'not_found' && (
                  <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
                    <p className="text-destructive font-medium">❌ No matching certificate found</p>
                    <p className="text-sm text-muted-foreground mt-1">The certificate number or roll number does not match any record.</p>
                  </div>
                )}

                {verifyResult && verifyResult !== 'not_found' && (
                  <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600" />
                      <p className="text-emerald-700 font-bold text-lg">✓ Certificate Verified</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> <strong>{verifyResult.studentName}</strong></div>
                      <div><span className="text-muted-foreground">Roll No:</span> <strong>{verifyResult.rollNo}</strong></div>
                      <div><span className="text-muted-foreground">Program:</span> <strong>{verifyResult.program}</strong></div>
                      <div><span className="text-muted-foreground">Year:</span> <strong>{verifyResult.graduationYear}</strong></div>
                      <div><span className="text-muted-foreground">Certificate:</span> <strong>{verifyResult.certificateNo}</strong></div>
                      <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-[10px] ${statusColors[verifyResult.status]}`}>{verifyResult.status}</Badge></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="convocation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> 25th Annual Convocation</CardTitle>
                <CardDescription>Scheduled: April 15, 2026 • Venue: University Auditorium</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  {[
                    { label: 'Total Graduands', value: degrees.length },
                    { label: 'Certificates Ready', value: degrees.filter(d => ['printed', 'dispatched', 'collected'].includes(d.status)).length },
                    { label: 'Pending Generation', value: degrees.filter(d => d.status === 'eligible').length },
                    { label: 'Already Collected', value: degrees.filter(d => d.status === 'collected').length },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg border p-4 text-center">
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button className="gap-2" onClick={() => toast({ title: 'Bulk Generation', description: `${degrees.filter(d => d.status === 'eligible').length} certificates queued for generation.` })}>
                    <Award className="h-4 w-4" /> Generate All Pending
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Exported', description: 'Graduand list exported as Excel.' })}>
                    <Download className="h-4 w-4" /> Export List
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Print Queue', description: 'All generated certificates sent to print queue.' })}>
                    <Printer className="h-4 w-4" /> Print Ready Certificates
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
