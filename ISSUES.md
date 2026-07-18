# Mutiso v2 — Issues Log

## How to use this file
- Add new items under "Open" as they come up, newest on top
- When resolved, move the item to "Resolved" with the date and a one-line note on the fix
- Keep entries short: what's wrong, where, and any relevant context (file, error message, steps to reproduce)

## Open

- **Subscription welcome/renewal/reminder n8n workflows are dev-only — need prod rollout**
  - Area/files: migrations `20260731091000_notify_subscription_lifecycle.sql` + `20260731091100_subscription_reminder_queue.sql`; n8n workflows "Subscription Welcome & Renewal (WhatsApp + Email)" (`MOu5emwNWcl6RIU1`) + "Subscription Renewal Reminders (WhatsApp + Email)" (`iBqsDhN3e7cjXQFZ`)
  - Details: Built + verified against **dev** on 2026-07-18. Welcome fires on `sites` pending→active, renewal on subscription_end pushed forward (both via one trigger → `/webhook/subscription-lifecycle`); reminders are a daily-08:00-EAT n8n Schedule reading the `subscription_reminder_queue` view (threshold-exact at 5/1/−1 days). To go live for real clients: (1) `supabase db push` both migrations to **prod** (pooler URL, per CLAUDE.md); (2) create the `subscription_lifecycle_webhook_secret` Vault secret on **prod** via `select vault.create_secret(...)` and set the same value in the webhook's Verify node (currently the dev secret only); (3) repoint the n8n Postgres credential (`LI49jpFJOx2PbcBp`, "Supabase Dev") to prod, or clone both workflows with a prod Postgres credential — same pending repoint the severe-incident/permit/etc. webhooks need. Until then these read/act on dev test data only.
  - Not-yet-verified-live: the three reminder message bodies (expiring_5d / expiring_1d / expired) haven't been rendered by a real run — no dev site currently sits at a 5/1/−1 threshold. The classification (SQL) and the identical rendering approach (WF1, verified live) are both proven; seed a disposable site at +5 days to watch one go out if a live confirmation is wanted.
  - Status: Open

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
