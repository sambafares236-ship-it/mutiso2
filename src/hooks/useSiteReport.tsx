import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReportEntry {
  id: string;
  type:
    | 'attendance'
    | 'visitor'
    | 'delivery'
    | 'usage'
    | 'diary'
    | 'photo'
    | 'incident'
    | 'toolbox_talk'
    | 'inspection'
    | 'defect'
    | 'tool'
    | 'petty_cash';
  title: string;
  description?: string | null;
  amount?: string;
  date: string; // ISO date or timestamp, used for sorting/display
  /** Photo entries only - a signed URL to open the full image on tap. */
  imageUrl?: string;
  /** Diary entries only - signed URLs for every photo a foreman attached
   * to this entry, grouped under its title/description as their caption.
   * Freestanding photos (not attached to a diary entry) stay separate
   * `photo`-type entries and don't appear here. */
  images?: string[];
}

// Pulls from every Stage 2-4 log table for a site + date range and
// combines them into one reverse-chronological feed - this is the
// "daily/weekly site report" from the plan, and doubles as the general
// site history view. Read-only, not offline-queued (nothing to write).
export function useSiteReport(siteId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['siteReport', siteId, startDate, endDate],
    queryFn: async (): Promise<ReportEntry[]> => {
      if (!siteId) return [];

      const [attendance, visitors, deliveries, usage, diary, photos, incidents, talks, inspections, defects, toolCheckouts, toolReturns, pettyCash] = await Promise.all([
        supabase
          .from('attendance_log')
          .select('id, date, created_at, worker:workers_master(full_name)')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        // One row = one visit - sign-in and sign-out are the same event,
        // unlike tool checkout/return which get two separate report
        // entries (a tool can sit checked out across many days; a visit
        // doesn't work that way).
        supabase
          .from('visitor_log')
          .select('id, visitor_name, company, purpose, host_name, time_in, time_out')
          .eq('site_id', siteId)
          .gte('time_in', startDate)
          .lte('time_in', endDate + 'T23:59:59'),
        supabase
          .from('materials_delivered')
          .select('id, date, created_at, material_name, quantity, unit, supplier')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('material_usage_log')
          .select('id, date, created_at, material_name, quantity, unit, description')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('site_diary_log')
          .select('id, date, created_at, title, description, category')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('site_photos')
          .select('id, created_at, category, caption, photo_url, diary_id')
          .eq('site_id', siteId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59'),
        supabase
          .from('incident_log')
          .select('id, date, created_at, category, severity, description, photo_url')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('toolbox_talk_log')
          .select('id, date, created_at, topic')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('inspection_log')
          .select('id, date, created_at, flagged_count, template:inspection_template(name)')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('defect_log')
          .select('id, created_at, location, description, severity, status, photo_url')
          .eq('site_id', siteId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59'),
        supabase
          .from('tool_checkout_log')
          .select('id, checked_out_at, checked_out_to, tool:tool_inventory(tool_name)')
          .eq('site_id', siteId)
          .gte('checked_out_at', startDate)
          .lte('checked_out_at', endDate + 'T23:59:59'),
        supabase
          .from('tool_checkout_log')
          .select('id, returned_at, checked_out_to, condition_on_return, tool:tool_inventory(tool_name)')
          .eq('site_id', siteId)
          .not('returned_at', 'is', null)
          .gte('returned_at', startDate)
          .lte('returned_at', endDate + 'T23:59:59'),
        supabase
          .from('petty_cash_log')
          .select('id, date, created_at, amount, description, receipt_photo_url')
          .eq('site_id', siteId)
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      // Bucket is private - each photo needs its own signed URL, same as
      // useSitePhotos, so a report entry can be tapped open for full-size
      // viewing rather than just showing its caption as inert text.
      const photoUrls = await Promise.all(
        (photos.data ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(p.photo_url, 60 * 60);
          return signed?.signedUrl;
        }),
      );

      // Same tap-to-open signed URL treatment for petty cash receipts.
      const pettyCashReceiptUrls = await Promise.all(
        (pettyCash.data ?? []).map(async (p) => {
          if (!p.receipt_photo_url) return undefined;
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(p.receipt_photo_url, 60 * 60);
          return signed?.signedUrl;
        }),
      );

      // Same for incident/defect report photos (defect_log.fixed_photo_url
      // is deliberately not surfaced here too - Site History is an event
      // log of "when this was reported," the fix photo belongs to
      // DefectsView where the full open->in_progress->resolved lifecycle
      // context exists).
      const incidentUrls = await Promise.all(
        (incidents.data ?? []).map(async (i) => {
          if (!i.photo_url) return undefined;
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(i.photo_url, 60 * 60);
          return signed?.signedUrl;
        }),
      );
      const defectUrls = await Promise.all(
        (defects.data ?? []).map(async (d) => {
          if (!d.photo_url) return undefined;
          const { data: signed } = await supabase.storage.from('site-photos').createSignedUrl(d.photo_url, 60 * 60);
          return signed?.signedUrl;
        }),
      );

      // Photos attached to a diary entry (diary_id set) are grouped under
      // that entry instead of also appearing as their own freestanding
      // `photo` entry - one photo shouldn't show up twice in the feed.
      const diaryPhotoUrls = new Map<string, string[]>();
      const freestandingPhotos: (NonNullable<typeof photos.data>[number] & { url?: string })[] = [];
      (photos.data ?? []).forEach((p, i) => {
        const url = photoUrls[i];
        if (p.diary_id && url) {
          const existing = diaryPhotoUrls.get(p.diary_id) ?? [];
          existing.push(url);
          diaryPhotoUrls.set(p.diary_id, existing);
        } else {
          freestandingPhotos.push({ ...p, url });
        }
      });

      const entries: ReportEntry[] = [
        ...(attendance.data ?? []).map((a) => ({
          id: `attendance-${a.id}`,
          type: 'attendance' as const,
          title: `${a.worker?.full_name ?? 'Worker'} marked present`,
          date: a.created_at,
        })),
        ...(visitors.data ?? []).map((v) => ({
          id: `visitor-${v.id}`,
          type: 'visitor' as const,
          title: `Visitor: ${v.visitor_name}`,
          description: [
            v.company,
            v.purpose,
            v.host_name && `Host: ${v.host_name}`,
            `In: ${new Date(v.time_in).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`,
            v.time_out
              ? `Out: ${new Date(v.time_out).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Still on site',
          ]
            .filter(Boolean)
            .join(' — '),
          date: v.time_in,
        })),
        ...(deliveries.data ?? []).map((d) => ({
          id: `delivery-${d.id}`,
          type: 'delivery' as const,
          title: `Delivery: ${d.material_name}`,
          description: d.supplier,
          amount: `+${d.quantity} ${d.unit ?? ''}`,
          date: d.created_at,
        })),
        ...(usage.data ?? []).map((u) => ({
          id: `usage-${u.id}`,
          type: 'usage' as const,
          title: `Usage: ${u.material_name}`,
          description: u.description,
          amount: `-${u.quantity} ${u.unit ?? ''}`,
          date: u.created_at,
        })),
        ...(diary.data ?? []).map((d) => ({
          id: `diary-${d.id}`,
          type: 'diary' as const,
          title: d.title,
          description: d.description,
          date: d.created_at,
          images: diaryPhotoUrls.get(d.id),
        })),
        ...freestandingPhotos.map((p) => ({
          id: `photo-${p.id}`,
          type: 'photo' as const,
          title: `Photo (${p.category})`,
          description: p.caption,
          date: p.created_at,
          imageUrl: p.url,
        })),
        ...(incidents.data ?? []).map((i, idx) => ({
          id: `incident-${i.id}`,
          type: 'incident' as const,
          title: `Incident (${i.severity}): ${i.category}`,
          description: i.description,
          date: i.created_at,
          imageUrl: incidentUrls[idx],
        })),
        ...(talks.data ?? []).map((t) => ({
          id: `talk-${t.id}`,
          type: 'toolbox_talk' as const,
          title: `Toolbox talk: ${t.topic}`,
          date: t.created_at,
        })),
        ...(inspections.data ?? []).map((i) => ({
          id: `inspection-${i.id}`,
          type: 'inspection' as const,
          title: `Inspection: ${i.template?.name ?? 'Checklist'}`,
          description: i.flagged_count > 0 ? `${i.flagged_count} item(s) flagged` : 'All items passed',
          date: i.created_at,
        })),
        ...(defects.data ?? []).map((d, idx) => ({
          id: `defect-${d.id}`,
          type: 'defect' as const,
          title: `Defect (${d.severity}): ${d.location ?? 'unspecified location'}`,
          description: `${d.description} — ${d.status}`,
          date: d.created_at,
          imageUrl: defectUrls[idx],
        })),
        ...(toolCheckouts.data ?? []).map((t) => ({
          id: `tool-checkout-${t.id}`,
          type: 'tool' as const,
          title: `Checked out: ${t.tool?.tool_name ?? 'Tool'}`,
          description: `To ${t.checked_out_to}`,
          date: t.checked_out_at,
        })),
        ...(toolReturns.data ?? []).map((t) => ({
          id: `tool-return-${t.id}`,
          type: 'tool' as const,
          title: `Returned: ${t.tool?.tool_name ?? 'Tool'}`,
          description: `From ${t.checked_out_to}${t.condition_on_return ? ` — ${t.condition_on_return}` : ''}`,
          date: t.returned_at as string,
        })),
        ...(pettyCash.data ?? []).map((p, i) => ({
          id: `petty-cash-${p.id}`,
          type: 'petty_cash' as const,
          title: `Petty cash: ${p.description}`,
          amount: `KES ${p.amount}`,
          date: p.created_at,
          imageUrl: pettyCashReceiptUrls[i],
        })),
      ];

      return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!siteId,
  });
}
