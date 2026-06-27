/**
 * The deterministic triage pipeline: classify -> KB lookup -> route -> cost.
 *
 * This is the single source of truth the dashboard renders and the eve tools
 * wrap. It runs identically in LIVE and DEMO mode; only the underlying model
 * calls differ (see triage.ts).
 */
import { CHEAP_MODEL, CLAUDE_MODEL, KB_MODEL, costUsd, mode } from "./models";
import { naiveCostUsd } from "./cost";
import { searchKb, type Category } from "./kb";
import { TICKETS, type Difficulty, type Priority, type Ticket } from "./tickets";
import { classify, diagnose, resolveCheap } from "./triage";

export type Path = "kb" | "cheap" | "claude" | "escalate";

const PATH_LABEL: Record<Path, string> = {
  kb: "KB CACHE HIT",
  cheap: "Llama 3.1 8B",
  claude: "Claude Sonnet 4.6",
  escalate: "Human (approval)",
};

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
  resolution: string;
  kbScore: number;
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

  if (kb.hit && kb.entry) {
    path = "kb";
    status = "resolved";
    resolution = kb.entry.resolution; // resolved from cache, no resolution model
  } else if (cls.priority === "P1") {
    path = "escalate";
    status = "escalated";
    requiresApproval = true;
    resolution =
      ticket.demo.resolution ||
      "Escalated to on-call. Requires human approval before paging.";
  } else if (cls.difficulty === "hard") {
    const r = await diagnose(ticket, cls);
    path = "claude";
    status = "resolved";
    resolution = r.text;
    resolveUsd = costUsd(r.model, r.inputTokens, r.outputTokens);
  } else {
    const r = await resolveCheap(ticket, cls);
    path = "cheap";
    status = "resolved";
    resolution = r.text;
    resolveUsd = costUsd(r.model, r.inputTokens, r.outputTokens);
  }

  const optimizedUsd = classifyUsd + resolveUsd;
  const naiveUsd = naiveCostUsd(ticketText);

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
    resolution,
    kbScore: Number(kb.score.toFixed(2)),
    optimizedUsd,
    naiveUsd,
    savedUsd: naiveUsd - optimizedUsd,
  };
}

export interface RunResult {
  mode: "LIVE" | "DEMO";
  cheapModel: string;
  claudeModel: string;
  tickets: TicketResult[];
  totals: {
    naiveUsd: number;
    optimizedUsd: number;
    savedUsd: number;
    savingsPct: number;
    count: number;
  };
}

/** Run all sample tickets through the pipeline and total up the savings. */
export async function runAll(): Promise<RunResult> {
  const tickets: TicketResult[] = [];
  for (const t of TICKETS) {
    tickets.push(await triageTicket(t));
  }

  const naiveUsd = tickets.reduce((s, r) => s + r.naiveUsd, 0);
  const optimizedUsd = tickets.reduce((s, r) => s + r.optimizedUsd, 0);
  const savedUsd = naiveUsd - optimizedUsd;

  return {
    mode: mode(),
    cheapModel: CHEAP_MODEL,
    claudeModel: CLAUDE_MODEL,
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
