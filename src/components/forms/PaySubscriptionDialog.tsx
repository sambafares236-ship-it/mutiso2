import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Smartphone, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatKES } from '@/lib/utils';
import { TIER_PRICING, TIER_LABEL, type SubscriptionTier } from '@/lib/pricing';
import { PAYMENT_MODE, MANUAL_PAYMENT_PHONE_DISPLAY } from '@/lib/payment';
import {
  useInitiateSubscriptionPayment,
  useSubscriptionPaymentStatus,
  useInvalidateSitesAfterPayment,
  useRequestManualPayment,
} from '@/hooks/useSubscriptionPayment';

interface PaySubscriptionDialogProps {
  siteId: string;
  siteName: string;
  subscriptionTier: SubscriptionTier;
  open: boolean;
  onClose: () => void;
}

export function PaySubscriptionDialog({ siteId, siteName, subscriptionTier, open, onClose }: PaySubscriptionDialogProps) {
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [includeBot, setIncludeBot] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [manualReported, setManualReported] = useState(false);
  const initiatePayment = useInitiateSubscriptionPayment();
  const requestManualPayment = useRequestManualPayment();
  const { data: payment } = useSubscriptionPaymentStatus(checkoutRequestId);
  const invalidateSites = useInvalidateSitesAfterPayment();

  const pricing = TIER_PRICING[subscriptionTier];
  const amount = includeBot ? pricing.withBot : pricing.base;
  const botAddonPrice = pricing.withBot - pricing.base;

  useEffect(() => {
    if (!open) {
      setCheckoutRequestId(null);
      setIncludeBot(false);
      setMpesaCode('');
      setManualReported(false);
    }
  }, [open]);

  useEffect(() => {
    if (payment?.status === 'completed') {
      toast.success('Payment received', { description: `${siteName}'s subscription has been extended.` });
      invalidateSites();
    } else if (payment?.status === 'failed') {
      toast.error('Payment failed', { description: 'The M-Pesa payment was not completed. You can try again.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.status]);

  const handlePay = async () => {
    try {
      const result = await initiatePayment.mutateAsync({ site_id: siteId, include_bot: includeBot });
      setCheckoutRequestId(result.checkout_request_id);
      toast.success('STK push sent', { description: 'Check your phone and enter your M-Pesa PIN.' });
    } catch (err) {
      toast.error('Could not start payment', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleReportManualPayment = async () => {
    try {
      await requestManualPayment.mutateAsync({
        site_id: siteId,
        include_bot: includeBot,
        mpesa_receipt_number: mpesaCode || undefined,
      });
      setManualReported(true);
      toast.success('Payment reported', { description: "We'll confirm it and extend your subscription shortly." });
    } catch (err) {
      toast.error('Could not report payment', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay / Renew Subscription</DialogTitle>
          <DialogDescription>
            {siteName} - {TIER_LABEL[subscriptionTier]}
          </DialogDescription>
        </DialogHeader>

        {PAYMENT_MODE === 'manual' && !manualReported && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="include_bot"
                checked={includeBot}
                onCheckedChange={(checked) => setIncludeBot(checked === true)}
              />
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
            <Button
              variant="construction"
              className="w-full"
              onClick={handleReportManualPayment}
              disabled={requestManualPayment.isPending}
            >
              {requestManualPayment.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              I've Sent the Payment
            </Button>
          </div>
        )}

        {PAYMENT_MODE === 'manual' && manualReported && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
            <p className="text-sm text-foreground">
              Payment reported. An admin will confirm it and extend this site's subscription shortly.
            </p>
          </div>
        )}

        {PAYMENT_MODE === 'stk_push' && !checkoutRequestId && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="include_bot"
                checked={includeBot}
                onCheckedChange={(checked) => setIncludeBot(checked === true)}
              />
              <Label htmlFor="include_bot" className="text-sm font-normal leading-snug">
                Add the WhatsApp Bot assistant (+{formatKES(botAddonPrice)}/mo)
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              This will send an M-Pesa STK push for <span className="font-medium text-foreground">{formatKES(amount)}</span> to
              the phone number on your profile, extending this site's subscription by one month.
            </p>
            <Button
              variant="construction"
              className="w-full"
              onClick={handlePay}
              disabled={initiatePayment.isPending}
            >
              {initiatePayment.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Smartphone className="w-4 h-4 mr-2" />
              )}
              Pay with M-Pesa
            </Button>
          </div>
        )}

        {PAYMENT_MODE === 'stk_push' && checkoutRequestId && payment?.status !== 'completed' && payment?.status !== 'failed' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Check your phone and enter your M-Pesa PIN to complete the payment...
            </p>
          </div>
        )}

        {payment?.status === 'completed' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
            <p className="text-sm text-foreground">
              Payment received{payment.mpesa_receipt_number ? ` (receipt ${payment.mpesa_receipt_number})` : ''}. Subscription
              extended.
            </p>
          </div>
        )}

        {payment?.status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-foreground">The payment was not completed.</p>
            <Button variant="outline" size="sm" onClick={() => setCheckoutRequestId(null)}>
              Try again
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
