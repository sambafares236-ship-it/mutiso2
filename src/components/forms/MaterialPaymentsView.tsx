import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Receipt, X, Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMaterialPayments, useRecordMaterialPayment, type DeliveryWithPayments } from '@/hooks/useMaterialPayments';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  invoice_reference: z.string().optional(),
  date_incurred: z.string().min(1),
});
type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormValues = z.output<typeof paymentSchema>;

interface MaterialPaymentsViewProps {
  siteId: string;
  onClose: () => void;
}

function DeliveryCard({ siteId, delivery }: { siteId: string; delivery: DeliveryWithPayments }) {
  const { user } = useAuth();
  const recordPayment = useRecordMaterialPayment();
  const [showForm, setShowForm] = useState(false);
  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date_incurred: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (values: PaymentFormValues) => {
    if (!user) return;
    try {
      await recordPayment.mutateAsync({
        site_id: siteId,
        created_by: user.id,
        material_delivery_id: delivery.id,
        amount: values.amount,
        date_incurred: values.date_incurred,
        invoice_reference: values.invoice_reference || undefined,
      });
      toast.success('Payment recorded');
      form.reset({ date_incurred: new Date().toISOString().split('T')[0] });
      setShowForm(false);
    } catch (err) {
      toast.error('Could not record payment', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="card-industrial p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{delivery.material_name}</p>
          <p className="text-xs text-muted-foreground">
            {delivery.quantity} {delivery.unit ?? ''} · {delivery.supplier || 'No supplier specified'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(delivery.date).toLocaleDateString('en-KE')}</p>
        </div>
        {delivery.receiptUrl && (
          <a
            href={delivery.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0"
            title="View receipt"
          >
            <img
              src={delivery.receiptUrl}
              alt="Receipt"
              className="w-10 h-10 rounded-md object-cover border border-border hover:brightness-110 transition-[filter]"
            />
          </a>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <p className="text-sm">
          <span className="text-muted-foreground">Paid: </span>
          <span className="font-medium text-foreground">{formatKES(delivery.totalPaid)}</span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Record Payment
        </Button>
      </div>

      {delivery.payments.length > 0 && (
        <div className="mt-2 space-y-1">
          {delivery.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs bg-secondary/60 rounded-md px-2 py-1.5">
              <span className="text-muted-foreground">
                {new Date(p.date_incurred).toLocaleDateString('en-KE')}
                {p.invoice_reference ? ` · ${p.invoice_reference}` : ''}
              </span>
              <span className="font-medium text-foreground">{formatKES(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 p-3 border border-dashed border-border rounded-lg space-y-2" noValidate>
          <Input type="number" step="0.01" placeholder="Amount (KES)" {...form.register('amount')} />
          {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
          <Input placeholder="Invoice reference (optional)" {...form.register('invoice_reference')} />
          <div className="space-y-1">
            <Label className="text-xs">Date paid</Label>
            <Input type="date" {...form.register('date_incurred')} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="construction" disabled={form.formState.isSubmitting}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function MaterialPaymentsView({ siteId, onClose }: MaterialPaymentsViewProps) {
  const { data: deliveries, isLoading } = useMaterialPayments(siteId);

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Receipt className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl text-primary">MATERIAL PAYMENTS</h2>
              <p className="text-xs text-muted-foreground">Match deliveries to what's been paid</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : !deliveries?.length ? (
          <div className="text-center py-12">
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No material deliveries logged yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((d) => (
              <DeliveryCard key={d.id} siteId={siteId} delivery={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
