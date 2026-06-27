/**
 * Resend status notifications.
 *
 * Sends a real email on P1 escalation when RESEND_API_KEY + NOTIFY_DEMO_RECIPIENT
 * are set; otherwise returns a simulated result so the dashboard still shows the
 * notification step. Uses the Resend REST API directly (no SDK dependency).
 */

export interface NotifyInput {
  id: string;
  subject: string;
  priority: string;
  requester: string;
  resolution: string;
}

export interface NotifyResult {
  sent: boolean;
  simulated: boolean;
  to: string | null;
  detail: string;
}

export async function notifyEscalation(t: NotifyInput): Promise<NotifyResult> {
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
      body: JSON.stringify({
        from,
        to,
        subject: `[TriageWise] ${t.priority} escalated: ${t.subject}`,
        text:
          `Ticket ${t.id} (${t.priority}) reported by ${t.requester} has been escalated; ` +
          `on-call has been paged.\n\n${t.resolution}\n\n— TriageWise`,
      }),
    });
    if (!res.ok) {
      return { sent: false, simulated: false, to, detail: `Resend error ${res.status}` };
    }
    return { sent: true, simulated: false, to, detail: `Email sent to ${to}` };
  } catch {
    return { sent: false, simulated: false, to, detail: "Send failed (network)" };
  }
}
