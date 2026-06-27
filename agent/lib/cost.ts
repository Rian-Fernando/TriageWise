/**
 * Token + cost helpers shared by the deterministic pipeline and the eve
 * `track_cost` tool.
 */
import { CLAUDE_MODEL, costUsd } from "./models";

/** Rough token estimate (~4 chars/token) — good enough for a cost demo and
 *  used as a fallback when a live model call doesn't report usage. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text ?? "").length / 4));
}

/** Representative output length if Claude answered every ticket end-to-end. */
export const NAIVE_OUTPUT_TOKENS = 300;

/** What the same ticket would have cost if it had gone straight to Claude. */
export function naiveCostUsd(ticketText: string): number {
  return costUsd(CLAUDE_MODEL, estimateTokens(ticketText), NAIVE_OUTPUT_TOKENS);
}

export type Usage = { model: string; inputTokens: number; outputTokens: number };

/** Running naive-vs-optimized ledger used by the eve cost-tracking tool. */
export class CostLedger {
  naive = 0;
  optimized = 0;
  count = 0;

  record(naive: number, optimized: number) {
    this.naive += naive;
    this.optimized += optimized;
    this.count += 1;
    return this.totals();
  }

  totals() {
    const savedUsd = this.naive - this.optimized;
    const savingsPct = this.naive > 0 ? (savedUsd / this.naive) * 100 : 0;
    return {
      naiveUsd: this.naive,
      optimizedUsd: this.optimized,
      savedUsd,
      savingsPct,
      tickets: this.count,
    };
  }
}

/** Process-wide ledger for the eve REPL/HTTP agent path. */
export const ledger = new CostLedger();
