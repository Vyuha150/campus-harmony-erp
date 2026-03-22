import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, Plus, CheckCircle2, Truck, FileText, Clock, Package, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (amount: unknown) => `₹${toNumber(amount).toLocaleString('en-IN')}`;

const statusColor = (s: string) => s === 'paid' ? 'default' : s === 'delivered' ? 'default' : s === 'pending' ? 'secondary' : 'outline';

export default function Procurement() {
  const [purchaseOrders, setPurchaseOrders] = useState<any>([]);
  const [vendors, setVendors] = useState<any>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [_apiLoading, _setApiLoading] = useState(true);
  const { toast } = useToast();

  const loadProcurementData = async () => {
    const [orders, vendorList] = await Promise.all([
      fetchApi('/finance/purchase-orders'),
      fetchApi('/finance/vendors'),
    ]);
    setPurchaseOrders(orders);
    setVendors(vendorList);
  };

  useEffect(() => {
    loadProcurementData().catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const activePos = purchaseOrders.filter((po: any) => ['pending', 'approved', 'in_transit'].includes(String(po.status || '').toLowerCase())).length;
  const pendingApproval = purchaseOrders.filter((po: any) => String(po.status || '').toLowerCase() === 'pending').length;
  const awaitingDelivery = purchaseOrders.filter((po: any) => ['approved', 'in_transit'].includes(String(po.status || '').toLowerCase())).length;
  const paymentsDue = purchaseOrders
    .filter((po: any) => !['paid', 'closed'].includes(String(po.status || '').toLowerCase()))
    .reduce((sum: number, po: any) => sum + Number(po.totalAmount || 0), 0);

  const formatDate = (value: any) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN');
  };

  const toArray = (value: any) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const createPurchaseOrder = async () => {
    if (vendors.length === 0) {
      toast({ title: 'No vendors', description: 'Add at least one vendor before creating a PO.', variant: 'destructive' });
      return;
    }

    const vendorHint = vendors.map((vendor: any, index: number) => `${index + 1}. ${vendor.name}`).join('\n');
    const vendorIndex = Number(window.prompt(`Select vendor by number:\n${vendorHint}`, '1') || 1) - 1;
    const chosenVendor = vendors[vendorIndex] || vendors[0];
    const department = window.prompt('Department:', 'General Administration');
    if (!department) return;
    const itemDescription = window.prompt('Item description:', 'Office consumables');
    if (!itemDescription) return;
    const quantity = Number(window.prompt('Quantity:', '10') || 0);
    const unitPrice = Number(window.prompt('Unit price:', '7500') || 0);
    const expectedRaw = window.prompt('Expected delivery date (YYYY-MM-DD):', new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10));
    if (!expectedRaw) return;
    const expected = new Date(expectedRaw);
    if (Number.isNaN(expected.getTime()) || quantity <= 0 || unitPrice <= 0) {
      toast({ title: 'Invalid input', description: 'Provide valid quantity, unit price, and expected date.', variant: 'destructive' });
      return;
    }
    const totalAmount = quantity * unitPrice;

    try {
      await postApi<any>('/finance/purchase-orders', {
        department,
        vendorId: chosenVendor.id,
        expectedDelivery: expected,
        totalAmount,
        status: 'pending',
        items: [
          {
            id: `itm-${Date.now()}`,
            description: itemDescription,
            quantity,
            unitPrice,
            totalPrice: totalAmount,
          }
        ]
      });
      await loadProcurementData();
      toast({ title: 'PO created', description: 'New purchase order created successfully.' });
      setActiveTab('orders');
    } catch (error: any) {
      toast({ title: 'Create failed', description: error.message || 'Could not create purchase order.', variant: 'destructive' });
    }
  };

  const updateOrderStatus = async (id: string, payload: any) => {
    try {
      await putApi<any>(`/finance/purchase-orders/${id}`, payload);
      await loadProcurementData();
      toast({ title: 'Order updated', description: 'Purchase order status updated.' });
    } catch (error) {
      console.error('Failed to update purchase order', error);
      toast({ title: 'Update failed', description: 'Could not update purchase order.', variant: 'destructive' });
    }
  };

  const recordInvoice = async (po: any) => {
    const invoiceNumber = window.prompt('Invoice number:', String(po.invoiceNumber || `INV-${Date.now()}`));
    if (!invoiceNumber) return;

    const paymentDateRaw = window.prompt(
      'Payment date (YYYY-MM-DD):',
      po.paymentDate ? new Date(po.paymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    if (!paymentDateRaw) return;

    const paymentDate = new Date(paymentDateRaw);
    if (Number.isNaN(paymentDate.getTime())) {
      toast({ title: 'Invalid date', description: 'Provide a valid payment date.', variant: 'destructive' });
      return;
    }

    await updateOrderStatus(po.id, { status: 'paid', invoiceNumber, paymentDate });
  };

  const viewVendorLedger = (vendor: any) => {
    const poCount = Array.isArray(vendor.purchaseOrders) ? vendor.purchaseOrders.length : 0;
    toast({ title: vendor.name, description: `Recent purchase orders: ${poCount}` });
  };

  const filteredOrders = purchaseOrders.filter((po: any) => {
    const status = String(po.status || '').toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const vendorName = String(po.vendor?.name || '').toLowerCase();
    const poNumber = String(po.poNumber || '').toLowerCase();
    const department = String(po.department || '').toLowerCase();
    const matchesSearch = query.length === 0 || vendorName.includes(query) || poNumber.includes(query) || department.includes(query);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Procurement & Payments</h1>
            <p className="text-muted-foreground">Purchase orders, vendor management, and payment tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('vendors')}><Users className="mr-2 h-4 w-4" />Vendors</Button>
            <Button size="sm" onClick={createPurchaseOrder}><Plus className="mr-2 h-4 w-4" />New Purchase Order</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active POs</p><p className="text-2xl font-bold text-foreground">{activePos}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Approval</p><p className="text-2xl font-bold text-amber-600">{pendingApproval}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Awaiting Delivery</p><p className="text-2xl font-bold text-foreground">{awaitingDelivery}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Payments Due</p><p className="text-2xl font-bold text-destructive">{formatCurrency(paymentsDue)}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Directory</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search POs..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select>
            </div>

            {filteredOrders.map((po) => (
              <Card key={po.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" /> {po.poNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{po.department} • {po.vendor?.name || '-'}</p>
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
                      {toArray(po.items).map((item: any) => (
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
                      <span>Ordered: {formatDate(po.orderDate)}</span>
                      <span>Expected: {formatDate(po.expectedDelivery)}</span>
                      {po.deliveredDate && <span>Delivered: {formatDate(po.deliveredDate)}</span>}
                    </div>
                    <div className="flex gap-2">
                      {po.status === 'pending' && <><Button variant="outline" size="sm" onClick={() => updateOrderStatus(po.id, { status: 'rejected' })}>Reject</Button><Button size="sm" onClick={() => updateOrderStatus(po.id, { status: 'approved' })}>Approve</Button></>}
                      {po.status === 'approved' && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(po.id, { status: 'delivered', deliveredDate: new Date() })}><Truck className="mr-1 h-3 w-3" />Mark Delivered</Button>}
                      {po.status === 'delivered' && <Button size="sm" onClick={() => recordInvoice(po)}><FileText className="mr-1 h-3 w-3" />Record Invoice</Button>}
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
                        <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => viewVendorLedger(v)}>View Ledger</Button></td>
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
              <Button className="mt-4" onClick={() => setActiveTab('orders')}><Plus className="mr-2 h-4 w-4" />Record Invoice</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}