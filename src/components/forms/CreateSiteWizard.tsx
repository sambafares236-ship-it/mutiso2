import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building, X, Loader2, Send, CheckCircle2, MessageCircle, Sparkles, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useCreateSiteWithManualPayment, useStartTrialSite } from '@/hooks/useSubscriptionPayment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TIER_PRICING, TIER_LABEL, type SubscriptionTier } from '@/lib/pricing';
import { MANUAL_PAYMENT_PHONE_DISPLAY } from '@/lib/payment';
import { formatKES } from '@/lib/utils';
import { cn } from '@/lib/utils';

const detailsSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  location: z.string().optional(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

// A plan is either the free trial or a (tier, bot) pair. The WhatsApp add-on
// used to be an unchecked checkbox on the payment step, which is why every
// site created so far had it switched off - people skipped straight past it
// without ever registering that the assistant existed. It is now one of the
// plans you pick, so choosing it is a decision rather than something you have
// to notice.
type PlanId = 'trial' | 'field_ops' | 'field_ops_bot' | 'pro' | 'pro_bot';

interface PlanOption {
  id: PlanId;
  tier: SubscriptionTier;
  bot: boolean;
  price: number;
}

const PAID_PLANS: PlanOption[] = [
  { id: 'field_ops', tier: 'field_ops', bot: false, price: TIER_PRICING.field_ops.base },
  { id: 'field_ops_bot', tier: 'field_ops', bot: true, price: TIER_PRICING.field_ops.withBot },
  { id: 'pro', tier: 'pro', bot: false, price: TIER_PRICING.pro.base },
  { id: 'pro_bot', tier: 'pro', bot: true, price: TIER_PRICING.pro.withBot },
];

interface CreateSiteWizardProps {
  onClose: () => void;
}

// Three-step overlay. Nothing is written to the database until the final
// submit of whichever branch you take - going back or cancelling leaves no
// trace, since a paid site row is not allowed to exist without a payment
// record beside it (create_site_with_manual_payment() inserts both
// atomically). The trial is the one deliberate exception: start_trial_site()
// creates an active site with no payment at all, once per contractor.
// Manual payment only for this pass - PAYMENT_MODE is 'manual' in
// src/lib/payment.ts, the STK path stays dormant until production Daraja
// credentials are live.
export function CreateSiteWizard({ onClose }: CreateSiteWizardProps) {
  const [step, setStep] = useState<'details' | 'plan' | 'payment' | 'done'>('details');
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');

  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const createSite = useCreateSiteWithManualPayment();
  const startTrial = useStartTrialSite();

  // One trial per contractor, ever - enforced in start_trial_site(); this only
  // decides whether to offer it.
  const trialAvailable = !!profile && profile.trial_used_at === null;
  const hasPhone = !!profile?.phone_number && profile.phone_number.trim() !== '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema) });

  const onDetailsSubmit = (values: DetailsValues) => {
    setDetails(values);
    setStep('plan');
  };

  const selected = PAID_PLANS.find((p) => p.id === plan) ?? null;

  const handlePlanContinue = async () => {
    if (!details || !plan) return;

    if (plan === 'trial') {
      try {
        await startTrial.mutateAsync({ site_name: details.site_name, location: details.location });
        setStep('done');
        toast.success('Free trial started', {
          description: `${details.site_name} is live for 7 days, WhatsApp assistant included.`,
        });
      } catch (err) {
        toast.error('Could not start trial', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
      return;
    }

    setStep('payment');
  };

  const handleReportPayment = async () => {
    if (!details || !selected) return;
    try {
      await createSite.mutateAsync({
        site_name: details.site_name,
        location: details.location,
        subscription_tier: selected.tier,
        include_bot: selected.bot,
        mpesa_receipt_number: mpesaCode || undefined,
      });
      setStep('done');
      toast.success('Site created', {
        description: `${details.site_name} is awaiting payment confirmation and admin approval.`,
      });
    } catch (err) {
      toast.error('Could not create site', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

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
            <Button type="submit" variant="construction" size="touch" className="w-full">
              Choose a Plan
            </Button>
          </form>
        )}

        {step === 'plan' && details && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep('details')}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              &larr; Back to site details
            </button>
            <p className="text-sm text-foreground">{details.site_name}</p>

            {profileLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {trialAvailable && (
                  <button
                    type="button"
                    onClick={() => setPlan('trial')}
                    aria-pressed={plan === 'trial'}
                    className={cn(
                      'w-full text-left rounded-lg border-2 p-4 transition-colors',
                      plan === 'trial'
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/30 hover:border-primary/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        7-day free trial
                      </span>
                      <span className="font-display text-xl text-primary">FREE</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TIER_LABEL.field_ops} with the WhatsApp assistant. Live straight away, no
                      payment and no waiting for approval.
                    </p>
                    {!hasPhone && (
                      <p className="text-xs text-destructive mt-2">
                        Add your WhatsApp number in Settings first &mdash; the assistant needs it to
                        recognise you.
                      </p>
                    )}
                  </button>
                )}

                {PAID_PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    aria-pressed={plan === p.id}
                    className={cn(
                      'w-full text-left rounded-lg border-2 p-4 transition-colors',
                      plan === p.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/30 hover:border-primary/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{TIER_LABEL[p.tier]}</span>
                      <span className="font-display text-xl text-primary">
                        {formatKES(p.price)}
                        <span className="text-xs text-muted-foreground font-sans">/mo</span>
                      </span>
                    </div>
                    {p.bot ? (
                      <p className="text-xs text-success mt-1 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Includes the WhatsApp assistant
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Without the WhatsApp assistant
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="construction"
              size="touch"
              className="w-full"
              onClick={handlePlanContinue}
              disabled={!plan || startTrial.isPending || (plan === 'trial' && !hasPhone)}
            >
              {startTrial.isPending && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              {plan === 'trial' ? 'Start Free Trial' : 'Continue to Payment'}
            </Button>
          </div>
        )}

        {step === 'payment' && details && selected && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setStep('plan')}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              &larr; Back to plans
            </button>
            <p className="text-sm text-foreground">
              {details.site_name} &mdash; {TIER_LABEL[selected.tier]}
              {selected.bot && ' + WhatsApp assistant'}
            </p>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
              <p className="text-sm text-foreground">
                Send <span className="font-medium">{formatKES(selected.price)}</span> via M-Pesa
                (Send Money) to:
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
              Your site is created once you submit below, and goes live once an admin confirms this
              payment and approves it.
            </p>
            <Button
              variant="construction"
              size="touch"
              className="w-full"
              onClick={handleReportPayment}
              disabled={createSite.isPending}
            >
              {createSite.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              I&apos;ve Sent the Payment
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
            {plan === 'trial' ? (
              <>
                <p className="text-foreground font-medium">Your 7-day trial is live</p>
                <div className="text-sm text-muted-foreground max-w-xs space-y-2">
                  <p>
                    {details?.site_name} is ready to use right now &mdash; no approval needed.
                  </p>
                  <p className="flex items-start gap-1.5 text-left">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    Message the WhatsApp assistant from your registered number and ask how the site
                    is doing.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-foreground font-medium">Site created</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  We&apos;ll confirm your payment and an admin will review the site shortly. You can
                  check its status from Your Sites.
                </p>
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
