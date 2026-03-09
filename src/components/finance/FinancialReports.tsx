import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileBarChart, FileText, BarChart3, PieChart, TrendingUp, Shield, Printer } from 'lucide-react';

export default function FinancialReports() {
  const reports = [
    { title: 'Balance Sheet', icon: FileText, desc: 'Assets, liabilities, and fund position', category: 'statements' },
    { title: 'Income & Expenditure', icon: BarChart3, desc: 'Revenue, expenses, and surplus/deficit', category: 'statements' },
    { title: 'Cash Flow Statement', icon: TrendingUp, desc: 'Operating, investing, financing flows', category: 'statements' },
    { title: 'Budget vs Actual', icon: FileBarChart, desc: 'Department-wise budget utilization analysis', category: 'analysis' },
    { title: 'Fee Collection Report', icon: PieChart, desc: 'Program-wise fee collection and defaults', category: 'operational' },
    { title: 'Vendor Payment Summary', icon: FileText, desc: 'Payments made to vendors with aging', category: 'operational' },
    { title: 'Payroll Summary', icon: FileText, desc: 'Monthly payroll cost by department', category: 'operational' },
    { title: 'NAAC Financial Data', icon: Shield, desc: 'Infrastructure & library expenditure for NAAC', category: 'compliance' },
    { title: 'NIRF Financial Metrics', icon: Shield, desc: 'Per-student expenditure, capex data for NIRF', category: 'compliance' },
    { title: 'Audit Trail Report', icon: Shield, desc: 'All transaction approvals and modifications', category: 'audit' },
    { title: 'Tax Compliance Report', icon: FileText, desc: 'TDS, GST, and professional tax summaries', category: 'compliance' },
    { title: 'Expenditure by Category', icon: PieChart, desc: 'Detailed breakdown by expense heads', category: 'analysis' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Reports & Audits</h1>
            <p className="text-muted-foreground">Generate, view, and export financial reports for analysis and compliance</p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="2025-26"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025-26">FY 2025-26</SelectItem><SelectItem value="2024-25">FY 2024-25</SelectItem></SelectContent></Select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Reports Generated</p><p className="text-2xl font-bold text-foreground">42</p><p className="text-xs text-muted-foreground">This quarter</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Audit Observations</p><p className="text-2xl font-bold text-amber-600">5</p><p className="text-xs text-muted-foreground">2 pending resolution</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Last Audit</p><p className="text-2xl font-bold text-foreground">Jan 2026</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Compliance Score</p><p className="text-2xl font-bold text-green-600">94%</p></CardContent></Card>
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
                        <r.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{r.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline"><Printer className="mr-1 h-3 w-3" />Preview</Button>
                          <Button size="sm"><Download className="mr-1 h-3 w-3" />Export</Button>
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