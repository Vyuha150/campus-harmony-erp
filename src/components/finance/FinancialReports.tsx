import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileBarChart, FileText, BarChart3, PieChart, TrendingUp, Shield, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export default function FinancialReports() {
  const [reports, setReports] = useState<any>([]);
  const [fiscalYear, setFiscalYear] = useState('2025-26');
  const { toast } = useToast();
  const [reportSummary, setReportSummary] = useState<any>({
    reportsGenerated: 0,
    auditObservations: 0,
    pendingAuditResolutions: 0,
    lastAuditPeriod: '-',
    complianceScore: '0%',
  });

  useEffect(() => {
    fetchApi('/finance/reports/catalog').then(d => setReports(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/finance/reports/summary').then(d => setReportSummary(d)).catch((error) => { console.error('API request failed', error); });
  }, []);

  const getFiscalYearRange = (fy: string) => {
    const [startYearRaw, endYearRaw] = fy.split('-');
    const startYear = Number(startYearRaw);
    const endYearSuffix = Number(endYearRaw);
    if (Number.isNaN(startYear) || Number.isNaN(endYearSuffix)) {
      return {
        startDate: `${new Date().getFullYear()}-04-01`,
        endDate: `${new Date().getFullYear() + 1}-03-31`,
      };
    }

    const endYear = endYearSuffix < 100
      ? Math.floor(startYear / 100) * 100 + endYearSuffix
      : endYearSuffix;

    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  };

  const generateReport = async (type: string) => {
    try {
      const { startDate, endDate } = getFiscalYearRange(fiscalYear);
      await postApi('/finance/reports/generate', { type, startDate, endDate });
      toast({ title: 'Report request submitted', description: `${type} generated for ${fiscalYear}.` });
    } catch (error) {
      console.error('Failed to generate report', error);
      toast({ title: 'Generation failed', description: 'Could not generate report.', variant: 'destructive' });
    }
  };

  const iconMap: Record<string, any> = {
    FileBarChart,
    FileText,
    BarChart3,
    PieChart,
    TrendingUp,
    Shield,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Reports & Audits</h1>
            <p className="text-muted-foreground">Generate, view, and export financial reports for analysis and compliance</p>
          </div>
          <div className="flex gap-2">
            <Select value={fiscalYear} onValueChange={setFiscalYear}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025-26">FY 2025-26</SelectItem><SelectItem value="2024-25">FY 2024-25</SelectItem></SelectContent></Select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Reports Generated</p><p className="text-2xl font-bold text-foreground">{reportSummary.reportsGenerated}</p><p className="text-xs text-muted-foreground">This quarter</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Audit Observations</p><p className="text-2xl font-bold text-amber-600">{reportSummary.auditObservations}</p><p className="text-xs text-muted-foreground">{reportSummary.pendingAuditResolutions} pending resolution</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Last Audit</p><p className="text-2xl font-bold text-foreground">{reportSummary.lastAuditPeriod}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Compliance Score</p><p className="text-2xl font-bold text-green-600">{reportSummary.complianceScore}</p></CardContent></Card>
        </div>

        {/* Report Categories */}
        {['statements', 'analysis', 'operational', 'compliance', 'audit'].map((cat) => (
          <div key={cat}>
            <h2 className="mb-3 text-lg font-semibold capitalize text-foreground">{cat === 'statements' ? 'Financial Statements' : cat === 'analysis' ? 'Analysis Reports' : cat === 'operational' ? 'Operational Reports' : cat === 'compliance' ? 'Compliance & Regulatory' : 'Audit Reports'}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {reports.filter(r => r.category === cat).map((r) => (
                <Card key={r.title} className="cursor-pointer transition-colors hover:bg-muted/30">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        {(() => {
                          const Icon = iconMap[r.icon] || FileText;
                          return <Icon className="h-5 w-5 text-primary" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{r.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => generateReport(r.title)}><Printer className="mr-1 h-3 w-3" />Preview</Button>
                          <Button size="sm" onClick={() => generateReport(r.title)}><Download className="mr-1 h-3 w-3" />Export</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}