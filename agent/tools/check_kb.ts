import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchKb } from "../lib/kb";

// Semantic-ish knowledge-base lookup. A high-similarity match returns a ready
// resolution as a near-zero-cost cache hit, so the agent can skip the model.
export default defineTool({
  description:
    "Search the seeded IT knowledge base for a known resolution. A high-similarity match is a near-zero-cost cache hit — always call this before any expensive diagnosis.",
  inputSchema: z.object({
    ticketText: z.string().min(1).describe("The ticket subject and body to look up."),
  }),
  async execute({ ticketText }) {
    const r = await searchKb(ticketText);
    return {
      hit: r.hit,
      score: Number(r.score.toFixed(2)),
      backend: r.backend,
      entryId: r.entry?.id ?? null,
      resolution: r.hit && r.entry ? r.entry.resolution : null,
    };
  },
});
