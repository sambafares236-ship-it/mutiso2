import { useState } from 'react';
import { X, CreditCard, AlertTriangle, Receipt, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSitePaymentHistory, isSubscriptionExpiringSoon, isSubscriptionExpired } from '@/hooks/useSubscriptionPayment';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TIER_LABEL, type SubscriptionTier } from '@/lib/pricing';
import { formatKES } from '@/lib/utils';
import { PaySubscriptionDialog } from '@/components/forms/PaySubscriptionDialog';

interface SubscriptionBillingViewProps {
  siteId: string;
  siteName: string;
  subscriptionTier: SubscriptionTier;
  whatsappBotEnabled: boolean;
  subscriptionEnd: string | null;
  onClose: () => void;
}

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  pending: Clock,
  failed: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-success',
  pending: 'text-muted-foreground',
  failed: 'text-destructive',
};

// The "somewhere on the dashboard, pay anytime" entry point - billing-only
// scope for this pass. The reminder banner only shows inside the 5-day
// window (or once expired) via isSubscriptionExpiringSoon()/
// isSubscriptionExpired() - stays quiet otherwise, no proactive nagging.
export function SubscriptionBillingView({
  siteId,
  siteName,
  subscriptionTier,
  whatsappBotEnabled,
  subscriptionEnd,
  onClose,
}: SubscriptionBillingViewProps) {
  const [payOpen, setPayOpen] = useState(false);
  const { data: payments, isLoading } = useSitePaymentHistory(siteId);

  const expired = isSubscriptionExpired(subscriptionEnd);
  const expiringSoon = !expired && isSubscriptionExpiringSoon(subscriptionEnd);
  const daysLeft = subscriptionEnd
    ? Math.ceil((new Date(subscriptionEnd).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl text-primary">BILLING</h2>
              <p className="text-sm text-muted-foreground">{siteName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="space-y-5">
          <div className="card-industrial p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">
                {TIER_LABEL[subscriptionTier]}
                {whatsappBotEnabled ? ' + WhatsApp Bot' : ''}
              </p>
            </div>
            {subscriptionEnd ? (
              <p className="text-sm text-muted-foreground">
                {expired ? 'Expired' : 'Active until'} {new Date(subscriptionEnd).toLocaleDateString('en-KE')}
                {!expired && daysLeft !== null ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ''}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription period yet.</p>
            )}
          </div>

          {(expired || expiringSoon) && (
            <div
              className={`card-industrial p-4 border-2 flex items-start gap-3 ${
                expired ? 'border-destructive' : 'border-primary'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${expired ? 'text-destructive' : 'text-primary'}`} />
              <div>
                <p className="font-medium text-foreground">
                  {expired ? 'Subscription expired' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {expired
                    ? 'Site management features are paused until this is renewed.'
                    : 'Renew now to avoid any interruption once it lapses.'}
                </p>
              </div>
            </div>
          )}

          <Button variant="construction" size="touch" className="w-full" onClick={() => setPayOpen(true)}>
            <CreditCard className="w-4 h-4 mr-2" /> Pay / Renew
          </Button>

          <div className="space-y-3">
            <h3 className="font-display text-lg text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Payment History
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : !payments?.length ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const Icon = STATUS_ICON[p.status] ?? Clock;
                  return (
                    <div key={p.id} className="bg-secondary rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${STATUS_COLOR[p.status] ?? 'text-muted-foreground'}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {formatKES(p.amount)}
                            {p.includes_bot ? ' (+bot)' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.initiated_at).toLocaleDateString('en-KE')} &middot; {p.payment_method === 'manual' ? 'Manual' : 'M-Pesa'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs capitalize flex-shrink-0 ${STATUS_COLOR[p.status] ?? ''}`}>{p.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PaySubscriptionDialog
        siteId={siteId}
        siteName={siteName}
        subscriptionTier={subscriptionTier}
        open={payOpen}
        onClose={() => setPayOpen(false)}
      />
    </div>
  );
}
