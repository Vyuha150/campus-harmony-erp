import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp, TrendingDown, Lightbulb, Calculator, BarChart3,
  ArrowRight, Settings, Play, Info, Download, Save
} from 'lucide-react';
import { deleteApi, fetchApi, postApi } from '@/lib/apiService';
import { PolicyScenario } from '@/types/vc';

const impactColors = { positive: 'text-emerald-600 bg-emerald-50', negative: 'text-red-600 bg-red-50', neutral: 'text-amber-600 bg-amber-50' };

export default function VCPolicyPlanning() {
  const [policyScenarios, setPolicyScenarios] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/vc/policyscenarios').then(d => setPolicyScenarios(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<PolicyScenario | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>('academic');

  // Financial forecasting state
  const [feeIncrease, setFeeIncrease] = useState(10);
  const [enrollmentChange, setEnrollmentChange] = useState(5);
  const [grantGrowth, setGrantGrowth] = useState(20);
  const [forecastCalculated, setForecastCalculated] = useState(false);

  const baseTuition = 9500; // lakhs
  const baseGrants = 1000;
  const baseExpenditure = 14800;

  const projectedTuition = Math.round(baseTuition * (1 + feeIncrease / 100) * (1 + enrollmentChange / 100));
  const projectedGrants = Math.round(baseGrants * (1 + grantGrowth / 100));
  const projectedRevenue = projectedTuition + projectedGrants + 2500 + 1800 + 500 + 600; // other sources constant
  const projectedExpenditure = Math.round(baseExpenditure * 1.08); // 8% cost increase
  const projectedSurplus = projectedRevenue - projectedExpenditure;
  const revenueChange = ((projectedRevenue - 15900) / 15900 * 100).toFixed(1);

  useEffect(() => {
    setScenarios((policyScenarios || []).map((scenario: any) => ({
      ...scenario,
      parameters: Array.isArray(scenario.parameters) ? scenario.parameters : [],
    })));
  }, [policyScenarios]);

  const handleRunSimulation = (scenario: PolicyScenario) => {
    setSelectedScenario(scenario);
  };

  const handleCreateScenario = async () => {
    if (!newTitle) return;
    try {
      const created = await postApi<PolicyScenario>('/vc/policyscenarios', {
        title: newTitle,
        description: newDescription,
        category: newCategory,
        parameters: [{ label: 'Parameter 1', currentValue: 0, proposedValue: 0, unit: '' }],
      });
      setScenarios(prev => [...prev, { ...created, parameters: Array.isArray(created.parameters) ? created.parameters : [] }]);
      setShowCreateDialog(false);
      setNewTitle('');
      setNewDescription('');
      toast({ title: 'Scenario Created', description: `"${newTitle}" added to planning scenarios.` });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error.message || 'Could not create scenario.', variant: 'destructive' });
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await deleteApi(`/vc/policyscenarios/${id}`);
      setScenarios(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Deleted', description: 'Scenario removed.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message || 'Could not remove scenario.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Policy & Planning</h1>
            <p className="text-muted-foreground">Scenario modeling, enrollment projections, and impact analysis</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Lightbulb className="h-4 w-4" /> New Scenario
          </Button>
        </div>

        <Tabs defaultValue="scenarios">
          <TabsList>
            <TabsTrigger value="scenarios">Scenario Models</TabsTrigger>
            <TabsTrigger value="enrollment">Enrollment Projections</TabsTrigger>
            <TabsTrigger value="financial">Financial Forecasting</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {scenarios.map(scenario => (
                <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{scenario.title}</CardTitle>
                      <Badge variant="outline" className={`text-[10px] ${impactColors[scenario.impact]}`}>
                        {scenario.impact === 'positive' ? <TrendingUp className="h-3 w-3 mr-1" /> : scenario.impact === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                        {scenario.impact}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{scenario.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-3">
                      {scenario.parameters.map((param, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Settings className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{param.label}:</span>
                          <span className="font-medium">{param.currentValue}{param.unit}</span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-medium text-primary">{param.proposedValue}{param.unit}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 mb-3">
                      <p className="text-xs text-muted-foreground flex gap-1"><Info className="h-3 w-3 shrink-0 mt-0.5" /> {scenario.projectedOutcome}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleRunSimulation(scenario)}>
                        <Play className="h-3 w-3" /> Run Simulation
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => handleDeleteScenario(scenario.id)}>
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="enrollment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Enrollment Trends & Projections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { year: '2024-25', total: 12200, growth: '+6.2%' },
                    { year: '2025-26', total: 13900, growth: '+8.2%' },
                    { year: '2026-27 (Projected)', total: 15100, growth: '+8.6%' },
                  ].map(item => (
                    <div key={item.year} className="rounded-lg border p-4 text-center">
                      <p className="text-sm text-muted-foreground">{item.year}</p>
                      <p className="text-2xl font-bold mt-1">{item.total.toLocaleString()}</p>
                      <p className="text-sm text-emerald-600 flex items-center justify-center gap-1 mt-1">
                        <TrendingUp className="h-3.5 w-3.5" /> {item.growth}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium text-sm mb-3">Program-wise Demand</h4>
                    {[
                      { program: 'B.Tech CSE', demand: 95 },
                      { program: 'B.Tech AI/ML', demand: 92 },
                      { program: 'MBA', demand: 88 },
                      { program: 'B.Tech ECE', demand: 78 },
                      { program: 'M.Sc Data Science', demand: 85 },
                    ].map(p => (
                      <div key={p.program} className="flex items-center justify-between py-1.5 text-sm">
                        <span>{p.program}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: `${p.demand}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{p.demand}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium text-sm mb-3">Intake Capacity Planning</h4>
                    {[
                      { item: 'Total Seats Available', value: '15,000' },
                      { item: 'Applications Expected', value: '45,000+' },
                      { item: 'Competition Ratio', value: '1:3' },
                      { item: 'New Sections Needed', value: '12' },
                      { item: 'Faculty Hiring Required', value: '18' },
                    ].map(row => (
                      <div key={row.item} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                        <span className="text-muted-foreground">{row.item}</span>
                        <span className="font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Financial Forecasting</CardTitle>
                <CardDescription>Adjust parameters to see projected financial impact for FY 2026-27</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Interactive Sliders */}
                <div className="rounded-lg border p-4 mb-6 space-y-5">
                  <h4 className="font-medium text-sm">Revenue Scenario Calculator</h4>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">Fee Increase</Label>
                      <span className="text-sm font-bold text-primary">{feeIncrease}%</span>
                    </div>
                    <Slider value={[feeIncrease]} onValueChange={v => { setFeeIncrease(v[0]); setForecastCalculated(false); }} min={0} max={25} step={1} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">Enrollment Change</Label>
                      <span className="text-sm font-bold text-primary">{enrollmentChange > 0 ? '+' : ''}{enrollmentChange}%</span>
                    </div>
                    <Slider value={[enrollmentChange]} onValueChange={v => { setEnrollmentChange(v[0]); setForecastCalculated(false); }} min={-10} max={20} step={1} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">Research Grant Growth</Label>
                      <span className="text-sm font-bold text-primary">{grantGrowth}%</span>
                    </div>
                    <Slider value={[grantGrowth]} onValueChange={v => { setGrantGrowth(v[0]); setForecastCalculated(false); }} min={0} max={50} step={1} />
                  </div>
                  <Button className="gap-2" onClick={() => setForecastCalculated(true)}>
                    <Calculator className="h-4 w-4" /> Calculate Projection
                  </Button>
                </div>

                {/* Results */}
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  {[
                    { label: 'Projected Revenue FY27', value: `₹${(projectedRevenue / 100).toFixed(0)} Cr`, change: `${Number(revenueChange) > 0 ? '+' : ''}${revenueChange}%`, positive: Number(revenueChange) > 0 },
                    { label: 'Projected Expenditure FY27', value: `₹${(projectedExpenditure / 100).toFixed(0)} Cr`, change: '+8.0%', positive: false },
                    { label: 'Projected Surplus', value: `₹${(projectedSurplus / 100).toFixed(1)} Cr`, change: projectedSurplus > 0 ? 'Healthy' : 'Deficit', positive: projectedSurplus > 0 },
                  ].map(item => (
                    <div key={item.label} className={`rounded-lg border p-4 text-center ${forecastCalculated ? 'ring-2 ring-primary/30' : ''}`}>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xl font-bold mt-1">{item.value}</p>
                      <p className={`text-xs mt-1 ${item.positive ? 'text-emerald-600' : 'text-amber-600'}`}>{item.change}</p>
                    </div>
                  ))}
                </div>

                {forecastCalculated && (
                  <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Detailed Breakdown</h4>
                    {[
                      { source: 'Tuition Fees', current: baseTuition, projected: projectedTuition },
                      { source: 'Research Grants', current: baseGrants, projected: projectedGrants },
                      { source: 'Government Grants', current: 2500, projected: 2500 },
                      { source: 'Self-Financed Courses', current: 1800, projected: 1800 },
                      { source: 'Other Income', current: 1100, projected: 1100 },
                    ].map(row => (
                      <div key={row.source} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">{row.source}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">₹{row.current}L</span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-medium">₹{row.projected}L</span>
                          <Badge variant={row.projected > row.current ? 'default' : 'secondary'} className="text-[10px]">
                            {row.projected > row.current ? '+' : ''}{((row.projected - row.current) / row.current * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => toast({ title: 'Report Saved', description: 'Financial projection saved to documents.' })}>
                        <Save className="h-3 w-3" /> Save Report
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => toast({ title: 'Exported', description: 'Financial projection exported as PDF.' })}>
                        <Download className="h-3 w-3" /> Export PDF
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Simulation Result Dialog */}
        <Dialog open={!!selectedScenario} onOpenChange={() => setSelectedScenario(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Simulation Results: {selectedScenario?.title}</DialogTitle>
              <DialogDescription>{selectedScenario?.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="font-medium text-sm mb-2">Parameters</h4>
                {selectedScenario?.parameters.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span>{p.currentValue}{p.unit} → <strong className="text-primary">{p.proposedValue}{p.unit}</strong></span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <h4 className="font-medium text-sm mb-1 flex items-center gap-1"><Lightbulb className="h-4 w-4 text-primary" /> Projected Outcome</h4>
                <p className="text-sm">{selectedScenario?.projectedOutcome}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${impactColors[selectedScenario?.impact || 'neutral']}`}>
                  Overall Impact: {selectedScenario?.impact}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedScenario(null)}>Close</Button>
              <Button onClick={() => { toast({ title: 'Report Saved', description: 'Simulation report saved to your documents.' }); setSelectedScenario(null); }}>Save Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Scenario Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Scenario</DialogTitle>
              <DialogDescription>Define a what-if scenario for policy analysis</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Impact of new hostel fee" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Describe the scenario..." rows={2} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrollment">Enrollment</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateScenario}>Create Scenario</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
