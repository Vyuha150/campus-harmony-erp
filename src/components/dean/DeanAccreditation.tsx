import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Award, TrendingUp, TrendingDown, Minus, Download, Upload,
  CheckCircle, AlertTriangle, Target, FileText, Edit
} from 'lucide-react';
import { qualityMetrics as initialMetrics } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';
import { QualityMetric } from '@/types/dean';

export default function DeanAccreditation() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<QualityMetric[]>(initialMetrics);
  const [editMetric, setEditMetric] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [verified, setVerified] = useState<Set<string>>(new Set());

  const onTrack = metrics.filter(m => m.status === 'on_track').length;
  const atRisk = metrics.filter(m => m.status === 'at_risk').length;
  const behind = metrics.filter(m => m.status === 'behind').length;
  const readiness = Math.round((onTrack / metrics.length) * 100);

  const trendIcon = (t: string) => t === 'up' ? <TrendingUp className="h-4 w-4 text-green-600" /> : t === 'down' ? <TrendingDown className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4 text-muted-foreground" />;

  const grouped = {
    naac: metrics.filter(m => m.category === 'naac'),
    nirf: metrics.filter(m => m.category === 'nirf'),
    internal: metrics.filter(m => m.category === 'internal'),
  };

  const verifyMetric = (id: string) => {
    setVerified(prev => new Set(prev).add(id));
    toast({ title: 'Metric Verified', description: metrics.find(m => m.id === id)?.metric });
  };

  const saveEdit = () => {
    if (!editMetric) return;
    setMetrics(prev => prev.map(m => m.id === editMetric ? { ...m, currentValue: editValue || m.currentValue } : m));
    toast({ title: 'Metric Updated', description: `${metrics.find(m => m.id === editMetric)?.metric} → ${editValue}` });
    setEditMetric(null);
    setEditValue('');
    setEditNotes('');
  };

  const currentEdit = metrics.find(m => m.id === editMetric);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accreditation & Reports</h1>
            <p className="text-muted-foreground">NAAC, NIRF, and institutional quality metrics</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast({ title: 'Upload SSR Section', description: 'File browser opened (simulated)' })}>
              <Upload className="mr-1 h-4 w-4" />Upload SSR Section
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: 'AQAR Generated', description: 'Annual Quality Assurance Report generated successfully' })}>
              <Download className="mr-1 h-4 w-4" />Generate AQAR
            </Button>
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
                      {verified.has(qm.id) && <CheckCircle className="h-3 w-3 text-green-600" />}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Previous: {qm.previousValue}</span>
                      <span>Target: {qm.target}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="text-lg font-bold text-foreground">{qm.currentValue}</p>
                      <Badge variant={qm.status === 'on_track' ? 'default' : qm.status === 'at_risk' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">
                        {qm.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditMetric(qm.id); setEditValue(qm.currentValue); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      {!verified.has(qm.id) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => verifyMetric(qm.id)}>
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editMetric} onOpenChange={() => { setEditMetric(null); setEditValue(''); setEditNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Metric: {currentEdit?.metric}</DialogTitle>
            <DialogDescription>Update the current value for this metric.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Value</Label>
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editValue} onChange={e => setEditValue(e.target.value)} />
            </div>
            <div><Label>Notes / Justification</Label><Textarea placeholder="Optional notes..." value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditMetric(null); setEditValue(''); setEditNotes(''); }}>Cancel</Button>
              <Button onClick={saveEdit}><CheckCircle className="mr-1 h-4 w-4" />Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
