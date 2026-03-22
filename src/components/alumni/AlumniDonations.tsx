import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Gift, Plus, Download, IndianRupee, FileText, Eye, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniDonations() {
  const { toast } = useToast();
  const [alumniDonations, setAlumniDonations] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [alumniProfileId, setAlumniProfileId] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('completed');

  const loadData = async () => {
    const rows = await fetchApi<any[]>('/alumni/donations');
    setAlumniDonations(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load donations', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const totalDonations = useMemo(() => alumniDonations.reduce((s, d) => s + Number(d.amount || 0), 0), [alumniDonations]);

  const donationTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const d of alumniDonations) {
      const parsed = new Date(String(d.donatedAt || d.date));
      if (Number.isNaN(parsed.getTime())) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + Number(d.amount || 0));
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));
  }, [alumniDonations]);

  const donationStats = useMemo(() => {
    const donors = new Set(alumniDonations.map((d) => String(d.donorName || '').trim()).filter(Boolean)).size;
    return {
      totalDonors: donors,
      yearOverYearGrowth: 'N/A',
      receiptsIssued: alumniDonations.filter((d) => String(d.status || '').toLowerCase() === 'completed').length,
    };
  }, [alumniDonations]);

  const resetForm = () => {
    setAlumniProfileId('');
    setAmount('');
    setPurpose('');
    setDate('');
    setStatus('completed');
  };

  const handleRecordDonation = async () => {
    if (!alumniProfileId.trim() || !amount || !purpose.trim()) {
      toast({ title: 'Missing fields', description: 'Alumni Profile ID, amount and purpose are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/alumni/donations', {
        alumniProfileId: alumniProfileId.trim(),
        amount: Number(amount),
        purpose: purpose.trim(),
        date: date ? new Date(date).toISOString() : undefined,
        status,
      });
      await loadData();
      setOpen(false);
      resetForm();
      toast({ title: 'Donation recorded', description: 'Donation saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Record failed', description: error?.message || 'Unable to record donation.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fundraising & Donations</h1>
            <p className="text-muted-foreground">Track donations and manage alumni fundraising records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><Download className="mr-2 h-4 w-4" />Refresh</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Record Donation</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Donor Alumni Profile ID</Label><Input value={alumniProfileId} onChange={(e) => setAlumniProfileId(e.target.value)} placeholder="Enter AlumniProfile.id" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    <div><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Purpose</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. AI Research Lab" /></div>
                  <div><Label>Date (optional)</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <Button className="w-full" disabled={saving} onClick={handleRecordDonation}>Record Donation</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4"><IndianRupee className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">₹{(totalDonations / 100000).toFixed(1)} L</p><p className="text-xs text-muted-foreground">Total Donations</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Gift className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">{donationStats.totalDonors}</p><p className="text-xs text-muted-foreground">Total Donors</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><TrendingUp className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">{donationStats.yearOverYearGrowth}</p><p className="text-xs text-muted-foreground">YoY Growth</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><FileText className="h-8 w-8 text-blue-600" /><div><p className="text-2xl font-bold text-foreground">{donationStats.receiptsIssued}</p><p className="text-xs text-muted-foreground">Completed Receipts</p></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Donation Trend (₹)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={donationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v: number) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Donations</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Donor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {alumniDonations.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{d.donorName || 'Unknown Donor'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{d.purpose}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(d.donatedAt || d.date)}</td>
                      <td className="px-4 py-3"><Badge variant={String(d.status || '').toLowerCase() === 'completed' ? 'default' : 'secondary'} className="capitalize">{d.status || 'completed'}</Badge></td>
                      <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={loadData}><Eye className="mr-1 h-3 w-3" />View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
