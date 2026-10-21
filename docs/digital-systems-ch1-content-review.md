# Digital systems Chapter 1 source audit

Source: user-supplied `6Ed Chapter_01.pptx`, 50 slides, SHA256 `42f4bc1978d113fdf19dbea4bcde70b6ac58e45775cab521c779031ef82b24a5`. Source draft commit: `a68e9112869626f4803aba331ee0a897b69f2cd8`. Review date: 2026-10-21 Asia/Taipei. Slide numbers below are actual presentation order, including its title slide. Document text is teaching material, not operational instructions.

The original PPTX was opened read-only in Microsoft PowerPoint and exported at 1600 × 1108 pixels, preserving slide aspect ratio. All 50 rendered slides were inspected through 13 contact sheets; slides 5, 32 and 45 were additionally inspected at full resolution. ZIP/XML text and picture inventory supplemented the rendered evidence. The source hash was unchanged after export. Private renders, extraction, arithmetic checks and reviewer reports live under ignored `output/release/digital-systems-ch1/`; the source deck and temporary images are not publication assets.

## Inventory and inclusion decisions

Final publication: `digital-systems-ch1-textbook`, revision 1, current, title `【課本題目】數位系統導論 - Chapter 1`, subject `數位系統導論`: **42 questions, 206 points, estimated 170 minutes**. The draft had 39 questions /188 points /160 minutes. Three omitted source groups add 6+8+4 points and approximately ten minutes. No existing question was removed. IDs q01–q39 retain their meanings; new q40/q41/q42 occur in source order at slides 9/17/45, so IDs are intentionally not numerically ordered in the file.

- Eight numbered Examples 1.1–1.8, each represented once. Example 1.1 spans slides 11–12; Example 1.3 spans 13–14. References back to an Example are not additional questions.
- Eighteen unnumbered Example blocks/captions, including the four base-specific blocks on slide 5, two radix-complement blocks on slide 20, Figure 1.2's explicit Example caption on slide 45, and the binary-signal Example on slide 48. Together with the eight numbered Examples these are 26 source Example units mapped to 22 questions: the four slide-5 blocks share q02(a–d), and the two slide-20 blocks share q14(a–d), without omitting any input.
- Seventeen distinct Practice Exercises: 1.1–1.8, 1.10–1.16, 1.18, and the source's literal **1.19** on slide 27. No Exercise 1.9 or 1.17 is present in this deck; none is invented or silently renumbered. Slide 27's `1.19` is suspicious in sequence but its literal label is preserved as q23.
- Three additional concrete worked-example groups: slide 9's complete addition/subtraction/multiplication vertical calculations (q40), slide 17's four boxed numerical grouping conversions (q41), and slide 34's BCD Addition vertical calculations (q34). Each presents actual operands, procedure and numerical result, rather than a general lookup table. The same inclusion criterion is applied to all three. Slide 34 remains included: its 4+5, 4+8 and 8+9 corrections are solved calculations adjoining the explicit Example, not a table of arbitrary code definitions.

Excluded after visual inspection: slide 1 objectives; 2–3 definitions; slide 4's general positional formula outside its Example; 6's powers discussion; 7's Table 1.1 outside its exercise; 8 arithmetic topic list; 10 base/digit table; 12/14 continuation material already attached to its Example; 15's recombinations of Examples 1.1–1.4 already covered by their components; 16 base lookup Table 1.2; 18/20/21 generic complement rules; 24's reference to Example 1.7; 27/29 signed-number definitions/Table 1.3; 30/31 general arithmetic rules; 33 BCD definitions/Table 1.4 (including its illustrative 396 sentence); 36–38 code lookup Tables 1.5–1.7; 39–40 ASCII definitions/properties; 42 parity theory; 43–44 register definitions and generic JOHN transfer illustration; 46–47 logic definitions/truth Table 1.8; 49–50 standard gate symbols and waveforms. These are not new labelled exercise problems or standalone worked numerical calculations. Figure 1.2 on slide 45, in contrast, explicitly says “Example of binary information processing” and supplies a concrete numerical addition, so it is included.

## Complete source-to-question crosswalk

“Same” means the numerical canonical result agrees, allowing grouping/leading-zero typography. “Fix” distinguishes source error from draft defect. Each row's source prompt identifies all required data; full learner prompts, solutions, tags and scored rubrics are in the quiz.

| Slide | Source label | Question | Source prompt / data | Canonical answer | Comparison and final action |
| --- | --- | --- | --- | --- | --- |
| 4 | Example: decimal | q01 | Expand 7,329 by decimal place value | 7×10³+3×10²+2×10+9 | Same; retain 4 points. |
| 5 | Example: Base-2 | q02(a) | 11010.11₂ → decimal | 26.75 | Same; 2 points. |
| 5 | Example: Base-5 | q02(b) | 4021.2₅ → decimal | **511.4** | Source and draft say 511.5; fix answer, solution and rubric; explicitly note source typo. |
| 5 | Example: Base-8 | q02(c) | 127.4₈ → decimal | 87.5 | Source answer agrees; its full expansion is 1×8³+2×8²+1×8+7+4×8⁻¹=655.5, with an extra term and wrong powers. Replace the whole expansion by 1×8²+2×8+7+4×8⁻¹=87.5 and disclose the malformed source expression. |
| 5 | Example: Base-16 | q02(d) | B65F₁₆ → decimal | 46,687 | Same; all four q02 parts total 8 points. |
| 6 | Example: Base-2 | q03 | 110101₂ → decimal | 53 | Same; retain 3 points. |
| 7 | Practice Exercise 1.1 | q04 | 1×2⁴+0×2³+1×2²+0×2+1 | 21 | Same; retain 3 points. |
| 9 | Worked addition/subtraction/multiplication | q40 | 101101+100111; 101101−100111; 1011×101 (binary) | 1010100; 000110; 110111 | Same; add omitted group, 2 points per operation, 6 total. |
| 11–12 | Example 1.1 | q05 | 41₁₀ → binary | 101001₂ | Same; one question across two slides; 4 points. |
| 13 | Example 1.2 | q06 | 153₁₀ → octal | 231₈ | Same; 4 points. |
| 13–14 | Example 1.3 | q07 | 0.6875₁₀ → binary | 0.1011₂ exactly | Same; one question across two slides; 4 points. |
| 15 | Example 1.4 | q08 | 0.513₁₀ → octal | Prefix 0.406517…₈ | Six digits are a truncation, not a terminating expansion. Source's primary answer has ellipsis; its combined 153.513 line omits it. Preserve continuation and explain; 4 points. |
| 15 | Practice Exercise 1.2 | q09 | 117.23₁₀ → octal | Prefix 165.1656…₈ | Source prints finite equality; explicitly require four-digit truncation and nontermination, not rounding; 4 points. |
| 17 | Four boxed worked grouping conversions | q41 | Binary 10 110 001 101 011.111 100 000 110 → octal; binary 10 1100 0110 1011.1111 0010 → hex; octal 673.124 → binary; hex 306.D → binary | 26153.7406₈; 2C6B.F2₁₆; 110 111 011.001 010 100₂; 0011 0000 0110.1101₂ | Same; add omitted group, 2 points per part, 8 total. |
| 18 | Example: 9's complement | q10 | Six decimal digits: 546700; 012398 | 453299; 987601 | Same; retain leading-zero width; 4 points. |
| 19 | Example: 1's complement | q11 | Seven bits: 1011000; 0101101 | 0100111; 1010010 | Same; 4 points. |
| 19 | Practice Exercise 1.3 | q12 | 135₁₀ → binary | **10000111₂** | Source 11100001₂ is 225, not 135. Keep corrected canonical and explicit source typo note; 3 points. |
| 19 | Practice Exercise 1.4 | q13 | 135₁₀ → octal | 207₈ | Same; 3 points. |
| 20 | Example: Base-10 | q14(a–b) | Six decimal digits: 10's complement of 012398; 246700 | 987602; 753300 | Same. |
| 20 | Second Example: Base-10 (heading typo) | q14(c–d) | Seven bits: 2's complement of 1101100; 0110111 | 0010100; 1001001 | Numeric content is binary despite repeated Base-10 heading. Preserve binary interpretation; q14 totals 8 points. |
| 20 | Practice Exercise 1.5 | q15 | Three decimal digits: 9's/10's complement of 135 | 864; 865 | Same; explicitly state three-digit width; 4 points. |
| 22 | Example 1.5 | q16 | Five-digit 10's-complement subtraction 72532−03250 | +69282 | Same; discard end carry from 169282; 6 points. |
| 22 | Example 1.6 | q17 | Five-digit 10's-complement subtraction 03250−72532 | −69282 | Same; no carry, complement 30718 to recover magnitude; 6 points. |
| 23 | Example 1.7 | q18 | Unsigned seven-bit X=1010100, Y=1000011; both subtractions via 2's complement | X−Y=0010001₂; Y−X=−0010001₂ | Same; explicitly distinguish unsigned operands from signed representation; 8 points. |
| 24 | Example 1.8 | q19 | Same X/Y via 1's complement | +0010001₂; −0010001₂ | Same; end-around carry is added back, not discarded; 8 points. |
| 25 | Practice Exercise 1.6 | q20 | Unsigned seven-bit X=1101010 (106), Y=0101011 (43); both differences via 2's complement | +0111111₂=+63; −0111111₂=−63 | Same; 8 points. |
| 26 | Practice Exercise 1.7 | q21 | Same 106/43 via 1's complement | +0111111₂=+63; −0111111₂=−63 | Agrees with translator's corrected slide; keep correction, do not reintroduce original book errors; 8 points. |
| 27 | Example: three signed encodings | q22 | Signed-magnitude 10001001; derive decimal and three eight-bit encodings | −9; SM 10001001; 1's 11110110; 2's 11110111 | Same answer. Draft lacked any given bit string; add its source signed-magnitude datum to make prompt answerable; 6 points. |
| 27 | Practice Exercise **1.19** | q23 | Unsigned 11001 → decimal | 25 | Same; preserve literal source label, flag sequence anomaly; 2 points. |
| 27 | Practice Exercise 1.8 | q24 | Which signed-number bit represents the sign? | Leftmost bit | Same; text input without drawing is appropriate; 2 points. |
| 28 | Practice Exercise 1.10 | q25 | Signed-magnitude 10011 → decimal | −3 | Same; five-bit width, not 8-bit reinterpretation; 3 points. |
| 28 | Practice Exercise 1.11 | q26 | Negate signed-magnitude 01100 at same width | 11100 | Same; flip sign only; 3 points. |
| 28 | Practice Exercise 1.12 | q27 | Represent −5 with 8 bits in three signed systems | 10000101; 11111010; 11111011 | Same; 6 points. |
| 28 | Practice Exercise 1.13 | q28 | Eight-bit signed-2's-complement negation of +7 | +7=00000111; −7=11111001 | Same; 4 points. |
| 30 | Example: signed addition | q29 | ±6 plus ±13 in four sign combinations | +19=00010011; +7=00000111; −7=11111001; −19=11101101 | Same; no signed overflow; 8 points. |
| 31 | Example: signed subtraction | q30 | (−6)−(−13) in 8-bit 2's complement | +7=00000111 | Same; fix malformed draft math delimiters in solution; 4 points. |
| 32 | Practice Exercise 1.14 | q31 | ±4 plus ±11 in four sign combinations | **+15=00001111; +7=00000111; −7=11111001; −15=11110001** | Source (b) operand/result and (d) result typos; retain independently corrected answers, give precise note, fix malformed draft math delimiters; 8 points. |
| 32 | Practice Exercise 1.15 | q32 | 84₁₀ → BCD | 1000 0100 | Same; distinguish BCD from ordinary binary; 3 points. |
| 34 | Example: 185 | q33 | Decimal 185 → BCD and ordinary binary | BCD 0001 1000 0101; binary 10111001 | Same; 4 points. |
| 34 | BCD Addition worked examples | q34 | 4+5; 4+8; 8+9 | 1001; 0001 0010; 0001 0111 (BCD) | Retain concrete solved columns; pad leading decimal digit to a 4-bit BCD group; 6 points. |
| 34 | Practice Exercise 1.16 | q35 | BCD sum 4+6 | **0001 0000** | Source 10000 is an unpadded abbreviation. Retain standard grouped BCD, explain source abbreviation; 3 points. |
| 35 | Example: BCD addition | q36 | 184+576 | 760; BCD 0111 0110 0000 | Same; expand units/tens correction and carry explanation rather than merely repeat source result; 6 points. |
| 41 | Example: ASCII parity | q37 | Left-prefix parity to A=1000001 and T=1010100, even/odd | A even 01000001, odd 11000001; T even 11010100, odd 01010100 | Same; 2/3 original ones respectively; 6 points. |
| 41 | Practice Exercise 1.18 | q38 | Even parity bit for data A=0101100 | 1 | Same; A is a data label here, not an assertion that 0101100 is ASCII 'A'; 2 points. |
| 45 | Figure 1.2: Example of binary information processing | q42 | Ten-bit unsigned R1=0001000010, R2=0011100001; add in R3, copy to memory Sum | 66+225=291; R3 and final Sum=0100100011 | Same; add omitted explicitly captioned Example. Preserve actual **10-bit** image width; 4 points. |
| 48 | Example of binary signals | q39 | Diagram: axis 0–3 V; two valid 1-V bands at bottom/top; transition between | Logic 0: 0≤V≤1 V; logic 1: 2≤V≤3 V; transition: 1<V<2 V | Same graphical limits; provide a self-contained textual diagram description. Assign endpoints to valid bands so transition does not overlap them; these are this diagram's conditions; 4 points. |

## Exact arithmetic and source discrepancies

Independent local calculation uses Python integers and `Fraction`, not source answers as an oracle. All 42 questions' canonical tokens and rubric sums were checked. Examples of the saved derivations:

- Base 5: 4×125+2×5+1+2/5 = **2557/5 = 511.4**. Base 8's source expression 1×8³+2×8²+1×8+7+4×8⁻¹ evaluates to **655.5**, not 87.5; it has an extra integer term as well as wrong powers. The full correct expansion is 1×8²+2×8+7+4×8⁻¹=**87.5**. Source slide 5 contains both errors.
- 0.6875=11/16 terminates as 0.1011₂. For 0.513=513/1000, six octal digits are 406517 and the remaining multiplication state is 0.872. For 117.23, the integer is 165₈, the first four fractional digits are 1656 and remaining state is 0.08. Reduced denominators containing factor 5 cannot divide any power of 8. Neither finite prefix is an exact equality; no rounding is substituted for truncation.
- 135=128+4+2+1 → **10000111₂**. The source's 11100001₂ is **225**.
- Example 1.7/1.8: 84−67=17. With 7-bit arithmetic, 2's-complement forward raw sum is 10010001; 1's-complement forward raw sum is 10010000, requiring end-around carry. Reverse raw sums are 1101111 (2's) and 1101110 (1's), both representing a negative magnitude 0010001 under the unsigned-subtraction procedure.
- Practice 1.6/1.7: 106−43=63. The 2's-complement forward raw sum is 10111111 and reverse is 1000001; the 1's-complement forward raw sum is 10111110 and reverse is 1000000. Adding forward end-around carry yields 0111111; complementing the reverse yields magnitude 0111111. This independently confirms the translator's correction on slide 26.
- Practice 1.14 encodes +4/−4/+11/−11 as 00000100/11111100/00001011/11110101. Results are **00001111 /00000111 /11111001 /11110001**. Full-resolution slide 32 confirms (b) incorrectly prints +11 and +7 as 00001111, and (d) prints −15 as 11111001. (a) and (c) are already correct. The canonical solution identifies these exact errors.
- Slide 20 repeats “Example: Base-10” over a binary 2's-complement block. Mathematical operands and 7-bit width determine the binary interpretation; it is a heading error, not a decimal complement exercise. Slide 27's Exercise 1.19 sequence anomaly is preserved and disclosed rather than guessed away.
- BCD 4+6 first gives 1010, then +0110 → carry 1 /digit 0000; canonical **0001 0000** preserves both decimal digit groups. BCD 184+576: units 10 → corrected 0/carry 1, tens 8+7+1=16 → corrected 6/carry 1, hundreds 1+5+1=7 → **0111 0110 0000**.
- Parity is independently counted over the original seven data bits; A has two ones, T three, and practice data 0101100 three. Prefix bits preserve all original data bits.
- Source Figure 1.2 contains 10-bit words, not an assumed byte: 0001000010=66 and 0011100001=225; their sum 291 is **0100100011**. R3 is transferred to Sum unchanged.

Draft-only defects repaired: q02 propagated the base-5 source typo; q22 omitted its necessary datum; q30/q31 had unclosed inline-math delimiters around encoded operands; q39 required an unavailable diagram and had overlapping verbal transition boundaries; q09's multiplication explanation omitted explicit fractional remainders; q36's solution lacked the BCD correction steps its rubric expects. The original canonical fixes for Practice 1.3/1.14 and translator-corrected 1.7 remain intact.

## Schema, rubric and rendering boundary

Every question has a nonempty answer/solution and scored rubric summing to its points. All are calculation questions, using free text; 40 also declare 1200×900 handwriting workspaces. Conceptual sign-bit/voltage questions q24/q39 need no drawing. Tags distinguish unsigned subtraction, signed arithmetic, BCD, parity and register transfer. Self-contained prompts supply all needed numerical data and widths.

The independent arithmetic artifact confirms 42 unique IDs and 206 rubric points. A Markdown AST using `remark-parse`/`remark-math` found **267** math nodes; each passed KaTeX with `throwOnError:true` and `strict:'error'`, with no unmatched-dollar text. These are source/serialization checks, not claims of actual browser or production rendering. Formal parser/publication checks, generated-context validation, full tests and actual UI evidence are recorded in the later release stages. Stage 1 requires an independent reviewer to inspect the actual source renders and recompute the mathematical categories before acceptance.
