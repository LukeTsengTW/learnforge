# Digital Systems Ch1–Ch4 textbook exercises source review

Source: user-supplied `problems(1).pdf` / displayed document title `problems.pdf` (26 PDF pages). This quiz uses only the user-selected Chapter 1–4 problems.

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

- `figures/p2-33.webp` — Figure P2.33 for Problem 2.33.
- `figures/p4-16.webp` — Figure P4.16 for Problem 4.16.

Tables in Problems 2.15 and 2.27 are transcribed as Markdown tables because their cells are the problem data themselves.

## Source issues / review notes

### Problem 2.27

The printed truth table contains only seven input combinations. It lists 000, 001, 010, 011, 100, 101, and 111; the `abc = 110` row is absent. The quiz preserves that seven-row table and does **not** invent an eighth row. The authored answer explicitly identifies the source incompleteness and gives a minimum implementation only under the stated assumption that the missing row is treated as a don't-care.

### Problem 4.5

The source says that inputs 4, 5, 6, or 7 produce an output equal to half the input, while the output is a three-bit binary value. The authored solution interprets this as the ordinary integer right-shift operation for the upper input range (discarding the low bit). Codex should independently verify this answer-side convention; the learner-facing source wording must remain unchanged regardless.

## Initial validation expectations

Before release, independently verify:

1. all 42 selected problem numbers and subparts against the supplied PDF;
2. literal/formula fidelity, including primes, summation/product notation, subscripts, and numerical constants;
3. the two cropped figure assets against PDF pages 6 and 12;
4. every authored answer mathematically/logic-wise, with special attention to 2.27 and 4.5;
5. official LearnForge parser, rubric, figure-safety, generated AI-context, integration, and release requirements.
