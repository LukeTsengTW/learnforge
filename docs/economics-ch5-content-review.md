# Economics chapter 5 content audit

Source: user-supplied p11.JPEG, p12.JPEG, p13.JPEG, printed pages 108–110 of 《經濟學：探索生活經濟的新世界》. Source draft commit: `1ee6f4b1ef90f8d51e1bb5bd760efbc788a996a8`. Review date: 2026-10-21 Asia/Taipei. This is the author's derivation; independent reviewer acceptance is recorded in delivery evidence.

## Historical boundary

Quiz family id remains `economics-ch1-4-exercises`. All first 41 complete question blocks of revision 2 match revision 1 exactly after normalizing line endings. Their normalized block SHA-256 is `0be706cc4b1f82fe0173728889c74ac6101b924ba42f3a9a5f551ba284f34844`: normalize CRLF/bare CR to LF, match each complete block from its `:::question` header through its `:::end` line (preserving internal bytes), discard inter-block gaps, join with one LF and no final newline. No previous question, option, solution, tag, formula or answer is edited. Revision 1's eventual current flag change is metadata only.

## All 11 new questions

| Question | Printed key | Current key | Independent conclusion and editorial work |
| --- | --- | --- | --- |
| ch5-q1 | d | d | Correct Pareto's Chinese name to 帕累托. Competition alone does not necessarily cause failure; option d now explicitly says 本身必然. Efficiency benchmark requires the usual absence of other distortions. |
| ch5-q2 | b | b | Positive unpriced marginal harm from production gives MSC=MPC+MEC>MPC. Explicitly exclude consumption externalities so benefit-curve alternatives do not compete. |
| ch5-q3 | d | c | Third-party unpriced harm is required. Original c (patient's drug allergy) is also not inherently an externality, so retain the draft's disclosed deletion and map original d→current c. Explicitly state third-party harm for pollution/dog noise, and no assumed noise from mere stereo purchase. Three distinct options, one answer. |
| ch5-q4 | d | d | Competitive unregulated production is excessive under the stated single negative production externality. Calibrated per-unit Pigouvian tax equals MEC at the interior social optimum. Subsidizing extra production/consumption worsens overproduction; arbitrary tax amounts need not be optimal. |
| ch5-q5 | b | b | Preserve the draft's narrow definition of b as unchanged transactions without any internalization mechanism. Property rights/bargaining, reduction subsidies and taxes can help under explicit ideal conditions. A subsidy s on verified reductions from a fixed baseline makes one more unit of output forgo s; fixed firms and proportional pollution are stated. Disclose entry, delayed exit, baseline gaming and funding limits; do not reject market-oriented policies generally. |
| ch5-q6 | a | a | 寓禁於徵 identifies a tax that makes the polluting action more costly. Direct regulation is a different instrument; rights/subsidies are not the act of levying the tax. |
| ch5-q7 | a | a | Narrow the stem to the core Coase private-bargaining conclusion. Require enforceable defined rights, information, all affected parties and zero transaction costs. Tax-incidence alternatives c/d may be true under fixed other conditions; explain why they do not answer this question instead of calling them false. Nonzero costs do not guarantee exact efficiency. |
| ch5-q8 | c | c | Common resources are nonexcludable and rival; another person's use reduces quantity or quality available. Retain textbook term 互斥性 (rivalry). Other three feature combinations describe different goods. |
| ch5-q9 | c | c | Retain the already disclosed idealized system-wide fire-protection model: nonexclusion, no capacity competition or individual refusal. Remove the solution's approximate “not significantly” phrasing. Actual dispatched services can differ; government provision alone does not imply a public good. |
| ch5-q10 | c | c | Open access without effective exclusion plus congestion makes a common resource. Free alone is insufficient. Repair the solution's counterfactual: effective exclusion plus nonrival use is club-good territory; effective exclusion with rivalry is private-good territory. |
| ch5-q11 | b | b | Compare strategically reported WTP with true WTP for the same quantity and monetary-equivalent benefit. Explicitly condition on underreporting; free-rider incentive does not make every person underreport and does not redefine preferences. Replace ambiguous underscore blanks with numbered blanks. |

Source sequence: `d,b,d,d,b,a,a,c,c,c,b`; application sequence: `d,b,c,d,b,a,a,c,c,c,b`. Only q3's letter differs due to the documented deletion/reletter, not a change in the selected surviving proposition. No new numerical data are invented. All eleven remain one-point single-choice questions with stable ids and appropriate concept tags.

## Primary references and scope

- [OpenStax, Principles of Microeconomics 3e, 12.3](https://openstax.org/books/principles-microeconomics-3e/pages/12-3-market-oriented-environmental-tools): pollution charges, marketable permits and enforceable property rights are market-oriented instruments; bargaining has practical limits. This supports the distinction between unchanged unpriced transactions and actual internalization tools. The tax calibration and fixed-baseline subsidy argument above are explicit model derivations.
- [OpenStax, 13.3 Public Goods](https://openstax.org/books/principles-microeconomics-3e/pages/13-3-public-goods): public goods require nonexclusion and nonrivalry; common resources combine nonexclusion with rivalry; free riding concerns benefiting while others pay. Fire-system and Wi-Fi classifications are conditional applications of those criteria, not universal empirical claims.
- [OpenStax, 5.3 Elasticity and Pricing](https://openstax.org/books/principles-microeconomics-3e/pages/5-3-elasticity-and-pricing): relative elasticities determine tax incidence. The content of c/d in q7 can hold without being the Coase conclusion.
- [US EPA, Economic Incentives](https://www.epa.gov/environmental-economics/economic-incentives): subsidies can motivate reductions and also induce entry. Primary page fetched successfully with the system CA store (HTTP 200); initial default-CA fetch failed certificate verification. No TLS verification was disabled.

These references were opened and their relevant content inspected; search snippets alone were not treated as the final theoretical evidence. The audit distinguishes source text/key, editorial assumptions and model-based inferences. It does not claim real-world policy effectiveness or a universal classification of actual fire services.
