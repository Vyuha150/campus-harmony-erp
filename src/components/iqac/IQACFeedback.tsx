import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Star, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { useState, useEffect } from 'react';
import { fetchIQACFeedbackSummaries } from '@/lib/iqacApi';
import { useToast } from '@/hooks/use-toast';

export default function IQACFeedback() {
  const { toast } = useToast();
  const [feedbackSummaries, setFeedbackSummaries] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    const loadFeedback = async () => {
      try {
        setApiLoading(true);
        const data = await fetchIQACFeedbackSummaries();
        setFeedbackSummaries(data);
      } catch (error: any) {
        toast({ title: 'Unable to load feedback analytics', description: error?.message || 'Please try again.', variant: 'destructive' });
      } finally {
        setApiLoading(false);
      }
    };
    loadFeedback();
  }, []);

  const avgRating = feedbackSummaries.length > 0
    ? (feedbackSummaries.reduce((a, b) => a + b.averageRating, 0) / feedbackSummaries.length).toFixed(1)
    : '0.0';
  const totalRespondents = feedbackSummaries.reduce((a, b) => a + b.respondents, 0);

  const barData = feedbackSummaries.map(f => ({
    name: f.type.charAt(0).toUpperCase() + f.type.slice(1),
    rating: f.averageRating,
    respondents: f.respondents,
  }));

  const radarData = [
    {
      subject: 'Overall Quality',
      ...Object.fromEntries(feedbackSummaries.map((item) => [item.type, item.averageRating]))
    },
    {
      subject: 'Participation',
      ...Object.fromEntries(feedbackSummaries.map((item) => [item.type, Math.min(5, Number((item.respondents / 100).toFixed(1)))]))
    },
    {
      subject: 'Satisfaction',
      ...Object.fromEntries(feedbackSummaries.map((item) => [item.type, item.averageRating]))
    }
  ];

  const handleExport = () => {
    if (feedbackSummaries.length === 0) {
      toast({ title: 'No data to export', description: 'Feedback summaries are empty.', variant: 'destructive' });
      return;
    }

    const headers = ['type', 'respondents', 'averageRating', 'satisfactionLevel', 'lastCollected'];
    const rows = feedbackSummaries.map((item) => [
      item.type,
      item.respondents,
      item.averageRating,
      item.satisfactionLevel,
      new Date(item.lastCollected).toISOString()
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iqac-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSatisfactionColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-600';
      case 'very_good': return 'text-blue-600';
      case 'good': return 'text-amber-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Feedback Analysis</h1>
            <p className="text-muted-foreground">Comprehensive feedback from students, alumni, employers, and faculty</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export Report</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Raw Data</Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold text-foreground">{avgRating}/5</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Respondents</p>
                <p className="text-2xl font-bold text-foreground">{totalRespondents.toLocaleString()}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Highest Rated</p>
                <p className="text-2xl font-bold text-foreground capitalize">
                  {feedbackSummaries.length > 0
                    ? feedbackSummaries.reduce((a, b) => a.averageRating > b.averageRating ? a : b).type
                    : 'n/a'}
                </p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Feedback Types</p>
                <p className="text-2xl font-bold text-foreground">{feedbackSummaries.length}</p>
              </div>
            </div>
          </CardContent></Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Ratings by Stakeholder</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 5]} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="rating" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Multi-Dimensional Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis dataKey="subject" className="text-xs" />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} />
                  {feedbackSummaries.map((series, index) => (
                    <Radar
                      key={series.type}
                      name={series.type.charAt(0).toUpperCase() + series.type.slice(1)}
                      dataKey={series.type}
                      stroke={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(210, 70%, 50%)' : 'hsl(150, 60%, 40%)'}
                      fill={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(210, 70%, 50%)' : 'hsl(150, 60%, 40%)'}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {!apiLoading && feedbackSummaries.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No feedback summaries available.</CardContent>
          </Card>
        )}

        {/* Detailed Feedback Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {feedbackSummaries.map((f) => (
            <Card key={f.type}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize text-foreground">{f.type} Feedback</h3>
                  <Badge className={`capitalize ${getSatisfactionColor(f.satisfactionLevel)}`}>{f.satisfactionLevel.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <p className="text-3xl font-bold text-primary">{f.averageRating}</p>
                  <span className="text-muted-foreground">/5</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{f.respondents.toLocaleString()} respondents</p>
                <p className="text-xs text-muted-foreground mb-3">Last collected: {f.lastCollected.toLocaleDateString('en-IN')}</p>

                <Progress value={(f.averageRating / 5) * 100} className="h-2 mb-4" />

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">✅ Key Findings</p>
                    {f.keyFindings.map((k, i) => <p key={i} className="text-xs text-foreground">• {k}</p>)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">🔧 Improvement Areas</p>
                    {f.improvementAreas.map((a, i) => <p key={i} className="text-xs text-foreground">• {a}</p>)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
