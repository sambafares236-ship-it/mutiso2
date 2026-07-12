import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKES(amount: number | null | undefined, currency = 'KES') {
  if (amount === null || amount === undefined) return `${currency} 0`;
  return `${currency} ${amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

// A plain `<a href download>` doesn't force a download for a cross-origin
// URL (Supabase signed URLs aren't same-origin) - browsers silently
// ignore the `download` attribute and just navigate instead. Fetching the
// blob and downloading via an object URL works regardless of origin.
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
