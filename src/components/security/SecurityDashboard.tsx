import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, AlertTriangle, Users, Car, CreditCard, FileText, Search, Plus, Clock, Eye, Bell, MapPin, Siren, UserCheck, Scan } from 'lucide-react';
import { useState, useEffect } from 'react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

type SecurityTab = 'incidents' | 'visitors' | 'ids' | 'vehicles' | 'guards' | 'audit' | 'vigilance';

function formatDate(value: unknown, withTime = false): string {
  if (!value) return '-';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '-';
  return withTime ? parsed.toLocaleString('en-IN') : parsed.toLocaleDateString('en-IN');
}

export default function SecurityDashboard({ initialTab = 'incidents' }: { initialTab?: SecurityTab }) {
  const [activeTab, setActiveTab] = useState<SecurityTab>(initialTab);
  const [idCardRequests, setIdCardRequests] = useState<any>([]);
  const [visitorPasses, setVisitorPasses] = useState<any>([]);
  const [securityIncidents, setSecurityIncidents] = useState<any>([]);
  const [patrolLogs, setPatrolLogs] = useState<any>([]);
  const [vehiclePasses, setVehiclePasses] = useState<any>([]);
  const [vigilanceCases, setVigilanceCases] = useState<any>([]);
  const [guards, setGuards] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [incidentSearch, setIncidentSearch] = useState('');
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false);
  const [isVisitorDialogOpen, setIsVisitorDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isVigilanceDialogOpen, setIsVigilanceDialogOpen] = useState(false);
  const [isIdDialogOpen, setIsIdDialogOpen] = useState(false);
  const [isGuardDialogOpen, setIsGuardDialogOpen] = useState(false);
  const [isDutyDialogOpen, setIsDutyDialogOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<any | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const [incidentForm, setIncidentForm] = useState({
    title: '',
    description: '',
    location: '',
    severity: 'medium',
    status: 'pending'
  });

  const [emergencyForm, setEmergencyForm] = useState({
    category: 'emergency',
    priority: 'critical',
    subject: '',
    description: '',
    contactInfo: ''
  });

  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    hostName: '',
    purpose: '',
    phone: '',
    idProofType: 'aadhaar',
    idProofNumber: ''
  });

  const [vehicleForm, setVehicleForm] = useState({
    ownerName: '',
    ownerType: 'student',
    ownerIdNumber: '',
    vehicleType: 'car',
    vehicleNumber: '',
    vehicleModel: '',
    parkingZone: 'A',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });

  const [vigilanceForm, setVigilanceForm] = useState({
    type: 'misconduct',
    subject: '',
    description: '',
    complainantType: 'anonymous',
    investigatingOfficer: ''
  });

  const [idForm, setIdForm] = useState({
    applicantId: '',
    applicantName: '',
    applicantType: 'student',
    requestType: 'new',
    reason: '',
    feesPaid: false,
  });

  const [guardForm, setGuardForm] = useState({
    name: '',
    email: '',
    designation: 'Security Guard',
    campus: '',
  });

  const [dutyForm, setDutyForm] = useState({
    shift: 'morning',
    patrolRoute: '',
    location: '',
    status: 'on_duty',
  });

  const loadSecurityData = () => {
    fetchApi('/security/id-cards').then(d => setIdCardRequests(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/visitors').then(d => setVisitorPasses(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/incidents').then(d => setSecurityIncidents(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/patrols').then(d => setPatrolLogs(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/vehicle-passes').then(d => setVehiclePasses(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/vigilance-cases').then(d => setVigilanceCases(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/security/guards').then(d => setGuards(d)).catch((error) => { console.error('API request failed', error); });
  };

  useEffect(() => {
    loadSecurityData();
    _setApiLoading(false);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const filteredIncidents = securityIncidents.filter((incident: any) => {
    const query = incidentSearch.trim().toLowerCase();
    if (!query) return true;
    const idText = String(incident.id || '').toLowerCase();
    const titleText = String(incident.title || '').toLowerCase();
    const locationText = String(incident.location || '').toLowerCase();
    const descriptionText = String(incident.description || '').toLowerCase();
    return idText.includes(query) || titleText.includes(query) || locationText.includes(query) || descriptionText.includes(query);
  });

  const handleCreateIncident = async () => {
    if (!incidentForm.title.trim() || !incidentForm.description.trim() || !incidentForm.location.trim()) {
      toast({ title: 'Missing details', description: 'Title, description, and location are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('incident');
      const created = await postApi('/security/incidents', {
        title: incidentForm.title.trim(),
        description: incidentForm.description.trim(),
        location: incidentForm.location.trim(),
        severity: incidentForm.severity,
        status: incidentForm.status
      });
      setSecurityIncidents((prev: any[]) => [created, ...prev]);
      setIncidentForm({ title: '', description: '', location: '', severity: 'medium', status: 'pending' });
      setIsIncidentDialogOpen(false);
      toast({ title: 'Incident logged', description: 'Security incident created successfully.' });
    } catch (error: any) {
      toast({ title: 'Failed to log incident', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleEmergencyAlert = async () => {
    if (!emergencyForm.subject.trim() || !emergencyForm.description.trim()) {
      toast({ title: 'Missing details', description: 'Subject and description are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('emergency');
      const createdTicket = await postApi('/security/support-tickets', {
        reportedBy: 'security_officer',
        reporterType: 'security_officer',
        contactInfo: emergencyForm.contactInfo || 'N/A',
        category: emergencyForm.category,
        priority: emergencyForm.priority,
        subject: emergencyForm.subject.trim(),
        description: emergencyForm.description.trim(),
      });

      const createdIncident = await postApi('/security/incidents', {
        title: emergencyForm.subject.trim(),
        description: emergencyForm.description.trim(),
        location: 'Emergency Response',
        severity: 'critical',
        status: 'open'
      });

      setSecurityIncidents((prev: any[]) => [createdIncident, ...prev]);
      setIsEmergencyDialogOpen(false);
      setEmergencyForm({ category: 'emergency', priority: 'critical', subject: '', description: '', contactInfo: '' });
      toast({
        title: 'Emergency alert raised',
        description: `Created ticket ${String(createdTicket?.ticketNumber || '').trim() || 'successfully'} and logged critical incident.`
      });
    } catch (error: any) {
      toast({ title: 'Failed to raise alert', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const updateIdCardStatus = async (requestId: string, status: 'approved' | 'issued') => {
    try {
      setSubmittingAction(`id-${requestId}`);
      const updated = await putApi(`/security/id-cards/${requestId}`, { status });
      setIdCardRequests((prev: any[]) => prev.map((item) => item.id === requestId ? updated : item));
      toast({ title: status === 'approved' ? 'Request approved' : 'Card issued', description: `ID request updated to ${status}.` });
    } catch (error: any) {
      toast({ title: 'Action failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const createIdCardRequest = async () => {
    if (!idForm.applicantId.trim() || !idForm.applicantName.trim()) {
      toast({ title: 'Missing details', description: 'Applicant ID and applicant name are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('id-create');
      const created = await postApi('/security/id-cards', {
        applicantId: idForm.applicantId.trim(),
        applicantName: idForm.applicantName.trim(),
        applicantType: idForm.applicantType,
        requestType: idForm.requestType,
        reason: idForm.reason.trim() || null,
        feesPaid: idForm.feesPaid,
      });

      setIdCardRequests((prev: any[]) => [created, ...prev]);
      setIdForm({
        applicantId: '',
        applicantName: '',
        applicantType: 'student',
        requestType: 'new',
        reason: '',
        feesPaid: false,
      });
      setIsIdDialogOpen(false);
      toast({ title: 'ID request created', description: 'New ID card request created successfully.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteIdCardRequest = async (requestId: string) => {
    try {
      setSubmittingAction(`id-delete-${requestId}`);
      await deleteApi(`/security/id-cards/${requestId}`);
      setIdCardRequests((prev: any[]) => prev.filter((item) => item.id !== requestId));
      toast({ title: 'Request deleted', description: 'ID card request removed.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const updateIncidentStatus = async (incidentId: string, status: string) => {
    try {
      setSubmittingAction(`incident-${incidentId}`);
      const updated = await putApi(`/security/incidents/${incidentId}`, { status });
      setSecurityIncidents((prev: any[]) => prev.map((item) => item.id === incidentId ? updated : item));
      toast({ title: 'Incident updated', description: `Incident marked as ${status}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteIncident = async (incidentId: string) => {
    try {
      setSubmittingAction(`incident-delete-${incidentId}`);
      await deleteApi(`/security/incidents/${incidentId}`);
      setSecurityIncidents((prev: any[]) => prev.filter((item) => item.id !== incidentId));
      toast({ title: 'Incident deleted', description: 'Incident removed from records.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const createVisitorPass = async () => {
    if (!visitorForm.visitorName.trim() || !visitorForm.hostName.trim() || !visitorForm.purpose.trim()) {
      toast({ title: 'Missing details', description: 'Visitor name, host name, and purpose are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('visitor');
      const created = await postApi('/security/visitors', {
        visitorName: visitorForm.visitorName.trim(),
        hostName: visitorForm.hostName.trim(),
        purpose: visitorForm.purpose.trim(),
        phone: visitorForm.phone.trim() || null,
        idProofType: visitorForm.idProofType,
        idProofNumber: visitorForm.idProofNumber.trim() || null,
      });
      setVisitorPasses((prev: any[]) => [created, ...prev]);
      setVisitorForm({ visitorName: '', hostName: '', purpose: '', phone: '', idProofType: 'aadhaar', idProofNumber: '' });
      setIsVisitorDialogOpen(false);
      toast({ title: 'Visitor added', description: 'Visitor pass created successfully.' });
    } catch (error: any) {
      toast({ title: 'Failed to add visitor', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const checkoutVisitor = async (visitorId: string) => {
    try {
      setSubmittingAction(`visitor-${visitorId}`);
      const updated = await putApi(`/security/visitors/${visitorId}`, { status: 'checked_out', checkOutTime: new Date().toISOString() });
      setVisitorPasses((prev: any[]) => prev.map((item) => item.id === visitorId ? updated : item));
      toast({ title: 'Visitor checked out', description: 'Checkout timestamp recorded.' });
    } catch (error: any) {
      toast({ title: 'Checkout failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteVisitor = async (visitorId: string) => {
    try {
      setSubmittingAction(`visitor-delete-${visitorId}`);
      await deleteApi(`/security/visitors/${visitorId}`);
      setVisitorPasses((prev: any[]) => prev.filter((item) => item.id !== visitorId));
      toast({ title: 'Visitor deleted', description: 'Visitor entry removed.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const createVehiclePass = async () => {
    if (!vehicleForm.ownerName.trim() || !vehicleForm.ownerIdNumber.trim() || !vehicleForm.vehicleNumber.trim()) {
      toast({ title: 'Missing details', description: 'Owner, owner ID, and vehicle number are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('vehicle');
      const created = await postApi('/security/vehicle-passes', {
        ownerName: vehicleForm.ownerName.trim(),
        ownerType: vehicleForm.ownerType,
        ownerIdNumber: vehicleForm.ownerIdNumber.trim(),
        vehicleType: vehicleForm.vehicleType,
        vehicleNumber: vehicleForm.vehicleNumber.trim(),
        vehicleModel: vehicleForm.vehicleModel.trim() || null,
        validFrom: vehicleForm.validFrom,
        validUntil: vehicleForm.validUntil,
        parkingZone: vehicleForm.parkingZone,
      });
      setVehiclePasses((prev: any[]) => [created, ...prev]);
      setVehicleForm({
        ownerName: '',
        ownerType: 'student',
        ownerIdNumber: '',
        vehicleType: 'car',
        vehicleNumber: '',
        vehicleModel: '',
        parkingZone: 'A',
        validFrom: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      });
      setIsVehicleDialogOpen(false);
      toast({ title: 'Vehicle pass created', description: 'Vehicle pass added successfully.' });
    } catch (error: any) {
      toast({ title: 'Failed to create pass', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const updateVehicleStatus = async (passId: string, status: string) => {
    try {
      setSubmittingAction(`vehicle-${passId}`);
      const updated = await putApi(`/security/vehicle-passes/${passId}`, { status });
      setVehiclePasses((prev: any[]) => prev.map((item) => item.id === passId ? updated : item));
      toast({ title: 'Vehicle pass updated', description: `Status changed to ${status}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteVehiclePass = async (passId: string) => {
    try {
      setSubmittingAction(`vehicle-delete-${passId}`);
      await deleteApi(`/security/vehicle-passes/${passId}`);
      setVehiclePasses((prev: any[]) => prev.filter((item) => item.id !== passId));
      toast({ title: 'Vehicle pass deleted', description: 'Pass removed from records.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const createVigilanceCase = async () => {
    if (!vigilanceForm.subject.trim() || !vigilanceForm.description.trim() || !vigilanceForm.investigatingOfficer.trim()) {
      toast({ title: 'Missing details', description: 'Subject, description, and officer are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('vigilance');
      const created = await postApi('/security/vigilance-cases', {
        type: vigilanceForm.type,
        subject: vigilanceForm.subject.trim(),
        description: vigilanceForm.description.trim(),
        complainantType: vigilanceForm.complainantType,
        investigatingOfficer: vigilanceForm.investigatingOfficer.trim(),
      });
      setVigilanceCases((prev: any[]) => [created, ...prev]);
      setVigilanceForm({ type: 'misconduct', subject: '', description: '', complainantType: 'anonymous', investigatingOfficer: '' });
      setIsVigilanceDialogOpen(false);
      toast({ title: 'Case created', description: 'Vigilance case registered.' });
    } catch (error: any) {
      toast({ title: 'Failed to create case', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const updateVigilanceStatus = async (caseId: string, status: string) => {
    try {
      setSubmittingAction(`vigilance-${caseId}`);
      const payload: any = { status };
      if (status === 'closed') payload.closeDate = new Date().toISOString();
      const updated = await putApi(`/security/vigilance-cases/${caseId}`, payload);
      setVigilanceCases((prev: any[]) => prev.map((item) => item.id === caseId ? updated : item));
      toast({ title: 'Case updated', description: `Case marked as ${status}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteVigilanceCase = async (caseId: string) => {
    try {
      setSubmittingAction(`vigilance-delete-${caseId}`);
      await deleteApi(`/security/vigilance-cases/${caseId}`);
      setVigilanceCases((prev: any[]) => prev.filter((item) => item.id !== caseId));
      toast({ title: 'Case deleted', description: 'Vigilance case removed.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const createGuard = async () => {
    if (!guardForm.name.trim() || !guardForm.email.trim()) {
      toast({ title: 'Missing details', description: 'Guard name and email are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction('guard-create');
      const created = await postApi('/security/guards', {
        name: guardForm.name.trim(),
        email: guardForm.email.trim(),
        designation: guardForm.designation.trim() || 'Security Guard',
        campus: guardForm.campus.trim() || null,
      });
      setGuards((prev: any[]) => [created, ...prev]);
      setGuardForm({ name: '', email: '', designation: 'Security Guard', campus: '' });
      setIsGuardDialogOpen(false);
      toast({ title: 'Guard added', description: 'Guard roster updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Failed to add guard', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const deleteGuard = async (guardId: string) => {
    try {
      setSubmittingAction(`guard-delete-${guardId}`);
      await deleteApi(`/security/guards/${guardId}`);
      setGuards((prev: any[]) => prev.filter((item) => item.id !== guardId));
      toast({ title: 'Guard removed', description: 'Guard removed from roster.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const openDutyDialog = (guard: any) => {
    setSelectedGuard(guard);
    setDutyForm({
      shift: String(guard?.latestDuty?.shift || 'morning'),
      patrolRoute: String(guard?.latestDuty?.patrolRoute || ''),
      location: String(guard?.latestDuty?.location || ''),
      status: String(guard?.latestDuty?.status || 'on_duty'),
    });
    setIsDutyDialogOpen(true);
  };

  const assignDuty = async () => {
    if (!selectedGuard?.id) return;
    if (!dutyForm.patrolRoute.trim()) {
      toast({ title: 'Missing route', description: 'Patrol route is required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingAction(`duty-${selectedGuard.id}`);
      const duty = await putApi(`/security/guards/${selectedGuard.id}/duty`, {
        shift: dutyForm.shift,
        patrolRoute: dutyForm.patrolRoute.trim(),
        location: dutyForm.location.trim() || null,
        status: dutyForm.status,
      });

      setGuards((prev: any[]) => prev.map((item) => item.id === selectedGuard.id ? { ...item, latestDuty: duty } : item));
      setPatrolLogs((prev: any[]) => {
        const existingIndex = prev.findIndex((entry) => entry.id === duty.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = duty;
          return next;
        }
        return [duty, ...prev];
      });
      setIsDutyDialogOpen(false);
      setSelectedGuard(null);
      toast({ title: 'Duty updated', description: 'Guard duty assigned successfully.' });
    } catch (error: any) {
      toast({ title: 'Duty update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setSubmittingAction(null);
    }
  };

  const activeIncidents = securityIncidents.filter((incident: any) => !['resolved', 'closed'].includes(String(incident.status || '').toLowerCase())).length;
  const visitorsToday = visitorPasses.filter((visitor: any) => {
    const d = new Date(visitor.checkInTime);
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
  }).length;
  const pendingIdRequests = idCardRequests.filter((request: any) => String(request.status || '').toLowerCase() === 'pending').length;
  const activeVehiclePasses = vehiclePasses.filter((pass: any) => String(pass.status || '').toLowerCase() === 'active').length;
  const guardsOnDuty = new Set(
    patrolLogs
      .filter((log: any) => ['on_duty', 'in_progress', 'active'].includes(String(log.status || '').toLowerCase()))
      .map((log: any) => String(log.officerName || '').trim())
      .filter(Boolean)
  ).size;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security & Campus Safety</h1>
            <p className="text-muted-foreground">Incident management, access control, and campus safety monitoring</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isEmergencyDialogOpen} onOpenChange={setIsEmergencyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm"><Siren className="mr-2 h-4 w-4" />Emergency Alert</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Raise Emergency Alert</DialogTitle>
                  <DialogDescription>Creates a critical support ticket via security API.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="emergency-subject">Subject</Label>
                    <Input id="emergency-subject" value={emergencyForm.subject} onChange={(e) => setEmergencyForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Emergency subject" />
                  </div>
                  <div>
                    <Label htmlFor="emergency-contact">Contact Info</Label>
                    <Input id="emergency-contact" value={emergencyForm.contactInfo} onChange={(e) => setEmergencyForm((prev) => ({ ...prev, contactInfo: e.target.value }))} placeholder="Phone / control room contact" />
                  </div>
                  <div>
                    <Label htmlFor="emergency-description">Description</Label>
                    <Textarea id="emergency-description" value={emergencyForm.description} onChange={(e) => setEmergencyForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe emergency situation" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEmergencyDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleEmergencyAlert} disabled={submittingAction === 'emergency'}>
                    {submittingAction === 'emergency' ? 'Raising...' : 'Raise Alert'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isIncidentDialogOpen} onOpenChange={setIsIncidentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Log Incident</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Security Incident</DialogTitle>
                  <DialogDescription>Creates an incident record in security incidents API.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="incident-title">Title</Label>
                    <Input id="incident-title" value={incidentForm.title} onChange={(e) => setIncidentForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Incident title" />
                  </div>
                  <div>
                    <Label htmlFor="incident-location">Location</Label>
                    <Input id="incident-location" value={incidentForm.location} onChange={(e) => setIncidentForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Location" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="incident-severity">Severity</Label>
                      <select id="incident-severity" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={incidentForm.severity} onChange={(e) => setIncidentForm((prev) => ({ ...prev, severity: e.target.value }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="incident-status">Status</Label>
                      <select id="incident-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={incidentForm.status} onChange={(e) => setIncidentForm((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="pending">Pending</option>
                        <option value="open">Open</option>
                        <option value="under_investigation">Under Investigation</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="incident-description">Description</Label>
                    <Textarea id="incident-description" value={incidentForm.description} onChange={(e) => setIncidentForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Incident description" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsIncidentDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateIncident} disabled={submittingAction === 'incident'}>
                    {submittingAction === 'incident' ? 'Saving...' : 'Create Incident'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-amber-500" /><div><p className="text-xs text-muted-foreground">Active Incidents</p><p className="text-2xl font-bold text-amber-600">{activeIncidents}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Visitors Today</p><p className="text-2xl font-bold">{visitorsToday}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CreditCard className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">ID Requests</p><p className="text-2xl font-bold">{pendingIdRequests}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Car className="h-8 w-8 text-purple-600" /><div><p className="text-xs text-muted-foreground">Vehicle Passes</p><p className="text-2xl font-bold">{activeVehiclePasses}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Guards on Duty</p><p className="text-2xl font-bold">{guardsOnDuty}</p></div></div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SecurityTab)}>
          <TabsList>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="visitors">Visitor Passes</TabsTrigger>
            <TabsTrigger value="ids">ID Management</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicle Passes</TabsTrigger>
            <TabsTrigger value="guards">Guards</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="vigilance">Vigilance</TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search incidents..." className="pl-10" value={incidentSearch} onChange={(e) => setIncidentSearch(e.target.value)} /></div>
            {filteredIncidents.map((si) => (
              <Card key={si.id} className={si.severity === 'critical' ? 'border-destructive' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{String(si.id || '').slice(0, 8).toUpperCase()}</p></div>
                      <p className="text-sm font-medium text-foreground">{si.title}</p>
                      <p className="text-sm text-muted-foreground">{si.description}</p>
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span><MapPin className="mr-1 inline h-3 w-3" />{si.location}</span>
                        <span><Clock className="mr-1 inline h-3 w-3" />{formatDate(si.reportedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={si.severity === 'critical' ? 'destructive' : si.severity === 'serious' ? 'default' : 'secondary'} className="capitalize">{si.severity}</Badge>
                      <Badge variant={si.status === 'resolved' ? 'default' : 'outline'} className="capitalize">{si.status}</Badge>
                      <div className="flex gap-2">
                        {!['resolved', 'closed'].includes(String(si.status || '').toLowerCase()) && (
                          <Button size="sm" variant="outline" disabled={submittingAction === `incident-${si.id}`} onClick={() => updateIncidentStatus(si.id, 'resolved')}>
                            Resolve
                          </Button>
                        )}
                        {String(si.status || '').toLowerCase() !== 'closed' && (
                          <Button size="sm" variant="outline" disabled={submittingAction === `incident-${si.id}`} onClick={() => updateIncidentStatus(si.id, 'closed')}>
                            Close
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" disabled={submittingAction === `incident-delete-${si.id}`} onClick={() => deleteIncident(si.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="visitors">
            <div className="mb-3 flex justify-end">
              <Dialog open={isVisitorDialogOpen} onOpenChange={setIsVisitorDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Visitor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Visitor Pass</DialogTitle>
                    <DialogDescription>Creates a visitor pass in security visitors API.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="visitor-name">Visitor Name</Label>
                      <Input id="visitor-name" value={visitorForm.visitorName} onChange={(e) => setVisitorForm((prev) => ({ ...prev, visitorName: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="visitor-host">Host Name</Label>
                      <Input id="visitor-host" value={visitorForm.hostName} onChange={(e) => setVisitorForm((prev) => ({ ...prev, hostName: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="visitor-purpose">Purpose</Label>
                      <Input id="visitor-purpose" value={visitorForm.purpose} onChange={(e) => setVisitorForm((prev) => ({ ...prev, purpose: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="visitor-phone">Phone</Label>
                        <Input id="visitor-phone" value={visitorForm.phone} onChange={(e) => setVisitorForm((prev) => ({ ...prev, phone: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="visitor-id-type">ID Type</Label>
                        <select id="visitor-id-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={visitorForm.idProofType} onChange={(e) => setVisitorForm((prev) => ({ ...prev, idProofType: e.target.value }))}>
                          <option value="aadhaar">Aadhaar</option>
                          <option value="pan">PAN</option>
                          <option value="driving_license">Driving License</option>
                          <option value="passport">Passport</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="visitor-id-number">ID Number</Label>
                      <Input id="visitor-id-number" value={visitorForm.idProofNumber} onChange={(e) => setVisitorForm((prev) => ({ ...prev, idProofNumber: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsVisitorDialogOpen(false)}>Cancel</Button>
                    <Button onClick={createVisitorPass} disabled={submittingAction === 'visitor'}>{submittingAction === 'visitor' ? 'Saving...' : 'Create'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Visitor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Host</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Check In</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr></thead><tbody>
              {visitorPasses.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{v.visitorName}</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.hostName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.purpose}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(v.checkInTime, true)}</td>
                  <td className="px-4 py-3"><Badge variant={v.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{v.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!['checked_out', 'closed'].includes(String(v.status || '').toLowerCase()) && (
                        <Button size="sm" variant="outline" disabled={submittingAction === `visitor-${v.id}`} onClick={() => checkoutVisitor(v.id)}>
                          Checkout
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={submittingAction === `visitor-delete-${v.id}`} onClick={() => deleteVisitor(v.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="ids">
            <div className="mb-3 flex justify-end">
              <Dialog open={isIdDialogOpen} onOpenChange={setIsIdDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />New ID Request</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create ID Card Request</DialogTitle>
                    <DialogDescription>Creates a new ID card request in security API.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="id-applicant-id">Applicant ID</Label>
                        <Input id="id-applicant-id" value={idForm.applicantId} onChange={(e) => setIdForm((prev) => ({ ...prev, applicantId: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="id-applicant-name">Applicant Name</Label>
                        <Input id="id-applicant-name" value={idForm.applicantName} onChange={(e) => setIdForm((prev) => ({ ...prev, applicantName: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="id-applicant-type">Applicant Type</Label>
                        <select id="id-applicant-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={idForm.applicantType} onChange={(e) => setIdForm((prev) => ({ ...prev, applicantType: e.target.value }))}>
                          <option value="student">Student</option>
                          <option value="faculty">Faculty</option>
                          <option value="staff">Staff</option>
                          <option value="visitor">Visitor</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="id-request-type">Request Type</Label>
                        <select id="id-request-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={idForm.requestType} onChange={(e) => setIdForm((prev) => ({ ...prev, requestType: e.target.value }))}>
                          <option value="new">New</option>
                          <option value="renewal">Renewal</option>
                          <option value="replacement">Replacement</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="id-reason">Reason</Label>
                      <Textarea id="id-reason" value={idForm.reason} onChange={(e) => setIdForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Reason for request" />
                    </div>
                    <div>
                      <Label htmlFor="id-fees-paid">Fees Paid</Label>
                      <select id="id-fees-paid" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={idForm.feesPaid ? 'yes' : 'no'} onChange={(e) => setIdForm((prev) => ({ ...prev, feesPaid: e.target.value === 'yes' }))}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsIdDialogOpen(false)}>Cancel</Button>
                    <Button onClick={createIdCardRequest} disabled={submittingAction === 'id-create'}>{submittingAction === 'id-create' ? 'Saving...' : 'Create Request'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(id.requestDate)}</td>
                  <td className="px-4 py-3"><Badge variant={id.status === 'issued' ? 'default' : id.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{id.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {id.status === 'pending' && (
                        <Button size="sm" disabled={submittingAction === `id-${id.id}`} onClick={() => updateIdCardStatus(id.id, 'approved')}>
                          {submittingAction === `id-${id.id}` ? 'Approving...' : 'Approve'}
                        </Button>
                      )}
                      {id.status === 'approved' && (
                        <Button size="sm" variant="outline" disabled={submittingAction === `id-${id.id}`} onClick={() => updateIdCardStatus(id.id, 'issued')}>
                          <Scan className="mr-1 h-3 w-3" />
                          {submittingAction === `id-${id.id}` ? 'Issuing...' : 'Issue Card'}
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={submittingAction === `id-delete-${id.id}`} onClick={() => deleteIdCardRequest(id.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="vehicles">
            <div className="mb-3 flex justify-end">
              <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Vehicle Pass</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Vehicle Pass</DialogTitle>
                    <DialogDescription>Creates a vehicle pass with security API.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="vehicle-owner-name">Owner Name</Label>
                        <Input id="vehicle-owner-name" value={vehicleForm.ownerName} onChange={(e) => setVehicleForm((prev) => ({ ...prev, ownerName: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-owner-id">Owner ID</Label>
                        <Input id="vehicle-owner-id" value={vehicleForm.ownerIdNumber} onChange={(e) => setVehicleForm((prev) => ({ ...prev, ownerIdNumber: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="vehicle-owner-type">Owner Type</Label>
                        <select id="vehicle-owner-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.ownerType} onChange={(e) => setVehicleForm((prev) => ({ ...prev, ownerType: e.target.value }))}>
                          <option value="student">Student</option>
                          <option value="faculty">Faculty</option>
                          <option value="staff">Staff</option>
                          <option value="visitor">Visitor</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="vehicle-type">Vehicle Type</Label>
                        <select id="vehicle-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.vehicleType} onChange={(e) => setVehicleForm((prev) => ({ ...prev, vehicleType: e.target.value }))}>
                          <option value="car">Car</option>
                          <option value="bike">Bike</option>
                          <option value="scooter">Scooter</option>
                          <option value="bus">Bus</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="vehicle-number">Vehicle Number</Label>
                        <Input id="vehicle-number" value={vehicleForm.vehicleNumber} onChange={(e) => setVehicleForm((prev) => ({ ...prev, vehicleNumber: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-model">Vehicle Model</Label>
                        <Input id="vehicle-model" value={vehicleForm.vehicleModel} onChange={(e) => setVehicleForm((prev) => ({ ...prev, vehicleModel: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="vehicle-zone">Parking Zone</Label>
                        <Input id="vehicle-zone" value={vehicleForm.parkingZone} onChange={(e) => setVehicleForm((prev) => ({ ...prev, parkingZone: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-valid-from">Valid From</Label>
                        <Input id="vehicle-valid-from" type="date" value={vehicleForm.validFrom} onChange={(e) => setVehicleForm((prev) => ({ ...prev, validFrom: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="vehicle-valid-until">Valid Until</Label>
                        <Input id="vehicle-valid-until" type="date" value={vehicleForm.validUntil} onChange={(e) => setVehicleForm((prev) => ({ ...prev, validUntil: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>Cancel</Button>
                    <Button onClick={createVehiclePass} disabled={submittingAction === 'vehicle'}>{submittingAction === 'vehicle' ? 'Saving...' : 'Create'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Pass No.</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vehicle</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Zone</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Valid Till</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr></thead><tbody>
              {vehiclePasses.map((vp) => (
                <tr key={vp.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{vp.passNumber}</td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{vp.ownerName}</p><Badge variant="outline" className="capitalize text-xs">{vp.ownerType}</Badge></td>
                  <td className="px-4 py-3"><p className="text-sm text-foreground">{vp.vehicleNumber}</p><p className="text-xs text-muted-foreground">{vp.vehicleModel} ({(vp.vehicleType || '').replace('_',' ')})</p></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{vp.parkingZone}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(vp.validUntil)}</td>
                  <td className="px-4 py-3"><Badge variant={vp.status === 'active' ? 'default' : 'destructive'} className="capitalize">{vp.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {String(vp.status || '').toLowerCase() !== 'revoked' && (
                        <Button size="sm" variant="outline" disabled={submittingAction === `vehicle-${vp.id}`} onClick={() => updateVehicleStatus(vp.id, 'revoked')}>
                          Revoke
                        </Button>
                      )}
                      {String(vp.status || '').toLowerCase() !== 'active' && (
                        <Button size="sm" variant="outline" disabled={submittingAction === `vehicle-${vp.id}`} onClick={() => updateVehicleStatus(vp.id, 'active')}>
                          Activate
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={submittingAction === `vehicle-delete-${vp.id}`} onClick={() => deleteVehiclePass(vp.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="guards">
            <div className="mb-3 flex justify-end">
              <Dialog open={isGuardDialogOpen} onOpenChange={setIsGuardDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Guard</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Guard</DialogTitle>
                    <DialogDescription>Create a new guard in security roster.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="guard-name">Name</Label>
                      <Input id="guard-name" value={guardForm.name} onChange={(e) => setGuardForm((prev) => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="guard-email">Email</Label>
                      <Input id="guard-email" value={guardForm.email} onChange={(e) => setGuardForm((prev) => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="guard-designation">Designation</Label>
                        <Input id="guard-designation" value={guardForm.designation} onChange={(e) => setGuardForm((prev) => ({ ...prev, designation: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="guard-campus">Campus</Label>
                        <Input id="guard-campus" value={guardForm.campus} onChange={(e) => setGuardForm((prev) => ({ ...prev, campus: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsGuardDialogOpen(false)}>Cancel</Button>
                    <Button onClick={createGuard} disabled={submittingAction === 'guard-create'}>{submittingAction === 'guard-create' ? 'Saving...' : 'Create Guard'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Guard</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Designation</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Shift</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Route</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Duty Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr></thead><tbody>
              {guards.map((guard) => (
                <tr key={guard.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{guard.name}</p>
                    <p className="text-xs text-muted-foreground">{guard.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{guard.designation || 'Security Guard'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{guard.latestDuty?.shift || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{guard.latestDuty?.patrolRoute || '-'}</td>
                  <td className="px-4 py-3"><Badge variant={['on_duty', 'active', 'in_progress'].includes(String(guard.latestDuty?.status || '').toLowerCase()) ? 'default' : 'secondary'} className="capitalize">{String(guard.latestDuty?.status || 'off_duty').replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={submittingAction === `duty-${guard.id}`} onClick={() => openDutyDialog(guard)}>Assign Duty</Button>
                      <Button size="sm" variant="destructive" disabled={submittingAction === `guard-delete-${guard.id}`} onClick={() => deleteGuard(guard.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>

            <Dialog open={isDutyDialogOpen} onOpenChange={setIsDutyDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Guard Duty</DialogTitle>
                  <DialogDescription>{selectedGuard ? `Set duty for ${selectedGuard.name}` : 'Set duty details'}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="duty-shift">Shift</Label>
                      <select id="duty-shift" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={dutyForm.shift} onChange={(e) => setDutyForm((prev) => ({ ...prev, shift: e.target.value }))}>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="night">Night</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="duty-status">Status</Label>
                      <select id="duty-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={dutyForm.status} onChange={(e) => setDutyForm((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="on_duty">On Duty</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="off_duty">Off Duty</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="duty-route">Patrol Route</Label>
                    <Input id="duty-route" value={dutyForm.patrolRoute} onChange={(e) => setDutyForm((prev) => ({ ...prev, patrolRoute: e.target.value }))} placeholder="Route / area" />
                  </div>
                  <div>
                    <Label htmlFor="duty-location">Location</Label>
                    <Input id="duty-location" value={dutyForm.location} onChange={(e) => setDutyForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Current location" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDutyDialogOpen(false)}>Cancel</Button>
                  <Button onClick={assignDuty} disabled={Boolean(selectedGuard && submittingAction === `duty-${selectedGuard.id}`)}>{selectedGuard && submittingAction === `duty-${selectedGuard.id}` ? 'Saving...' : 'Save Duty'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="audit">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Start Time</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Officer</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Shift</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Route</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            </tr></thead><tbody>
              {patrolLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(log.startTime, true)}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{log.officerName}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.shift}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.patrolRoute}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.location || '-'}</td>
                  <td className="px-4 py-3"><Badge variant={log.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{log.status?.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="vigilance" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isVigilanceDialogOpen} onOpenChange={setIsVigilanceDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Case</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Vigilance Case</DialogTitle>
                    <DialogDescription>Registers a confidential case via vigilance API.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="vigilance-type">Type</Label>
                        <select id="vigilance-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vigilanceForm.type} onChange={(e) => setVigilanceForm((prev) => ({ ...prev, type: e.target.value }))}>
                          <option value="misconduct">Misconduct</option>
                          <option value="fraud">Fraud</option>
                          <option value="harassment">Harassment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="vigilance-complainant">Complainant Type</Label>
                        <select id="vigilance-complainant" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vigilanceForm.complainantType} onChange={(e) => setVigilanceForm((prev) => ({ ...prev, complainantType: e.target.value }))}>
                          <option value="anonymous">Anonymous</option>
                          <option value="student">Student</option>
                          <option value="faculty">Faculty</option>
                          <option value="staff">Staff</option>
                          <option value="external">External</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="vigilance-subject">Subject</Label>
                      <Input id="vigilance-subject" value={vigilanceForm.subject} onChange={(e) => setVigilanceForm((prev) => ({ ...prev, subject: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="vigilance-officer">Investigating Officer</Label>
                      <Input id="vigilance-officer" value={vigilanceForm.investigatingOfficer} onChange={(e) => setVigilanceForm((prev) => ({ ...prev, investigatingOfficer: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="vigilance-description">Description</Label>
                      <Textarea id="vigilance-description" value={vigilanceForm.description} onChange={(e) => setVigilanceForm((prev) => ({ ...prev, description: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsVigilanceDialogOpen(false)}>Cancel</Button>
                    <Button onClick={createVigilanceCase} disabled={submittingAction === 'vigilance'}>{submittingAction === 'vigilance' ? 'Saving...' : 'Create'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {vigilanceCases.map((vc) => (
              <Card key={vc.id} className="border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{vc.caseNumber}</p><Badge variant="outline" className="capitalize">{vc.type.replace('_',' ')}</Badge><Badge variant="destructive">Confidential</Badge></div>
                      <p className="mt-1 text-sm text-foreground">{vc.subject}</p>
                      <p className="text-sm text-muted-foreground">{vc.description}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span>Reported: {formatDate(vc.dateReported)}</span>
                        <span className="ml-4">Source: <span className="capitalize">{(vc.complainantType || '').replace('_',' ')}</span></span>
                        <span className="ml-4">Officer: {vc.investigatingOfficer}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary" className="capitalize">{(vc.status || '').replace('_',' ')}</Badge>
                      <div className="flex gap-2">
                        {String(vc.status || '').toLowerCase() !== 'closed' && (
                          <Button size="sm" variant="outline" disabled={submittingAction === `vigilance-${vc.id}`} onClick={() => updateVigilanceStatus(vc.id, 'closed')}>
                            Close
                          </Button>
                        )}
                        {String(vc.status || '').toLowerCase() !== 'investigating' && (
                          <Button size="sm" variant="outline" disabled={submittingAction === `vigilance-${vc.id}`} onClick={() => updateVigilanceStatus(vc.id, 'investigating')}>
                            Investigating
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" disabled={submittingAction === `vigilance-delete-${vc.id}`} onClick={() => deleteVigilanceCase(vc.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
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