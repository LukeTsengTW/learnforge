# LearnForge release process

Every release uses one exact commit SHA and the stable `major.minor.patch`
version in `package.json`. The deployed `release.json`, the release report, and
the eventual annotated tag must identify that same version and SHA. Missing,
failed, stale, or mismatched evidence blocks release closure.

Non-secret constants live in `scripts/release/config.mjs`: app name, production
URL, Pages base path, Supabase project ref, required Node/npm versions, deployment
workflow name, and tag prefix. Never place credentials in this file or in release
reports. Updating a constant requires reviewing the corresponding workflow or
public smoke expectations as well.

## Permanent release policy

| Risk | Scope | Required order |
| --- | --- | --- |
| A | Docs / presentation-only UI | CI → deploy → public smoke → tag |
| B | Frontend / domain behavior | CI → deploy → public + authenticated read-only smoke → tag |
| C | DB / Edge / AI / Auth, security-sensitive changes, or unknown impact | CI → backend preflight → explicit production mutation authorization → canary only when required → deploy → smoke → tag |

There are exactly three human mutation gates:

1. **Backend production mutation:** explicit authorization for the identified
   migration, Edge deployment, Auth configuration, or other backend operation.
2. **Final Pages deployment:** explicit authorization to deploy the exact version
   and SHA; dispatch the deployment workflow from `master` with both inputs.
3. **Annotated tag:** explicit authorization after every required check has passed
   and deployed identity has been confirmed.

These local tools do not perform any of those mutations. They do not commit,
push, deploy, tag, change Supabase/Auth/Edge state, or call providers. CI execution
does not authorize a production mutation. A higher-risk release cannot bypass a
gate because a lower-risk release previously passed it.

Provider canaries are required only when provider, grading, raster, prompt, model,
or evidence behavior changes. For those changes, use an explicitly authorized
canary with the required evidence before Pages deployment. A docs or ordinary
frontend change does not require a provider call. Unknown impact escalates the
release to Risk C and requires review of its actual changes; classification alone
never launches a provider canary. If a required canary or smoke cannot run safely,
record it as missing and stop before deployment or tagging.
Tests, documentation, presentation-only CSS/static assets, and release automation
do not require provider canaries. AI/security test or presentation changes may
still be Risk C; risk review and production provider behavior are separate checks.

## Conservative impact classification

The classifier compares a base Git ref with the selected head and can include
local tracked and untracked changes for implementation review. Resolve the base
against the previous release or an explicitly reviewed ref.

| Class | Meaning | Default policy |
| --- | --- | --- |
| `docs` | Only recognized documentation changes | Risk A |
| `frontend` | Recognized frontend-only changes | Risk B; presentation-only UI may use Risk A after review |
| `backend` | Migrations or Edge/backend changes | Risk C |
| `security-ai` | Auth, security, AI/grading/provider-sensitive, or unknown changes | Risk C |

Mixed changes inherit the highest risk. Unknown paths, renamed/deleted sensitive
files, release infrastructure, and ambiguous domain changes must escalate;
unrecognized changes never downgrade to docs or frontend. The classifier outputs
human-readable evidence and JSON; review the changed paths, reasons, and any
canary requirement before choosing the release policy.

```powershell
npm run release:classify -- --base v1.3.0 --head HEAD --include-working-tree
npm run release:classify -- --base v1.3.0 --head HEAD --json
```

## Local preparation and release checks

Use Node `24.21.0` and npm `11.19.0`. Install the locked dependencies with
`npm ci`. Prepare the intended version in the normal review process. Do not use
`npm version` during a local-only implementation task because it can create Git
commits and tags.

Read-only preflight checks the requested ref/branch, exact tools, package/version
identity, impact, and `git diff --check`. Require a clean tree and tag absence when
preparing a release candidate. It performs no Git mutation.
The default branch is `master`. A detached checkout requires an explicit `--sha`
or `--ref` that resolves to its exact `HEAD`; other branches require `--branch`.

```powershell
npm run release:preflight -- --base v1.3.0 --version 1.4.0 --sha <full-40-character-sha> --branch master --require-clean --require-tag-absent
npm run release:check
```

`release:check` runs the normal local gates sequentially: preflight, lint, tests,
quiz validation, AI-context validation, Edge import validation, production build
with `/learnforge/`, public manifest generation, production-dependency audit, and
`git diff --check`. It records check outcomes and produces a release report.
Any failed gate makes the command fail. It makes no production or provider calls.
Tests use an empty public Turnstile site key to avoid configured browser widget
requests in the local test environment.

`release:check` is local code/build evidence. It does not imply that backend
preflight, deployment, authenticated smoke, or required canaries have passed.
Review local modifications before creating a final clean release candidate.

## CI and exact-SHA Pages deployment

`.github/workflows/ci.yml` runs for pull requests and pushes to `master`, with
`contents: read`, Node `24.21.0`, npm `11.19.0`, and all normal CI gates including
Edge imports and `npm audit --omit=dev`. It does not deploy.

`.github/workflows/deploy.yml` remains `workflow_dispatch` only, and requires
`release_sha` and `release_version`. Dispatch with `--ref master`; this option is
mandatory. Supply `release_sha` as an independent exact commit identity check:

```powershell
gh workflow run deploy.yml `
  --repo LukeTsengTW/learnforge `
  --ref master `
  -f release_sha=<full-40-character-sha> `
  -f release_version=1.4.0
```

Before checkout, the workflow requires `github.ref` to be `refs/heads/master`
and `github.sha` to equal `release_sha`. Other branch and tag dispatch refs are
rejected even when they point at that same SHA. The workflow rejects malformed
inputs, a different workflow revision, a checkout
that differs from the requested SHA, a remote `master` that differs from that SHA,
or a different package version. A failed remote lookup blocks the release.

The workflow checks out the explicit SHA, runs all gates before building,
validates the configured Pages base path and public Supabase project identity,
writes `dist/release.json`, rechecks
remote `master`, and uploads that exact artifact. Immediately before deployment,
it again requires `refs/heads/master`, the workflow revision, checked-out `HEAD`,
and remote `master` to match the requested identity. If `master` advances while the build runs, stop
and prepare evidence for the new exact SHA. Branch movement cannot substitute a
different commit into the approved build.

Concurrency remains `cancel-in-progress: false`. Only the existing public
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
`VITE_TURNSTILE_SITE_KEY` are used for the Pages build. Release automation adds no
production credentials. Pages write and OIDC permissions are scoped to the deploy
job; its contents permission only supports the identity checkout. GitHub Pages
environment approval settings may enforce the final deployment authorization.

## Build identity and public smoke

After a production build, create the deterministic public manifest:

```powershell
npm run release:manifest -- --sha <full-40-character-sha>
```

`dist/release.json` contains only `app`, `version`, and `gitSha`. The supplied SHA
must equal local `HEAD`. There is no timestamp, credential, public key, or user
data in the manifest. Repeating generation for the same version and SHA produces
the same bytes.

After an authorized deployment, run the read-only public smoke against the
expected production URL, version, and SHA:

```powershell
npm run release:smoke -- --url https://luketsengtw.github.io/learnforge/ --version 1.4.0 --sha <full-40-character-sha>
```

Production smoke accepts only the canonical origin and base path from
`releaseConfig.productionUrl`: `https://luketsengtw.github.io/learnforge/`.
Alternate hosts, ports, credentials, HTTP downgrade, and substituted base paths
are rejected before any request. The smoke requires HTTP 200 for the app root and `release.json`, exact manifest
identity, the expected Pages base path, and the public Supabase project ref in the
deployed application. It does not print key values, authenticate, create users,
open quiz/practice routes, submit answers, or invoke AI/providers. A wrong
identity, missing configuration, unexpected redirect, or failed request blocks
closure.

Local/offline tests may explicitly use `--allow-local` with a loopback HTTP/HTTPS
URL, such as `http://127.0.0.1:4173/learnforge/`. The exact `/learnforge/` base path
is still required; non-loopback hosts remain prohibited. Without this option,
loopback URLs are rejected. Production workflows must never use `--allow-local`.

Risk B additionally requires separate authenticated **read-only** smoke evidence
for the affected domain behavior. Risk C requires smoke evidence appropriate to
the changed backend and, when applicable, the authorized provider canary. The
public smoke does not supply either of these additional proofs.

## Reports and closure

```powershell
npm run release:report -- --base v1.3.0
npm run release:report -- --checks output/release/checks.json --deployment-result <deployment-result.json> --smoke-result <smoke-result.json>
```

Reports are `output/release/report.json` and `output/release/report.md`. They
include version, exact SHA, impact, gate outcomes, test/build outcomes, and
deployment/public-smoke outcomes only when supplied. Missing local evidence remains
`not-run`; absent deployment/public smoke remains `not-supplied`. Neither may be
presented as success. Supplied deployment and smoke
results require matching `version` and `gitSha` plus a `passed` or `failed`
status. Reports accept only the supported public result fields and must exclude
credentials and user data.
Local evidence is also bound to the comparison base and a content fingerprint
of tracked and relevant untracked source, including staged identity. The shared
source inventory rejects ignored files under `src/`, `scripts/`, `supabase/`,
`.github/`, and `public/`, and ignored root build/config files such as package,
Vite, TypeScript, lint, and Node configuration. An ignore rule cannot hide
build-consumable source such as `src/output/payload.ts` from classification,
preflight, or evidence validation.
Legitimate ignored root `.env` / `.env.*` build configuration is included in the
content fingerprint and conservatively routed to Risk C, including committed-only
classification. Configuration values are never printed or copied into reports.
Changing source or the comparison base invalidates cached checks even when
`HEAD` and package version are unchanged. Explicit generated/dependency roots
remain excluded: `node_modules/`, `dist/`, `dist-ssr/`, `output/release/`, `.vitest/`,
`coverage/`, `.playwright-cli/`, and `.playwright-mcp/`. Only allowlisted generated
Supabase CLI metadata files within `supabase/.temp/` and `supabase/.branches/`
are excluded; these folders are not blanket exclusions. Unexpected source such
as `supabase/.temp/provider.ts` blocks the inventory. Generated-root exclusions
do not apply to similarly named directories nested under source roots.
Use the same `--base` for `release:check` and `release:report`; rerun checks after
any source change. Unsupported source file types block evidence generation.

Before asking for annotated-tag authorization, confirm every gate required by
the risk policy, production manifest identity, and the exact deployed SHA. The
annotated tag must point to that same commit. Any failure or missing required
evidence stops release closure; reporting is not a substitute for executing a
gate. A report with all local gates passed still does not prove release closure
while required production evidence is missing. Production backend operations,
final Pages deployment, and annotated tagging remain the three explicitly
authorized release mutations.

## Historical special-purpose gates

Preserve these historical scripts and their existing meanings:

- `scripts/release-browser-e2e.mjs`
- `scripts/release-recovery-e2e.mjs`
- `scripts/release-real-turnstile-e2e.mjs`
- `scripts/release-final-gate.mjs`

The mutating `release-browser-e2e.mjs` and `release-real-turnstile-e2e.mjs`
scripts are special-purpose gates and **must NOT be part of automatic production
release smoke**. They may create or change production state and require their
own explicit scope and authorization. Historical recovery/final-gate scripts
must also be reviewed for their prerequisites and side effects before use;
release automation does not silently repurpose them.
