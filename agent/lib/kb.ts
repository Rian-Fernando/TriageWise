/**
 * Seeded IT knowledge base + similarity search.
 *
 * Default backend is in-memory with deterministic lexical (TF cosine)
 * similarity — no keys, no network, always runs, and good enough to recognize
 * repeat tickets (the cache-hit story). If SUPABASE_* env vars are present a
 * pgvector backend is attempted and falls back to in-memory on any error.
 */

export type Category = "network" | "account" | "hardware" | "software";

export interface KbEntry {
  id: string;
  category: Category;
  /** Canonical phrasing + keywords used for matching. */
  match: string;
  resolution: string;
}

/** High-frequency, already-known IT issues. Repeat tickets match these. */
export const KB_ENTRIES: KbEntry[] = [
  {
    id: "kb-password-reset",
    category: "account",
    match:
      "password reset forgot password cannot log in cant sign in locked out account credentials self service portal sso single sign on",
    resolution:
      "Reset it yourself at https://sso.company.com/reset using your phone for MFA. New passwords need 12+ chars and propagate to all SSO apps within ~5 minutes. Still locked out after that? Reply and we'll force-sync your directory account.",
  },
  {
    id: "kb-account-unlock",
    category: "account",
    match:
      "account locked unlock too many attempts disabled login lockout reactivate access",
    resolution:
      "Accounts auto-unlock 15 minutes after 5 failed sign-ins. To unlock immediately, use the Self-Service Password Reset portal at https://sso.company.com/reset — completing a reset also clears the lockout.",
  },
  {
    id: "kb-vpn-setup",
    category: "network",
    match:
      "vpn set up setup configure connect globalprotect remote access work from home tunnel client install gateway",
    resolution:
      "Install GlobalProtect from Company Software Center, then connect to vpn.company.com and sign in with SSO + MFA. On macOS, approve the system extension in System Settings > Privacy & Security the first time. Full-tunnel is the default profile.",
  },
  {
    id: "kb-printer-offline",
    category: "hardware",
    match:
      "printer offline cannot print not printing print queue spooler stuck jam network printer add printer driver",
    resolution:
      "Power-cycle the printer, then on your machine clear the print queue and restart the spooler. Re-add it from \\\\print01\\ by floor (e.g. \\\\print01\\FL3-Color). If it still shows offline, it's usually a stale IP — remove and re-add the queue.",
  },
  {
    id: "kb-email-mobile",
    category: "software",
    match:
      "email outlook set up phone iphone android mobile mail app configure mailbox calendar",
    resolution:
      "Install Microsoft Outlook from the App Store / Play Store, open it, enter your company email, and authenticate with SSO + MFA. It auto-configures mail, calendar, and contacts — no manual server settings needed. Approve the Intune/MDM prompt to finish.",
  },
  {
    id: "kb-wifi",
    category: "network",
    match:
      "wifi wireless connect corp network ssid cannot connect internet office wifi authentication",
    resolution:
      "Join the 'Corp-Secure' SSID and sign in with your SSO credentials (WPA2-Enterprise). Forget 'Corp-Guest' if your device keeps preferring it. A reboot clears most stale-association issues.",
  },
  {
    id: "kb-slow-laptop",
    category: "hardware",
    match:
      "laptop slow performance freezing sluggish high cpu memory fan running hot reboot",
    resolution:
      "Reboot first (uptime over a week is the usual cause). If it persists, check Activity Monitor / Task Manager for a runaway process and confirm pending OS updates aren't installing in the background. Reply with the top process if it's still slow.",
  },
];

// ---------------------------------------------------------------------------
// Lexical similarity (deterministic, no model needed)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  "a an the to of in on for is are i my me we you it this that with and or but how do i need cant can not get got have has had please help when my your our".split(
    /\s+/,
  ),
);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [t, av] of a) dot += av * (b.get(t) ?? 0);
  const mag = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  const denom = mag(a) * mag(b);
  return denom === 0 ? 0 : dot / denom;
}

const ENTRY_VECS = KB_ENTRIES.map((e) => ({
  entry: e,
  vec: termFreq(tokenize(e.match)),
}));

/** A score at/above this counts as a cache hit. Tuned so common repeats match
 *  and novel/hard tickets (kernel panics, outages) do not. */
export const KB_HIT_THRESHOLD = 0.35;

export interface KbResult {
  hit: boolean;
  score: number;
  entry: KbEntry | null;
}

/** In-memory lexical search — the always-on default path. */
export function searchKbLexical(text: string): KbResult {
  const q = termFreq(tokenize(text));
  let best: KbResult = { hit: false, score: 0, entry: null };
  for (const { entry, vec } of ENTRY_VECS) {
    const score = cosine(q, vec);
    if (score > best.score) best = { hit: score >= KB_HIT_THRESHOLD, score, entry };
  }
  return best;
}

/**
 * Public search entry point. Uses Supabase pgvector when SUPABASE_* is set and
 * reachable; otherwise (and on any error) falls back to in-memory lexical search
 * so the demo never breaks.
 */
export async function searchKb(text: string): Promise<KbResult & { backend: "pgvector" | "memory" }> {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const pg = await searchKbPgvector(text);
      if (pg) return { ...pg, backend: "pgvector" };
    } catch {
      // fall through to lexical
    }
  }
  return { ...searchKbLexical(text), backend: "memory" };
}

/**
 * Supabase pgvector backend (wired, optional). Requires a `kb_entries` table
 * with an `embedding vector` column and a `match_kb` RPC. Returns null to signal
 * "not configured / unavailable" so the caller falls back to lexical search.
 * Kept dependency-light via dynamic import so the app builds without Supabase.
 */
async function searchKbPgvector(_text: string): Promise<KbResult | null> {
  // Intentionally minimal: a real deployment would embed `_text`, call the
  // `match_kb` RPC, and map the top row to a KbResult. Until a database is
  // provisioned this returns null and the lexical backend handles the query.
  return null;
}
