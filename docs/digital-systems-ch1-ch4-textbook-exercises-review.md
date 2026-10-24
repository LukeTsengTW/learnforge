# Digital Systems Ch1–Ch4 textbook exercises source review

Source: user-supplied `C:/Users/LukeTseng/Downloads/problems.pdf` (26 PDF pages), SHA-256 `1836a1ee8cf753a3839b5c430adbf5e8ca65dc4cd65af55bf292fb02a33e48d0`. This quiz uses only the user-selected Chapter 1–4 problems. The 42-row crosswalk below requires PDF pages **1–14 only**; those pages were rendered and visually compared, without scanning pages 15–26. The PDF is image-only, so empty text extraction was not treated as a source audit.

## Scope

Quiz title: `【課本習題】數位系統導論 Ch1 ~ Ch4`

Quiz id: `digital-systems-ch1-ch4-textbook-exercises`

Initial revision contains exactly 42 selected textbook problems/subproblems. Learner-facing problem statements, subparts, equations, constants, and tables are transcribed from the supplied PDF. The textbook `*` marker indicating an answer is available at the back of the book is treated as editorial metadata rather than part of the exercise wording and is not reproduced.

Answers, explanations, scoring, and rubrics are LearnForge-authored material and are not represented as source quotations.

## Source crosswalk

| Quiz | Problem | PDF page | Book page |
| --- | --- | ---: | ---: |
| q01 | 1.9 | 1 | 54 |
| q02 | 1.13(a) | 1 | 54 |
| q03 | 1.18 | 2 | 55 |
| q04 | 1.20 | 2 | 55 |
| q05 | 1.22 | 2 | 55 |
| q06 | 1.30 | 2 | 55 |
| q07 | 2.3 | 3 | 93 |
| q08 | 2.9 | 3 | 93 |
| q09 | 2.11 | 3 | 93 |
| q10 | 2.14 | 4 | 94 |
| q11 | 2.15 | 4 | 94 |
| q12 | 2.17 | 4 | 94 |
| q13 | 2.18 | 4 | 94 |
| q14 | 2.19 | 4 | 94 |
| q15 | 2.22 | 5 | 95 |
| q16 | 2.27 | 5 | 95 |
| q17 | 2.33 | 6 | 96 |
| q18 | 3.5 | 7 | 157 |
| q19 | 3.6 | 7 | 157 |
| q20 | 3.12 | 8 | 158 |
| q21 | 3.13 | 8 | 158 |
| q22 | 3.15 | 8 | 158 |
| q23 | 3.17 | 8 | 158 |
| q24 | 3.19 | 8 | 158 |
| q25 | 3.20 | 8 | 158 |
| q26 | 3.23 | 9 | 159 |
| q27 | 3.24 | 9 | 159 |
| q28 | 3.28 | 9 | 159 |
| q29 | 4.4 | 10 | 253 |
| q30 | 4.5 | 10 | 253 |
| q31 | 4.6 | 10 | 253 |
| q32 | 4.7 | 10 | 253 |
| q33 | 4.10 | 11 | 254 |
| q34 | 4.12 | 11 | 254 |
| q35 | 4.16 | 12 | 255 |
| q36 | 4.21 | 13 | 256 |
| q37 | 4.26 | 13 | 256 |
| q38 | 4.27 | 13 | 256 |
| q39 | 4.28 | 13 | 256 |
| q40 | 4.31 | 13 | 256 |
| q41 | 4.32 | 13 | 256 |
| q42 | 4.34 | 14 | 257 |

## Source-dependent figure assets

Two selected problems require a source figure to preserve the original task meaning. These are cropped directly from the user-supplied PDF render rather than redrawn:

- `figures/p2-33.webp` — Figure P2.33 for Problem 2.33, 560×590 lossless source crop; SHA-256 `e38a2a88d938ce1aafea6c537aa5215456356626a6ef135374de6f0f55aa11ec`.
- `figures/p4-16.webp` — Figure P4.16 for Problem 4.16, 1430×850 lossless source crop; SHA-256 `0237c903c9deb6e65850cf1c940c7a4eda03c28123ab84f64b0fd98196a14eae`.

Both initial low-resolution crops were replaced from the authoritative PDF, preserving every terminal, wire, junction and inversion bubble. At a 2× page render, the crop rectangles `(left,top,right,bottom)` are `(565,940,845,1235)` on page 6 and `(245,695,960,1120)` on page 12; final extraction uses 4× rendering. No redrawing or generated imagery is used. Source scans limit ultimate detail.

Tables in Problems 2.15 and 2.27 are transcribed as KaTeX arrays because their cells are the problem data themselves; all source cells and their order are preserved.

## Source issues / review notes

### Problem 2.27

The printed truth table contains only seven input combinations. It lists 000, 001, 010, 011, 100, 101, and 111; the `abc = 110` row is absent. The quiz preserves that seven-row table and does **not** invent an eighth row. There are four full output-function pairs, because each missing output bit can independently be 0 or 1. The authored minimum implementation is conditional on an explicit **answer-side** don't-care assumption. The task itself does not demand minimization: grading accepts every declared completion consistent with the seven source rows and its matching circuit, rather than imposing one minimum or don't-care completion.

### Problem 4.5

The sentence `When the binary input is 4, 5, 6, or 7, the binary output is half the input.` is preserved verbatim. Ordinary three-bit unsigned integer outputs cannot represent 5/2=2.5 or 7/2=3.5. Even a fixed one-fractional-bit convention cannot simultaneously represent the required output 6 for input 3. The PDF supplies no truncation convention, so independent arithmetic cannot establish right shift as the unique textbook intent. The answer now first identifies the exact-specification limitation, then gives the original integer/right-shift mapping and `A=x'y, B=x+z, C=xy` **only as a conditional answer-side assumption**. Its corrected `110→011` row is verified. A sufficiently justified impossibility answer can receive full credit without inventing a circuit.

### Other source details preserved

- Problem 1.13(a) now includes its printed common instruction and `(a)` label, while omitting the unselected (b)/(c).
- Problem 4.6 does not state an input count. The answer gives the general strict-majority-of-zeros rule, then labels the three-input truth table/gate-level HDL as an authored example. Grading accepts other explicitly declared input counts and does not impose the unstated three-input assumption.
- Problem 4.12(a) calls the difference both `Diff` and `D`. Both source labels are preserved; grading accepts consistent naming.
- Problem 4.28's unusual printed dash in `following—three` is retained.
- Problem 3.20 has **no** outer prime: `CD(B+C)A+(BC'+DE')`. Stage 1 reviewer found the initial extra prime, which changed the function on 28/32 inputs. The prompt, both saved gate networks and the executable audit were corrected to the printed function `ACD+BC'+DE'`; all-zero input now produces 0. This is a transcription correction, not a source ambiguity.

## Stage 1 corrections and evidence

The handoff artifacts were corrected before the full audit: q12 malformed early truth-table rows, q28 answer marker, q30 nonbinary `013`, q31 erroneous `s` and math delimiter, and q35 indentation/extra parenthesis.

Substantive authored corrections: q12(c) uses minterm **8**, not **10**, with its complementary maxterm set and saved table rebuilt; q04 uses eight-bit signed arithmetic to represent all results including -78; q13 gives the five-literal factored minimum `xy+z(w'+y')` and complete original/reduced circuit descriptions. Every placeholder solution was replaced with actual reasoning; every one-line all-or-nothing rubric was replaced with scored, task-specific criteria. Circuit tasks now include explicit connections/netlists, parity polarity and decoder polarity are stated, and don't-care alternatives are accepted. IDs/order/types, 42 questions, 411 points and drawing metadata remain unchanged.

The initial `node scripts/audit-digital-systems-textbook-exercises.mjs` run passed 1,494 assertions and 639 strict KaTeX formulas but shared the initial 3.20 transcription error. That result did not establish source fidelity. The corrected audit separately checks the printed expression, saved NAND/NOR networks and an erroneous-outer-prime negative control. It reads saved answers, checks arithmetic/encoding, truth tables, canonical sets, exhaustive Boolean equivalence, exact minimum two-level covers, finite circuit/HDL-primitive/Gray-case behavior, MUX inputs and source figure format. High-level decoder/MUX block structure and source fidelity also require visual/manual review; this is not a claim of compiled HDL simulation.

At the Stage 1 preparation snapshot, `npm run check:quizzes` passed with 22 bundled revisions /16 current quizzes /504 all-revision questions; generator/integration evidence follows in Stage 2.

Stage 1 bounded independent reviewer: **PASS** after the 3.20 correction; all 14 crosswalk pages and both figures independently inspected, remaining 41 units reused unchanged. Corrected Stage 1 audit: **1,528 assertions /637 strict formulas**.

## Stage 2 integration evidence

The shared renderer supports CommonMark and math, not pipe tables. Six tables (q09's two authored tables, q11/q16 source tables, q12/q30 authored tables) were equivalently typeset as KaTeX arrays. All cells, headers and order are preserved; q16 still has exactly seven source rows. The saved-answer audit now accepts either representation and still passes **1,528 assertions**, with **635 strict KaTeX formulas** after grouping table headers. No shared renderer/CSS/parser behavior changes.

Official `npm run generate:ai-context` generated exactly 42 new entries. `check:quizzes`, `check:ai-context`, `check:edge-imports`, focused ESLint and `git diff --check` passed. Actual canonical inventory: **16 current quiz IDs /22 revisions /340 current questions /504 contexts**. Previous-release normalized source cohort (21 files) SHA-256: `d831dd585bfb4c79219acc5f2e5a0ef42af4596f1c6c63f3eefd7efa6383aca0`; previous context cohort (462 entries) SHA-256: `5de4dce95b0d9c76ce96bae43df0efa042f7172b7ca98031841392bb080b1113`. Both cohorts are byte/content unchanged. Older test cohort exclusions add only this new family, retaining every historical hash/count assertion; new tests independently derive complete counts from canonical sources.

Targeted tests: **20 files /410 tests PASS** after correcting one stale Chapter 3 global current-count expectation to the measured 16. The initial sandbox run had Vite temporary-cache ENOENT failures; the identical test command passed outside the sandbox, without assertion/timeout changes. The 17-file cohort run then had 313 PASS/one stale-count failure; the affected 9-test Chapter 3 file passed after correction. The separate three-file new quiz/catalog/Library group passed all 96 tests. Tests cover every canonical field, publication/scored v4 rubrics/drawing metadata, official context equivalence, all historical hashes, exact source seven-row/half-input constraints, figure rejection/loading and Chapter 1–4/catalog/Library integration.

Actual localhost in-app Chromium preview used the real Markdown, quiz and figure loaders plus app CSS for q11/q12/q16/q17/q25/q30/q35. At the narrow 480 CSS-pixel panel viewport (465-pixel document including scrollbar allocation), both source figures loaded with natural sizes 560×590 and 1430×850, all four selected arrays rendered, and no KaTeX/missing-image errors or horizontal overflow occurred. The q12 sixteen-row/eight-column table and both figures were visually inspected. Static source diagrams may need user zoom on small displays; this targeted component preview does not establish Auth, persistence or production behavior. No production URL/function/provider was invoked.

Stage 2 bounded independent reviewer: **PASS**, including independent previous-release hashes, all six table conversions, official context check, audit and diff check. One stale “Markdown tables” documentation NIT was corrected; no code/content findings remain. Stage 3 exact release outcomes are recorded in the [v1.28.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.28.0) and [delivery](v1.28.0-delivery.md).

## Initial validation expectations

Before release, independently verify:

1. all 42 selected problem numbers and subparts against the supplied PDF;
2. literal/formula fidelity, including primes, summation/product notation, subscripts, and numerical constants;
3. the two cropped figure assets against PDF pages 6 and 12;
4. every authored answer mathematically/logic-wise, with special attention to 2.27 and 4.5;
5. official LearnForge parser, rubric, figure-safety, generated AI-context, integration, and release requirements.
