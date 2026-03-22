import { useId, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type UploadFieldProps = {
  label?: string;
  helperText?: string;
  accept?: string;
  file?: File | null;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  mode?: 'input' | 'button';
  buttonText?: string;
  onFileSelect: (file: File | null) => void;
};

export function UploadField({
  label,
  helperText,
  accept,
  file,
  disabled,
  required,
  className,
  mode = 'input',
  buttonText = 'Upload File',
  onFileSelect
}: UploadFieldProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    onFileSelect(nextFile);
  };

  const clearFile = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileSelect(null);
  };

  if (mode === 'button') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          id={generatedId}
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          disabled={disabled}
          required={required}
          onChange={handleChange}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          {file ? file.name : buttonText}
        </Button>
        {file && (
          <Button type="button" variant="ghost" size="icon" onClick={clearFile} aria-label="Clear selected file">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={generatedId}>{label}</Label>}
      <div className="flex items-center gap-2">
        <Input
          id={generatedId}
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          required={required}
          onChange={handleChange}
        />
        {file && (
          <Button type="button" variant="ghost" size="icon" onClick={clearFile} aria-label="Clear selected file">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
