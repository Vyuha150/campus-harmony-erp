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
import { alumniDonations } from '@/data/alumniMockData';

const donationTrend = [
  { year: '2021', amount: 1200000 }, { year: '2022', amount: 1800000 }, { year: '2023', amount: 2500000 },
  { year: '2024', amount: 3200000 }, { year: '2025', amount: 4800000 }, { year: '2026', amount: 6000000 },
];

export default function AlumniDonations() {
  const totalDonations = alumniDonations.reduce((s, d) => s + d.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fundraising & Donations</h1>
            <p className="text-muted-foreground">Track donations, issue receipts, and manage fundraising campaigns</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Record Donation</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Donor (Alumni)</Label><Input placeholder="Search alumni" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Amount (₹)</Label><Input type="number" /></div>
                    <div><Label>Payment Method</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank">Bank Transfer</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="cash">Cash</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Purpose</Label><Input placeholder="e.g. AI Research Lab" /></div>
                  <div><Label>Campaign (optional)</Label><Input placeholder="e.g. Innovation Drive 2026" /></div>
                  <div><Label>Donation Type</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_time">One-time</SelectItem><SelectItem value="recurring">Recurring</SelectItem><SelectItem value="pledge">Pledge</SelectItem></SelectContent></Select></div>
                  <div><Label>Date</Label><Input type="date" /></div>
                  <Button className="w-full">Record & Issue Receipt</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><IndianRupee className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">₹{(totalDonations / 100000).toFixed(1)} L</p><p className="text-xs text-muted-foreground">Total (FY 2025-26)</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Gift className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">{alumniDonations.length + 18}</p><p className="text-xs text-muted-foreground">Total Donors</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><TrendingUp className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">+25%</p><p className="text-xs text-muted-foreground">YoY Growth</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><FileText className="h-8 w-8 text-blue-600" /><div><p className="text-2xl font-bold text-foreground">{alumniDonations.filter(d => d.receiptIssued).length}</p><p className="text-xs text-muted-foreground">Receipts Issued</p></div></CardContent></Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader><CardTitle>Donation Trend (₹)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={donationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donations table */}
        <Card>
          <CardHeader><CardTitle>Recent Donations</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Donor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Receipt</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {alumniDonations.map(d => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{d.alumniName}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{d.purpose}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{d.campaign || '–'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">₹{d.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{d.paymentMethod}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{d.donationDate.toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3"><Badge variant={d.receiptIssued ? 'default' : 'secondary'}>{d.receiptIssued ? 'Issued' : 'Pending'}</Badge></td>
                      <td className="px-4 py-3"><Button variant="outline" size="sm"><Eye className="mr-1 h-3 w-3" />View</Button></td>
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
