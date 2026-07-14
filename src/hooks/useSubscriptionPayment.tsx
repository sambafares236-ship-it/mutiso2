import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionPaymentStatus = 'pending' | 'completed' | 'failed';

export interface SubscriptionPayment {
  id: string;
  site_id: string;
  amount: number;
  includes_bot: boolean;
  status: SubscriptionPaymentStatus;
  checkout_request_id: string;
  mpesa_receipt_number: string | null;
  initiated_at: string;
  completed_at: string | null;
}

// Kicks off an STK Push via the mpesa-stk-push Edge Function. The function
// itself resolves the amount (from the site's subscription_tier + include_bot)
// and phone number (the caller's own profile) server-side.
export function useInitiateSubscriptionPayment() {
  return useMutation({
    mutationFn: async ({
      site_id,
      include_bot,
    }: {
      site_id: string;
      include_bot: boolean;
    }): Promise<{ checkout_request_id: string }> => {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: { site_id, include_bot },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}

// Polls subscription_payment for the row initiated above - there is no
// realtime subscription here since this is a short-lived, one-shot status
// check (the user is staring at a "check your phone" dialog for at most a
// couple of minutes), not an ongoing data feed.
export function useSubscriptionPaymentStatus(checkoutRequestId: string | null) {
  return useQuery({
    queryKey: ['subscriptionPaymentStatus', checkoutRequestId],
    queryFn: async (): Promise<SubscriptionPayment | null> => {
      if (!checkoutRequestId) return null;
      const { data, error } = await supabase
        .from('subscription_payment')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionPayment | null;
    },
    enabled: !!checkoutRequestId,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  });
}

export function useInvalidateSitesAfterPayment() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['adminSites'] });
    queryClient.invalidateQueries({ queryKey: ['pendingSites'] });
  };
}
