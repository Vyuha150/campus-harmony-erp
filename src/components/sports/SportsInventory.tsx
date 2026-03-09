import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus, Search, Download, AlertTriangle, IndianRupee, Filter } from 'lucide-react';
import { sportsInventory } from '@/data/sportsMockData';

export default function SportsInventory() {
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');

  const totalValue = sportsInventory.reduce((s, i) => s + i.totalValue, 0);
  const lowStock = sportsInventory.filter(i => i.availableQuantity < i.quantity * 0.3);
  const damaged = sportsInventory.filter(i => i.condition === 'poor' || i.condition === 'damaged');

  const filtered = sportsInventory.filter(i => {
    const matchSearch = i.itemName.toLowerCase().includes(search.toLowerCase());
    const matchSport = sportFilter === 'all' || i.sport.toLowerCase() === sportFilter.toLowerCase();
    return matchSearch && matchSport;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sports Inventory</h1>
            <p className="text-muted-foreground">Track equipment, uniforms, and supplies issued to teams</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Item Name</Label><Input placeholder="e.g. Cricket Bat (SG)" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Category</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equipment">Equipment</SelectItem><SelectItem value="uniform">Uniform</SelectItem><SelectItem value="accessory">Accessory</SelectItem><SelectItem value="safety">Safety Gear</SelectItem></SelectContent></Select></div>
                    <div><Label>Sport</Label><Input placeholder="e.g. Cricket" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Quantity</Label><Input type="number" /></div>
                    <div><Label>Unit Price (₹)</Label><Input type="number" /></div>
                    <div><Label>Condition</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="excellent">Excellent</SelectItem><SelectItem value="good">Good</SelectItem><SelectItem value="fair">Fair</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Storage Location</Label><Input placeholder="e.g. Sports Store Room" /></div>
                  <Button className="w-full">Add Item</Button>
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
                          <Button variant="outline" size="sm">Issue</Button>
                          <Button variant="outline" size="sm">Edit</Button>
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
