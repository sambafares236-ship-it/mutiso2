import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Truck, X, Loader2, ImagePlus } from 'lucide-react';
import { useLogDelivery } from '@/hooks/useMaterials';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaterialCombobox } from '@/components/MaterialCombobox';

const schema = z.object({
  material_name: z.string().min(1, 'Material name is required'),
  supplier: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().optional(),
  date: z.string().min(1),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface DeliveryFormProps {
  siteId: string;
  onClose: () => void;
}

export function DeliveryForm({ siteId, onClose }: DeliveryFormProps) {
  const logDelivery = useLogDelivery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0], material_name: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // Receipt photo uploads to Storage first (online-only, unlike the
      // rest of this form - see useLogDelivery's comment). If it fails
      // (e.g. offline), the delivery still logs, just without a photo.
      let receiptPhotoUrl: string | undefined;
      if (receiptFile) {
        try {
          const ext = receiptFile.name.split('.').pop() ?? 'jpg';
          const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, receiptFile);
          if (uploadError) throw uploadError;
          receiptPhotoUrl = path;
        } catch {
          toast.warning('Receipt photo not uploaded', { description: 'Delivery will still be logged without it.' });
        }
      }

      const result = await logDelivery.mutateAsync({ site_id: siteId, ...values, receipt_photo_url: receiptPhotoUrl });
      if (result.queued) {
        toast.info('Saved offline', { description: `${values.material_name} delivery will sync once online.` });
      } else {
        toast.success('Delivery logged', { description: `${values.material_name} recorded.` });
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
            <div className="p-3 bg-success/20 rounded-xl">
              <Truck className="w-6 h-6 text-success" />
            </div>
            <h2 className="font-display text-3xl text-primary">MATERIALS IN</h2>
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
                <MaterialCombobox siteId={siteId} value={field.value} onChange={field.onChange} placeholder="e.g., Cement, Steel Bars, Bricks" />
              )}
            />
            {errors.material_name && <p className="text-xs text-destructive">{errors.material_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input id="supplier" placeholder="e.g., ABC Building Supplies" {...register('supplier')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Received Qty *</Label>
            <Input id="quantity" type="number" step="0.01" placeholder="0" {...register('quantity')} />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="bags, tons, pcs" {...register('unit')} />
          </div>

          <div className="space-y-2">
            <Label>Receipt Photo (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{receiptFile ? receiptFile.name : 'Attach a photo of the receipt'}</span>
            </button>
          </div>

          <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving...
              </>
            ) : (
              'LOG DELIVERY'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
