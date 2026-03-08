import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Download, Upload, CheckCircle, Clock, AlertTriangle, Award, BarChart3
} from 'lucide-react';
import { accreditationData } from '@/data/hodMockData';
import { useToast } from '@/hooks/use-toast';

export default function HODAccreditation() {
  const { toast } = useToast();

  const complete = accreditationData.filter(d => d.status === 'complete').length;
  const pending = accreditationData.filter(d => d.status === 'pending').length;
  const needsReview = accreditationData.filter(d => d.status === 'needs_review').length;
  const readiness = Math.round((complete / accreditationData.length) * 100);

  const criteria = [...new Set(accreditationData.map(d => d.criterion))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accreditation Data</h1>
            <p className="text-muted-foreground">NAAC/NIRF departmental data management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Upload className="mr-1 h-4 w-4" />Upload Document</Button>
            <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Export SSR</Button>
          </div>
        </div>

        {/* Readiness */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'NAAC Readiness', value: `${readiness}%`, icon: Award, color: 'text-green-600 bg-green-100' },
            { label: 'Data Complete', value: complete, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
            { label: 'Pending', value: pending, icon: Clock, color: 'text-amber-600 bg-amber-100' },
            { label: 'Needs Review', value: needsReview, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Department NAAC Readiness</CardTitle>
              <span className="text-sm text-muted-foreground">{readiness}% complete</span>
            </div>
            <Progress value={readiness} className="h-2 mt-2" />
          </CardHeader>
        </Card>

        {/* By Criterion */}
        <div className="space-y-4">
          {criteria.map(criterion => {
            const items = accreditationData.filter(d => d.criterion === criterion);
            return (
              <Card key={criterion} className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {criterion}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Updated By</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-foreground">{item.metric}</TableCell>
                          <TableCell className="font-bold">{item.value}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.year}</TableCell>
                          <TableCell>
                            <Badge variant={
                              item.status === 'complete' ? 'default' :
                              item.status === 'needs_review' ? 'destructive' : 'secondary'
                            } className="capitalize text-[10px]">
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.lastUpdated}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.updatedBy}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => toast({ title: 'Data Verified', description: `${item.metric} verified by HOD` })}>
                              Verify
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
