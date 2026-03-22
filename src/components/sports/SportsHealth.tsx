import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Plus, Activity, UserCheck, Stethoscope, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteApi, fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

type FitnessRecord = {
  id: string;
  studentId: string;
  testDate: string;
  testType: string;
  results?: unknown;
  overallGrade?: string | null;
  recommendations?: string | null;
  restrictions?: string | null;
  conductedBy: string;
};

export default function SportsHealth() {
  const [records, setRecords] = useState<FitnessRecord[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    testType: 'fitness_assessment',
    testDate: new Date().toISOString().slice(0, 10),
    overallGrade: 'B',
    resultsText: '',
    recommendations: '',
    restrictions: ''
  });

  const loadHealthRecords = async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi<FitnessRecord[]>('/sports/health');
      setRecords(data);
    } catch (error: any) {
      toast({ title: 'Failed to load records', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealthRecords();
  }, []);

  const addRecord = async () => {
    if (!form.studentId.trim()) {
      toast({ title: 'Student ID is required', description: 'Please provide a valid student ID.', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);
      await postApi('/sports/health/fitness-test', {
        studentId: form.studentId.trim(),
        testType: form.testType,
        testDate: form.testDate,
        overallGrade: form.overallGrade,
        results: { summary: form.resultsText.trim() || null },
        recommendations: form.recommendations.trim() || null,
        restrictions: form.restrictions.trim() || null
      });
      setIsCreateOpen(false);
      setForm({
        studentId: '',
        testType: 'fitness_assessment',
        testDate: new Date().toISOString().slice(0, 10),
        overallGrade: 'B',
        resultsText: '',
        recommendations: '',
        restrictions: ''
      });
      await loadHealthRecords();
      toast({ title: 'Record logged', description: 'Fitness record saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const medicallyCleared = records.filter((record) => String(record.overallGrade || '').toUpperCase() !== 'F').length;
  const atRisk = records.filter((record) => String(record.overallGrade || '').toUpperCase() === 'F').length;

  const deleteRecord = async (record: FitnessRecord) => {
    if (!window.confirm(`Delete fitness record for ${record.studentId}?`)) return;
    try {
      await deleteApi(`/sports/health/${record.id}`);
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
      toast({ title: 'Record deleted', description: 'Fitness record removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Health & Fitness Records</h1>
            <p className="text-muted-foreground">Track fitness tests and medical status via sports health APIs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadHealthRecords} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Log Record</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
                <DialogHeader><DialogTitle>Log Fitness Record</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2 max-h-[72vh] overflow-y-auto pr-1">
                  <div><Label>Student ID</Label><Input value={form.studentId} onChange={(event) => setForm((prev) => ({ ...prev, studentId: event.target.value }))} /></div>
                  <div>
                    <Label>Record Type</Label>
                    <Select value={form.testType} onValueChange={(value) => setForm((prev) => ({ ...prev, testType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fitness_assessment">Fitness Assessment</SelectItem>
                        <SelectItem value="beep_test">Beep Test</SelectItem>
                        <SelectItem value="strength_test">Strength Test</SelectItem>
                        <SelectItem value="medical_checkup">Medical Checkup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.testDate} onChange={(event) => setForm((prev) => ({ ...prev, testDate: event.target.value }))} /></div>
                  <div>
                    <Label>Grade</Label>
                    <Select value={form.overallGrade} onValueChange={(value) => setForm((prev) => ({ ...prev, overallGrade: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Results Summary</Label><Textarea value={form.resultsText} onChange={(event) => setForm((prev) => ({ ...prev, resultsText: event.target.value }))} /></div>
                  <div><Label>Recommendations</Label><Textarea value={form.recommendations} onChange={(event) => setForm((prev) => ({ ...prev, recommendations: event.target.value }))} /></div>
                  <div><Label>Restrictions</Label><Textarea value={form.restrictions} onChange={(event) => setForm((prev) => ({ ...prev, restrictions: event.target.value }))} /></div>
                  <Button onClick={addRecord} disabled={isLoading}>Save Record</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><Heart className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">{records.length}</p><p className="text-xs text-muted-foreground">Total Records</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">{medicallyCleared}</p><p className="text-xs text-muted-foreground">Medically Cleared</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Activity className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold text-foreground">{atRisk}</p><p className="text-xs text-muted-foreground">Needs Attention</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Stethoscope className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">{new Set(records.map((record) => record.studentId)).size}</p><p className="text-xs text-muted-foreground">Athletes Tracked</p></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Fitness Test Records</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Student ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Grade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Recommendations</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{record.studentId}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{record.testType}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(record.testDate).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3"><Badge variant={String(record.overallGrade || '').toUpperCase() === 'F' ? 'destructive' : 'default'}>{record.overallGrade || '-'}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{record.recommendations || '-'}</td>
                      <td className="px-4 py-3"><Button variant="destructive" size="sm" onClick={() => deleteRecord(record)}>Delete</Button></td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={6}>No health records available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
