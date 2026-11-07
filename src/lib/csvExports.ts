import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { rowsToCsv, downloadCsv } from '@/lib/csv';
import { resolveProfileNames } from '@/lib/resolveProfileNames';

type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
type ActualCostRow = Database['public']['Tables']['actual_cost']['Row'];
type PaymentCertificateRow = Database['public']['Tables']['payment_certificate']['Row'];
type PettyCashRow = Database['public']['Tables']['petty_cash_log']['Row'];

// PostgREST silently caps a single response at the project's max-rows
// setting (1000 by default), so an unpaged export of a busy site - e.g.
// 20 workers x 60 days of attendance - would download a truncated file
// with no error. Page through with .range() until a short page comes back.
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

// One export function per report domain. Each does its own raw table
// fetch (rather than reusing useSiteReport's composed-title feed) so the
// CSV can carry full, separately-sortable columns - e.g. Worker Name and
// Trade as distinct fields, not folded into one display string.

export async function exportAttendanceCsv(siteId: string, startDate: string, endDate: string) {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from('attendance_log')
      .select('date, marked_by, worker:workers_master(full_name, trade)')
      .eq('site_id', siteId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('id')
      .range(from, to),
  );

  const names = await resolveProfileNames((data ?? []).map((r) => r.marked_by));

  downloadCsv(
    `attendance-${siteId}-${startDate}-to-${endDate}`,
    rowsToCsv(data ?? [], [
      { label: 'Date', value: (r) => r.date },
      { label: 'Worker Name', value: (r) => r.worker?.full_name },
      { label: 'Trade', value: (r) => r.worker?.trade },
      { label: 'Marked By', value: (r) => names.get(r.marked_by) },
    ]),
  );
}

export async function exportMaterialsDeliveredCsv(siteId: string, startDate: string, endDate: string) {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from('materials_delivered')
      .select('date, material_name, quantity, unit, supplier, created_by')
      .eq('site_id', siteId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('id')
      .range(from, to),
  );

  const names = await resolveProfileNames((data ?? []).map((r) => r.created_by));

  downloadCsv(
    `materials-delivered-${siteId}-${startDate}-to-${endDate}`,
    rowsToCsv(data ?? [], [
      { label: 'Date', value: (r) => r.date },
      { label: 'Material', value: (r) => r.material_name },
      { label: 'Quantity', value: (r) => r.quantity },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Supplier', value: (r) => r.supplier },
      { label: 'Logged By', value: (r) => names.get(r.created_by) },
    ]),
  );
}

export async function exportMaterialsUsedCsv(siteId: string, startDate: string, endDate: string) {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from('material_usage_log')
      .select('date, material_name, quantity, unit, description, created_by')
      .eq('site_id', siteId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('id')
      .range(from, to),
  );

  const names = await resolveProfileNames((data ?? []).map((r) => r.created_by));

  downloadCsv(
    `materials-used-${siteId}-${startDate}-to-${endDate}`,
    rowsToCsv(data ?? [], [
      { label: 'Date', value: (r) => r.date },
      { label: 'Material', value: (r) => r.material_name },
      { label: 'Quantity', value: (r) => r.quantity },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Notes', value: (r) => r.description },
      { label: 'Logged By', value: (r) => names.get(r.created_by) },
    ]),
  );
}

// Budget/actual-cost exports reuse whatever the calling view already has
// loaded via its own hook - the site's full budget/cost list is already
// fetched for display, so there's no reason to re-query it just for CSV.
export async function exportBudgetLinesCsv(siteId: string, rows: BudgetLineRow[]) {
  const names = await resolveProfileNames(rows.map((r) => r.created_by));

  downloadCsv(
    `budget-${siteId}`,
    rowsToCsv(rows, [
      { label: 'Category', value: (r) => r.category },
      { label: 'Cost Code', value: (r) => r.cost_code },
      { label: 'Budgeted Amount', value: (r) => r.budgeted_amount },
      { label: 'Created By', value: (r) => names.get(r.created_by) },
      { label: 'Created At', value: (r) => r.created_at },
    ]),
  );
}

export async function exportActualCostsCsv(siteId: string, rows: ActualCostRow[]) {
  const names = await resolveProfileNames(rows.map((r) => r.created_by));

  downloadCsv(
    `actual-costs-${siteId}`,
    rowsToCsv(rows, [
      { label: 'Cost Type', value: (r) => r.cost_type },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Date Incurred', value: (r) => r.date_incurred },
      { label: 'Invoice Reference', value: (r) => r.invoice_reference },
      { label: 'Created By', value: (r) => names.get(r.created_by) },
      { label: 'Created At', value: (r) => r.created_at },
    ]),
  );
}

export async function exportPaymentCertificatesCsv(siteId: string, rows: PaymentCertificateRow[]) {
  const names = await resolveProfileNames([...rows.map((r) => r.certified_by), ...rows.map((r) => r.created_by)]);

  downloadCsv(
    `payment-certificates-${siteId}`,
    rowsToCsv(rows, [
      { label: 'Certificate #', value: (r) => r.certificate_number },
      { label: 'Period Start', value: (r) => r.period_start },
      { label: 'Period End', value: (r) => r.period_end },
      { label: 'Work Completed Value', value: (r) => r.work_completed_value },
      { label: 'Retention %', value: (r) => r.retention_percentage },
      { label: 'Retention Amount', value: (r) => r.retention_amount },
      { label: 'Previous Payments Total', value: (r) => r.previous_payments_total },
      { label: 'Net Amount Due', value: (r) => r.net_amount_due },
      { label: 'Status', value: (r) => r.status },
      { label: 'Certified By', value: (r) => (r.certified_by ? names.get(r.certified_by) : '') },
      { label: 'Certified At', value: (r) => r.certified_at },
    ]),
  );
}

export async function exportPettyCashCsv(siteId: string, rows: PettyCashRow[]) {
  const names = await resolveProfileNames(rows.map((r) => r.created_by));

  downloadCsv(
    `petty-cash-${siteId}`,
    rowsToCsv(rows, [
      { label: 'Date', value: (r) => r.date },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Description', value: (r) => r.description },
      { label: 'Logged By', value: (r) => names.get(r.created_by) },
    ]),
  );
}

export async function exportPayrollCsv(runId: string, weekStart: string, weekEnd: string) {
  const { data, error } = await supabase
    .from('payroll_line')
    .select('daily_rate, days_present, gross_amount, deductions, advances, net_amount, paid, paid_by, paid_at, worker:workers_master(full_name)')
    .eq('payroll_run_id', runId);
  if (error) throw error;

  const names = await resolveProfileNames((data ?? []).map((r) => r.paid_by));

  downloadCsv(
    `payroll-${weekStart}-to-${weekEnd}`,
    rowsToCsv(data ?? [], [
      { label: 'Worker Name', value: (r) => r.worker?.full_name },
      { label: 'Daily Rate', value: (r) => r.daily_rate },
      { label: 'Days Present', value: (r) => r.days_present },
      { label: 'Gross Amount', value: (r) => r.gross_amount },
      { label: 'Deductions', value: (r) => r.deductions },
      { label: 'Advances', value: (r) => r.advances },
      { label: 'Net Amount', value: (r) => r.net_amount },
      { label: 'Paid', value: (r) => (r.paid ? 'Yes' : 'No') },
      { label: 'Paid By', value: (r) => (r.paid_by ? names.get(r.paid_by) : '') },
      { label: 'Paid At', value: (r) => r.paid_at },
    ]),
  );
}

// Full current-stock snapshot, not just the low-stock-threshold rows the
// "Low Stock" drill-down itself filters to - a contractor exporting
// inventory wants the whole picture, not only what's already running low.
export async function exportMaterialInventoryCsv(siteId: string) {
  const { data, error } = await supabase
    .from('material_inventory')
    .select('material_name, current_quantity, unit, last_updated')
    .eq('site_id', siteId)
    .order('material_name');
  if (error) throw error;

  downloadCsv(
    `material-inventory-${siteId}`,
    rowsToCsv(data ?? [], [
      { label: 'Material', value: (r) => r.material_name },
      { label: 'Current Quantity', value: (r) => r.current_quantity },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Last Updated', value: (r) => r.last_updated },
    ]),
  );
}

export async function exportSiteDiaryCsv(siteId: string, startDate: string, endDate: string) {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from('site_diary_log')
      .select('date, category, title, description, created_by, activity:activity(name)')
      .eq('site_id', siteId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('id')
      .range(from, to),
  );

  const names = await resolveProfileNames((data ?? []).map((r) => r.created_by));

  downloadCsv(
    `site-diary-${siteId}-${startDate}-to-${endDate}`,
    rowsToCsv(data ?? [], [
      { label: 'Date', value: (r) => r.date },
      { label: 'Category', value: (r) => r.category },
      { label: 'Title', value: (r) => r.title },
      { label: 'Description', value: (r) => r.description },
      { label: 'Linked Activity', value: (r) => r.activity?.name },
      { label: 'Logged By', value: (r) => names.get(r.created_by) },
    ]),
  );
}

export type HistoryExportType = 'attendance' | 'delivery' | 'usage' | 'diary';

interface HistoryRow {
  date: string;
  type: string;
  item: string | null;
  quantity: number | string | null;
  unit: string | null;
  details: string | null;
  by: string | null;
}

// One combined CSV for Site History's "All" view - attendance, materials
// delivered/used and diary entries merged into a single date-sorted sheet
// with a Type column. (The feed itself also shows visitors, incidents,
// inspections etc.; those aren't part of this download.) Single-type
// downloads use the dedicated exporters above, which carry richer columns.
export async function exportSiteHistoryCsv(
  siteId: string,
  startDate: string,
  endDate: string,
  types: HistoryExportType[] = ['attendance', 'delivery', 'usage', 'diary'],
) {
  const want = new Set(types);
  const empty = Promise.resolve([] as never[]);

  const [attendance, delivered, used, diary] = await Promise.all([
    want.has('attendance')
      ? fetchAllPages((from, to) =>
          supabase
            .from('attendance_log')
            .select('date, marked_by, worker:workers_master(full_name, trade)')
            .eq('site_id', siteId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date')
            .order('id')
            .range(from, to),
        )
      : empty,
    want.has('delivery')
      ? fetchAllPages((from, to) =>
          supabase
            .from('materials_delivered')
            .select('date, material_name, quantity, unit, supplier, created_by')
            .eq('site_id', siteId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date')
            .order('id')
            .range(from, to),
        )
      : empty,
    want.has('usage')
      ? fetchAllPages((from, to) =>
          supabase
            .from('material_usage_log')
            .select('date, material_name, quantity, unit, description, created_by')
            .eq('site_id', siteId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date')
            .order('id')
            .range(from, to),
        )
      : empty,
    want.has('diary')
      ? fetchAllPages((from, to) =>
          supabase
            .from('site_diary_log')
            .select('date, category, title, description, created_by')
            .eq('site_id', siteId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date')
            .order('id')
            .range(from, to),
        )
      : empty,
  ]);

  const names = await resolveProfileNames([
    ...attendance.map((r) => r.marked_by),
    ...delivered.map((r) => r.created_by),
    ...used.map((r) => r.created_by),
    ...diary.map((r) => r.created_by),
  ]);

  const rows: HistoryRow[] = [
    ...attendance.map((r) => ({
      date: r.date,
      type: 'Attendance',
      item: r.worker?.full_name ?? null,
      quantity: null,
      unit: null,
      details: r.worker?.trade ?? null,
      by: names.get(r.marked_by) ?? null,
    })),
    ...delivered.map((r) => ({
      date: r.date,
      type: 'Material delivered',
      item: r.material_name,
      quantity: r.quantity,
      unit: r.unit,
      details: r.supplier ? `Supplier: ${r.supplier}` : null,
      by: names.get(r.created_by) ?? null,
    })),
    ...used.map((r) => ({
      date: r.date,
      type: 'Material used',
      item: r.material_name,
      quantity: r.quantity,
      unit: r.unit,
      details: r.description,
      by: names.get(r.created_by) ?? null,
    })),
    ...diary.map((r) => ({
      date: r.date,
      type: 'Diary',
      item: r.title,
      quantity: null,
      unit: null,
      details: [r.category, r.description].filter(Boolean).join(': ') || null,
      by: names.get(r.created_by) ?? null,
    })),
  ].sort((a, b) => (a.date === b.date ? a.type.localeCompare(b.type) : a.date.localeCompare(b.date)));

  downloadCsv(
    `site-history-${siteId}-${startDate}-to-${endDate}`,
    rowsToCsv(rows, [
      { label: 'Date', value: (r) => r.date },
      { label: 'Type', value: (r) => r.type },
      { label: 'Item / Person', value: (r) => r.item },
      { label: 'Quantity', value: (r) => r.quantity },
      { label: 'Unit', value: (r) => r.unit },
      { label: 'Details', value: (r) => r.details },
      { label: 'Logged By', value: (r) => r.by },
    ]),
  );
}
