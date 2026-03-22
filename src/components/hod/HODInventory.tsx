import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, Wrench, ShoppingCart, AlertTriangle,
  Plus, Download, Monitor, Pencil
} from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { LabInventoryItem, PurchaseRequest } from '@/types/hod';

export default function HODInventory() {
  const [labInventory, setLabInventory] = useState<any>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/hod/labinventory').then(d => setLabInventory(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/purchaserequests').then(d => setPurchaseRequests(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/facility-management').then(d => setFacilities(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [inventory, setInventory] = useState<LabInventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [showNewPR, setShowNewPR] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LabInventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<LabInventoryItem | null>(null);
  const [newPR, setNewPR] = useState({ itemName: '', lab: '', quantity: '1', cost: '', justification: '' });
  const [newItem, setNewItem] = useState({ name: '', lab: '', category: '', quantity: '1', workingCondition: '1', purchaseDate: '', warrantyExpiry: '', status: 'working' });

  useEffect(() => {
    setInventory(Array.isArray(labInventory) ? labInventory : []);
  }, [labInventory]);

  useEffect(() => {
    setPurchases(Array.isArray(purchaseRequests) ? purchaseRequests : []);
  }, [purchaseRequests]);

  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const workingUnits = inventory.reduce((sum, item) => sum + Number(item.workingCondition || 0), 0);
  const serviceItems = inventory.filter(i => i.status === 'faulty' || i.status === 'maintenance').length;
  const pendingPR = purchases.filter(p => p.status === 'pending').length;
  const labOptions = facilities
    .filter((facility) => String(facility.type || '').toLowerCase().includes('lab'))
    .map((facility) => facility.name);
  const fallbackLabs = [...new Set(inventory.map((item) => item.lab).filter(Boolean))];
  const availableLabs = labOptions.length > 0 ? labOptions : fallbackLabs;
  const labsCount = availableLabs.length;

  const toInputDate = (value?: string) => {
    if (!value || value === 'N/A') return '';

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString().slice(0, 10);
    }

    const ddmmyyyy = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    return '';
  };

  const handleCreatePR = async () => {
    if (!newPR.itemName || !newPR.lab || !newPR.cost) {
      toast({ title: 'Missing Fields', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi<any>('/hod/purchaserequests', {
        itemName: newPR.itemName,
        lab: newPR.lab,
        quantity: parseInt(newPR.quantity),
        estimatedCost: parseInt(newPR.cost),
        justification: newPR.justification,
      });
      const pr: PurchaseRequest = {
        id: created.id,
        itemName: created.itemName,
        lab: created.lab,
        requestedBy: created.requestedBy,
        quantity: created.quantity,
        estimatedCost: created.estimatedCost,
        justification: created.justification,
        status: created.status,
        requestDate: created.requestDate ? new Date(created.requestDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
      };
      setPurchases(prev => [pr, ...prev]);
      toast({ title: 'Purchase Request Created', description: `${newPR.itemName} – ₹${parseInt(newPR.cost).toLocaleString()}` });
      setShowNewPR(false);
      setNewPR({ itemName: '', lab: '', quantity: '1', cost: '', justification: '' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create purchase request', variant: 'destructive' });
    }
  };

  const handleMaintenanceRequest = async () => {
    if (selectedItem) {
      try {
        await putApi(`/hod/labinventory/${selectedItem.id}/maintenance`, {});
        setInventory(prev => prev.map(i => i.id === selectedItem.id ? { ...i, status: 'maintenance', lastMaintenance: new Date().toLocaleDateString('en-IN') } : i));
        toast({ title: '🔧 Maintenance Requested', description: `${selectedItem.name} sent for maintenance` });
        setShowMaintenance(false);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to request maintenance', variant: 'destructive' });
      }
    }
  };

  const handleCreateItem = async () => {
    if (!newItem.name || !newItem.lab || !newItem.category || !newItem.quantity) {
      toast({ title: 'Missing Fields', description: 'Name, lab, category and quantity are required', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi<any>('/hod/labinventory', {
        name: newItem.name,
        lab: newItem.lab,
        category: newItem.category,
        quantity: Number(newItem.quantity),
        workingCondition: Number(newItem.workingCondition || newItem.quantity),
        purchaseDate: newItem.purchaseDate || undefined,
        warrantyExpiry: newItem.warrantyExpiry || undefined,
        status: newItem.status,
      });

      setInventory((prev) => [
        {
          ...created,
          lastMaintenance: created.lastMaintenance ? new Date(created.lastMaintenance).toLocaleDateString('en-IN') : 'N/A',
          purchaseDate: created.purchaseDate ? new Date(created.purchaseDate).toLocaleDateString('en-IN') : 'N/A',
          warrantyExpiry: created.warrantyExpiry ? new Date(created.warrantyExpiry).toLocaleDateString('en-IN') : '',
        },
        ...prev,
      ]);
      setShowNewItem(false);
      setNewItem({ name: '', lab: '', category: '', quantity: '1', workingCondition: '1', purchaseDate: '', warrantyExpiry: '', status: 'working' });
      toast({ title: 'Inventory item added' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to add inventory item', variant: 'destructive' });
    }
  };

  const openEditInventoryItem = (item: LabInventoryItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      lab: item.lab,
      category: item.category,
      quantity: String(item.quantity),
      workingCondition: String(item.workingCondition),
      purchaseDate: toInputDate(item.purchaseDate),
      warrantyExpiry: toInputDate(item.warrantyExpiry),
      status: item.status,
    });
    setShowEditItem(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      const updated = await putApi<any>(`/hod/labinventory/${editingItem.id}`, {
        name: newItem.name,
        lab: newItem.lab,
        category: newItem.category,
        quantity: Number(newItem.quantity),
        workingCondition: Number(newItem.workingCondition),
        purchaseDate: newItem.purchaseDate || null,
        warrantyExpiry: newItem.warrantyExpiry || null,
        status: newItem.status,
      });

      setInventory((prev) => prev.map((item) => (item.id === editingItem.id
        ? {
            ...item,
            ...updated,
            lastMaintenance: updated.lastMaintenance ? new Date(updated.lastMaintenance).toLocaleDateString('en-IN') : item.lastMaintenance,
            purchaseDate: updated.purchaseDate ? new Date(updated.purchaseDate).toLocaleDateString('en-IN') : 'N/A',
            warrantyExpiry: updated.warrantyExpiry ? new Date(updated.warrantyExpiry).toLocaleDateString('en-IN') : '',
          }
        : item)));

      setShowEditItem(false);
      setEditingItem(null);
      toast({ title: 'Inventory item updated' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update inventory item', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    postApi('/hod/inventory/export', { format: 'csv' })
      .then(() => {
        toast({ title: '📥 Inventory Exported', description: 'Lab inventory report downloaded' });
      })
      .catch((error: any) => {
        toast({ title: 'Export failed', description: error?.message || 'Unable to export inventory', variant: 'destructive' });
      });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory & Lab Management</h1>
            <p className="text-muted-foreground">Manage lab equipment, maintenance, and purchases</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" />Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewItem(true)}>
              <Plus className="mr-1 h-4 w-4" />New Inventory Item
            </Button>
            <Button size="sm" onClick={() => setShowNewPR(true)}>
              <Plus className="mr-1 h-4 w-4" />New Purchase Request
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Units', value: totalUnits, icon: Package, color: 'text-blue-600 bg-blue-100' },
            { label: 'Working Units', value: workingUnits, icon: Monitor, color: 'text-green-600 bg-green-100' },
            { label: 'Items in Service', value: serviceItems, icon: Wrench, color: 'text-amber-600 bg-amber-100' },
            { label: 'Pending Purchases', value: pendingPR, icon: ShoppingCart, color: 'text-primary bg-primary/10' },
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

        <p className="text-xs text-muted-foreground">Labs linked from Facility Management: {labsCount}</p>

        <Tabs defaultValue="inventory">
          <TabsList>
            <TabsTrigger value="inventory">Lab Inventory</TabsTrigger>
            <TabsTrigger value="purchases">Purchase Requests ({purchases.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Lab</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center">Working</TableHead>
                      <TableHead>Last Maintenance</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                        <TableCell className="text-sm">{item.lab}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">
                          <span className={item.workingCondition < item.quantity ? 'text-amber-600 font-medium' : ''}>
                            {item.workingCondition}/{item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.lastMaintenance}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.warrantyExpiry || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.status === 'working' ? 'default' :
                            item.status === 'faulty' ? 'destructive' : 'secondary'
                          } className="capitalize text-[10px]">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditInventoryItem(item)}>
                              <Pencil className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedItem(item); setShowMaintenance(true); }}>
                              <Wrench className="h-3 w-3 mr-1" />Service
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Purchase requests are raised by HOD and approved/rejected by Dean.
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Lab</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Est. Cost</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map(pr => (
                      <TableRow key={pr.id}>
                        <TableCell className="font-medium text-foreground">{pr.itemName}</TableCell>
                        <TableCell className="text-sm">{pr.lab}</TableCell>
                        <TableCell className="text-sm">{pr.requestedBy}</TableCell>
                        <TableCell className="text-center">{pr.quantity}</TableCell>
                        <TableCell className="text-right font-mono">₹{pr.estimatedCost.toLocaleString()}</TableCell>
                        <TableCell className="max-w-[200px] text-xs text-muted-foreground truncate">{pr.justification}</TableCell>
                        <TableCell>
                          <Badge variant={
                            pr.status === 'approved' ? 'default' :
                            pr.status === 'rejected' ? 'destructive' :
                            pr.status === 'pending' ? 'secondary' : 'outline'
                          } className="capitalize text-[10px]">
                            {pr.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pr.status === 'pending' ? 'Awaiting Dean decision' : 'Finalized'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Purchase Request Dialog */}
      <Dialog open={showNewPR} onOpenChange={setShowNewPR}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Name</Label>
              <Input placeholder="e.g., NVIDIA RTX 4090" value={newPR.itemName} onChange={e => setNewPR(p => ({ ...p, itemName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lab</Label>
                <Select value={newPR.lab} onValueChange={v => setNewPR(p => ({ ...p, lab: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select lab..." /></SelectTrigger>
                  <SelectContent>
                    {availableLabs.map((lab) => (
                      <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Labs are sourced from Facility Management.
                </p>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="1" value={newPR.quantity} onChange={e => setNewPR(p => ({ ...p, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Estimated Cost (₹)</Label>
              <Input type="number" placeholder="50000" value={newPR.cost} onChange={e => setNewPR(p => ({ ...p, cost: e.target.value }))} />
            </div>
            <div>
              <Label>Justification</Label>
              <Textarea placeholder="Reason for purchase..." value={newPR.justification} onChange={e => setNewPR(p => ({ ...p, justification: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewPR(false)}>Cancel</Button>
              <Button onClick={handleCreatePR}>Submit Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Inventory Item</DialogTitle></DialogHeader>
          <InventoryItemForm newItem={newItem} setNewItem={setNewItem} availableLabs={availableLabs} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancel</Button>
            <Button onClick={handleCreateItem}>Add Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditItem} onOpenChange={setShowEditItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Inventory Item</DialogTitle></DialogHeader>
          <InventoryItemForm newItem={newItem} setNewItem={setNewItem} availableLabs={availableLabs} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditItem(false)}>Cancel</Button>
            <Button onClick={handleUpdateItem}>Update Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={showMaintenance} onOpenChange={setShowMaintenance}>
        <DialogContent>
          <DialogHeader><DialogTitle>Service Request – {selectedItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Lab:</span> {selectedItem?.lab}</p>
              <p><span className="text-muted-foreground">Status:</span> {selectedItem?.status}</p>
              <p><span className="text-muted-foreground">Working:</span> {selectedItem?.workingCondition}/{selectedItem?.quantity}</p>
              <p><span className="text-muted-foreground">Last Maintenance:</span> {selectedItem?.lastMaintenance}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowMaintenance(false)}>Cancel</Button>
              <Button onClick={handleMaintenanceRequest}>
                <Wrench className="mr-1 h-4 w-4" />Request Maintenance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function InventoryItemForm({
  newItem,
  setNewItem,
  availableLabs,
}: {
  newItem: { name: string; lab: string; category: string; quantity: string; workingCondition: string; purchaseDate: string; warrantyExpiry: string; status: string };
  setNewItem: React.Dispatch<React.SetStateAction<{ name: string; lab: string; category: string; quantity: string; workingCondition: string; purchaseDate: string; warrantyExpiry: string; status: string }>>;
  availableLabs: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Item Name</Label>
        <Input value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} placeholder="Desktop Systems" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Lab</Label>
          <Select value={newItem.lab} onValueChange={(v) => setNewItem((p) => ({ ...p, lab: v }))}>
            <SelectTrigger><SelectValue placeholder="Select lab..." /></SelectTrigger>
            <SelectContent>
              {availableLabs.map((lab) => (
                <SelectItem key={lab} value={lab}>{lab}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Input value={newItem.category} onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))} placeholder="Computing" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Quantity</Label>
          <Input type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))} />
        </div>
        <div>
          <Label>Working</Label>
          <Input type="number" min="0" value={newItem.workingCondition} onChange={(e) => setNewItem((p) => ({ ...p, workingCondition: e.target.value }))} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={newItem.status} onValueChange={(v) => setNewItem((p) => ({ ...p, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="working">Working</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="faulty">Faulty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Purchase Date</Label>
          <Input type="date" value={newItem.purchaseDate} onChange={(e) => setNewItem((p) => ({ ...p, purchaseDate: e.target.value }))} />
        </div>
        <div>
          <Label>Warranty Expiry</Label>
          <Input type="date" value={newItem.warrantyExpiry} onChange={(e) => setNewItem((p) => ({ ...p, warrantyExpiry: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}
