# Codex project instructions

Apply these defaults together with the current user request and relevant nested
instructions. Load detailed references only when the task needs them.

## Core engineering

- Understand the existing architecture through relevant entry points and dependencies
  before editing. Make the smallest complete change; avoid unrelated refactors or cleanup.
- Fix root causes. Preserve backward compatibility and historical data.
- Never weaken tests, security, or validation to pass. Never claim unexecuted checks passed.
- Never commit secrets, `.env` files, caches, build artifacts, screenshots, or unrelated files.

## Context efficiency

- Read task-specific files first. Prefer targeted searches and reads over broad discovery.
- Reuse still-valid architecture notes, audits, and release evidence. Do not repeat a
  complete audit when its underlying sources and assumptions have not changed.
- Do not automatically scan the repository for a localized change. Expand scope only
  for insufficient or contradictory evidence, or a crossed architecture boundary;
  state the concrete reason. Avoid discovery/implementation agents by default.

## Task size and workflow

S/M/L describes work effort, independently of the existing release risk classification.

| Size | Typical scope | Default workflow |
| --- | --- | --- |
| **S — small/local** | 1–3 related files, wording, CSS, isolated bug | Targeted implementation and checks/tests; at most one focused reviewer when needed. Broad regression can run in CI. |
| **M — integrated feature/content** | Quiz revision, feature, generated context, ordinary release | At most three stages: Implementation → Integration → Final verification/release. Stages 1–2 use targeted tests/audits; full release gates run once in Stage 3 when releasing. |
| **L — high risk** | DB schema, auth/security, architecture, infrastructure migration | Deeper planning and verification tied to specific risks. Do not classify an ordinary feature as L automatically. |

Combine or omit inapplicable stages. Do not turn a documentation/local task into a release.

## Bounded reviewers

- Give a reviewer only the current stage goal, current diff, relevant files/source,
  and actual test evidence. Limit its scope and reuse the same reviewer for corrections.
- Reviewers must not default to whole-repository scans, full source re-audits, full
  test suites, or duplicated implementer discovery. Widen only on concrete evidence.
- Return **PASS** or actionable findings. Fix findings, rerun affected targeted checks,
  and re-review the affected scope; do not rerun every gate for each correction.

## Progressive verification

Use: cheap static/content checks → targeted tests → affected generators/consistency
→ targeted local browser checks when needed → full release gates once on the final
stable release candidate → CI. Never run all repository gates after every small edit.
After a change, restore invalidated final evidence before release; official source
fingerprint and exact-SHA requirements still apply. Never skip required gates to save quota.

## Browser and production

Use local dev/preview during implementation. Production-site functional testing requires
an explicit request in the current task; deployment permission alone does not authorize it.
Report CI success, deployment success, artifact integrity, and production functional
acceptance as separate claims, each supported by its own evidence.

## Git and generated files

- Inspect branch, worktree, and status before changes; preserve unrelated user work.
  No force push, history rewrite, or destructive Git without explicit authorization.
- Preserve historical revisions of released/versioned content; never silently overwrite them.
- Use official generators. Do not hand-edit generated artifacts unless the repository
  explicitly requires it. Preserve immutable historical entries; avoid regenerating unrelated data.

## Read on demand

Read [verification strategy](docs/codex/verification-strategy.md) only for tasks needing
detailed verification, and [release workflow](docs/codex/release-workflow.md) only when
a release is requested. Ordinary tasks should not load these references automatically.
