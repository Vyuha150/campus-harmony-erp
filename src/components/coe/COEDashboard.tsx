import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/apiService';
import { BarChart3, CheckCircle2, ClipboardList, Clock, Send } from 'lucide-react';

type COEStat = { label: string; value: string; icon?: string };
type SubmissionItem = {
  id: string;
  department: string;
  status: string;
  requestedAt: string;
  requestedByName: string;
};

type DashboardPayload = {
  stats: COEStat[];
  latestSubmissions: SubmissionItem[];
};

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export default function COEDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<COEStat[]>([]);
  const [latestSubmissions, setLatestSubmissions] = useState<SubmissionItem[]>([]);

  useEffect(() => {
    fetchApi<DashboardPayload>('/coe/dashboard')
      .then((data) => {
        setStats(Array.isArray(data?.stats) ? data.stats : []);
        setLatestSubmissions(Array.isArray(data?.latestSubmissions) ? data.latestSubmissions : []);
      })
      .catch((error) => {
        console.error('API request failed', error);
        setStats([]);
        setLatestSubmissions([]);
      });
  }, []);

  const pendingCount = useMemo(() => latestSubmissions.filter((item) => item.status === 'pending').length, [latestSubmissions]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">COE Dashboard</h1>
            <p className="text-muted-foreground">Controller of Examinations operations and publication workflow.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/coe/exam-oversight')}><ClipboardList className="mr-1 h-4 w-4" />Exam Oversight</Button>
            <Button onClick={() => navigate('/coe/results')}><Send className="mr-1 h-4 w-4" />Submit Results</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  {item.label.includes('Pending') ? <Clock className="h-5 w-5" /> : item.label.includes('Published') ? <CheckCircle2 className="h-5 w-5" /> : item.label.includes('Pipelines') ? <BarChart3 className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Latest Result Publication Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestSubmissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            {latestSubmissions.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.department}</p>
                  <p className="text-xs text-muted-foreground">Submitted by {item.requestedByName} on {formatDate(item.requestedAt)}</p>
                </div>
                <Badge variant={item.status === 'published' ? 'default' : item.status === 'pending' ? 'secondary' : 'outline'} className="capitalize">
                  {item.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
            <div className="pt-1 text-xs text-muted-foreground">Pending requests in queue: {pendingCount}</div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
