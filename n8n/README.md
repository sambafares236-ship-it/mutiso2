# n8n workflows

Exported JSON for every n8n workflow built for Mutiso.AI. The n8n instance itself is the source
of truth — these exports are for version control / disaster recovery / code review, not for
editing directly. After changing a workflow in n8n, re-export it here (see "Re-exporting" below).

## n8n instance

- **n8n API URL**: `https://primary-production-bd339.up.railway.app` (Railway-hosted). This is the
  same host `supabase/migrations/20260731090000_repoint_severe_incident_webhook.sql` points the
  severe-incident Postgres trigger at.
- Managed via `n8n-mcp` (Claude Code's n8n MCP server) rather than the web UI for these builds.
- **As of 2026-07-16 this instance started empty** — no pre-existing WhatsApp Bot workflow or
  severe-incident webhook was actually present despite earlier notes suggesting otherwise (only a
  Gmail OAuth2 credential existed). Everything under `workflows/` was built fresh from that point.
- **All 4 new trigger migrations (permit/VO/invite notify + the severe-incident repoint) were
  pushed to both dev and prod**, per this repo's standing "every migration goes to both projects"
  rule. This is safe even though n8n itself only exists against the dev project right now: every
  trigger's `net.http_post` call is guarded by `if v_webhook_secret is not null`, and no Vault
  secret was created in prod (only dev), so a real prod insert just inserts the `notifications` row
  and silently skips the webhook call — no prod event actually reaches this dev n8n instance. When
  prod eventually gets its own n8n/Evolution API setup, create the matching `*_webhook_secret`
  Vault secrets there and the same triggers will start firing for real.

## WhatsApp (Evolution API)

- Base URL: `https://flatworm-corporal-curing.ngrok-free.dev` — **this is an ngrok tunnel to a
  Docker container running on a developer's machine and WILL change** if the tunnel restarts.
  It is only ever hardcoded inside each workflow's HTTP Request node (via the credential below +
  the node's URL field) — never in the app or database. If a workflow starts failing with a
  connection error, ask for the current ngrok URL and update the affected HTTP Request node(s).
- Instance name: `mutiso-test5`
- Auth: header `apikey: <AUTHENTICATION_API_KEY>`, stored in n8n as the credential
  **"Evolution API (mutiso-test5)"** (type `httpHeaderAuth`). The key itself is a placeholder
  (`set-a-long-random-string-here`) until this moves off a dev machine — rotate the credential
  value in n8n when a real secret is issued, no workflow JSON needs to change.
- Send endpoint used everywhere: `POST /message/sendText/{instance}` with JSON body
  `{ "number": "<254XXXXXXXXX>", "text": "<message>" }`. Phone numbers are stored in
  `profiles.phone_number` already normalized to this `2547XXXXXXXX` / `2541XXXXXXXX` shape
  (see `src/lib/phone.ts`'s `normalizeKenyanPhone`), so no reformatting is needed before sending.

## Email (Gmail)

- Credential **"Gmail account"** (type `gmailOAuth2`), connected as `mutisoconstruction@gmail.com`.
  Created via `n8n_manage_credentials` initially, but an API-created OAuth2 credential has no
  access/refresh token until a human completes Google's consent screen — found live while testing
  workflow 4 (`Unable to sign without access token`). The user completed the OAuth flow manually in
  n8n's UI (Credentials → Gmail account → connect), after which sending worked immediately. **Any
  future OAuth2-type credential (Gmail, Google Sheets, etc.) will need this same manual one-time
  connect step** — it can't be finished through the API.
- **Join links use `https://mutisoai.vercel.app`** (the production Vercel domain, confirmed with the
  user directly rather than guessed) as the hardcoded base for `/join?token=...`, matching what
  `useCreateInvite()`'s removed client-side call used to build from `window.location.origin`.
- Resend was considered (per the original build request) but **Gmail was already connected and
  ready in n8n, so it was used instead** — the `send-invite-email` Supabase Edge Function (Resend)
  is left in place, unused, in case Resend is ever preferred back.

## Supabase access

- Credential **"Supabase Dev (mutiso-v2 kmcgcqnuxixsxqwigfir)"** (type `postgres`) connects via the
  session pooler (`aws-0-eu-west-1.pooler.supabase.com`, user `postgres.kmcgcqnuxixsxqwigfir`) —
  same host CLAUDE.md documents as the one confirmed working for CLI/direct-Postgres access from
  outside the Supabase dashboard. This connects as the `postgres` role, which **bypasses RLS**
  entirely (same as how n8n's own Postgres Chat Memory node reads/writes `n8n_chat_histories`
  directly) — every query below is written assuming full table access, not the app's normal
  authenticated-user RLS view.
- **The credential must have `ssl: require` + `allowUnauthorizedCerts: true`.** n8n's Postgres node
  fails with `self-signed certificate in certificate chain` against Supabase's pooler otherwise —
  confirmed live while testing workflow 1 (n8n doesn't ship Supabase's CA bundle, so plain
  `ssl: require` with default cert verification rejects the connection outright). Any newly created
  Postgres credential pointed at either Supabase project needs this same setting, not just this one.
- **Before this moves to production**: repoint this credential at the prod project
  (`zhpcqhvwpauhsmpufhww`, same pooler host, user `postgres.zhpcqhvwpauhsmpufhww`) once a real
  paying client is onboarded — see CLAUDE.md's existing note on this same requirement for n8n's
  WhatsApp Bot workflow.

## Workflows

| # | File | Trigger | Status |
|---|------|---------|--------|
| 1 | `01-severe-incident-alert.json` | Postgres trigger → webhook (`POST /webhook/severe-incident`) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 2 | `02-permit-request-notification.json` | Postgres trigger → webhook (`POST /webhook/permit-requested`) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 3 | `03-variation-order-notification.json` | Postgres trigger → webhook (`POST /webhook/variation-order-raised`) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 4 | `04-invite-email.json` | Postgres trigger → webhook (`POST /webhook/invite-created`) | Built, active, verified end-to-end (real Gmail delivery confirmed 2026-07-16) |
| 5 | `05-certification-insurance-digest.json` | Cron (`Daily Schedule`, 07:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 6 | `06-payroll-reminder.json` | Cron (`Monday Schedule`, Mondays 07:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 7 | `07-weekly-site-digest.json` | Cron (`Monday Schedule`, Mondays 08:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 8 | `08-budget-overrun-alert.json` | Cron (`Tuesday Schedule`, Tuesdays 07:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 9 | `09-tool-maintenance-digest.json` | Cron (`Wednesday Schedule`, Wednesdays 07:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |
| 10 | `10-waste-disposal-digest.json` | Cron (`Thursday Schedule`, Thursdays 07:00 Africa/Nairobi) | Built, active, verified end-to-end (real WhatsApp delivery confirmed 2026-07-16) |

All 10 originally-planned workflows are active and individually verified end-to-end with real
WhatsApp/Gmail delivery. Daily visitor-log summary and subcontractor work-order payment reminders
were explicitly skipped per the build request (the latter depends on payment-tracking schema
logged as an open item in `ISSUES.md`, not yet built).

| 11 | `11-whatsapp-chatbot.json` + `11b-bot-query-subworkflow.json` | Webhook (`POST /webhook/whatsapp-inbound`, Evolution API inbound events) | Built, active, verified end-to-end (real multi-turn WhatsApp conversation confirmed 2026-07-17) |

(user-directed addition beyond the original 10-workflow build request — a conversational WhatsApp
chatbot for contractors, reusing the pre-existing `bot_query_site_data()` RPC.)

## AI (OpenAI)

- Credential **"OpenAI (Mutiso Chatbot)"** (type `openAiApi`), used by workflow 11's `OpenAI Chat
  Model` node. Model: `gpt-4o-mini`.

### 11. WhatsApp Contractor Chatbot

A conversational bot letting a contractor ask free-form questions about their sites over
WhatsApp ("how many people attended site 2b this week?", "any open defects on site 5b?") —
user-directed, built on top of the original 10-workflow plan, not part of it.

**This reused an already-built backend piece rather than starting from scratch**: `bot_query_site_data(p_query_type, p_site_id, p_date_range_days)` (`supabase/migrations/20260729090100_bot_query_site_data_rpc.sql`, extended by two later migrations) already existed — a `SECURITY DEFINER` RPC covering 13 query categories (attendance, deliveries, usage, inventory, incidents, defects, diary, progress, payroll, visitors, certifications, permits, budget), explicitly designed by its own code comments to be "called by n8n" with `site_id` "always resolved and verified server-side... never taken from the WhatsApp message text directly." This build is the n8n side that RPC was always meant to have.

**Two workflows, not one:**
- `11-whatsapp-chatbot.json` — the main bot: inbound webhook → filter out echoes of the bot's own
  sent messages → resolve the sender's phone number to a contractor + their site list → AI Agent
  (OpenAI, Postgres-backed chat memory, one tool) → send the reply back via Evolution API.
- `11b-bot-query-subworkflow.json` — a tiny internal sub-workflow (`Execute Workflow Trigger` →
  one `Postgres` node calling `bot_query_site_data()`) that the main workflow's AI Agent calls as
  its tool. See "Why a sub-workflow, not a direct tool call" below for why this exists as a
  separate workflow instead of being inlined.

**Inbound wiring**: Evolution API's webhook was pointed at this workflow via
`POST /webhook/set/mutiso-test5` (`events: ["MESSAGES_UPSERT"]`) — this instance had no inbound
webhook configured at all before this build (confirmed via `GET /webhook/find/mutiso-test5`
returning `null`). **`Is Real Inbound Message` filters out `fromMe: true` events** — without this,
every WhatsApp message the OTHER 10 workflows send (digests, alerts, invite confirmations) would
loop back into this same webhook as an "inbound message" and the bot would try to respond to its
own notifications.

**Contractor identity is resolved from the sender's phone number, server-side, before any AI
reasoning happens** (`Resolve Contractor`) — matches digits-only against `profiles.phone_number`
(handles both `+254...` and `0700...` stored formats via `regexp_replace(..., '\D', '', 'g')` on
both sides of the comparison) and pulls back only that contractor's own active sites. A number that
doesn't own any sites gets a canned "not recognized" reply (`Has Sites` false branch) and never
reaches the LLM at all.

**Conversation memory uses n8n's built-in `Postgres Chat Memory` node**, keyed by the sender's
WhatsApp JID (`sessionKey`), writing to the pre-existing `n8n_chat_histories` table — the same
table CLAUDE.md already documents as auto-created by "n8n's Postgres Chat Memory node (WhatsApp Bot
workflow)" and RLS-locked with zero policies (blocks PostgREST/API access; unaffected here since
n8n's direct Postgres credential doesn't go through RLS). This lets a contractor ask a follow-up
("and site 5b?") without re-stating context.

**Site selection**: the system prompt embeds the contractor's exact site list (`site_id` +
`site_name` pairs) and instructs the model to ask for clarification if it owns more than one site
and the question doesn't name one, and to never use a `site_id` not in that list. This is a
prompt-engineering mitigation, not a hard technical guarantee — see "Known limitation" below.

#### Why a sub-workflow, not a direct tool call — three real bugs found live, in order

Getting from "AI Agent with a tool" to a working tool call took three iterations, each surfacing a
genuine issue on this specific n8n instance (self-hosted on Railway, not n8n Cloud) rather than a
workflow design mistake:

1. **`@n8n/n8n-nodes-langchain.toolHttpRequest` (the obvious first choice — call Supabase's
   PostgREST `/rpc/bot_query_site_data` endpoint directly with a service_role key) failed with `The
   node "@n8n/n8n-nodes-langchain.toolHttpRequest" has a "supplyData" method but no "execute"
   method.`** — a genuine registration bug for this node type on this instance, not a config
   mistake. Confirmed via a real execution, not guessed.
2. **Swapped to `@n8n/n8n-nodes-langchain.toolCode`** (writes the HTTP call in JS instead) — this
   fixed the registration crash, but `this.helpers.httpRequestWithAuthentication` (needed to use a
   stored credential) is **not supported inside Code Tool nodes on this instance** (confirmed via
   a second real execution's error). Code Tool's own node schema has no `credentials` field at all,
   which in hindsight was the tell. This meant the only way to call an authenticated endpoint from
   Code Tool would be to hardcode the secret directly in the `jsCode` string — and since that code
   gets committed verbatim to `n8n/workflows/*.json`, that would mean committing a real secret to
   git in plaintext. **This repo has already paid for that exact mistake once** (see
   `20260730090200_vault_secret_severe_incident_webhook.sql`'s note about the severe-incident
   webhook secret "having been briefly committed to git in plaintext" before being moved to Vault)
   — not worth repeating even under time pressure, especially since the credential in question
   here would have been the Supabase **service_role** key (full RLS-bypassing database access),
   a much bigger blast radius than a single webhook's shared secret.
3. **Final fix: `@n8n/n8n-nodes-langchain.toolWorkflow` ("Call n8n Sub-Workflow Tool")**, pointing
   at `11b-bot-query-subworkflow.json`. This calls another n8n workflow **internally** — no public
   webhook, no network hop, no secret of any kind needed, because the call never leaves the n8n
   instance. The sub-workflow's own `Postgres` node uses the same proven `Supabase Dev` credential
   every other workflow in this repo already uses, which **does** support real credential-based
   auth (Postgres node ≠ Code Tool node). Tool arguments are supplied via n8n's `$fromAI(name,
   description, type)` expression helper inside the sub-workflow-call node's input mapping — this
   is the general mechanism for letting a connected AI Agent fill in *any* node's parameter
   dynamically, not something Tool-node-specific.

**A fourth, smaller bug found in the same testing pass**: the model's first successful multi-tool
response used markdown `**bold**`, which WhatsApp does not render (WhatsApp's own bold syntax is
single `*asterisks*`). Added an explicit WhatsApp-formatting rule to the system prompt
(`docs/README` — see the system message in `11-whatsapp-chatbot.json`) — confirmed fixed on the
next real test.

**A fifth thing that looked like a bug but wasn't**: after the `toolHttpRequest` → `toolCode`
swap, a retest against the *same* real WhatsApp conversation replied "I'm having trouble
retrieving..." again *without even attempting the tool call* — looked like the fix hadn't taken.
Inspecting `n8n_chat_histories` directly showed why: that session's persisted memory still
contained the earlier failed tool-call exchanges from *before* the fix, and the model reasonably
declined to retry something its own visible history said had just failed. **Any time a fix to an
AI Agent's tools needs to be re-verified in an existing WhatsApp conversation, clear that session's
rows from `n8n_chat_histories` first** (`delete from n8n_chat_histories where session_id =
'<remoteJid>'`), or test against a fresh session — otherwise a real fix can look like it didn't
work.

**Known limitation, accepted deliberately for v1**: `site_id` validation is prompt-engineering
only — the system prompt tells the model the contractor's exact site list and says never to invent
a `site_id`, but nothing at the tool-call layer hard-blocks the model from passing an arbitrary
UUID. `bot_query_site_data()` itself does no authorization check by design (its own comment says
site_id is "always resolved and verified server-side... before this is ever called" — i.e. by
n8n, not by the function). The residual risk is bounded by site UUIDs being unguessable and never
appearing anywhere in a contractor's own conversation context, but this is not a hard guarantee.
If this bot becomes real-user-facing rather than a v1 demo, add a server-side check (e.g. the
sub-workflow's Postgres node verifying `site_id` is actually in a temp allowlist of that
contractor's sites before calling the RPC) rather than trusting the prompt alone.

#### A second real bug, found after real usage: `Postgres Chat Memory`'s windowing corrupts tool-call pairing once history exceeds `contextWindowLength`

After the above was verified working, real continued WhatsApp usage started failing with OpenAI
rejecting the request outright: `Invalid parameter: messages with role 'tool' must be a response to
a preceeding message with 'tool_calls'.` The user's first hypothesis was a hand-rolled messages
array (a Code node or manual history query) — **confirmed via `n8n_get_workflow(mode: "structure")`
that no such node exists**; message assembly is entirely internal to the native `AI Agent` +
`Postgres Chat Memory` nodes, so the bug had to be in n8n's own packaged node behavior, not this
workflow's construction.

**Root cause, isolated empirically, not guessed**: `Postgres Chat Memory`'s `Context Window Length`
defaulted to `5` (never set explicitly when this node was first created) and n8n's own docs only
vaguely describe it as "the number of previous interactions to consider." Three real executions
nailed it down:
1. A session with 14 stored messages (several full tool-calling exchanges deep) failed on the very
   next message — reproduced live via `n8n_test_workflow` against a synthetic payload, not just
   theorized.
2. A *second*, separate real session with only 4 stored messages (well under the window size, so no
   trimming should occur) sent successfully — ruling out a blanket message-ordering bug affecting
   every conversation.
3. **The decisive test**: manually trimmed the failing 14-message session down to exactly its last
   5 rows via direct SQL (`AI, HUMAN, AI+tool_calls, TOOL, AI` — a shape already confirmed correctly
   paired by inspecting `n8n_chat_histories` directly) and re-sent the same message. It succeeded.
   The identical 5-message shape worked when it was the *entire* stored history, but broke when it
   was a *window trimmed out of* 14 stored rows — meaning the bug lives specifically in how
   `Postgres Chat Memory` performs that windowing/trimming once history exceeds
   `contextWindowLength`, not in the message content, order, or pairing logic itself, and not
   something reachable or fixable from this workflow's own nodes (the LangChain memory node is a
   packaged n8n core node, not editable code in this workflow).
- **Fix**: raised `contextWindowLength` from the default `5` to `50` on the `Chat Memory` node —
  high enough that a single contractor's WhatsApp conversation won't realistically hit the trigger
  condition, sidestepping the buggy trim path entirely rather than attempting to patch behavior
  inside a compiled n8n package. Re-verified against the same real session, now grown past the old
  threshold of 5 (7+ stored messages, including fresh tool-calling turns): both a plain
  conversational reply and a real tool-calling query (open defects on site 2b — correctly returned
  the exact seeded defect) succeeded with no error.
- **If this resurfaces on a very long-running conversation** (unlikely for a single contractor's
  WhatsApp thread, but possible over weeks of use): the real fix would be a scheduled cleanup of
  `n8n_chat_histories` that prunes whole logical turns (never leaving a `tool`-role message without
  its paired `tool_calls` predecessor), not just raising the number further. Not built now since
  extending the ceiling already sidesteps this at any realistic usage volume — noting as a known,
  bounded limitation rather than solving a problem that hasn't actually recurred.

**Verified end-to-end 2026-07-17**, real WhatsApp conversation with the contractor "fares"
(`254700920985`): "hello" → conversational reply; "how many people attended site 2b this week?"
→ correctly answered from real seeded attendance data ("2 attendees: yourself and Ian"); "what is
the progress on site 5b and are there any open defects?" → correctly combined two tool calls into
one natural-language answer (43% complete, milestones, and a real list of open defects, including
the deliberately-seeded ones) with correct WhatsApp bold formatting after the prompt fix. Iterated
using `n8n_test_workflow` against synthetic payloads matching Evolution API's real captured
`MESSAGES_UPSERT` shape once that shape was known, rather than asking for a fresh real WhatsApp
message on every retry.

### Testing a scheduled (cron-triggered) workflow

`n8n_test_workflow` can only invoke webhook/form/chat triggers, not a Schedule Trigger — there's no
way to fire a cron-triggered workflow on demand via the API. The pattern used for every scheduled
workflow in this repo: temporarily add a second trigger node (a plain Webhook, same
`responseMode: responseNode` shape as the event workflows) wired into the same first real node,
test it with `n8n_test_workflow` against that path, confirm the output, then remove the temporary
webhook trigger (and its now-orphaned response node) before calling the workflow finished — the
final exported JSON should only ever have the one real Schedule Trigger.

### 1. Severe Incident Alert (WhatsApp)

- **Trigger**: `sites`/`incident_log`'s existing `notify_owner_on_severe_incident()` trigger
  (medium/high severity) fires `net.http_post` at
  `https://primary-production-bd339.up.railway.app/webhook/severe-incident` with header
  `x-webhook-secret` and a JSON body (`incident_id`, `site_name`, `owner_email`, `owner_phone`,
  `severity`, `category`, `description`, `workers_involved`, `date`).
- **Webhook path**: `severe-incident` (POST only).
- **Flow**: Webhook → query `vault.decrypted_secrets` for `severe_incident_webhook_secret` →
  compare against the `x-webhook-secret` header (reject with 401 on mismatch, this is the only
  thing standing between this public webhook and anyone POSTing fake incidents) → check
  `owner_phone` is present (skip send with a 200 if not, rather than erroring) → send via Evolution
  API → respond 200.
- **Why the secret check happens inside n8n, not just at the Postgres trigger**: the webhook itself
  is a public URL with no other auth — the shared secret is the only thing verifying a request
  actually came from the Supabase trigger and not an arbitrary POST.
- **The `Send WhatsApp Alert` node strips non-digit characters from `owner_phone` before sending**
  (`.replace(/\D/g, '')`), rather than trusting it's already in the app's normalized
  `2547XXXXXXXX` shape. Found live while testing: one real dev-project profile had a phone number
  stored with a leading `+` (`+254700920985`, likely predating or bypassing
  `normalizeKenyanPhone()`), and Evolution API's `/message/sendText` endpoint 404s/silently
  mis-sends on a `+`-prefixed number. Any future workflow that sends to `profiles.phone_number`
  should apply the same defensive strip rather than assuming the column is always clean.
- **Verified end-to-end 2026-07-16**: inserted a real `high`-severity `incident_log` row for a live
  dev-project site via direct Postgres access, confirmed the DB trigger fired
  `net.http_post` → n8n webhook → secret verified → WhatsApp message delivered (Evolution API
  returned `status: PENDING` against `254700920985@s.whatsapp.net` with the correct incident
  details). Test rows (`incident_log` + the resulting `notifications` row) were deleted afterward.

### 2. Permit Request Notification (WhatsApp)

- **Trigger**: a new `notify_owner_on_permit_request()` trigger
  (`supabase/migrations/20260731090100_notify_owner_on_permit_request.sql`) fires `AFTER INSERT ON
  work_permit` and calls `net.http_post` at
  `https://primary-production-bd339.up.railway.app/webhook/permit-requested` — same
  Vault-secret-header pattern as workflow 1, using its own distinct secret name
  (`permit_requested_webhook_secret`, created out-of-band via `select vault.create_secret(...)`,
  same reasoning as `severe_incident_webhook_secret`: a migration file is git-tracked and a secret
  never belongs in one).
- **This required a new migration** — `work_permit` previously only had an `AFTER UPDATE` trigger
  (notifying the *requester* when their permit is approved/rejected); there was no `AFTER INSERT`
  trigger notifying the *owner* that a permit needs a decision. That gap is exactly what this
  workflow closes.
- **Guards against an owner notifying themselves**: `work_permit`'s INSERT policy allows either the
  site owner or the assigned foreman to request a permit (unlike most tables where only a foreman
  would plausibly file something for the owner to review) — the trigger function skips the
  notification/webhook entirely when `owner_id = requested_by`.
- **Webhook path**: `permit-requested` (POST only).
- **Flow**: identical shape to workflow 1 — verify `x-webhook-secret` → check `owner_phone` present
  → send via Evolution API (same `.replace(/\D/g, '')` phone-sanitizing fix) → respond 200.
- **Verified end-to-end 2026-07-16**: inserted a real `work_permit` row (`hot_work`, `pending`) as
  an assigned foreman distinct from the site owner, via direct Postgres access. Confirmed the new
  trigger fired → n8n webhook received it → secret verified → WhatsApp message delivered (Evolution
  API returned `status: PENDING`) with the correct permit type, requester name, and validity window.
  Test rows (`work_permit` + the resulting `notifications` row) were deleted afterward.

### 3. Variation Order Raised Notification (WhatsApp)

- **Recipient is the assigned foreman, not the site owner** — deliberately different from
  workflows 1 and 2. `20260722090000_contract_admin_owner_only.sql` made raising a variation order
  **owner-only** ("the contractor uses it as their own record/reminder, not a
  foreman-raises/contractor-approves workflow"), so notifying the owner about their own action
  would be a pointless self-notification. The foreman is who actually benefits from knowing — they
  can respond via the existing `variation_order_response` thread, and a variation frequently
  changes what they're building day to day. Flagged to the user as a deviation from the original
  "notify the owner" framing in the build request; proceeded since it's the only sensible target
  given the current (2026-07-22) schema.
- **Trigger**: new `notify_foreman_on_variation_order()` trigger
  (`supabase/migrations/20260731090200_notify_foreman_on_variation_order.sql`), `AFTER INSERT ON
  variation_order`. Looks up the site's active `site_assignments` row for the foreman id (a site
  can only have one active foreman per the existing partial unique index), then calls
  `net.http_post` at `.../webhook/variation-order-raised` with its own Vault secret
  (`variation_order_raised_webhook_secret`, created out-of-band). No trigger existed on
  `variation_order` at all before this — confirmed by grepping every `create trigger` in
  `supabase/migrations/`.
- **Webhook path**: `variation-order-raised` (POST only).
- **Flow**: same shape as workflows 1–2 — verify secret → check `foreman_phone` present (skips
  cleanly if the site has no active foreman assigned, or the assigned foreman has no phone number)
  → send via Evolution API → respond 200.
- **Cost impact is formatted with `en-KE` thousands separators** (`Number(...).toLocaleString('en-KE')`,
  e.g. `KES 1,250,000`) rather than a raw number — matching the app's existing inline
  locale-formatting convention (CLAUDE.md's `toLocaleTimeString('en-KE', ...)` pattern, applied here
  to a number instead of a time).
- **Verified end-to-end 2026-07-16**, three real inserts against a live dev-project site: (1) with
  the assigned foreman having no phone number on file — confirmed the trigger fired, notification
  inserted, webhook secret verified, and the workflow cleanly took the "no phone" skip branch
  without erroring; (2) after temporarily setting a real phone number on that foreman's profile —
  confirmed the full send path, WhatsApp message delivered (`status: PENDING`) with correct title/
  cost/time-impact/description; (3) a third insert with a larger cost value to confirm the
  thousands-separator formatting fix rendered as `KES 1,250,000`. All test rows
  (`variation_order` + `notifications`) were deleted and the foreman's phone number was reverted to
  `null` afterward.

### 4. Foreman Invite Email (Gmail)

- **Trigger**: new `notify_on_invite_created()` trigger
  (`supabase/migrations/20260731090300_notify_on_invite_created.sql`), `AFTER INSERT ON invites`,
  only fires when `email` is set (the column is nullable). Same Vault-secret pattern as the other
  three (`invite_created_webhook_secret`), posting to `.../webhook/invite-created`.
- **Replaces, not adds to, the previous email path**: `useCreateInvite()`
  (`src/hooks/useInvite.tsx`) used to fire a best-effort, fire-and-forget
  `supabase.functions.invoke('send-invite-email', ...)` (Resend) straight from the browser — if the
  tab closed before that call landed, the invite existed with no email ever sent, silently. That
  client-side call was removed so there's exactly one delivery path (the DB trigger), not two competing
  ones that could double-send. The `send-invite-email` edge function itself was left in the
  codebase, just unused.
- **Webhook path**: `invite-created` (POST only).
- **Flow**: verify secret → check `email` present (skip cleanly with 200 if not) → send via Gmail
  (`resource: message`, `operation: send`, HTML body with a join link built from the token) →
  respond 200.
- **The join link's base URL (`https://mutisoai.vercel.app`) is hardcoded in the node**, confirmed
  directly with the user rather than guessed (URLs are never fabricated) — update this node's
  `message` expression if the production domain ever changes.
- **Verified end-to-end 2026-07-16**: first attempt failed with `Unable to sign without access
  token` — the Gmail credential existed in n8n but had never completed Google's OAuth consent
  screen (an API-created OAuth2 credential has no token until a human does this once in the UI).
  After the user connected it manually, a second real `invites` insert (targeting the user's own
  Gmail address) triggered the webhook, passed secret verification, and Gmail confirmed the send
  (`labelIds: ["SENT"]`, a real message id) — user confirmed the email actually arrived with a
  working join link. Test invite rows were deleted afterward.

### 5. Certification & Insurance Expiring Digest (WhatsApp)

- **Trigger**: `Daily Schedule` cron node, 07:00 `Africa/Nairobi` (workflow `settings.timezone` is
  set explicitly so `triggerAtHour: 7` means 7am EAT, not UTC or the n8n instance's default). No
  Vault secret / webhook-secret verification needed here at all — unlike workflows 1–4, there's no
  public webhook a stranger could POST to; the only way this workflow runs is n8n's own scheduler.
- **One query, one row per contractor**: a single Postgres node UNIONs two expiry sources —
  `certification` (worker or equipment certs, joined to whichever of `workers_master`/
  `tool_inventory` the row points at) and `subcontractor.insurance_expiry` — filtered to
  `expiry_date <= current_date + interval '30 days'` (matching `isExpiringSoon()`'s existing
  `days < 30` client-side logic exactly, including already-expired items, not just upcoming ones),
  restricted to `sites.status = 'active'`. Grouped by `owner_id` with `string_agg` building the
  entire digest body (one line per item, `EXPIRED <date>` vs `expires <date>`) directly in SQL —
  avoids iterating a JSON array with n8n expressions for what's fundamentally a text-formatting
  problem.
- **Flow**: cron → query → check `owner_phone` present (skips silently, no response node needed for
  a cron trigger) → send one combined WhatsApp digest per contractor via Evolution API.
- **Verified end-to-end 2026-07-16** using the temporary-webhook pattern described above: seeded one
  test `certification` row (expiring in 10 days) and one test `subcontractor` row (insurance expired
  2 days ago) against the "2b" site, then triggered manually. The digest correctly picked up not
  just the two seeded rows but **8 real pre-existing expiring items across two of the user's actual
  sites** ("2b" and "5b"), grouped under the single contractor who owns both, with the EXPIRED/
  expires distinction and dates rendering correctly, delivered as one WhatsApp message
  (`status: PENDING`). Confirms the query works against real data, not just a synthetic fixture.
  Seeded test rows were deleted afterward; the two genuine sites' real certification/insurance data
  was left untouched (it was already there before this session).

### 6. Weekly Payroll Reminder (WhatsApp)

- **Trigger**: `Monday Schedule` cron node, Mondays 07:00 `Africa/Nairobi`. No webhook secret, same
  reasoning as workflow 5.
- **"Prior week" is Monday–Sunday just ended**, computed as
  `date_trunc('week', current_date) - interval '7 days'` for the start (Postgres's `date_trunc`
  treats Monday as the start of the week) — so a reminder firing Monday morning always refers to
  the week that ended the day before, not the week in progress.
- **Only reminds about a site if it actually has attendance logged for that week** (`exists (select
  1 from attendance_log ...)`) — an active site with no attendance yet (brand new, or the foreman
  hasn't started logging) has nothing to pay and shouldn't generate a nagging reminder. Sites that
  already have a matching `payroll_run` row (`unique (site_id, week_start)`) for that week are
  excluded via `not exists`.
- **One message per contractor, listing every site of theirs missing payroll** — grouped by
  `owner_id`, same `string_agg` pattern as workflow 5.
- **Verified end-to-end 2026-07-16** using the temporary-webhook pattern. First test run against
  live data returned 9 real rows, all correctly filtered out by the `Has Phone` check (leftover
  test-contractor profiles from earlier stage verification with no phone number on file — see
  CLAUDE.md's note on these) — confirmed the skip path works. To verify the actual send path,
  seeded one temporary site + worker + attendance row (dated within last week's Mon–Sun window)
  owned by a real contractor with a real phone number, and confirmed no `payroll_run` row already
  existed for it. Re-triggered: correctly identified the new site as missing payroll and delivered
  a WhatsApp message (`status: PENDING`) naming the site and the correct week range. The temporary
  site was deleted afterward (cascades to its worker/attendance rows).

### 7. Weekly Site Digest (WhatsApp)

- **Trigger**: `Monday Schedule` cron, Mondays 08:00 `Africa/Nairobi` (30 minutes after workflow 6's
  payroll reminder, so the two don't land in the same instant). Same "prior week" window as
  workflow 6.
- **One message per site, not one combined message per contractor** — deliberately different from
  workflows 5/6. "Per site, summarize..." (the original build request's wording) reads more
  naturally as a per-site report; a contractor with several active sites gets several separate
  digest messages, one per site, rather than everything mashed into one wall of text.
- **"Milestones ready to sign off" was replaced with "milestones completed this week"** — a real
  deviation from the original build request, flagged to the user before building. CLAUDE.md
  documents milestone completion as a client-side "nudge, human confirms" design, but a later
  migration (`20260730090000_automatic_milestone_status.sql`, dated after that documentation) made
  milestone completion **fully automatic** at the user's explicit request: a milestone with linked
  activities transitions itself to `completed` (via triggers reacting to activity/defect/permit
  updates) the instant every linked activity hits 100% and zero defects remain open — there's no
  lingering "ready but waiting for a human" state left for a digest to catch for the common case, it
  already happened. Reporting "completed this week" (`site_milestone.status = 'completed' and
  signed_off_at` in the week window) reflects what the system now actually does, rather than
  querying for a state that structurally can't persist.
- Other stats are straightforward counts for the week: `attendance_log` rows, `site_diary_log`
  entries (by `date`, not `created_at`), `defect_log` opened (`created_at`) and closed (`status =
  'resolved' and verified_at` in range).
- **Only sends for a site with ≥1 nonzero stat** — an active site with nothing to report (no
  attendance, no diary, no defects, no milestone completions) doesn't get a content-free digest.
- **Verified end-to-end 2026-07-16** using the temporary-webhook pattern, against real data with no
  synthetic seeding needed — 14 active sites in the dev project already had enough real history.
  The query correctly returned 14 rows, filtered to the 2 sites whose owner had a real phone number
  ("2b" and "5b"), and delivered two separate WhatsApp messages (`status: PENDING` each) with
  genuinely different, correct per-site stats — "2b" showed 5 attendance marks, 2 diary entries, 4
  defects opened, 2 closed, and 2 milestones completed that week; "5b" showed 8 attendance marks, 2
  diary entries, and zero for the rest. No cleanup needed since no test data was inserted.

### 8. Budget Overrun Alert (WhatsApp)

- **Trigger**: `Tuesday Schedule` cron, Tuesdays 07:00 `Africa/Nairobi` — a different day from
  workflows 6/7 so the contractor doesn't get three separate scheduled WhatsApp messages on the
  same morning.
- **Labor is unioned in from `payroll_line.gross_amount`, not `actual_cost`** — per CLAUDE.md,
  `actual_cost` is deliberately non-labor-only (`cost_type` has no `'labor'` option; labor's actual
  cost already exists as `payroll_line.gross_amount` and isn't duplicated into `actual_cost`). The
  query's `actuals` CTE unions `actual_cost` (by `cost_type`) with a `payroll_run`/`payroll_line`
  join hardcoded to `category = 'labor'`, so a site's labor budget line gets compared against real
  payroll spend, not silently against zero.
- **Grouped by `(site_id, category)`, not by `budget_line` row** — a site can have more than one
  `budget_line` row in the same category (e.g. two separate `material` lines added at different
  times), so both `budget` and `actuals_agg` sum-and-group by category first before comparing, or a
  site with multiple same-category budget lines would under-count its true budgeted total. **Found
  live while testing**: an early test seeded a new `material` budget line directly on a real site
  that already had a real KES 700,000 `material` budget — the two summed to 800,000, diluting the
  percentage and silently producing zero flagged rows. Switched to an isolated temporary site for
  the rest of the test rather than perturbing real financial data on a live site.
- **One combined message per contractor** (like workflow 5), not one per site/category — `string_agg`
  over every flagged `(site, category)` pair at ≥90%, sorted worst-first, with KES amounts formatted
  via `to_char(..., 'FM999,999,999')` for thousands separators.
- **Verified end-to-end 2026-07-16**: first run against real data returned zero rows (nothing over
  90% currently) — confirmed as a true negative, not a query bug, by directly inspecting
  `budget_line`/`actual_cost` rows. Seeded an isolated temporary site with a KES 100,000 `material`
  budget line and a KES 95,000 `actual_cost` entry (95% spent) — re-run correctly flagged it and
  delivered a WhatsApp alert (`status: PENDING`) reading `n8n Budget Overrun Test Site (material):
  KES 95,000 / KES 100,000 (95.0%)`. Temporary site deleted afterward (cascades to its budget/actual
  rows).

### 9. Tool & Maintenance Digest (WhatsApp)

- **Trigger**: `Wednesday Schedule` cron, Wednesdays 07:00 `Africa/Nairobi` — another distinct day
  from workflows 6/7/8.
- **"Overdue" for a tool checkout had to be defined, not looked up** — `tool_checkout_log` has no
  expected-return-date column at all, only `checked_out_at`/`returned_at` (confirmed by reading its
  full schema in `20260711090000_tools_and_equipment.sql`, plus every later migration touching the
  table). There's no due date to compare against, so "overdue" here means **an open checkout
  (`returned_at is null`) more than 7 days old** — a heuristic, not a stored business rule. Flagged
  to the user before building; if a real expected-return-date field gets added later, this should
  switch to using it instead of the 7-day heuristic.
- **Maintenance due uses each tool's most recent `equipment_maintenance_log` row** (`distinct on
  (tool_id) ... order by tool_id, performed_at desc`) — a tool can have several historical
  maintenance entries, only the latest one's `next_due_date` is relevant. Flags anything due within
  the next 7 days, labeling already-past dates `OVERDUE` vs. upcoming ones `due <date>`.
- **One combined message per contractor**, both issue types merged into one `combined` CTE via
  `union all` before the final `string_agg`, same shape as workflows 5/8.
- **Verified end-to-end 2026-07-16**: first run against real data returned zero rows. Seeded an
  isolated temporary site (learning from workflow 8's mistake — never perturb a real site's
  financial/asset data for a test) with one tool checked out 10 days ago (no return) and one piece
  of plant with a maintenance `next_due_date` 3 days out. Re-run correctly flagged both, one message
  listing `Overdue checkout: Test Drill (out to Test Worker since 06 Jul)` and `Maintenance due: Test
  Excavator (due 19 Jul 2026)`, delivered via WhatsApp (`status: PENDING`). Temporary site deleted
  afterward (cascades to its tool/checkout/maintenance rows).

### 10. Waste Disposal Compliance Digest (WhatsApp)

- **Trigger**: `Thursday Schedule` cron, Thursdays 07:00 `Africa/Nairobi` — last of the four distinct
  weekday slots used across workflows 6–10 (Mon/Mon/Tue/Wed/Thu), avoiding any single-morning
  message pileup for a contractor with active sites.
- **Grouped by `(site, waste_type, disposal_method)`** for the week, summing `quantity` where
  present (falls back to a plain entry count for rows with no quantity recorded, e.g. `quantity`
  is nullable) — `string_agg(distinct wl.unit, '/')` handles the rare case of mixed units within
  one group without erroring.
- **One combined message per contractor**, same shape as workflows 5/8/9.
- **Verified end-to-end 2026-07-16** using the temporary-webhook pattern, against real data with no
  synthetic seeding needed — real `waste_log` entries across sites "2b" and "5b" already existed.
  Delivered one WhatsApp message (`status: PENDING`) correctly grouping and summing 4 real entries:
  `2b: construction_debris (licensed_transporter) - 2 truckloads`, plus three more lines for site
  "5b" across different waste types/disposal methods/units (truckloads and kg in the same message,
  correctly not conflated). No cleanup needed since no test data was inserted.

## Re-exporting after an edit

Whenever a workflow is changed in n8n (via the UI or via n8n-mcp), re-export it:

```
mcp__n8n-mcp__n8n_get_workflow(id: "<workflow id>", mode: "full")
```

and overwrite the matching file under `workflows/`, keeping the same node `id`s/`name`s so diffs
stay readable. Strip nothing else out manually — the whole point is these files mirror what's
live.

## Re-importing / disaster recovery

1. Recreate the two credentials first (workflows reference them by id, so import will need
   re-linking — n8n's import UI lets you remap credentials per node):
   - `Supabase Dev (mutiso-v2 kmcgcqnuxixsxqwigfir)` — type Postgres, session pooler host, see
     "Supabase access" above. Password is in `.db_password.txt` (gitignored).
   - `Evolution API (mutiso-test5)` — type Header Auth, header name `apikey`, value = the
     Evolution API instance's `AUTHENTICATION_API_KEY`.
   - `Gmail account` — type Gmail OAuth2. Must be connected through n8n's UI (click through
     Google's consent screen) after creation — an API-created OAuth2 credential has no
     access/refresh token and every Gmail node will fail with `Unable to sign without access
     token` until this manual step happens once.
   - `OpenAI (Mutiso Chatbot)` — type OpenAI API, just needs the API key (no OAuth dance, unlike
     Gmail).
2b. **`11-whatsapp-chatbot.json` depends on `11b-bot-query-subworkflow.json` existing first** —
   import `11b` before `11`, then re-point `11`'s `query_site_data` node's `workflowId` at the
   freshly-imported `11b`'s new id (the exported JSON has the old instance's workflow id embedded,
   same reasoning as node-level credential ids below).
2. Import each `workflows/*.json` file via n8n's UI ("Import from File") or
   `mcp__n8n-mcp__n8n_create_workflow` with the file's `nodes`/`connections`.
3. Re-link each node's credential to the freshly created credential IDs (the exported JSON still
   has the old instance's credential ids embedded).
4. Activate the workflow.
5. For webhook-triggered workflows, confirm the live URL
   (`https://primary-production-bd339.up.railway.app/webhook/<path>`) matches wherever it's
   referenced elsewhere (e.g. the Postgres trigger's `net.http_post` call) — re-point that if the
   n8n host itself ever changes.
6. Every event-triggered workflow's DB-side trigger is a real migration under `supabase/migrations/`
   (e.g. `20260731090100_notify_owner_on_permit_request.sql`) — these apply automatically via the
   normal `supabase db push` flow, they don't need separate recreation. The one thing that IS
   out-of-band per trigger is its Vault secret (`select vault.create_secret(<value>,
   '<name>_webhook_secret')`, run once directly against the project) — re-create it and update the
   matching n8n workflow's expected value if it's ever lost or rotated.
