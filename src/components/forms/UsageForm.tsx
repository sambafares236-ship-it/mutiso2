import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Hammer, X, Loader2 } from 'lucide-react';
import { useInventory, useLogUsage } from '@/hooks/useMaterials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MaterialCombobox } from '@/components/MaterialCombobox';

const schema = z.object({
  material_name: z.string().min(1, 'Material name is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface UsageFormProps {
  siteId: string;
  onClose: () => void;
}

export function UsageForm({ siteId, onClose }: UsageFormProps) {
  const { data: inventory } = useInventory(siteId);
  const logUsage = useLogUsage();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], material_name: '' },
  });

  const materialName = watch('material_name');
  const matchingStock = inventory?.find(
    (item) => item.material_name.toLowerCase() === (materialName ?? '').toLowerCase(),
  );

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await logUsage.mutateAsync({ site_id: siteId, ...values });
      if (result.queued) {
        toast.info('Saved offline', {
          description: `${values.material_name} usage will sync once online — stock will be verified then.`,
        });
      } else {
        toast.success('Usage logged', { description: `${values.material_name} usage recorded.` });
      }
      onClose();
    } catch (err) {
      toast.error('Cannot log usage', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-warning/20 rounded-xl">
              <Hammer className="w-6 h-6 text-warning" />
            </div>
            <h2 className="font-display text-3xl text-primary">MATERIALS OUT</h2>
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
            <Label htmlFor="material_name">Material Name *</Label>
            <Controller
              name="material_name"
              control={control}
              render={({ field }) => (
                <MaterialCombobox siteId={siteId} value={field.value} onChange={field.onChange} placeholder="e.g., Cement, Steel Bars" />
              )}
            />
            {errors.material_name && <p className="text-xs text-destructive">{errors.material_name.message}</p>}
            {matchingStock && (
              <p className="text-xs text-muted-foreground">
                In stock: {matchingStock.current_quantity} {matchingStock.unit || 'units'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity Used *</Label>
              <Input id="quantity" type="number" step="0.01" placeholder="0" {...register('quantity')} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="bags, tons, pcs" {...register('unit')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea id="description" placeholder="Where was this material used?" {...register('description')} />
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'LOG USAGE'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
