# TriageWise

**A cost-optimized AI IT-helpdesk agent on Vercel's [eve](https://github.com/vercel/eve) framework.**
It triages, resolves, and escalates support tickets while cutting LLM cost ~90% by
routing the easy, repetitive 80% of tickets to a cheap open model + a knowledge-base
cache, and spending Claude only on the genuinely hard, novel ones.

> On a typical batch: **~$0.05 → ~$0.004, ~90%+ cheaper.** Each run samples a fresh mix
> of tickets, so the exact numbers shift.
> Projected at 1,000 tickets/day: **~$140/mo → ~$10/mo.**

**▶ Live demo: [triagewise.rianfernando.com](https://triagewise.rianfernando.com)**

The hero is a live **side-by-side naive-vs-optimized cost meter**, with a human-approval
gate on P1 escalations (eve's built-in HITL guardrail) and a **Supabase-backed knowledge base**.

---

## Quickstart

> Requires **Node.js ≥ 24** (eve requirement). `nvm use 24` if you have nvm.

```bash
npm install
npm run dev          # open http://localhost:3000  → press "Run triage"
npm run demo         # same run, in the terminal
```

No keys needed — it runs in **DEMO mode** out of the box. A **LIVE vs DEMO** badge and a
**KB · Supabase / in-memory** badge show what's wired.

---

## Modes & config

| Variable | Effect |
| --- | --- |
| _(none)_ | **DEMO models + in-memory KB** — realistic canned classifications/resolutions, plausible token counts. Always runs. |
| `AI_GATEWAY_API_KEY` | **LIVE models** — real classify/resolve/diagnose via the Vercel AI Gateway. |
| `ANTHROPIC_API_KEY` | Alternative LIVE credential (Claude direct). |
| `TRIAGEWISE_CHEAP_MODEL` | Override the cheap/fast model (default `meta/llama-3.1-8b`). |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | **Live Supabase KB** — the app fetches `kb_entries` from your Supabase Postgres. Falls back to in-memory automatically. |
| `RESEND_API_KEY` + `NOTIFY_DEMO_RECIPIENT` | Send a **real status email** on P1 approval (else simulated). |

Any failed model/DB call falls back per-call, so the run never aborts mid-stage.
Copy `.env.example` → `.env.local` and fill in what you want (it's gitignored).

---

## How it works

**Pipeline (per ticket):** `classify → check KB → route → cost`
(`new → triaged → resolved | escalated`).

1. **Classify** (cheap model) → `category` (network/account/hardware/software),
   `priority` (P1–P4), `difficulty` (easy/medium/hard).
2. **KB lookup** (`check_kb`) — deterministic lexical similarity over the knowledge
   base (Supabase when configured, in-memory otherwise). A high-similarity match is a
   **near-zero-cost cache hit**.
3. **Route:** KB hit → cache · **P1** → `escalate_ticket` (human approval) · **hard** →
   Claude `diagnose` subagent · **easy/medium** → cheap model.
4. **Cost:** two running totals — *naive* (every ticket → Claude) vs *optimized* (actual).

**Built with eve's native primitives** (`agent/`): `instructions.md` (persona + triage
rules), `agent.ts` (root model), `subagents/classifier` (cheap) + `subagents/diagnose`
(Claude), and Zod tools `check_kb`, `update_ticket`, `escalate_ticket`
(**`approval: always()`** human gate), `track_cost`. Shared pure logic lives in
`agent/lib/` and is what the dashboard renders (stage-proof, exact costs); the eve agent
exposes the same capabilities natively (`npm exec -- eve dev`).

> **Model id note:** AI Gateway slugs use a **dot** (`anthropic/claude-sonnet-4.6`).
> The hyphen form (`claude-sonnet-4-6`) is only for the direct Anthropic SDK.

**Fresh batch each run.** Every run samples ~12 tickets from a larger pool, so the mix
(and the savings number) changes each time — a quick way to show it holds up across
scenarios. **Replay** re-runs with a new sample.

---

## Does it actually call Claude? (LIVE vs DEMO)

Yes — the LIVE path is real and already in the code. With **no** model credential the app
serves deterministic **DEMO** data (canned classifications/resolutions) so it always runs.
Add a credential and the same pipeline calls the **cheap model** (classify + easy/medium)
and **Claude** (hard tickets) through the Vercel AI Gateway, with real token usage driving
the cost meter.

- **Locally:** put `AI_GATEWAY_API_KEY=...` (a Vercel AI Gateway key) in `.env.local`.
- **On Vercel:** add `AI_GATEWAY_API_KEY` in project env, or enable AI Gateway and let
  project **OIDC** authenticate automatically.

The header badge is **truthful**: it reads **LIVE** only when a real model call actually
succeeded this run, and **DEMO** otherwise (including when a call was configured but fell
back to canned). So if it says LIVE, those answers came from Claude / the cheap model.

---

## Supabase setup (live KB)

1. In your Supabase project: **SQL Editor → New query →** paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) **→ Run.** This creates and seeds the
   `kb_entries` table with a public read-only RLS policy.
2. Put your project URL + **publishable (anon)** key in `.env.local`:
   ```bash
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   ```
3. Run the app — the footer/badge now reads **KB · Supabase**, and `check_kb` resolves
   from your database. (Without the table, it transparently uses the in-memory KB.)

> The publishable key is public-by-design and protected by row-level security, so it's
> safe in client/edge contexts. Similarity scoring runs in-app; pgvector embeddings are a
> future upgrade (add an embedding key and store vectors in `kb_entries`).

---

## Deploy to Vercel

eve deploys to Vercel (Nitro build output). The public URL defaults to **DEMO mode** so
it's always live during judging.

1. **[vercel.com/new](https://vercel.com/new)** → import **Rian-Fernando/TriageWise** → **Deploy** (eve/Next auto-detected).
2. Project → **Settings → Environment Variables**, add (optional, for live data):
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `AI_GATEWAY_API_KEY` if you want LIVE models.
   Redeploy.

- **Repo:** https://github.com/Rian-Fernando/TriageWise
- **Live:** https://triagewise.rianfernando.com

---

## Custom domain — triagewise.rianfernando.com (Cloudflare → Vercel)

Do this *after* the first Vercel deploy.

1. **Vercel** → Project → **Settings → Domains** → add `triagewise.rianfernando.com`.
   Vercel shows a DNS record to create — a **CNAME** to `cname.vercel-dns.com`.
2. **Cloudflare** → `rianfernando.com` → **DNS → Records → Add record**:
   - **Type:** CNAME
   - **Name:** `triagewise`
   - **Target:** `cname.vercel-dns.com`
   - **Proxy status:** **DNS only** (grey cloud) ← important; lets Vercel issue TLS directly
   - **TTL:** Auto
3. Back in Vercel, wait for **"Valid Configuration"** (1–3 min). Vercel auto-provisions HTTPS.
4. Visit **https://triagewise.rianfernando.com**.

> Prefer Cloudflare's proxy (orange cloud) for caching/analytics? It works too — set
> Cloudflare **SSL/TLS → Full (strict)** first. DNS-only is the simplest reliable path.
> The dashboard footer links back to **rianfernando.com**; add a link to the subdomain
> from your portfolio to close the loop.

---

## Full architecture (production design)

How a production TriageWise uses all six sponsors. **Built** = in this repo;
**Architected** = designed, planned next.

| Sponsor | Use | Status |
| --- | --- | --- |
| **Vercel** | eve framework, **AI Gateway** model routing, Sandbox, Agent Runs observability | **Built** (eve + AI Gateway) |
| **Anthropic** | Claude `diagnose` subagent for hard/novel ticket diagnosis, routed via the AI Gateway | **Built** |
| **Supabase** | **Live knowledge-base store** (`kb_entries`); ticket store + pgvector are the next step | **Built** (live KB; pgvector-ready) |
| **Sentry** | OpenTelemetry trace export; *bonus:* Sentry alerts auto-open tickets | **Architected** — see below |
| **Resend** | Status email to the requester on P1 escalation approval (env-gated) | **Built** |
| **Auth0** | Role-based auth — IT-staff vs requester; approval gate restricted to staff. See [auth0/agent-skills](https://github.com/auth0/agent-skills) | **Architected** — see below |

---

## Planned integrations: Sentry & Auth0

Intentionally left as the next build (not wired yet) — here's exactly why each belongs and
how it plugs into the existing pipeline.

### Sentry — observability for the triage loop
- **Why:** once tickets auto-route, you need to see *what the agent did* and catch
  regressions (a model returning junk, a tool throwing, latency creeping up). A cost-routing
  agent without tracing is a black box.
- **Use:** every `/api/run` and each eve agent turn becomes a Sentry trace — spans for
  classify → KB lookup → resolve/diagnose → escalate, with token usage and the chosen path
  as attributes. Failed model/DB calls surface with context instead of silently falling back.
- **How it plugs in:** eve exposes `agent/instrumentation.ts` (OpenTelemetry); Sentry is an
  OTLP destination, so it's config + a DSN. For the web pipeline, wrap `runAll()` in a span
  and `captureException` on the per-call catches already in `triage.ts` / `kb.ts`.
  *Bonus:* a Sentry alert webhook can call the agent to auto-open a ticket for a new
  production error — closing the loop from "incident detected" to "triaged."
- **Needs:** a Sentry **DSN**.

### Auth0 — role-based access for IT staff
- **Why:** **Approve & page on-call** is a privileged action. In production only IT staff
  should approve escalations; requesters should only file/track their own tickets.
- **Use:** the public dashboard stays open, but clicking **Approve** prompts an Auth0 login
  and checks an `it-staff` role before the escalation fires — a real RBAC moment layered on
  eve's human-in-the-loop gate.
- **How it plugs in:** `@auth0/nextjs-auth0` protects the approve route and gates the button;
  eve's route protection (`vercelOidc()` / a custom `AuthFn`) secures the agent's own routes.
  The [auth0/agent-skills](https://github.com/auth0/agent-skills) patterns cover the token
  vault + on-behalf-of calls for agents acting per-user.
- **Needs:** Auth0 **domain**, **client ID/secret**, callback `…/api/auth/callback`.

---

## 90-second demo script

1. **(0:00)** Open the live URL. Point at the **DEMO MODE** + **KB · Supabase** badges.
2. **(0:10)** Press **Run triage**. Tickets stream in — call out the green **KB CACHE HIT** rows ("repeat tickets resolved from the Supabase KB at ~$0").
3. **(0:30)** Two **Claude** rows light up purple — "only the hard, novel tickets pay for the smart model."
4. **(0:45)** It **pauses on the P1 outage**. Click **Approve & page on-call** — eve's human-in-the-loop guardrail fires a Resend status email, then the run resumes.
5. **(1:00)** Land on the hero: **~90%+ cheaper**, **~$140/mo → ~$10/mo** at scale.
6. **(1:20)** "Cheap model + Supabase KB cache for the easy 80%, Claude only when it counts — on Vercel eve + AI Gateway."

---

## Tech used

Vercel (eve, AI Gateway), Anthropic Claude, Supabase (Postgres KB), Resend, Next.js,
TypeScript, Zod, AI SDK. *(Architected next: Sentry, Auth0.)*

## Notes / scope

- KB similarity is a deterministic in-app lexical match over entries from Supabase (or the
  in-memory seed). pgvector embeddings are a planned upgrade.
- Lifecycle is intentionally minimal: `new → triaged → resolved | escalated`.
- Each run samples a fresh ~12-ticket batch from a 22-ticket pool, so outputs vary run to run.
- DEMO token counts are deterministic per ticket; LIVE costs come from real gateway usage.
