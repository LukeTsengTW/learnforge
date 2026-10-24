# Codex verification strategy

Read this when a task needs detailed verification. Start from the
[root defaults](../../AGENTS.md); use only the stages relevant to the task.

**Targeted checks → targeted tests → integration consistency → full gates once → CI.**

S/M/L controls effort, not the repository's separate release risk classification.
Required release/security gates remain binding. Prefer existing checks and evidence
over inventing another procedure or changing CI to reduce consumption.

## S — localized edit

Read and edit only the affected files and immediate dependencies. Run cheap static,
content, or format checks and relevant tests. Use at most one focused reviewer when
requested or justified by risk; broad regression can run in CI.

Do not use a release-style multi-stage flow. For documentation/instruction changes,
check paths, Markdown, references, rule consistency, and diff scope; use an existing
cheap doc lint if available. Full tests, build, browser, and deployment are unnecessary
unless a concrete affected behavior requires them.

## M — integrated feature or content

Use at most these three stages. Combine stages when practical; do not add stages for
paperwork, a small correction, or another reviewer. Keep every review bounded as in
the root defaults, and reuse its reviewer for affected corrections.

### Stage 1 — Implementation

- Read relevant source and still-valid architecture/content audits only.
- Implement the complete scoped change and run targeted static/content checks and tests.
- Use a bounded reviewer for the implementation diff, relevant source, and actual evidence.

### Stage 2 — Integration

- Run affected official generators and affected integration tests.
- Check generated-context/catalog consistency and preservation of historical data.
- If rendering or interaction changed, check the affected flow locally; choose viewports
  for the actual layout risk rather than repeating every browser sweep.
- Use a bounded reviewer for integration changes and new evidence; reuse unchanged audits.

### Stage 3 — Acceptance / Release

- Review the final diff and confirm that evidence still covers its source and assumptions.
- For a requested release, run the full existing release gates once on the stable
  candidate, followed by a final bounded reviewer and CI for the pushed release commit.
  For non-release work, finish the applicable verification and CI without deployment.
- Release/deploy only when requested, following [release workflow](release-workflow.md).

If Stage 3 finds a problem, fix it and run affected targeted checks in the inner loop.
Once the candidate is stable again, rerun the necessary invalidated final gates.
Do not rerun the entire suite after each attempted fix or repeat passing gates on an
unchanged candidate. Use the official gate aggregator once instead of running each
of its full-suite/build steps separately immediately before or after it.

The release tooling binds evidence to source fingerprints, configuration, comparison
base, and commit identity. A changed fingerprint/base can invalidate the whole local
report even for a documentation edit; then a new stable release candidate needs the
official final gates again. Do not transplant stale outcomes into a new report.
Required CI/deployment-workflow gates still run independently on their exact commit.

## L — high risk

DB/schema, auth/security, architecture, or infrastructure migration can require broader
planning, independent review, regression, migration/recovery, or security verification.
Map each expensive operation to a concrete risk or mandatory gate. The targeted-first
sequence is a default, not a ceiling that blocks necessary high-risk verification.

## Reusing evidence

Record or reference the evidence location, source revision/hash, reproducible command,
result, and relevant assumptions. Reuse it only while those dependencies remain valid.

| Unchanged evidence dependency | Reuse approach |
| --- | --- |
| Source inventory and scope | Reuse the inventory; inspect the delta instead of inventorying everything again. |
| Mathematical source and reproducible answer audit | Reuse derivations; audit changed wording, formulas, answers, or assumptions. Do not rederive every answer for each revision. |
| Historical entries and expected hashes | Compare against recorded hashes; do not rediscover historical content. |
| Architecture notes and affected boundaries | Read the relevant section and verify the boundary rather than rescan the repository. |
| Existing release procedure | Follow its links and scripts rather than rewriting the procedure in prompts. |

Changed underlying source, tools/dependencies, generator, configuration, baseline,
or assumptions invalidates dependent evidence. Missing or contradictory evidence
requires a focused investigation; expand only as far as the concrete gap requires.
Historical audit reuse does not replace fresh exact-commit CI or source-bound release gates.

## Avoid repeated expensive operations

Do not repeatedly run full test suites, complete builds, all-viewport browser sweeps,
whole-document audits, full dependency scans, broad reviewer agents, context regeneration,
or production deployments at every stage or small edit. Run only what changed evidence
or a specific risk requires, and group final release checks at the stable candidate.
Production functional checks require the current task's explicit request; a missing
required check stays pending, never PASS.
