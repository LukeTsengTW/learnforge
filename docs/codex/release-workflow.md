# Codex release workflow

Read this only for a requested release. Use the existing
[release process](../release-process.md), the relevant section of the
[release checklist](../release-checklist.md), and `package.json` release scripts as
the procedural authority. Do not invent a parallel release procedure or replay
every historical checklist snapshot as current instructions.

1. **Establish identity.** Determine the current version from the actual repository,
   package/lockfile, tags, and GitHub Releases. Resolve disagreements before choosing
   the next version; dated documentation is not proof of the current release.
2. **Finish targeted work.** Complete targeted validation, affected generators,
   integration checks, and bounded reviews before the final release gates.
3. **Validate one stable candidate.** Follow the existing `release:preflight`,
   `release:check`, and `release:report` procedure with the same verified base and
   exact identity. Run full gates once, without duplicating their individual full
   steps. Repeat only when substantive candidate changes or the official source
   fingerprint/base/identity rules invalidate evidence. Use targeted checks while
   fixing issues, then re-establish required final evidence on the stable candidate.
4. **Verify exact-commit CI.** CI must validate the pushed release commit. If merge
   changes its SHA, verify CI on that SHA; a PR-head result does not prove merge-SHA
   success. Preserve the existing authorization gates; authorization already given
   in the current task need not be requested again.
5. **Deploy affected components only, when authorized.** Derive affected consumers
   from actual changes/imports and follow existing backend-before-frontend ordering
   where required. Do not alter JWT, provider, grading, auth, or runtime settings
   unless the task requires it. Keep version, release commit, annotated tag target,
   GitHub Release target, and deployed manifest identity consistent; preserve old releases.
6. **Report evidence precisely.** Record actual commands/results and exact identities.
   CI success, deployment success, artifact integrity, and production functional
   acceptance are separate claims. Only evidence-backed checks can be reported PASS.

## Production acceptance boundary

Production-site functional testing is prohibited by default. It requires an explicit
request in the current task; release/deploy authorization alone is insufficient.
Do not automatically run public smoke, production browser journeys, login/attempt/
submission checks, function runtime probes, or provider canaries. Prefer saved
artifacts and deployment metadata for integrity verification where applicable.

This execution boundary does not silently waive required smoke/canary gates in the
existing release process. If such a gate is required but unauthorized, leave it
pending and stop release closure at that boundary unless the user explicitly supplies
acceptance evidence or waives that requirement. Record a waiver as a waiver, never
as an executed PASS; report any resulting acceptance limitations.
