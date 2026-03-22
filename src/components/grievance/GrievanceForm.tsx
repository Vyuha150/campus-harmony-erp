import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { postApi } from '@/lib/apiService';
import type { CreateGrievanceInput } from '@/types/grievance';

interface GrievanceFormProps {
  onSubmitSuccess?: (grievanceNumber: string) => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'facility', label: 'Facility' },
  { value: 'financial', label: 'Financial' },
  { value: 'other', label: 'Other' }
];

const SUBCATEGORIES: Record<string, string[]> = {
  academic: ['Assignment Grading', 'Course Content', 'Attendance', 'Exam Issues'],
  administrative: ['Admission', 'Registration', 'Documentation', 'Fees'],
  harassment: ['Verbal', 'Physical', 'Cyber', 'Other'],
  discrimination: ['Gender', 'Religion', 'Caste', 'Other'],
  facility: ['Infrastructure', 'Cleanliness', 'Safety', 'Maintenance'],
  financial: ['Fee Calculation', 'Refund', 'Scholarship', 'Fine Dispute'],
  other: ['Other']
};

export default function GrievanceForm({ onSubmitSuccess, onCancel }: GrievanceFormProps) {
  const [formData, setFormData] = useState<CreateGrievanceInput>({
    complainantName: '',
    complainantType: 'student',
    category: '',
    subject: '',
    description: '',
    severity: 'medium',
    isAnonymous: false,
    evidenceFiles: []
  });

  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const subcategories = formData.category ? SUBCATEGORIES[formData.category] || [] : [];

  const handleInputChange = (field: keyof CreateGrievanceInput, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    setErrorMessage('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.complainantName.trim()) {
      setErrorMessage('Complainant name is required');
      return;
    }
    if (!formData.category) {
      setErrorMessage('Category is required');
      return;
    }
    if (!formData.subject.trim()) {
      setErrorMessage('Subject is required');
      return;
    }
    if (!formData.description.trim()) {
      setErrorMessage('Description is required');
      return;
    }
    if (!formData.isAnonymous && formData.complainantType === 'student' && !formData.complainantId) {
      setErrorMessage('Complainant ID is required for non-anonymous grievances');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      // Prepare file paths (in a real scenario, files would be uploaded first)
      const fileNames = attachedFiles.map((f) => f.name);

      const submitData = {
        ...formData,
        subcategory: selectedSubcategory || undefined,
        evidenceFiles: fileNames
      };

      const response = await postApi('/grievances/cases', submitData);

      setSuccessMessage(`Grievance submitted successfully! Reference: ${response.grievanceNumber}`);
      
      // Reset form
      setFormData({
        complainantName: '',
        complainantType: 'student',
        category: '',
        subject: '',
        description: '',
        severity: 'medium',
        isAnonymous: false,
        evidenceFiles: []
      });
      setSelectedSubcategory('');
      setAttachedFiles([]);

      // Call success callback if provided
      if (onSubmitSuccess) {
        setTimeout(() => onSubmitSuccess(response.grievanceNumber), 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit grievance');
      console.error('Error submitting grievance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>File a Grievance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Messages */}
            {successMessage && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
              </Alert>
            )}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Complainant Information */}
            <div className="space-y-4 pb-4 border-b">
              <h3 className="font-semibold text-foreground">Complainant Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Full Name *</label>
                  <Input
                    placeholder="Enter your full name"
                    value={formData.complainantName}
                    onChange={(e) => handleInputChange('complainantName', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Complainant Type *</label>
                  <Select
                    value={formData.complainantType}
                    onValueChange={(value: any) => handleInputChange('complainantType', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="anonymous">Anonymous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.complainantType === 'student' && (
                <div>
                  <label className="text-sm font-medium text-foreground">Roll Number / ID</label>
                  <Input
                    placeholder="Your roll number (optional for anonymous)"
                    value={formData.complainantId || ''}
                    onChange={(e) => handleInputChange('complainantId', e.target.value || undefined)}
                    disabled={formData.isAnonymous || isSubmitting}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="anonymous"
                  checked={formData.isAnonymous}
                  onCheckedChange={(checked) => handleInputChange('isAnonymous', checked)}
                  disabled={isSubmitting}
                />
                <label htmlFor="anonymous" className="text-sm text-foreground cursor-pointer">
                  Submit this grievance anonymously
                </label>
              </div>
            </div>

            {/* Grievance Details */}
            <div className="space-y-4 pb-4 border-b">
              <h3 className="font-semibold text-foreground">Grievance Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Category *</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      handleInputChange('category', value);
                      setSelectedSubcategory('');
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Sub-category</label>
                  <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory} disabled={isSubmitting || !formData.category}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-category" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((subcat) => (
                        <SelectItem key={subcat} value={subcat}>
                          {subcat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Subject *</label>
                <Input
                  placeholder="Brief subject of your grievance"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Description *</label>
                <Textarea
                  placeholder="Provide detailed description of your grievance"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={5}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Severity Level</label>
                <div className="flex gap-2 mt-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((level) => (
                    <Button
                      key={level}
                      type="button"
                      variant={formData.severity === level ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleInputChange('severity', level)}
                      disabled={isSubmitting}
                      className="capitalize"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* File Attachments */}
            <div className="space-y-4 pb-4 border-b">
              <h3 className="font-semibold text-foreground">Evidence & Attachments</h3>
              <p className="text-sm text-muted-foreground">Attach supporting documents, screenshots, or evidence (optional)</p>

              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="file-input"
                  multiple
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF, DOC up to 10MB</p>
                </label>
              </div>

              {attachedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Attached Files:</p>
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.complainantName || !formData.category || !formData.subject || !formData.description}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              * Required fields. Your grievance will be reviewed within 5 working days.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
