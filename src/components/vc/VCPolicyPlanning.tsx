import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp, TrendingDown, Lightbulb, Calculator, BarChart3,
  ArrowRight, Settings, Play, Info
} from 'lucide-react';
import { policyScenarios } from '@/data/vcMockData';
import { PolicyScenario } from '@/types/vc';

const impactColors = { positive: 'text-emerald-600 bg-emerald-50', negative: 'text-red-600 bg-red-50', neutral: 'text-amber-600 bg-amber-50' };

export default function VCPolicyPlanning() {
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState(policyScenarios);
  const [selectedScenario, setSelectedScenario] = useState<PolicyScenario | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>('academic');

  const handleRunSimulation = (scenario: PolicyScenario) => {
    setSelectedScenario(scenario);
  };

  const handleCreateScenario = () => {
    if (!newTitle) return;
    const newScenario: PolicyScenario = {
      id: `ps${scenarios.length + 1}`,
      title: newTitle,
      description: newDescription,
      category: newCategory as any,
      parameters: [{ label: 'Parameter 1', currentValue: 0, proposedValue: 0, unit: '' }],
      projectedOutcome: 'Run simulation to generate projections.',
      impact: 'neutral',
    };
    setScenarios(prev => [...prev, newScenario]);
    setShowCreateDialog(false);
    setNewTitle('');
    setNewDescription('');
    toast({ title: 'Scenario Created', description: `"${newTitle}" added to planning scenarios.` });
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
                    <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => handleRunSimulation(scenario)}>
                      <Play className="h-3 w-3" /> Run Simulation
                    </Button>
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
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  {[
                    { label: 'Projected Revenue FY27', value: '₹165 Cr', change: '+15.5%' },
                    { label: 'Projected Expenditure FY27', value: '₹148 Cr', change: '+10.2%' },
                    { label: 'Projected Surplus', value: '₹17 Cr', change: '+38%' },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xl font-bold mt-1">{item.value}</p>
                      <p className="text-xs text-emerald-600 mt-1">{item.change}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium text-sm mb-3">Revenue Scenario Calculator</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-xs">Fee Increase (%)</Label>
                      <Input type="number" defaultValue={10} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Enrollment Change (%)</Label>
                      <Input type="number" defaultValue={5} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Research Grant Growth (%)</Label>
                      <Input type="number" defaultValue={20} className="mt-1" />
                    </div>
                  </div>
                  <Button className="mt-4 gap-2" onClick={() => toast({ title: 'Simulation Complete', description: 'Projected net revenue increase: ₹12.4 Cr. See detailed breakdown below.' })}>
                    <Calculator className="h-4 w-4" /> Calculate Projection
                  </Button>
                </div>
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
