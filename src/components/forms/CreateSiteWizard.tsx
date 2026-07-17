import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building, X, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { useCreateSiteWithManualPayment } from '@/hooks/useSubscriptionPayment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIER_PRICING, TIER_LABEL, type SubscriptionTier } from '@/lib/pricing';
import { MANUAL_PAYMENT_PHONE_DISPLAY } from '@/lib/payment';
import { formatKES } from '@/lib/utils';

const detailsSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  location: z.string().optional(),
  subscription_tier: z.enum(['field_ops', 'pro']),
});
type DetailsValues = z.infer<typeof detailsSchema>;

interface CreateSiteWizardProps {
  onClose: () => void;
}

// Two-step overlay: nothing is written to the database until step 2's final
// submit - going back to step 1 or cancelling leaves no trace, since a site
// row is no longer allowed to exist without a payment record alongside it
// (create_site_with_manual_payment() inserts both atomically). Manual
// payment only for this pass - PAYMENT_MODE is 'manual' in
// src/lib/payment.ts, the STK path stays dormant until production Daraja
// credentials are live.
export function CreateSiteWizard({ onClose }: CreateSiteWizardProps) {
  const [step, setStep] = useState<'details' | 'payment' | 'done'>('details');
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [includeBot, setIncludeBot] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const createSite = useCreateSiteWithManualPayment();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { subscription_tier: 'field_ops' },
  });

  const onDetailsSubmit = (values: DetailsValues) => {
    setDetails(values);
    setStep('payment');
  };

  const handleReportPayment = async () => {
    if (!details) return;
    try {
      await createSite.mutateAsync({
        site_name: details.site_name,
        location: details.location,
        subscription_tier: details.subscription_tier,
        include_bot: includeBot,
        mpesa_receipt_number: mpesaCode || undefined,
      });
      setStep('done');
      toast.success('Site created', { description: `${details.site_name} is awaiting payment confirmation and admin approval.` });
    } catch (err) {
      toast.error('Could not create site', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const tier: SubscriptionTier | undefined = details?.subscription_tier;
  const pricing = tier ? TIER_PRICING[tier] : null;
  const amount = pricing ? (includeBot ? pricing.withBot : pricing.base) : 0;
  const botAddonPrice = pricing ? pricing.withBot - pricing.base : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">NEW SITE</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {step === 'details' && (
          <form onSubmit={handleSubmit(onDetailsSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="site_name">Site Name</Label>
              <Input id="site_name" placeholder="Westlands Tower A" {...register('site_name')} />
              {errors.site_name && <p className="text-xs text-destructive">{errors.site_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Nairobi" {...register('location')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription_tier">Plan</Label>
              <Controller
                name="subscription_tier"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="subscription_tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="field_ops">{TIER_LABEL.field_ops} - KES {TIER_PRICING.field_ops.base}/mo</SelectItem>
                      <SelectItem value="pro">{TIER_LABEL.pro} - KES {TIER_PRICING.pro.base}/mo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">You'll pay for this plan on the next step.</p>
            </div>
            <Button type="submit" variant="construction" size="touch" className="w-full">
              Continue to Payment
            </Button>
          </form>
        )}

        {step === 'payment' && details && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              &larr; Back to site details
            </button>
            <p className="text-sm text-foreground">
              {details.site_name} &mdash; {TIER_LABEL[details.subscription_tier]}
            </p>
            <div className="flex items-start gap-2">
              <Checkbox id="include_bot" checked={includeBot} onCheckedChange={(checked) => setIncludeBot(checked === true)} />
              <Label htmlFor="include_bot" className="text-sm font-normal leading-snug">
                Add the WhatsApp Bot assistant (+{formatKES(botAddonPrice)}/mo)
              </Label>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
              <p className="text-sm text-foreground">
                Send <span className="font-medium">{formatKES(amount)}</span> via M-Pesa (Send Money) to:
              </p>
              <p className="font-display text-2xl text-primary">{MANUAL_PAYMENT_PHONE_DISPLAY}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpesa_code">M-Pesa confirmation code (optional)</Label>
              <Input
                id="mpesa_code"
                placeholder="e.g. QFT1XXXXXX"
                value={mpesaCode}
                onChange={(e) => setMpesaCode(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your site is created once you submit below, and goes live once an admin confirms this payment and approves it.
            </p>
            <Button
              variant="construction"
              size="touch"
              className="w-full"
              onClick={handleReportPayment}
              disabled={createSite.isPending}
            >
              {createSite.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
              I've Sent the Payment
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
            <p className="text-foreground font-medium">Site created</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              We'll confirm your payment and an admin will review the site shortly. You can check its status from Your Sites.
            </p>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
