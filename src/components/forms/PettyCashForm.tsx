import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Wallet, X, Loader2, ImagePlus } from 'lucide-react';
import { useSitePettyCash, useLogPettyCash } from '@/hooks/usePettyCash';
import { supabase } from '@/integrations/supabase/client';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().min(1, 'Describe how the cash was used'),
  date: z.string().min(1),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface PettyCashFormProps {
  siteId: string;
  onClose: () => void;
}

export function PettyCashForm({ siteId, onClose }: PettyCashFormProps) {
  const { data: entries, isLoading } = useSitePettyCash(siteId);
  const logPettyCash = useLogPettyCash();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // Same pattern as DeliveryForm's receipt photo - uploads online-only
      // before the mutation, since a File can't survive the offline queue.
      let receiptPhotoUrl: string | undefined;
      if (receiptFile) {
        try {
          const ext = receiptFile.name.split('.').pop() ?? 'jpg';
          const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, receiptFile);
          if (uploadError) throw uploadError;
          receiptPhotoUrl = path;
        } catch {
          toast.warning('Receipt photo not uploaded', { description: 'Entry will still be logged without it.' });
        }
      }

      const result = await logPettyCash.mutateAsync({ site_id: siteId, ...values, receipt_photo_url: receiptPhotoUrl });
      if (result.queued) {
        toast.info('Saved offline', { description: 'Will sync once online.' });
      } else {
        toast.success('Petty cash logged');
      }
      reset({ date: new Date().toISOString().split('T')[0], amount: undefined, description: '' });
      setReceiptFile(null);
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
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PETTY CASH</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card-industrial p-4 space-y-4 mb-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES) *</Label>
            <Input id="amount" type="number" step="0.01" placeholder="0" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">What was it used for? *</Label>
            <Textarea id="description" rows={3} placeholder="e.g., Fuel for generator, transport to hardware" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
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
              'LOG PETTY CASH'
            )}
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : !entries?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No petty cash logged yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="card-industrial p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString('en-KE')}</p>
                </div>
                <p className="text-sm font-bold text-primary flex-shrink-0">{formatKES(entry.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
