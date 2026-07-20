# Mutiso v2 — Issues Log

## How to use this file
- Add new items under "Open" as they come up, newest on top
- When resolved, move the item to "Resolved" with the date and a one-line note on the fix
- **Also log bugs that are found and fixed within a single session** — write them straight into "Resolved" without ever appearing under "Open". This file doubles as the development record of what we've fixed, not just a queue of what's outstanding
- Keep entries short: what's wrong, where, and any relevant context (file, error message, steps to reproduce)
- For a fixed bug, include a **Lesson** line where there's a generalisable one — the class of mistake matters more than the individual fix

## Open

- **Material Payments is one unbroken list of every delivery ever — needs period grouping/filtering**
  - Area/files: `src/components/forms/MaterialPaymentsView.tsx`, `src/hooks/useMaterialPayments.tsx`
  - Details: `useMaterialPayments()` returns every `materials_delivered` row for the site with its payments attached, and `MaterialPaymentsView` renders one `DeliveryCard` per row in a single flat scroll. On a site with a few months of deliveries this is unusable — the contractor has to scroll past paid items from weeks ago to reach today's unpaid ones, and there's no way to answer "what did we owe/pay this week".
  - Proposed fix: group the list by period with a period selector (Today / This week / This month / Custom range — same preset shape `SiteReportView` already uses, so reuse that pattern rather than inventing a second date-range UI), with a per-period subtotal header (delivered value vs. paid) and collapsed sections for older periods. Grouping should key off the delivery's own `date` column, not `created_at` — see the resolved Site Report entry below for why that distinction matters here.
  - Status: Open

- **`site_milestone` rows are auto-seeded on every site but the table is Pro-gated — field_ops sites carry 5 invisible rows each**
  - Area/files: `site_milestone` auto-seed trigger on `sites`, `20260730091000_pro_tier_policies.sql`
  - Details: Found during the 2026-07-18 production end-to-end seeding run. The `AFTER INSERT` trigger on `sites` seeds the fixed 5-stage milestone set (Foundation/Structure/Roofing/Finishes/Handover) for **every** new site regardless of tier, but `site_milestone` is one of the 20 tables gated behind `owns_pro_site()`. Verified on prod: `3b` (field_ops) and `school` (field_ops) each hold 5 milestone rows that neither their owner nor their foreman can see or manage through the API. Confirmed the same count as `hotel` (pro), where they *are* usable.
  - Impact: cosmetic/dead data rather than harmful — nothing reads them on a field_ops site, and on a field_ops→pro upgrade the milestones simply become visible, which is arguably the desired upgrade path. Worth a deliberate decision either way: keep seeding for all (upgrade-ready) and document it, or make the trigger tier-aware so the rows only exist where they can be used.
  - Status: Open — decide intent; not blocking

- **A contractor still has no in-app way to find or test the WhatsApp bot**
  - Area/files: `SettingsView.tsx`, `SubscriptionBillingView.tsx`, `ContractorView` site cards (`Index.tsx`), n8n workflow `MOu5emwNWcl6RIU1`
  - Details: The bot's WhatsApp number appears **nowhere in the app** — not in the create-site wizard (which only says "Add the WhatsApp Bot assistant +KES 1,500/mo"), not in Billing, not in Settings. The only number surfaced anywhere is the M-Pesa payment line (`0700 920 985`). The Landing page nonetheless promises "Message the Mutiso.AI bot and ask how's Westlands Tower A doing". Partially mitigated 2026-07-18: the welcome/renewal WhatsApp now appends a "Your WhatsApp assistant is active — just reply here" section when `whatsapp_bot_enabled`, and since that message is sent from the *same* Evolution instance the bot listens on, it lands in the exact thread the bot answers in — so the message is its own proof-of-life and there is no number to publish.
  - Still missing: (1) **contractors onboarded before 2026-07-18 never received that message**, so they have no thread and no number; (2) there is no "Test your assistant" affordance to re-verify later — a `wa.me/<number>?text=Hi` button in Settings or Billing would cover both, but needs the bot's real number as config (currently only implied by the Evolution instance).
  - Status: Open

- **WhatsApp bot's send endpoint is a free ngrok tunnel**
  - Area/files: every WhatsApp-sending node across all n8n workflows; Evolution API credential `vpRac8Wc96KOUhNz`
  - Details: All outbound WhatsApp posts to `https://flatworm-corporal-curing.ngrok-free.dev/message/sendText/mutiso-test5`. Free ngrok URLs rotate, and the instance is named `mutiso-test5` (a test instance). When that hostname changes, **every** WhatsApp send across all 14 workflows breaks simultaneously — alerts, digests, welcome/renewal, reminders, and the bot. Now that prod carries real paying clients this is the single most fragile piece of the notification stack.
  - Fix: move Evolution to a stable host (paid ngrok domain, or host it properly) and rename the instance off `-test5`. Infra decision, not a code change.
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

- **Site Report stamped every entry with `created_at` instead of its own event date — backfilled days read as same-day duplicates** — *resolved 2026-07-19*
  - Area/files: `src/hooks/useSiteReport.tsx` (the `entries` mapping — attendance, deliveries, usage, diary, incidents, toolbox talks, inspections, petty cash)
  - Details: Reported from the contractor's Site History as "our attendance people are marked thrice for a day's attendance" — the same worker appearing three times, all dated 18/07/2026. Not a duplicate insert: `attendance_log`'s `unique(site_id, worker_id, date)` makes triple-marking impossible, and a check of both dev and prod found no two `workers_master` rows sharing a name (the other candidate explanation, since that table is unique on `worker_id_number`, not `full_name`). The real cause is that the query **filters** on the `date` column but **displayed** `created_at`. Confirmed against real rows: three attendance records for 15, 16 and 17 July were all written within two seconds of each other during one catch-up session, so all three rendered as the same day. The `43` People Present count was correct throughout — only the labels lied.
  - Fix: each entry now carries its own `date` column. The same mismatch was present in **eight** categories total, not just attendance — deliveries, materials used, site activities, incidents, toolbox talks, inspections and petty cash all have a real `date` column and were all showing `created_at`. Photos and defects genuinely have no `date` column, so `created_at` is correct there and was left alone; tool checkout/return already used their own real timestamps. `npm run build` (incl. `tsc -b`) clean.
  - Lesson: **if a query filters on one column and displays another, those two columns must mean the same thing.** Here `date` is the event day and `created_at` is the write time, and they diverge in exactly the case this app treats as normal — a foreman logging several days of backlog in one sitting. The bug is invisible to anyone entering data the same day it happened, which is why it survived to a user report.

- **Schedule importer misdated roughly every 7th ambiguous date (4-month error)** — *resolved 2026-07-18*
  - Area/files: `src/components/forms/ScheduleUploadDialog.tsx` (`parseDate`, new `detectDateOrder`)
  - Details: `parseDate` resolved day/month order **per row**. For a value like MS Project's `Sat 5/9/26`, both readings — 9 May 2026 and 5 Sep 2026 — fall on a Saturday, so the weekday tiebreak couldn't separate them and the DD/MM fallback silently won, yielding **2026-09-05 instead of 2026-05-09**. Found while investigating why the Egret Lodge Foundation milestone showed a phase ending 2026-09-05 when nothing in the source CSV is in September: the misdated `Mechanical Works` row sat in the future, so it never reached 100%, leaving Foundation at 23/24 and its completion unevidenced.
  - Fix: added `detectDateOrder()`, which decides the order **once for the whole file** from rows where a component exceeds 12 (`10/31/25` can only be M/D). That order now outranks the weekday hint, since it is derived from unambiguous evidence and a single export never mixes orders. Precedence is now: out-of-range component → file-level order → weekday prefix → DD/MM fallback. Verified against the real 67-row Egret Lodge export: order detected as `mdy` from 134 date cells, `Sat 5/9/26` → `2026-05-09`, and every previously-correct value unchanged. After re-import, Foundation reached 24/24 at 100% with the phase correctly ending 2026-05-14.
  - Lesson: **a per-row heuristic on a whole-file property is the bug.** Date order is a property of the export, not of each cell — infer it once from the rows that can't be ambiguous, then apply it uniformly. A tiebreak that is right 14 times out of 15 still corrupts a schedule.

- **Four of five prod notification paths were silently dead — prod vault was missing/mismatched webhook secrets** — *resolved 2026-07-18*
  - Area/files: `vault.decrypted_secrets` on prod (`zhpcqhvwpauhsmpufhww`); the `notify_*` triggers; every webhook workflow's `Get Webhook Secret` → `Verify Secret` pair
  - Details: Found while answering "which n8n credential moves to production". Dev had 5 webhook secrets, prod had 2 — and one of those 2 held a *different value*. Consequences on prod, all silent:
    - `permit_requested`, `invite_created`, `variation_order_raised` — **absent from prod's vault**. Every `notify_*` trigger is written `if v_webhook_secret is not null then perform net.http_post(...)`, so the trigger did not fire at all. No permit alerts, and **no foreman invite emails**, for real paying clients.
    - `severe_incident` — present but a *different* value than dev (`dd80e887…` vs `e3789a78…`). Prod's trigger sent prod's value while n8n verified against dev's vault, so every medium/high-severity incident alert was rejected at `Verify Secret` and dropped.
    - `subscription_lifecycle` was the only working path, and only because it was deliberately created with the same value on both projects.
  - Fix: synced all four from dev into prod's vault via a single `do $$ … $$` block using `vault.create_secret` / `vault.update_secret` (one statement — a multi-statement string trips `cannot insert multiple commands into a prepared statement`). Verified by comparing `md5(decrypted_secret)` per name across both projects: all five now match. End-to-end check: POSTed to `/webhook/permit-requested` with prod's secret and empty contacts — execution passed `Verify Secret` and reached `No Phone Response` (previously it would have stopped at `Unauthorized Response`).
  - Why matching values, not fresh ones: matching means every webhook verifies correctly both **before** the n8n credential cutover (verify reads dev's vault) and **after** it (verify reads prod's), so the credential can be flipped — or rolled back — without breaking anything.
  - Lesson: **a Vault-gated webhook fails closed and silently.** A missing secret means the trigger never fires; a mismatched one means a 401 nobody sees. Any new `notify_*` webhook needs its secret created on *both* projects as part of shipping it, and `select name, md5(decrypted_secret) from vault.decrypted_secrets` compared across the two is the check that catches drift.

- **WhatsApp chatbot had no fallback reply when the AI model call failed** — *resolved 2026-07-18*
  - Area/files: n8n workflow "WhatsApp Contractor Chatbot" (`Wp3iUU8iuN3yfxee`), `AI Agent` node
  - Details: When the model call errored, the execution died at the `AI Agent` node and the contractor received **complete silence** — no error message, nothing. Observed live in executions 93–95 (OpenAI `Insufficient quota`) and 102/104 (Groq rate limit). From the contractor's side "the bot is broken" and "the bot is ignoring me" looked identical.
  - Fix: set `onError: continueErrorOutput` on `AI Agent` and wired its new error output (`main[1]`) to a new `Reply - Bot Unavailable` node — a copy of `Send Agent Reply` (same Evolution endpoint/credential, same `remoteJid` addressing) posting a static "Sorry, I'm having trouble reaching my system right now. Please try again in a moment." Verified the success path is untouched: `AI Agent.main[0]` still goes to `Send Agent Reply`, `main[1]` to the fallback.
  - Lesson: an AI Agent node with no error output fails *silently from the user's perspective* — the execution is marked failed in n8n, but nothing reaches the person waiting for a reply. Any user-facing agent node needs an error branch, not just monitoring.

- **Two migrations shared version `20260731091200`, silently blocking a security migration from ever reaching prod** — *resolved 2026-07-18*
  - Area/files: `supabase/migrations/20260731091200_diary_photos.sql`, `20260731091200_precreate_n8n_chat_histories.sql`
  - Details: Both files carried the same version prefix. Postgres records migrations by version, not filename, so once `diary_photos` was applied and recorded as `20260731091200`, the `precreate_n8n_chat_histories` file could **never** apply — `supabase db push` failed with `duplicate key value violates unique constraint "schema_migrations_pkey"`. Confirmed by probe: prod had `site_photos.diary_id` (diary_photos applied) but **no `public.n8n_chat_histories` table at all**. That is precisely the gap that migration exists to close — repointing n8n at prod would have had it auto-create the table with **RLS disabled**, exposing every contractor's raw WhatsApp conversation to read AND write through the public anon key.
  - Fix: renamed the never-applied file to `20260731091400_precreate_n8n_chat_histories.sql` (it is explicitly idempotent — `create table if not exists` + `enable row level security`), then pushed to both projects. Verified live: the table now exists on dev and prod, and an anon `INSERT` is rejected with `42501 new row violates row-level security policy` on both.
  - Lesson: **the version prefix, not the filename, is the unique key.** Before writing a new migration, check the prefix isn't already taken — `ls supabase/migrations/ | sed 's/_.*//' | sort | uniq -d` should print nothing.
