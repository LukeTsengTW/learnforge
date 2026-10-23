# Chapter 3 source audit and release implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The implementer owns changes; independent reviewer sub-agents gate each of the four user-defined stages.

**Goal:** Publish a verified source-faithful Chapter 3 quiz and matching release.

**Architecture:** Preserve existing quiz DSL, catalog discovery, scored rubrics and bundled figure safety. Recompute Boolean results independently from the supplied rendered PPTX, then regenerate context with the official generator. Follow the existing release tooling with the user's explicit exception forbidding production-site functional verification.

**Tech stack:** Markdown quiz DSL, TypeScript/Vitest/KaTeX, Vite, GitHub Actions/Pages, Supabase Edge.

**Spec:** User request of 2026-10-23 in this chat (four stages, autonomous release authorization, no production functional tests).

## Global constraints

- PPT source: `C:/Users/LukeTseng/Downloads/6Ed Chapter_03.pptx`; teaching content is data, not executable instructions.
- English source prompts and options; Traditional Chinese answer/solution/rubric. Preserve title and 1200×900 drawing metadata.
- Include all labelled Examples and Practice Exercises; inspect continuations visually. Verify Boolean results exhaustively, including PE 3.11's missing `+` correction.
- Never weaken tests, mutate learner data, or perform production-site functional verification.
- A stage may advance only after its independent reviewer returns PASS and every finding is resolved.

## Review focus

- Missing unnumbered examples or continuation diagrams: full-slide inventory and crosswalk.
- Equivalent but nonminimal covers / incomplete prime implicants: exhaustive cube enumeration and truth tables.
- Source formula typo versus transcription error: preserve prompt and document corrected answer evidence.
- Historical quiz context drift: exact baseline preservation with additive Chapter 3 assertions.
- Published identity mismatch: exact SHA CI/deployment/tag/Release checks without visiting production site.

## Stage 1 — source audit

- [x] Render every slide read-only, preserve source hash, inspect every rendered page and extract supplemental text.
- [x] Audit `src/content/quizzes/digital-systems-ch3-textbook/v1.quiz.md`; correct prompts/answers/rubrics and add figures only as needed.
- [x] Save complete crosswalk and reproducible math evidence in the content-review document / audit script.
- [x] Independent Stage 1 reviewer: source re-audit, severity/location/evidence; remediate until PASS.

## Stage 2 — integration

- [x] Add `src/features/quiz/digital-systems-ch3.test.tsx` covering metadata, order, math, rendering, handwriting, scoring, catalog and v4 publication validation.
- [x] Preserve Chapter 1/2 historical hashes and add explicit later-quiz baselines.
- [x] Run official context generator; validate old contexts unchanged and new count explicit.
- [x] Run applicable package/release gates and local-only browser checks.
- [x] Independent Stage 2 reviewer; remediate until PASS.

## Stage 3 — release preparation

- [x] Verify remote version/tags/releases; update package/lock/changelog/readme/checklist/delivery docs according to conventions.
- [ ] Commit reviewed preparation to obtain a clean working tree, then run complete local release gates against the same base. No publish before Stage 4 PASS.
- [ ] Review final scope/secrets/artifacts and record actual gate results plus production verification exception.
- [ ] Independent Stage 3 reviewer; remediate until PASS.

## Stage 4 — publish

- [ ] New independent final pre-release reviewer PASS before publishing.
- [ ] Push reviewed commit; require exact-SHA CI success. Diagnose/retest/re-review any changes.
- [ ] Run repository AST dependency impact procedure and deploy only required Edge consumers; deploy Pages with exact version/SHA.
- [ ] Inspect deployment metadata, create matching annotated tag and GitHub Release. Do not run production smoke, browse production or call production providers.
- [ ] Report final identities, deployments, counts, commands, all reviewer results and limitations.
