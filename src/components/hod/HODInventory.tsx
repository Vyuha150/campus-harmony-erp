import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Wrench, ShoppingCart, CheckCircle, XCircle, AlertTriangle,
  Plus, Download, Monitor
} from 'lucide-react';
import { labInventory, purchaseRequests } from '@/data/hodMockData';
import { useToast } from '@/hooks/use-toast';

export default function HODInventory() {
  const { toast } = useToast();

  const totalItems = labInventory.reduce((s, i) => s + i.quantity, 0);
  const faultyItems = labInventory.filter(i => i.status === 'faulty' || i.status === 'maintenance').length;
  const pendingPR = purchaseRequests.filter(p => p.status === 'pending').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory & Lab Management</h1>
            <p className="text-muted-foreground">Manage lab equipment, maintenance, and purchases</p>
          </div>
          <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Purchase Request</Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Equipment', value: totalItems, icon: Package, color: 'text-blue-600 bg-blue-100' },
            { label: 'Labs', value: [...new Set(labInventory.map(i => i.lab))].length, icon: Monitor, color: 'text-green-600 bg-green-100' },
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
            <TabsTrigger value="purchases">Purchase Requests</TabsTrigger>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labInventory.map(item => (
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
                    {purchaseRequests.map(pr => (
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
                                onClick={() => toast({ title: 'Approved', description: pr.itemName })}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => toast({ title: 'Rejected', description: pr.itemName })}>
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
    </DashboardLayout>
  );
}
