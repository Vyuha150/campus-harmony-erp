import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Award, TrendingUp, TrendingDown, Minus,
  CheckCircle, AlertTriangle, Target, FileText
} from 'lucide-react';
import { fetchApi } from '@/lib/apiService';
import { QualityMetric } from '@/types/dean';

export default function DeanAccreditation() {
  const [qualityMetrics, setQualityMetrics] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/dean/accreditation').then(d => setQualityMetrics(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [metrics, setMetrics] = useState<QualityMetric[]>([]);

  useEffect(() => {
    setMetrics(Array.isArray(qualityMetrics) ? qualityMetrics : []);
  }, [qualityMetrics]);

  const onTrack = metrics.filter(m => m.status === 'on_track').length;
  const atRisk = metrics.filter(m => m.status === 'at_risk').length;
  const behind = metrics.filter(m => m.status === 'behind').length;
  const readiness = metrics.length > 0 ? Math.round((onTrack / metrics.length) * 100) : 0;

  const trendIcon = (t: string) => t === 'up' ? <TrendingUp className="h-4 w-4 text-green-600" /> : t === 'down' ? <TrendingDown className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4 text-muted-foreground" />;

  const grouped = {
    naac: metrics.filter(m => m.category === 'naac'),
    nirf: metrics.filter(m => m.category === 'nirf'),
    internal: metrics.filter(m => m.category === 'internal'),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accreditation & Reports</h1>
            <p className="text-muted-foreground">NAAC, NIRF, and institutional quality metrics</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Overall Readiness', value: `${readiness}%`, icon: Award, color: 'text-green-600 bg-green-100' },
            { label: 'On Track', value: onTrack, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
            { label: 'At Risk', value: atRisk, icon: AlertTriangle, color: 'text-amber-600 bg-amber-100' },
            { label: 'Behind Target', value: behind, icon: Target, color: 'text-destructive bg-destructive/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Projected Accreditation Readiness</CardTitle>
              <span className="text-sm font-bold text-foreground">{readiness}%</span>
            </div>
            <Progress value={readiness} className="h-2 mt-1" />
          </CardHeader>
        </Card>

        {Object.entries(grouped).map(([category, catMetrics]) => (
          <Card key={category} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {category === 'naac' ? 'NAAC Metrics' : category === 'nirf' ? 'NIRF Indicators' : 'Internal KPIs'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catMetrics.map(qm => (
                <div key={qm.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{qm.metric}</p>
                      {trendIcon(qm.trend)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Category: {qm.category}</span>
                      <span>Target: {qm.target}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div>
                      <p className="text-lg font-bold text-foreground">{qm.currentValue}</p>
                      <Badge variant={qm.status === 'on_track' ? 'default' : qm.status === 'at_risk' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">
                        {qm.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
