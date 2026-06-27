"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

/** rAF count-up so the cost meter tweens to its target as tickets stream in. */
function useAnimatedNumber(value: number, duration = 650) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(a + (b - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="font-mono text-xs text-emerald-400/80">{index}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<"idle" | "running" | "awaiting-approval" | "done">("idle");
  const [shown, setShown] = useState(0);
  const [decision, setDecision] = useState<"pending" | "approved" | "denied">("pending");
  const [notify, setNotify] = useState<NotifyState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (next.requiresApproval && decision === "pending") setPhase("awaiting-approval");
      else if (shown + 1 >= total) setPhase("done");
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
      setPhase("running");
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
  const scale = data ? (1000 / data.tickets.length) * 30 : 0;

  const aPct = useAnimatedNumber(savedPct);
  const aNaive = useAnimatedNumber(naiveSum);
  const aOpt = useAnimatedNumber(optSum);
  const aNaiveMo = useAnimatedNumber(data ? data.totals.naiveUsd * scale : 0);
  const aOptMo = useAnimatedNumber(data ? data.totals.optimizedUsd * scale : 0);

  const isLive = data?.mode === "LIVE";
  const running = phase === "running" || phase === "awaiting-approval";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080a] text-zinc-100">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(16,185,129,0.12), transparent 70%), radial-gradient(40% 40% at 90% 10%, rgba(99,102,241,0.08), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-10">
        {/* Brand bar */}
        <div className="mb-8 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            AI IT-Helpdesk · Cost-optimized
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                isLive
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
              }`}
            >
              <motion.span
                className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              {data ? `${data.mode} MODE` : "LOADING"}
            </span>
            {data && (
              <span className="hidden rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 sm:inline-flex">
                KB · {data.kbBackend === "supabase" ? "Supabase" : "in-memory"}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Triage<span className="text-emerald-400">Wise</span>
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              Cheap model + knowledge-base cache resolve the easy 80% of tickets. Claude only when it
              counts. Watch the cost fall in real time.
            </p>
          </div>
          <motion.button
            onClick={start}
            disabled={!data || running}
            whileHover={{ scale: data && !running ? 1.04 : 1 }}
            whileTap={{ scale: data && !running ? 0.96 : 1 }}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "idle" ? "Run triage ▸" : phase === "done" ? "Replay ↻" : "Running…"}
          </motion.button>
        </motion.header>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Hero cost meter */}
        <motion.section
          layout
          className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
        >
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                Cost · naive vs optimized
              </div>
              <div className="mt-4 space-y-3.5">
                <Bar label="Naive — every ticket to Claude" value={money(aNaive)} widthPct={naiveW} barClass="bg-rose-500" glow="rgba(244,63,94,0.4)" />
                <Bar label="Optimized — TriageWise routing" value={money(aOpt)} widthPct={optW} barClass="bg-emerald-500" glow="rgba(16,185,129,0.5)" />
              </div>
            </div>
            <div className="text-center sm:border-l sm:border-white/10 sm:pl-6">
              <div className="bg-gradient-to-b from-emerald-300 to-emerald-500 bg-clip-text text-6xl font-bold tabular-nums text-transparent">
                {aPct.toFixed(0)}%
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                cheaper
              </div>
            </div>
          </div>

          {data && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/10 pt-4 text-xs text-zinc-400">
              <span>
                Saved <span className="font-semibold text-emerald-300">{money(aNaive - aOpt)}</span> on{" "}
                {counted.length}/{data.tickets.length} tickets
              </span>
              <span className="text-zinc-700">|</span>
              <span>
                At 1,000/day:{" "}
                <span className="text-rose-300">${aNaiveMo.toFixed(0)}/mo</span>
                {" → "}
                <span className="font-semibold text-emerald-300">${aOptMo.toFixed(0)}/mo</span>
              </span>
            </div>
          )}
        </motion.section>

        {/* Ticket stream */}
        <div className="mt-10">
          <SectionLabel index="01">Triage stream</SectionLabel>
          {!data && <p className="text-sm text-zinc-500">Loading sample tickets…</p>}
          {data && phase === "idle" && (
            <p className="text-sm text-zinc-500">
              {data.tickets.length} sample tickets queued. Press <b className="text-zinc-300">Run triage</b>{" "}
              to watch them route.
            </p>
          )}
          <motion.div layout className="space-y-2.5">
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/10 pt-5">
          <Marquee />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
            <span>
              Models {data?.mode ?? "…"} · KB {data?.kbBackend === "supabase" ? "Supabase" : "in-memory"}
            </span>
            <motion.a
              href="https://rianfernando.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 2 }}
              className="font-medium text-zinc-400 transition-colors hover:text-emerald-400"
            >
              Built by Rian Fernando ↗
            </motion.a>
          </div>
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
  glow,
}: {
  label: string;
  value: string;
  widthPct: number;
  barClass: string;
  glow: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono tabular-nums text-zinc-200">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full ${barClass}`}
          style={{ boxShadow: `0 0 12px ${glow}` }}
          initial={{ width: "1.5%" }}
          animate={{ width: `${Math.max(1.5, widthPct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`rounded-2xl border p-3.5 backdrop-blur-sm transition-colors ${
        pending
          ? "border-amber-500/50 bg-amber-500/[0.07] ring-1 ring-amber-500/20"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-600">{t.id}</span>
            <span className="truncate text-sm font-medium text-zinc-100">{t.subject}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip className="bg-white/5 text-zinc-300 ring-white/10">{t.category}</Chip>
            <Chip className={PRIORITY_STYLE[t.priority]}>{t.priority}</Chip>
            <Chip className="bg-white/[0.03] text-zinc-400 ring-white/10">{t.difficulty}</Chip>
            <Chip className={PATH_STYLE[t.path]}>{t.pathLabel}</Chip>
            {t.path === "kb" && (
              <span className="font-mono text-[11px] text-zinc-600">sim {t.kbScore.toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm tabular-nums text-zinc-100">{money(t.optimizedUsd, 5)}</div>
          <div className="font-mono text-[11px] text-zinc-600">vs {money(t.naiveUsd, 4)}</div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.div
            key="gate"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
          >
            <div className="text-sm font-medium text-amber-200">
              {"⏸"} Human approval required before escalating
            </div>
            <p className="mt-1 text-xs text-amber-200/80">{t.resolution}</p>
            <div className="mt-2.5 flex gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onDecide("approved")}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Approve &amp; page on-call
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onDecide("denied")}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/20"
              >
                Deny
              </motion.button>
            </div>
          </motion.div>
        ) : escalateApproved ? (
          <motion.p
            key="approved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs leading-relaxed text-zinc-400"
          >
            ✓ Approved — on-call paged, Sev-1 bridge opened.
            {notify ? (
              <span className={notify.sent ? "text-emerald-300" : "text-zinc-500"}>
                {" · 📧 "}
                {notify.sent ? notify.detail : notify.simulated ? "requester email simulated" : notify.detail}
              </span>
            ) : (
              <span className="text-zinc-500"> · 📧 notifying requester…</span>
            )}
          </motion.p>
        ) : (
          <motion.p
            key="res"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400"
          >
            {t.path === "escalate" && decision === "denied"
              ? "Escalation denied — kept open for manual handling."
              : t.resolution}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Marquee() {
  const items = ["Vercel eve", "AI Gateway", "Anthropic Claude", "Supabase", "Resend", "Next.js", "TypeScript"];
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)]">
      <motion.div
        className="flex w-max gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        {row.map((s, i) => (
          <span key={i} className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
            {s}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
