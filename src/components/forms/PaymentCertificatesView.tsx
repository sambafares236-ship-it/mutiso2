import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Receipt, X, Loader2, Plus, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSitePaymentCertificates, useGeneratePaymentCertificate, useUpdateCertificateStatus } from '@/hooks/usePaymentCertificates';
import { formatKES } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  work_completed_value: z.coerce.number().positive('Value must be greater than 0'),
  // A blank input's DOM value is "" - z.coerce.number() alone would turn
  // that into 0, silently overriding the contract's default retention
  // rate instead of leaving it unset. Preprocess "" to undefined first so
  // .optional() actually applies to "field left blank."
  retention_percentage: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.coerce.number().min(0).max(100).optional(),
  ),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-border bg-card',
  certified: 'border-warning bg-warning/10',
  paid: 'border-success bg-success/10',
};

interface PaymentCertificatesViewProps {
  siteId: string;
  onClose: () => void;
}

export function PaymentCertificatesView({ siteId, onClose }: PaymentCertificatesViewProps) {
  const { user, isContractor } = useAuth();
  const { data: certificates, isLoading } = useSitePaymentCertificates(siteId);
  const generateCert = useGeneratePaymentCertificate();
  const updateStatus = useUpdateCertificateStatus();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await generateCert.mutateAsync({
        site_id: siteId,
        period_start: values.period_start,
        period_end: values.period_end,
        work_completed_value: values.work_completed_value,
        retention_percentage: values.retention_percentage,
      });
      toast.success('Payment certificate generated');
      reset();
      setShowForm(false);
    } catch (err) {
      toast.error('Could not generate certificate', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleAdvanceStatus = async (certId: string, nextStatus: 'certified' | 'paid') => {
    try {
      await updateStatus.mutateAsync({ id: certId, site_id: siteId, status: nextStatus, certified_by: user?.id });
      toast.success(`Certificate marked ${nextStatus}`);
    } catch (err) {
      toast.error('Could not update certificate', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Receipt className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">PAYMENT CERTS</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : !certificates?.length ? (
            <p className="text-sm text-muted-foreground">No payment certificates yet.</p>
          ) : (
            certificates.map((cert) => (
              <div key={cert.id} className={`p-4 rounded-xl border-2 ${STATUS_STYLES[cert.status] ?? STATUS_STYLES.draft}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground">Certificate #{cert.certificate_number}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{cert.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {cert.period_start} → {cert.period_end}
                </p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Work completed</span>
                    <span>{formatKES(cert.work_completed_value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retention ({cert.retention_percentage}%)</span>
                    <span>-{formatKES(cert.retention_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Previously paid</span>
                    <span>-{formatKES(cert.previous_payments_total)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-foreground border-t border-border pt-1 mt-1">
                    <span>Net due</span>
                    <span>{formatKES(cert.net_amount_due)}</span>
                  </div>
                </div>
                {isContractor && cert.status === 'draft' && (
                  <Button size="sm" variant="construction" className="mt-3" onClick={() => handleAdvanceStatus(cert.id, 'certified')} disabled={updateStatus.isPending}>
                    <Check className="w-4 h-4 mr-1" /> Certify
                  </Button>
                )}
                {isContractor && cert.status === 'certified' && (
                  <Button size="sm" variant="construction" className="mt-3" onClick={() => handleAdvanceStatus(cert.id, 'paid')} disabled={updateStatus.isPending}>
                    <Check className="w-4 h-4 mr-1" /> Mark Paid
                  </Button>
                )}
              </div>
            ))
          )}

          {isContractor &&
            (showForm ? (
              <form onSubmit={handleSubmit(onSubmit)} className="p-3 border border-dashed border-border rounded-lg space-y-2" noValidate>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Period start</Label>
                    <Input type="date" {...register('period_start')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Period end</Label>
                    <Input type="date" {...register('period_end')} />
                  </div>
                </div>
                <Input type="number" step="0.01" placeholder="Cumulative work completed value" {...register('work_completed_value')} />
                {errors.work_completed_value && <p className="text-xs text-destructive">{errors.work_completed_value.message}</p>}
                <Input type="number" step="0.1" placeholder="Retention % (defaults to contract)" {...register('retention_percentage')} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="construction" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-1" /> Generate certificate
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
