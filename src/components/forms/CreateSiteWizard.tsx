import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building, X, Loader2, Send, CheckCircle2, Sparkles } from 'lucide-react';
import { useCreateSiteWithManualPayment, useStartTrialSite } from '@/hooks/useSubscriptionPayment';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIER_PRICING, TIER_LABEL, type SubscriptionTier } from '@/lib/pricing';
import { MANUAL_PAYMENT_PHONE_DISPLAY } from '@/lib/payment';
import { formatKES } from '@/lib/utils';
import { cn } from '@/lib/utils';

const detailsSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  location: z.string().optional(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

// A plan is a (tier, bot) pair. The WhatsApp add-on used to be an unchecked
// checkbox on the payment step, which is why every site created before this
// had it switched off - people skipped past it without registering that the
// assistant existed, then reported the bot as broken. It is now one of the
// plans you pick, so choosing it is a decision rather than something you have
// to notice.
type PlanId = 'field_ops' | 'field_ops_bot' | 'pro' | 'pro_bot' | 'trial';

interface PlanOption {
  id: PlanId;
  tier: SubscriptionTier;
  bot: boolean;
  price: number;
}

const PLANS: PlanOption[] = [
  { id: 'field_ops', tier: 'field_ops', bot: false, price: TIER_PRICING.field_ops.base },
  { id: 'pro', tier: 'pro', bot: false, price: TIER_PRICING.pro.base },
];

// Trial is a full Pro-tier site for 7 days, no payment. Kept as a distinct
// pseudo-plan rather than a PlanOption entry since it has no price and
// skips the payment step entirely (see handleStartTrial below).

interface CreateSiteWizardProps {
  onClose: () => void;
}

// Three-step overlay: details -> plan -> payment. Nothing is written to the
// database until the final submit, so going back or cancelling leaves no
// trace - a paid site row is not allowed to exist without a payment record
// beside it (create_site_with_manual_payment() inserts both atomically).
//
// Trial is the one exception to that "payment first" rule: an eligible
// contractor (trial_used_at still null on their profile) sees a Free 7-Day
// Trial option on the plan step. Picking it calls start_trial_site()
// directly and skips the payment step entirely - the site goes active with
// full Pro-tier access immediately, no admin approval needed. One trial per
// account: once used, trial_used_at is set and this option stops appearing
// (also enforced server-side by the RPC, not just hidden client-side).
//
// Manual payment only for this pass - PAYMENT_MODE is 'manual' in
// src/lib/payment.ts, the STK path stays dormant until production Daraja
// credentials are live.
export function CreateSiteWizard({ onClose }: CreateSiteWizardProps) {
  const [step, setStep] = useState<'details' | 'plan' | 'payment' | 'done'>('details');
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');
  const [trialSiteName, setTrialSiteName] = useState<string | null>(null);

  const createSite = useCreateSiteWithManualPayment();
  const startTrial = useStartTrialSite();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  // trial_used_at is non-null the moment a trial is started (see
  // start_trial_site()), so this is a live eligibility check, not just a
  // display toggle - the RPC itself would reject a second attempt regardless.
  const trialEligible = !!profile && !profile.trial_used_at;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema) });

  const onDetailsSubmit = (values: DetailsValues) => {
    setDetails(values);
    setStep('plan');
  };

  const selected = PLANS.find((p) => p.id === plan) ?? null;

  // Trial has no payment step - the site is created active immediately, so
  // this goes straight from the plan step to 'done'.
  const handleStartTrial = async () => {
    if (!details) return;
    try {
      await startTrial.mutateAsync({
        site_name: details.site_name,
        location: details.location,
      });
      setTrialSiteName(details.site_name);
      setStep('done');
    } catch (err) {
      toast.error('Could not start trial', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
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

            {trialEligible && (
              <button
                type="button"
                onClick={() => setPlan('trial')}
                aria-pressed={plan === 'trial'}
                className={cn(
                  'w-full text-left rounded-lg border-2 p-4 transition-colors',
                  plan === 'trial'
                    ? 'border-primary bg-primary/10'
                    : 'border-primary/60 bg-primary/5 hover:border-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Free 7-Day Trial
                  </span>
                  <span className="font-display text-xl text-primary">
                    {formatKES(0)}
                    <span className="text-xs text-muted-foreground font-sans">/wk</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Full {TIER_LABEL.pro} access on one site, no payment required. One trial per account.
                </p>
              </button>
            )}

            <div className="space-y-3">
              {PLANS.map((p) => (
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
                </button>
              ))}
            </div>

            <Button
              variant="construction"
              size="touch"
              className="w-full"
              onClick={() => (plan === 'trial' ? handleStartTrial() : setStep('payment'))}
              disabled={!plan || startTrial.isPending}
            >
              {startTrial.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : null}
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
            <p className="text-foreground font-medium">
              {trialSiteName ? `${trialSiteName} is live` : 'Site created'}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {trialSiteName
                ? `Your 7-day free trial has started with full ${TIER_LABEL.pro} access. Add a plan any time from Billing before it ends.`
                : "We'll confirm your payment and an admin will review the site shortly. You can check its status from Your Sites."}
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