import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, X, Loader2, ImagePlus } from 'lucide-react';
import { useReportIncident } from '@/hooks/useIncidents';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  category: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  workers_involved: z.string().optional(),
  date: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

interface IncidentFormProps {
  siteId: string;
  onClose: () => void;
}

export function IncidentForm({ siteId, onClose }: IncidentFormProps) {
  const reportIncident = useReportIncident();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'near_miss', severity: 'low', date: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          const ext = photoFile.name.split('.').pop() ?? 'jpg';
          const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, photoFile);
          if (uploadError) throw uploadError;
          photoUrl = path;
        } catch {
          toast.warning('Photo not uploaded', { description: 'Incident will still be reported without it.' });
        }
      }

      const result = await reportIncident.mutateAsync({ site_id: siteId, ...values, photo_url: photoUrl });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Incident report will sync once online.' });
      } else {
        toast.success('Incident reported', {
          description:
            values.severity !== 'low' ? 'The contractor has been notified.' : 'Report saved.',
        });
      }
      onClose();
    } catch (err) {
      toast.error('Error', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-destructive/20 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="font-display text-3xl text-primary">REPORT INCIDENT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="near_miss">Near Miss</SelectItem>
                    <SelectItem value="injury">Injury</SelectItem>
                    <SelectItem value="property_damage">Property Damage</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
                    <SelectItem value="medium">Medium — notifies contractor</SelectItem>
                    <SelectItem value="high">High — notifies contractor</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">What happened? *</Label>
            <Textarea id="description" rows={4} placeholder="Describe what happened..." {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workers_involved">Workers involved</Label>
            <Input id="workers_involved" placeholder="Names of anyone involved" {...register('workers_involved')} />
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
              <span className="text-sm text-muted-foreground">{photoFile ? photoFile.name : 'Attach a photo of the incident'}</span>
            </button>
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'SUBMIT REPORT'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
