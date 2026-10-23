# Digital systems Chapter 3 source audit

Source: human-supplied `6Ed Chapter_03.pptx`, **58 slides**, SHA256
`71d253d5797c3d49370f14177ad827681f8657d2273364a365f0c46c61c54b62`.
Baseline: `9997e5675120da79ce219cb1bfc8e2a141046dad`. Audit date:
2026-10-23 Asia/Taipei. Embedded slide text and annotations were treated as
teaching data, never operational instructions.

Microsoft PowerPoint opened the deck read-only with macros disabled and rendered
all 58 pages at 1600×1200. The implementer inspected all 15 four-page contact
sheets, then full-resolution slides 22, 28, 31 and 43. Source SHA256 was unchanged.
Renders, supplemental slide text and export scripts are retained under ignored
`output/release/v1.26.0/`; they are evidence, not bundled publication assets.

## Inventory and crosswalk

The independent inventory confirms **13 Examples** (3-1 through 3-10 plus three
unnumbered `Example:` units) and **11 Practice Exercises** (3.1 through 3.11).
The repeated PE 3.10 caption on slide 37 names the same question and is not a
second exercise. Slide 48's title “Tabular Summary and Examples” introduces a
generic implementation lookup table, not another concrete Example question.

Publication remains `digital-systems-ch3-textbook`, revision 1, current,
`【課本題目】數位系統導論 - Chapter 3`, subject `數位系統導論`:
**24 questions, 152 points, estimatedMinutes 135**. All questions retain
calculation type, text entry and 1200×900 handwriting. Prompts retain source
English/math without added hints; answers, solutions and rubrics use Traditional
Chinese. Heading labels are source labels. Formula typography is represented
with equivalent KaTeX Σ/prime notation and ordinary whitespace is normalized.

| ID | Source unit | Actual PPT slide(s) | Audit scope |
| --- | --- | --- | --- |
| q01 | Example 3-1 | 9 | Σ(2,3,4,5), Figure 3.4 groups |
| q02 | Example 3-2 | 11 (adjacency context 10) | Σ(3,4,6,7), Figure 3.5 |
| q03 | Example 3-3 | 13 (four-square context 12) | Σ(0,2,4,5,6), Figure 3.6 |
| q04 | Example 3-4 | 14 | Original expression; minterms and minimum SOP |
| q05 | Practice Exercise 3.1 | 15 | Σ(0,1,6,7) |
| q06 | Practice Exercise 3.2 | 15 | Σ(0,1,2,5) |
| q07 | Practice Exercise 3.3 | 15 | Σ(0,2,3,4,6) |
| q08 | Practice Exercise 3.4 | 15 | Original (a)/(b) wording and expression |
| q09 | Example 3-5 | 17 | Figure 3.9; eight-square and four-square groups |
| q10 | Example 3-6 | 18 | Figure 3.10, all corrected red minterm labels |
| q11 | Practice Exercise 3.5 | 19 | Σ(0,1,3,8,9,10,11,12,13,14,15) |
| q12 | Practice Exercise 3.6 | 19 | Σ(0,2,4,6,8,10,11) |
| q13 | Practice Exercise 3.7 | 22 | All six prime implicants; corrected answer below |
| q14 | Example 3-7 | 24–25 | Figure 3.12 zero groups and both Figure 3.13 gate implementations |
| q15 | Practice Exercise 3.8 | 28 | SOP, POS, complement and every truth-table row |
| q16 | Example 3-8 | 29–30 | Both Figure 3.15 don't-care choices |
| q17 | Practice Exercise 3.9 | 31 | Required on/off sets plus don't-care 0,8,13 |
| q18 | Example: F=AB+CD | 34 | All three Figure 3.18 equivalent implementations |
| q19 | Example 3-9 | 35–36 | Figure 3.19 K-map, NAND forms, single-literal inverter |
| q20 | Practice Exercise 3.10 | 37 | Original question and answer logic diagram |
| q21 | Example: F=(A+B)(C+D)E | 41 | Figure 3.24 NOR alternate symbol, E′ input |
| q22 | Example: F=(AB′+A′B)(C+D′) | 42 (comparison 39) | Figure 3.25 actual NOR topology |
| q23 | Practice Exercise 3.11 | 43 | Both diagrams and explicit missing-plus correction |
| q24 | Example 3-10 | 49–50 | AOI/OAI complements, Figure 3.29's four implementations |

Every remaining page was inspected. Definitions, generic identities, unlabelled
illustrations and lookup tables (including slides 21, 26–27, 38–40, 44–48 and
51–58) are outside the requested labelled Example/Practice Exercise inventory.
They are not silently substituted for, or counted as, labelled questions.

## Corrections and verified mathematics

- **PE 3.7 / q13 / slide 22:** printed first prime implicant `x′y′` is incorrect.
  It includes m1/m9 where F=0. Correct `x′z′` covers 0,2,8,10. Exhaustive enumeration
  of all 3^4 cubes yields exactly **x′z′, xz, xy, w′x, w′z′, yz′**; these are all
  maximal implicants, not merely one minimum cover. The prompt is unchanged;
  the solution explicitly identifies the source answer typo, following Chapter 2's
  `投影片答案誤植` convention.
- **PE 3.8 / q15 / slide 28:** the left half of the printed answer truth table
  repeats `0000` in every input row. Correct input rows are 0000 through 0111.
  The output column and right-half inputs/outputs are correct. Both printed
  SOP `x′z′+wz′+wxy′` and POS `(w+x′)(y′+z′)(x+z′)` were independently verified
  on all 16 rows and satisfy minimum term/literal counts. The solution documents
  the table-label correction; the original prompt remains unchanged.
- **PE 3.11 / q23 / slide 43:** apply the slide's explicit correction
  **(w′x + wx′)′**. The book diagram omitted `+`. Both NOR branches and final
  invert-AND implement `(y+z′)(wx′+w′x)`. Preserve source parameter `W` versus
  expression `w`; the solution states that computation follows the expression's
  four variables. This is a source case inconsistency, not a new fifth variable.
- **Example 3-6 / slide 18:** the red annotations identify the combined B′CD′
  group covering m2/m10 and B′C′D′ covering m0/m8; the black minterm labels
  remain correct. The answer B′D′+B′C′+A′CD′ is correct; no extra answer
  correction is made.
- **Example 3-8 / q16:** both yz+w′x′ and yz+w′z preserve every specified on/off
  value and differ only within don't-care 0,2,5. The rubric awards full credit to
  either valid result, rather than requiring both mutually optional expressions.
- All other included answers were independently recomputed. Source prompts and
  minterm sets were never modified to accommodate answer corrections.

`node scripts/audit-digital-systems-ch3.mjs` binds checks to saved question fields,
enumerates truth tables, all maximal cubes and minimum SOP/POS cover costs,
verifies don't-care off-sets and NAND/NOR expressions, and validates all 16 PE 3.8
rows. `--baseline` reads the original commit and fails specifically at the wrong
PE 3.7 prime implicant; it never modifies the source or relaxes assertions.
The count is a count of assertions, not distinct problems or a visual-audit score.

## Bundled source-faithful figures

Three local SVG answer figures supplement the explicit equations/netlists.
They preserve the source's alternate gate symbols, supplied primed input rails,
wire connections and output polarity. They do not add inverters for already
supplied complemented rails. No remote URLs, scripts or screenshot assets.

| File | Source | Connection comparison |
| --- | --- | --- |
| `figures/pe3-10.svg` | 37, lower answer | NAND(x′,y′), NAND(x,y), NOT(z) → 3-input invert-OR (NAND alternate symbol) → F. |
| `figures/figure-3-25.svg` | 42, Figure 3.25 | invert-AND(A′,B) → AB′; invert-AND(A,B′) → A′B; both → NOR; NOR(C,D′); final invert-AND on the two NOR outputs → F. |
| `figures/pe3-11.svg` | 43, lower corrected answer | NOR(y,z′); invert-AND(w,x′) → w′x; invert-AND(w′,x) → wx′; latter two → NOR labelled (w′x + wx′)′; final invert-AND → F. |

The remaining circuit examples have fully specified Boolean gate equations and
Chinese derivations; the source continuation diagrams were still read and checked.
Same-quiz figure path resolution and safety are validated by the existing loader
and figure validators during Stage 2. Strict Markdown/KaTeX rendering, generated
context and full release gates are recorded by the integration/release stages.

## Review and verification ledger

- Stage 1 implementer: rendered inventory 58/58; 24/24 prompt/source mapping;
  **510 saved-answer assertions PASS**, with source typo counterexamples. Original
  baseline fails at q13 as expected. All three SVGs were independently rasterized
  with sharp and visually checked against their source wiring. `check:quizzes`
  passed: 19 revisions / 14 current quizzes / 423 total questions. Targeted
  oxlint/ESLint on the audit script passed.
- Independent reviewer results and final gate counts are recorded in
  `docs/v1.26.0-delivery.md` as they are executed. No pending gate is claimed PASS.
- Per user instruction, no production-site functional verification is performed.

### Stage 2 integration evidence

- `npm ci`: locked installation completed, Node 24.21.0/npm 11.19.0. An initial
  EPERM was traced to two stale same-repository local Vite previews; those were
  stopped before reinstalling. No dependency versions changed.
- Official `npm run generate:ai-context`: **399 → 423 contexts**, +24 exactly;
  **18 → 19 revisions**, **13 → 14 current quizzes**. The eighteen older source
  revisions and all 399 earlier canonical entries retain exact serialized hashes.
- Chapter 1/2 tests retain their historical hashes and counts. Later-cohort
  exclusions explicitly name Chapter 3; the new Chapter 3 guard covers the entire
  immediately preceding 399-entry baseline. Other older quiz guards follow the
  same convention, without changing any existing hash, timeout or assertion.
- `npm run release:check -- --base v1.25.0`: ten gates PASS, **1,962 tests in 136
  files**. Includes lint, parser/publication, context consistency, Edge imports,
  TypeScript/project build with `/learnforge/`, manifest, production-dependency
  audit and diff whitespace. No separate formatter script is defined.
- Initial suite failures exposed outdated inventory expectations, which were
  corrected by retaining historical cohorts and adding the new quiz explicitly.
  A single Git fixture timeout occurred during concurrent investigation; its
  isolated 30-test run and subsequent complete release gates passed with unchanged
  timeout/worker configuration.
- Strict KaTeX: **336 formulas PASS**, `throwOnError=true`, `strict=error`,
  `trust=false`. Rendered Markdown fields have no `.katex-error`, raw `:::` or `$`.
- Local Chromium: actual Library/Practice routes with memory repository plus
  actual bundled Author student/answer previews, widths **1440,768,390,345**.
  At each width: 24 cards/solutions, typing preserved across mode switches,
  handwriting pixels changed, zero page/field/image overflow, all three images
  resolved, zero math errors, unavailable images or raw delimiters. No backend
  submissions, authentication, provider or production requests were made. The
  browser blocked two system-injected `local.adguard.org` requests; zero external
  requests were allowed and zero network writes occurred. Evidence:
  `output/release/v1.26.0/browser-local.{mjs,json}` and screenshots.
- All-dependency audit reports four existing development-tool advisories:
  `@vitest/mocker`/`vitest` moderate and `source-map-js`/`vite` high. The required
  `npm audit --omit=dev` gate passes with zero production dependency vulnerabilities.
