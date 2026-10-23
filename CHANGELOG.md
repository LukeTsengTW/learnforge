# Changelog

## 1.25.0 — Source-faithful digital systems revisions and quiz figures

- Publish Chapter 1 and Chapter 2 revision 2 using the slides' English wording, source derivations and concise English scored rubrics. Preserve metadata, IDs/order, 206/122 points and handwriting; archive revision 1 without changing its question content.
- Redraw ten SVGs from all 116 inspected source pages. Correct source numerical/complement/maxterm errors and the annotated PE 2.3/2.4/2.12 gates and labels. Keep correction explanations only in the content-review documents.
- Resolve same-quiz `figures/` references through Vite to hashed assets under `/learnforge/`. Reject external, traversal, malformed and missing references during quiz checks. External Author imports display a safe missing-image notice. AI receives canonical text only; provider, grading, raster and prompt behavior remain unchanged.
- Generate 68 new exact-revision contexts, retaining all 331 historical entries: 399 contexts, 18 revisions and 13 current quizzes. Full local and production acceptance evidence is recorded as it executes in [delivery](docs/v1.25.0-delivery.md).

- Local acceptance: 1,955 tests and all ten gates; actual Library/practice/Author at 1440/768/360/345 px, both chapters/all 68 questions and solutions, real typing/canvas input, no overflow or KaTeX/Markdown errors. Independent Stages 1–3 PASS.
- Executed production candidate snapshot (2026-10-23): `75e3015f714551098b8880cb77686f29427b4b4f` passed [CI 39897730135](https://github.com/LukeTsengTW/learnforge/actions/runs/39897730135), exactly six AST-derived context-dependent Edge deployments preserving JWT, [Pages 39898441865](https://github.com/LukeTsengTW/learnforge/actions/runs/39898441865), canonical smoke and four-width public browser acceptance. Ten SVG response byte hashes and both chapter source hashes match; no production learner-data writes or provider call. The final docs-only closure requires its own CI/Pages/smoke and Stage 4 audit; exact closure identity and publication are bound by the [v1.25.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.25.0) and [live manifest](https://luketsengtw.github.io/learnforge/release.json). Edge source readback is full for the seven available tutor files; the other five full downloads remain unverified due the CLI safe-extraction guard, without bypass.

## 1.24.0 — Digital systems Chapter 2 textbook exercises

- Add current `digital-systems-ch2-textbook/1`, 【課本題目】數位系統導論 - Chapter 2: 26 calculation questions / 122 points / 115 minutes, all with optional handwriting under the existing v4 contract. This complete new current quiz follows the minor-release convention of 1.23.0; no dependency or schema upgrade.
- Render and inspect all 66 source PPT slides in PowerPoint, with the circuit slides re-exported at 4000 px to trace every gate input. Examples 2.1–2.5, the unnumbered Examples on slides 5–6, 20, 22–25 and 41, the worked calculations on slides 36–37 and 40, and Practice Exercises 2.1–2.14 map to 25 questions; the omitted slide 43/45 worked example (F₃ = AB + C(D + E) = AB + CD + CE with its three- and two-level implementations) is added as q26 in slide order. See the [complete source crosswalk and exclusions](docs/digital-systems-ch2-content-review.md).
- Correct the slide answers of Practice Exercise 2.7 (Π(0,4,6) with M₆, not M₇) and 2.11 (Π(0,1,4,6): M₁ instead of M₅), and follow the slide annotations for Practice Exercises 2.3 (swapped AND labels), 2.4 (final gate NOR, not XOR) and 2.12 (ACD, not ACD′). Circuit diagrams are described in text and match the original wiring. Every Boolean answer is verified by exhaustive truth tables.
- Generate exactly 26 new canonical contexts (331 total), retaining all 305 prior serialized entries and all 15 prior source revisions unchanged. Update catalog and historical-cohort inventory tests while retaining their original assertions; add full-baseline/content/render/context regressions.
- Local integration: 128 test files / 1,918 tests; all 26 student/answer cards and 532 KaTeX formulas at 1440/768/360/345 px without overflow, real text and canvas input, navigation and fresh reload.
- Production-acceptance snapshot (2026-10-23, Asia/Taipei): runtime candidate `210c1d2a7ee246a09cb914af3b3a8423f016b357` passed its own [CI 39842765302](https://github.com/LukeTsengTW/learnforge/actions/runs/39842765302), exactly six context-dependent Edge updates, [Pages 39843330428](https://github.com/LukeTsengTW/learnforge/actions/runs/39843330428), canonical public smoke and four-width all-question browser acceptance. Stages 1–3 independently PASS; the production bundled source hash and fresh reload match the audited quiz, with no production errors or writes. Final docs-only closure SHA, CI/Pages, annotated tag and publication are recorded by the [v1.24.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.24.0) and [live manifest](https://luketsengtw.github.io/learnforge/release.json); see [delivery](docs/v1.24.0-delivery.md) for evidence and limits.

## 1.23.0 — Digital systems Chapter 1 textbook exercises

- Add current `digital-systems-ch1-textbook/1`, 【課本題目】數位系統導論 - Chapter 1: 42 calculation questions /206 points /170 minutes, including 40 optional handwriting questions under the existing v4 contract. This complete new current quiz follows the established minor-release convention; no dependency or schema upgrade.
- Render and inspect all 50 source PPT slides. Map 26 labelled Example units, three concrete worked groups and 17 Practice Exercises into 42 questions. Restore the omitted slide9 arithmetic, slide17 grouping conversions and slide45 10-bit register example; retain the slide34 BCD worked group. See the [complete source crosswalk and exclusions](docs/digital-systems-ch1-content-review.md).
- Correct source base-5 and octal-expansion errors, Practice1.3 (135→10000111) and Practice1.14 signed arithmetic. Preserve the Practice1.7 translator correction; explicitly distinguish nonterminating octal prefixes from equality, standard BCD0001 0000 from the slide abbreviation, unsigned complement widths and the voltage diagram's stated conditions.
- Generate exactly42 new canonical contexts (305 total), retaining all263 prior serialized entries and all14 prior source revisions unchanged. Update catalog and historical-cohort inventory tests while retaining their original assertions; add full-baseline/content/render/context regressions.
- Memoize the pure Markdown renderer by its text and inline props so answer updates do not reparse unchanged question formulas. This fixes the reproduced local App flow timing failure without changing its assertions, five-second timeout or parallelism. Controlled fresh-load typing profiles and actual source-edit/restore previews verify the performance change and content invalidation.
- Local integration: 127 test files / 1,911 tests, all ten release gates, all 42 student/answer cards and 267 KaTeX formulas at 1440/768/360/345px, real text and canvas input, navigation and fresh reload. Existing nonfatal lint/build notices and the local Vite DevTools-shim warning are disclosed.
- Production-acceptance snapshot (2026-10-21, Asia/Taipei): runtime candidate `0d19f57af8ce4708881b78e9811d1a3c5e9b9388` passed its own [CI 39624051770](https://github.com/LukeTsengTW/learnforge/actions/runs/39624051770), exactly six context-dependent Edge updates, [Pages 39625526311](https://github.com/LukeTsengTW/learnforge/actions/runs/39625526311), canonical public smoke and four-width all-question browser acceptance. Stages 0–7 independently PASS; source hash and fresh reload match, with no production errors or writes. Final docs-only closure SHA, CI/Pages, annotated tag and publication are recorded by the [v1.23.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.23.0) and [live manifest](https://luketsengtw.github.io/learnforge/release.json); see [delivery](docs/v1.23.0-delivery.md) for evidence and limits.

## 1.22.0 — Economics chapters 1–5

- Promote `economics-ch1-4-exercises/2`: 經濟學第 1～5 章習題, 52 single-choice questions / 52 points / 120 minutes, distribution 8 / 10 / 13 / 10 / 11. Archive current flag only for revision 1; all 41 historical question blocks remain exact and old attempts/results/drafts retain their stored revision.
- Independently audit the 11 new questions against p11–p13 and primary references. Preserve the disclosed original q3 d→current c mapping; clarify Pareto, externality/tax conditions, fixed-baseline reduction subsidies, the core Coase conclusion, idealized fire protection, congested open Wi-Fi and reported versus true WTP. See the [complete audit](docs/economics-ch5-content-review.md).
- Generate 52 new canonical revision 2 contexts (263 total), retaining all previous 211 serialized entries exactly. Add 14 revision/history/content/UI/context regression cases; retain historical assertions and fingerprints.
- Local verification: 126 files / 1,903 tests, all ten release gates, audit 0; actual memory-repository practice/result flow at 1440 / 768 / 360 / 345 px, all 52 radios, intentional two-error score 50/52 and 52 solutions. Supplemental mobile navigation and rendered q2/q4 formulas passed. Local AdGuard-only blocked-resource noise and evidence-driver retries are disclosed.
- Production candidate `8dffba62aedeecd1a563892fa8a2b4e6d05443e0`: first-attempt [CI](https://github.com/LukeTsengTW/learnforge/actions/runs/39526888708) and [Pages](https://github.com/LukeTsengTW/learnforge/actions/runs/39527406382), six required Edge updates before Pages, exact-manifest public smoke and public read-only browser acceptance passed. All 52 actual selections graded 52/52 with 52 nonempty solutions at four widths; fresh reload/source hash parity, zero console/network errors and no production attempt/provider call. Fresh Stage 1–8 reviews PASS. No dependency, schema, provider/model or grading-logic change. This dated candidate snapshot delegates final closure/tag identity to the [v1.22.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.22.0); see [delivery](docs/v1.22.0-delivery.md).

## 1.21.0 — Economics chapters 1–4

- Add `economics-ch1-4-exercises`, revision 1: 經濟學第 1～4 章習題, 41 single-choice questions / 41 points / 90 minutes, in chapter order 8 / 10 / 13 / 10.
- Review all 41 questions against the ten supplied source images. Correct printed ch3-q1 to A and ch4-q5 to D; disclose duplicate removal and original-to-current lettering for ch2-q1 (current B), editorial assumptions, and finite-change elasticity/shutdown clarifications in the questions and solutions. See the complete per-question audit in [delivery](docs/v1.21.0-delivery.md).
- Generate 41 canonical AI contexts (211 total); retain the original 170 serialized entries and all unrelated quiz revisions unchanged. Update catalog/filter regression contracts without reducing historical fingerprint coverage. No schema, provider, model or grading-logic change.
- Local verification: 124 test files / 1,889 tests; all ten release gates; real Library/Author and memory-repository practice/result flows at 1440 / 768 / 360 / 345 px. An unchanged App test hit one local timing failure; focused and full default-suite rechecks passed without changing assertions or time limits.
- Production candidate `da013a05e26febe92b956c09161c675b3dc5cb3e`: first-attempt [CI](https://github.com/LukeTsengTW/learnforge/actions/runs/39414271143) and [Pages](https://github.com/LukeTsengTW/learnforge/actions/runs/39415090253), six required Edge updates before Pages, exact-manifest public smoke, and public read-only browser acceptance at all four widths passed. All 41 inputs, answer judgments and solutions were exercised with zero console/network errors and no production submission/provider call. Independent Stage 1–7 reviews passed. This is the dated runtime-candidate snapshot; final closure/tag evidence is in the [v1.21.0 Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.21.0).

## 1.20.1 — derive the displayed version from the release

- Fix the site header version label to use the version from `package.json` at build time. The v1.20.0 bundle had retained a hard-coded `v1.19.0` label even though its release manifest reported `1.20.0`.
- No quiz content, database schema, Edge Function, or runtime API behavior changed.

## 1.20.0 — Multi-page handwriting (production runtime candidate acceptance snapshot)

- Add ordered pages to calculation handwriting, with isolated undo/redo per page, page navigation, add/delete confirmation, page-local mode and recovery, and multi-page PNG export.
- Introduce draft schema 3 while retaining schema 1/2 read, recovery, migration, and submitted-history behavior.
- Add versioned V5 validation, rasterization, grading, idempotent submission, rubric claims/finalization, and analytics paths for ordered page images.
- Additive Supabase migrations and local security regressions cover page shape, dimensions, aggregate limits, and schema compatibility. No quiz-bank source content changed.
- Runtime candidate `fed21f4a06038c39d128fd628a450b922290cace` passed exact-SHA CI [39244024391](https://github.com/LukeTsengTW/learnforge/actions/runs/39244024391), exact-candidate Pages [39248662680](https://github.com/LukeTsengTW/learnforge/actions/runs/39248662680), canonical public smoke, and one bounded synthetic handwriting canary (two pages, question 1 scored 14/14; five questions left unanswered). Production migrations and the two impacted Edge Functions are recorded in [v1.20.0 delivery](docs/v1.20.0-delivery.md). Final closure SHA and published tag/release are linked from the [v1.20.0 GitHub Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.20.0).

## 1.19.0 — 2021／2023／2024 離散數學期中考題庫（production acceptance snapshot before closure）

This is the dated production-acceptance snapshot for runtime candidate `f283c14c45fa670865f30510c77bf40e64e35e4a`. It passed exact candidate CI [39113976004](https://github.com/LukeTsengTW/learnforge/actions/runs/39113976004), six named Edge deployments, exact-candidate Pages [39115002948](https://github.com/LukeTsengTW/learnforge/actions/runs/39115002948), canonical public smoke, candidate manifest parity, production browser acceptance and independent Stage 4 review. For the current closure SHA, final Pages identity, annotated tag and published Release, see the [v1.19.0 GitHub Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.19.0) and [live release manifest](https://luketsengtw.github.io/learnforge/release.json).

- 新增 2021／2023／2024 三份題庫，共 25 題：18 題計算、7 題單選；各卷 100 分、90 分鐘。
- canonical tutor context 從 145 增至 170。既有 145 筆序列化內容與 fingerprint `8719200237f249a46e43a20a92050db6ab0ed3aa84405485147c3af6976fb368` 相同。
- Classifier 判定 security-ai／Risk C；六個相依函式在 Pages 前各部署一次，revision 各 +1 且 `verify_jwt` 不變；五個未指定函式維持不變。未要求 provider canary；沒有資料庫 migration。
- Local gates：1,828 tests、lint、quiz/context checks、Edge import check、production build、production dependency audit 與 diff check 通過。Lint 有 5 個既有 warning；build 有既有大型 chunk advisory。
- At this snapshot, the production manifest returned `learnforge`／`1.19.0`／candidate SHA. Browser guard 僅允許第一方 GET；Library search/tag、三份 Student／Answer Preview、KaTeX 與 1440／768／360／345 px layout 通過，沒有 recorded browser/network errors.
- 未執行 credentialless Edge health probes；未驗證 valid-JWT handlers、authenticated submission、runtime context loading 或 provider behavior。Browser acceptance 為 unauthenticated read-only，未建立草稿或作答。

完整來源、Edge revisions、CI job IDs、production acceptance 證據、已知限制與 Stage 5 closure gates 見 [v1.19.0 delivery](docs/v1.19.0-delivery.md)。

## 1.18.0 — 第八章「包含及互斥原理」例題練習

Production acceptance：2026-10-18（Asia/Taipei）。Accepted runtime candidate `536a68539951052f025159d547873c6623a64886` passed exact candidate CI [39106545026](https://github.com/LukeTsengTW/learnforge/actions/runs/39106545026) (115 files／1,818 tests；production audit 0 vulnerabilities). The six context-dependent Edge functions are ACTIVE at revisions 26／28／28／30／14／16; `verify_jwt` remains false except `save-quiz-draft=true`. Five credentialless GET probes returned 401 and the `save-quiz-draft` OPTIONS probe returned 204. Exact-candidate Pages [39107181062](https://github.com/LukeTsengTW/learnforge/actions/runs/39107181062) succeeded; canonical public smoke and the cache-busted manifest confirm `learnforge`／1.18.0／the candidate SHA. Independent Stage 4 production review: PASS.

Production browser acceptance found seven Library cards and the Chapter 8 quiz; search and tag filtering each found four matching cards. Chapter 8 Student and Answer Preview rendered all 12 questions; retained Chapters 1／3／5／7 also loaded. KaTeX errors and horizontal overflow at 1440／768／360／345 px were zero. Console, page and CSP errors, non-GET or non-github.io requests, and blocked requests were zero. No immediate predeployment Edge inventory was captured; unchanged-function evidence uses prior release records and current metadata, not a live before/after snapshot. The complete evidence, health-probe execution IDs and limits are in [v1.18.0 delivery](docs/v1.18.0-delivery.md). The docs-only closure, closure-SHA parity, annotated tag and requested GitHub Release follow this production-acceptance snapshot.

## 1.17.0 — 第七章「關係－第二回」例題練習

Production acceptance：2026-10-18（Asia/Taipei）。Accepted runtime candidate `8b370833177b2f22c92582cd4860df12bafe9cd5`；exact candidate CI [39099160596](https://github.com/LukeTsengTW/learnforge/actions/runs/39099160596) succeeded. Six dependent Edge functions are ACTIVE at revisions 25／27／27／29／13／15; health probes passed 6／6. Exact-candidate Pages [39099697903](https://github.com/LukeTsengTW/learnforge/actions/runs/39099697903) succeeded; production release identity and cache-busted manifest both report v1.17.0 and the candidate SHA. Independent Stage 4 production review: PASS.

The source adds revision 1 of `discrete-math-ch7-relations-second-examples`: 21 calculation questions, 150 points, 120 minutes, typing and 1200×900 handwriting. Production Library search/filter, Author student/answer previews, KaTeX rendering, drawing-mode switch and 1440／768／360／345 px layouts passed. The first Chromium attempt recorded 10 Cloudflare Turnstile-frame console errors, 6 warnings and two automatic challenge POSTs; a later guarded Edge rerun and supplemental Home/Library observer run recorded zero console/page/CSP events and only first-party GET traffic. No authenticated practice/persistence/submit/AI behavior was exercised; no migration, provider canary, database read, secret read or production log access occurred. The full evidence and limits are in [v1.17.0 delivery](docs/v1.17.0-delivery.md). GitHub Release: not requested / not planned.

## 1.16.1 — 第五章題庫 revision 2：刪除兩題並簡化計算題的要求

Production acceptance：2026-10-17（Asia/Taipei）。Accepted runtime candidate `817e954505b6cf9fe15d1aac02cff0d2d59f76db`（exact candidate CI 39043637456）；基準 immutable v1.16.0：tag object `7fafccb9106e591f83870656e176ac70433c7a68`／peeled `bea17ee1ba6543bd60a47d95c3e80117c18d84b6`。六個 Edge function 已部署、health 6／6、exact candidate Pages（run 39043820681／deployment 7141520321）、未登入的 public acceptance 與登入後的 draft canary（包含封存草稿的重新開始）均已完成，production review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- Human 要求：刪除「例題 5.5：由 A 到 B 的關係（講義第 3 頁）」與「定理 5.1：叉積對交集與聯集的分配律（講義第 6 頁）」；只需算出答案、不是證明的題目，只要求寫出計算過程與答案，不再要求說明原理。Human 確認的做法：新 revision 2（revision 1 改為封存）、題號重排為 q01–q18、各題配分不變（總分 150 → 136）、estimatedMinutes 120 → 100。
- `discrete-math-ch5-relations-functions-examples` revision 2：18 題計算題（皆可打字或 1200×900 手寫），136 分，100 分鐘。改為只要求計算過程與答案的 8 題（revision 1 → 2 的題號）：q01 → q01（叉積例）、q03 → q02（關係個數例）、q07 → q05（定義 5.4 例）、q10 → q08（例題 5.21）、q11 → q09（例題 5.24：刪去兩個「為什麼」與上限 $n-1$ 的敘述，保留例子對應的分配）、q12 → q10（分配例）、q13 → q11（例題 5.26 (b)）、q20 → q18（表 5.13）。這 8 題的題幹不再出現「說明／理由／為什麼」，rubric 原本給說明的分數移到計算步驟與答案，每題配分不變；參考答案只在 q08、q09 刪去對應的說明句；所有 solution 與 revision 1 相同（保留完整推導）。判斷、推導與證明題（q04、q06、q08、q09、q14–q19 → q03、q04、q06、q07、q12–q17）與 revision 1 逐位元相同（題號除外）。描述改為「計算題請寫出計算過程與答案；判斷、推導與證明題請寫出完整的推理」。
- Revision 1 保留在 bundle（`current="false"`），既有的草稿與練習紀錄仍對應原題；它的 20 個題目與 20 個 canonical context 與 v1.16.0 發布時相同（測試釘住由 v1.16.0 的 blob 推得的雜湊）。
- Generated canonical context 94 → 112（+1,053／−0；revision 1 的 20 個保留，新增 revision 2 的 18 個）。Classifier：security-ai／Risk C／providerCanaryRequired=false。部署順序：candidate CI → 六個 Edge function → exact-SHA Pages → production smoke；Edge 同步之前，revision 2 在 production 無法儲存草稿、提交或使用 AI。
- 測試：新增 `ch5-relations-functions-revision-2.test.tsx`（40 個：metadata 與 136 分、只刪去兩題且順序不變、10 題與 revision 1 相同、8 題不再要求說明且題幹不洩漏答案、每題 KaTeX 與 context、整份來源 986 個公式、revision 1 與其 context 的雜湊）。`ch5-relations-functions.test.tsx` 改為檢查封存的 revision 1（`current: false`、依 revision 取 context 與來源、inventory 11 revisions／141 questions）；`quiz-loader.test.ts` 的 bundled 來源 6 → 7；`LibraryPage.test.tsx` 的第五章卡片為 18 題、總分 136 分、約 100 分鐘。沒有刪除或放寬斷言。Local gates：113 files／1,775 tests 全部 PASS、零 skipped。Mutation probe 6/6 被對應的測試抓到。
- Browser gate（scratch build 由 Playwright 從磁碟提供，零網路）：1440／768／360 48/48、345 px 18/18 PASS；題庫編寫頁選取 revision 2，Answer Preview 全部 986 個公式與 Student Preview 的 236 個公式沒有溢出、KaTeX error 0；console／page error 0、非 GET request 0。
- Release review（sub-agent）：feature 與 release prep cycle 1 PASS（一個不阻擋的 nit：新 q09 的 solution 仍有「上限 $n-1$ 與 $n$」一段，但題幹已不再出現上限 $n-1$ 的寫法；為了讓所有 solution 與 revision 1 相同而保留）。
- Candidate：單一 commit `817e954505b6cf9fe15d1aac02cff0d2d59f76db`（parent `bea17ee`，14 個路徑）推到 branch `claude/awesome-carson-b7doyu`，local master fast-forward 後，在 local master 上 `release:check --base v1.16.0 --require-clean` 10／10 PASS（report：1.16.1／candidate SHA／base `bea17ee…`／security-ai／Risk C／providerCanaryRequired=false／1,775 tests）；strict `release:preflight --base v1.16.0 --version 1.16.1 --sha <candidate> --branch master --require-clean --require-tag-absent` 7 項全部 PASS。fast-forward 後先以 `npm run generate:ai-context` 寫回 LF 的 generated context 並 `git add`（沒有 staged 的變更），兩個工具第一次執行就通過；一次 normal push（remote master `bea17ee → 817e954`）。[LearnForge CI 39043637456](https://github.com/LukeTsengTW/learnforge/actions/runs/39043637456) PASS。
- Edge：六個 function 依序部署（每個一次嘗試、exit 0）：ai-tutor 24、ai-grade 26、ai-drawing 26、ai-responses 28、save-quiz-draft 12、submit-quiz 14（部署前依序為 23、25、25、27、11、13，與 v1.16.0 結束時相同）；全部 ACTIVE，verify_jwt 不變（只有 save-quiz-draft 為 true）；其餘五個 function 的版本、雜湊、id 與 updated_at 都沒有變。來源核對：partial: ai-tutor full; the other five not downloaded, plus gated exact-candidate deployment。Runtime health 6／6。
- Pages：一次 exact candidate dispatch，[Deploy LearnForge to GitHub Pages 39043820681](https://github.com/LukeTsengTW/learnforge/actions/runs/39043820681)／deployment 7141520321 success。canonical public smoke PASS（release identity 1.16.1／candidate SHA，root 與 manifest 200，5 個 asset），反向對照 1.16.0／`bea17ee` 被拒絕；`release.json` 一般與 cache-busted 相同；74 個路徑全部 HTTP 200；瀏覽器 smoke（對正式站只有 GET，github.io 以外的 host 一律中止並記錄）1440／768／360 48/48 PASS：Home「5 份題庫」與 v1.16.1、第五章卡片為 18 題／總分 136 分／約 100 分鐘、搜尋與篩選、題庫編寫頁的 revision 2（18 題與 metadata；Answer Preview 全部 986 個公式與 Student Preview 的 236 個公式沒有溢出、KaTeX error 0）、q01 打字與 q02 手寫保留在 Answer Preview、第三章仍可載入；console error 0、page error 0、非 GET request 0、被中止的 request 0。Edge 與 Pages 之間的空窗：約 2.6 分鐘（Asia/Taipei 23:08:37 第一個 Edge 部署 → 23:11:11 Pages 部署成功）。這段期間舊的 Pages 仍以 revision 1 為 current，而 revision 1 的 context 仍在新的 Edge 中，所以沒有影響。
- 登入後的 canary：PASS（production review 要求，draft-only，包含重新開始）：human 在一般啟動的 Chrome（新的暫存 profile，debugging 只綁 127.0.0.1）登入既有的 release-canary 帳號，登入後才 attach。帳號核對前後相同：5 筆已提交的紀錄，第三章、第五章與 2026 習題有草稿。(1) 封存草稿的路徑：開啟第五章題庫，伺服器回傳 v1.16.0 留下的 revision 1 草稿，頁面為 20 題，顯示「此未完成練習使用舊版題目（1）。你可以繼續完成，或捨棄草稿並使用最新版重新開始。」與「捨棄舊草稿並使用最新版重新開始」，q01 的手寫與文字還原；寫入只有 `get_or_create_quiz_draft` 與 `account-recovery-code`。(2) 按下「捨棄舊草稿並使用最新版重新開始」→「確認重新開始」：恰好一個 `DELETE /rest/v1/attempts` 回 200（刪除 1 列，canary 帳號自己的 revision 1 草稿；資料庫政策只允許刪除自己的草稿），接著 `get_or_create_quiz_draft` 建立 quizRevision 2 的空草稿，頁面為 18 題。(3) Revision 2：q01 打字「v1.16.1 release canary」、重新整理、畫一筆、重新整理；最後伺服器草稿為 revision 2、answerSchemaVersion 2、q01 drawing mode、1 筆、文字保留，畫面還原；其他 17 題未動。沒有提交、沒有 AI 請求（ai-quota、ai-responses 只有 GET）；觀察到的非 GET 只有 DELETE 1、`get_or_create_quiz_draft` 4、`save-quiz-draft` 3、`account-recovery-code`（狀態查詢）5；79 個 response 沒有 ≥400，console／page／CSP error 0。Chrome 已關閉、暫存 profile 已刪除，evidence 經敏感值掃描為 0。
- 已知觀察（原因不明）：重新開始之後的第一個 `save-quiz-draft`（15:41:39.165Z 送出）沒有收到回應，15:41:54.220Z 以 `net::ERR_ABORTED` 結束，也就是 app 的 15 秒逾時（`src/lib/supabase.ts:13`）；app 沒有顯示錯誤。Canary 沒有重試；在計畫中的重新整理後，app 重送待同步的 q01（15:42:28.851Z → 200，0.8 秒），之後畫一筆的儲存也是 200（0.9 秒）。重送前 1 ms，應用程式自己的 GET 讀到的伺服器草稿仍是空的（revision 2、schema 1、沒有答案列），重送也通過 handler 的 `expectedUpdatedAt` 檢查，所以被中止的請求沒有寫入任何資料。這是 save-quiz-draft v12 部署後（15:08:55Z）約 32.7 分鐘的第一個真正的 POST（health 只送了 OPTIONS）；冷啟動或暫時的平台延遲是可能的解釋，但沒有證明，也沒有讀 log。本版沒有改動儲存的程式路徑。
- Package／lock root version 與 navigation label 為 1.16.1。見 [v1.16.1 delivery](docs/v1.16.1-delivery.md)。

## 1.16.0 — 離散數學第五章：關係和函數－例題練習

Production acceptance：2026-10-17（Asia/Taipei）。Accepted runtime candidate `3c7d8d458d14595753b88b47899ea62fdce1d8a0`（exact candidate CI 39025646607）；基準 immutable v1.15.0：tag object `938d66192bfbdc6837b154431d42730cfa6df14a`／peeled `6cd622d77874707ff6e1f966e783f32eececaaf4`。Candidate 是 branch `claude/awesome-carson-b7doyu` 上的兩個 commit，經 fast-forward 合併到 master。六個 Edge function 已部署、health 6／6、exact candidate Pages（run 39026583818／deployment 7138514435）、未登入的 public acceptance 與登入後的 draft canary 均已完成，production review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 新 bundled quiz family `discrete-math-ch5-relations-functions-examples/1`：依 31 頁講義《05 關係和函數 - 2026》（4,290,799 bytes，SHA-256 `49d6a425d779d2e6eaf9357ad77f5ff7f4169d21ae4fcbe93c962d5e629f6494`）的轉寫檔收錄 20 個單元，20 calculation／drawing-capable、150 分、1200×900、120 分鐘，支援打字與手寫。全庫（發布的）6 revisions／5 current／94 questions／94 canonical contexts。
- 來源：權威來源是 repo 內的轉寫檔 `docs/sources/discrete-math-ch5-relations-functions-2026.md`。本次沒有取得 PDF，所以沒有重新核對 SHA-256 或逐頁比對影像；題目只依轉寫檔，沒有猜測講義沒寫的內容，講義沒寫、由題庫補上的推論與數值都在 solution 標明（見下一項）。
- 題目切分（human 確認）：p2、p3、p4、p5、p6、p7–8、p9、p10–11、p12、p13、p14–16、p17、p18、p19、p22–23、p24、p25、p26–27、p28、p29–30 各一題；配分 6／6／4／8／8／8／4／8／8／8／10／6／10／8／4／6／8／10／8／12。p1（章名）、p31（結尾）不成題；p20–21 標「(略)」，依 human 決定不出題。定理 5.1 改為證明題；第 28 頁沒有例題編號，仍收錄；表 5.13 出成 $m=4$、$n=3$ 的綜合題。
- 講義沒有寫出、由 solution 補上並註明的內容：定理 5.1 的證明（依定義 5.1）、例題 5.5 與 5.9 的理由（依定義 5.2、5.3）、$|A|\le|B|$ 的理由（依定義 5.5）、第 25 頁與第 26–27 頁例子的結果、第 28 頁的完整推論、表 5.13 (5)(6) 的數值 15 與 3。來源筆誤依轉寫檔附錄 C 改用正確寫法（p4 少「個」、p10「有為限」「必為有」、p19「的的」、p29–30 漏「+」）；p14／p16 上限 $n-1$ 與 $n$ 並列的寫法保留，solution 說明 $k=n$ 的項為 0。
- 答案：以不讀題庫檔的獨立 Python 腳本重算 53 項（列舉 $A\times B$ 的 64 個子集合、定理 5.1 在三元素宇集的 512 組集合、$4^7$ 個函數中的映成者、集合分割、$\binom{9}{6}=84$ 個子集合、$\{1,\ldots,14\}$ 的全部 3,003 個六元素集合等），全部與講義及轉寫檔附錄 B 一致。
- 標籤：`cartesian-product`、`relations`、`functions`、`one-to-one`、`onto`、`stirling-numbers`、`pigeonhole-principle`。`relations`、`functions`、`stirling-numbers` 與既有題庫共用，所以 Library 測試的預期值跟著更新：搜尋 `stirling-numbers` 由只找到 2026 習題改為找到兩份；`relations`、`stirling-numbers` 標籤，以及科目「離散數學」、題型「計算」的篩選加入新題庫，題型「單選」的篩選排除新題庫。沒有刪除或放寬任何斷言。
- 測試：新增 `src/features/quiz/ch5-relations-functions.test.tsx`（48 個測試：每題的題幹、答案、頁次、配分、rubric、題幹不洩漏答案、KaTeX 渲染與 canonical context；整份來源的 1,119 個公式（48 個 display）一次渲染；頁次對照；solution 的來源註明；答案與鴿洞原理例子的窮舉重算；既有 103 題 inventory 的雜湊由 HEAD `b3cd217` 的 blob 推得，這些 blob 與 v1.15.0 相同）。`ch1-counting`、`ch3-set-theory`、`discrete-math-exercises-2026` 三個家族測試把新家族排除在各自的 baseline 之外，原有雜湊不變；`quiz-loader.test.ts` 改為恰好發布五份題庫。Local gates：112 files／1,735 tests 全部 PASS、零 skipped（v1.15.0 為 111／1,683）。
- 版面：以 app 的 Markdown pipeline 與 CSS 渲染整份題庫，量測 answer 欄 226／211 px、其他欄 254／239 px（360 與 345 px 視窗）下每個 KaTeX 方塊，2,074 個方塊都沒有水平溢出；這個量測比 sub-agent reviewer 的量測嚴格約 25 px（同一批原始公式在兩邊分別量到 +74 與 +45 px）。這是靜態頁的量測。在 app 內的 browser gate（candidate 的 scratch build 由 Playwright 從磁碟提供，沒有後端、零網路）在 360 px 的 Answer Preview 發現 q17 rubric 的鴿洞清單（同一個行內公式中的逗號串列不會換行）溢出 10 px，已改為五個分開的行內公式；修正後 1440／768／360 的 48 項檢查與 345 px 的 18 項檢查全部 PASS，每個 viewport 的 Answer Preview 全部 1,119 個公式（1,041 個 display 或段落內的行內方塊，量 scrollWidth；78 個在清單或粗體中的行內公式，量是否超出所在的 Markdown 區塊）與 Student Preview 的 271 個公式都沒有溢出，KaTeX error、console／page error、非 GET request 都是 0。靜態頁量測以整欄寬度渲染 rubric，所以沒有抓到這一處。
- Sub-agent review：cycle 1 REWORK（blocking：四個 display 公式在 360 px 寬會溢出 1–45 px；should-fix：CHANGELOG 前後矛盾；五個 nit：雜湊來源寫法不一致、q20 的 81 沒有註明出處、q19 的變數名稱混用、q18 題幹暗示結論、兩行不會失敗的測試），全部修正；cycle 2 PASS（reviewer 以自己的 harness 重新量測：1,115 個公式在四種欄寬都沒有溢出；當時 q17 rubric 尚未修正），沒有新的 finding。
- Generated canonical context 是 Edge 看得到的檔案（74 → 94，diff +1,192／−0，既有 74 個不變）。Classifier：security-ai／Risk C／providerCanaryRequired=false。部署順序：candidate CI → 六個 Edge function（ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz）→ exact-SHA Pages → production smoke；Edge 同步之前，新題庫在 production 的草稿儲存、提交與 AI 請求不會運作。本次只把順序寫進文件，沒有部署。
- Candidate：`c9a0111`（題庫與 release 準備）與 `3c7d8d458d14595753b88b47899ea62fdce1d8a0`（修正 q17 rubric 版面、記錄 browser gate），parent 依序為 `b3cd217`（講義轉寫）與 `c9a0111`；local master fast-forward `6cd622d → 3c7d8d4` 後，在 local master 上 `release:check --base v1.15.0 --require-clean` 10／10 PASS（report：1.16.0／candidate SHA／base `6cd622d…`／security-ai／Risk C／providerCanaryRequired=false／1,735 tests）；strict `release:preflight --base v1.15.0 --version 1.16.0 --sha <candidate> --branch master --require-clean --require-tag-absent` 7 項全部 PASS；一次 normal push。前兩次 `release:check` 失敗、不計入：第一次是 test gate 的 `check:ai-context` 失敗，因為 fast-forward 時 Git（`core.autocrlf=true`）把 generated context 以 CRLF 寫回 working tree，而檢查逐位元比對（committed blob 是 LF）；以 `npm run generate:ai-context` 寫回相同內容的 LF 版本。第二次是 preflight 失敗，因為 Git 的 index 仍把該檔標為修改（內容沒有差異）；`git add` 該檔後清除，沒有 staged 的變更。[LearnForge CI 39025646607](https://github.com/LukeTsengTW/learnforge/actions/runs/39025646607) PASS。
- Edge：六個 function 依序部署（一次一個，每個一次嘗試，每個 exit 0）：ai-tutor 23、ai-grade 25、ai-drawing 25、ai-responses 27、save-quiz-draft 11、submit-quiz 13（部署前依序為 22、24、24、26、10、12，與 v1.15.0 結束時相同）；全部 ACTIVE，verify_jwt 不變（只有 save-quiz-draft 為 true）；其餘五個 function（account-recovery-code、ai-quota、ai-usage、password-hint、recover-account）的版本、雜湊、id 與 updated_at 都沒有變。來源核對：partial: ai-tutor full; the other five not downloaded, plus gated exact-candidate deployment。Runtime health 6／6。第一次與第二次的 Edge 部署指令被 Claude Code 的 auto-mode permission classifier 擋下，script 沒有開始（沒有 marker、沒有輸出）；human 離開 auto mode 並說「繼續」後執行，一次成功。
- Pages：一次 exact candidate dispatch，[Deploy LearnForge to GitHub Pages 39026583818](https://github.com/LukeTsengTW/learnforge/actions/runs/39026583818)／deployment 7138514435 success。canonical public smoke PASS（release identity 1.16.0／candidate SHA，root 與 manifest 200，5 個 asset），反向對照舊的 1.15.0／`6cd622d` identity 被拒絕；`release.json` 一般與 cache-busted 相同；74 個路徑全部 HTTP 200；瀏覽器 smoke（headless Chromium，對正式站只有 GET，github.io 以外的 host 一律中止並記錄）1440／768／360 48/48 PASS：Home「5 份題庫」與 v1.16.0、Library 5 張卡片與第五章卡片、搜尋「第五章」、`stirling-numbers` 篩選 2 張、題庫編寫頁載入第五章的 Student／Answer Preview（20 題；Answer Preview 全部 1,119 個公式與 Student Preview 的 271 個公式沒有溢出、KaTeX error 0）、q01 打字與 q02 手寫保留在 Answer Preview、第三章仍可載入；console error 0、page error 0、非 GET request 0、被中止的 request 0（沒有任何對 Supabase 的 request）。Edge 與 Pages 之間的空窗：約 3.6 分鐘（Asia/Taipei 18:51:00 第一個 Edge 部署 → 18:54:39 Pages 部署成功）。這段期間舊的 Pages 不列出新題庫，使用者看不到差異。
- 登入後的 canary：PASS（production review 要求，draft-only）：human 在一般啟動的 Chrome（新的暫存 profile，debugging 只綁 127.0.0.1）登入既有的 release-canary 帳號，登入後才 attach。帳號核對（只讀練習紀錄與 Library，不讀 navigation）：5 筆已提交的紀錄（3 筆 `demo` 顯示「題目版本無法載入」、第一章、期中考），第三章與 2026 習題保留草稿，第五章卡片為「開始練習」。開啟新題庫：`get_or_create_quiz_draft` 建立 revision 1 的空草稿；q01 打字「v1.16.0 release canary」→ `save-quiz-draft` 200（answerSchemaVersion 2）；重新整理後應用程式自己的 GET 讀到伺服器草稿含 q01 的文字，畫面也還原；q01 切到手寫並畫一筆短線 → `save-quiz-draft` 200；重新整理後伺服器回傳 drawing mode、1 筆、文字保留，畫布相同。其他 19 題未動；沒有提交、沒有 AI 請求（ai-quota、ai-responses 只有 GET）。觀察到的 POST 只有 `get_or_create_quiz_draft` 3 次、`save-quiz-draft` 2 次、`account-recovery-code`（狀態查詢）5 次；72 個 response 沒有 ≥400，console／page／CSP error 0。草稿保留，沒有 cleanup、沒有登出；Chrome 已關閉、暫存 profile 已刪除，evidence 經敏感值掃描為 0。
- Package／lock root version 與 navigation label 為 1.16.0。見 [v1.16.0 delivery](docs/v1.16.0-delivery.md)。

## 1.15.0 — 移除三份題庫

Production acceptance：2026-10-17（Asia/Taipei）。Accepted runtime candidate `e7eb6187caf5d3aabb8f3136d6b0030707e2f85e`（exact candidate CI 39015563847）；基準 immutable v1.14.1：tag object `566497ff0dc85167d0b4742da875eeeefb730a04`／peeled `6e98fc7c81d2f9171731f5d35b1bdc7f3b86a753`。六個 Edge function 已部署、health 6／6、exact candidate Pages（run 39016013054／deployment 7136815881）與未登入的 public acceptance 均已完成，review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 移除三份題庫（human 要求）：「數位邏輯與基礎數學」（`demo`，revision `v1-7d7c900e`［封存］與 `v2-handwriting`［current］）、「布林代數基礎」（`boolean-algebra/1`）、「離散數學：關係」（`relations/1`）。發布的題庫剩 4 份 current：2025 Discrete Mathematics 期中考（`discrete-math/2`，封存 `discrete-math/1`）、離散數學第一章例題、離散數學習題 2026、離散數學第三章例題；全庫 5 revisions／4 current／74 questions／74 canonical contexts（9／7／103／103 → 5／4／74／74），其餘題庫的內容與其 74 個 canonical context 與 v1.14.1 逐位元相同。
- `supabase/functions/_shared/quiz-context.generated.ts` 重新產生（103 → 74 個 context；移除 `boolean-algebra/1` 7、`demo/v1-7d7c900e` 7、`demo/v2-handwriting` 7、`relations/1` 8）。這是 Risk C：六個使用它的 Edge function（ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz）需要先於 Pages 重新部署。
- Home 的精選題庫由 `boolean-algebra` 改為 `discrete-math-ch1-counting-examples`（期中考的描述含未渲染的 LaTeX，不適合卡片）；`index.html` 的 meta description 由「數位邏輯與基礎數學」改為「離散數學」；移除只有測試使用的 `demoQuiz` 匯出。
- 測試：三個題庫的 Markdown 以 `git mv` 移到 `src/test-fixtures/quizzes/`（內容不變），作為測試資料由 `fixture-quizzes.test-helper.ts` 的 `withFixtureQuizzes`／`withFixtureContexts` 選擇加入；它們不在 production 的 bundle 或 generated context。新增「恰好發布四份題庫」的測試與使用真實 regenerated context 的 `discrete-math/2` 測試。111 files／1,683 tests 全部 PASS；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check／tsc 通過。
- Sub-agent review：cycle 1 REWORK（有測試經由 mock 不再驗證真正發布的內容等），修正後 cycle 2、cycle 3 PASS。Browser 證據（scratch build 由 Playwright 從磁碟提供，沒有登入）：Home、Library（4 張卡片；搜尋被移除的名稱沒有結果）、`#/quiz/demo`（未登入轉登入、已登入「找不到這個練習」）、練習紀錄、結果頁、學習分析、錯題複習的降級顯示，1440／768／360 沒有 overflow，console／page errors 0。
- Classifier：security-ai／Risk C／providerCanaryRequired=false；不需要 provider canary。
- 使用者可見的後果：這三份題庫過去的作答在練習紀錄顯示「題目版本無法載入」，練習紀錄只對 deterministic-v1 的紀錄顯示已保存的分數，其他 grading version 顯示「— / —」；結果頁無法顯示這些紀錄的分數、答案與解析（既有的降級行為）；已發布的題庫只剩單選與計算題，Library 的題型篩選仍列出沒有題目的題型；Home 的邏輯閘插圖與裝飾沒有改。
- 沒有改變：留下的題庫、parser、評分、migration、RLS、Auth／secrets／provider configuration、dependency；除了 generated canonical context 以外，Edge function 的原始碼不變。
- Release-prep review：cycle 1 REWORK（五處文件錯誤：Edge 原始碼的說法、Edge／Pages 空窗的說法、分數的說法、設計來源的年代、release-final-gate 的描述），修正後 cycle 2 PASS；production review PASS。
- Candidate：單一 commit `e7eb6187caf5d3aabb8f3136d6b0030707e2f85e`（64 個路徑）；commit 後 `release:check --base v1.14.1 --require-clean` 10／10、strict preflight 8／8 PASS；[LearnForge CI 39015563847](https://github.com/LukeTsengTW/learnforge/actions/runs/39015563847) PASS。
- Edge：六個 function 依序部署（一次一個，每個一次嘗試）：ai-tutor 22、ai-grade 24、ai-drawing 24、ai-responses 26、save-quiz-draft 10、submit-quiz 12（部署前依序為 21、23、23、25、9、11）；其餘五個 function（account-recovery-code、ai-quota、ai-usage、password-hint、recover-account）的版本、雜湊與 updated_at 都沒有變。來源核對：partial: ai-tutor full; ai-responses incl. generated context; the other four entry files only, plus gated exact-candidate deployment；方法：CLI `functions download` 在隔離的 scratch workdir（不是 `get_edge_function`；該 MCP 在這個 session 沒有 authenticate）。Runtime health：5 個 GET（ai-tutor、ai-grade、ai-drawing、ai-responses、submit-quiz）回 401 `MISSING_CREDENTIALS`（平台的回應），save-quiz-draft 的 OPTIONS 回 204，六個回應都有 `x-deno-execution-id`；沒有讀任何 log。這只證明函式已部署、被路由並由 Edge runtime 回應，不單獨證明新的 handler 或 generated context 已被載入。
- Pages：一次 exact candidate dispatch，[Deploy LearnForge to GitHub Pages 39016013054](https://github.com/LukeTsengTW/learnforge/actions/runs/39016013054)／deployment 7136815881 success。canonical public smoke PASS（release identity 1.15.0／candidate SHA，root 與 manifest 200，5 個 asset），反向對照舊的 1.14.1 identity 被拒絕；74 個路徑全部 HTTP 200；瀏覽器 smoke：Home 精選為「離散數學第一章：計數的基本原理－例題練習」（26 道題目、總分 150 分、卡片沒有未渲染的 LaTeX）、「4 份題庫，依自己的步調探索」、meta description 為「…離散數學…」、navigation 為 v1.15.0；Library 恰好 4 張卡片，搜尋「布林」、「數位邏輯」、「關係」、`logic-gates`、`boolean-algebra`、`demo` 都沒有結果；未登入的 `#/quiz/demo` 與 `#/quiz/boolean-algebra` 都轉到登入頁；題庫編寫頁的 bundled revision 只有留下的四份題庫（五個 revision）；768 與 360 沒有水平 overflow；主要 JS 不含三份被移除題庫的標題，也不含 `boolean-algebra`、`v2-handwriting`、`v1-7d7c900e`。
- Edge 與 Pages 之間的空窗：約 6 分鐘（Asia/Taipei 16:00:36 第一個 Edge 部署 → 16:06:39 Pages 部署成功）。這段期間舊的 Pages 仍列出三份被移除的題庫：它們的提交與 AI 請求會被拒絕、`demo/v2-handwriting` 的 v4 草稿無法儲存，v3 草稿仍可儲存。
- 登入後的 canary：not run (justified)：沒有 draft、提交、評分或 provider 的程式變更；留下的 74 個 canonical context 與 v1.14.1 逐位元相同；`discrete-math/1`、`discrete-math/2` 有預設查詢的單元測試；加上部分來源核對與有 gate 的 exact-candidate 部署。沒有登入，canary 帳號未動；登入後的路徑與舊紀錄的降級顯示沒有在 production 驗證（只在本機 harness 驗證）。
- 瀏覽器 smoke 的第一次執行記到 7 個 console error，全都在轉到登入頁的 Cloudflare Turnstile frame：AdGuard 的 script 被注入該第三方 frame 並被它的 CSP 擋下，以及我們自己中止的 Cloudflare POST（`ERR_FAILED`）；沒有 page error、沒有第一方的 error、沒有任何對 Supabase 的 request。Home、Library、Author（1440 與 360）另外重跑一次，0 個 console／page error，但該次由瀏覽器的 HTTP cache 提供，router 看到 0 個 request，所以它證明沒有錯誤，不是新的網路紀錄。第一方頁面沒有出現 AdGuard 相關的 error。
- Production 的存取：`functions list` 2 次；`functions download` 6 次（1 次完成、5 次在寫入部分檔案後失敗，都在 scratch）；6 個 health request；public smoke 與反向對照；74 個路徑的 crawl；瀏覽器 smoke（只有 GET；3 個 Cloudflare Turnstile 的 POST 在送出前中止）；GitHub 的唯讀 API。沒有 SQL、沒有 secrets list、沒有 log（沒有列出 secrets，所以 Edge 部署對平台管理的 `SUPABASE_*` secrets 時間戳的已知影響（v1.9.0 觀察到）沒有檢查）。Production 的變更：六次 Edge 部署與一次 Pages 部署。
- Package／lock root version 與 visible navigation label 為 1.15.0。見 [v1.15.0 delivery](docs/v1.15.0-delivery.md)。

## 1.14.1 — 畫布工具列圖示

Production acceptance：2026-10-16（Asia/Taipei）。Accepted runtime candidate `0abb09a962f0e62a7a4ed0b670c7bceb0612fb20`（exact candidate CI 38926266625）；基準 immutable v1.14.0（tag object `7428088176665828c11c68e952c46fe52315142f`／peeled `b2f770402f0b06ee632896ecaf539cb59d867302`）。Exact candidate Pages（run 38926525130／deployment 7123281622）與未登入的 public acceptance 均已完成，review PASS。不需要 Edge 部署與 provider canary。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 手寫畫布工具列的六個按鈕改以 SVG 圖示顯示：畫筆、橡皮擦、復原、重做、放大書寫／結束放大（放大時圖示切換為縮小）與移動畫面。按鈕上沒有文字；滑鼠停留時顯示名稱（`title`，結束放大為「結束放大（Esc）」），螢幕閱讀器讀到的名稱（`aria-label`）與原本的文字相同；畫筆、橡皮擦與移動畫面的按下狀態、復原與重做的停用狀態與鍵盤操作不變；放大的切換按鈕以名稱表示動作，不再標示按下狀態，放大時加上 `aria-keyshortcuts="Escape"`。放大時的狀態行改為「已放大書寫。按 Esc 或工具列的縮小按鈕返回。」，因為「結束放大」不再是看得到的文字。按鈕為 44 × 44 px，圖示 20 × 20 px，以按鈕的文字顏色繪製，淺色與深色主題都沿用既有的顏色 token。顏色色塊、1×／1.5×／2×、「輸入方式」選單與畫布下方的「清除畫布」、「匯出 PNG」維持原樣（human 決定）。
- 沒有改變：畫布的行為、保存的筆跡、Edge function、migration、題庫、generated canonical context、Auth／RLS／secrets／provider configuration 或 dependency。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- Local gates：111 files／1,681 tests 全部 PASS、零 skipped（新增 1 個測試檔、3 個測試；既有測試以按鈕的名稱尋找按鈕，名稱不變，`DrawingCanvas-enlarged.test.tsx` 的一個斷言改為切換按鈕沒有 `aria-pressed`，另加 `aria-keyshortcuts` 的斷言）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Browser 證據使用本機受控 fixture（零網路）：1440／360、淺色與深色，六個圖示按鈕都是 44 × 44、圖示 20 × 20、沒有文字、有 title，工具列與頁面沒有水平 overflow；v1.14.0 的放大書寫情境（座標、modal、捲動位置、Student Preview）重跑全部通過；console／page errors 0。
- Sub-agent review（本 session 內的 code reviewer）：cycle 1 APPROVE，沒有 blocking；一項 should-fix（放大時的狀態行要使用者按「結束放大」，但這已不是看得到的文字；觸控裝置也看不到提示）與五個 nit（名稱會改變的切換按鈕不應標示按下狀態、結束放大的 Esc 快捷鍵、停用按鈕的提示、README 的用詞、測試缺口），除了列為已知限制的停用按鈕提示之外全部修正；cycle 2 APPROVE、沒有新發現。
- Classifier：security-ai／Risk C／providerCanaryRequired=false（Risk C 來自本機 ignored 的 `.env.local` 與 package files 的 unrecognized path）。不需要 Edge 部署與 provider canary；部署後以未登入的檢查驗收，同 v1.14.0（release-prep review 核定）。
- Release-prep review PASS（should-fix 與兩個 nit 都在文件，已修正）；commit 前 `release:check --base v1.14.0` 10／10 PASS（111 files／1,681 tests）；`release:preflight`（沒有 `--sha` 與 `--require-clean`，含 `--require-tag-absent`）7／7 PASS。
- 已知限制：觸控裝置沒有滑鼠停留，看不到名稱提示，只能從圖示辨認；部分瀏覽器在停用的按鈕（例如尚未畫任何筆畫時的復原、重做）上不顯示提示。
- Candidate：單一 commit 12 個路徑；commit 後 `release:check --base v1.14.0 --require-clean` 10／10、strict preflight 8／8 PASS；[candidate CI 38926266625](https://github.com/LukeTsengTW/learnforge/actions/runs/38926266625) PASS。
- Pages：一次 exact candidate dispatch，[run 38926525130](https://github.com/LukeTsengTW/learnforge/actions/runs/38926525130)／deployment 7123281622 success。Production release.json 與 navigation 為 1.14.1／candidate SHA；canonical public smoke PASS，舊的 1.14.0 identity 被拒絕；主要 JS 含 `icon-button`、`drawing-tool-icon`、`aria-keyshortcuts`、「結束放大（Esc）」與新的狀態文字，不含舊的「按 Esc 或「結束放大」返回」，navigation 字樣只有 v1.14.1；主要 CSS 含 `.drawing-toolbar .icon-button`（44 px 寬）；74 個路徑 HTTP 200；未登入的瀏覽器 smoke 全部通過。
- 部署上的題庫編寫頁 Student Preview（demo q7，未登入，1440 與 360）：頁面上 5 個、放大後 6 個圖示按鈕，全部 44 × 44、圖示 20 × 20、沒有文字、有 `title`，結束放大沒有 `aria-pressed`；狀態行為「已放大書寫。按 Esc 或工具列的縮小按鈕返回。」；v1.14.0 的放大書寫照常（1× 961／326 px、2× 1932／652 px、dialog 與 `inert`、2× 畫的筆跡與 Answer Preview 的 PNG 相同、回到按下時的捲動位置）；連續 2 次執行都通過，只有對 Pages 的 GET 24 個，console／page／CSP／unhandled rejection 0。
- Production 的變更：一次 Pages 部署。沒有存取 Supabase，沒有登入，canary 帳號未動。
- Package／lock root version 與 visible navigation label 為 1.14.1。見 [v1.14.1 delivery](docs/v1.14.1-delivery.md)。

## 1.14.0 — 手寫畫布的放大書寫

Production acceptance：2026-10-16（Asia/Taipei）。Accepted runtime candidate `b9e2d49150a8c02cd1ddd1e21bf30fadcbef6d10`（exact candidate CI 38916766079）；基準 immutable v1.13.0（tag object `43cf42ec9e23c7a6bf6394b382a2e41385848c1d`／peeled `249857ce86d572a8493aede27d831dbabb8d0dfc`）。Exact candidate Pages（run 38917018937／deployment 7121715145）與未登入的 public acceptance（含部署上的放大書寫操作）均已完成，review PASS。不需要 Edge 部署與 provider canary。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 手寫畫布的工具列最後多了「放大書寫」：畫布編輯區鋪滿整個視窗，1× 時整張畫布剛好放進視窗（1440×900 的視窗中由頁面上的 814 px 寬變為 961 px），可再切換 1.5×、2×；放大到 1× 以上時畫布在編輯區內捲動，並多一個「移動畫面」工具，用任何指標拖曳畫面而不留下筆跡（也可以直接捲動）。按 Esc 或「結束放大」回到頁面原來的捲動位置，筆跡都保留；再次放大時從 1× 開始。工具列（畫筆、橡皮擦、顏色、筆寬、復原、重做、輸入方式）與「清除畫布」、「匯出 PNG」在放大時照常使用。
- 目的：一題有多個小題時，原本固定寬度的畫布（手機上只有 280 px 寬）寫不下。畫布的邏輯大小（例如 1200 × 900）與保存的格式都不變：筆跡仍以畫布的邏輯座標保存，放大只改變畫布在螢幕上的大小，所以已保存的作答、評分與 AI 評分的影像都不受影響。
- 放大時編輯區是 modal：頁面其他部分設為 `inert`（不能點、不能以 Tab 進入），頁面不會捲動；編輯區為 `role="dialog"`、`aria-modal="true"`、名稱「放大書寫」；狀態行朗讀「已放大書寫。按 Esc 或「結束放大」返回。」、「書寫縮放 2×。」與「已結束放大書寫。」。放大期間頁面才加入的內容（例如同步失敗的通知）若取得焦點，焦點回到「結束放大」。筆畫進行中放大、按 Esc 或切換縮放時，先保存已畫的部分，不會讓筆畫在畫布改變大小時跳動。
- 沒有改變：保存的筆跡格式與座標、資料庫的畫布設定（邏輯寬高 100..1200）、server 端的點陣化上限、評分、Edge function、migration、題庫、generated canonical context、Auth／RLS／secrets／provider configuration 或 dependency。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- Local gates：110 files／1,678 tests 全部 PASS、零 skipped（新增 1 個測試檔、13 個測試；既有測試未修改）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Browser 證據使用本機受控 fixture（真正的 application 與 practice store，記憶體內的假 server，零網路）：1440／1180／820／360 的視窗中放大、2×、移動畫面後畫的筆跡保存在指標下的邏輯座標（誤差 ≤ 1 邏輯單位）；modal 與焦點、Esc 中斷筆畫、傳統捲軸下 1× 沒有捲軸且 2× 的大小穩定、在最後一題的頁面底部放大後回到原來的捲動位置；題庫編寫頁的 Student Preview；console／page errors 0。
- Sub-agent review（本 session 內的 code reviewer）：cycle 1 一項 blocking（1× 的大小以 client 寬高量測，傳統捲軸出現時可能互相觸發）、兩項 should-fix（modal 行為：焦點可離開放大的編輯區、兩個編輯區時捲動鎖定的還原順序、一次 Esc 關閉全部、提交進度卡片被蓋住；Esc 或切換縮放時進行中的筆畫跳動）與數個 nit，已修正；cycle 2 APPROVE，另提一項 should-fix（筆畫進行中放大）與四個 nit（放大後才加入頁面的內容、結束放大後的捲動位置、小數高度、ResizeObserver 的 box），全部修正；cycle 3 APPROVE、沒有新發現。「觸控筆優先」時手指不拖曳畫面是刻意保留，列入已知限制。Release-prep review PASS（兩項文件的 should-fix 與 nit 已修正）；commit 前 `release:check --base v1.13.0` 10／10、`release:preflight` 7／7 PASS。
- Classifier：security-ai／Risk C／providerCanaryRequired=false；Risk C 來自本機 ignored 的 `.env.local` 與 package files 的 unrecognized path，所有 source 路徑都是 frontend。不需要 Edge 部署與 provider canary。
- Release-process 要求的部署後登入唯讀 smoke，本版以 Pages 部署上未登入可用的題庫編寫頁 Student Preview 實際操作放大書寫、release.json identity 與 bundle 內容檢查替代，不請 human 登入（release-prep review 核定）；與 v1.12.0 不同，本版沒有任何登入後的執行，沒有涵蓋登入後的練習頁與雲端儲存（見 delivery）。
- 已知限制：「觸控筆優先」時手指不會拖曳畫面，需要用「移動畫面」或捲軸；放大時頁面上的其他內容（題目文字）看不到，需要結束放大才能再看題目；沒有雙指縮放；邏輯畫布的大小不變，所以放大是讓書寫更細，不是增加畫布的空間。完整清單見 delivery。
- Candidate：單一 commit 10 個路徑；commit 後 `release:check --base v1.13.0 --require-clean` 10／10、strict preflight 8／8 PASS；[candidate CI 38916766079](https://github.com/LukeTsengTW/learnforge/actions/runs/38916766079) PASS。
- Pages：一次 exact candidate dispatch，[run 38917018937](https://github.com/LukeTsengTW/learnforge/actions/runs/38917018937)／deployment 7121715145 success。Production release.json 與 navigation 為 1.14.0／candidate SHA；canonical public smoke PASS，舊的 1.13.0 identity 被拒絕；部署的主要 JS 含「放大書寫」、「結束放大」、「移動畫面」與 `canvas-viewport`，CSS 含放大版面的規則；74 個路徑 HTTP 200；未登入的瀏覽器 smoke 全部通過。
- 部署上的放大書寫（未登入的題庫編寫頁）：Student Preview（demo q7，800 × 600）：1440 寬由 564 px 放大為 961 px（2× 為 1932 px），360 寬由 256 px 放大為 326 px（2× 為 652 px）；編輯區鋪滿視窗、dialog／`aria-modal`、header 為 `inert`；2× 畫的一筆在 Esc 後，編輯畫布與 Answer Preview 畫布的 PNG 雜湊相同（筆跡進入作答狀態，零寫入）；頁面回到按下「放大書寫」時的捲動位置；連續 3 次執行都通過，只有對 Pages 的 GET，console／page／CSP／unhandled rejection 0。
- Production 的變更：一次 Pages 部署。沒有存取 Supabase（沒有 Edge、SQL、secrets、log），沒有登入，canary 帳號未動。
- Package／lock root version 與 visible navigation label 為 1.14.0。設計與證據見 [v1.14.0 delivery](docs/v1.14.0-delivery.md)。

## 1.13.0 — 計算題評分放寬與習題解答用詞

Production acceptance：2026-10-16（Asia/Taipei）。Accepted runtime candidate `25ac8e927d2a6256b8a6738973e75e0e286fb099`（exact candidate CI 38857531012）；基準 immutable v1.12.0（tag object `a54cd424f8cb051c9df92462249df8115ad82fa9`／peeled `1e00babe720fedde556e56548d614f27f902a01a`）。六個 Edge function 的部署、exact candidate Pages（run 38857865149／deployment 7112026893）、未登入的 public acceptance 與 provider canary 均已完成，review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 計算題的正式評分放寬（human 的需求與決定）：每一小題的最終答案正確（等價寫法、未化簡也算），就給該小題全部分數，不要求寫出過程；答案錯時仍依 rubric 從寬給部分分數。分小題的依據是 criterion 開頭的 (a)、(b) 標號；不標小題的 criterion 在所有小題都正確時給滿分。求解、計算、計數或求公式的小題以結果為最終答案，即使題目也要求完整推導；證明題目給定敘述的小題，證明本身才是答案，只重寫敘述不算。互相矛盾的多個答案、空白都不算正確；手寫看不清楚的答案不算。打字與手寫都適用，所有題庫的計算題共用；各題 rubric 文字不改。
- 沒有改變：畫圖題的評分、舊版已提交作答的 advisory 重新評分、已提交作答的分數（不重新評分）、各題的配分與答案。
- 「離散數學習題 Ch1、Ch3、Ch5、Ch7、Ch8」（`discrete-math-exercises-2026` revision 1，直接修改現有版本）：19 處「講義」：18 處改為「習題解答」，例如題目標題的「（Ch1 習題解答第 1 頁）」；說明中的「習題解答講義」刪去「講義」，避免重複。題號、配分、答案、rubric 不變；已提交的紀錄重開時顯示新的用詞。第一章與第三章例題題庫仍寫「講義」，不在本次範圍。
- 需要重新部署六個 Edge function（ai-drawing、ai-grade、ai-responses、ai-tutor、save-quiz-draft、submit-quiz），先於 Pages。沒有 migration、RLS、Auth、secrets、provider 或模型設定、dependency 的變更。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- 測試：新增評分規則的測試（新規則存在、舊的嚴格規則消失、證明題與求解題的區分、舊版 advisory 不受影響）；修改三個測試以配合新用詞，其中 v1.10.0 釘住的既有題庫雜湊保持不變：把本次的用詞變更反向套用後必須重現原本的雜湊，證明題庫只有用詞改變。Browser 證據使用本機受控 fixture：Library 與練習頁沒有「講義」、13 個題目標題都改為「習題解答」、1440／360。
- Classifier：security-ai／Risk C／providerCanaryRequired=true。Human 已授權一次付費的 AI 評分驗證。
- Release-prep review：cycle 1 REWORK（文件中三處事實錯誤與 canary script 的兩個問題，見 delivery），cycle 2 PASS。Candidate commit 14 個路徑；commit 後 `release:check --base v1.12.0 --require-clean` 10／10、strict preflight 7／7 PASS；[candidate CI 38857531012](https://github.com/LukeTsengTW/learnforge/actions/runs/38857531012) PASS。
- Edge：六個 function 各部署一次（ai-tutor 21、ai-drawing 23、ai-grade 23、ai-responses 25、submit-quiz 11、save-quiz-draft 9），其餘五個不變；讀回的部署內容與 candidate 逐檔相同，改變的只有 generated context 與（三個評分 function 的）calculation-grading；runtime health 6／6（五個 401 `MISSING_CREDENTIALS`、一個 204）。
- Pages：一次 exact candidate dispatch，[run 38857865149](https://github.com/LukeTsengTW/learnforge/actions/runs/38857865149)／deployment 7112026893 success。Production release.json 與 navigation 為 1.13.0／candidate SHA；canonical public smoke PASS，舊的 1.12.0 identity 被拒絕；部署的 bundle 中習題題庫的 13 個題目標題為「習題解答」、「習題解答講義」0 處；74 個路徑 HTTP 200；未登入的瀏覽器 smoke 全部通過。
- Provider canary（human 登入一次，一次付費的 AI 評分（依結果來源與程式路徑推定））：專用的 release-canary 帳號在「數位邏輯與基礎數學」只於 q6 打字「x=3 或 x=1/2」並正式提交一次。**q6 得到 6 / 6**，三項 criterion（因式分解、寫出兩個根、代回檢查）各 2 / 2，雖然只寫了最終答案；總分 6 / 20，只有 q6 由 AI 評分。AI 評分約 7.5 秒，v1.12.0 的提交進度卡片停在「評分作答」並持續計時。Request guard 阻擋 0、錯誤 0；兩份保留草稿未動。
- Production 的變更：六個 Edge 部署、一次 Pages 部署、canary 的寫入與一次付費的 AI 評分（依結果來源與程式路徑推定）。沒有執行 SQL、沒有列出 secrets、沒有讀取 function log。
- 已知限制：模型依新規則給分只有一次 canary 的證據（打字、單一小題）；分小題、手寫、證明題在 production 沒有驗證；只寫最終答案就能得分，這是自主練習而非防作弊的考試；習題題庫的說明仍寫「請寫出完整推導」。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 為 1.13.0。調查、設計與證據見 [v1.13.0 delivery](docs/v1.13.0-delivery.md)。

## 1.12.0 — 提交測驗的進度顯示

Production acceptance：2026-10-15（Asia/Taipei）。Accepted runtime candidate `8deebbeb467dee60ddd0a8a37221eba7f12ef11b`（exact candidate CI 38757888867）；基準 immutable v1.11.0（tag object `857ce080e8e5e950b1b3cd77c282afffadfbd466`／peeled `b66ae763b86fd3e0a97efe4445b47f6fc9c24ec6`）。Exact candidate Pages（run 38758178628／deployment 7096505218）、未登入的 public acceptance 與部署前登入後的 canary 均已完成，release-prep review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 按下「提交測驗」（或在填空題輸入框按 Enter 直接提交）後，畫面底部固定顯示「正在提交測驗」卡片，不論頁面捲到哪裡都看得到：進度條、每秒更新的「已經過 m:ss」，以及四個步驟「儲存最新作答到雲端」（附已作答題數）、「確認雲端草稿為最新版本」、「評分作答」、「讀取評分結果」，各標示完成／進行中／等待。評分步驟列出這份題庫中可能需要 AI 評分的題型（依實際含有的填空題、計算題、畫圖題）；沒有這些題型的題庫顯示「由系統自動評分。」。伺服器回覆這份作答已有評分正在進行時，顯示「這份作答已有評分正在進行，正在等待結果。」。完成後照舊前往結果頁。
- 提交沒有完成時，提交區顯示「提交未完成」並重複頁面上方的原因；鍵盤焦點移到這段說明，「知道了」把焦點交回「提交測驗」；答案被接受或再按一次提交時自動消失。按下提交後，「仍然提交」的確認框隨即關閉。
- 移除提交時出現在表單上方的「正在檢查填空題答案語意…」：它只描述填空題，而且在按下提交的位置看不到。
- 步驟是瀏覽器端實際經過的階段，不是逐題的評分進度。伺服器在同一個 submit-quiz 請求內依序評分各題，而 `fill_judgments`／`rubric_judgments` 的 RLS 只在作答已提交後才允許讀取，評分途中前端無從得知逐題結果；逐題進度需要後端變更，不在本版範圍。
- 輔助技術：只有步驟那一行是 live region（等待進行中的評分時加上「（等待進行中的評分）」），每秒更新的時間不在其中；進度條有 `aria-valuetext`；目前的步驟標記 `aria-current="step"`；「提交未完成」以原因作為 accessible description。減少動態效果的設定會停用轉圈動畫。
- 沒有改變：提交的流程、CAS 與 request id、對 repository 的呼叫（不多一個 request）、Edge function、migration、題庫、generated canonical context、Auth／RLS／secrets／provider configuration 或 dependency。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- Local gates：109 files／1,662 tests 全部 PASS、零 skipped（新增 1 個測試檔、8 個測試；既有測試只改一個斷言：拒絕提交時的原因現在出現兩次）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Browser 證據使用本機受控 fixture（真正的 application 與 practice store，記憶體內的假 server，零網路）：四個步驟依序推進、計時前進、等待中的評分、提交失敗後的卡片與焦點、在填空題按 Enter 由頁面中段提交、1440／768／360 與深色主題、減少動態效果；console／page errors 0。
- 登入後的 canary（提交前，human 登入一次）：以本機提供的 candidate build（production 的 client 設定、base `/`，連到 production backend）登入專用的 release-canary 帳號，在「數位邏輯與基礎數學」（`demo`／v2-handwriting）只作答 q1–q4 並正式提交一次。卡片在 production backend 上依序走完四個步驟（評分約 0.76 秒），結果頁 8 / 20；q6、q7 為 system/unanswered，沒有 AI 評分、沒有 provider 呼叫；被 guard 阻擋的 request 0。Canary 帳號多了一筆已提交的作答，兩份保留草稿未動。
- Classifier：security-ai／Risk C／providerCanaryRequired=false；Risk C 來自本機 ignored 的 `.env.local` 與 package files 的 unrecognized path，所有 source 路徑都是 frontend。
- Release-process 要求的部署後登入唯讀 smoke，本版以上述部署前的 canary 加上部署後的 release.json identity 與 bundle 內容檢查替代，不再請 human 登入（release-prep review 核定）；沒有涵蓋 Pages origin 與 `/learnforge/` base 下的登入 session。
- Release-prep review：cycle 1 REWORK（兩項都在文件：canary 推定的伺服器寫入、登入後 smoke 的替代沒有明說），cycle 2 PASS。Candidate commit 17 個路徑；commit 後 `release:check --base v1.11.0 --require-clean` 10／10、strict preflight 7／7 PASS；[candidate CI 38757888867](https://github.com/LukeTsengTW/learnforge/actions/runs/38757888867) PASS。
- 沒有 backend 同步：沒有部署 Edge function，也沒有 migration。一次 exact candidate dispatch：[Pages 38758178628](https://github.com/LukeTsengTW/learnforge/actions/runs/38758178628)／deployment 7096505218 success。Production release.json 與 navigation 為 1.12.0／candidate SHA；canonical public smoke PASS，舊的 1.11.0 identity 被拒絕；部署的主要 JS 含「正在提交測驗」、「提交未完成」與 `submit-stopped-reason`，不再有舊的提交文字；74 個路徑 HTTP 200。未登入的瀏覽器 smoke：Home、Library 7 張卡片、Author、沒有 session 時練習頁轉到登入、1440／360 無 overflow；console／page／CSP／rejection 皆為 0，只有 GET。
- Production 的變更：一次 Pages 部署與部署前 canary 的寫入。沒有執行 SQL、沒有列出 secrets、沒有讀取 Edge function 的 metadata 或 log。
- 已知限制：步驟不是逐題進度，AI 評分較久時會停在「評分作答」一段時間（以計時與說明表示仍在進行）；沒有離開頁面的提醒；「提交未完成」顯示的是頁面當下的通知；canary 在本機提供的 candidate 上執行，不是在 Pages 部署上，也只走了不需要 AI 的評分。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 為 1.12.0。設計、證據與 canary 紀錄見 [v1.12.0 delivery](docs/v1.12.0-delivery.md)。

## 1.11.0 — 手寫容量預算、容量提示與座標取整

Production acceptance：2026-10-14（Asia/Taipei）。Accepted runtime candidate `3eddd2e3613062099174ee0d2169a72854185442`（exact candidate CI 38488009950）；基準 immutable v1.10.2（tag object `ed2ca5fc6f4b64287f3328dbaa51b4a37e173fec`／peeled `e516cc4e2abdad09f6c9e15a23ec8175f6f8284f`）。Production migration、五個 Edge function、exact candidate Pages（run 38549398847／deployment 7062829973）、未登入的 public acceptance 與登入後的 canary 均已完成並經 independent review PASS。Closure commit、closure CI、closure-SHA Pages parity 與 annotated tag 仍 pending；GitHub Release：not used / not planned。

- 每題手寫的儲存預算改以資源為準。取樣點上限由 6,000 提高為 32,000；筆數上限由 256 改為 16,000，只用來防濫用：正常落筆到抬筆的一筆至少保存兩個點，所以正常書寫下取樣點預算先到；只有一個點的筆畫（落筆後還沒移動就被 cancel、失去 pointer capture 或被 flush）是例外。Geometry 預算（25,000,000）、PNG 大小、畫布邊長與整份草稿 4 MiB／100 題的上限不變。Human 回報在 iPad 上寫到畫布四到五成就被 256 筆擋下；設計分析的結論是必須 migration，但只需要改一個資料庫函式的兩個數字，不需要重新設計 schema。
- 指標位置取整到 0.1 個邏輯單位，每個點的 JSON 約減半。保存的點是取整後的取樣；v1.10.2 的「未保存的取樣距保存的筆畫不超過 0.5」改為相對於取整後的取樣。已經保存的圖不會被重新取整，未取整的舊座標仍然合法。
- 畫布下方新增容量提示：筆數、取樣點、geometry、整份草稿四項中最滿的一項達到 75%，或任何一項已經沒有一筆一般筆畫的餘裕時出現，並指出是哪一項。提示行不是「幾乎用完」時，一筆一般筆畫（保存後不超過 256 個點、相鄰兩點不超過 48 個邏輯單位）保證不會被拒絕。75% 以下不顯示，這是實作時的選擇。拒絕訊息依上限分開，數字以千分位顯示。
- 整份草稿的大小改在接受變更時檢查，量法與 save-quiz-draft 相同。超過 4 MiB 且讓草稿變大的變更不加入，畫布旁與頁面上方都說明原因；不讓草稿變大的變更一律接受。先前是本機先接受、同步時才失敗。
- 筆畫進行中的畫法：已完成的筆畫保留成一張整頁共用的離屏點陣圖，每次指標移動只貼上它再畫進行中的這一筆；離屏圖無法使用時退回完整重畫。被接受的一筆由擁有者交回筆畫時完整重畫一次（先前是兩次）；被拒絕的一筆立刻依已接受的筆畫重畫。取樣與提交的程式沒有改，三種畫法保存出逐值相同的筆畫。v1.10.1 的「正式提交等於畫布上已完成的筆跡」不變。
- Migration `20261013142522_drawing_point_budget.sql` 重新定義 `private.v4_strokes_shape_valid`，與前一次定義只差兩行（`> 256` → `> 16000`、`> 6000` → `> 32000`）；沒有表、policy、grant 或資料的變更。這個函式在正式提交時檢查每一個保存的答案；草稿儲存不經過它，儲存時逐題檢查的是 save-quiz-draft。本機資料庫驗證：19 個 migration 依序套用，函式的屬性前後相同，security.sql 通過。需要重新部署的 Edge function 是 ai-drawing、ai-grade、ai-responses、save-quiz-draft、submit-quiz。順序是 migration、Edge、最後 Pages；資料庫與 Edge 的上限放寬後不再調低。Production：migration 以 CLI 先 dry-run 再套用一次（清單 18 → 19）；Edge function 為 ai-drawing 22、ai-grade 22、ai-responses 24、submit-quiz 10、save-quiz-draft 8，部署內容與 candidate 逐檔相同，runtime health 5／5；其餘六個 function 未部署。除了以 CLI 套用這一支 migration，沒有對資料庫執行任何 SQL（包含讀取）。
- 沒有改變：drawing schema 與保存格式、已經保存的圖、v1.10.2 的取樣精簡規則、同步的時機與協定、正式提交與評分的流程。沒有題庫、generated canonical context、Auth／RLS／secrets／provider configuration 或 dependency delta。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- 量測（合成筆畫、本機、桌面 headless 瀏覽器；沒有實機資料）：取整後一題 2,048 筆短筆畫由 483 KiB 降為 284 KiB；筆畫進行中處理一次移動，Chromium 在已有 2,048 筆時由 12.1 ms 降為 0.5–0.7 ms，WebKit 由 26 ms 降為 5–6 ms；放開一筆的時間仍隨取樣點成長（Chromium 37.1 ms 對 38.1–48.4 ms，WebKit 79 ms 對 59–60 ms）；單題在 geometry 預算附近的 rasterize 加 PNG 在本機約 0.2–0.3 秒。
- Local gates：108 files／1,654 tests 全部 PASS、零 skipped（新增 8 個測試檔、61 個測試）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Browser 證據使用本機受控 fixture，Chromium 與 WebKit、device pixel ratio 1 與 2：680 項情境檢查全部通過，包含進行中的畫面與完整重畫逐位元相同、四種上限的拒絕與提示、三種寬度的版面。v1.10.2 取樣情境的回歸在 Chromium 為 62 項全過；WebKit 為 61 項通過、1 項未通過，那一項是針對小數座標寫的縮減量期望，WebKit 的滑鼠只回報整數像素，v1.10.2 的 build 在 WebKit 得到相同的數字。
- Classifier：security-ai／Risk C／providerCanaryRequired=true（rasterizer 的共用檔有變更）。Human 選擇以一次付費的 AI 評分驗證：專用的 release-canary 帳號在 `discrete-math-ch1-counting-examples` 的 q01 畫 4 筆、7,511 點並正式提交一次（9.0 秒）；按下提交時的本機答案、最後一次被接受的儲存與伺服器讀回的答案，筆數、點數與筆畫 SHA-256 都相同；結果頁與練習紀錄重建的畫面與提交前的畫布 0 個像素不同；只有 q01 由 AI 評分（一次付費呼叫，依程式路徑推定）。這驗到取樣點上限，沒有驗到 16,000 筆的上限。
- 已知限制：沒有 iPad／Apple Pencil 實機驗證；放開一筆與每次同步的處理時間隨內容成長；同步仍是每次上傳整份草稿、資料庫每次重寫全部答案列；整份草稿 4 MiB 的上限沒有改，題數多時會先碰到（手寫題最多的題庫是 26 題；合成模型中每題都寫滿時多數超過 4 MiB）；本機快取可能超過 localStorage 的配額；多題都接近 geometry 預算時，正式提交可能超過 Edge function 的 CPU 時間上限而需要重試；整份草稿已滿時打字題與選擇題的原因只顯示在頁面上方。4 MiB 的上限依 human 的決定這一版不擴大，之後另開 capacity／sync 架構的工作（逐題或增量同步、避免每次同步整份草稿、payload 與儲存效率、是否調整整份草稿的上限）。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 為 1.11.0。設計分析、量測、驗證證據、production 驗收紀錄與已知限制見 [v1.11.0 delivery](docs/v1.11.0-delivery.md)。

## 1.10.2 — 手寫筆畫取樣點精簡

Production acceptance：2026-10-12（Asia/Taipei）。已接受的 runtime candidate 為 `d410196434907d1fb567d50e39aaba7a5048bdba`；production version 為 1.10.2。基準 immutable v1.10.1（tag object `e382d9f5455b6f155582c8ea7de6649d1cee94ca`／peeled `e27ffdae2d0ce3d46c40143474bfcdd7e9bb38bb`）。Documentation closure 的 commit 與 exact CI、closure-SHA Pages parity 與 annotated tag 仍須完成各自的後續 gate，詳見 [v1.10.2 delivery](docs/v1.10.2-delivery.md)。

- 手寫筆畫在畫的當下精簡密集的指標取樣。先前每一個 pointer 事件都存成一個點，沒有任何篩選。現在一段連續的取樣若都落在「上一個保留點到最新取樣」這條線段的 0.5 個邏輯單位內、線段不超過 24 個邏輯單位，就只保留兩端；第一個不符合的取樣讓前一個取樣成為保留點。距離是到線段而不是到直線，所以折返的筆畫會保留折返點。
- 保存的點都是實際收到的取樣，順序不變；筆畫起於落筆點、止於抬筆點；每一個沒有保存的取樣距保存的筆畫不超過 0.5 個邏輯單位，也就是顯示、儲存與 rasterize 所用的那張圖的半個像素。相距超過 24 個邏輯單位的取樣照原樣保存，所以用少數事件畫出的筆畫與先前相同。
- 筆畫的最後一點永遠是最新的取樣，畫布顯示的就是當下會被保存的筆畫；v1.10.1 的「正式提交等於畫布上已完成的筆跡」不變。橡皮擦筆畫同樣處理。
- 沒有改變：每題 256 筆、6000 個取樣點的儲存上限與提示、drawing schema 與保存格式、正式提交與評分的流程、已經保存的圖。沒有題庫、generated canonical context、Edge function、migration、Auth／RLS／secrets／provider configuration 或 dependency delta；以 import graph 確認變更的路徑不在任何 Edge function 可到達的檔案內。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- 量測分兩種來源。合成的手寫模型（沒有實機錄製資料）：120 Hz 的觸控筆以一般速度寫 256 筆，取樣點由 11,565 降為 3,857（每筆約 45 → 15），原本 130 筆就到 6000 點，現在 256 筆都放得下；慢速書寫由 74 筆到 223 筆；以整數 CSS 像素回報的滑鼠為 1.3–1.8 倍。真實指標事件（Playwright 的滑鼠路徑，本機 fixture）：三條密集曲線 863 個取樣存成 77 點；單一 6,601 個取樣的筆畫存成 773 點，先前會被上限拒絕。0.5 與 24 這兩個數字是判斷，不是實機量測的結果。
- 256 筆的上限沒有改變，在多數模型情況下會變成先碰到的限制；提高它需要 migration，不在本次範圍。
- Local gates：100 files／1,593 tests 全部 PASS、零 skipped（新增 17 個）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。新增與修改的測試檔配上 v1.10.1 的畫布為 4 failed／24 passed。Browser 證據使用本機受控 fixture，以真實指標事件比對收到的取樣、保存的筆畫與畫布像素。
- Classifier：security-ai／Risk C／providerCanaryRequired=false。沒有 provider canary，也沒有任何 provider 呼叫。
- Candidate CI [38257740645](https://github.com/LukeTsengTW/learnforge/actions/runs/38257740645)、Pages [38258278947](https://github.com/LukeTsengTW/learnforge/actions/runs/38258278947)／deployment 7015664756 全 PASS；production manifest 與 navigation 為 1.10.2／candidate SHA。沒有部署任何 Edge function：11 個 Edge function 的 revision 未變，依據是 Pages dispatch 前、部署後與 production review 時的 function metadata 讀取。正式站未登入的驗收（28 項檢查 PASS）：Library 7 current quizzes、Author 為 Valid、13/13 Student／Answer Preview、手寫 regression 情境在 1440 與 360 各一題且 Answer Preview 重建的畫布與作答畫布相同、無 document overflow；KaTeX errors、first-party console errors、page errors、CSP violations 皆為 0，16 個 request 全是對 Pages 的 GET。
- 取樣精簡在 production 的觀察（未登入，Author 的 Student Preview，從頁面外部計數）：1440 寬的三筆，畫布收到 379／302／4 個取樣，重畫時的折線為 27／40／4 點；360 寬的一筆 505 個取樣為 31 點；Answer Preview 的 PNG 與折線點數都與作答畫布相同，沒有出現提示。Independent reviewer 另以不同的題目與筆畫觀察到 301／201／5／151 個取樣重畫為 77／35／5／11 點。這個觀察數的是 Author Preview 重畫的折線，不是保存的答案。
- 略過的階段（release review 核定）：backend sync 與 Edge runtime health（沒有 backend delta）、authenticated canary。登入後的練習頁、草稿儲存與正式提交搭配精簡後的筆畫，在 production 的這個部署上沒有執行過，只有本機證據；canary 帳號沒有被使用。
- Production 的變更只有一次 Pages 部署。所有 production request 都是未登入的 GET，加上 Edge function 清單的讀取；沒有登入、沒有寫入使用者資料、沒有執行 SQL、沒有列出 secrets、沒有讀取 function log。
- 已知限制：沒有 iPad／Apple Pencil 實機驗證；效益數字來自模型與滑鼠路徑；登入後的路徑在 production 沒有搭配這個版本執行過；production 的觀察數的是重畫的折線；AI 評分所見的圖可能在邊緣像素上與未精簡時不同，沒有比較過評分結果；已保存的圖不會被重新精簡。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 為 1.10.2。調查、量測、production 證據與 release-process 記錄見 [v1.10.2 delivery](docs/v1.10.2-delivery.md)。

## 1.10.1 — 手寫作答提交與畫布同步修正

Production acceptance：2026-10-12（Asia/Taipei）。已接受的 runtime candidate 為 `46e2e3ebe42f81519522d063d8facb63ef9dd6d3`；production version 為 1.10.1。基準 immutable v1.10.0（tag object `af0d71171bf15884c798abaea091ccfeae29c50a`／peeled `b5a1b3f7da750d6aaa225b519a41fda7a1a22499`）。Documentation closure 的 commit 與 exact CI、closure-SHA Pages parity 與 annotated tag 仍須完成各自的後續 gate，詳見 [v1.10.1 delivery](docs/v1.10.1-delivery.md)。

- 修正：正式提交的手寫內容可能少於畫布上所見。在 v1.10.0 重現出四種情況——筆畫超過手寫儲存上限（每題 256 筆／6000 個取樣點）後的筆畫只留在畫布上、不在答案內；提交進行中畫的筆畫在該次提交失敗後仍留在畫布上；草稿儲存已被 server 套用但回應遺失時，提交的是較舊的那一版；其他分頁或裝置改寫草稿時，提交的是對方的草稿。
- 一般的 debounce 與儲存進行中的 race（最後一筆後立刻提交、autosave 尚未執行、較舊的儲存仍在進行、連續快速多筆、作答方式來回切換）在 v1.10.0 已經正確，這次沒有改變它們的行為，另加 regression 測試固定下來。
- 答案更新現在有同步的結果（接受、被上限拒絕、其他原因未收下）。畫布只保留被接受的變更；沒有被接受時還原並顯示原因，已接受的筆畫不會消失。提交進行中畫布不接受新筆畫。
- 提交邊界：提交時仍在進行的那一筆會先完成並納入，若被拒絕則不提交並顯示原因；提交只會送出按下提交時持有的草稿，同步後若被不同的 server 草稿取代則不提交，請使用者確認。
- 較舊的儲存不再把較新的本地內容換掉：server 的新版本若等於本頁自己送出但尚未確認的內容，只採用新版本並保留本地較新的答案。其他 client 的內容仍由 server 版本優先。
- 手寫儲存上限、drawing schema、正式提交與評分的語意都沒有改變。提高上限需要 migration，不在本次範圍。沒有加入任何 timeout、固定等待或輪詢。
- 沒有題庫、generated canonical context、Edge function、migration、Auth／RLS／secrets／provider configuration 或 dependency delta；以 import graph 確認本次變更的路徑不在任何 Edge function 可到達的檔案內。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- Local gates：98 files／1,576 tests 全部 PASS、零 skipped（新增 25 個）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。新增的測試檔在 v1.10.0 的 source 上為 16 failed／8 passed。Browser 證據使用本機受控 fixture（真正的 application shell 與頁面內的記憶體 server，由 Playwright 從磁碟回應每個 request），八個情境以筆數、點數、序列化雜湊與畫布像素比對提交前後。
- Classifier：security-ai／Risk C／providerCanaryRequired=true。觸發 provider 規則的是兩個檔名含 provider 的舊 React context 元件（沒有任何檔 import），實際變更沒有 provider 或評分行為的改變；human supervisor 決定豁免，不做付費 provider canary。
- Candidate CI [38192246973](https://github.com/LukeTsengTW/learnforge/actions/runs/38192246973)、Pages [38192838517](https://github.com/LukeTsengTW/learnforge/actions/runs/38192838517)／deployment 7004704317 全 PASS；production manifest 與 navigation 為 1.10.1／candidate SHA。沒有部署任何 Edge function：六個 Edge revisions 仍為 20／21／21／23／7／9，依據是 Pages dispatch 前、部署後與 canary 後的 function metadata 讀取。正式站未登入的驗收：Library 7 current quizzes、Author 為 Valid、13/13 Student／Answer Preview、手寫情境在 1440 與 360 各一題且 Answer Preview 重建的畫布與作答畫布相同、無 document overflow；KaTeX errors、first-party console errors、page errors、CSP violations 皆為 0，16 個 request 全是對 Pages 的 GET。
- Production submit canary（既有專用 release-canary identity，`discrete-math` revision 2 的 q2）的做法是 human 的決定。正式提交看得見的手寫筆跡一定會觸發付費 AI 評分，而這個版本沒有 provider 呼叫的授權；human 在只用橡皮擦（不呼叫 provider、看不到筆跡）、看得見的筆跡（一次付費 AI 評分）與不做三個方案中選了第一個。結果：橡皮擦 4 筆／32 點，最後一筆放開後 74 ms 完成提交的兩次點擊，點擊之前沒有任何儲存送出過這些筆畫；`save-quiz-draft` 1 次、`submit-quiz` 1 次皆 HTTP 200；提交當下的本機狀態、最後一次儲存與 server 保存的答案列，筆數、點數、工具序列與序列化 SHA-256 相同。Provider calls 0，由回應（五題計算題全是 system／unanswered、cached 為 false）與 source 推得；沒有讀取 function log、SQL 或 provider 用量紀錄。
- 與原始驗收要求的出入：畫面上看不到筆跡；結果頁把這筆作答顯示為未作答，沒有重建的圖可以目視比對；一致性只有結構比對；提交是兩次點擊；human 登入了兩次。第一次嘗試在開啟題庫那一步因點擊 timeout 停止（停止後頁面為 hidden，推論是 Chrome 視窗被遮住），對 production 的寫入為 0；本機演練重現同樣的失敗後，第二次嘗試只多加四個 Chrome 啟動參數。
- Production mutation evidence 的範圍：這次驗收沒有執行 SQL，也沒有資料庫 row count／hash 的前後比對。觀察到的寫入是 `get_or_create_quiz_draft` 1 次、`save-quiz-draft` 1 次、`submit-quiz` 1 次，與 application 自動送出的 account-recovery-code status 查詢；ai-quota 自動 GET 3 次，其 housekeeping 的 affected rows UNKNOWN；rubric 的 cache／呼叫紀錄與最終 judgment 依 source 推得，沒有觀察。Canary 帳號之後有兩筆已提交的作答與兩份保留的草稿，沒有 cleanup，沒有登出。
- 已知限制：達到上限後無法再加筆畫，只會看到提示，上限本身未改（提高上限需要 migration 與 human 的決定）；畫圖題沒有提交前的完成步驟；沒有 iPad／Apple Pencil 實機驗證；看得見的手寫筆跡的正式提交與 AI 評分在 production 沒有這個版本的 end-to-end 證據。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 為 1.10.1。調查、contract、production 證據與 release-process 記錄見 [v1.10.1 delivery](docs/v1.10.1-delivery.md)。

## 1.10.0 — 離散數學第三章：集合論－例題練習

Production acceptance：2026-10-11（Asia/Taipei）。已接受的 runtime candidate 為 `46543f7c2e2cf66a2bc3231eef6a055b6daf074f`；production version 為 1.10.0。基準 immutable v1.9.0（tag object `03e71a6523f1f5b60511004d7ce6c8f713384b65`／peeled `61c4c40105af2f8d643f6b7d264c9f17fdfa3dea`）。Documentation closure 的 commit 與 exact CI、closure-SHA Pages parity 與 annotated tag 仍須完成各自的後續 gate，詳見 [v1.10.0 delivery](docs/v1.10.0-delivery.md)。

- 新 bundled quiz family `discrete-math-ch3-set-theory-examples/1`：依 24 頁講義《03 集合論_2026》（2,964,329 bytes，SHA-256 `8b3839d1a0276751131e376c67472e9d4ad65fa7353610c757359d5354fa99a3`）收錄 13 個 worked-example units，13 calculation／drawing-capable、150 分、1200×900，支援打字與手寫。全庫 9 revisions／7 current／103 questions／103 canonical contexts。
- 來源對應：24 頁逐頁對照頁面影像（text layer 每頁只有 5–162 個字元）。13 個 unit 位於 p2–3、4、6、7、8、10、15、16、17、20、21、22、23；例題 3.1 橫跨 p2–p3，仍是一個 unit。不成題的頁：p1 章節標題；p5、p11 定義；p9、p12 定義與示意用的 Venn 圖；p13–14 集合論定律；p18–19 示意用的 Venn 圖；p24 結尾頁。來源本身有小題標號的是例題 3.15 (a)–(g)、Exercise 3.2 #11 (a)–(d) 與 p23 的 (a)(b)(c)；q01–q03 的小題標號是題庫為組織作答所加。講義中的 Venn 圖沒有以圖片重現。
- 答案：13 題以不讀題庫檔的獨立腳本重算 67 項（10! 全列舉、2¹⁸ 組三集合逐行驗證推導、對偶代換與恆等式、De Morgan 逐步等價），全部與講義一致，沒有 source answer 與數學結果衝突。來源筆誤只有兩處，題庫採數學上正確的寫法：p7 的二項係數和最後一項前少一個加號；p23 (c) 的算式把 −|A∩C| 印成 −|A∪C|（代入值與最終答案 5542 正確，solution 有註明）。p6 的「不是…就是…」是句型，不是筆誤。
- 配分依工作量：q01–q13 為 10／6／16／10／8／16／16／12／6／8／10／18／14。每題 rubric 分數總和等於題目配分，並接受數學上等價且推理完整的解法。沒有提供 hint。
- 既有八個 revisions、90 questions、90 canonical contexts 均保留，`discrete-math-ch1-counting-examples/1` 的 source 未變。`ch1-counting.test.tsx` 與 `discrete-math-exercises-2026.test.tsx` 只把之後新增的 family 排除在各自的 baseline 之外，原有雜湊未變；新測試另釘住 90 題 baseline。功能沒有 component／CSS／script、migration、Auth／RLS／secrets／provider configuration 或 dependency delta。
- Generated canonical context 是 Edge-visible artifact（90 → 103，diff +845／−0）；以目前 source 重算的 runtime import graph 確認僅 ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz 可到達它。Classifier：security-ai／Risk C／providerCanaryRequired=false。六個 Edge revisions 20／21／21／23／7／9 已在 Pages 之前各部署一次，完成 source／103-context 驗證（舊 90 筆保留、新增 13 筆）與 runtime health；migration delta 0。
- Local gates：95 files／1,551 tests 全部 PASS、零 skipped；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Feature browser 證據涵蓋 Library、Author、Student／Answer Preview 13/13 與 360／768／1440。本機的 AdGuard 會改寫 localhost HTTP，所以 browser 證據不是用 dev server 取得，而是把 working tree build 到 repository 之外、由 Playwright 從磁碟回應每個 request 的零網路方式；這是相對既有做法的 deviation；真實 deployment 上的 browser 證據由下面的 production acceptance 補上。Pre-release 階段沒有登入後的證據；新題庫的 submit 與 AI 評分沒有端到端驗證。
- 已知且不在本次處理的版面行為：內容寬 345px（360px 視窗加傳統捲軸）時有 4 個 display 公式在自己的框內捲動 2–15px；360px 時部分 inline 公式換行後，後面的標點落到下一行。document／body overflow 為 0，既有題庫有相同的共用樣式行為。
- Candidate CI [38133987396](https://github.com/LukeTsengTW/learnforge/actions/runs/38133987396)、Pages [38146242320](https://github.com/LukeTsengTW/learnforge/actions/runs/38146242320)／deployment 6996759743 全 PASS；production manifest 與 navigation 為 1.10.0／candidate SHA。正式站 Library 7 current quizzes、新題庫在 Author 為 Valid、13/13 Student／Answer Preview、360／768／1440 無 document overflow；KaTeX errors、raw LaTeX、first-party console errors、page errors、CSP violations 皆為 0。
- Production draft canary（既有專用 release-canary identity，`discrete-math-ch3-set-theory-examples/1` 的 q01）：typed／drawing persistence 與 mode isolation PASS，`save-quiz-draft` 3 次皆 HTTP 200，submit 與 provider calls 皆為 0，其餘 12 題 untouched。保留一份 draft attempt 與 q01 的 answer state，沒有 cleanup。Submit／AI 評分／tutor 沒有新的 end-to-end provider canary；classifier 不要求。
- Production mutation evidence 的範圍：這次驗收沒有執行 SQL，也沒有資料庫 row count／hash 的前後比對。瀏覽器端觀察到的 intentional mutation 限於 canary draft 與 q01 的 answer，沒有觀察到其他明確的 application mutation。登入後的頁面自動 GET ai-quota 3 次，其 backend housekeeping 可將已過期的 reservation 標為 expired，實際 affected rows UNKNOWN；account-recovery-code 的 6 次 POST 依 client／source contract 判定為 status／read-style 呼叫，沒有 DB evidence 可宣稱絕對零寫入。
- Package／lock root version 與 visible navigation label 為 1.10.0。來源對應、production 證據與 release-process 記錄見 [v1.10.0 delivery](docs/v1.10.0-delivery.md)。

## 1.9.0 — 離散數學習題 Ch1、Ch3、Ch5、Ch7、Ch8

Production acceptance：2026-10-10（Asia/Taipei）。已接受的 runtime candidate 為 `20940d942a402eaaa7f4e4de53cf40104c88303e`；production version 為 1.9.0。基準 immutable v1.8.0（tag object `331383ac77aa8492db0abc4d2c3ab7142b67148f`／peeled `e4ca50ec3668046cdc4430befc434799c89922bb`）。Documentation closure 的 exact CI、closure-SHA Pages parity 與 annotated tag 仍須完成各自的後續 gate，詳見 [v1.9.0 delivery](docs/v1.9.0-delivery.md)。

- 新 bundled quiz family `discrete-math-exercises-2026/1`：依五份 2026 習題解答講義（Ch1、Ch3、Ch5、Ch7、Ch8，共 15 頁）收錄 13 個 exercises／36 個小題，13 calculation／drawing-capable、150 分、1200×900，支援打字與手寫。全庫 8 revisions／6 current／90 questions／90 canonical contexts。
- 來源對應：Exercises 1.1–1.2 #21 僅有講義印出的 (a)(b)；Exercises 7.1 #5 僅有 (a)(c)(e)(f)，標號沿用原題，不補造小題；Ch8 未編號的 triplets 題列為補充題。Ch8 p.2／p.4 的條件依頁面影像採 ≥／≤（text extraction 會遺失底線）。講義中的 Venn 圖、對應圖與手繪有向圖未以圖片重現，改以文字或公式表達。
- 答案：13 題 canonical answers 以獨立列舉與精確算術重算 57 項，全部與講義一致，未發現講義答案有誤；講義只給算式之處另補數值。Exercises 3.1 #12(c) 保留講義答案 63（2⁶ − 1，不計空集合）；rubric 另接受明確以空集合論證而得的 64。
- 配分依工作量：q01–q13 為 8／8／6／20／10／12／16／10／15／16／8／12／9。每題 rubric 分數總和等於題目配分，並接受數學上等價且推理完整的解法。沒有提供 hint。
- 共用樣式修正：行內數學式（`.markdown p > .katex` 等）以下標結尾時，KaTeX 會在 inline-block 外多出 2px 而出現水平捲軸；加入 `padding-inline-end: 2px`。新題庫 22 處與既有題庫 7 處（ch1 3、discrete-math/2 3、boolean-algebra 1）的捲軸消失，沒有其他版面變動。
- 既有七個 revisions、77 questions、77 canonical contexts 與 current `discrete-math/2` 均保留；`ch1-counting.test.tsx` 原有的 51 題 baseline 雜湊未變，新測試另釘住 77 題 baseline。功能沒有 migration、Auth／RLS／secrets／provider configuration 或 dependency delta。
- Generated canonical context 是 Edge-visible artifact；runtime import graph 確認僅 ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz 需要部署。Classifier：security-ai／Risk C／providerCanaryRequired=false。六個 Edge revisions 19／20／20／22／6／8 已在 Pages 之前各部署一次，完成 source／90-context 驗證與 runtime health；migration delta 0。
- Local gates：94 files／1,513 tests 全部 PASS、零 skipped；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。Browser 證據涵蓋 Author Student／Answer Preview 13/13、Library、本機隔離 Supabase stack 上的登入作答與草稿還原，以及 360／768／1440。新題庫的 submit 與 AI 評分沒有端到端驗證。
- Candidate CI [38039509456](https://github.com/LukeTsengTW/learnforge/actions/runs/38039509456)、Pages [38050771887](https://github.com/LukeTsengTW/learnforge/actions/runs/38050771887)／deployment 6980492964 全 PASS；production manifest 與 navigation 為 1.9.0／candidate SHA。正式站 Library 6 current quizzes、新題庫 13/13 Student／Answer Preview、360／768／1440 無 document overflow；KaTeX errors、raw LaTeX、first-party console errors、page errors、CSP violations 皆為 0。
- Production draft canary（既有專用 release-canary identity，`discrete-math-exercises-2026/1` 的 q01）：typed／drawing persistence 與 mode isolation PASS，`save-quiz-draft` 3 次皆 HTTP 200，submit 與 provider calls 皆為 0。保留的 production delta 為 attempts +1／answers +1，既有資料列不變，沒有 cleanup。Submit／AI 評分／tutor 沒有新的 end-to-end provider canary；classifier 不要求。
- Package／lock root version 與 visible navigation label 為 1.9.0。來源對應、production 證據與 release-process 記錄見 [v1.9.0 delivery](docs/v1.9.0-delivery.md)。

## 1.8.0 — 電子白板橡皮擦大小與範圍預覽

Production acceptance：2026-10-10（Asia/Taipei）。已接受的 runtime candidate 為 `621fb86e1cf82ad9f976fd2bd99435c6002f1fc8`；production version 為 1.8.0。Documentation closure 的 exact CI、closure-SHA Pages parity 與 annotated tag 仍須完成各自的後續 gate，詳見 [v1.8.0 delivery](docs/v1.8.0-delivery.md)。

- 畫筆與橡皮擦尺寸獨立保留：pen 預設 4、UI range 1–24；eraser 預設 24、UI range 4–100，最大值提高為 100 logical px。
- 橡皮擦使用圓形 DOM preview，依 Canvas logical-to-CSS projection 同步縮放與定位；Light／Dark 及 360／768／desktop viewport 均已驗收。
- Width-100 eraser 可實際擦除筆跡，沿用 `destination-out`。Preview 不加入 stroke/history、bitmap replay 或 PNG；undo／redo／clear 與 question isolation 已驗證。
- Stored drawing width compatibility 為 1–100，client／shared server validation 與 raster/PNG flow 支援 width 100、拒絕 101；歷史較小的 eraser width 仍合法。Pen UI 上限維持 24。
- 沿用 `DrawingStroke { tool, color, width, points }`，不新增 `eraserSize` persistence field，不變更 DrawingStroke persisted schema。
- Production DB helper migration `20261009025324_drawing_width_100` 與精確五個 affected Edge Functions 已完成，保留原 ACL、JWT policy 與 dimension／stroke／point／geometry／PNG resource ceilings。
- Canonical CI、PostgreSQL regression、width-100 production provider canary 與 production browser acceptance 通過；真實 iPad／Safari／Apple Pencil 由 human acceptance 確認 PASS。無 dependency、quiz inventory 或 generated AI context change。

## 1.7.0 — 離散數學第一章例題與 Author Preview 手寫作答

Candidate production accepted／documentation-only closure：2026-10-08。Accepted candidate `45b9bfb765792a43425ccc2e2c434c403da2360a`，CI 37759361106、Pages 37762035891／deployment 6932859081 全 PASS，production manifest 與 navigation 為 1.7.0／candidate SHA。Immutable v1.6.3 不變；本次只記錄驗證結果，準備 final closure deployment。Closure SHA／CI／final Pages／parity 由 post-commit report 核對；v1.7.0 tag 尚未建立，需另行授權，沒有 GitHub Release。

- 新 bundled quiz family `discrete-math-ch1-counting-examples/1`：依 `01 計數的基本原理 - 2026.pdf` 收錄 26 題 worked examples、26 calculation／drawing-capable、150 分、1200×900，支援打字與手寫。全庫 7 revisions／5 current／77 questions／77 canonical contexts。
- 保留 PDF 原文差異：p.4 社會學／人類學；例題 1.21 僅 (a)/(c)；p.24 三個係數計算同屬可見的 (a)；p.33 使用 `print(i * j + k)`，例題 1.39 答案為 1540。
- Author Student Preview 依 `requiresV4Draft` 選擇 schema 2，使用完整 PracticeAnswer／CalculationAnswerV4。兩個緩衝保留，Answer Preview 只顯示 active buffer，計算題維持 local/manual semantics；沒有新增作答 persistence 或 provider 呼叫。
- Author grid 使用 `grid-template-columns: minmax(0, 1fr)`，避免較長 revision controls 在 360px 撐寬頁面。測試以限定 accessible queries 與獨立 preview roundtrip 消除重複詳解渲染，保留預設 5 秒與所有清除／無網路／無儲存斷言。
- 舊六份 Quiz、51 questions、51 canonical contexts 與 current `discrete-math/2` 均保留。功能沒有 migration、Auth／RLS／secrets／provider configuration 或 dependency delta。
- Generated canonical context 是 Edge-visible artifact；runtime import graph 確認僅 ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz 需要部署。Risk C／providerCanaryRequired=false；部署順序為 candidate CI → 六個 Edge → Pages → production smoke。
- Feature/fix CI [37753146630](https://github.com/LukeTsengTW/learnforge/actions/runs/37753146630)：93 files／1,433 PASS，零 skipped，全部 stages success。來源瀏覽器證據與 release candidate 邊界見 [delivery](docs/v1.7.0-delivery.md)。
- Candidate 正式站 26/26 Student／Answer Preview、schema-1 legacy／既有 discrete-math/2 schema-2／新 quiz schema-2、buffer retention／question isolation／active-only／reset、360/768/1440 無 document overflow、KaTeX／非預期 rendered raw TeX／application console／page errors／LearnForge CSP 全 PASS。六個 Edge revisions 18/18/18/20/4/6 已在 Pages 前部署一次；ai-grade CLI extraction limitation 經 independent API source inspection 確認，沒有 safety bypass 或 redeployment。零 provider canary／user-data mutation；本功能沒有真實 iPad／Safari／Apple Pencil 驗證聲明。

## 1.6.3 — Apple Pencil 手寫穩定性與 iPad 相容性

Verified 2026-10-07. Accepted candidate `f93ad94dc9d5843ab897dfe2313ecb51f4c6ca34`; **REAL APPLE PENCIL PASS WITH SCRIBBLE DISABLED**. Docs-only closure snapshot; final closure CI／Pages／manifest／unsigned annotated tag identity are recorded by post-commit verification. No GitHub Release.

- Reproduced two independent races against unchanged v1.6.2 production code: delayed old lostpointercapture terminates a new stroke reusing pointerId 31; delayed controlled acknowledgement causes B to replace A. The baseline regression run failed 8 of 39 tests, including the exact reused-ID sequence and explicitly deferred parent props.
- Separate pointerup, pointercancel and capture-loss recovery. Ignore lostpointercapture while the canvas owns the new capture; normal up/cancel rely on implicit release, while imperative flush retains explicit release and commits once.
- Synchronously accumulate committed strokes before parent acknowledgement; changed controlled props remain authoritative. Preserve pending ink during acknowledgement and immediately repaint local history operations. No schema change, timers, throttling or input lock.
- Added 15 focused tests: same/different IDs, rapid A–D, palm between/held, 24 dot contacts, genuine/stale capture loss, flush, bounds, deferred acknowledgement, replacement/clear and history/export. Focused 70/70; canonical 91 files / 1,340 tests; TypeScript, zero-warning lint, diff-check and Pages-base build passed before feature commit.
- Feature c89bbc4317b11dc2c8c5a4099182c2263778a3a6. Frontend-only; dependencies, quiz/context, grading, Edge/DB/RLS/Auth/secrets and v1.6.2 are unchanged. Candidate identity and deployed evidence are recorded separately after source-bound gates. See [delivery and required device checklist](docs/v1.6.3-delivery.md).
- Retain the v1.6.3 navigation label correction and zero-displacement pen/eraser dot rendering, including persisted identical points and PNG replay.
- User's real iPad + Apple Pencil trace completed the previous stroke and cleared pending, but delivered neither pointerdown nor stylus touchstart for failed rapid re-contact with Scribble enabled. Disabling Scribble eliminated that observed failure on the diagnostic candidate. This is device-specific compatibility evidence, not a pointer-handler regression or a claim that Scribble-enabled handwriting is fixed.
- Add an iPadOS-only「Apple Pencil 使用提醒」near drawing instructions in both input modes, linking to [Apple's official 設定 > Apple Pencil > 隨手寫 guidance](https://support.apple.com/zh-tw/guide/ipad/ipad355ab2a7/ipados). The app cannot inspect that setting. Remove temporary event-trace instrumentation/UI and its debug-specific tests; preserve all product fixes.
- Final accepted candidate: focused 89 PASS／91 files・1,359 full tests／10/10 clean source-bound gates; TypeScript／lint／Pages-base build／diff-check PASS. CI [37640405750](https://github.com/LukeTsengTW/learnforge/actions/runs/37640405750)、Pages [37640714852](https://github.com/LukeTsengTW/learnforge/actions/runs/37640714852)／deployment 6913318153 success. Complete controlled browser matrix 24 groups／24 stationary dots including PNG、rapid A–D／palm、KaTeX／Light+Dark／responsive PASS.
- User explicitly accepted the exact deployed candidate on actual iPad + Apple Pencil: notice/link correct; Scribble disabled; rapid `a b c d`／`i j t x`／stationary taps／20+ lift-recontacts／natural palm／separated-stroke math all PASS, without missing strokes, disappearing dots, phantom palm ink, pauses or input lock. This confirms the tested device's Scribble-off compatibility; it does not claim Scribble-enabled handwriting is fixed or a universal iPad defect.

## 1.6.2 — 行動裝置手寫 UX 修正

驗證日期：2026-10-07。狀態：candidate production／complete browser smoke PASS；docs-only closure preparation。Final closure SHA／CI／Pages／manifest 由 post-commit report 核對。

- DrawingCanvas 提供獨立的「輸入方式：標準／觸控筆優先」。標準接受 mouse／pen／touch；觸控筆優先在 pending ink／capture 前拒絕 touch，保留 mouse／pen 與未知 pointerType 的既有相容性。
- 既有 pointerId ownership 防止其他指標 append／finish；手掌不打斷 active pen。沒有 palm-size heuristics，這是應用程式 touch filtering，不宣稱硬體 palm rejection。
- canvas-frame／drawing-canvas 局部 touch-action、user-select、WebKit user-select／touch-callout 保護；canvas contextmenu preventDefault。工具與其他文字維持原有互動。
- learnforge:drawing-input-mode 僅存 standard／stylus；預設／無效值為 standard；storage 被封鎖仍可操作目前 canvas。
- CSS contract test 改用 node:path resolve(process.cwd(), 'src/styles/global.css')；原 focused scope 55/55、full 91 files／1,325 tests、TypeScript／lint／Pages-base build 通過。
- Feature bf2c7d3f45432796151fae9286720854aeb7c73b；無 dependency、quiz/context、schema、grading、Edge／DB／RLS／Auth／secret 變更。實際 release evidence 見 [delivery](docs/v1.6.2-delivery.md)。
- Candidate 3c2a7034eafe864563daac618030580581eef0d6：canonical clean/source-bound 10/10 gates、CI [37609915649](https://github.com/LukeTsengTW/learnforge/actions/runs/37609915649)、Pages [37610202192](https://github.com/LukeTsengTW/learnforge/actions/runs/37610202192)／deployment 6908021226、canonical production smoke PASS。Classifier Risk C／providerCanaryRequired=false 只因 package/lock root metadata 的保守 path rule，不表示 backend rollout；Edge deployment 零次。
- Windows clean-copy AI-context false drift 是 core.autocrlf=true 的 CRLF checkout；新 validation clone 僅設 local core.autocrlf=false，context byte 等同 baseline；沒有改 repo line-ending policy 或生成檔。
- 原 KaTeX smoke 在 parser「解析中…」時立即計數，preview 尚無 cards/Markdown。狀態等待 Valid／revision 2／Student Preview／正確標題與 MISSISSIPPI prompt 後出現 inline/display KaTeX；17 browser checks 與 6 Light/Dark layouts（360/768/1440）通過，零 raw TeX／KaTeX／console／CSP errors。
- Controlled pen/touch routing 與 native mouse evidence 通過；未取得真實 iPad Safari／Apple Pencil proof。零 user-data mutation；不建立 v1.6.2 tag／GitHub Release。

## 1.6.1 — 離散數學期中考計算題手寫

驗證日期：2026-10-07。狀態：exact candidate production verification PASS；docs-only closure preparation。Final closure SHA／CI／Pages／manifest 在 post-commit report 核對。

- 新增唯一 current `discrete-math/2`；同標題、11 題／100 宣告 points／6 single／5 calculation。q2–q6 各宣告 1200 × 900 drawing，沿用 CalculationAnswerEditor、schema 2 與 ai-grading-v4；其他題目內容與 rubric 不變。
- `discrete-math/1` 只改為 archived，歷史計算題仍 text-only／v3。Text/stroke buffers 在切換時保留；只有選取模式參與正式評分。
- Canonical context 40 → 51；全部原有 40 objects 不變，新增 11 revision-2 contexts。Tutor-context inventory test 從所有 bundled sources（含 archived）動態推導 exact identity sets，消除固定總數。
- Feature `b43c3120be1d9aa73a00e5971f90bac084d50f9a`／release-prep `9a7c5ce08a7cb780f66e6ae1e573de15141eaebd` 保留。兩個 obsolete current-capability assertions 以 exact-revision assertions 修正為新 commit `c8c84f89c8541a0e9a74ec666d983f7d198d0dad`，沒有 amend／rewrite。Affected 28 tests、TypeScript、full 1,300 tests、quizzes／context／imports 與 clean/source-bound ten release gates 通過。
- Exact candidate CI [37599748395](https://github.com/LukeTsengTW/learnforge/actions/runs/37599748395) 成功；Risk C／providerCanaryRequired=false。六個 Edge functions 同批部署，ACTIVE／JWT／完整 runtime module provenance／51-context hash 通過，其餘五函式不變。
- Initial Pages [37601057313](https://github.com/LukeTsengTW/learnforge/actions/runs/37601057313)／deployment 6906473959 成功；canonical production smoke、live revision-2 Author/Library、九個 deployed JS artifact byte comparisons、360／768／1440 layouts、Dark／KaTeX 與安全手寫 fixture 通過。文字／筆畫互保與 selected-mode authority 已驗證；未建立正式 practice attempt，未執行 live provider grading。
- 不變更 dependencies、drawing/grading architecture、DB/RLS/Auth/secrets；此 stage 不建立 v1.6.1 tag 或 GitHub Release。詳細 scope、hash、gates 與真實 rollout evidence 見 [v1.6.1 delivery](docs/v1.6.1-delivery.md)。

## 1.6.0 — Dark Mode

準備日期：2026-10-07。
狀態：replacement production deployment、canonical public smoke 與 authenticated read-only Dark Mode smoke PASS；docs-only closure preparation。Final closure commit／CI／Pages／manifest 在 post-commit verification report 核對；annotated v1.6.0 tag 未建立且需要另行授權。

- 新增全域 Light／Dark 主題，以 centralized semantic CSS tokens 與 root data-theme 套用至 navigation、surfaces、controls、quiz/result states、code、KaTeX 與 Author；保留原有 Light 配色。
- Header 的「深色模式」原生按鈕提供 aria-pressed、Enter／Space 操作與可見 keyboard focus，維持手機與平板排版。
- 明確選擇保存於 learnforge:theme，reload 與後續 OS theme 變更不覆寫；首次沒有有效偏好時使用 prefers-color-scheme。同步同源 head bootstrap 避免 saved-dark 載入時的 Light flash，沿用既有 CSP。
- Dark Mode feature commit 567039f236b751434f28b8664f61e0b66a09021f 與 release-prep b18d9460bf6d199ab04ccfcae3f59c566ad17fed 的 CI 通過。初始 Pages 成功，但 canonical smoke 拒絕 public-root bootstrap；remediation e3aaedb5badc34f9b64507ef5de5b06fa796c445 將相同 bytes 移至 /learnforge/assets/theme-init.js，維持 synchronous classic head script 與原有 theme semantics。
- 保留 jsdom test-harness failure、Node harness 修正／109 focused tests PASS，以及第二次 offline smoke failure 的完整歷史。後者實際是 AdGuard 注入 loopback HTML；原 stop report 將 linkedAssets 的 line 192 誤標為 static import。Canonical smoke/parser/security contract 未改，exact-file offline harness 與 production network smoke 均通過。
- Remediation CI 37575119526、replacement Pages 37575293906／deployment 6902285847 成功；clean source-bound ten gates／1,284 tests／production audit PASS。Light／Dark switching、Enter／Space／focus、reload persistence、Library filters 與 360／768／1440 的 quiz/result KaTeX previews 通過；system fallback 另由 production bootstrap bytes 的七個 controlled VM scenarios 驗證。
- 沒有 dependency、quiz content、scoring、AI context、Supabase／Edge／Auth／RLS 或 migration 變更；沒有 provider canary。v1.5.0 canonical release identity 與歷史文件保留。

## 1.5.0 — Discrete Mathematics midterm quiz

發布日期：2026-10-06。
狀態：v1.5.0 已部署至 production，初始 release identity 與必要 smoke 已通過；docs-only closure 的最終部署／身分驗證與 annotated tag 尚待完成。

- 上線 bundled「2025 Discrete Mathematics 期中考」discrete-math/1：11 題、宣告總分 100 分、6 題單選／5 題計算；沿用已審閱的題目、答案、解答與 rubric。
- Library／Home 題庫卡片改用宣告 totalPoints；deterministic maxPoints 的原有評分容量語意維持不變。
- Home featured quiz 固定為 boolean-algebra「布林代數基礎」，不受新增題庫的標題排序影響。
- Canonical AI quiz context 從 29 增為 40 contexts；原有 29 個 contexts 保留不變。
- 六個包含該 context 的 Edge bundles 已同步部署並驗證 ACTIVE／JWT／provenance：ai-tutor、ai-responses、save-quiz-draft、ai-grade、ai-drawing、submit-quiz；其餘五個 functions 未重新部署。Pages 隨後部署 exact v1.5.0 candidate SHA，public release.json 與 production smoke 已驗證。
- KaTeX 安全修復：direct dependency 改為 ^0.18.2，lockfile 解析為固定的 0.18.10；以最小 npm override 讓 rehype-katex／remark-math 相依鏈共用固定版本，排除 GHSA-238p-pmpm-9mq7。沒有新增套件或功能。
- Production 桌面導覽版本標籤為 v1.5.0；Home featured／總分、Library 四份題庫／搜尋／篩選／重設、360×800 排版與 Author math spot check 通過。使用既有 authenticated session 做唯讀檢查；沒有 provider 呼叫或正式作答／草稿／提交 mutation。
- 沒有 DB schema／migration／RLS／Auth／secret／provider configuration 變更；除了 KaTeX 及其必要的 commander 相依版本外，其他 dependency 維持不變。
- Release-prep CI 與 strict release checks 通過；machine classification 為 security-ai／Risk C／providerCanaryRequired=false。最終 docs-only closure SHA 與部署仍待建立／驗證，annotated v1.5.0 tag 尚未建立；詳見 [v1.5 delivery](docs/v1.5-delivery.md)。

## 1.4.0 — Quiz Library search and filters

發布日期：2026-10-05。

- 新增 client-side Library metadata 搜尋；標籤／科目選項依 current catalog 動態產生，題型篩選沿用既有六型。
- 搜尋與標籤、科目、題型採 AND 組合，保留原題庫順序。
- 無結果時提供空狀態與「清除篩選」，重設後恢復搜尋／篩選預設值及完整 current catalog。
- 原生 select／search controls 支援 responsive 排版、鍵盤操作與可見 focus。
- 沒有 DB、Edge、Auth、grading 或 provider 行為變更；不需要 provider canary。

## 1.3.0 — Multimodal calculation submission

發布日期：2026-10-03。

- 精確版本宣告手寫能力後，計算題可選打字或手寫；schema2 保留兩個 buffer，只有 active mode 參與評分。
- schema2 草稿透過 authenticated `save-quiz-draft` 保存，採 CAS；失敗不 fallback 至 legacy v3 writer。
- 新增 `ai-grading-v4` 正式提交：文字模式評 active text，手寫模式由 server rasterize active strokes，沿用 calculation rubric；DrawingQuestion 仍是不同路徑。
- 保留 schema1 與 `deterministic-v1`、`semantic-fill-v2`、`ai-grading-v3` 歷史相容；Result、History、Analytics 重建已保存的 v4 evidence，不重跑 AI。
- 正式 grading 與 personal Tutor quota 分離；空白保存 system/rule unanswered evidence，不需要 provider。AI 評分仍僅供學習參考。

## 1.2.0 — AI submission grading

- Grade all six question types in the submitted practice score. Calculation and drawing questions use server-validated AI rubric judgments with partial credit; blank answers are persisted as system unanswered evidence without an AI call.
- Persist rubric judgments for result, history, mistakes and analytics reconstruction. Historical `deterministic-v1` and `semantic-fill-v2` attempts keep their original grading behavior.
- Keep formal submission grading outside the personal Tutor credit quota. AI grading is a learning reference and may be mistaken.
- Preserve draft-and-retry behavior when provider, rasterization or trusted-evidence validation is unavailable.

## 1.0.0 — Release candidate, 2026-09-26

Public release remains blocked until real Turnstile credentials are configured and verified. No Pages deployment is included.

- Add one-time, 128-bit account recovery codes, current-password verification and Account settings.
- Add private recovery state, durable limits, an Auth transaction fence and session-aware recovery management.
- Support native Auth Turnstile tokens and server-verified recovery CAPTCHA; fail closed when recovery CAPTCHA is unconfigured.
- Add device-local practice backup review/export and conservative restore, with cross-device and cross-tab regression coverage.
- Tighten event-trigger grants, Auth policy, production CSP and workflow permissions; document privacy, security and release gates.

## 0.9 — Learning Analytics & Wrong-answer Review

Derive learning summaries and a focused review queue from versioned submitted attempts, without changing official results or using AI credits.

## 0.8 — Quiz Authoring Workspace

Add a local Markdown authoring workspace with import, validation, preview, revision checks and export.

## 0.7 — Multimodal Drawing Analysis

Add server-rendered drawing analysis against scored rubrics, with bounded input and four-credit requests.

## 0.6 — Calculation AI Reference Grading

Add advisory calculation grading separate from deterministic objective scores.

## 0.5 — AI Persistence & Observability

Restore saved AI responses and show account-scoped usage and token metadata.

## 0.4 — AI Tutor + Rolling AI Credit Quota

Add context-bounded hints/explanations and a durable 20-credit rolling five-hour quota.

## 0.3 — Quiz Library & Practice History

Support multiple versioned quizzes, independent submitted attempts, history and mistakes.

## 0.2 — Supabase Foundation

Add username authentication, synthetic email identifiers, profiles, private hints, RLS and local/cloud persistence.

## 0.1 — Core Quiz Engine

Introduce the Quiz Markdown parser, six question types, deterministic grading, drawing tools and local persistence.
