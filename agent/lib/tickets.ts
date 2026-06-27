/**
 * Hardcoded sample IT tickets for the demo run.
 *
 * Mix is deliberate: lots of common repeats (with near-duplicates) that the KB
 * resolves as near-zero-cost cache hits, a couple that need the cheap model, two
 * genuinely hard/novel ones that go to Claude, and one P1 outage that triggers
 * the human-approval gate.
 *
 * `demo` holds canned classifications/resolutions used in DEMO mode (or as a
 * fallback when a live model call fails) so the full flow always runs.
 */
import type { Category } from "./kb";

export type Priority = "P1" | "P2" | "P3" | "P4";
export type Difficulty = "easy" | "medium" | "hard";

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  requester: string;
  demo: {
    category: Category;
    priority: Priority;
    difficulty: Difficulty;
    /** Canned answer for the cheap/Claude/escalate paths (KB hits use the KB). */
    resolution: string;
  };
}

export const TICKETS: Ticket[] = [
  {
    id: "T-1001",
    subject: "Forgot my password, can't log in",
    body: "I forgot my password and now I'm locked out of my account. How do I reset it so I can sign in?",
    requester: "amir.k",
    demo: { category: "account", priority: "P4", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1002",
    subject: "Locked out — need password reset",
    body: "My account is locked after too many sign-in attempts and I can't remember my password. Need a reset.",
    requester: "dana.r",
    demo: { category: "account", priority: "P3", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1003",
    subject: "How do I set up the VPN on my Mac?",
    body: "Starting remote work this week. How do I install and connect to the company VPN on my MacBook?",
    requester: "joon.p",
    demo: { category: "network", priority: "P3", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1004",
    subject: "VPN won't connect from home",
    body: "Trying to connect to the VPN from home with GlobalProtect but it won't connect. Need remote access.",
    requester: "mira.s",
    demo: { category: "network", priority: "P3", difficulty: "medium", resolution: "" },
  },
  {
    id: "T-1005",
    subject: "3rd floor printer is offline",
    body: "The shared printer on the 3rd floor shows offline and nothing prints. The queue just gets stuck.",
    requester: "leah.w",
    demo: { category: "hardware", priority: "P3", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1006",
    subject: "Can't print — printer shows offline",
    body: "My documents won't print, the printer status says offline again. Print queue is stuck.",
    requester: "sam.t",
    demo: { category: "hardware", priority: "P4", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1007",
    subject: "Set up Outlook email on my new iPhone",
    body: "Got a new iPhone and need my work Outlook email and calendar set up on the mobile app.",
    requester: "priya.n",
    demo: { category: "software", priority: "P4", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1008",
    subject: "Request: install Adobe Acrobat Pro",
    body: "I need Adobe Acrobat Pro installed to edit and combine contract PDFs for the legal team.",
    requester: "carlos.m",
    demo: {
      category: "software",
      priority: "P4",
      difficulty: "medium",
      resolution:
        "Adobe Acrobat Pro is available in Company Software Center — open it, search 'Acrobat Pro', and click Install; an enterprise license is auto-assigned from the pool (allow ~10 min). It's a paid-seat app, so if it doesn't appear your manager may need to approve the license — reply and I'll route the approval.",
    },
  },
  {
    id: "T-1009",
    subject: "MacBook kernel panics after macOS update",
    body: "Since the latest macOS update my MacBook randomly kernel-panics, usually a few minutes after waking from sleep. We run a custom third-party kext for our lab hardware. Logs mention a backtrace into a non-Apple bundle.",
    requester: "wei.l",
    demo: {
      category: "hardware",
      priority: "P2",
      difficulty: "hard",
      resolution:
        "This looks like a third-party kernel extension that's incompatible with the new macOS build. Boot into Safe Mode (hold the power button → Options), run `kmutil showloaded --variant-suffix release` to list non-Apple kexts, and check `log show --predicate 'eventMessage contains \"panic\"' --last 1d` for the faulting bundle ID. Unload/update the implicated kext; if it's the lab-hardware driver, get the vendor's notarized build or migrate the workflow to a DriverKit System Extension, then re-approve it in Recovery.",
    },
  },
  {
    id: "T-1010",
    subject: "Intermittent packet loss to DC over VPN split-tunnel",
    body: "We're seeing intermittent packet loss reaching the data center, but only over the VPN split-tunnel; traffic to the internet is fine. Traceroute consistently dies at hop 6. Started after the weekend.",
    requester: "noor.a",
    demo: {
      category: "network",
      priority: "P2",
      difficulty: "hard",
      resolution:
        "Loss that's isolated to the split-tunnel and dies at hop 6 points to an MTU/PMTUD black-hole or asymmetric routing on the tunnel path, not the client. Test the MTU with `ping -D -s 1472 <dc-host>` to find the break point, clamp the VPN client MTU to ~1400, and confirm the split-tunnel route table isn't sending DC subnets out the default gateway. If loss persists after the MTU clamp, escalate to NetOps to inspect the hop-6 ECMP/firewall pair.",
    },
  },
  {
    id: "T-1011",
    subject: "New hire provisioning before Monday",
    body: "New sales hire starts Monday and needs everything provisioned: AD account + email, a Salesforce seat, and Slack access to the team channels.",
    requester: "hr.ops",
    demo: {
      category: "account",
      priority: "P3",
      difficulty: "medium",
      resolution:
        "Onboarding kicked off: (1) AD account + Exchange mailbox requested via IAM, (2) Salesforce Standard seat requested through the Sales Ops form, (3) Slack invite queued for #general plus the sales team channels. Standard provisioning completes within ~4 business hours, so access will be ready before Monday. I'll confirm once the Salesforce seat is assigned.",
    },
  },
  {
    id: "T-1012",
    subject: "URGENT: production database unreachable, all users down",
    body: "The production database is unreachable and the entire company is down — no one can log into any app. This is a company-wide outage and customers are affected.",
    requester: "oncall.eng",
    demo: {
      category: "network",
      priority: "P1",
      difficulty: "hard",
      resolution:
        "P1 company-wide outage: production database unreachable. Paging the on-call DBA and incident commander, opening a Sev-1 bridge, and posting to the status page. Requires human approval before escalation per policy.",
    },
  },
];
