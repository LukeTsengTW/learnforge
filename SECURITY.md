# Security

LearnForge is for self-directed practice, not a trusted examination or anti-cheating platform. Answers ship in the static bundle; client grades and localStorage can be edited. AI output is advisory only and never replaces the official answer or deterministic score.

## Reporting a vulnerability

Use the repository's GitHub Security Advisory workflow to coordinate a private report with the maintainer. Private vulnerability reporting availability has not been confirmed; if the private report entry is unavailable, request a private channel from the maintainer without posting exploit details publicly. No support email is invented here. Never include passwords, recovery codes, API keys, JWTs, private answers or raw production logs in issues or screenshots.

## Account and recovery boundaries

- Usernames map to internal, non-deliverable synthetic email addresses. There is no email-reset flow. Password hints are publicly queryable memory aids and must not contain sensitive information.
- Recovery codes contain 128 random bits. Only SHA-256 hashes are stored privately. Raw codes are returned once, and copy/download requires a user action. Anyone holding a valid code can reset that account's password; keep it like a password.
- Rotation invalidates the old code immediately. Recovery uses `active / claiming / used`, a five-minute claim TTL and a deferred trigger within the Auth password transaction. Release serializes against consume; stale or replayed updates roll back. The claim RPC and Auth HTTP request are separate transactions.
- This fence depends on Supabase Auth committing password and app metadata in one PostgreSQL transaction. The deployed behavior was verified live. Auth upgrades require rerunning the SQL fixture and live recovery E2E. A failed/uncertain response is reconciled against the claim, not assumed successful.
- Recovery revokes database sessions and account restore checks the session ID. Already-issued access JWTs may still be accepted by other Supabase APIs until expiry (currently one hour). This is not a claim of immediate universal JWT revocation.
- Account password changes require reauthentication and `current_password`; the linked server also enforces it. Minimum password length is 8, with a 72 UTF-8 byte client/Edge ceiling.

## Browser and database threat model

Browser roles only access their own RLS-protected application data. Recovery, hints, rate-limit storage and AI ledgers are intentionally server-only. Do not add permissive policies to silence advisor INFO messages. Privileged RPCs use fixed search paths and explicit grants; service-role credentials stay in Edge only.

LocalStorage holds the SDK session, account-scoped answers/drawing strokes, and conflict backups. It is not encrypted. XSS, malicious extensions or anyone using the same browser profile can read it. Logout clears the session, but deliberately preserves practice data. Clearing browser storage can destroy unsynced answers and backups. A same-origin user can modify local data; ownership checks prevent accidental account mixing, not compromise of the browser itself.

Practice sync uses UUID/owner/version compare-and-swap and database submission locks. Conflict resolution is whole-attempt selection, not collaborative merging. Backups can be restored only into an unchanged, empty draft of the same owner and revision. Submitted or newer cloud data cannot be overwritten by restore.

## Abuse controls and remaining release gate

| Surface | Current bound |
|---|---|
| Auth signup/sign-in | Remote 30 requests / 5 min / IP |
| Password hint | Username 3, IP hash 10, global 100 / 15 min |
| Recovery | Username 5, IP hash 20, global 200 / 30 min; 429 + Retry-After |
| AI | 20 credits / rolling 5h / account; unchanged |

Forwarded IP values alone are not a trusted identity. Global bounds remain effective when IPs vary, but attackers can exhaust shared quotas. Per-account AI limits do not prevent multi-account abuse. There is no DDoS or Sybil-resistance guarantee.

**CAPTCHA CONFIG REQUIRED BEFORE PUBLIC SIGNUPS.** Native Auth CAPTCHA is currently disabled; real Turnstile credentials are absent. Browser integration supports signup/login tokens; custom recovery verifies the token, action and hostname on the server. Unconfigured recovery fails closed. Never leave the explicitly temporary development `RECOVERY_ALLOW_NO_CAPTCHA` exception enabled for public release. Unit fake verifiers are not real CAPTCHA validation.

The linked organization is Free. Leaked-password protection is **not available on current plan**; its advisor warning remains. No plan upgrade or paid feature is enabled by this release.

## Production configuration

Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_TURNSTILE_SITE_KEY` are frontend configuration. `OPENAI_API_KEY`, service-role/secret keys, DB credentials and `TURNSTILE_SECRET_KEY` must never enter Vite, Git, public workflow variables or docs.

Production HTML has a restrictive CSP without `unsafe-eval`, and a strict-origin-when-cross-origin referrer policy. Inline styles remain allowed for KaTeX and existing UI. GitHub Pages cannot provide arbitrary response headers; meta CSP cannot enforce `frame-ancestors` or replace HSTS/header configuration. Markdown raw HTML is disabled and KaTeX trust is false. There is no third-party analytics SDK.

UI errors use fixed messages; do not log passwords, tokens, raw recovery codes, answers or provider errors. Platform Auth/Edge operational logs and provider processing still exist; see [privacy](docs/privacy.md). The release checklist and delivery report define evidence and outstanding limitations, not a security certification.
