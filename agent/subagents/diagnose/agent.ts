import { defineAgent } from "eve";
import { CLAUDE_MODEL } from "../../lib/models";

// Claude diagnostic specialist. The parent delegates only hard/novel tickets
// here, so the expensive model is used sparingly.
export default defineAgent({
  description:
    "Diagnose a hard or novel IT ticket that the knowledge base and cheap model can't resolve. Produces careful, correct, step-by-step diagnosis.",
  model: CLAUDE_MODEL,
});
