import { defineAgent } from "eve";

// Root orchestrator. A capable model drives the triage loop and decides when to
// lean on the cheap classifier/KB vs. delegate hard tickets to the Claude
// `diagnose` subagent. Model routing (the cost win) lives in the subagents and
// the deterministic pipeline under agent/lib.
export default defineAgent({
  model: "anthropic/claude-sonnet-4.6",
});
