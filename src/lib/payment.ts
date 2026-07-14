// Interim payment mode switch. 'manual' = contractor sends M-Pesa payment
// directly to MANUAL_PAYMENT_PHONE and self-reports it for Super Admin
// confirmation; 'stk_push' = the automated Daraja STK flow (mpesa-stk-push
// Edge Function), which needs production Daraja credentials to actually
// charge real money. Flip this back to 'stk_push' once those are live -
// nothing else needs to change, both code paths stay intact.
export const PAYMENT_MODE: 'manual' | 'stk_push' = 'manual';

export const MANUAL_PAYMENT_PHONE_DISPLAY = '0700 920 985';
