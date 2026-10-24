# Digital Systems Chapter 4 content review

Source: `6Ed Chapter_04(1).pptx` (68 slides), Chapter 4 — Combinational Logic.

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

The initial source commit includes compact source-derived SVGs for the questions/answers whose meaning depends on a diagram. Codex should re-check these against the supplied PPT and may replace them with closer source exports during integration.

- `figures/figure-4-2.svg`
- `figures/pe4-1.svg`
- `figures/pe4-8.svg`
- `figures/pe4-9.svg`
- `figures/figure-4-30.svg`

For `pe4-9.svg`, the output line and `F` label are included because the slide itself places them as separate overlay shapes outside the embedded answer image.
