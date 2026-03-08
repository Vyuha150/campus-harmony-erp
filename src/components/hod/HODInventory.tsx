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
  Package, Wrench, ShoppingCart, CheckCircle, XCircle, AlertTriangle,
  Plus, Download, Monitor
} from 'lucide-react';
import { labInventory as initialInventory, purchaseRequests as initialPR } from '@/data/hodMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { LabInventoryItem, PurchaseRequest } from '@/types/hod';

export default function HODInventory() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<LabInventoryItem[]>(initialInventory);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>(initialPR);
  const [showNewPR, setShowNewPR] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LabInventoryItem | null>(null);
  const [newPR, setNewPR] = useState({ itemName: '', lab: '', quantity: '1', cost: '', justification: '' });

  const totalItems = inventory.reduce((s, i) => s + i.quantity, 0);
  const faultyItems = inventory.filter(i => i.status === 'faulty' || i.status === 'maintenance').length;
  const pendingPR = purchases.filter(p => p.status === 'pending').length;

  const handleApprovePR = (id: string) => {
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
    toast({ title: '✅ Purchase Approved' });
  };

  const handleRejectPR = (id: string) => {
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
    toast({ title: '❌ Purchase Rejected' });
  };

  const handleCreatePR = () => {
    if (!newPR.itemName || !newPR.lab || !newPR.cost) {
      toast({ title: 'Missing Fields', variant: 'destructive' });
      return;
    }
    const pr: PurchaseRequest = {
      id: `pr-${Date.now()}`,
      itemName: newPR.itemName,
      lab: newPR.lab,
      requestedBy: 'Dr. Vikram Singh (HOD)',
      quantity: parseInt(newPR.quantity),
      estimatedCost: parseInt(newPR.cost),
      justification: newPR.justification,
      status: 'pending',
      requestDate: '2026-03-08',
    };
    setPurchases(prev => [...prev, pr]);
    toast({ title: 'Purchase Request Created', description: `${newPR.itemName} – ₹${parseInt(newPR.cost).toLocaleString()}` });
    setShowNewPR(false);
    setNewPR({ itemName: '', lab: '', quantity: '1', cost: '', justification: '' });
  };

  const handleMaintenanceRequest = () => {
    if (selectedItem) {
      setInventory(prev => prev.map(i => i.id === selectedItem.id ? { ...i, status: 'maintenance', lastMaintenance: '2026-03-08' } : i));
      toast({ title: '🔧 Maintenance Requested', description: `${selectedItem.name} sent for maintenance` });
      setShowMaintenance(false);
    }
  };

  const handleExport = () => {
    toast({ title: '📥 Inventory Exported', description: 'Lab inventory report downloaded' });
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
            <Button size="sm" onClick={() => setShowNewPR(true)}>
              <Plus className="mr-1 h-4 w-4" />New Purchase Request
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Equipment', value: totalItems, icon: Package, color: 'text-blue-600 bg-blue-100' },
            { label: 'Labs', value: [...new Set(inventory.map(i => i.lab))].length, icon: Monitor, color: 'text-green-600 bg-green-100' },
            { label: 'Faulty/Maintenance', value: faultyItems, icon: Wrench, color: 'text-amber-600 bg-amber-100' },
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
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedItem(item); setShowMaintenance(true); }}>
                            <Wrench className="h-3 w-3 mr-1" />Service
                          </Button>
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
                        <TableCell>
                          {pr.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                                onClick={() => handleApprovePR(pr.id)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => handleRejectPR(pr.id)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
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
                    {[...new Set(inventory.map(i => i.lab))].map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
