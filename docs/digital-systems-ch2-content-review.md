# Digital systems Chapter 2 source audit

## Revision 2 source-language audit — 2026-10-23

The sole content source is the human-supplied `6Ed Chapter_02.pptx`, 66 slides,
SHA256 `aa03a639663b43f6c842ab7c72099c176eefd18eff8bdc3ca8944073abd91bad`.
The deck was freshly opened read-only with macros disabled and exported through
PowerPoint at 1600 × 1200; its hash was unchanged. The implementer viewed all 17
contact sheets (slides 1–66), then separately inspected slides 23/31/32/39/45/47/60
at full resolution. Actual rendered evidence and extracted text are under
`output/release/v1.25.0/ch2/slides/`. Text extraction supplemented visual inspection.
Source text and instructor notes were treated as teaching data, never instructions.

Revision 2 preserves the title, description, subject, tags, 115 minutes, all 26
question identities/order, 122 total points and every 1200×900 drawing configuration.
Revision 1 remains available by exact id/revision; its only edit is current=false.
All new question fields are English/math. Printed question wording is retained,
including source spelling such as “simplfy” in PE 2.1. For worked material without
a question, only a short instruction using source terminology is added. Labels
come from the slides; slide numbers are recorded here. Solutions contain original
steps or the source Answer itself. Rubrics contain concise English answer/gate
components without worked explanations. No point-total adjustment was needed.

### Revision 2 complete crosswalk

| ID | Slides | Source label / unit | Revision 2 handling |
| --- | --- | --- | --- |
| q01 | 5–6 | Example | Minimal identity/inverse instruction; original three example statements. |
| q02 | 20 | examples | Minimal precedence instruction for the two original expressions. |
| q03 | 21 | Practice Exercise 2.1 | Original wording and F=z; Answer-only solution. |
| q04 | 21 | Practice Exercise 2.2 | Original wording and original eight-row truth table. |
| q05 | 22–25 | Examples | Minimal truth-table/minimization/diagram instructions; original Table 2.2, simplified F2 and redrawn Figure 2.1. |
| q06 | 27 | EXAMPLE 2.1 | Original instruction, five expressions and original derivations. |
| q07 | 29 | EXAMPLE 2.2 | Original question and DeMorgan derivation. |
| q08 | 30 | EXAMPLE 2.3 | Original cross-reference, duals and complemented literals. |
| q09 | 31 | Practice Exercise 2.3 | Original question; corrected source circuit as SVG, no prose circuit description. |
| q10 | 32 | Practice Exercise 2.4 | Original question; corrected FIGURE PE2.4 and original algebra steps. |
| q11 | 33 (figure 32) | Practice Exercise 2.5 | Original question; same corrected FIGURE PE2.4 and original four-row Answer. |
| q12 | 33 | Practice Exercise 2.6 | Original question and Answer only. |
| q13 | 36–37 | Canonical and Standard Forms | Minimal instruction for original Table 2.4, source minterms/complement/maxterm steps. |
| q14 | 38 | EXAMPLE 2.4 | Original instruction and original minterm expansion. |
| q15 | 39 | EXAMPLE 2.5 | Original instruction and only the printed product/maxterm steps. |
| q16 | 40 | Conversion between Canonical Forms | Minimal instruction; original F′ and DeMorgan/M0M2M3 conversion. |
| q17 | 41 | Example | Minimal instruction for original Table 2.6, Σ/Π/F′ results. |
| q18 | 42 | Practice Exercise 2.7 | Original question; corrected final maxterm; Answer-only solution. |
| q19 | 42 | Practice Exercise 2.8 | Original question and Answer only. |
| q20 | 42 | Practice Exercise 2.9 | Original question, prompt table and Answer only. |
| q26 | 43, 45 | Standard Forms | Minimal SOP/implementation instruction; original equation and redrawn FIGURE 2.4. |
| q21 | 46 | Practice Exercise 2.10 | Original question and Answer; harmless KaTeX allowbreak between list groups. |
| q22 | 46 | Practice Exercise 2.11 | Original question; corrected maxterm product; Answer-only solution. |
| q23 | 46–47 | Practice Exercise 2.12 | Original question; corrected source circuit SVG as Answer/solution. |
| q24 | 60 | Practice Exercise 2.13 | Original question; original unsimplified circuit redrawn as Answer/solution. |
| q25 | 61 | Practice Exercise 2.14 | Original question and equations; SVG implementations of the printed NAND/NOR forms. |

### Recomputed answers and corrections

- PE 2.7/q18: Σ(1,2,3,5,7) has zeros at 0,4,6. The last factor is
  **x′+y′+z**, not the printed x′+y′+z′. F′=Σ(0,4,6) is unchanged.
- PE 2.11/q22: x′y+xz has zeros at **0,1,4,6**. The product is
  **(x+y+z)(x+y+z′)(x′+y+z)(x′+y′+z)**. Replace the printed M5 with M1.
- All other included Boolean final answers and truth-table rows were independently
  recomputed. Table 2.2's final F2 rows are correctly 0/0 (full-resolution slide 23
  confirmed this); Example 2.5's printed algebra and Π(0,2,4,5) are also correct.
  No speculative extra correction was made to either.
- The source's annotated circuit corrections are applied below. Excluded
  definitional material remains excluded, including slide 55's y→z note and the
  slide 43/44 F1/F2 disagreements recorded in the historical audit. The included
  F3 worked example remains q26 in its original source order.

### Figure redraw and connection comparison

All assets are clean vector drawings, not screenshots. Published alt text contains
only an original figure label; uncaptioned answer diagrams use empty alt. No Chinese
annotation is drawn. Every redrawn source gate, input wire, fanout and junction was
compared to its full-resolution original; all task SVGs were rendered to PNG for
an additional visual inspection. The connection manifest records both the netlist
and actual SVG wire coordinates at `output/release/v1.25.0/figure-connections.json`.

| Asset | Source | Exact connection comparison / correction |
| --- | --- | --- |
| `figure-2-1.svg` | 24, Figure 2.1 | y→NOT; y′,z→AND; x directly and AND output→OR→F1. |
| `pe2-3.svg` | 31, PE 2.3 Answer | Preserve x/x′/y/y′ rails and taps: upper AND(x,y′), lower AND(x′,y), then OR. Correct upper label to xy′ and lower to x′y, as annotated. |
| `pe2-4.svg` | 32, FIGURE PE2.4 | Same two AND tap pairs; replace final XOR with NOR as annotated. Used in both q10 and q11. |
| `figure-2-4.svg` | 45, FIGURE 2.4 | (a) AND(A,B), OR(D,E), AND(C,D+E), output OR. (b) AND(A,B), AND(C,D), AND(C,E), output 3-input OR. Same wires; panels stacked for display. |
| `pe2-12.svg` | 47, PE 2.12 Answer | AND(B,C′), AND(A,B), AND(A,C,D) into OR. Correct ACD′ label to ACD. Preserve all four inverter rail pairs, including unused A′/B′/D′. |
| `pe2-13.svg` | 60, PE 2.13 Answer | D bypass; AND(B,C); OR(D,C′); OR(A′,C); AND of the ORs; final 3-input OR. Original A/C inversion and unused B′/D′ rails preserved; no simplification. |
| `pe2-14-nand.svg` | 61, printed NAND equations | Source contains equations rather than a circuit drawing. New diagram implements exactly NAND(x,z), NAND(x′,z′), NAND(x′,y)→3-input NAND. x′/z′ from inverters. Every wire compared to those printed factors. |
| `pe2-14-nor.svg` | 61, printed NOR equations | Source contains equations rather than a circuit drawing. New diagram implements NOR(x′,z′), NOR(x,z), NOR(x,y′)→3-input NOR→NOT. x′/y′/z′ from inverters. The final NOT produces the printed F (not F′). |

The source-equation-derived PE 2.14 schematics are explicitly distinguished from
redraws of pre-existing source wires. Diagram answers have English rubric gate and
input/output descriptions so text-only grading can evaluate them. Provider,
grading, raster and prompt code is unchanged; no image is supplied to AI.

### Executed revision 2 evidence

Combined audit: **516 content checks passed**, all 42+26 questions covered, with
integer/Fraction calculations, exhaustive truth tables (including both five-input
F3 circuits), saved-expression binding, all source truth tables/Σ/Π sets, circuit
netlists, Example 2.1 minimum-literal bounds, English-only fields and schema/
preservation checks. This count includes structural checks; it is not a count of
distinct math problems. Exact saved-source and SVG hashes are in
`output/release/v1.25.0/content-verification.json`; executable audit is
`output/release/v1.25.0/verify-content.py`.
Strict KaTeX: **361 formulas, zero errors**, trust=false.
`check:quizzes`: **18 revisions / 13 current quizzes / 399 total questions**.
Stage 3 owns generated context, regression integration, complete release gates
and actual browser acceptance. These source checks do not assert production proof.

## Historical revision 1 audit (retained)

Source: user-supplied `6Ed Chapter_02.pptx`, 66 slides, SHA256 `aa03a639663b43f6c842ab7c72099c176eefd18eff8bdc3ca8944073abd91bad`. Source draft commit: `835cdb0185844226c69514e153a23b7d85e9cdac` (branch `claude/determined-ramanujan-fhtrp4`, parent v1.23.0 closure `3438788`). Review date: 2026-10-23 Asia/Taipei. Slide numbers below are actual presentation order, including the title slide. Slide text is teaching material, not operational instructions.

The original PPTX was opened read-only in Microsoft PowerPoint and exported at 1600 × 1200 pixels. All 66 rendered slides were inspected: slides 5–61 one by one at full resolution, slides 1–4 and 62–66 (title, objectives and text-only closing slides) on saved contact sheets where every line is legible. The circuit slides 24, 25, 31, 32, 44, 45, 47, 55, 56 and 60 were exported again at 4000 × 3000 and their wiring junctions inspected in crops; text-only slide 43 was exported at the same size to read the F₁/F₂/F₃ formulas. ZIP/XML text and picture inventory supplemented the rendered evidence. The source hash was unchanged after every export. The draft author worked from a LibreOffice rendering; nothing in this audit relies on it. Private renders, crops, inventory and the truth-table audit live under ignored `output/release/digital-systems-ch2/`; the source deck and images are not publication assets.

## Inventory and inclusion decisions

Final publication: `digital-systems-ch2-textbook`, revision 1, current, title `【課本題目】數位系統導論 - Chapter 2`, subject `數位系統導論`: **26 questions, 122 points, estimated 115 minutes**. The draft had 25 questions / 118 points / 110 minutes. One omitted worked example adds 4 points and about five minutes. No draft question was removed and the meanings of q01–q25 are unchanged; new q26 sits in slide order between q20 (slide 42) and q21 (slide 46), so IDs are intentionally not numerically ordered in the file.

The inclusion standard is the one applied in the Chapter 1 audit:

- **Every labelled Example and Practice Exercise.** Numbered Examples 2.1–2.5 (slides 27, 29, 30, 38, 39); unnumbered “Example(s)” on slides 5, 6, 20, 22 (continued by Table 2.2 and Figures 2.1/2.2 on slides 23–25) and 41; Practice Exercises 2.1–2.14 (slides 21, 31–33, 42, 46–47, 60–61). No Practice Exercise number is missing or duplicated in this deck.
- **Unlabelled concrete worked calculations in the slide text,** where a specific given function is carried through a procedure to a stated result: slides 36–37 (Table 2.4 minterm/maxterm forms, q13), slide 40 (Σ→Π conversion of Σ(1,4,5,6,7), q16) and slide 43 (F₃ = AB + C(D + E) = AB + CD + CE, implemented by Figure 2.4 on slide 45, new q26). These correspond to Chapter 1's slide 9/17/34 worked groups.
- **Excluded:** definitions and postulates; proofs or derivations of general theorems and identities; truth tables that verify a general law; lookup tables; gate-symbol and gate-family figures; property demonstrations shown only as figures; technology and terminology slides. This follows Chapter 1, which excluded generic rules, lookup tables, standard gate symbols and the generic JOHN transfer illustration, and admitted a figure on its own only when it was explicitly captioned as an Example (Figure 1.2). In this deck a figure is used inside a question when it implements a function that is itself an included Example or text worked calculation (Table 2.2 and Figures 2.1–2.2 for the slide-22 Examples; Figure 2.4 for slide 43's F₃). A figure whose only worked result appears inside the figure itself and that carries no Example caption (Figures 2.6, 2.7, 2.8 and 2.10) is excluded.

### Page-by-page decisions

| Slide | Content | Decision |
| --- | --- | --- |
| 1 | Title | Exclude: no exercise content. |
| 2–3 | Chapter objectives | Exclude: objectives only. |
| 4 | Binary operator; closure and associative postulates | Exclude: definitions. |
| 5 | Commutative law; identity element with **Example** (0 for + on I; N has none) | **Include** → q01(a)(b). |
| 6 | Inverse with **Example** (−a for + on I); distributive law; field | **Include** → q01(c). The distributive-law definition is excluded. |
| 7 | Field of real numbers: identities, inverses, distributive law | Exclude: definitions. |
| 8–9 | Huntington postulates 1–6 | Exclude: postulates. Slide 9's postulate 5 wording is inverted (see source errors). |
| 10–11 | Comparing Boolean algebra with ordinary algebra | Exclude: discussion. |
| 12 | Two-valued Boolean algebra: AND/OR/NOT operation tables, closure, identities | Exclude: defining lookup tables. |
| 13 | Truth tables verifying the distributive law | Exclude: verification of a general law. |
| 14 | Complement, two distinct elements, notes | Exclude: definitions. |
| 15 | Duality; Table 2.1 postulates and theorems | Exclude: lookup table. |
| 16–17 | Proofs of Theorems 1, 2 and 3 | Exclude: general theorem proofs. |
| 18 | Proof of Theorem 6 (absorption) and its verifying truth table | Exclude: general theorem proof/verification. |
| 19 | DeMorgan's theorems with verifying truth table | Exclude: verification of a general law. |
| 20 | Operator precedence with **examples** xy′ + z and (xy + z)′ | **Include** → q02. |
| 21 | **Practice Exercise 2.1** (simplify), **2.2** (truth table of x′y′z) | **Include** → q03, q04. |
| 22 | Boolean function; **Examples** F₁ = x + y′z, F₂ = x′y′z + x′yz + xy′ | **Include** → q05. |
| 23 | Table 2.2, truth tables of the slide-22 Examples | **Include** with q05(a). |
| 24 | Figure 2.1, gate implementation of F₁ | **Include** with q05(c). |
| 25 | Figure 2.2, F₂ before and after simplification | **Include** with q05(b). |
| 26 | Algebraic manipulation: literal, term, minimization | Exclude: definitions. |
| 27 | **Example 2.1** (five literal minimizations) | **Include** → q06. |
| 28 | Complement of a function; derivation (A + B + C)′ = A′B′C′; generalizations | Exclude: derivation of the general n-variable DeMorgan identity, not a specific function. The skill is examined by q07, q08 and q12. |
| 29 | **Example 2.2** | **Include** → q07. |
| 30 | **Example 2.3** | **Include** → q08. |
| 31 | **Practice Exercise 2.3** with instructor note that the two AND labels must be swapped | **Include** → q09, following the note. |
| 32 | **Practice Exercise 2.4**, Figure PE2.4, instructor note replacing the drawn XOR by NOR | **Include** → q10, following the note. |
| 33 | **Practice Exercise 2.5** (truth table of Figure PE2.4), **2.6** (complement) | **Include** → q11, q12. |
| 34 | Minterm/maxterm definitions; two-variable minterm list | Exclude: definitions. |
| 35 | Table 2.3, minterms and maxterms of three variables | Exclude: lookup table. |
| 36 | Table 2.4 with f₁ = m₁ + m₄ + m₇, f₂ = m₃ + m₅ + m₆ + m₇ | **Include** (worked calculation) → q13(a). |
| 37 | f₁′ as a sum of minterms; f₁, f₂ as products of maxterms | **Include** (worked calculation) → q13(b)(c). |
| 38 | **Example 2.4** with Table 2.5 | **Include** → q14. |
| 39 | **Example 2.5** | **Include** → q15. |
| 40 | Conversion between canonical forms worked for F(A,B,C) = Σ(1,4,5,6,7) | **Include** (worked calculation) → q16. The general rules on the same slide are not separate questions. |
| 41 | **Example** F = xy + x′z with Table 2.6 | **Include** → q17. |
| 42 | **Practice Exercises 2.7, 2.8, 2.9** | **Include** → q18, q19, q20. |
| 43 | Standard forms: SOP example F₁, POS example F₂, worked F₃ = AB + C(D + E) = AB + CD + CE | **Include F₃** (worked calculation) → **q26**. F₁ and F₂ only illustrate the SOP/POS definitions, and their slide text disagrees with Figure 2.3 (see source errors), so they are excluded. |
| 44 | Figure 2.3, two-level implementations of F₁ and F₂ | Exclude: figure illustrating the slide-43 definitions; it also disagrees with the slide-43 text. |
| 45 | Figure 2.4, three- and two-level implementations of F₃ | **Include** with q26(b). |
| 46 | **Practice Exercises 2.10, 2.11, 2.12** (prompt) | **Include** → q21, q22, q23. |
| 47 | **Practice Exercise 2.12** answer diagram with instructor note ACD′ → ACD | **Include** with q23, following the note. |
| 48 | Other logic operations; Table 2.7, the 16 two-variable functions | Exclude: lookup table. |
| 49 | Table 2.8, expressions and names of the 16 functions | Exclude: lookup table. |
| 50–51 | Digital logic gates; which of the 16 functions are used as gates | Exclude: discussion. |
| 52–53 | Figure 2.5, gate symbols, functions and truth tables | Exclude: gate definitions (Chapter 1 excluded standard gate symbols). |
| 54 | Extension to multiple inputs; associativity of AND/OR | Exclude: general identities. |
| 55 | Figure 2.6, NOR non-associativity, with a label correction note | Exclude: figure demonstrating a general operator property, not a labelled Example; its results appear only inside the figure. The label error is recorded below. |
| 56 | Figure 2.7, multiple-input and cascaded NAND/NOR gates | Exclude: figure illustrating gate types without an Example caption; its only worked result, [(ABC)′(DE)′]′ = ABC + DE, appears inside the figure, not in the slide text. NAND/NOR implementation is examined by Practice Exercise 2.14 (q25). |
| 57 | Figure 2.8, three-input XOR gate and truth table | Exclude: gate definition. |
| 58–59 | Positive and negative logic; Figures 2.9 and 2.10 | Exclude: definitions and figure demonstration. |
| 60 | **Practice Exercise 2.13** with answer diagram | **Include** → q24. |
| 61 | **Practice Exercise 2.14** | **Include** → q25. |
| 62–65 | Integrated circuits, logic families, characteristics, CAD | Exclude: technology overview. |
| 66 | Web search topics | Exclude: terminology list. |

## Complete source-to-question crosswalk

“Same” means the canonical result agrees with the slide. Full learner prompts, solutions, tags and scored rubrics are in the quiz.

| Slide | Source label | Question | Source prompt / data | Canonical answer | Comparison and final action |
| --- | --- | --- | --- | --- | --- |
| 5–6 | Examples: identity element, inverse | q01 | Integers I with +; natural numbers N | Identity 0; N has none because 0 ∉ N; inverse of a is −a | Same; 4 points. |
| 20 | Examples: operator precedence | q02 | xy′ + z; (xy + z)′ | NOT → AND → OR; inside parentheses AND → OR, then NOT | Same order as the slide's precedence list; 2 points. |
| 21 | Practice Exercise 2.1 | q03 | Simplify x′y′z + xyz + x′yz + xy′z | z | Same; 4 points. |
| 21 | Practice Exercise 2.2 | q04 | Truth table of x′y′z | 1 only at x = 0, y = 0, z = 1 | Same; 3 points. |
| 22–25 | Examples F₁, F₂; Table 2.2; Figures 2.1/2.2 | q05 | F₁ = x + y′z, F₂ = x′y′z + x′yz + xy′ | F₁ column 0,1,0,0,1,1,1,1; F₂ column 0,1,0,1,1,1,0,0; F₂ = xy′ + x′z; inverter, AND(y′, z), OR(x, y′z) | Same; Figure 2.1 is described in text; 8 points. |
| 27 | Example 2.1 | q06 | Five functions to minimum literals | xy; x + y; x; xy + x′z; (x + y)(x′ + z) | Same; 10 points. |
| 29 | Example 2.2 | q07 | Complement F₁ = x′yz′ + x′y′z, F₂ = x(y′z′ + yz) | (x + y′ + z)(x + y + z′); x′ + yz′ + y′z | Same; 6 points. |
| 30 | Example 2.3 | q08 | Same functions by dual + complemented literals | Duals (x′ + y + z′)(x′ + y′ + z) and x + (y′ + z′)(y + z); complements as in q07 | Same; 6 points. |
| 31 | Practice Exercise 2.3 | q09 | Logic diagram of F = x′y + xy′ | Inverters; AND(x′, y) → x′y; AND(x, y′) → xy′; OR → F | Slide diagram labels are swapped (its own note). Labels must match each AND's inputs; 4 points. |
| 32 | Practice Exercise 2.4 | q10 | Figure PE2.4 described in text, final gate corrected to NOR | (x′y + xy′)′ = xy + x′y′ | Same as the slide Answer after its note; 4 points. |
| 33 | Practice Exercise 2.5 | q11 | Truth table of Figure PE2.4 | F = 1, 0, 0, 1 | Same; 3 points. |
| 33 | Practice Exercise 2.6 | q12 | Complement of A′BC′ + A′B′C | A + BC + B′C′ | Same; 4 points. |
| 36–37 | Table 2.4 worked forms | q13 | Table 2.4 f₁, f₂ | f₁ = Σ(1,4,7) = Π(0,2,3,5,6); f₂ = Σ(3,5,6,7) = Π(0,1,2,4); f₁′ = Σ(0,2,3,5,6) | Same; 6 points. |
| 38 | Example 2.4 | q14 | A + B′C as sum of minterms | Σ(1,4,5,6,7) | Same; 5 points. |
| 39 | Example 2.5 | q15 | xy + x′z as product of maxterms | Π(0,2,4,5) | Same; 5 points. |
| 40 | Worked conversion | q16 | F(A,B,C) = Σ(1,4,5,6,7) | F′ = Σ(0,2,3); F = Π(0,2,3) = (A + B + C)(A + B′ + C)(A + B′ + C′) | Same; 3 points. |
| 41 | Example | q17 | F = xy + x′z, Table 2.6 | Σ(1,3,6,7); Π(0,2,4,5); F′ = Σ(0,2,4,5) | Same; 4 points. |
| 42 | Practice Exercise 2.7 | q18 | Product of maxterms for Σ(1,2,3,5,7) | F′ = Σ(0,4,6); **F = (x + y + z)(x′ + y + z)(x′ + y′ + z)** | Slide answer prints (x′ + y′ + z′) = M₇ as the last factor. Corrected to M₆ and explained in the solution; 4 points. |
| 42 | Practice Exercise 2.8 | q19 | Sum of minterms for Π(1,3,4,6) | Σ(0,2,5,7) = x′y′z′ + x′yz′ + xy′z + xyz | Same; 4 points. |
| 42 | Practice Exercise 2.9 | q20 | Minterms and maxterms of the given table | Σ(1,3,4,6) = Π(0,2,5,7) | Same; 4 points. |
| 43, 45 | Worked F₃; Figure 2.4 | **q26** | F₃ = AB + C(D + E) | AB + CD + CE; Figure 2.4(a) three-level (two AND, two OR); Figure 2.4(b) two-level (three AND, one 3-input OR) | **Added**: omitted worked calculation under the Chapter 1 standard; 4 points. |
| 46 | Practice Exercise 2.10 | q21 | A + B′C + AD as sum of minterms | Σ(2,3,8,9,10,11,12,13,14,15) | Same; 4 points. |
| 46 | Practice Exercise 2.11 | q22 | x′y + xz as product of maxterms | **Π(0,1,4,6) = (x + y + z)(x + y + z′)(x′ + y + z)(x′ + y′ + z)** | Slide answer contains (x′ + y + z′) = M₅ and omits M₁ = (x + y + z′). Corrected and explained; 4 points. |
| 46–47 | Practice Exercise 2.12 | q23 | Two-level diagram for BC′ + AB + ACD | AND(B, C′), AND(A, B), AND(A, C, D) → 3-input OR | Slide labels the third AND output ACD′ although its inputs are A, C, D (its own note). Corrected label ACD; 4 points. |
| 60 | Practice Exercise 2.13 | q24 | Diagram of D + BC + (D + C′)(A′ + C) without simplification | OR(D, AND(B, C), AND(OR(D, C′), OR(A′, C))) | Same as the slide diagram; 5 points. |
| 61 | Practice Exercise 2.14 | q25 | xz + x′z′ + x′y with NAND / NOR and inverters | F = [(xz)′(x′z′)′(x′y)′]′; F′ = (x′ + z′)(x + z)(x + y′), F = (x′ + z′)′ + (x + z)′ + (x + y′)′ | Same expressions; gate descriptions added; 8 points. |

## Circuit descriptions checked against the source wiring

LearnForge cannot show images, so every source diagram used by a question is described in text. Each description was compared with the 4000-pixel export of its slide (24, 31, 32, 45, 47, 60), following each input wire to its junction dot:

- **Figure 2.1 (slide 24), q05(c):** x goes straight to the OR; y passes an inverter; y′ and z feed a 2-input AND whose output is the second OR input.
- **Practice Exercise 2.3 (slide 31), q09:** the upper AND's inputs have junction dots on the x line and on the y′ (inverter) line, so it computes xy′, while its label reads x′y; the lower AND's dots are on the x′ and y lines (x′y, labelled xy′). The slide's note “這兩組符號標示必須對調” matches this. q09's solution says so, and its answer and rubric require labels that match the inputs.
- **Figure PE2.4 (slide 32), q10/q11:** upper AND dots on x and y′ (labelled xy′), lower AND dots on x′ and y (labelled x′y), both correct; the final gate is drawn as XOR and the slide's note replaces it with NOR. q10's description lists exactly these connections with the corrected NOR. With the uncorrected XOR the circuit would compute x′y + xy′, which contradicts the slide's own Answer.
- **Figure 2.4 (slide 45), q26:** (a) AND(A, B); OR(D, E); AND(C, D + E); OR of the two AND outputs. (b) AND(A, B), AND(C, D), AND(C, E) into a 3-input OR.
- **Practice Exercise 2.12 (slide 47), q23:** junction dots give AND(B, C′), AND(A, B) and AND(A, C, D). The third output label ACD′ contradicts the uncomplemented D input; the slide's note corrects it to ACD. Inverters for A, B and D are drawn but unused.
- **Practice Exercise 2.13 (slide 60), q24:** D goes straight to the output OR; AND(B, C); OR(D, C′); OR(A′, C); AND of the two ORs; 3-input OR. Inverters for B and D are drawn but unused.

## Exhaustive verification and source discrepancies

An independent script enumerates every input combination (8 rows for three variables, 16 for four, 32 for q26's five) and compares each canonical expression with a reference typed from the slide problem statement, not from the quiz. Every expression it checks must appear verbatim in the quiz section it is taken from. It also proves the minimum-literal claims of Example 2.1 by enumerating every AND/OR formula over literals with fewer literals. Result: **191 checks, 0 failures**, covering every Boolean answer, every printed truth table (q04, q05, q11, q17 and the prompt tables of q13 and q20), every Σ/Π index set, the q25 alternative NOR form (x′ + z)(x + y + z′), and per-question rubric sums. q01 (integer identity/inverse) and q02 (precedence order) are not Boolean-valued and were checked by reading.

Source answer errors (corrected in the quiz and explained in the solution):

- **Practice Exercise 2.7 (slide 42):** the printed product (x + y + z)(x′ + y + z)(x′ + y′ + z′) has zeros at rows 0, 4 and 7, but F(1,1,1) = 1 because 7 ∈ Σ(1,2,3,5,7). The correct factor is M₆ = x′ + y′ + z; the printed F′ = Σ(0,4,6) is right.
- **Practice Exercise 2.11 (slide 46):** the printed product (x + y + z)(x′ + y′ + z)(x′ + y + z)(x′ + y + z′) is Π(0,4,5,6); x′y + xz equals 1 at row 5 (x = 1, z = 1) and 0 at row 1, so the correct product is Π(0,1,4,6).

Diagram errors already annotated by the instructor on the slides (questions follow the annotation):

- Slide 31: the two AND output labels are swapped.
- Slide 32: the final gate symbol is XOR but must be NOR.
- Slide 47: the third AND output label ACD′ must be ACD.

Errors on excluded slides:

- Slide 9, postulate 5 reads “For every element x′ ∈ B, there exists an element x ∈ B (called the complement of x)”; the roles are inverted (for every x there is a complement x′).
- Slides 43/44: the slide text gives F₁ = y′ + zy + x′yz′ and F₂ = x(y′ + z)(x′ + y + z′ + w), while Figure 2.3 implements y′ + x′yz′ + xy (an AND of x and y) and x(y′ + z)(x′ + y + z) (an OR of x′, y, z, with neither z′ nor w). No unambiguous canonical problem can be formed without choosing one version, which is part of the reason these definitional illustrations are excluded.
- Slide 55, Figure 2.6: the third input of the upper circuit is labelled y; the instructor note corrects it to z, which matches the printed result (x ↓ y) ↓ z = (x + y)z′.
- Cosmetic wording noticed during inspection (not an exhaustive proofreading list): “vise versa” (slide 3), the garbled “The complement of x′ is x is also (x′)′” (slide 17), “simplfy” (slide 21, rewritten in Chinese in q03), “con be combined” and “also call” (slide 34), “An Boolean function” (slide 36, source of q13; no effect on its content), “built the truth table first” (slide 38), “ouput” (slide 64), “Automatic the design process” (slide 65). Slide 43 repeats “= AB + C(D + E)” once before the result; that is redundancy, not an error.

## Draft review outcome

Independently checked draft facts that hold: all 14 Practice Exercises and Examples 2.1–2.5 are present once each; the unnumbered Examples on slides 5–6, 20, 22–25 and 41 and the worked material on slides 36–37 and 40 are included; the PE 2.7 and PE 2.11 corrections and the PE 2.3, 2.4 and 2.12 annotations are applied correctly; the circuit descriptions match the source wiring; every answer agrees with exhaustive enumeration.

Change made in this audit: slide 43's worked F₃ calculation with Figure 2.4 (slide 45) meets the Chapter 1 inclusion standard and was missing. It is added as q26 (4 points, slide order between q20 and q21), the description now names the worked examples (「Example、具體 worked examples 與 Practice Exercise」) and two-level and multi-level implementation, the quiz-level tags gain `two-level-implementation` and `multi-level-implementation`, and estimatedMinutes rises from 110 to 115. The draft's other exclusions (13, 16–19, 28, 44, 48–49, 52–59) are confirmed with the reasons above. The meanings of q01–q25 are unchanged. One rendering-only edit followed the local browser check (Stage 2): q21's inline Σ(2,3,8,…,15) is a comma list that KaTeX cannot wrap, so it scrolled inside its box in the narrow answer column (9 px at 1440 and up to 33 px at 345). Its answer and rubric now carry `\allowbreak` hints between the index groups and drop the trailing 「。」; the index set is unchanged.

## Schema, rubric and rendering boundary

Every question is a calculation question with free text and a 1200 × 900 handwriting workspace, a nonempty answer and solution, and a scored rubric that sums to its points; the 26 rubrics total 122 points. Prompts supply every function, table and circuit connection needed, so no question depends on an unavailable image. Question tags distinguish postulates, simplification, complements/duality, canonical forms, standard forms and multi-level, two-level and NAND/NOR implementation.

A Markdown AST using `remark-parse`/`remark-math` found **532** math nodes; each passed KaTeX with `throwOnError: true` and `strict: 'error'`, and no text node contains an unmatched dollar sign. `npm run check:quizzes` validates the file (16 bundled revisions, 331 questions in all revisions). These are source and serialization checks, not claims of browser or production rendering; generated-context validation, full tests and UI evidence are recorded in later release stages.
