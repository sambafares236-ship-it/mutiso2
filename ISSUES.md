# Mutiso v2 — Issues Log

## How to use this file
- Add new items under "Open" as they come up, newest on top
- When resolved, move the item to "Resolved" with the date and a one-line note on the fix
- Keep entries short: what's wrong, where, and any relevant context (file, error message, steps to reproduce)

## Open

- **Prod subscription REMINDERS don't fire — n8n Postgres credential still points at dev**
  - Area/files: n8n workflow "Subscription Renewal Reminders (WhatsApp + Email)" (`iBqsDhN3e7cjXQFZ`), n8n Postgres credential `LI49jpFJOx2PbcBp` ("Supabase Dev")
  - Details: As of 2026-07-18 both migrations + the `subscription_lifecycle_webhook_secret` Vault secret are deployed to **prod** (`zhpcqhvwpauhsmpufhww`), and welcome/renewal **do work end-to-end from prod** — prod's trigger posts to the n8n webhook, and the Verify node's dev-vault lookup still matches because the same secret value was used on both projects. The reminders workflow, however, `SELECT`s `subscription_reminder_queue` over that dev-pointed Postgres credential, so **prod sites are invisible to it and get no renewal reminders.**
  - Deadline pressure: prod's earliest `subscription_end` is **2026-07-21**, so that site hits the 1-day reminder on **2026-07-20** and will silently get nothing unless this is resolved first. (It already missed the 5-day window, which fell before this shipped.)
  - Two options: (a) repoint `LI49jpFJOx2PbcBp` to prod — the CLAUDE.md-flagged "once a real client is onboarded" task, but it redirects ALL ~10 workflows (severe incident, permits, invites, variation orders, digests, WhatsApp bot) off dev at once; or (b) add a second, prod-pointed Postgres credential and switch only the reminders workflow to it, leaving dev automation intact. (b) is the surgical option; (a) is the eventual end state.
  - Status: Open — needs a decision, not just execution

- **Subscription reminder message bodies not yet rendered by a live run**
  - Area/files: n8n workflow `iBqsDhN3e7cjXQFZ`, `Prepare Messages` node
  - Details: The three variants (expiring_5d / expiring_1d / expired) have never been rendered by a real execution — neither dev nor prod currently has a site at a 5/1/−1 threshold. The `reminder_kind` classification is verified in SQL, and the identical rendering approach is verified live in the welcome/renewal workflow, so risk is low; seed a disposable site at +5 days to confirm one live if wanted.
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
