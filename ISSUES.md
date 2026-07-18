# Mutiso v2 — Issues Log

## How to use this file
- Add new items under "Open" as they come up, newest on top
- When resolved, move the item to "Resolved" with the date and a one-line note on the fix
- Keep entries short: what's wrong, where, and any relevant context (file, error message, steps to reproduce)

## Open

- **WhatsApp chatbot has no fallback reply when the AI model call fails**
  - Area/files: n8n workflow "WhatsApp Contractor Chatbot" (`Wp3iUU8iuN3yfxee`), `AI Agent` node
  - Details: When the model call errors, the execution dies at the `AI Agent` node and the contractor receives **complete silence** — no error message, nothing. Observed live on 2026-07-18 in executions 93–95 (OpenAI `Insufficient quota`) and 102/104 (Groq rate limit). The contractor has no way to tell the bot is broken vs. ignoring them.
  - Proposed fix: add an error branch off `AI Agent` into a copy of `Send Agent Reply` posting a short "Sorry, I'm having trouble right now — try again in a moment", so a failure degrades to a reply instead of silence.
  - Status: Open

- **Gemini free-tier daily request cap not measured**
  - Area/files: n8n credential `Gemini (Mutiso Chatbot)` (`qktCKtVd8onei9Ya`), chatbot model node
  - Details: Chatbot moved from OpenAI (quota exhausted) → Groq → **Gemini `gemini-2.5-flash`** on 2026-07-18 via the OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai`). Groq's limits were measured directly from response headers (12,000 TPM for `llama-3.3-70b-versatile`, which a single chatbot message exceeded at ~13k tokens across its two LLM calls). Gemini's per-minute ceiling is far higher and resolved the failures, but its **daily request cap was never measured** — each WhatsApp message costs ~2 requests. Worth watching in AI Studio before relying on it for multiple contractors.
  - Related: `Chat Memory` `contextWindowLength` was 50 (replaying 50 messages into every call — the dominant token cost); reduced to 8 for Groq, then raised to 20 under Gemini.
  - Status: Open — monitoring, not broken

- **Email change on an `@example.com` test account is rejected by Supabase Auth**
  - Area/files: `src/hooks/useProfile.tsx` (`useUpdateProfile`), `src/components/forms/SettingsView.tsx`
  - Details: `supabase.auth.updateUser({ email })` fails with `Email address "<current>@example.com" is invalid` — it rejects based on the account's **existing** address, not the new one, so no `@example.com` test account can exercise the email-change path. Consequence: **it is not empirically confirmed whether changing the sign-in email requires a confirmation click or applies immediately.** `config.toml` has `enable_confirmations = false` (suggesting immediate) but `double_confirm_changes = true` (suggesting confirmation). `useUpdateProfile` handles both — it reads back whether Auth applied the new address rather than assuming — and the toast copy adapts. Verify with a real domain the first time a real user changes their email.
  - Related risk: if the change *does* apply immediately, a typo in the email field would change the sign-in address with no confirmation step, locking the contractor out. Consider requiring password re-entry or a confirm-email field before treating this as final.
  - Status: Open

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

- **Two migrations shared version `20260731091200`, silently blocking a security migration from ever reaching prod** — *resolved 2026-07-18*
  - Area/files: `supabase/migrations/20260731091200_diary_photos.sql`, `20260731091200_precreate_n8n_chat_histories.sql`
  - Details: Both files carried the same version prefix. Postgres records migrations by version, not filename, so once `diary_photos` was applied and recorded as `20260731091200`, the `precreate_n8n_chat_histories` file could **never** apply — `supabase db push` failed with `duplicate key value violates unique constraint "schema_migrations_pkey"`. Confirmed by probe: prod had `site_photos.diary_id` (diary_photos applied) but **no `public.n8n_chat_histories` table at all**. That is precisely the gap that migration exists to close — repointing n8n at prod would have had it auto-create the table with **RLS disabled**, exposing every contractor's raw WhatsApp conversation to read AND write through the public anon key.
  - Fix: renamed the never-applied file to `20260731091400_precreate_n8n_chat_histories.sql` (it is explicitly idempotent — `create table if not exists` + `enable row level security`), then pushed to both projects. Verified live: the table now exists on dev and prod, and an anon `INSERT` is rejected with `42501 new row violates row-level security policy` on both.
  - Lesson: **the version prefix, not the filename, is the unique key.** Before writing a new migration, check the prefix isn't already taken — `ls supabase/migrations/ | sed 's/_.*//' | sort | uniq -d` should print nothing.
