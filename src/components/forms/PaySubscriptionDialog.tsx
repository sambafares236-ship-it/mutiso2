import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatKES } from '@/lib/utils';
import {
  useInitiateSubscriptionPayment,
  useSubscriptionPaymentStatus,
  useInvalidateSitesAfterPayment,
} from '@/hooks/useSubscriptionPayment';

interface PaySubscriptionDialogProps {
  siteId: string;
  siteName: string;
  monthlyRate: number;
  open: boolean;
  onClose: () => void;
}

export function PaySubscriptionDialog({ siteId, siteName, monthlyRate, open, onClose }: PaySubscriptionDialogProps) {
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const initiatePayment = useInitiateSubscriptionPayment();
  const { data: payment } = useSubscriptionPaymentStatus(checkoutRequestId);
  const invalidateSites = useInvalidateSitesAfterPayment();

  useEffect(() => {
    if (!open) setCheckoutRequestId(null);
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
      const result = await initiatePayment.mutateAsync(siteId);
      setCheckoutRequestId(result.checkout_request_id);
      toast.success('STK push sent', { description: 'Check your phone and enter your M-Pesa PIN.' });
    } catch (err) {
      toast.error('Could not start payment', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay / Renew Subscription</DialogTitle>
          <DialogDescription>{siteName}</DialogDescription>
        </DialogHeader>

        {!checkoutRequestId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will send an M-Pesa STK push for <span className="font-medium text-foreground">{formatKES(monthlyRate)}</span> to
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

        {checkoutRequestId && payment?.status !== 'completed' && payment?.status !== 'failed' && (
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
