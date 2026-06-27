import { defineAgent } from "eve";
import { z } from "zod";
import { CHEAP_MODEL } from "../../lib/models";

// Cheap/fast classifier. Runs a small open model and returns structured triage
// metadata in task mode — the inexpensive first step on every ticket.
export default defineAgent({
  description:
    "Classify an IT helpdesk ticket into category, priority, and difficulty. Fast and cheap; call this first on every ticket.",
  model: CHEAP_MODEL,
  outputSchema: z.object({
    category: z.enum(["network", "account", "hardware", "software"]),
    priority: z.enum(["P1", "P2", "P3", "P4"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
  }),
});
