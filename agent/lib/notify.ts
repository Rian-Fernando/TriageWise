/**
 * Resend notifications: escalation alerts and reminder digests.
 *
 * Sends real email when RESEND_API_KEY + NOTIFY_DEMO_RECIPIENT are set; otherwise
 * returns a simulated result so the dashboard still shows the step. Uses the
 * Resend REST API directly (no SDK dependency).
 */

export interface NotifyResult {
  sent: boolean;
  simulated: boolean;
  to: string | null;
  detail: string;
}

export interface EscalationInput {
  id: string;
  subject: string;
  priority: string;
  requester: string;
  resolution: string;
}

export interface ReminderItem {
  requester: string;
  reminder: string;
}

async function send(subject: string, text: string): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_DEMO_RECIPIENT;
  const from = process.env.NOTIFY_FROM ?? "TriageWise <onboarding@resend.dev>";

  if (!key || !to) {
    return {
      sent: false,
      simulated: true,
      to: to ?? null,
      detail: "Simulated — set RESEND_API_KEY + NOTIFY_DEMO_RECIPIENT to send for real.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) return { sent: false, simulated: false, to, detail: `Resend error ${res.status}` };
    return { sent: true, simulated: false, to, detail: `Email sent to ${to}` };
  } catch {
    return { sent: false, simulated: false, to, detail: "Send failed (network)" };
  }
}

export function notifyEscalation(t: EscalationInput): Promise<NotifyResult> {
  return send(
    `[TriageWise] ${t.priority} escalated: ${t.subject}`,
    `Ticket ${t.id} (${t.priority}) reported by ${t.requester} has been escalated; ` +
      `on-call has been paged.\n\n${t.resolution}\n\n— TriageWise`,
  );
}

export function notifyReminders(items: ReminderItem[]): Promise<NotifyResult> {
  const lines = items.map((i) => `• ${i.requester}: ${i.reminder}`).join("\n");
  return send(
    `[TriageWise] ${items.length} user reminder${items.length === 1 ? "" : "s"}`,
    `The following users have pending follow-up reminders:\n\n${lines}\n\n— TriageWise`,
  );
}
