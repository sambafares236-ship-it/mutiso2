// Shared pricing constants for the frontend (tier picker, pay dialog, landing
// page). supabase/functions/mpesa-stk-push/index.ts keeps its own copy of
// these same 4 numbers - a Deno Edge Function can't import from src/lib, and
// this is a small enough fixed set that duplication is cheaper than sharing
// infrastructure for it. If these prices ever change, update both places.
export type SubscriptionTier = 'field_ops' | 'pro';

export const TIER_PRICING: Record<SubscriptionTier, { base: number; withBot: number }> = {
  field_ops: { base: 2500, withBot: 4000 },
  pro: { base: 5000, withBot: 7000 },
};

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  field_ops: 'Field Ops & Safety',
  pro: 'Pro',
};
