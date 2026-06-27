-- TriageWise knowledge base on Supabase.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- The app fetches these rows live and scores similarity in-app (no embeddings
-- required). pgvector embeddings are a future upgrade.

create table if not exists public.kb_entries (
  id text primary key,
  category text not null,
  match text not null,
  resolution text not null
);

-- The publishable (anon) key may read the KB; row-level security is on with a
-- public read-only policy.
alter table public.kb_entries enable row level security;

drop policy if exists "public read kb_entries" on public.kb_entries;
create policy "public read kb_entries"
  on public.kb_entries for select
  to anon, authenticated
  using (true);

-- Seed (dollar-quoted so apostrophes/backslashes need no escaping).
insert into public.kb_entries (id, category, match, resolution) values
('kb-password-reset','account',
 $$password reset forgot password cannot log in cant sign in locked out account credentials self service portal sso single sign on$$,
 $$Reset it yourself at https://sso.company.com/reset using your phone for MFA. New passwords need 12+ chars and propagate to all SSO apps within ~5 minutes. Still locked out after that? Reply and we'll force-sync your directory account.$$),
('kb-account-unlock','account',
 $$account locked unlock too many attempts disabled login lockout reactivate access$$,
 $$Accounts auto-unlock 15 minutes after 5 failed sign-ins. To unlock immediately, use the Self-Service Password Reset portal at https://sso.company.com/reset — completing a reset also clears the lockout.$$),
('kb-vpn-setup','network',
 $$vpn set up setup configure connect globalprotect remote access work from home tunnel client install gateway$$,
 $$Install GlobalProtect from Company Software Center, then connect to vpn.company.com and sign in with SSO + MFA. On macOS, approve the system extension in System Settings > Privacy & Security the first time. Full-tunnel is the default profile.$$),
('kb-printer-offline','hardware',
 $$printer offline cannot print not printing print queue spooler stuck jam network printer add printer driver$$,
 $$Power-cycle the printer, then on your machine clear the print queue and restart the spooler. Re-add it from \\print01\ by floor (e.g. \\print01\FL3-Color). If it still shows offline, it's usually a stale IP — remove and re-add the queue.$$),
('kb-email-mobile','software',
 $$email outlook set up phone iphone android mobile mail app configure mailbox calendar$$,
 $$Install Microsoft Outlook from the App Store / Play Store, open it, enter your company email, and authenticate with SSO + MFA. It auto-configures mail, calendar, and contacts — no manual server settings needed. Approve the Intune/MDM prompt to finish.$$),
('kb-wifi','network',
 $$wifi wireless connect corp network ssid cannot connect internet office wifi authentication$$,
 $$Join the 'Corp-Secure' SSID and sign in with your SSO credentials (WPA2-Enterprise). Forget 'Corp-Guest' if your device keeps preferring it. A reboot clears most stale-association issues.$$),
('kb-slow-laptop','hardware',
 $$laptop slow performance freezing sluggish high cpu memory fan running hot reboot$$,
 $$Reboot first (uptime over a week is the usual cause). If it persists, check Activity Monitor / Task Manager for a runaway process and confirm pending OS updates aren't installing in the background. Reply with the top process if it's still slow.$$)
on conflict (id) do update
  set category = excluded.category,
      match = excluded.match,
      resolution = excluded.resolution;
