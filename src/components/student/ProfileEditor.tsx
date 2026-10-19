import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

type Address = { line1: string; line2: string; city: string; state: string; pincode: string; country: string };
const BLANK: Address = { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };
const clean = (v: unknown) => (typeof v === 'string' && v !== 'Not provided' ? v : '');
const addr = (a: any): Address => ({ line1: clean(a?.line1), line2: clean(a?.line2), city: clean(a?.city), state: clean(a?.state), pincode: clean(a?.pincode), country: clean(a?.country) || 'India' });

/**
 * The student's contact, address and family details. Name, date of birth,
 * category and similar official fields are corrected through the Registrar
 * (Record Corrections tab), because they appear on certificates.
 */
export function ProfileEditor({ open, onClose, profile, onSaved }: { open: boolean; onClose: () => void; profile: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      personalEmail: clean(profile.personalEmail), phone: clean(profile.phone), alternatePhone: clean(profile.alternatePhone),
      bloodGroup: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(profile.bloodGroup) ? profile.bloodGroup : '',
      permanentAddress: addr(profile.permanentAddress), currentAddress: addr(profile.currentAddress),
      guardian: {
        fatherName: clean(profile.fatherName), fatherOccupation: clean(profile.fatherOccupation), fatherPhone: clean(profile.fatherPhone), fatherEmail: clean(profile.fatherEmail),
        motherName: clean(profile.motherName), motherOccupation: clean(profile.motherOccupation), motherPhone: clean(profile.motherPhone)
      }
    });
  }, [open]);

  const set = (path: string, v: string) => setForm((f: any) => {
    const [a, b] = path.split('.');
    return b ? { ...f, [a!]: { ...f[a!], [b]: v } } : { ...f, [a!]: v };
  });

  const save = async () => {
    setSaving(true);
    try {
      await putApi('/students/profile', form);
      toast({ title: 'Profile updated' });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, path: string, type = 'text') => {
    const [a, b] = path.split('.');
    const value = b ? form[a!]?.[b] ?? '' : form[a!] ?? '';
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input type={type} value={value} onChange={(e) => set(path, e.target.value)} />
      </div>
    );
  };
  const address = (title: string, key: string) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {field('Line 1', `${key}.line1`)}{field('Line 2', `${key}.line2`)}
        {field('City', `${key}.city`)}{field('State', `${key}.state`)}
        {field('PIN code', `${key}.pincode`)}{field('Country', `${key}.country`)}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Contact, address and family details. To correct your name, date of birth or category, use the Record Corrections tab.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {field('Personal email', 'personalEmail', 'email')}
            {field('Phone', 'phone', 'tel')}
            {field('Alternate phone', 'alternatePhone', 'tel')}
            <div className="space-y-1">
              <Label className="text-xs">Blood group</Label>
              <Select value={form.bloodGroup || 'none'} onValueChange={(v) => set('bloodGroup', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {address('Permanent address', 'permanentAddress')}
          <div className="flex justify-end"><Button type="button" variant="link" size="sm" onClick={() => setForm((f: any) => ({ ...f, currentAddress: { ...(f.permanentAddress ?? BLANK) } }))}>Current address same as permanent</Button></div>
          {address('Current address', 'currentAddress')}
          <div className="space-y-2">
            <p className="text-sm font-medium">Parents / guardian</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {field("Father's name", 'guardian.fatherName')}{field("Father's occupation", 'guardian.fatherOccupation')}
              {field("Father's phone", 'guardian.fatherPhone', 'tel')}{field("Father's email", 'guardian.fatherEmail', 'email')}
              {field("Mother's name", 'guardian.motherName')}{field("Mother's occupation", 'guardian.motherOccupation')}
              {field("Mother's phone", 'guardian.motherPhone', 'tel')}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
