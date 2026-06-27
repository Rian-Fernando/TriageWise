import { defineTool } from "eve/tools";
import { z } from "zod";

// Minimal ticket lifecycle store (in-memory): new -> triaged -> resolved | escalated.
const store = new Map<string, Record<string, unknown>>();

export default defineTool({
  description:
    "Advance a ticket through its lifecycle and record triage metadata. Status flows new -> triaged -> resolved | escalated.",
  inputSchema: z.object({
    ticketId: z.string(),
    status: z.enum(["new", "triaged", "resolved", "escalated"]),
    category: z.enum(["network", "account", "hardware", "software"]).optional(),
    priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
    resolutionNote: z.string().optional(),
  }),
  async execute(input) {
    const prev = store.get(input.ticketId) ?? { ticketId: input.ticketId };
    const next = { ...prev, ...input, updatedAt: new Date().toISOString() };
    store.set(input.ticketId, next);
    return next;
  },
});
