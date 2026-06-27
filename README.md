# TriageWise

**A cost-optimized AI IT-helpdesk agent on Vercel's [eve](https://github.com/vercel/eve) framework.**
It triages, resolves, and escalates support tickets while cutting LLM cost ~90% by
routing the easy, repetitive 80% of tickets to a cheap open model + a knowledge-base
cache, and spending Claude only on the genuinely hard, novel ones.

> On the 12 sample tickets: **$0.055 → $0.004, ~93% cheaper.**
> Projected at 1,000 tickets/day: **~$139/mo → ~$10/mo.**

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
- **Live:** _(add your Vercel / custom-domain URL here)_

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
| **Anthropic** | Claude `diagnose` subagent for hard tickets; prompt caching on the system prompt | **Built** (subagent); caching noted |
| **Supabase** | **Live knowledge-base store** (`kb_entries`); ticket store + pgvector are the next step | **Built** (live KB; pgvector-ready) |
| **Sentry** | OpenTelemetry trace export; *bonus:* Sentry alerts auto-open tickets | **Architected** (next) |
| **Resend** | Email the requester on status changes (resolved/escalated) | **Architected** (next) |
| **Auth0** | Role-based auth — IT-staff vs requester; approval gate restricted to staff. See [auth0/agent-skills](https://github.com/auth0/agent-skills) | **Architected** (next) |

---

## 90-second demo script

1. **(0:00)** Open the live URL. Point at the **DEMO MODE** + **KB · Supabase** badges.
2. **(0:10)** Press **Run triage**. Tickets stream in — call out the green **KB CACHE HIT** rows ("repeat tickets resolved from the Supabase KB at ~$0").
3. **(0:30)** Two **Claude** rows light up purple — "only the hard, novel tickets pay for the smart model."
4. **(0:45)** It **pauses on the P1** ("production DB down"). Click **Approve & page on-call** — eve's human-in-the-loop guardrail; the run resumes.
5. **(1:00)** Land on the hero: **~93% cheaper**, **~$139/mo → ~$10/mo** at scale.
6. **(1:20)** "Cheap model + Supabase KB cache for the easy 80%, Claude only when it counts — on Vercel eve + AI Gateway."

---

## Tech used

Vercel (eve, AI Gateway), Anthropic Claude, Supabase (Postgres KB), Next.js, TypeScript,
Zod, AI SDK. *(Architected next: Sentry, Resend, Auth0.)*

## Notes / scope

- KB similarity is a deterministic in-app lexical match over entries from Supabase (or the
  in-memory seed). pgvector embeddings are a planned upgrade.
- Lifecycle is intentionally minimal: `new → triaged → resolved | escalated`.
- DEMO numbers are deterministic; LIVE costs come from real gateway token usage.
