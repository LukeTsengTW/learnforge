# Quiz-specific instructions

Apply these rules when editing quizzes, together with the root defaults.

## Published revisions

- Never silently overwrite a published revision. Create the next revision when the
  content change requires one, retain the old revision as historical, and switch
  `current` according to the existing catalog convention.

## Source fidelity and questions

- Supplied teaching material/source is authoritative for content. Preserve its
  wording, formulas, and notation; do not invent additional task meaning unless requested.
- If requested task wording must be clarified from source context, state **what to do**
  without revealing **how to do it**. Record the source mapping and any justified discrepancy.
- Unless the task requests changes, preserve question IDs, order, points, type,
  drawing metadata, answers, and rubrics.

## AI contexts

- Use the official `npm run generate:ai-context` generator. Retain historical revision
  contexts and generate the new revision's own contexts. Never manually overwrite old
  contexts or hand-edit generated output.

## Targeted validation

Prioritize parser/quiz validation, relevant quiz tests, changed-content audits,
generated-context consistency, Markdown/KaTeX, and figure safety. Reuse valid source
audits and compare historical hashes. Use existing `check:quizzes` and
`check:ai-context` scripts when applicable. Full repository release gates run only
at the final release stage, not after each quiz edit.
