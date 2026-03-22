import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Send, Download, FileText, MapPin } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const formatDate = (value: unknown) => {
  if (!value) return '–';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleDateString('en-IN');
};

export default function AlumniProgression() {
  const { toast } = useToast();
  const [progressionMetrics, setProgressionMetrics] = useState<any>({
    totalAlumni: 0,
    employedCount: 0,
    topEmployers: [],
    averageSalary: 'N/A',
  });
  const [surveys, setSurveys] = useState<any[]>([]);

  const loadData = async () => {
    const [metrics, surveyRows] = await Promise.all([
      fetchApi('/alumni/progression/metrics'),
      fetchApi('/alumni/progression/surveys'),
    ]);
    setProgressionMetrics(metrics || {});
    setSurveys(Array.isArray(surveyRows) ? surveyRows : []);
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load progression data', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const pm = progressionMetrics;
  const employed = Number(pm.employedCount || 0);
  const total = Number(pm.totalAlumni || 0);
  const higherEducation = Math.max(total - employed, 0);
  const progressionPie = [
    { name: 'Employed', value: employed },
    { name: 'Other Outcomes', value: higherEducation },
  ];

  const handleLaunchSurvey = async () => {
    const currentYear = new Date().getFullYear();
    try {
      await postApi('/alumni/progression/surveys', {
        title: `Graduate Progression Survey ${currentYear}`,
        graduationYear: currentYear - 1,
        surveyPeriod: `${currentYear}-${currentYear + 1}`,
        questions: [],
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      await loadData();
      toast({ title: 'Survey launched', description: 'New progression survey created.' });
    } catch (error: any) {
      toast({ title: 'Launch failed', description: error?.message || 'Unable to launch survey.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Progression Data & Analytics</h1>
            <p className="text-muted-foreground">NAAC/NIRF progression metrics, surveys, and graduate outcome tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><Download className="mr-2 h-4 w-4" />Refresh</Button>
            <Button size="sm" onClick={handleLaunchSurvey}><Send className="mr-2 h-4 w-4" />Launch Survey</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{total}</p><p className="text-xs text-muted-foreground">Tracked Alumni</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{employed}</p><p className="text-xs text-muted-foreground">Employed</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{higherEducation}</p><p className="text-xs text-muted-foreground">Other Outcomes</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{pm.averageSalary || 'N/A'}</p><p className="text-xs text-muted-foreground">Average Salary</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{surveys.length}</p><p className="text-xs text-muted-foreground">Surveys</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Graduate Outcomes Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={progressionPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {progressionPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Employers</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Array.isArray(pm.topEmployers) ? pm.topEmployers : []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Progression Surveys</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {surveys.map((s) => {
              const responses = Array.isArray(s.responses) ? s.responses.length : Number(s.responses || 0);
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground">Graduation Year: {s.graduationYear} • Period: {s.surveyPeriod}</p>
                      <p className="text-xs text-muted-foreground">Window: {formatDate(s.startDate)} to {formatDate(s.endDate)} • Responses: {responses}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="capitalize">{s.status}</Badge>
                      <Button variant="outline" size="sm"><FileText className="mr-1 h-3 w-3" />Report</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Geographic Coverage</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-4 w-4" />Detailed geographic breakup is not currently provided by this API module.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
