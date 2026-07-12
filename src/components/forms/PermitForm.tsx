import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FileCheck, X, Loader2 } from 'lucide-react';
import { useRequestPermit } from '@/hooks/usePermits';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  permit_type: z.string().min(1),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface PermitFormProps {
  siteId: string;
  onClose: () => void;
}

const PERMIT_TYPES = [
  { value: 'hot_work', label: 'Hot Work (welding/cutting)' },
  { value: 'excavation', label: 'Excavation' },
  { value: 'height', label: 'Working at Height' },
  { value: 'confined_space', label: 'Confined Space' },
];

export function PermitForm({ siteId, onClose }: PermitFormProps) {
  const requestPermit = useRequestPermit();
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { permit_type: 'hot_work' } });

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await requestPermit.mutateAsync({ site_id: siteId, ...values });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Permit request will sync once online.' });
      } else {
        toast.success('Permit requested', { description: 'Waiting on contractor approval.' });
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
            <div className="p-3 bg-primary/20 rounded-xl">
              <FileCheck className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">REQUEST PERMIT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Work covered by a permit type below can't legally start until your contractor approves this request.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="permit_type">Permit Type</Label>
            <Controller
              name="permit_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="permit_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Details</Label>
            <Textarea id="description" rows={4} placeholder="What work is this permit for?" {...register('description')} />
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
              </>
            ) : (
              'REQUEST PERMIT'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
