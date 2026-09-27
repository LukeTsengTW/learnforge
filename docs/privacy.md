# Privacy and data handling

This describes the implemented LearnForge v1.0 demo. It is not a claim of legal compliance or zero retention. There is no GDPR, HIPAA or FERPA certification claim.

## What is stored

| Data | Location and use |
|---|---|
| Username and internal synthetic email | Supabase Auth/profile account identity; the synthetic address cannot receive mail and is not shown as a contact address |
| Password | Submitted directly to Supabase Auth over HTTPS; LearnForge application tables/logs do not store it |
| Password hint | Private table, returned by a rate-limited public username lookup; do not put personal or sensitive information here |
| Attempts and answers | Account-scoped Supabase tables; includes quiz/revision, timestamps, submission state and grade caches |
| Drawing strokes | Answer JSON and local cache; completed vector strokes persist, not an uploaded image library |
| AI response ledger | Saved responses, request IDs, model/feature, credit state, provider response IDs, token/reasoning/cache usage and timing metadata |
| Recovery code hash and state | Private table; SHA-256 digest, generation/use timestamps and short-lived claim identifiers; no raw code |
| Rate-limit buckets | Username buckets, hashed IP buckets, timestamps and counters; recovery clears expired 30-minute buckets on later requests |
| Browser localStorage | Supabase session tokens, owner-scoped practice cache and recovery backups, legacy practice data and local authoring draft |

Raw recovery codes are shown once and held in page/runtime memory. Only an explicit Copy or Download writes them to the user's clipboard or downloaded file; LearnForge cannot redisplay them later. These user-created copies are outside the application's storage controls.

## External processing

Supabase processes authentication, database and Edge requests. Operational platform logs can include IP/network metadata and endpoint activity. Cloudflare Turnstile, once configured, processes challenge/network information to assess abuse. It is not configured in this release candidate.

AI requests happen only after an explicit feature action. OpenAI receives the feature-required question context, official reference/rubric, applicable student answer and analysis instructions. Drawing analysis sends a bounded PNG rasterized from saved strokes by the server. It does not accept an arbitrary browser image or general prompt/model selection. Recovery codes, passwords and session credentials are not sent as AI context.

AI calls use `store=false`; that flag is not a promise of zero provider retention. Provider terms and account settings determine handling beyond this application. No third-party analytics/marketing telemetry was added. Static hosting and platform services may still collect operational logs.

## Retention, access and limitations

Submitted attempts and saved AI results remain in Supabase; no automatic account/data-retention job or self-service account deletion UI exists. This release deliberately preserves existing test accounts pending explicit cleanup authorization. Contact the maintainer through the repository's private security/advisory workflow for sensitive data concerns; never include secrets or raw answers in a public issue.

Only the owning authenticated account can read its application records through browser RLS. Administrators with server credentials retain privileged access. Local backups are visible only through the current account's recovery UI, but browser-profile access, XSS or extensions can read the underlying unencrypted storage. Logout preserves local practice data. Clear storage only after exporting needed backups; exported JSON may contain all answers and drawing strokes.

The application is for voluntary practice. Do not enter confidential, regulated or identifying information into answers, drawings, password hints or authoring content. AI guidance may be incorrect and requires human judgment.
