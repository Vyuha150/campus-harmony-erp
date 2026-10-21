import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  defaultValue?: string | number;
  required?: boolean;
  placeholder?: string;
  options?: Array<string | { value: string; label: string }>;
  min?: number;
  minLength?: number;
}

export interface FormDialogOptions {
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  /** Checks across fields; return a message to keep the form open with it. */
  validate?: (values: Record<string, string>) => string | null;
}

type Values = Record<string, string>;

/**
 * One in-page form in place of a chain of window.prompt() calls (which some
 * browsers and embedded views block, and which can't validate anything).
 *
 *   const [formDialog, ask] = useFormDialog();
 *   const v = await ask({ title: 'New budget', fields: [...] });
 *   if (!v) return; // cancelled
 *
 * Render `formDialog` once in the component.
 */
export function useFormDialog(): [JSX.Element, (opts: FormDialogOptions) => Promise<Values | null>] {
  const [opts, setOpts] = useState<FormDialogOptions | null>(null);
  const [values, setValues] = useState<Values>({});
  const [error, setError] = useState('');
  const resolver = useRef<((v: Values | null) => void) | null>(null);

  const ask = useCallback((o: FormDialogOptions) => new Promise<Values | null>((resolve) => {
    resolver.current?.(null);
    resolver.current = resolve;
    setValues(Object.fromEntries(o.fields.map((f) => [f.name, f.defaultValue === undefined ? '' : String(f.defaultValue)])));
    setError('');
    setOpts(o);
  }), []);

  const finish = (v: Values | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const submit = () => {
    if (!opts) return;
    for (const f of opts.fields) {
      const v = (values[f.name] ?? '').trim();
      if (f.required && !v) { setError(`${f.label} is required.`); return; }
      if (f.minLength && v.length < f.minLength) { setError(`${f.label} needs at least ${f.minLength} characters.`); return; }
      if (f.type === 'number' && v && (!Number.isFinite(Number(v)) || (f.min !== undefined && Number(v) < f.min))) {
        setError(`${f.label} must be a number${f.min !== undefined ? ` of at least ${f.min}` : ''}.`);
        return;
      }
    }
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    const problem = opts.validate?.(trimmed);
    if (problem) { setError(problem); return; }
    finish(trimmed);
  };

  const element = (
    <Dialog open={!!opts} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opts?.title}</DialogTitle>
          {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {opts?.fields.map((f) => {
            const id = `fd-${f.name}`;
            const set = (v: string) => setValues((p) => ({ ...p, [f.name]: v }));
            return (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={id}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.type === 'textarea' ? (
                  <Textarea id={id} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                ) : f.type === 'select' ? (
                  <select id={id} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={values[f.name] ?? ''} onChange={(e) => set(e.target.value)}>
                    {!f.required && <option value="">—</option>}
                    {(f.options ?? []).map((o) => {
                      const opt = typeof o === 'string' ? { value: o, label: o } : o;
                      return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                    })}
                  </select>
                ) : (
                  <Input id={id} type={f.type ?? 'text'} min={f.min} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
                )}
              </div>
            );
          })}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>Cancel</Button>
            <Button type="submit">{opts?.submitLabel ?? 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return [element, ask];
}
