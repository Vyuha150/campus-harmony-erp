import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type Facility = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  status: string;
};

type PurchaseRequest = {
  id: string;
  itemName: string;
  lab: string;
  requestedBy: string;
  quantity: number;
  estimatedCost: number;
  justification: string;
  status: string;
  requestDate: string;
};

export default function DeanFacilityManagement() {
  const { toast } = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'classroom', capacity: '60', status: 'available' });

  const loadData = async () => {
    try {
      const [facilityData, requests] = await Promise.all([
        fetchApi<Facility[]>('/dean/facility-management'),
        fetchApi<PurchaseRequest[]>('/dean/inventory/purchase-requests'),
      ]);
      setFacilities(Array.isArray(facilityData) ? facilityData : []);
      setPurchaseRequests(Array.isArray(requests) ? requests : []);
    } catch (error: any) {
      toast({ title: 'Load failed', description: error?.message || 'Unable to load facilities', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reset = () => setForm({ name: '', type: 'classroom', capacity: '60', status: 'available' });

  const handleCreate = async () => {
    if (!form.name || !form.type || !form.capacity) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }

    try {
      const created = await postApi<Facility>('/dean/facility-management', {
        name: form.name,
        type: form.type,
        capacity: Number(form.capacity),
        status: form.status,
      });
      setFacilities((prev) => [...prev, created]);
      setOpenCreate(false);
      reset();
      toast({ title: 'Facility created' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create facility', variant: 'destructive' });
    }
  };

  const startEdit = (item: Facility) => {
    setEditingId(item.id);
    setForm({ name: item.name, type: item.type, capacity: String(item.capacity), status: item.status });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const updated = await putApi<Facility>(`/dean/facility-management/${editingId}`, {
        name: form.name,
        type: form.type,
        capacity: Number(form.capacity),
        status: form.status,
      });
      setFacilities((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      setOpenEdit(false);
      setEditingId(null);
      reset();
      toast({ title: 'Facility updated' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update facility', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this facility?')) return;
    try {
      await deleteApi(`/dean/facility-management/${id}`);
      setFacilities((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Facility deleted' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete facility', variant: 'destructive' });
    }
  };

  const handlePRStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await putApi(`/dean/inventory/purchase-requests/${id}/status`, { status });
      setPurchaseRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      toast({ title: `Purchase request ${status}` });
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Unable to update purchase request', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Facility Management</h1>
            <p className="text-muted-foreground">Coordinate classrooms and labs across departments</p>
          </div>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-1 h-4 w-4" />New Facility
          </Button>
        </div>

        <Tabs defaultValue="facilities">
          <TabsList>
            <TabsTrigger value="facilities">Facilities</TabsTrigger>
            <TabsTrigger value="approvals">Purchase Approvals ({purchaseRequests.filter((item) => item.status === 'pending').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="facilities" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Facilities</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilities.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="capitalize">{item.type}</TableCell>
                        <TableCell className="text-center">{item.capacity}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'available' ? 'default' : 'secondary'} className="capitalize">{item.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
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

          <TabsContent value="approvals" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Purchase Request Approvals</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Lab</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Estimated Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseRequests.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.lab}</TableCell>
                        <TableCell className="text-xs">{item.requestedBy}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{Number(item.estimatedCost || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'}
                            className="capitalize"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600"
                                onClick={() => handlePRStatus(item.id, 'approved')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handlePRStatus(item.id, 'rejected')}
                              >
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

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Facility</DialogTitle></DialogHeader>
          <FacilityForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Facility</DialogTitle></DialogHeader>
          <FacilityForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function FacilityForm({
  form,
  setForm,
}: {
  form: { name: string; type: string; capacity: string; status: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; type: string; capacity: string; status: string }>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Facility Name</Label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Room D-101" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="classroom">Classroom</SelectItem>
              <SelectItem value="lab">Lab</SelectItem>
              <SelectItem value="seminar_hall">Seminar Hall</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
