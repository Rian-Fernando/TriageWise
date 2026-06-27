import { NextResponse } from "next/server";
import {
  type EscalationInput,
  type ReminderItem,
  notifyEscalation,
  notifyReminders,
} from "@/agent/lib/notify";

// Sends (or simulates) an escalation email on P1 approval, or a reminder digest.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    items?: ReminderItem[];
  } & Partial<EscalationInput>;

  if (body.kind === "reminder") {
    return NextResponse.json(await notifyReminders(body.items ?? []));
  }

  return NextResponse.json(
    await notifyEscalation({
      id: body.id ?? "ticket",
      subject: body.subject ?? "Escalation",
      priority: body.priority ?? "P1",
      requester: body.requester ?? "unknown",
      resolution: body.resolution ?? "",
    }),
  );
}
