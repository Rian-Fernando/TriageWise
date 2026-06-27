# TriageWise

**A cost-optimized AI IT-helpdesk agent on Vercel's [eve](https://github.com/vercel/eve) framework.**
It triages, resolves, and escalates support tickets while cutting LLM cost ~90% by
routing the easy, repetitive 80% of tickets to a cheap open model + a knowledge-base
cache, and spending Claude only on the genuinely hard, novel ones.

> On the 12 sample tickets: **$0.055 → $0.004, ~93% cheaper.**
> Projected at 1,000 tickets/day: **~$139/mo → ~$10/mo.**

The hero is a live **side-by-side naive-vs-optimized cost meter**. There's also a
human-approval gate on P1 escalations (eve's built-in HITL guardrail).

---

## Quickstart

> Requires **Node.js ≥ 24** (eve requirement). `nvm use 24` if you have nvm.

```bash
npm install
npm run dev          # open http://localhost:3000  → press "Run triage"
npm run demo         # same run, in the terminal
```

No keys needed — it runs in **DEMO mode** out of the box. A **LIVE vs DEMO** badge
shows which mode you're in.

### Go LIVE (real model routing)

Copy `.env.example` to `.env.local` and set one model credential:

```bash
AI_GATEWAY_API_KEY=...     # Vercel AI Gateway — routes anthropic/* and meta/* slugs
```

On Vercel you can skip the key entirely and rely on project OIDC for the gateway.

---

## Modes & config

| Variable | Effect |
| --- | --- |
| _(none)_ | **DEMO mode** — realistic canned classifications/resolutions + plausible token counts. Always runs. |
| `AI_GATEWAY_API_KEY` | **LIVE mode** — real classify/resolve/diagnose via the Vercel AI Gateway. |
| `ANTHROPIC_API_KEY` | Alternative LIVE credential (Claude direct). |
| `TRIAGEWISE_CHEAP_MODEL` | Override the cheap/fast model (default `meta/llama-3.1-8b`). |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Use a Supabase **pgvector** KB instead of the in-memory one (falls back automatically). |

Any failed model/DB call falls back to DEMO data per-call, so the run never aborts mid-stage.

---

## How it works

**Pipeline (per ticket):** `classify → check KB → route → cost → update status`
(`new → triaged → resolved | escalated`).

1. **Classify** with the cheap model → `category` (network/account/hardware/software),
   `priority` (P1–P4), `difficulty` (easy/medium/hard).
2. **KB lookup** (`check_kb`) — deterministic lexical similarity over a seeded IT
   knowledge base. A high-similarity match is a **near-zero-cost cache hit**.
3. **Route:** KB hit → cache · **P1** → `escalate_ticket` (human approval) · **hard** →
   Claude `diagnose` subagent · **easy/medium** → cheap model.
4. **Cost:** two running totals — *naive* (every ticket → Claude) vs *optimized* (actual).

**Built with eve's native primitives** (`agent/`):

| File | Role |
| --- | --- |
| `agent/instructions.md` | IT-helpdesk persona + triage rules |
| `agent/agent.ts` | Root agent, default model via AI Gateway |
| `agent/subagents/classifier/` | Cheap-model classifier (structured output) |
| `agent/subagents/diagnose/` | Claude diagnostic specialist (hard tickets) |
| `agent/tools/check_kb.ts` | Zod tool — KB cache lookup |
| `agent/tools/update_ticket.ts` | Zod tool — lifecycle/status |
| `agent/tools/escalate_ticket.ts` | Zod tool — **`approval: always()`** human gate |
| `agent/tools/track_cost.ts` | Zod tool — naive-vs-optimized ledger |
| `agent/lib/*` | Shared pure logic (models+prices, KB, triage, pipeline) |

The deterministic pipeline in `agent/lib/pipeline.ts` is what the dashboard renders
(stage-proof, exact costs); the eve agent above exposes the same capabilities as
native tools/subagents (try it with `npm exec -- eve dev`). The escalation tool uses
eve's real `approval` HITL; the dashboard reproduces the same pause for the live demo.

> **Model id note:** AI Gateway slugs use a **dot** (`anthropic/claude-sonnet-4.6`).
> The hyphen form (`claude-sonnet-4-6`) is only for the direct Anthropic SDK.

---

## Full architecture (production design)

How a production TriageWise uses all six sponsors. **Built** = in this repo;
**Architected** = designed, README-only for the hackathon scope.

| Sponsor | Use | Status |
| --- | --- | --- |
| **Vercel** | eve framework, **AI Gateway** model routing, Sandbox, Agent Runs observability | **Built** (eve + AI Gateway) |
| **Anthropic** | Claude `diagnose` subagent for hard tickets; prompt caching on the system prompt | **Built** (subagent); caching noted |
| **Supabase** | Ticket store + **pgvector** semantic KB | **Built** (pgvector path wired, in-memory fallback) |
| **Sentry** | OpenTelemetry trace export; *bonus:* Sentry alerts auto-open tickets | **Architected** |
| **Resend** | Email the requester on status changes (resolved/escalated) | **Architected** |
| **Auth0** | Role-based auth — IT-staff vs requester; approval gate restricted to staff | **Architected** |

---

## Deploy

eve deploys to Vercel (Nitro build output). The public URL defaults to **DEMO mode**
so it's always live during judging; set `AI_GATEWAY_API_KEY` in the Vercel project for LIVE.

```bash
npm exec -- eve deploy      # or connect the GitHub repo to Vercel
```

- **Repo:** https://github.com/Rian-Fernando/TriageWise
- **Live:** _(add your Vercel URL here after deploy)_

---

## 90-second demo script

1. **(0:00)** Open the live URL. Point at the **DEMO MODE** badge — "runs with zero keys, never crashes."
2. **(0:10)** Press **Run triage**. Tickets stream in. Call out the green **KB CACHE HIT** rows — "repeat tickets resolved from cache at ~$0."
3. **(0:30)** Two **Claude** rows light up purple — "only the genuinely hard, novel tickets pay for the smart model."
4. **(0:45)** It **pauses on the P1** ("production DB down"). Click **Approve & page on-call** — eve's human-in-the-loop guardrail; the run resumes.
5. **(1:00)** Land on the hero: **~93% cheaper**, **~$139/mo → ~$10/mo** at scale.
6. **(1:20)** One line: "Cheap model + KB cache for the easy 80%, Claude only when it counts — on Vercel eve + AI Gateway."

---

## Tech used

Vercel (eve, AI Gateway), Anthropic Claude, Supabase (pgvector), Next.js, TypeScript,
Zod, AI SDK. *(Architected: Sentry, Resend, Auth0.)*

## Notes / scope

- KB default is a deterministic in-memory lexical match (no keys, no DB); the Supabase
  pgvector backend is wired and used when `SUPABASE_*` is set, with automatic fallback.
- Lifecycle is intentionally minimal: `new → triaged → resolved | escalated`.
- DEMO numbers are deterministic; LIVE costs come from real gateway token usage.
