// Sends the foreman invite email via Resend. Called (fire-and-forget) from
// useCreateInvite() right after the invite row is written - a delivery
// failure here must never block invite creation, since the contractor can
// always fall back to copying the /join link manually.
//
// Requires the RESEND_API_KEY secret (Supabase Edge Function secret, not a
// repo env var - set it with:
//   supabase secrets set RESEND_API_KEY=re_xxx --project-ref kmcgcqnuxixsxqwigfir
// Optionally RESEND_FROM_EMAIL to override the default sender. Resend also
// requires the sending domain to be verified before it can deliver to
// arbitrary recipients - until RESEND_API_KEY is set, this function no-ops
// and logs a warning rather than erroring, so the invite flow keeps working
// via manual link sharing in the meantime.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Mutiso.AI <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteEmailPayload {
  to: string;
  site_name: string;
  join_url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: InviteEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { to, site_name, join_url } = payload;
  if (!to || !site_name || !join_url) {
    return new Response(JSON.stringify({ error: 'Missing to, site_name, or join_url' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    console.warn('send-invite-email: RESEND_API_KEY not set, skipping send', { to, site_name });
    return new Response(JSON.stringify({ sent: false, reason: 'RESEND_API_KEY not configured' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">You've been invited to Mutiso.AI</h2>
      <p>You've been invited to join <strong>${site_name}</strong> as a foreman.</p>
      <p>
        <a href="${join_url}" style="display: inline-block; background: #f5c518; color: #1a1a1a; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Accept Invite
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">This link expires in 7 days and can only be used with this email address.</p>
    </div>
  `;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `You're invited to ${site_name} on Mutiso.AI`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error('send-invite-email: Resend API error', resendResponse.status, errorText);
    return new Response(JSON.stringify({ sent: false, error: errorText }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
