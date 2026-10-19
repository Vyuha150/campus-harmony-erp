import { MyPayslips } from '@/components/shared/MyPayslips';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { ROLE_INFO } from '@/types/erp';

/**
 * Profile & Settings, and Help & Support — for every role.
 *
 * The header's "Profile Settings" and "Help & Support" items had no handler,
 * and there was no screen (or API) behind either. This page is both:
 *   Profile    who you are, as the institution records it; edit your name
 *   Security   change your own password
 *   Support    raise a ticket and follow the ones you have raised
 */

interface Profile {
  name: string; email: string; role: string; designation: string | null; campus: string | null;
  department: { name: string; code: string } | null;
  institution: { name: string } | null;
  studentProfile: { rollNumber: string; program: string; branch: string; semester: number; section: string; batch: string } | null;
  facultyProfile: { employeeId: string; qualification: string | null; specialization: string | null; experience: number } | null;
}
interface Ticket { id: string; ticketNumber: string; category: string; priority: string; subject: string; description: string; status: string; createdDate: string; resolutionNotes: string | null }

const CATEGORIES: Array<[string, string]> = [
  ['login_access', 'Login or access problem'],
  ['technical', 'Something is not working'],
  ['data_correction', 'My data is wrong'],
  ['academic', 'Academic records'],
  ['fees', 'Fees and payments'],
  ['other', 'Other']
];
const categoryLabel = (value: string) => CATEGORIES.find(([v]) => v === value)?.[1] ?? value;
const STATUS_STYLE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700', closed: 'bg-slate-100 text-slate-600'
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:gap-4">
      <span className="w-44 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  );
}

export default function AccountSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'profile';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [savingTicket, setSavingTicket] = useState(false);

  const loadTickets = useCallback(async () => {
    const rows = await fetchApi<Ticket[]>('/account/support-tickets');
    setTickets(Array.isArray(rows) ? rows : []);
  }, []);

  useEffect(() => {
    fetchApi<Profile>('/account/profile')
      .then((p) => { setProfile(p); setName(p?.name ?? ''); })
      .catch((error) => toast({ title: 'Could not load your profile', description: error.message, variant: 'destructive' }));
    loadTickets().catch(() => undefined);
  }, [loadTickets, toast]);

  const saveName = async () => {
    setSavingName(true);
    try {
      await putApi('/account/profile', { name: name.trim() });
      setProfile((p) => (p ? { ...p, name: name.trim() } : p));
      toast({ title: 'Profile updated', description: 'Your new name shows everywhere after you next sign in.' });
    } catch (error) {
      toast({ title: 'Could not update your profile', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Type the new password the same way twice.', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      await postApi('/account/password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast({ title: 'Password changed', description: 'Use your new password the next time you sign in.' });
    } catch (error) {
      toast({ title: 'Password not changed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  const raiseTicket = async () => {
    setSavingTicket(true);
    try {
      await postApi('/account/support-tickets', { category, priority, subject: subject.trim(), description: description.trim() });
      setSubject(''); setDescription('');
      await loadTickets();
      toast({ title: 'Ticket raised', description: 'The support desk has been notified. You can follow it below.' });
    } catch (error) {
      toast({ title: 'Could not raise the ticket', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSavingTicket(false);
    }
  };

  const roleLabel = user ? ROLE_INFO[user.role]?.label ?? user.role : '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>
          <p className="text-muted-foreground">Your account, your password, and help when something is wrong.</p>
        </div>

        <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Password</TabsTrigger>
            <TabsTrigger value="support">Help & Support</TabsTrigger>
            {user && !['student', 'super_admin'].includes(user.role) && <TabsTrigger value="payslips">Payslips</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Account details</CardTitle><CardDescription>As recorded by the institution. Ask the office concerned to correct anything other than your display name.</CardDescription></CardHeader>
              <CardContent>
                <Row label="Email" value={profile?.email} />
                <Row label="Role" value={roleLabel} />
                <Row label="Designation" value={profile?.designation} />
                <Row label="Department" value={profile?.department ? `${profile.department.name} (${profile.department.code})` : null} />
                <Row label="Institution" value={profile?.institution?.name} />
                {profile?.studentProfile && (<>
                  <Row label="Roll number" value={profile.studentProfile.rollNumber} />
                  <Row label="Programme" value={`${profile.studentProfile.program} ${profile.studentProfile.branch}`} />
                  <Row label="Semester / Section" value={`Semester ${profile.studentProfile.semester}, Section ${profile.studentProfile.section} (batch ${profile.studentProfile.batch})`} />
                </>)}
                {profile?.facultyProfile && (<>
                  <Row label="Employee ID" value={profile.facultyProfile.employeeId} />
                  <Row label="Qualification" value={profile.facultyProfile.qualification} />
                  <Row label="Specialisation" value={profile.facultyProfile.specialization} />
                  <Row label="Experience" value={`${profile.facultyProfile.experience} years`} />
                </>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Display name</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1"><Label htmlFor="account-name">Name</Label><Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
                <Button onClick={saveName} disabled={savingName || name.trim().length < 2 || name.trim() === profile?.name}>Save</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <Card className="max-w-lg">
              <CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>At least 12 characters, mixing letters with numbers or symbols. A long passphrase works well.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label htmlFor="pw-current">Current password</Label><Input id="pw-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="pw-confirm">Confirm new password</Label><Input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                <Button onClick={changePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>Change password</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payslips" className="mt-4"><MyPayslips /></TabsContent>

          <TabsContent value="support" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Raise a support ticket</CardTitle><CardDescription>Goes to the campus support desk. You will see its status here.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>What is it about?</Label>
                    <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>How urgent?</Label>
                    <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="low">Low — when convenient</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High — blocking my work</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-1"><Label htmlFor="ticket-subject">Subject</Label><Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="e.g. Cannot download my hall ticket" /></div>
                <div className="space-y-1"><Label htmlFor="ticket-description">Details</Label><Textarea id="ticket-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="What you were doing, what you expected, and what happened instead." /></div>
                <Button onClick={raiseTicket} disabled={savingTicket || subject.trim().length < 5 || description.trim().length < 10}>Raise ticket</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">My tickets ({tickets.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tickets.length === 0 && <p className="text-sm text-muted-foreground">You have not raised any tickets.</p>}
                {tickets.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{t.ticketNumber} — {t.subject}</p>
                      <Badge className={STATUS_STYLE[t.status] ?? ''}>{t.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(t.category)} • {t.priority} priority • raised {new Date(t.createdDate).toLocaleDateString('en-IN')}</p>
                    <p className="mt-2 text-sm text-foreground">{t.description}</p>
                    {t.resolutionNotes && <p className="mt-2 rounded bg-muted/50 p-2 text-sm"><span className="font-medium">Response: </span>{t.resolutionNotes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
