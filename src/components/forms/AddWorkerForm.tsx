import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { UserPlus, X, Loader2 } from 'lucide-react';
import { useAddWorker } from '@/hooks/useWorkers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  worker_id_number: z.string().min(1, 'ID number is required'),
  full_name: z.string().min(1, 'Full name is required'),
  trade: z.string().optional(),
  daily_rate: z.coerce.number().min(0).optional(),
  phone_number: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface AddWorkerFormProps {
  siteId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function AddWorkerForm({ siteId, onClose, onAdded }: AddWorkerFormProps) {
  const addWorker = useAddWorker();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await addWorker.mutateAsync({ site_id: siteId, ...values });
      toast.success('Worker added', { description: `${values.full_name} added to the roster.` });
      onAdded();
    } catch (err) {
      toast.error('Could not add worker', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">ADD WORKER</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="worker_id_number">ID Number *</Label>
            <Input id="worker_id_number" placeholder="e.g., W-001" {...register('worker_id_number')} />
            {errors.worker_id_number && <p className="text-xs text-destructive">{errors.worker_id_number.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input id="full_name" placeholder="John Kamau" {...register('full_name')} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="trade">Trade</Label>
            <Input id="trade" placeholder="Mason, Electrician..." {...register('trade')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily_rate">Daily Rate (KES)</Label>
            <Input id="daily_rate" type="number" step="0.01" placeholder="1500" {...register('daily_rate')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input id="phone_number" placeholder="07XX XXX XXX" {...register('phone_number')} />
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'ADD WORKER'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
