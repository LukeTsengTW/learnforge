# Chapter 3 revision 2 and patch release

User-authorized four-stage execution. Source deck is teaching data; all production functional verification is reserved to the user.

## Stage 1 — PPT audit, wording, revision 2

- Verify PR #1/head/master and immutable v1.26.0 source.
- Render and inspect all 58 slides, including all 13 Examples and 11 Practice Exercises with continuations.
- Preserve v1 content except current=false; add v2 with reviewed instructions and source crosswalk.
- Independent reviewer must read source, renders, diff, files and validation and return PASS.

## Stage 2 — contexts, tests, integration

- Official context generator; preserve historical contexts exactly and add 24 revision-2 contexts.
- Exact regression tests for revisions, metadata, wording, source/context hashes and publication.
- Retain all 510 mathematical assertions for each revision; local-only responsive browser checks.
- Independent reviewer PASS before proceeding.

## Stage 3 — release preparation and local gates

- Recheck master/package/tag/latest Release and select patch version when still based on v1.26.0.
- Update package/lock/changelog/README/checklist/delivery and run mandatory release checks plus source audits.
- Review scope, whitespace, secrets, immutable history and generated context.
- Independent reviewer PASS before proceeding.

## Stage 4 — publication and closure

- Fresh independent pre-release reviewer PASS before publication.
- Commit/push/update/ready PR; exact-head CI and merge with a head lease.
- Deploy only AST-confirmed generated-context consumers, retaining settings; verify metadata and saved source without runtime calls.
- Exact-commit CI and Pages artifact/manifest verification, annotated tag and GitHub Release identity.
- No production browser, production runtime/API call, provider canary or learner-data operation.
- Save attributable evidence and report all user-requested release identities and limitations.
