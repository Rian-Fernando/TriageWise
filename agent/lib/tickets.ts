/**
 * Sample IT tickets for the demo. A larger pool than one run uses, so each run
 * samples a fresh, varied batch (different mix → different savings) — see
 * `sampleTickets`.
 *
 * `demo` holds canned classifications/resolutions used in DEMO mode (or as a
 * fallback when a live model call fails). `tags` are the human/workflow actions
 * shown as an audit trail; `reminder` is a follow-up the user is nudged on.
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
    /** Extra workflow/action tags shown in the audit trail. */
    tags?: string[];
    /** Optional follow-up nudge the user should receive (sent via Resend). */
    reminder?: string;
  };
}

const ENROLL_PWM = "Enroll in the password management tool + MFA";

const KERNEL_PANIC_FIX =
  "This looks like a third-party kernel extension that's incompatible with the new macOS build. Boot into Safe Mode, run `kmutil showloaded --variant-suffix release` to list non-Apple kexts, and check `log show --predicate 'eventMessage contains \"panic\"' --last 1d` for the faulting bundle ID. Unload/update the implicated kext or migrate it to a DriverKit System Extension, then re-approve it in Recovery.";

const PACKET_LOSS_FIX =
  "Loss isolated to the split-tunnel that dies at hop 6 points to an MTU/PMTUD black-hole or asymmetric routing on the tunnel path, not the client. Test MTU with `ping -D -s 1472 <dc-host>`, clamp the VPN client MTU to ~1400, and confirm the split-tunnel route table isn't sending DC subnets out the default gateway. If it persists, escalate to NetOps for the hop-6 ECMP/firewall pair.";

/** The full pool. `sampleTickets` draws a batch from this each run. */
export const TICKETS: Ticket[] = [
  {
    id: "T-1001",
    subject: "Forgot my password, can't log in",
    body: "I forgot my password and now I'm locked out of my account. How do I reset it so I can sign in?",
    requester: "amir.k",
    demo: { category: "account", priority: "P4", difficulty: "easy", resolution: "", reminder: ENROLL_PWM },
  },
  {
    id: "T-1002",
    subject: "Locked out — need password reset",
    body: "My account is locked after too many sign-in attempts and I can't remember my password. Need a reset.",
    requester: "dana.r",
    demo: {
      category: "account",
      priority: "P3",
      difficulty: "easy",
      resolution: "",
      tags: ["Verify ID — Temporary Access Pass", "Email sent"],
      reminder: ENROLL_PWM,
    },
  },
  {
    id: "T-1003",
    subject: "How do I set up the VPN on my Mac?",
    body: "Starting remote work this week. How do I install and connect to the company VPN on my MacBook?",
    requester: "joon.p",
    demo: { category: "network", priority: "P3", difficulty: "easy", resolution: "", tags: ["Help desk link in ticket"] },
  },
  {
    id: "T-1004",
    subject: "VPN won't connect from home",
    body: "Trying to connect to the VPN from home with GlobalProtect but it won't connect. Need remote access.",
    requester: "mira.s",
    demo: { category: "network", priority: "P3", difficulty: "medium", resolution: "", tags: ["Call user back"] },
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
    demo: { category: "software", priority: "P4", difficulty: "easy", resolution: "", tags: ["Help desk link in ticket"] },
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
        "Adobe Acrobat Pro is in Company Software Center — open it, search 'Acrobat Pro', and click Install; an enterprise license is auto-assigned (allow ~10 min). It's a paid-seat app, so if it doesn't appear your manager may need to approve the license — reply and I'll route it.",
      tags: ["License approval check"],
    },
  },
  {
    id: "T-1009",
    subject: "MacBook kernel panics after macOS update",
    body: "Since the latest macOS update my MacBook randomly kernel-panics a few minutes after waking from sleep. We run a custom third-party kext for our lab hardware. Logs mention a backtrace into a non-Apple bundle.",
    requester: "wei.l",
    demo: { category: "hardware", priority: "P2", difficulty: "hard", resolution: KERNEL_PANIC_FIX, tags: ["Remote session scheduled"] },
  },
  {
    id: "T-1010",
    subject: "Intermittent packet loss to DC over VPN split-tunnel",
    body: "Intermittent packet loss reaching the data center, but only over the VPN split-tunnel; internet traffic is fine. Traceroute consistently dies at hop 6. Started after the weekend.",
    requester: "noor.a",
    demo: { category: "network", priority: "P2", difficulty: "hard", resolution: PACKET_LOSS_FIX, tags: ["NetOps follow-up if MTU clamp fails"] },
  },
  {
    id: "T-1011",
    subject: "New account provisioning before Monday",
    body: "New international student starts Monday and needs everything provisioned: AD account + email, an ESS portal seat, and Teams access. They're overseas this week.",
    requester: "hr.ops",
    demo: {
      category: "account",
      priority: "P3",
      difficulty: "medium",
      resolution:
        "Onboarding kicked off: (1) AD account + Exchange mailbox via IAM, (2) ESS portal seat requested, (3) Teams access queued. Standard provisioning completes within ~4 business hours. ID verification will be done over Zoom since the user is overseas.",
      tags: ["International student", "Requires Zoom session", "Call user back"],
    },
  },
  {
    id: "T-1012",
    subject: "URGENT: production database unreachable, all users down",
    body: "The production database is unreachable and the entire company is down — no one can log into any app. Company-wide outage and customers are affected.",
    requester: "oncall.eng",
    demo: {
      category: "network",
      priority: "P1",
      difficulty: "hard",
      resolution:
        "P1 company-wide outage: production database unreachable. Paging the on-call DBA and incident commander, opening a Sev-1 bridge, and posting to the status page. Requires human approval before escalation per policy.",
      tags: ["Sev-1 bridge opened", "Status page updated"],
    },
  },
  {
    id: "T-1013",
    subject: "Please reset my password",
    body: "I can't remember my password and can't sign in to my account. Please help me reset it.",
    requester: "tomas.v",
    demo: { category: "account", priority: "P4", difficulty: "easy", resolution: "", reminder: ENROLL_PWM },
  },
  {
    id: "T-1014",
    subject: "VPN keeps disconnecting every few minutes",
    body: "GlobalProtect VPN connects but drops every few minutes when I work from home. Need a stable remote connection.",
    requester: "kira.b",
    demo: { category: "network", priority: "P3", difficulty: "medium", resolution: "", tags: ["Call user back"] },
  },
  {
    id: "T-1015",
    subject: "Wi-Fi keeps dropping in the office",
    body: "The office Wi-Fi keeps dropping my connection and won't reconnect to the corporate network. Can't stay online.",
    requester: "owen.d",
    demo: { category: "network", priority: "P3", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1016",
    subject: "My account is disabled, can't log in",
    body: "My account looks disabled / locked out and I can't sign in after several attempts. Need access restored.",
    requester: "hana.m",
    demo: { category: "account", priority: "P3", difficulty: "easy", resolution: "", tags: ["Verify ID — Temporary Access Pass"] },
  },
  {
    id: "T-1017",
    subject: "Laptop is super slow and freezing",
    body: "My laptop has been really slow and keeps freezing the last few days. The fan runs hot and apps hang.",
    requester: "bea.f",
    demo: { category: "hardware", priority: "P3", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1018",
    subject: "Email is down for the entire office",
    body: "No one in the building can send or receive email — Exchange seems down org-wide. This is blocking everyone.",
    requester: "ops.center",
    demo: {
      category: "network",
      priority: "P1",
      difficulty: "hard",
      resolution:
        "P1: org-wide email outage. Paging the messaging/on-call team and incident commander, opening a Sev-1 bridge, and posting to the status page. Requires human approval before escalation per policy.",
      tags: ["Sev-1 bridge opened", "Status page updated"],
    },
  },
  {
    id: "T-1019",
    subject: "Recurring BSOD across Dell fleet after BIOS update",
    body: "Multiple Dell laptops are blue-screening intermittently after last week's BIOS/firmware update. Looks fleet-wide, different stop codes. Needs root-cause.",
    requester: "deskside.q",
    demo: {
      category: "hardware",
      priority: "P2",
      difficulty: "hard",
      resolution:
        "Fleet-wide BSODs after a BIOS update usually trace to a driver/firmware mismatch. Pull the bugcheck codes via `wevtutil`/WinDbg minidumps, confirm the new BIOS version, and roll back one machine to the prior BIOS to isolate. If the dumps implicate a storage/Intel ME driver, push the vendor-matched driver via your management tool and stage the BIOS rollout in a ring instead of fleet-wide.",
      tags: ["Remote session scheduled"],
    },
  },
  {
    id: "T-1020",
    subject: "Need Microsoft Project installed",
    body: "I need Microsoft Project installed to manage the rollout schedule for my team.",
    requester: "pm.lane",
    demo: {
      category: "software",
      priority: "P4",
      difficulty: "medium",
      resolution:
        "Microsoft Project is a paid-seat app. I've requested a license assignment; once approved it'll appear in Company Software Center under 'Project' to self-install. I'll confirm when the seat is granted.",
      tags: ["License approval check"],
    },
  },
  {
    id: "T-1021",
    subject: "Printer jams and shows offline on 5th floor",
    body: "The 5th floor printer keeps jamming and then shows offline; the print queue gets stuck and nothing comes out.",
    requester: "rosa.e",
    demo: { category: "hardware", priority: "P4", difficulty: "easy", resolution: "" },
  },
  {
    id: "T-1022",
    subject: "Set up work email on my Android phone",
    body: "I just got an Android phone and need my work email and calendar set up on the Outlook mobile app.",
    requester: "dev.s",
    demo: { category: "software", priority: "P4", difficulty: "easy", resolution: "", tags: ["Help desk link in ticket"] },
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw a fresh batch each run. Guarantees one P1 (for the approval gate) and up
 * to two hard tickets (for the Claude path); the rest are random fillers. The
 * varying mix is what makes each run's savings number different.
 */
export function sampleTickets(n = 12): Ticket[] {
  const p1s = TICKETS.filter((t) => t.demo.priority === "P1");
  const hard = TICKETS.filter((t) => t.demo.difficulty === "hard" && t.demo.priority !== "P1");
  const rest = TICKETS.filter((t) => t.demo.priority !== "P1" && t.demo.difficulty !== "hard");

  const picked: Ticket[] = [];
  if (p1s.length) picked.push(shuffle(p1s)[0]);
  picked.push(...shuffle(hard).slice(0, 2));
  picked.push(...shuffle(rest).slice(0, Math.max(0, n - picked.length)));
  return shuffle(picked);
}
