import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Escalation is gated on human approval (eve's built-in HITL guardrail): the run
// pauses at `session.waiting` until a person approves, then resumes durably.
export default defineTool({
  description:
    "Escalate a ticket to on-call IT staff. Use for P1 incidents or anything that can't be safely auto-resolved. Pauses for human approval before paging.",
  inputSchema: z.object({
    ticketId: z.string(),
    priority: z.enum(["P1", "P2", "P3", "P4"]),
    reason: z.string().describe("Why this needs a human."),
    assignTo: z.string().optional().describe("Team or rotation to page; defaults to on-call."),
  }),
  approval: always(),
  async execute(input) {
    return {
      ticketId: input.ticketId,
      status: "escalated" as const,
      assignedTo: input.assignTo ?? "on-call",
      reason: input.reason,
      pagedAt: new Date().toISOString(),
    };
  },
});
