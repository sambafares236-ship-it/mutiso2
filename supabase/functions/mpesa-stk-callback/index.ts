// Safaricom's callback after an STK Push is approved/rejected/times out on
// the customer's phone. No user JWT exists here at all (Safaricom calls
// this directly) - verify_jwt = false in config.toml, matching the
// "Safaricom has no Supabase session" reasoning documented there.
//
// Known limitation, deliberate for this v1: Daraja does not sign callbacks
// with a shared secret the way most webhook providers do, so this endpoint
// trusts the CheckoutRequestID in the callback body to match a real pending
// row. A caller who somehow knew a genuine, still-pending CheckoutRequestID
// could POST a forged "completed" callback and get a free month - the blast
// radius is low (this app's subscription amount, not an arbitrary payment
// value) and the ID is an unguessable Safaricom-generated string, but
// hardening this further (e.g. independently confirming via Daraja's STK
// Push Query API before trusting the callback) is a real fast-follow before
// this handles large transaction volumes, not done here.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// Edge Runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface StkCallbackItem {
  Name: string;
  Value?: string | number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: {
    Body?: {
      stkCallback?: {
        CheckoutRequestID?: string;
        ResultCode?: number;
        CallbackMetadata?: { Item?: StkCallbackItem[] };
      };
    };
  };
  try {
    body = await req.json();
  } catch {
    console.error('mpesa-stk-callback: invalid JSON body');
    return json({ ResultCode: 0, ResultDesc: 'Accepted' }, 200);
  }

  const callback = body?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    console.error('mpesa-stk-callback: malformed callback body', body);
    // Still 200 - Safaricom retries indefinitely on non-2xx, and there is
    // nothing more actionable to do with a body missing its own key.
    return json({ ResultCode: 0, ResultDesc: 'Accepted' }, 200);
  }

  const status = callback.ResultCode === 0 ? 'completed' : 'failed';

  let mpesaReceiptNumber: string | null = null;
  if (status === 'completed') {
    const items = callback.CallbackMetadata?.Item ?? [];
    const receiptItem = items.find((item) => item.Name === 'MpesaReceiptNumber');
    mpesaReceiptNumber = receiptItem?.Value != null ? String(receiptItem.Value) : null;
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await serviceClient.rpc('complete_subscription_payment', {
    p_checkout_request_id: callback.CheckoutRequestID,
    p_status: status,
    p_mpesa_receipt_number: mpesaReceiptNumber,
  });

  if (error) {
    console.error('mpesa-stk-callback: complete_subscription_payment failed', error);
  }

  // Always acknowledge with 200 + this shape so Safaricom stops retrying,
  // regardless of our internal outcome.
  return json({ ResultCode: 0, ResultDesc: 'Accepted' }, 200);
});
