// Mirrors supabase/functions/mpesa-stk-push/index.ts's normalizeKenyanPhone
// exactly - a Deno Edge Function can't import from src/lib, same reasoning
// as the pricing duplication in src/lib/pricing.ts. Keep both in sync.
// Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX and
// normalizes to the 2547XXXXXXXX / 2541XXXXXXXX shape Daraja and WhatsApp's
// sender number both use.
export function normalizeKenyanPhone(raw: string): string | null {
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

// Display-only helper. Deliberately NOT part of the Edge Function mirror above -
// nothing server-side formats numbers, so this one has no counterpart to keep
// in sync. 254712345678 -> +254 712 345 678; anything that isn't in the stored
// shape is returned as-is so legacy rows still render something readable.
export function formatKenyanPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const normalized = normalizeKenyanPhone(stored);
  if (!normalized) return stored;
  const n = normalized.slice(3);
  return `+254 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
