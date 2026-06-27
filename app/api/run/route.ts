import { NextResponse } from "next/server";
import { runAll } from "@/agent/lib/pipeline";

// Runs all sample tickets through the deterministic triage pipeline and returns
// the per-ticket routing + naive-vs-optimized cost totals. Always succeeds:
// the pipeline falls back to DEMO data when no model credential is present.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(await runAll());
}

export async function GET() {
  return NextResponse.json(await runAll());
}
