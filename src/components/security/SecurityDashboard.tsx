import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, AlertTriangle, Users, Car, CreditCard, FileText, Search, Plus, Clock, Eye, Bell, MapPin, Siren, UserCheck, Scan } from 'lucide-react';
import { securityIncidents, idCardRequests, vehiclePasses, visitorPasses, supportTickets, auditLogs, vigilanceCases } from '@/data/securityMockData';

export default function SecurityDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security & Campus Safety</h1>
            <p className="text-muted-foreground">Incident management, access control, and campus safety monitoring</p>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm"><Siren className="mr-2 h-4 w-4" />Emergency Alert</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Log Incident</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-amber-500" /><div><p className="text-xs text-muted-foreground">Active Incidents</p><p className="text-2xl font-bold text-amber-600">3</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Visitors Today</p><p className="text-2xl font-bold">{visitorPasses.length + 12}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CreditCard className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">ID Requests</p><p className="text-2xl font-bold">{idCardRequests.length + 8}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Car className="h-8 w-8 text-purple-600" /><div><p className="text-xs text-muted-foreground">Vehicle Passes</p><p className="text-2xl font-bold">{vehiclePasses.length + 450}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Guards on Duty</p><p className="text-2xl font-bold">18</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="incidents">
          <TabsList>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="visitors">Visitor Passes</TabsTrigger>
            <TabsTrigger value="ids">ID Management</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicle Passes</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="vigilance">Vigilance</TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search incidents..." className="pl-10" /></div>
            {securityIncidents.map((si) => (
              <Card key={si.id} className={si.severity === 'critical' ? 'border-destructive' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{si.incidentNumber}</p><Badge variant="outline" className="capitalize">{si.type}</Badge></div>
                      <p className="text-sm text-muted-foreground">{si.description}</p>
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span><MapPin className="mr-1 inline h-3 w-3" />{si.location}</span>
                        <span><Clock className="mr-1 inline h-3 w-3" />{si.reportedDate.toLocaleDateString('en-IN')}</span>
                        <span>Reported by: {si.reportedBy}</span>
                        {si.investigatingOfficer && <span>Investigating: {si.investigatingOfficer}</span>}
                      </div>
                      <p className="mt-1 text-xs text-foreground"><strong>Action:</strong> {si.actionTaken}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={si.severity === 'critical' ? 'destructive' : si.severity === 'serious' ? 'default' : 'secondary'} className="capitalize">{si.severity}</Badge>
                      <Badge variant={si.status === 'resolved' ? 'default' : 'outline'} className="capitalize">{si.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="visitors">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Visitor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Organization</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Meeting</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date/Time</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {visitorPasses.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{v.visitorName}</p><p className="text-xs text-muted-foreground">{v.contactNumber}</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.organization || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.purposeOfVisit}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{v.personToMeet}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.expectedDate.toLocaleDateString('en-IN')} {v.expectedTime}</td>
                  <td className="px-4 py-3"><Badge variant={v.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{v.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="ids">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Request No.</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Request Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr></thead><tbody>
              {idCardRequests.map((id) => (
                <tr key={id.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{id.requestNumber}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{id.applicantName}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{id.applicantType}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{id.requestType}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{id.requestDate.toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge variant={id.status === 'issued' ? 'default' : id.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{id.status}</Badge></td>
                  <td className="px-4 py-3">{id.status === 'pending' && <Button size="sm">Approve</Button>}{id.status === 'approved' && <Button size="sm" variant="outline"><Scan className="mr-1 h-3 w-3" />Issue Card</Button>}</td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="vehicles">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Pass No.</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vehicle</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Zone</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Valid Till</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {vehiclePasses.map((vp) => (
                <tr key={vp.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{vp.passNumber}</td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{vp.ownerName}</p><Badge variant="outline" className="capitalize text-xs">{vp.ownerType}</Badge></td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{vp.vehicleNumber}</p><p className="text-xs text-muted-foreground">{vp.vehicleModel} ({vp.vehicleType.replace('_',' ')})</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{vp.parkingZone}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{vp.validUntil.toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><Badge variant={vp.status === 'active' ? 'default' : 'destructive'} className="capitalize">{vp.status}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Timestamp</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Module</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">IP Address</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.timestamp.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{log.userId}</p><p className="text-xs text-muted-foreground">{log.userRole}</p></td>
                  <td className="px-4 py-3 text-sm text-foreground">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.module}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.ipAddress}</td>
                  <td className="px-4 py-3"><Badge variant={log.success ? 'default' : 'destructive'}>{log.success ? 'Success' : 'Failed'}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="vigilance" className="space-y-4">
            {vigilanceCases.map((vc) => (
              <Card key={vc.id} className="border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{vc.caseNumber}</p><Badge variant="outline" className="capitalize">{vc.type.replace('_',' ')}</Badge><Badge variant="destructive">Confidential</Badge></div>
                      <p className="mt-1 text-sm text-foreground">{vc.subject}</p>
                      <p className="text-sm text-muted-foreground">{vc.description}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span>Reported: {vc.dateReported.toLocaleDateString('en-IN')}</span>
                        <span className="ml-4">Source: <span className="capitalize">{vc.complainantType.replace('_',' ')}</span></span>
                        <span className="ml-4">Officer: {vc.investigatingOfficer}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">{vc.status.replace('_',' ')}</Badge>
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