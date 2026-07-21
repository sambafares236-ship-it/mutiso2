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
  payment_method: 'mpesa_stk' | 'manual';
  phone_number: string;
  initiated_at: string;
  completed_at: string | null;
}

export interface PendingManualPayment extends SubscriptionPayment {
  site_name: string;
}

// Passive expiry checks, same pattern as isExpiringSoon() in
// useCertifications.tsx - computed client-side, no DB trigger/cron. Used to
// decide when the Billing view's reminder banner shows (only inside the
// 5-day window, or once already expired) so a healthy subscription stays
// visually quiet.
export function isSubscriptionExpiringSoon(subscriptionEnd: string | null, thresholdDays = 5): boolean {
  if (!subscriptionEnd) return false;
  const end = new Date(subscriptionEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= thresholdDays;
}

export function isSubscriptionExpired(subscriptionEnd: string | null): boolean {
  if (!subscriptionEnd) return false;
  const end = new Date(subscriptionEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

// Creates a site and its first (manual) subscription payment atomically via
// create_site_with_manual_payment() - the site row cannot exist without a
// payment record alongside it. STK mode is dormant (PAYMENT_MODE ===
// 'manual' in src/lib/payment.ts) so only the manual path is wired up here.
export function useCreateSiteWithManualPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      site_name,
      location,
      subscription_tier,
      include_bot,
      mpesa_receipt_number,
    }: {
      site_name: string;
      location?: string;
      subscription_tier: 'field_ops' | 'pro';
      include_bot: boolean;
      mpesa_receipt_number?: string;
    }): Promise<{ site_id: string; payment_id: string }> => {
      const { data, error } = await supabase
        .rpc('create_site_with_manual_payment', {
          p_site_name: site_name,
          p_location: location || undefined,
          p_subscription_tier: subscription_tier,
          p_includes_bot: include_bot,
          p_mpesa_receipt_number: mpesa_receipt_number || undefined,
        })
        .single();
      if (error) throw error;
      return data as { site_id: string; payment_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
    },
  });
}

// DORMANT - nothing calls this. The 7-day free trial was built and then
// deliberately withdrawn in favour of payment from the start; onboarding is
// payment-first again (CreateSiteWizard has no trial option and the landing
// page makes no trial offer). The backing schema (sites.is_trial,
// profiles.trial_used_at, start_trial_site()) was left in place rather than
// dropped, so re-enabling the trial is a UI change rather than another
// migration. Kept in sync with that RPC on purpose - delete both together or
// neither.
//
// Starts the one free trial a contractor gets: a Field Ops site with the
// WhatsApp assistant, active immediately for 7 days and with no payment row
// at all (see 20260731091800). Eligibility lives on the profile rather than
// being inferred from their sites, so deleting a trial site doesn't hand out
// a second trial.
export function useStartTrialSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      site_name,
      location,
    }: {
      site_name: string;
      location?: string;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('start_trial_site', {
        p_site_name: site_name,
        p_location: location || undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
      // trial_used_at just changed, so anything gating on eligibility must refetch.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Full payment history for one site - powers the Billing view. Same RLS
// policy as useSubscriptionPaymentStatus/usePendingManualPayments
// ("Site owner can view their subscription payments"), now routed through
// is_site_owner() rather than owns_site() so this keeps working even for an
// expired site's owner trying to see what they've paid so far.
export function useSitePaymentHistory(siteId: string | undefined) {
  return useQuery({
    queryKey: ['sitePaymentHistory', siteId],
    queryFn: async (): Promise<SubscriptionPayment[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('subscription_payment')
        .select('*')
        .eq('site_id', siteId)
        .order('initiated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SubscriptionPayment[];
    },
    enabled: !!siteId,
  });
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
    queryClient.invalidateQueries({ queryKey: ['pendingManualPayments'] });
    queryClient.invalidateQueries({ queryKey: ['revenueSummary'] });
    queryClient.invalidateQueries({ queryKey: ['clientRoster'] });
  };
}

// Self-reports a manual M-Pesa payment as pending - does NOT extend the
// subscription itself. Only a Super Admin confirming it (below) does that.
export function useRequestManualPayment() {
  return useMutation({
    mutationFn: async ({
      site_id,
      include_bot,
      mpesa_receipt_number,
    }: {
      site_id: string;
      include_bot: boolean;
      mpesa_receipt_number?: string;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('request_manual_subscription_payment', {
        p_site_id: site_id,
        p_includes_bot: include_bot,
        p_mpesa_receipt_number: mpesa_receipt_number || undefined,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

export function usePendingManualPayments() {
  return useQuery({
    queryKey: ['pendingManualPayments'],
    queryFn: async (): Promise<PendingManualPayment[]> => {
      const { data, error } = await supabase
        .from('subscription_payment')
        .select('*, sites(site_name)')
        .eq('payment_method', 'manual')
        .eq('status', 'pending')
        .order('initiated_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { sites, ...rest } = row as typeof row & { sites: { site_name: string } | null };
        return { ...rest, site_name: sites?.site_name ?? 'Unknown site' } as PendingManualPayment;
      });
    },
  });
}

export interface CompletedPayment extends SubscriptionPayment {
  site_name: string;
}

// All-time completed payments across every client (super admin only - RLS
// restricts this table to a site's own owner or an admin/super_admin role).
// Total revenue is derived client-side from the same list rather than a
// separate aggregate query, since the transaction list is already needed for
// display and the row count here is not large enough to warrant a
// server-side sum.
export function useRevenueSummary() {
  return useQuery({
    queryKey: ['revenueSummary'],
    queryFn: async (): Promise<{ total: number; payments: CompletedPayment[] }> => {
      const { data, error } = await supabase
        .from('subscription_payment')
        .select('*, sites(site_name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      const payments = (data ?? []).map((row) => {
        const { sites, ...rest } = row as typeof row & { sites: { site_name: string } | null };
        return { ...rest, site_name: sites?.site_name ?? 'Unknown site' } as CompletedPayment;
      });
      const total = payments.reduce((sum, p) => sum + p.amount, 0);
      return { total, payments };
    },
  });
}

export function useConfirmManualPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payment_id, mpesa_receipt_number }: { payment_id: string; mpesa_receipt_number?: string }) => {
      const { error } = await supabase.rpc('confirm_manual_subscription_payment', {
        p_payment_id: payment_id,
        p_mpesa_receipt_number: mpesa_receipt_number || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingManualPayments'] });
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
      queryClient.invalidateQueries({ queryKey: ['pendingSites'] });
      queryClient.invalidateQueries({ queryKey: ['revenueSummary'] });
      queryClient.invalidateQueries({ queryKey: ['clientRoster'] });
    },
  });
}
