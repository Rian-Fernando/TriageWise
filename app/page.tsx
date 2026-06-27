"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Path, RunResult, TicketResult } from "@/agent/lib/pipeline";

const REVEAL_MS = 420; // staged reveal cadence — also the DEMO "thinking" delay

const money = (n: number, d = 4) => `$${n.toFixed(d)}`;

type NotifyState = { sent: boolean; simulated: boolean; to: string | null; detail: string };

const PATH_STYLE: Record<Path, string> = {
  kb: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  cheap: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  claude: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  escalate: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const PRIORITY_STYLE: Record<string, string> = {
  P1: "bg-rose-500/20 text-rose-300 ring-rose-500/40",
  P2: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  P3: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  P4: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
};

function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export default function Page() {
  const [data, setData] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reveal state machine.
  const [phase, setPhase] = useState<"idle" | "running" | "awaiting-approval" | "done">("idle");
  const [shown, setShown] = useState(0); // tickets visible
  const [decision, setDecision] = useState<"pending" | "approved" | "denied">("pending");
  const [notify, setNotify] = useState<NotifyState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the run once on mount (ready to play on click).
  useEffect(() => {
    let alive = true;
    fetch("/api/run", { method: "POST" })
      .then((r) => r.json())
      .then((d: RunResult) => alive && setData(d))
      .catch(() => alive && setError("Could not reach the pipeline. Refresh to retry."));
    return () => {
      alive = false;
    };
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Drive the staged reveal.
  useEffect(() => {
    if (!data || phase !== "running") return;
    const total = data.tickets.length;
    if (shown >= total) {
      setPhase("done");
      return;
    }
    timer.current = setTimeout(() => {
      const next = data.tickets[shown];
      setShown(shown + 1);
      if (next.requiresApproval && decision === "pending") {
        setPhase("awaiting-approval");
      } else if (shown + 1 >= total) {
        setPhase("done");
      }
    }, REVEAL_MS);
    return clearTimer;
  }, [data, phase, shown, decision]);

  const start = useCallback(() => {
    clearTimer();
    setShown(0);
    setDecision("pending");
    setNotify(null);
    setPhase("running");
  }, []);

  const decide = useCallback(
    (d: "approved" | "denied") => {
      setDecision(d);
      setPhase("running"); // resume the queue
      if (d === "approved" && data) {
        const p1 = data.tickets.find((t) => t.requiresApproval);
        if (p1) {
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: p1.id,
              subject: p1.subject,
              priority: p1.priority,
              requester: p1.requester,
              resolution: p1.resolution,
            }),
          })
            .then((r) => r.json())
            .then(setNotify)
            .catch(() =>
              setNotify({ sent: false, simulated: true, to: null, detail: "notify unavailable" }),
            );
        }
      }
    },
    [data],
  );

  const visible = data ? data.tickets.slice(0, shown) : [];

  // The meter counts a ticket once it's visible AND (if it needs approval) decided.
  const counted = useMemo(
    () => visible.filter((t) => !t.requiresApproval || decision !== "pending"),
    [visible, decision],
  );

  const naiveSum = counted.reduce((s, t) => s + t.naiveUsd, 0);
  const optSum = counted.reduce((s, t) => s + t.optimizedUsd, 0);
  const savedPct = naiveSum > 0 ? ((naiveSum - optSum) / naiveSum) * 100 : 0;

  const maxRef = data ? data.totals.naiveUsd || 1 : 1;
  const naiveW = Math.min(100, (naiveSum / maxRef) * 100);
  const optW = Math.min(100, (optSum / maxRef) * 100);

  // Monthly projection at 1,000 tickets/day (scaled from the 12-ticket sample).
  const scale = data ? (1000 / data.tickets.length) * 30 : 0;

  const isLive = data?.mode === "LIVE";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Triage<span className="text-emerald-400">Wise</span>
            </h1>
            <p className="text-sm text-zinc-400">
              Cost-optimized AI IT-helpdesk triage — cheap model + KB cache, Claude only when it counts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                isLive
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`} />
              {data ? `${data.mode} MODE` : "LOADING"}
            </span>
            {data && (
              <span className="hidden items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700 sm:inline-flex">
                KB · {data.kbBackend === "supabase" ? "Supabase" : "in-memory"}
              </span>
            )}
            <button
              onClick={start}
              disabled={!data || phase === "running" || phase === "awaiting-approval"}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === "idle" ? "Run triage ▸" : phase === "done" ? "Replay ↻" : "Running…"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Hero: side-by-side cost meter */}
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              Cost: naive vs. optimized
            </h2>
            <div className="text-right">
              <div className="text-3xl font-bold text-emerald-400 tabular-nums">
                {savedPct.toFixed(1)}%
              </div>
              <div className="-mt-1 text-xs text-zinc-500">cheaper</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Bar
              label="Naive — every ticket to Claude"
              value={money(naiveSum)}
              widthPct={naiveW}
              barClass="bg-rose-500/70"
            />
            <Bar
              label="Optimized — TriageWise routing"
              value={money(optSum)}
              widthPct={optW}
              barClass="bg-emerald-500/80"
            />
          </div>

          {data && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-400">
              <span>
                Saved <span className="font-semibold text-emerald-300">{money(naiveSum - optSum)}</span> on{" "}
                {counted.length} of {data.tickets.length} tickets
              </span>
              <span className="text-zinc-600">|</span>
              <span>
                At 1,000 tickets/day:{" "}
                <span className="text-rose-300">${(data.totals.naiveUsd * scale).toFixed(0)}/mo</span>
                {" → "}
                <span className="font-semibold text-emerald-300">
                  ${(data.totals.optimizedUsd * scale).toFixed(0)}/mo
                </span>
              </span>
            </div>
          )}
        </section>

        {/* Ticket stream */}
        <section className="mt-6 space-y-2">
          {!data && <p className="text-sm text-zinc-500">Loading sample tickets…</p>}
          {data && phase === "idle" && (
            <p className="text-sm text-zinc-500">
              {data.tickets.length} sample tickets queued. Press <b>Run triage</b> to watch them route.
            </p>
          )}
          {visible.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              pending={t.requiresApproval && decision === "pending"}
              decision={t.requiresApproval ? decision : "pending"}
              onDecide={decide}
              notify={t.requiresApproval ? notify : null}
            />
          ))}
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
          <span>
            Models: {data?.mode ?? "…"} · Knowledge base:{" "}
            {data?.kbBackend === "supabase" ? "Supabase (live)" : "in-memory"}. Built on Vercel eve +
            AI Gateway, Anthropic Claude, Supabase, and Resend.
          </span>
          <a
            href="https://rianfernando.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-400 transition hover:text-emerald-400"
          >
            Built by Rian Fernando ↗
          </a>
        </footer>
      </div>
    </main>
  );
}

function Bar({
  label,
  value,
  widthPct,
  barClass,
}: {
  label: string;
  value: string;
  widthPct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono tabular-nums text-zinc-200">{value}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${barClass}`}
          style={{ width: `${Math.max(1.5, widthPct)}%` }}
        />
      </div>
    </div>
  );
}

function TicketRow({
  ticket: t,
  pending,
  decision,
  onDecide,
  notify,
}: {
  ticket: TicketResult;
  pending: boolean;
  decision: "pending" | "approved" | "denied";
  onDecide: (d: "approved" | "denied") => void;
  notify: NotifyState | null;
}) {
  const escalateApproved = t.path === "escalate" && decision === "approved";
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        pending
          ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{t.id}</span>
            <span className="truncate text-sm font-medium text-zinc-100">{t.subject}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip className="bg-zinc-500/15 text-zinc-300 ring-zinc-500/30">{t.category}</Chip>
            <Chip className={PRIORITY_STYLE[t.priority]}>{t.priority}</Chip>
            <Chip className="bg-zinc-500/10 text-zinc-400 ring-zinc-500/20">{t.difficulty}</Chip>
            <Chip className={PATH_STYLE[t.path]}>{t.pathLabel}</Chip>
            {t.path === "kb" && (
              <span className="text-[11px] text-zinc-500">sim {t.kbScore.toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm tabular-nums text-zinc-200">{money(t.optimizedUsd, 5)}</div>
          <div className="text-[11px] text-zinc-500">vs {money(t.naiveUsd, 4)} naive</div>
        </div>
      </div>

      {/* Resolution / approval gate */}
      {pending ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="text-sm font-medium text-amber-200">
            {"⏸"} Human approval required before escalating
          </div>
          <p className="mt-1 text-xs text-amber-200/80">{t.resolution}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => onDecide("approved")}
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Approve &amp; page on-call
            </button>
            <button
              onClick={() => onDecide("denied")}
              className="rounded-md bg-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-600"
            >
              Deny
            </button>
          </div>
        </div>
      ) : escalateApproved ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          ✓ Approved — on-call paged, Sev-1 bridge opened.
          {notify ? (
            <span className={notify.sent ? "text-emerald-300" : "text-zinc-500"}>
              {" "}
              · 📧 {notify.sent ? notify.detail : notify.simulated ? "requester email simulated" : notify.detail}
            </span>
          ) : (
            <span className="text-zinc-500"> · 📧 notifying requester…</span>
          )}
        </p>
      ) : (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">
          {t.path === "escalate" && decision === "denied"
            ? "Escalation denied — kept open for manual handling."
            : t.resolution}
        </p>
      )}
    </div>
  );
}
