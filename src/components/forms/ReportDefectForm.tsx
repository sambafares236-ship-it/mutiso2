import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wrench, X, Loader2, ImagePlus } from 'lucide-react';
import { useReportDefect } from '@/hooks/useDefects';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  location: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  severity: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

interface ReportDefectFormProps {
  siteId: string;
  onClose: () => void;
}

export function ReportDefectForm({ siteId, onClose }: ReportDefectFormProps) {
  const reportDefect = useReportDefect();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { severity: 'medium' } });

  const onSubmit = async (values: FormValues) => {
    try {
      // Same online-only, failure-tolerant upload pattern as
      // DeliveryForm/PettyCashForm - a File can't survive the offline
      // queue, so it uploads first and only the resulting path is queued.
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const ext = photoFile.name.split('.').pop() ?? 'jpg';
          const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, photoFile);
          if (uploadError) throw uploadError;
          photoUrl = path;
        } catch {
          toast.warning('Photo not uploaded', { description: 'Defect will still be reported without it.' });
        }
      }

      const result = await reportDefect.mutateAsync({ site_id: siteId, ...values, photo_url: photoUrl });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Defect report will sync once online.' });
      } else {
        toast.success('Defect reported');
      }
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning/20 rounded-xl">
              <Wrench className="w-6 h-6 text-warning" />
            </div>
            <h2 className="font-display text-3xl text-primary">REPORT DEFECT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="e.g., Block A, 2nd floor" {...register('location')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" rows={4} placeholder="What's wrong?" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{photoFile ? photoFile.name : 'Attach a photo of the defect'}</span>
            </button>
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'REPORT DEFECT'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
