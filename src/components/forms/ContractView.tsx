import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FileText, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteContract, useUpsertContract } from '@/hooks/useContract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

// Blank number inputs submit "" - z.coerce.number() alone turns that into
// 0, which would silently zero out a previously-saved value on an empty
// re-submit rather than leaving it untouched/unset. Preprocess "" to
// undefined first so .optional() applies to "field left blank."
const blankToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v);

export const schema = z.object({
  contract_type: z.string().optional(),
  contract_value: z.preprocess(blankToUndefined, z.coerce.number().optional()),
  currency: z.string().optional(),
  retention_percentage: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(100).optional()),
  payment_terms: z.string().optional(),
  signed_date: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface ContractViewProps {
  siteId: string;
  onClose: () => void;
}

export function ContractView({ siteId, onClose }: ContractViewProps) {
  const { user, isContractor } = useAuth();
  const { data: contract, isLoading } = useSiteContract(siteId);
  const upsertContract = useUpsertContract();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (contract) {
      reset({
        contract_type: contract.contract_type ?? '',
        contract_value: contract.contract_value ?? undefined,
        currency: contract.currency,
        retention_percentage: contract.retention_percentage ?? undefined,
        payment_terms: contract.payment_terms ?? '',
        signed_date: contract.signed_date ?? '',
      });
    }
  }, [contract, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    try {
      await upsertContract.mutateAsync({
        site_id: siteId,
        created_by: user.id,
        contract_type: values.contract_type || undefined,
        contract_value: values.contract_value,
        currency: values.currency || 'KES',
        retention_percentage: values.retention_percentage,
        payment_terms: values.payment_terms || undefined,
        signed_date: values.signed_date || null,
      });
      toast.success('Contract saved');
    } catch (err) {
      toast.error('Could not save contract', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">CONTRACT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : !isContractor ? (
          <div className="card-industrial p-4 space-y-2 text-sm">
            <p className="text-muted-foreground">Contract type: {contract?.contract_type ?? '—'}</p>
            <p className="text-muted-foreground">
              Value: {contract?.currency ?? 'KES'} {contract?.contract_value ?? '—'}
            </p>
            <p className="text-muted-foreground">Retention: {contract?.retention_percentage ?? '—'}%</p>
            <p className="text-muted-foreground">Payment terms: {contract?.payment_terms ?? '—'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="contract_type">Contract Type</Label>
              <Input id="contract_type" placeholder="lump_sum / cost_plus / unit_price" {...register('contract_type')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract_value">Contract Value</Label>
                <Input id="contract_value" type="number" step="0.01" {...register('contract_value')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" placeholder="KES" {...register('currency')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention_percentage">Retention %</Label>
              <Input id="retention_percentage" type="number" step="0.1" {...register('retention_percentage')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input id="payment_terms" placeholder="e.g. Net 30 on certified value" {...register('payment_terms')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signed_date">Signed Date</Label>
              <Input id="signed_date" type="date" {...register('signed_date')} />
            </div>
            <Button type="submit" variant="construction" size="touch" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Saving...
                </>
              ) : (
                'SAVE CONTRACT'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
