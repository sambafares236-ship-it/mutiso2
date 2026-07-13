// Initiates a Safaricom Daraja STK Push against a site's monthly_rate,
// called from the "Pay / Renew" action in the contractor/super-admin UI.
// Requires a signed-in user (verify_jwt = true in config.toml).
//
// Secrets required (Supabase Edge Function secrets, set with
// `supabase secrets set NAME=value --project-ref <ref>` against BOTH the
// dev and prod projects separately - they are not shared):
//   MPESA_ENV               'sandbox' (default) or 'production'
//   MPESA_CONSUMER_KEY      from the Daraja app (sandbox: self-serve at
//                            developer.safaricom.co.ke; production: only
//                            after Safaricom's Go-Live vetting)
//   MPESA_CONSUMER_SECRET
//   MPESA_SHORTCODE          sandbox default test shortcode is 174379
//   MPESA_PASSKEY            sandbox passkey is published on the Daraja
//                            docs for shortcode 174379
//   MPESA_CALLBACK_URL       the public URL of the mpesa-stk-callback
//                            function, e.g.
//                            https://<project-ref>.supabase.co/functions/v1/mpesa-stk-callback
// Going from sandbox to production is purely swapping these secret values -
// no code change needed.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Edge Runtime, not set via `supabase secrets set`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MPESA_ENV = Deno.env.get('MPESA_ENV') ?? 'sandbox';
const MPESA_CONSUMER_KEY = Deno.env.get('MPESA_CONSUMER_KEY');
const MPESA_CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET');
const MPESA_SHORTCODE = Deno.env.get('MPESA_SHORTCODE');
const MPESA_PASSKEY = Deno.env.get('MPESA_PASSKEY');
const MPESA_CALLBACK_URL = Deno.env.get('MPESA_CALLBACK_URL');

const DARAJA_BASE_URL =
  MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

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

// Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX -
// Daraja requires the 2547XXXXXXXX / 2541XXXXXXXX shape for PartyA/PhoneNumber.
function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let normalized: string;
  if (digits.startsWith('254') && digits.length === 12) {
    normalized = digits;
  } else if (digits.startsWith('0') && digits.length === 10) {
    normalized = `254${digits.slice(1)}`;
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    normalized = `254${digits}`;
  } else {
    return null;
  }
  return /^254[17]\d{8}$/.test(normalized) ? normalized : null;
}

// Kenya is UTC+3 year-round (no DST) - Daraja requires the timestamp/password
// in the shortcode's local time, not UTC.
function darajaTimestamp(date: Date): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${eat.getUTCFullYear()}${pad(eat.getUTCMonth() + 1)}${pad(eat.getUTCDate())}${pad(eat.getUTCHours())}${pad(eat.getUTCMinutes())}${pad(eat.getUTCSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  let payload: { site_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { site_id } = payload;
  if (!site_id) {
    return json({ error: 'Missing site_id' }, 400);
  }

  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    return json({ error: 'M-Pesa is not configured yet - contact support' }, 503);
  }

  // Scoped to the caller's own JWT so RLS itself is the authorization check -
  // a non-owner/non-admin gets no row back here, same as any other
  // owner-gated read in this app. No separate owns_site check duplicated.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const { data: site, error: siteError } = await callerClient
    .from('sites')
    .select('id, monthly_rate')
    .eq('id', site_id)
    .single();

  if (siteError || !site) {
    return json({ error: 'Site not found or you are not authorized for this site' }, 403);
  }

  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('phone_number')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.phone_number) {
    return json({ error: 'Add a phone number to your profile before paying' }, 400);
  }

  const normalizedPhone = normalizeKenyanPhone(profile.phone_number);
  if (!normalizedPhone) {
    return json({ error: 'The phone number on your profile is not a valid Kenyan number' }, 400);
  }

  const tokenResp = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`)}` },
  });
  if (!tokenResp.ok) {
    console.error('mpesa-stk-push: OAuth failed', tokenResp.status, await tokenResp.text());
    return json({ error: 'Failed to authenticate with M-Pesa' }, 502);
  }
  const { access_token: accessToken } = await tokenResp.json();

  const timestamp = darajaTimestamp(new Date());
  const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`);
  const amount = Math.max(1, Math.round(Number(site.monthly_rate)));

  const stkResp = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: site_id,
      TransactionDesc: 'Mutiso.AI subscription renewal',
    }),
  });

  const stkData = await stkResp.json();
  if (!stkResp.ok || stkData.ResponseCode !== '0') {
    console.error('mpesa-stk-push: STK push failed', stkData);
    return json({ error: stkData.errorMessage ?? stkData.ResponseDescription ?? 'STK push failed' }, 502);
  }

  // Service-role client - subscription_payment has no INSERT policy for
  // authenticated by design, all writes go through this function.
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: insertError } = await serviceClient.from('subscription_payment').insert({
    site_id,
    amount,
    phone_number: normalizedPhone,
    checkout_request_id: stkData.CheckoutRequestID,
    merchant_request_id: stkData.MerchantRequestID,
    initiated_by: user.id,
  });

  if (insertError) {
    console.error('mpesa-stk-push: failed to record pending payment', insertError);
    return json(
      { error: 'STK push was sent but we failed to record it - contact support if your phone was charged' },
      500,
    );
  }

  return json({ checkout_request_id: stkData.CheckoutRequestID }, 200);
});
