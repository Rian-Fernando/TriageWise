import { NextResponse } from "next/server";
import { type NotifyInput, notifyEscalation } from "@/agent/lib/notify";

// Sends (or simulates) the escalation email when a P1 is approved on the dashboard.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<NotifyInput>;
  const result = await notifyEscalation({
    id: body.id ?? "ticket",
    subject: body.subject ?? "Escalation",
    priority: body.priority ?? "P1",
    requester: body.requester ?? "unknown",
    resolution: body.resolution ?? "",
  });
  return NextResponse.json(result);
}
