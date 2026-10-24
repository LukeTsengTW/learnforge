# Digital Systems Chapter 4 content review

Source: user-supplied `6Ed Chapter_04.pptx` (68 slides), Chapter 4 — Combinational Logic.

SHA-256: `841e167fc95db69171c02dcdd79e24d4fd1b8a7ee1f425080defb872870b20d2`.
Starting source commit: `a245c527f8b0cca37ebfcacfdce809170bd6644d`.

## Scope

The initial LearnForge source revision contains the slide deck's explicit Practice Exercises and worked examples that are explicitly identified as examples in slide text/captions.

- 6 worked examples
- 9 Practice Exercises
- 15 questions total

Question text and source answers are kept in English/formula form. No Traditional Chinese translation or learner-facing supplemental notes are added.

When an Example contains only a formula, diagram, or worked process without an explicit task sentence, the quiz adds only a concise English task instruction describing what the example actually does.

## Source crosswalk

| Quiz | Source slide(s) | Source item | Prompt handling |
| --- | ---: | --- | --- |
| q01 | 7–9 | Figure 4.2, “Logic diagram for analysis example.” | Added task instruction to analyze the diagram, derive $F_1/F_2$, construct the truth table, and identify the circuit function. |
| q02 | 10 | Practice Exercise 4.1 | Question and source answer preserved. |
| q03 | 13–16 | “Code conversion example” — BCD to excess-3 code | Added task instruction: design a BCD-to-excess-3 code converter. |
| q04 | 22 | Practice Exercise 4.2 | Question and source answer preserved. |
| q05 | 28 | Practice Exercise 4.3 | Question and source answer preserved. |
| q06 | 30 | Practice Exercise 4.4 | Question and source answer preserved. |
| q07 | 30 | Practice Exercise 4.5 | Question and source answer preserved. |
| q08 | 33 | Practice Exercise 4.6 | Question and source answer preserved. |
| q09 | 34 | “Example” under Overflow | Added task instruction to determine whether overflow occurs in the two shown signed additions. |
| q10 | 44 | Practice Exercise 4.7 | Question and source answer preserved. |
| q11 | 50 | Practice Exercise 4.8 | Question and source answer figure/truth table preserved. |
| q12 | 62 | “an example: $F(A,B,C)=\Sigma(1,2,6,7)$” | Added task instruction to implement the function with a $4\times1$ multiplexer. |
| q13 | 64 | “Example: $F(A,B,C,D)=\Sigma(1,3,4,11,12,13,14,15)$” | Added task instruction to implement the function with an $8\times1$ multiplexer. |
| q14 | 65 | Practice Exercise 4.9 | Question preserved. The answer figure includes the output line and $F$ label shown separately on the source slide. |
| q15 | 67 | “Example: Four-to-one-line multiplexer” | Added task instruction to construct the four-to-one-line multiplexer using three-state gates. |

## Figure assets

The five initial SVG redraws were replaced with proportional PNG exports of the actual source shapes using local PowerPoint. No circuit was redrawn. `Shape.Export` uses slide-relative scaling (2160 × 1620 for the source's 720 × 540 point canvas), preserving aspect ratio.

- `figures/figure-4-2.png`: slide 7, shape 4; excludes the worked-answer overlay at the left of the slide.
- `figures/pe4-1.png`: slide 10, shape 6; preserves G4's actual A/C connections.
- `figures/pe4-8.png`: slide 50, shape 5; preserves the inverter, both enables, output groups, and all eight truth-table rows.
- `figures/pe4-9.png`: slide 65, shapes 5, 7, 8; retains the original answer image plus the source's output line and F overlay.
- `figures/figure-4-30.png`: slide 67, shape 3; preserves S1/S0, EN, all decoder-to-gate connections, common Y, and both source panels.

For `pe4-9.png`, the output line and `F` label are included because the slide itself places them as separate overlay shapes outside the embedded answer image.

## Stage 1 source validation and discrepancies

Inspected the 19 crosswalk slides rendered by PowerPoint: 7–10, 13–16, 22, 28, 30, 33–34, 44, 50, 62, 64–65, 67. The inventory maps all six examples and PE4.1–4.9 without an inventory contradiction; no full-deck re-audit was needed. All 15 IDs, ordering, calculation types, 1200 × 900 drawing metadata, points (97 total), and revision 1/current metadata are retained.

All six candidate English example instructions describe the source workflow without adding a solution strategy and are retained. The nine PE prompts and original answer text/formulas were compared visually, including embedded equation objects that do not appear in plain XML text extraction.

- PE4.1 (slide 10): the original answer says G4 contributes `A+B` and gives `F2=A+B`. The actual G4 OR gate connects A and C, giving `F2=AB+A+C+BC=A+C+BC`; `F1=A+B+C` in either case. Keep both the original diagram and printed source answer. Explain the contradiction only in the solution and accept either supported F2 result in the rubric. Initial SVG used incorrect A/B wiring and omitted clear gate types/connection structure.
- PE4.8 (slide 50): original wording says “active-low enable”, but the diagram uses E as the third selection input, E' on the upper decoder and E on the lower decoder, with active-high one-hot outputs and no independent all-disabled row. Preserve the source diagram/table and wording. Solution/rubric explicitly accept the source configuration and a consistent implementation of the stated task. Initial SVG omitted the inverter and output connections.
- MUX example (slide 62): source heading uses A/B/C, while the table and circuit use x/y/z. Preserve both source conventions and accept the corresponding A/B/C answer labels. This is a source notation mismatch, not a different Boolean function.
- PE4.6 (slide 33): retain `A-B=1_0011_2` exactly as printed; leading 1 is the subtractor carry-out, while the four-bit difference is 0011. Remove the initial prompt's extra comma absent from the source.
- Overflow example (slide 34): restore the source's `carries: 0 1` and `carries: 1 0` rows omitted by the initial transcription. The source's -80 representation is `1 0110000`, matching the initial transcription; no numeric correction is made.
- PE4.9 (slide 65): retain source-added output line/F and the input annotations A'BC, AB'C, AB=ABC+ABC'. No Chinese editorial note is inserted into the question.

Image-only answers also have source-derived text/table relationships in solutions/rubrics so existing text-only AI contexts can assess them without changing the provider or figure pipeline.

Stage 1 independent bounded reviewer: **PASS**, all 19 source renders and five saved PNGs compared, 91 finite assertions with zero failures. Reviewed quiz SHA-256 before equivalent table typesetting: `492429bedcca4fc9ee4f72676c5e9806348db51b14e18d6ba04b0cc236856c0f`.

## Stage 2 integration evidence

- Official `npm run generate:ai-context`: 21 revisions / 462 contexts. Actual pre-Chapter-4 master baseline was 20 revisions, 14 current quizzes, 283 current questions, 447 contexts; Chapter 4 adds one revision, one current quiz, 15 current questions and 15 contexts. Final totals: 21 revisions, 15 current quizzes, 298 current questions, 462 contexts.
- All 20 prior source revisions and 447 serialized contexts remain identical. Normalized source-cohort SHA-256: `8aadb623a360643c7aef675f2b436fae81a58bd3ba99a34f07f1a075d3444c24`; serialized-context SHA-256: `1bf47d3047acd7488399668e59a9ddd8376ecf517a4ee52db391abf43d698fb8`.
- Existing historical-cohort tests exclude the newly added family while retaining every historical hash and exact cohort-size assertion. Global expected counts were updated only after computing the actual repository inventory. New Chapter 4 tests bind all generated fields to `toTutorContext`, validate publication/rubrics/drawing metadata, and derive complete counts from canonical sources.
- `node scripts/audit-digital-systems-ch4.mjs`: **PASS**, 170 content/math/figure checks, 159 strict KaTeX formulas, five reviewed PNG hashes. All eight rows of both truth tables and every MUX input combination are checked. Existing Chapter 3 math/source audits remain unchanged.
- Affected targeted run: **18 files / 287 tests passed**. After the table-rendering correction, affected Chapter 4/catalog rerun: **2 files / 28 tests passed**. Focused lint passed. Initial Windows sandbox junction/SSR-cache failures were rerun successfully outside the sandbox with unchanged assertions, worker bound 4, and no timeout increase.
- `check:ai-context` and `check:edge-imports` passed. Publication/rubric/figure safety was validated by `check:quizzes` and focused tests.
- Local browser uses the real `Markdown`, quiz loader, figure loader, and application CSS in an ignored, local-only preview. Inspected q01/q02/q09/q11/q14/q15 at 1280 and 390 pixels. Five source assets load correctly; no KaTeX errors, unavailable figures, or document-wide overflow. Dense display arrays scroll within their containers on narrow screens. No authentication, provider requests, submissions, or production access.
- The existing renderer uses CommonMark without pipe-table support. Converted only Chapter 4 q01/q11 truth tables to equivalent KaTeX arrays; audit checks preserve all rows and values. No renderer or shared CSS change was needed.
- Stage 2 reviewer found that a saved MUX input prefix check could accept `z'` in place of `z`. The audit now parses all saved input assignments exactly, evaluates those parsed values, and rejects an in-memory `I_0=z` to `I_0=z'` negative control. Exact source overflow operands/results are also pinned. Corrected audit, focused lint and Chapter 4's six tests passed.
- Stage 2 independent bounded reviewer: **PASS** after the correction. Reverse-converting only the two KaTeX tables reproduced the exact Stage 1 quiz SHA under the original CRLF line endings, verifying all other reviewed content stayed unchanged.
