import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus, Search, Download, AlertTriangle, IndianRupee, Filter } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

export default function SportsInventory() {
  const [sportsInventory, setSportsInventory] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [form, setForm] = useState({
    itemName: '',
    category: 'equipment',
    sport: '',
    quantity: '1',
    unitPrice: '0',
    condition: 'good',
    location: ''
  });

  const loadInventory = async () => {
    try {
      const data = await fetchApi('/sports/inventory');
      setSportsInventory(data);
    } catch (error) {
      console.error('API request failed', error);
      toast({ title: 'Failed to load inventory', description: String((error as any)?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      _setApiLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');

  const totalValue = sportsInventory.reduce((s, i) => s + Number(i.totalValue || 0), 0);
  const lowStock = sportsInventory.filter(i => i.availableQuantity < i.quantity * 0.3);
  const damaged = sportsInventory.filter(i => i.condition === 'poor' || i.condition === 'damaged');

  const filtered = sportsInventory.filter(i => {
    const matchSearch = i.itemName.toLowerCase().includes(search.toLowerCase());
    const matchSport = sportFilter === 'all' || i.sport.toLowerCase() === sportFilter.toLowerCase();
    return matchSearch && matchSport;
  });

  const addItem = async () => {
    if (!form.itemName.trim() || !form.sport.trim() || !form.location.trim()) {
      toast({ title: 'Missing fields', description: 'Item name, sport, and location are required.', variant: 'destructive' });
      return;
    }
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);
    try {
      await postApi('/sports/inventory', {
        itemName: form.itemName.trim(),
        category: form.category,
        sport: form.sport.trim(),
        quantity,
        availableQuantity: quantity,
        unitPrice,
        totalValue: quantity * unitPrice,
        condition: form.condition,
        location: form.location.trim()
      });
      setForm({ itemName: '', category: 'equipment', sport: '', quantity: '1', unitPrice: '0', condition: 'good', location: '' });
      await loadInventory();
      toast({ title: 'Item added', description: 'Inventory item created successfully.' });
    } catch (error: any) {
      toast({ title: 'Add failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const issueItem = async (item: any) => {
    if (Number(item.availableQuantity || 0) <= 0) return;
    try {
      const nextAvailable = Number(item.availableQuantity) - 1;
      await putApi(`/sports/inventory/${item.id}`, {
        itemName: item.itemName,
        category: item.category,
        sport: item.sport,
        brand: item.brand || null,
        quantity: Number(item.quantity),
        availableQuantity: nextAvailable,
        unitPrice: Number(item.unitPrice),
        totalValue: Number(item.totalValue),
        condition: item.condition,
        purchaseDate: item.purchaseDate || null,
        lastMaintenance: item.lastMaintenance || null,
        location: item.location
      });
      await loadInventory();
      toast({ title: 'Item issued', description: `${item.itemName} issued successfully.` });
    } catch (error: any) {
      toast({ title: 'Issue failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const exportInventory = () => {
    const rows = filtered.map((item: any) => ({
      itemName: item.itemName,
      sport: item.sport,
      category: item.category,
      quantity: item.quantity,
      availableQuantity: item.availableQuantity,
      condition: item.condition,
      location: item.location,
      totalValue: item.totalValue
    }));
    const header = ['itemName', 'sport', 'category', 'quantity', 'availableQuantity', 'condition', 'location', 'totalValue'];
    const csv = [
      header.join(','),
      ...rows.map((row) => header.map((key) => JSON.stringify((row as any)[key] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sports-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: 'Inventory data exported as CSV.' });
  };

  const deleteItem = async (item: any) => {
    if (!window.confirm(`Delete inventory item ${item.itemName}?`)) return;
    try {
      await deleteApi(`/sports/inventory/${item.id}`);
      setSportsInventory((prev: any[]) => prev.filter((entry) => entry.id !== item.id));
      toast({ title: 'Item deleted', description: 'Inventory item removed.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sports Inventory</h1>
            <p className="text-muted-foreground">Track equipment, uniforms, and supplies issued to teams</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportInventory}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Item Name</Label><Input placeholder="e.g. Cricket Bat (SG)" value={form.itemName} onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Category</Label><Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equipment">Equipment</SelectItem><SelectItem value="uniform">Uniform</SelectItem><SelectItem value="accessory">Accessory</SelectItem><SelectItem value="safety">Safety Gear</SelectItem></SelectContent></Select></div>
                    <div><Label>Sport</Label><Input placeholder="e.g. Cricket" value={form.sport} onChange={(e) => setForm((prev) => ({ ...prev, sport: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} /></div>
                    <div><Label>Unit Price (₹)</Label><Input type="number" value={form.unitPrice} onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))} /></div>
                    <div><Label>Condition</Label><Select value={form.condition} onValueChange={(value) => setForm((prev) => ({ ...prev, condition: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="excellent">Excellent</SelectItem><SelectItem value="good">Good</SelectItem><SelectItem value="fair">Fair</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Storage Location</Label><Input placeholder="e.g. Sports Store Room" value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} /></div>
                  <Button className="w-full" onClick={addItem}>Add Item</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{sportsInventory.length}</p><p className="text-xs text-muted-foreground">Total Items</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">₹{totalValue.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Total Value</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{lowStock.length}</p><p className="text-xs text-muted-foreground">Low Stock</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{damaged.length}</p><p className="text-xs text-muted-foreground">Needs Replacement</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search items..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-[160px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="cricket">Cricket</SelectItem>
              <SelectItem value="badminton">Badminton</SelectItem>
              <SelectItem value="football">Football</SelectItem>
              <SelectItem value="athletics">Athletics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Inventory table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sport</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Available</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Condition</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map(si => (
                    <tr key={si.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {si.availableQuantity < si.quantity * 0.3 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          <div><p className="text-sm font-medium text-foreground">{si.itemName}</p>{si.brand && <p className="text-xs text-muted-foreground">{si.brand}</p>}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{si.sport}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{si.category}</Badge></td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{si.quantity}</td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-foreground">{si.availableQuantity}</td>
                      <td className="px-4 py-3"><Badge variant={si.condition === 'excellent' || si.condition === 'good' ? 'default' : si.condition === 'fair' ? 'secondary' : 'destructive'} className="capitalize">{si.condition}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{si.location}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground">₹{si.totalValue.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => issueItem(si)} disabled={Number(si.availableQuantity || 0) <= 0}>Issue</Button>
                          <Button variant="outline" size="sm" onClick={loadInventory}>Refresh</Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteItem(si)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
