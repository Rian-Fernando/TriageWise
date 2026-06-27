/**
 * Central model + pricing config, plus LIVE/DEMO mode detection.
 *
 * Model ids are Vercel AI Gateway slugs (provider/model, dotted version), which
 * the `ai` package routes through the gateway by default. The cheap model is
 * overridable so you can point at whatever open model your gateway exposes.
 */

/** Claude diagnostic model + the "naive baseline" (every ticket -> Claude). */
export const CLAUDE_MODEL = "anthropic/claude-sonnet-4.6";

/** Cheap/fast open model for classification + easy/medium resolution. */
export const CHEAP_MODEL =
  process.env.TRIAGEWISE_CHEAP_MODEL ?? "meta/llama-3.1-8b";

/** Synthetic id used when a ticket is resolved from the knowledge base. */
export const KB_MODEL = "kb-cache";

/**
 * Price table in USD per 1,000,000 tokens. Claude figures are list price; the
 * cheap-model figures are representative open-model gateway pricing. Editing one
 * place re-prices the whole demo.
 */
export const PRICES: Record<string, { in: number; out: number; label: string }> = {
  [CLAUDE_MODEL]: { in: 3.0, out: 15.0, label: "Claude Sonnet 4.6" },
  [CHEAP_MODEL]: { in: 0.05, out: 0.08, label: "Llama 3.1 8B" },
  [KB_MODEL]: { in: 0, out: 0, label: "Knowledge base" },
};

export function priceFor(model: string) {
  return PRICES[model] ?? { in: 0, out: 0, label: model };
}

/** Cost of a single model call, in USD. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

/**
 * LIVE when a usable model credential is present. On Vercel, the AI Gateway can
 * authenticate via OIDC, so a deployed instance can be LIVE with no API key set.
 * With nothing configured we stay in DEMO mode so the app always runs.
 */
export function isLive(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN,
  );
}

export type Mode = "LIVE" | "DEMO";
export function mode(): Mode {
  return isLive() ? "LIVE" : "DEMO";
}
