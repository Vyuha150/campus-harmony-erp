import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, Plus, CheckCircle2, Truck, FileText, Clock, Package, Users } from 'lucide-react';
import { purchaseOrders, vendors } from '@/data/financeMockData';

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const statusColor = (s: string) => s === 'paid' ? 'default' : s === 'delivered' ? 'default' : s === 'pending' ? 'secondary' : 'outline';

export default function Procurement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Procurement & Payments</h1>
            <p className="text-muted-foreground">Purchase orders, vendor management, and payment tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" />Vendors</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Purchase Order</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active POs</p><p className="text-2xl font-bold text-foreground">12</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Approval</p><p className="text-2xl font-bold text-amber-600">4</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Awaiting Delivery</p><p className="text-2xl font-bold text-foreground">6</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Payments Due</p><p className="text-2xl font-bold text-destructive">₹52.3 L</p></CardContent></Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Directory</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search POs..." className="pl-10" /></div>
              <Select defaultValue="all"><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="delivered">Delivered</SelectItem></SelectContent></Select>
            </div>

            {purchaseOrders.map((po) => (
              <Card key={po.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" /> {po.poNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{po.department} • {po.vendor.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{formatCurrency(po.totalAmount)}</span>
                    <Badge variant={statusColor(po.status)} className="capitalize">{po.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="py-1.5 text-left text-xs text-muted-foreground">Item</th><th className="py-1.5 text-right text-xs text-muted-foreground">Qty</th><th className="py-1.5 text-right text-xs text-muted-foreground">Unit Price</th><th className="py-1.5 text-right text-xs text-muted-foreground">Total</th></tr></thead>
                    <tbody>
                      {po.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-1.5 text-foreground">{item.description}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-1.5 text-right font-medium text-foreground">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex gap-4">
                      <span>Ordered: {po.orderDate.toLocaleDateString('en-IN')}</span>
                      <span>Expected: {po.expectedDelivery.toLocaleDateString('en-IN')}</span>
                      {po.deliveredDate && <span>Delivered: {po.deliveredDate.toLocaleDateString('en-IN')}</span>}
                    </div>
                    <div className="flex gap-2">
                      {po.status === 'pending' && <><Button variant="outline" size="sm">Reject</Button><Button size="sm">Approve</Button></>}
                      {po.status === 'approved' && <Button size="sm" variant="outline"><Truck className="mr-1 h-3 w-3" />Mark Delivered</Button>}
                      {po.status === 'delivered' && <Button size="sm"><FileText className="mr-1 h-3 w-3" />Record Invoice</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="vendors">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">GST No.</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Terms</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{v.name}</p><p className="text-xs text-muted-foreground">{v.address}</p></td>
                        <td className="px-4 py-3"><p className="text-sm text-foreground">{v.contactPerson}</p><p className="text-xs text-muted-foreground">{v.email}</p></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{v.gstNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{v.paymentTerms}</td>
                        <td className="px-4 py-3"><Badge variant={v.status === 'active' ? 'default' : 'destructive'} className="capitalize">{v.status}</Badge></td>
                        <td className="px-4 py-3"><Button variant="ghost" size="sm">View Ledger</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">Invoice Management</h3>
              <p className="text-sm text-muted-foreground">Record vendor invoices, schedule payments, and track dues</p>
              <Button className="mt-4"><Plus className="mr-2 h-4 w-4" />Record Invoice</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}