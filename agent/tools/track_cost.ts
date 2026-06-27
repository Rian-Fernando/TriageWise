import { defineTool } from "eve/tools";
import { z } from "zod";
import { costUsd } from "../lib/models";
import { ledger, naiveCostUsd } from "../lib/cost";

// Maintains two running totals: "naive" (every ticket handled by Claude) vs
// "optimized" (the path actually taken). The gap is the headline cost saving.
export default defineTool({
  description:
    "Record the token cost of handling a ticket and update the running naive-vs-optimized totals. naive = every ticket handled by Claude; optimized = the path actually taken (KB hit, cheap model, Claude, or escalation).",
  inputSchema: z.object({
    ticketId: z.string(),
    model: z.string().describe("Model id used, or 'kb-cache' for a knowledge-base hit."),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    ticketText: z.string().describe("Ticket text, used to price the naive Claude baseline."),
  }),
  async execute({ model, inputTokens, outputTokens, ticketText }) {
    const optimizedUsd = costUsd(model, inputTokens, outputTokens);
    const naiveUsd = naiveCostUsd(ticketText);
    return { optimizedUsd, naiveUsd, runningTotals: ledger.record(naiveUsd, optimizedUsd) };
  },
});
