# Mutiso v2 — Issues Log

## How to use this file
- Add new items under "Open" as they come up, newest on top
- When resolved, move the item to "Resolved" with the date and a one-line note on the fix
- Keep entries short: what's wrong, where, and any relevant context (file, error message, steps to reproduce)

## Open

- **STK-push site creation isn't wired into the new payment-gated onboarding flow**
  - Area/files: `CreateSiteWizard.tsx`, `create_site_with_manual_payment()` RPC (`20260731090400`/`20260731090700`)
  - Details: The 2026-07-17 payment-gated onboarding work (site creation now requires a payment record atomically, approval blocked until payment confirmed, hard lockout on expiry) only implemented the manual-payment path, since `PAYMENT_MODE` is currently `'manual'` (STK stays dormant pending production Daraja credentials, per `src/lib/payment.ts`). When STK goes live, `CreateSiteWizard`'s step 2 needs an `stk_push` branch: create the site via a plain insert (no payment row), then immediately invoke the `mpesa-stk-push` edge function with the new `site_id` before the wizard lets the user leave, mirroring the existing Pay/Renew dialog's STK branch.
  - Status: Open

- **Subcontractor work orders have no payment tracking**
  - Area/files: `subcontractor_work_order` table, `actual_cost` table, `SubcontractorsView.tsx`, `BudgetView.tsx`, `useSubcontractors.tsx`, `useActualCosts.tsx`
  - Details: Subcontractor payments currently only exist as generic `actual_cost` rows tagged with `cost_type = 'subcontractor'` — there's no link from a payment back to a specific subcontractor or work order, and `subcontractor_work_order` has no amount/paid/status fields at all. Marking a work order "Done" is purely a task-completion flag, unrelated to payment.
  - Proposed fix (discussed with Claude, not yet built):
    - Add `agreed_amount`, `amount_paid`, `payment_status` ('unpaid'/'partial'/'paid') columns to `subcontractor_work_order`
    - Add `subcontractor_work_order_id` FK column to `actual_cost` for fine-grained traceability
    - Add a `record_subcontractor_payment(work_order_id, amount, invoice_reference, date_incurred)` SECURITY DEFINER RPC that atomically inserts the `actual_cost` row and updates the work order's paid amount/status in one transaction (same pattern as `checkout_tool()`/`log_material_delivery()`), with an explicit `owns_pro_site` check inside the function body since RLS is bypassed
    - UI: add "Agreed amount" field to the add-work-order form, add a payment status badge + "Record Payment" button to each work order in `SubcontractorsView.tsx`
  - Status: Open

**Example entry format (delete once real items exist):**
- **Title** — short description of what's wrong
- Area/file: `src/path/to/file.tsx`
- Details: what's broken, any error message, and steps to reproduce
- Status: Open

## Resolved
(none yet)
