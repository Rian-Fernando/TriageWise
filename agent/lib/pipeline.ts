/**
 * The deterministic triage pipeline: classify -> KB lookup -> route -> cost.
 *
 * Single source of truth the dashboard renders and the eve tools wrap. Runs
 * identically in LIVE and DEMO mode; only the underlying model calls differ
 * (see triage.ts). `mode` on the result reflects whether real model calls
 * actually succeeded this run, not just whether a key is configured.
 */
import { CHEAP_MODEL, CLAUDE_MODEL, KB_MODEL, costUsd } from "./models";
import { naiveCostUsd } from "./cost";
import { searchKb, type Category } from "./kb";
import { sampleTickets, type Difficulty, type Priority, type Ticket } from "./tickets";
import { classify, diagnose, resolveCheap } from "./triage";

export type Path = "kb" | "cheap" | "claude" | "escalate";

const PATH_LABEL: Record<Path, string> = {
  kb: "KB CACHE HIT",
  cheap: "Llama 3.1 8B",
  claude: "Claude Sonnet 4.6",
  escalate: "Human (approval)",
};

/** Which department a ticket routes to. */
const TEAMS: Record<Category, string> = {
  network: "Admin Sys",
  account: "ESS",
  hardware: "Endpoint Integration",
  software: "System Administrator",
};

function teamFor(category: Category, path: Path): string | null {
  if (path === "escalate") return "Incident Response (on-call)";
  if (path === "claude") return TEAMS[category];
  return null;
}

function buildActions(path: Path, team: string | null, tags: string[]): string[] {
  const base: Record<Path, string[]> = {
    kb: ["Matched knowledge base", "Auto-resolved", "Requester emailed"],
    cheap: ["Triaged · cheap model", "Auto-resolved", "Requester emailed"],
    claude: ["Triaged", "Diagnosed · Claude", team ? `Assigned to ${team}` : "Assigned for follow-up"],
    escalate: ["Triaged", "Human approval", team ? `Escalated to ${team}` : "Escalated", "On-call paged"],
  };
  return [...base[path], ...tags];
}

export interface TicketResult {
  id: string;
  subject: string;
  requester: string;
  category: Category;
  priority: Priority;
  difficulty: Difficulty;
  path: Path;
  pathLabel: string;
  status: "resolved" | "escalated";
  requiresApproval: boolean;
  team: string | null;
  actions: string[];
  reminder: string | null;
  resolution: string;
  kbScore: number;
  kbBackend: "supabase" | "memory";
  /** True if a real model call (not canned DEMO data) handled this ticket. */
  live: boolean;
  optimizedUsd: number;
  naiveUsd: number;
  savedUsd: number;
}

export async function triageTicket(ticket: Ticket): Promise<TicketResult> {
  const ticketText = `${ticket.subject}\n${ticket.body}`;

  // 1. Classify with the cheap model (status: new -> triaged).
  const cls = await classify(ticket);
  const classifyUsd = costUsd(cls.model, cls.inputTokens, cls.outputTokens);

  // 2. Knowledge-base lookup — a high-similarity match is a near-zero-cost hit.
  const kb = await searchKb(ticketText);

  // 3. Route.
  let path: Path;
  let status: TicketResult["status"];
  let requiresApproval = false;
  let resolution: string;
  let resolveUsd = 0;
  let resolveLive = false;

  if (kb.hit && kb.entry) {
    path = "kb";
    status = "resolved";
    resolution = kb.entry.resolution;
  } else if (cls.priority === "P1") {
    path = "escalate";
    status = "escalated";
    requiresApproval = true;
    resolution = ticket.demo.resolution || "Escalated to on-call. Requires human approval before paging.";
  } else if (cls.difficulty === "hard") {
    const r = await diagnose(ticket, cls);
    path = "claude";
    status = "resolved";
    resolution = r.text;
    resolveUsd = costUsd(r.model, r.inputTokens, r.outputTokens);
    resolveLive = r.source === "live";
  } else {
    const r = await resolveCheap(ticket, cls);
    path = "cheap";
    status = "resolved";
    resolution = r.text;
    resolveUsd = costUsd(r.model, r.inputTokens, r.outputTokens);
    resolveLive = r.source === "live";
  }

  const optimizedUsd = classifyUsd + resolveUsd;
  const naiveUsd = naiveCostUsd(ticketText);
  const team = teamFor(cls.category, path);
  const actions = buildActions(path, team, ticket.demo.tags ?? []);

  return {
    id: ticket.id,
    subject: ticket.subject,
    requester: ticket.requester,
    category: cls.category,
    priority: cls.priority,
    difficulty: cls.difficulty,
    path,
    pathLabel: PATH_LABEL[path],
    status,
    requiresApproval,
    team,
    actions,
    reminder: ticket.demo.reminder ?? null,
    resolution,
    kbScore: Number(kb.score.toFixed(2)),
    kbBackend: kb.backend,
    live: cls.source === "live" || resolveLive,
    optimizedUsd,
    naiveUsd,
    savedUsd: naiveUsd - optimizedUsd,
  };
}

export interface RunResult {
  /** "LIVE" if real model calls handled this run; "DEMO" if all canned. */
  mode: "LIVE" | "DEMO";
  cheapModel: string;
  claudeModel: string;
  kbBackend: "supabase" | "memory";
  tickets: TicketResult[];
  totals: {
    naiveUsd: number;
    optimizedUsd: number;
    savedUsd: number;
    savingsPct: number;
    count: number;
  };
}

/** Sample a fresh batch of tickets and run them through the pipeline. */
export async function runAll(): Promise<RunResult> {
  const batch = sampleTickets(12);
  const tickets: TicketResult[] = [];
  for (const t of batch) {
    tickets.push(await triageTicket(t));
  }

  const naiveUsd = tickets.reduce((s, r) => s + r.naiveUsd, 0);
  const optimizedUsd = tickets.reduce((s, r) => s + r.optimizedUsd, 0);
  const savedUsd = naiveUsd - optimizedUsd;

  return {
    mode: tickets.some((t) => t.live) ? "LIVE" : "DEMO",
    cheapModel: CHEAP_MODEL,
    claudeModel: CLAUDE_MODEL,
    kbBackend: tickets[0]?.kbBackend ?? "memory",
    tickets,
    totals: {
      naiveUsd,
      optimizedUsd,
      savedUsd,
      savingsPct: naiveUsd > 0 ? (savedUsd / naiveUsd) * 100 : 0,
      count: tickets.length,
    },
  };
}
