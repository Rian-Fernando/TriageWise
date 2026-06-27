/**
 * CLI demo / smoke test: run all sample tickets through the triage pipeline and
 * print the per-ticket routing and the naive-vs-optimized cost comparison.
 *
 *   npm run demo
 *
 * Runs in DEMO mode with no keys; set AI_GATEWAY_API_KEY for a LIVE run.
 */
import { runAll } from "../agent/lib/pipeline";

const usd = (n: number) => `$${n.toFixed(6)}`;
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

const r = await runAll();

console.log(`\n  TriageWise — ${r.mode} MODE`);
console.log(`  cheap: ${r.cheapModel}   claude: ${r.claudeModel}\n`);
console.log(
  "  " +
    [pad("TICKET", 8), pad("CATEGORY", 9), pad("PRIO", 5), pad("DIFF", 7), pad("PATH", 17), "COST"].join(" "),
);
console.log("  " + "-".repeat(64));
for (const t of r.tickets) {
  const flag = t.requiresApproval ? "  <- needs approval" : "";
  console.log(
    "  " +
      [
        pad(t.id, 8),
        pad(t.category, 9),
        pad(t.priority, 5),
        pad(t.difficulty, 7),
        pad(t.pathLabel, 17),
        usd(t.optimizedUsd),
      ].join(" ") +
      flag,
  );
}

const { naiveUsd, optimizedUsd, savedUsd, savingsPct, count } = r.totals;
console.log("  " + "-".repeat(64));
console.log(`\n  Naive  (all Claude):  ${usd(naiveUsd)}`);
console.log(`  Optimized (actual):   ${usd(optimizedUsd)}`);
console.log(`  Saved:                ${usd(savedUsd)}   (${savingsPct.toFixed(1)}% cheaper)\n`);

// Projection at scale (1,000 tickets/day, 30 days).
const scale = (1000 / count) * 30;
console.log(
  `  At 1,000 tickets/day:  naive ~$${(naiveUsd * scale).toFixed(2)}/mo  vs  optimized ~$${(
    optimizedUsd * scale
  ).toFixed(2)}/mo\n`,
);
