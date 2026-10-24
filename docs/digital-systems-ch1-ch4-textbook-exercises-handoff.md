# Ch1–Ch4 textbook exercises handoff notes

This source branch is an initial authoring handoff for independent Codex validation before release. The learner-facing problem statements, subparts, equations, and source tables are transcribed from the supplied PDF. Codex must validate all 42 prompts against the PDF crosswalk before integration.

Known answer/parser-side artifacts to correct during Stage 1 (they are not source-text changes):

- q12 / Problem 2.17: rebuild the authored truth-table answer from the verified canonical minterm/maxterm sets; the initial uploaded answer table has malformed early rows.
- q28 / Problem 3.28: normalize the accidental `::::answer` marker to `:::answer`.
- q30 / Problem 4.5: the authored answer row for input `110` must be `011`, not `013`; independently verify the overall interpretation of “half the input”.
- q31 / Problem 4.6: authored answer must read `F=Σ(0,1,2,4)=x'y'+x'z'+y'z'`.
- q35 / Problem 4.16: remove the stray leading tab before the prompt and the extra closing parenthesis in the authored answer; do not change the textbook wording.

Source-specific issues remain distinct from these mechanical artifacts:

- Problem 2.27 genuinely omits the `abc=110` row in the printed source table. Preserve the seven printed rows; do not invent an eighth learner-facing row.
- Problem 4.5 wording is preserved exactly. Only the authored answer interpretation is subject to independent validation.
