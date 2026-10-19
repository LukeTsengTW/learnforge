# Release checklist

## v1.20.0 Multi-page handwriting — local implementation checkpoint

This checkpoint is dated 2026-10-19 (Asia/Taipei). It is not production acceptance. The local `master` and candidate branch `codex/v1.20.0-paged-handwriting` are at `aef16cdff880714b153dbc8237f2169234ea906d`; `origin/master` remains at base `2faf57ac9a089f1af79fd6c160eeb0dd58a0d661`. The implementation commit is `7ec6f5c5bf2fb56dc7ca821b586b64ec099735b`, followed by the whitespace-only migration fix. These commits are local and have not been pushed. The package and lockfile are set to `1.20.0`. The exact-SHA preflight on `aef16cd` passed and confirmed the local and remote `v1.20.0` tag absent. This documentation update creates a new candidate SHA, so candidate checks must be repeated before pushing.

- [x] Core implementation: ordered calculation handwriting pages, per-page undo/redo, page selection/add/delete, recovery and preview/export, schema-3 draft contract, and V5 server-side submission/grading/history/analytics path.
- [x] Independent Stage 3 review: PASS, zero blockers/should-fix/nits after moving page-delete confirmation and actions inside the expanded dialog.
- [x] Independent Stage 4 review: PASS, zero blockers/should-fix/nits; schema-1/2 submitted paths remain versioned, schema-3 geometry and aggregate limits are checked, and empty-page handling is aligned across TypeScript and SQL.
- [x] Independent Stage 1 integration review: PASS, zero blockers/should-fix/nits; sparse pages are rejected, and stroke-count boundary tests isolate the count limit.
- [x] TypeScript build check; `check:quizzes`; `check:ai-context`; Edge import check; production build; Pages-base build; production dependency audit (0 vulnerabilities); lint; and `git diff --check` passed before this documentation/version checkpoint.
- [x] Re-ran `supabase/tests/security.sql` on 2026-10-19 against the isolated local Supabase database after the latest drawing-mode predicate and regression assertion. `psql` exited 0; the script reached `ROLLBACK` and emitted its final `PASS` summary. Production database was not accessed or changed.
- [x] Edge import graph scope: only `save-quiz-draft` (`verify_jwt=true`) and `submit-quiz` (`verify_jwt=false`) are affected. `quiz-context.generated.ts` has the same blob hash as the base and is not a candidate change; deploy only the two named functions and retain their JWT settings.
- [x] Author Preview rendered the handwriting toolbar. In the in-app browser, adding a page showed page 2/2 and previous/next navigation returned 1/2 then 2/2. The connected Chrome automation surface also reported Canvas unavailable; no pointer stroke was claimed as browser-verified. Automated DrawingCanvas and submission tests cover the stroke path.
- [x] Full local Vitest: 123 files / 1,883 tests passed in the controlled elevated run. The earlier sandbox run's only failure was the Git Bash named-object permission error; the same workflow test file also passed independently, 26/26.
- [x] Stage 0 source review: N/A because the candidate changes no quiz-bank source content.
- [x] Stage 2 release-documentation review: final follow-up PASS with zero blockers, should-fix items, or nits after recording the SQL rerun, review dispositions, completed tests, and secret-safe metadata checks.
- [x] Stage 5 end-to-end candidate review: PASS with zero blockers, should-fix items, or nits after correcting its single documentation finding. Final release-closure review remains pending until the release gates complete.
- [x] `release:classify` on `aef16cd`: `security-ai`, Risk C, `providerCanaryRequired=true`; exact-SHA local preflight on that SHA passed. This was before the current documentation update.
- [ ] Run `release:classify`, `release:check`, exact-SHA preflight and CI for the final candidate SHA after this documentation update.
- [ ] Production backend preflight, additive migration, impacted Edge deployment, and bounded synthetic provider canary. The classifier has reported Risk C / `security-ai` and `providerCanaryRequired=true`; no production mutation or provider call has occurred.
- [ ] Exact-SHA Pages deployment, public smoke, release manifest parity, production browser acceptance, and independent production review.
- [ ] Update this checklist and delivery report with observed production/CI identities; create docs-only closure commit if the current workflow still requires it; verify closure CI and Pages SHA parity; then create the requested annotated tag and GitHub Release only after all preceding gates pass.

## v1.19.0 2021／2023／2024 離散數學期中考題庫 — production acceptance snapshot before closure

本節記錄 2026-10-18（Asia/Taipei）runtime candidate `f283c14c45fa670865f30510c77bf40e64e35e4a` 的 production acceptance，時間點在 docs-only closure commit 之前。當時 Stage 0–4 reviews、exact candidate CI、六個 Edge 部署、exact-candidate Pages、public smoke、candidate manifest 與受限 production browser acceptance 均 PASS，production manifest 回傳 candidate SHA。此為歷史 checkpoint；目前 closure SHA、最終 Pages manifest、annotated tag 與已發布 Release 請見 [v1.19.0 GitHub Release](https://github.com/LukeTsengTW/learnforge/releases/tag/v1.19.0) 及 [live release manifest](https://luketsengtw.github.io/learnforge/release.json)。細節與限制見 [v1.19.0 delivery](v1.19.0-delivery.md)。

- [x] 三份來源題庫已存在於 source commit `e891aeac3b0a6c6a09df60a222004f4e03290734`；18 題計算、7 題單選，每份 100 分、90 分鐘。
- [x] Stage 0 source、Stage 1 integration、Stage 2 release-documentation、Stage 3 candidate review 均 PASS；各 reviewer 0 blocker／should-fix／nit。
- [x] 整合 inventory：10 份 current quizzes／12 個 revisions／170 題；既有 145 個 canonical contexts 保持 serialized-byte-identical，fingerprint `8719200237f249a46e43a20a92050db6ab0ed3aa84405485147c3af6976fb368`。
- [x] Local gates：116 files／1,828 tests；lint、quiz/context checks、Edge import check、production build、production dependency audit 與 diff check PASS。五個既有 DrawingCanvas lint warnings 及大型 chunk advisory 維持不變。
- [x] Exact candidate CI [39113976004](https://github.com/LukeTsengTW/learnforge/actions/runs/39113976004)，attempt 1、checks job `117635839715` PASS；candidate SHA 為 `f283c14c45fa670865f30510c77bf40e64e35e4a`。
- [x] Stage 4 classifier：`security-ai`／Risk C／`providerCanaryRequired=false`；無 DB migration。六個指定 Edge functions 先於 Pages 部署，全部 ACTIVE、版本各 +1、`verify_jwt` 未變；另五個函式 metadata 保持不變，詳見 delivery。
- [x] Exact candidate Pages [39115002948](https://github.com/LukeTsengTW/learnforge/actions/runs/39115002948)：build job `117638902663`、deploy job `117639193356` 均 PASS。Canonical public smoke 檢查 5 個 static assets；cache-busted manifest 顯示 `learnforge`／`1.19.0`／candidate SHA。
- [x] Production browser acceptance：10 張題庫卡、2023 搜尋與 `derangements` tag、三份 Student／Answer Preview、KaTeX 與 1440／768／360／345 px 排版 PASS；request guard 僅允許同源 GET，console／page／network error arrays 均空。獨立 Stage 4 production review PASS。
- [x] 限制：沒有執行 credentialless Edge health probes；沒有驗證 valid-JWT handler、authenticated submission、runtime context loading 或 provider behavior。Browser acceptance 為 unauthenticated read-only，未建立草稿或作答。
- [ ] Stage 5 pre-closure checklist state：當時待更新四份文件、建立 docs-only closure commit／push、取得 exact-SHA CI PASS、部署 closure SHA 並確認 public smoke／manifest parity。
- [ ] Stage 5 pre-closure checklist state：當時待 final Pages parity 後建立 annotated `v1.19.0` tag 與正式 GitHub Release，再完成獨立 final review；目前結果見上方 linked Release 與 manifest。

## v1.18.0 Chapter 8 inclusion-exclusion examples — release preparation

日期：2026-10-18（Asia/Taipei）。Production acceptance: **PASS** for runtime candidate `536a68539951052f025159d547873c6623a64886`; independent Stage 4 production review: **PASS**. Immutable base: v1.17.0 tag object `c6cc7b6747b9ad9005ec7f28bd42405504d31208`, peeled `e9176598618b4d7eca341cbca7808f0c7b3137e0`. Exact candidate CI and Pages, Edge deployments, health probes, public smoke and browser evidence are recorded below and in [delivery](v1.18.0-delivery.md). The docs-only closure, closure-SHA Pages parity, annotated tag and GitHub Release are separate Stage 5 operations.

- [x] Source identity and independent Stage 0 review: revision 1 of `discrete-math-ch8-inclusion-exclusion-examples`, 12 calculation questions, 90 points, 75 minutes, 1200×900 handwriting, V4 draft eligible. Independent answer/rubric review PASS; the original PowerPoint was unavailable for image-level comparison.
- [x] Integration: 9 bundled revisions／7 current quizzes／145 questions and 145 contexts. The 133 prior contexts retain SHA-256 `8b45ac7c7f2eb147a88d34ec15d51dc3a80439458772b29d33e1e42e50328e7d`; 12 new contexts are generated. Earlier chapter inventory and content hashes remain asserted.
- [x] Local gates: 115 test files／1,818 passed; lint, `check:quizzes`, `check:ai-context`, Edge imports, production build, production dependency audit (0 vulnerabilities), and `git diff --check` passed. Five DrawingCanvas lint warnings and the existing large-chunk build advisory are recorded in [delivery](v1.18.0-delivery.md).
- [x] Local browser acceptance: Home and Library show 7 quizzes; inclusion-exclusion search discovers Chapter 8; Student and Answer Preview render 12 questions; KaTeX errors 0; all 12 typing/handwriting switches work; 1440／768／360／345 px have no horizontal overflow. Browser console errors 0; one Vite React DevTools shim warning. A dummy loopback backend and all external HTTPS routes were blocked; no credentials, login, production host, or provider were used.
- [x] Stage 1 independent integration review: final follow-up PASS with no blockers, should-fix items, or nits. The first-cycle naming nit was corrected and the full suite rerun.
- [x] Final release classification: `security-ai`／Risk C／`providerCanaryRequired=false`; the six context-dependent Edge functions precede Pages. No migration or provider canary is indicated.
- [x] Stage 2 independent release-preparation review: PASS with no blockers, should-fix items, or nits. The reviewer independently verified version alignment, baseline hashes, context additions and rollout classification; corrected the browser-evidence wording; confirmed no premature CI or production claims.
- [x] Master candidate `536a68539951052f025159d547873c6623a64886`; normal fast-forward and push; `origin/master` matches. `release:check --base v1.17.0` and strict 7-check exact-SHA preflight passed.
- [x] Exact candidate CI [39106545026](https://github.com/LukeTsengTW/learnforge/actions/runs/39106545026) succeeded on the first attempt (115 files／1,818 tests). Independent Stage 3 review: PASS.
- [x] Six named Edge functions deployed only; each ACTIVE, version increment +1, `verify_jwt` unchanged. Five GET probes returned 401 and the `save-quiz-draft` OPTIONS probe returned 204. See delivery for versions, IDs, and the missing immediate before-inventory limitation.
- [x] Exact candidate Pages [39107181062](https://github.com/LukeTsengTW/learnforge/actions/runs/39107181062), canonical public smoke, exact manifest identity, production browser acceptance, and independent Stage 4 review: PASS.
- Stage 5 follows this acceptance snapshot: commit and push the four closure documents; require exact closure CI; deploy that closure SHA and confirm Pages manifest parity plus public smoke; create the annotated `v1.18.0` tag and requested GitHub Release; then complete the independent final review.
- The final tag's peeled commit must match the exact SHA served by the final Pages manifest. The closure workflow and tag/Release metadata provide the post-commit identities.

This section is the production-acceptance snapshot for the runtime candidate. Stage 5 records the closure transaction and verifies the final tag and Release against the Pages identity. Full evidence and current limits are recorded in [v1.18.0 delivery](v1.18.0-delivery.md). The user prompt authorizes the release sequence; it excludes migration/DB writes, Auth or secret inspection, provider canary calls, and production-changing E2E scripts.

## v1.17.0 Chapter 7 relations second examples — production acceptance

日期：2026-10-18（Asia/Taipei）。Runtime candidate `8b370833177b2f22c92582cd4860df12bafe9cd5` 已通過 production acceptance 與 Stage 4 review。Immutable base：annotated v1.16.1 tag object `04aee9e2ac97b43dbca4e4fd7f4f35d424c4bb11`／peeled commit `e2dd2175bd9a694c93e170b7b53b57f138aaec2a`。Classifier：`security-ai`／Risk C／`providerCanaryRequired=false`; generated canonical contexts changed, so the six dependent Edge functions were deployed before Pages. This section records the production-acceptance snapshot; documentation-closure validation is a separate stage.

- [x] Source review: 21 questions／150 points／120 minutes; source identity and independent Stage 0 review are recorded in [v1.17.0 delivery](v1.17.0-delivery.md).
- [x] Quiz integration and regression coverage: 21 new canonical contexts; previous 112-context fingerprint preserved; total bundle inventory is 8 revisions／6 current quizzes／133 questions／133 contexts.
- [x] Local verification: 114 test files／1,802 passed／0 skipped; lint, quiz inventory, generated-context consistency, Edge imports, build, production dependency audit and diff checks passed. Lint retained five pre-existing DrawingCanvas warnings; build retained the existing large-chunk advisory.
- [x] Pre-commit `release:check --base v1.16.1`: all 10 gates passed. Strict preflight passed all six checks, including local／remote v1.17.0 tag absence and working-tree diff checks. This preparation run used HEAD `542847bdaf0783c66ea14fe9d15009b50b8a9250` with uncommitted changes; it is not exact candidate CI.
- [x] Local browser acceptance: Library discoverability, filters, route, Author Student/Answer previews, KaTeX rendering, typing/handwriting switch and 1440／768／360／345 px layouts passed; no app console errors or horizontal overflow.
- [x] Conservative classifier: Risk C, no provider canary indicated. `.env.local` is an existing ignored local Vite input and is included by the classifier without reading or staging its values.
- [x] Stage 2 independent release-preparation review: PASS; final documentation corrections were independently re-reviewed with no blockers or nits.
- [x] Candidate commit created locally after Stage 2 PASS.
- [x] Normal push; exact candidate CI [39099160596](https://github.com/LukeTsengTW/learnforge/actions/runs/39099160596), job `117591674582` 15／15; Stage 3 review PASS.
- [x] Six context-dependent Edge deployments: `ai-tutor` 25, `ai-grade` 27, `ai-drawing` 27, `ai-responses` 29, `save-quiz-draft` 13, `submit-quiz` 15; health probes 6／6. Probe limits are recorded in [delivery](v1.17.0-delivery.md).
- [x] Exact candidate Pages [39099697903](https://github.com/LukeTsengTW/learnforge/actions/runs/39099697903), build job `117593254269` 20／20 and deploy job `117593579289` 6／6; canonical public smoke and cache-busted manifest identity match. Deployment-object ID was unavailable.
- [x] Production browser acceptance and clean guarded reruns; the initial Cloudflare Turnstile errors/warnings/POSTs remain disclosed separately in [delivery](v1.17.0-delivery.md).
- [x] Authenticated canary not required by this release's final checklist decision; `providerCanaryRequired=false`. Authenticated practice, persistence, submit and AI remain unverified.
- [x] Independent Stage 4 production review: PASS.
- GitHub Release: **not requested / not planned**.

## v1.16.1 chapter 5 revision 2 production acceptance closure

日期：2026-10-17（Asia/Taipei）。Immutable base v1.16.0：tag object `7fafccb9106e591f83870656e176ac70433c7a68`／peeled `bea17ee1ba6543bd60a47d95c3e80117c18d84b6`。已接受的 production runtime candidate 為 `817e954505b6cf9fe15d1aac02cff0d2d59f76db`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。

- [x] Pre-preparation：master＝origin/master＝branch `claude/awesome-carson-b7doyu`＝`bea17ee`；local／remote v1.16.1 tag absent。
- [x] 需求與 human 決定：刪除例題 5.5 與定理 5.1；只需計算的題目只要求計算過程與答案；新 revision 2、題號重排、各題配分不變（136 分）、100 分鐘；8 題的分類經 human 確認。
- [x] Revision 2：18 calculation／18 drawing-capable、136 分；10 題與 revision 1 相同（題號除外）；revision 1 封存，內容與 20 個 context 與 v1.16.0 相同。
- [x] Generated context 94 → 112（+1,053／−0）。
- [x] Local gates：113 files／1,775 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、diff-check 的結果見 delivery。Mutation probe 6/6。
- [x] Browser gate：1440／768／360 48/48、345 px 18/18 PASS；986＋236 個公式沒有溢出；console／page error 0、非 GET request 0。
- [x] Classifier（`--base v1.16.0 --include-working-tree`）：security-ai／Risk C／providerCanaryRequired=false；需要六個 Edge function 重新部署，不需要 migration 或 provider canary。
- [x] Sub-agent review（feature 與 release prep）：cycle 1 PASS，一個不阻擋的 nit（新 q09 solution 的「上限 $n-1$ 與 $n$」一段保留）。
- [x] Candidate `817e954505b6cf9fe15d1aac02cff0d2d59f76db`（parent `bea17ee`，14 個路徑）；在 local master 上 `release:check --base v1.16.0 --require-clean` 10／10 PASS（report：1.16.1／candidate SHA／base `bea17ee…`／security-ai／Risk C／providerCanaryRequired=false／1,775 tests）；strict `release:preflight --base v1.16.0 --version 1.16.1 --sha <candidate> --branch master --require-clean --require-tag-absent` 7 項全部 PASS。fast-forward 後先以 `npm run generate:ai-context` 寫回 LF 的 generated context 並 `git add`（沒有 staged 的變更），兩個工具第一次執行就通過；一次 normal push（remote master `bea17ee → 817e954`）。
- [x] [LearnForge CI 39043637456](https://github.com/LukeTsengTW/learnforge/actions/runs/39043637456)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 117427923172。
- [x] Edge：部署前以 `functions list` 取得 baseline（只讀 metadata）；六個 function 依序部署，每個一次嘗試、每個 exit 0：ai-tutor 24、ai-grade 26、ai-drawing 26、ai-responses 28、save-quiz-draft 12、submit-quiz 14（部署前依序為 23、25、25、27、11、13，與 v1.16.0 結束時相同）；全部 ACTIVE，verify_jwt 不變（只有 save-quiz-draft 為 true）；其餘五個 function 的版本、雜湊、id 與 updated_at 都沒有變。
- [x] Edge 來源核對：partial: ai-tutor full; the other five not downloaded, plus gated exact-candidate deployment；`functions download ai-tutor --use-api` 在有自己 project_id 的隔離 scratch workdir；ai-tutor 的七個檔案與 candidate 的 git blob（LF 正規化）全部相同，`_shared/quiz-context.generated.ts` 含 38 個第五章 context（revision 1 的 20 個與 revision 2 的 18 個）。其餘五個沒有下載（CLI 的 `UnsafeFunctionDownloadPathError`），證據是有 gate 的 exact-candidate 部署。
- [x] Runtime health：一個 function 一個 request，零憑證、不帶 body、不重試、不讀 log：5 個 GET 回 401 `MISSING_CREDENTIALS`（平台的回應），save-quiz-draft 的 OPTIONS 回 204，六個回應都有 `x-deno-execution-id`。這只證明函式已部署、被路由並由 Edge runtime 回應。
- [x] [Deploy LearnForge to GitHub Pages 39043820681](https://github.com/LukeTsengTW/learnforge/actions/runs/39043820681)／attempt 1／workflow_dispatch／master／exact candidate success；build job 117428463905、deploy job 117428726317、deployment 7141520321 均 success；exactly one dispatch。Edge 與 Pages 之間的空窗：約 2.6 分鐘（Asia/Taipei 23:08:37 第一個 Edge 部署 → 23:11:11 Pages 部署成功）。這段期間舊的 Pages 仍以 revision 1 為 current，而 revision 1 的 context 仍在新的 Edge 中，所以沒有影響。
- [x] Production public acceptance：canonical public smoke PASS（release identity 1.16.1／candidate SHA，root 與 manifest 200，5 個 asset），反向對照 1.16.0／`bea17ee` 被拒絕；`release.json` 一般與 cache-busted 相同；74 個路徑全部 HTTP 200；瀏覽器 smoke（對正式站只有 GET，github.io 以外的 host 一律中止並記錄）1440／768／360 48/48 PASS：Home「5 份題庫」與 v1.16.1、第五章卡片為 18 題／總分 136 分／約 100 分鐘、搜尋與篩選、題庫編寫頁的 revision 2（18 題與 metadata；Answer Preview 全部 986 個公式與 Student Preview 的 236 個公式沒有溢出、KaTeX error 0）、q01 打字與 q02 手寫保留在 Answer Preview、第三章仍可載入；console error 0、page error 0、非 GET request 0、被中止的 request 0。
- [x] Production review（sub-agent）：cycle 1 PASS 並要求包含重新開始的 draft canary；cycle 2（canary 結果）PASS，把被中止的第一個儲存記為已知觀察。
- [x] 登入後的 canary：PASS（production review 要求，draft-only，包含重新開始）：human 在一般啟動的 Chrome（新的暫存 profile，debugging 只綁 127.0.0.1）登入既有的 release-canary 帳號，登入後才 attach。帳號核對前後相同：5 筆已提交的紀錄，第三章、第五章與 2026 習題有草稿。(1) 封存草稿的路徑：開啟第五章題庫，伺服器回傳 v1.16.0 留下的 revision 1 草稿，頁面為 20 題，顯示「此未完成練習使用舊版題目（1）。你可以繼續完成，或捨棄草稿並使用最新版重新開始。」與「捨棄舊草稿並使用最新版重新開始」，q01 的手寫與文字還原；寫入只有 `get_or_create_quiz_draft` 與 `account-recovery-code`。(2) 按下「捨棄舊草稿並使用最新版重新開始」→「確認重新開始」：恰好一個 `DELETE /rest/v1/attempts` 回 200（刪除 1 列，canary 帳號自己的 revision 1 草稿；資料庫政策只允許刪除自己的草稿），接著 `get_or_create_quiz_draft` 建立 quizRevision 2 的空草稿，頁面為 18 題。(3) Revision 2：q01 打字「v1.16.1 release canary」、重新整理、畫一筆、重新整理；最後伺服器草稿為 revision 2、answerSchemaVersion 2、q01 drawing mode、1 筆、文字保留，畫面還原；其他 17 題未動。沒有提交、沒有 AI 請求（ai-quota、ai-responses 只有 GET）；觀察到的非 GET 只有 DELETE 1、`get_or_create_quiz_draft` 4、`save-quiz-draft` 3、`account-recovery-code`（狀態查詢）5；79 個 response 沒有 ≥400，console／page／CSP error 0。Chrome 已關閉、暫存 profile 已刪除，evidence 經敏感值掃描為 0。
- [x] 已知觀察（原因不明）：重新開始之後的第一個 `save-quiz-draft`（15:41:39.165Z 送出）沒有收到回應，15:41:54.220Z 以 `net::ERR_ABORTED` 結束，也就是 app 的 15 秒逾時（`src/lib/supabase.ts:13`）；app 沒有顯示錯誤。Canary 沒有重試；在計畫中的重新整理後，app 重送待同步的 q01（15:42:28.851Z → 200，0.8 秒），之後畫一筆的儲存也是 200（0.9 秒）。重送前 1 ms，應用程式自己的 GET 讀到的伺服器草稿仍是空的（revision 2、schema 1、沒有答案列），重送也通過 handler 的 `expectedUpdatedAt` 檢查，所以被中止的請求沒有寫入任何資料。這是 save-quiz-draft v12 部署後（15:08:55Z）約 32.7 分鐘的第一個真正的 POST（health 只送了 OPTIONS）；冷啟動或暫時的平台延遲是可能的解釋，但沒有證明，也沒有讀 log。本版沒有改動儲存的程式路徑。
- [x] Production 的存取：`functions list` 2 次；`functions download` 1 次（ai-tutor，在 scratch）；6 個 health request；public smoke 與反向對照；`release.json` 2 個 GET；74 個路徑的 crawl；瀏覽器 smoke（只有 GET）；登入後的 canary（上述 request）；GitHub 的唯讀 API（以上是 developer 的存取；sub-agent reviewer 只讀本機 evidence 與唯讀的 `gh`）。沒有 SQL、沒有 secrets list、沒有 log。Production 的變更：六次 Edge 部署、一次 Pages 部署；canary 帳號的第五章 revision 1 草稿經 app 的介面刪除，並建立一份 revision 2 草稿（q01 一筆答案）保留；`ai-quota` 的 GET 會整理該帳號過期的 reservation（影響列數 UNKNOWN），`account-recovery-code` 依 client 與 source 的契約判斷為狀態查詢。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.16.1 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、驗證、部署與驗收：[v1.16.1 delivery](v1.16.1-delivery.md)。以下歷史 checklist 保留原樣。

## v1.16.0 chapter 5 relations and functions examples production acceptance closure

日期：2026-10-17（Asia/Taipei）。Immutable base v1.15.0：tag object `938d66192bfbdc6837b154431d42730cfa6df14a`／peeled `6cd622d77874707ff6e1f966e783f32eececaaf4`。已接受的 production runtime candidate 為 `3c7d8d458d14595753b88b47899ea62fdce1d8a0`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。

- [x] Pre-preparation：master＝origin/master＝live remote master＝`6cd622d77874707ff6e1f966e783f32eececaaf4`；開發 branch `claude/awesome-carson-b7doyu`＝origin 的同名 branch＝`b3cd217`（parent `6cd622d…`，只新增講義轉寫檔）；local／remote v1.16.0 tag absent。
- [x] 需求與 human 決定：題目對照表（20 題、150 分、120 分鐘）經 human 確認；p20–21 不出題；p6 定理 5.1 改為證明題；p28 收錄；p2、p4 各自成題；表 5.13 出 $m=4$、$n=3$ 綜合題；標籤沿用 `stirling-numbers`、`relations`、`functions` 並更新 Library 測試的預期值；版本 1.16.0；推回 `claude/awesome-carson-b7doyu`，不開 PR、不部署、不 tag。
- [x] 來源：轉寫檔 `docs/sources/discrete-math-ch5-relations-functions-2026.md` 為權威來源；PDF（4,290,799 bytes、SHA-256 `49d6a425…6494`、31 頁）本次沒有取得，沒有重新核對雜湊或影像。31 頁都有對應：27 頁進入 20 題，p1、p20、p21、p31 不成題（原因見 delivery）。
- [x] 答案：獨立 Python 腳本（不讀題庫檔與轉寫檔）53/53 相符，與講義及轉寫檔附錄 B 一致；沒有 source answer 衝突。
- [x] 新題庫 20 calculation／20 drawing-capable，150 分，1200×900；發布的 6 revisions／5 current／94 questions／94 contexts；既有 103 題（含測試 fixture）inventory 的雜湊保留。
- [x] Local gates：112 files／1,735 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、diff-check 的結果見 delivery。
- [x] Mutation probe（只改新題庫、每次重新產生 context、跑新測試、還原）：7/7 被對應的測試抓到。
- [x] Classifier（`--base v1.15.0 --include-working-tree`）：security-ai／Risk C／providerCanaryRequired=false。需要六個 Edge function 重新部署；不需要 migration 或 provider canary。
- [x] Sub-agent review：cycle 1 REWORK（公式在 360／345 px 寬會溢出，以及文件與測試的小問題，全部修正）、cycle 2 PASS。
- [x] Release-prep review（sub-agent，follow-up commit 與 browser gate）：cycle 1 PASS，兩個文件 nit 已修正。
- [x] Candidate：`c9a0111`（題庫與 release 準備）與 `3c7d8d458d14595753b88b47899ea62fdce1d8a0`（修正 q17 rubric 版面、記錄 browser gate），parent 依序為 `b3cd217`（講義轉寫）與 `c9a0111`；兩個 commit 都推到 `claude/awesome-carson-b7doyu`。
- [x] Local master fast-forward `6cd622d → 3c7d8d4`；一次 normal push（remote master `6cd622d → 3c7d8d4`）。
- [x] [LearnForge CI 39025646607](https://github.com/LukeTsengTW/learnforge/actions/runs/39025646607)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 117375982830，15 個 step 全 success。
- [x] Push 前：在 local master 上 `release:check --base v1.15.0 --require-clean` 10／10 PASS（report：1.16.0／candidate SHA／base `6cd622d…`／security-ai／Risk C／providerCanaryRequired=false／1,735 tests）；strict `release:preflight --base v1.15.0 --version 1.16.0 --sha <candidate> --branch master --require-clean --require-tag-absent` 7 項全部 PASS。前兩次 `release:check` 失敗、不計入：第一次是 test gate 的 `check:ai-context` 失敗，因為 fast-forward 時 Git（`core.autocrlf=true`）把 generated context 以 CRLF 寫回 working tree，而檢查逐位元比對（committed blob 是 LF）；以 `npm run generate:ai-context` 寫回相同內容的 LF 版本。第二次是 preflight 失敗，因為 Git 的 index 仍把該檔標為修改（內容沒有差異）；`git add` 該檔後清除，沒有 staged 的變更。
- [x] Browser gate（scratch build 由 Playwright 從磁碟提供，沒有後端、零網路）：Home（5 份題庫、v1.16.0）、Library（5 張卡片、新卡片、搜尋「第五章」、`stirling-numbers` 篩選）、Author 載入第五章的 Student／Answer Preview、q01 打字與 q02 手寫（Answer Preview 的畫布與編輯畫布 PNG 雜湊相同）、第三章仍可載入；1440／768／360 48/48、345 px 18/18 PASS；Answer Preview 全部 1,119 個公式與 Student Preview 的 271 個公式溢出 0、KaTeX error 0、console／page error 0、非 GET request 0。過程中發現並修正 q17 rubric 在 360 px 溢出 10 px。
- [x] Edge：部署前以 `functions list` 取得 11 個 function 的 baseline（只讀 metadata）；六個 function 依序部署，每個一次嘗試、每個 exit 0：ai-tutor 23、ai-grade 25、ai-drawing 25、ai-responses 27、save-quiz-draft 11、submit-quiz 13（部署前依序為 22、24、24、26、10、12，與 v1.15.0 結束時相同）；全部 ACTIVE，verify_jwt 不變（只有 save-quiz-draft 為 true）；其餘五個 function（account-recovery-code、ai-quota、ai-usage、password-hint、recover-account）的版本、雜湊、id 與 updated_at 都沒有變。第一次與第二次的 Edge 部署指令被 Claude Code 的 auto-mode permission classifier 擋下，script 沒有開始（沒有 marker、沒有輸出）；human 離開 auto mode 並說「繼續」後執行，一次成功。
- [x] Edge 來源核對：partial: ai-tutor full; the other five not downloaded, plus gated exact-candidate deployment；`functions download ai-tutor --use-api` 在有自己 project_id 的隔離 scratch workdir；ai-tutor 的七個檔案與 candidate 的 git blob（LF 正規化）全部相同，其中 `_shared/quiz-context.generated.ts` 含 20 個第五章 context，且與 `c9a0111` 的 blob 不同（reviewer 核對），所以部署的 context 包含 q17 rubric 的修正。其餘五個沒有下載（CLI 對 bundle 含 repo 根目錄 `src/` 的 function 會以 `UnsafeFunctionDownloadPathError` 失敗，v1.15.0 已確認），它們的證據是有 gate 的 exact-candidate 部署（HEAD 等於 candidate、working tree 乾淨、同一個 CLI、版本各加一、雜湊改變）。沒有使用 Supabase MCP（沒有 authenticate）。
- [x] Runtime health：一個 function 一個 request，零憑證、不帶 body、不重試、不讀 log：5 個 GET（ai-tutor、ai-grade、ai-drawing、ai-responses、submit-quiz）回 401 `MISSING_CREDENTIALS`（平台的回應），save-quiz-draft 的 OPTIONS 回 204，六個回應都有 `x-deno-execution-id`。這只證明函式已部署、被路由並由 Edge runtime 回應。
- [x] [Deploy LearnForge to GitHub Pages 39026583818](https://github.com/LukeTsengTW/learnforge/actions/runs/39026583818)／attempt 1／workflow_dispatch／master／exact candidate success；build job 117378644050、deploy job 117378893128、deployment 7138514435 均 success；exactly one dispatch。Edge 與 Pages 之間的空窗：約 3.6 分鐘（Asia/Taipei 18:51:00 第一個 Edge 部署 → 18:54:39 Pages 部署成功）。這段期間舊的 Pages 不列出新題庫，使用者看不到差異。
- [x] Production public acceptance：canonical public smoke PASS（release identity 1.16.0／candidate SHA，root 與 manifest 200，5 個 asset），反向對照舊的 1.15.0／`6cd622d` identity 被拒絕；`release.json` 一般與 cache-busted 相同；74 個路徑全部 HTTP 200；瀏覽器 smoke（headless Chromium，對正式站只有 GET，github.io 以外的 host 一律中止並記錄）1440／768／360 48/48 PASS：Home「5 份題庫」與 v1.16.0、Library 5 張卡片與第五章卡片、搜尋「第五章」、`stirling-numbers` 篩選 2 張、題庫編寫頁載入第五章的 Student／Answer Preview（20 題；Answer Preview 全部 1,119 個公式與 Student Preview 的 271 個公式沒有溢出、KaTeX error 0）、q01 打字與 q02 手寫保留在 Answer Preview、第三章仍可載入；console error 0、page error 0、非 GET request 0、被中止的 request 0（沒有任何對 Supabase 的 request）。
- [x] Production review（sub-agent）：PASS，並要求登入後的 draft canary。
- [x] 登入後的 canary：PASS（production review 要求，draft-only）：human 在一般啟動的 Chrome（新的暫存 profile，debugging 只綁 127.0.0.1）登入既有的 release-canary 帳號，登入後才 attach。帳號核對（只讀練習紀錄與 Library，不讀 navigation）：5 筆已提交的紀錄（3 筆 `demo` 顯示「題目版本無法載入」、第一章、期中考），第三章與 2026 習題保留草稿，第五章卡片為「開始練習」。開啟新題庫：`get_or_create_quiz_draft` 建立 revision 1 的空草稿；q01 打字「v1.16.0 release canary」→ `save-quiz-draft` 200（answerSchemaVersion 2）；重新整理後應用程式自己的 GET 讀到伺服器草稿含 q01 的文字，畫面也還原；q01 切到手寫並畫一筆短線 → `save-quiz-draft` 200；重新整理後伺服器回傳 drawing mode、1 筆、文字保留，畫布相同。其他 19 題未動；沒有提交、沒有 AI 請求（ai-quota、ai-responses 只有 GET）。觀察到的 POST 只有 `get_or_create_quiz_draft` 3 次、`save-quiz-draft` 2 次、`account-recovery-code`（狀態查詢）5 次；72 個 response 沒有 ≥400，console／page／CSP error 0。草稿保留，沒有 cleanup、沒有登出；Chrome 已關閉、暫存 profile 已刪除，evidence 經敏感值掃描為 0。Submit 與 AI 評分沒有在新題庫上端到端執行（不在 canary 範圍）。
- [x] Production 的存取：`functions list` 2 次；`functions download` 1 次（ai-tutor，在 scratch）；6 個 health request；public smoke 與反向對照；`release.json` 2 個 GET；74 個路徑的 crawl；瀏覽器 smoke（只有 GET）；登入後的 canary（上述 request）；GitHub 的唯讀 API（以上是 developer 的存取；sub-agent reviewer 另外對 `release.json` 與網站根目錄各做 1 個 GET，並使用唯讀的 `gh run view`／`gh api`）。沒有 SQL、沒有 secrets list、沒有 log。Production 的變更：六次 Edge 部署、一次 Pages 部署，以及 canary 帳號在新題庫的一份草稿（q01 一筆答案）；`ai-quota` 的 GET 會整理該帳號過期的 reservation（影響列數 UNKNOWN），`account-recovery-code` 依 client 與 source 的契約判斷為狀態查詢。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.16.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、來源對應、部署與驗收：[v1.16.0 delivery](v1.16.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.15.0 remove three quiz banks production acceptance closure

日期：2026-10-17（Asia/Taipei）。已接受的 production runtime candidate 為 `e7eb6187caf5d3aabb8f3136d6b0030707e2f85e`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.14.1：tag object `566497ff0dc85167d0b4742da875eeeefb730a04`／peeled `6e98fc7c81d2f9171731f5d35b1bdc7f3b86a753`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `6e98fc7c81d2f9171731f5d35b1bdc7f3b86a753`；release prep 開始時 working tree 只有本次的變更；v1.14.1 tag object 與 peeled commit 未變；local／remote v1.15.0 tag absent。
- [x] 需求範圍：human 要求移除「數位邏輯與基礎數學」（demo）、「布林代數基礎」（boolean-algebra）、「離散數學：關係」（relations），其餘題庫不變；交由 reviewer 審查並以 Playwright 測試；之後下達 release。
- [x] 實作：三個題庫的 Markdown 移到 `src/test-fixtures/quizzes/`；`quiz-context.generated.ts` 重新產生（103 → 74）；Home 精選題庫改為 `discrete-math-ch1-counting-examples`；`index.html` meta description；移除 `demoQuiz` 匯出；測試以 fixture helper 選擇加入。
- [x] Local gates：111 files／1,683 PASS；lint、check:quizzes（5 revisions／4 current／74 questions）、check:ai-context（5 quizzes／74 questions）、check:edge-imports、build、production audit（0 vulnerabilities）、diff-check、tsc PASS。
- [x] Browser evidence（scratch build 由 Playwright 從磁碟提供，沒有登入）：Home、Library（4 張卡片；搜尋被移除的名稱沒有結果）、`#/quiz/demo`、練習紀錄／結果頁／學習分析／錯題複習的降級顯示；1440／768／360；console／page errors 0。
- [x] Sub-agent review：cycle 1 REWORK、cycle 2 PASS、cycle 3 PASS。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=false。需要六個 Edge function 的重新部署（generated context 改變）；不需要 provider canary；不需要 migration。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.14.1` 10／10 PASS（111 files／1,683 tests）；`release:preflight`（沒有 `--sha` 與 `--require-clean`，含 `--require-tag-absent`）PASS。Commit 後以嚴格形式重跑，結果記於 post-commit report。
- [x] Release-prep review（sub-agent）：cycle 1 REWORK（五處文件錯誤，已修正）、cycle 2 PASS。
- [x] 單一 candidate commit `e7eb6187caf5d3aabb8f3136d6b0030707e2f85e`（parent `6e98fc7c…`，64 個路徑：58 M、4 R、2 A）；commit 後 `release:check --base v1.14.1 --require-clean` 10／10 PASS（report 為 1.15.0／candidate SHA／Risk C）、strict `release:preflight --sha <candidate> --branch master --require-clean --require-tag-absent` 8／8 PASS；一次 normal push（remote master `6e98fc7 → e7eb618`）。
- [x] [LearnForge CI 39015563847](https://github.com/LukeTsengTW/learnforge/actions/runs/39015563847)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 117346862629。
- [x] Edge：部署前以 `functions list` 取得 11 個 function 的 baseline（只讀 metadata）；六個 function 依序部署，每個一次嘗試、每個 exit 0：ai-tutor 22、ai-grade 24、ai-drawing 24、ai-responses 26、save-quiz-draft 10、submit-quiz 12（部署前依序為 21、23、23、25、9、11）；其餘五個 function（account-recovery-code、ai-quota、ai-usage、password-hint、recover-account）的版本、雜湊與 updated_at 都沒有變。
- [x] Edge 來源核對：partial: ai-tutor full; ai-responses incl. generated context; the other four entry files only, plus gated exact-candidate deployment；方法：CLI `functions download` 在隔離的 scratch workdir（不是 `get_edge_function`；該 MCP 在這個 session 沒有 authenticate）。沒有宣稱六個 function 都逐檔相同。
- [x] Runtime health（零憑證、不帶 body、不重試、一個 function 一個 request、不讀 log）：5 個 GET（ai-tutor、ai-grade、ai-drawing、ai-responses、submit-quiz）回 401 `MISSING_CREDENTIALS`（平台的回應），save-quiz-draft 的 OPTIONS 回 204，六個回應都有 `x-deno-execution-id`；沒有讀任何 log。這只證明函式已部署、被路由並由 Edge runtime 回應，不單獨證明新的 handler 或 generated context 已被載入。
- [x] [Deploy LearnForge to GitHub Pages 39016013054](https://github.com/LukeTsengTW/learnforge/actions/runs/39016013054)／attempt 1／workflow_dispatch／master／exact candidate success；build job 117348158992、deploy job 117348451533、deployment 7136815881 均 success；exactly one dispatch。Edge 與 Pages 之間的空窗：約 6 分鐘（Asia/Taipei 16:00:36 第一個 Edge 部署 → 16:06:39 Pages 部署成功）。這段期間舊的 Pages 仍列出三份被移除的題庫：它們的提交與 AI 請求會被拒絕、`demo/v2-handwriting` 的 v4 草稿無法儲存，v3 草稿仍可儲存。
- [x] Production public acceptance：canonical public smoke PASS（release identity 1.15.0／candidate SHA，root 與 manifest 200，5 個 asset），反向對照舊的 1.14.1 identity 被拒絕；74 個路徑全部 HTTP 200；瀏覽器 smoke：Home 精選為「離散數學第一章：計數的基本原理－例題練習」（26 道題目、總分 150 分、卡片沒有未渲染的 LaTeX）、「4 份題庫，依自己的步調探索」、meta description 為「…離散數學…」、navigation 為 v1.15.0；Library 恰好 4 張卡片，搜尋「布林」、「數位邏輯」、「關係」、`logic-gates`、`boolean-algebra`、`demo` 都沒有結果；未登入的 `#/quiz/demo` 與 `#/quiz/boolean-algebra` 都轉到登入頁；題庫編寫頁的 bundled revision 只有留下的四份題庫（五個 revision）；768 與 360 沒有水平 overflow；主要 JS 不含三份被移除題庫的標題，也不含 `boolean-algebra`、`v2-handwriting`、`v1-7d7c900e`。
- [x] 登入後的 canary：not run (justified)：沒有 draft、提交、評分或 provider 的程式變更；留下的 74 個 canonical context 與 v1.14.1 逐位元相同；`discrete-math/1`、`discrete-math/2` 有預設查詢的單元測試；加上部分來源核對與有 gate 的 exact-candidate 部署。沒有登入，canary 帳號未動；登入後的路徑與舊紀錄的降級顯示沒有在 production 驗證（只在本機 harness 驗證）。
- [x] Environment deviation：瀏覽器 smoke 的第一次執行記到 7 個 console error，全都在轉到登入頁的 Cloudflare Turnstile frame：AdGuard 的 script 被注入該第三方 frame 並被它的 CSP 擋下，以及我們自己中止的 Cloudflare POST（`ERR_FAILED`）；沒有 page error、沒有第一方的 error、沒有任何對 Supabase 的 request。Home、Library、Author（1440 與 360）另外重跑一次，0 個 console／page error，但該次由瀏覽器的 HTTP cache 提供，router 看到 0 個 request，所以它證明沒有錯誤，不是新的網路紀錄。第一方頁面沒有出現 AdGuard 相關的 error。
- [x] Production 的存取：`functions list` 2 次；`functions download` 6 次（1 次完成、5 次在寫入部分檔案後失敗，都在 scratch）；6 個 health request；public smoke 與反向對照；74 個路徑的 crawl；瀏覽器 smoke（只有 GET；3 個 Cloudflare Turnstile 的 POST 在送出前中止）；GitHub 的唯讀 API。沒有 SQL、沒有 secrets list、沒有 log（沒有列出 secrets，所以 Edge 部署對平台管理的 `SUPABASE_*` secrets 時間戳的已知影響（v1.9.0 觀察到）沒有檢查）。Production 的變更：六次 Edge 部署與一次 Pages 部署。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.15.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

已知未改的項目：`scripts/release-browser-e2e.mjs`、`scripts/release-real-turnstile-e2e.mjs`、`scripts/release-final-gate.mjs` 與下方較舊的 checklist 段落仍以 `/quiz/demo` 為目標；`release-browser-e2e.mjs` 與 `release-real-turnstile-e2e.mjs` 是需要後端與專用註冊帳號的選用 script（`release-browser-e2e` 使用已連結的開發後端），它們的 `/quiz/demo` 步驟會失敗，使用前必須改用保留的題庫；`release-final-gate.mjs` 是只允許 127.0.0.1／localhost 的唯讀 smoke，不使用憑證或帳號，它的 `/quiz/demo` 步驟只檢查未登入會轉到登入頁，仍會通過（`RequireAuth` 包住題庫路由），只是不再對應一份存在的題庫。三者都不在 `release:check` 或 CI 中，本版沒有改它們。

Candidate scope、設計與已知限制：[v1.15.0 delivery](v1.15.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.14.1 drawing toolbar icons production acceptance closure

日期：2026-10-16（Asia/Taipei）。已接受的 production runtime candidate 為 `0abb09a962f0e62a7a4ed0b670c7bceb0612fb20`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.14.0：tag object `7428088176665828c11c68e952c46fe52315142f`／peeled `b2f770402f0b06ee632896ecaf539cb59d867302`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `b2f770402f0b06ee632896ecaf539cb59d867302`；release prep 開始時 working tree 只有本次的變更；v1.14.0 tag object 與 peeled commit 未變；local／remote v1.14.1 tag absent。
- [x] 需求範圍：human 問工具列按鈕能否以 SVG 圖示取代文字。Human 決定（選項）：範圍為整個畫布工具列；只顯示圖示＋停留提示。
- [x] 實作：新的 `DrawingToolIcons.tsx`；`DrawingCanvas.tsx` 六個按鈕改為圖示（`aria-label`、`title`），切換按鈕不再標示按下狀態、放大時加上 `aria-keyshortcuts`，狀態行不再提到看不到的「結束放大」；`global.css` 的 44 × 44 圖示按鈕。
- [x] Regression：新增 `DrawingCanvas-icons.test.tsx`（3 個測試）；既有測試只改 `DrawingCanvas-enlarged.test.tsx` 的一個斷言（切換按鈕沒有 `aria-pressed`、有 `aria-keyshortcuts`）。
- [x] Local gates：111 files／1,681 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Browser evidence（本機受控 fixture，零網路 isolation）：1440／360、淺色與深色的圖示按鈕尺寸、名稱、沒有 overflow；v1.14.0 的放大書寫情境重跑 PASS；console／page errors 0。
- [x] Sub-agent review（本 session 內的 code reviewer）：cycle 1 APPROVE，一項 should-fix（狀態行提到看不到的「結束放大」）與五個 nit，修正後重跑 gates 與 browser；cycle 2 APPROVE、沒有新發現。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=false。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.14.0` 10／10 PASS（111 files／1,681 tests）；`release:preflight`（沒有 `--sha` 與 `--require-clean`，含 `--require-tag-absent`）7／7 PASS。Commit 後以嚴格形式重跑，結果記於 post-commit report。
- [x] Release-prep review（同一個 sub-agent）：PASS，沒有 blocking；should-fix（記錄 release tools 的結果與本 review 的結論）與兩個 nit（CHANGELOG 對測試修改的描述、bundle 檢查的具體字樣）已修正。
- [x] 單一 candidate commit `0abb09a962f0e62a7a4ed0b670c7bceb0612fb20`（parent `b2f77040…`，12 個路徑，五個 feature 檔案的 staged 與 HEAD blob 與 review 時相同）；commit 後 `release:check --base v1.14.0 --require-clean` 10／10 PASS（report 為 1.14.1／candidate SHA／Risk C）；strict `release:preflight --sha <candidate> --branch master --require-clean --require-tag-absent` 8／8 PASS；一次 normal push（remote master `b2f7704 → 0abb09a`）。
- [x] [LearnForge CI 38926266625](https://github.com/LukeTsengTW/learnforge/actions/runs/38926266625)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 117058473279。
- [x] Backend：不需要；沒有存取 Supabase。
- [x] [Deploy LearnForge to GitHub Pages 38926525130](https://github.com/LukeTsengTW/learnforge/actions/runs/38926525130)／attempt 1／workflow_dispatch／master／exact candidate success；build job 117059362089、deploy job 117060131899、deployment 7123281622 均 success；build log 的 RELEASE_SHA／RELEASE_VERSION 為 candidate／1.14.1。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.14.1／v1.14.1、gitSha `0abb09a962f0e62a7a4ed0b670c7bceb0612fb20`，一般與 cache-busted 相同；canonical public smoke PASS，舊的 1.14.0 identity 被拒絕；主要 JS 含 `icon-button`、`drawing-tool-icon`、`aria-keyshortcuts`、「結束放大（Esc）」與新的狀態文字，不含舊的「按 Esc 或「結束放大」返回」，navigation 字樣只有 v1.14.1；主要 CSS 含 `.drawing-toolbar .icon-button`（44 px 寬）；74 個路徑 HTTP 200，sha256 已保存供 closure-SHA parity；未登入的瀏覽器 smoke PASS（Pages GET 21、Turnstile GET 2）。
- [x] 部署上的題庫編寫頁 Student Preview（demo q7，未登入，1440 與 360）：頁面上 5 個、放大後 6 個圖示按鈕，全部 44 × 44、圖示 20 × 20、沒有文字、有 `title`，結束放大沒有 `aria-pressed`；狀態行為「已放大書寫。按 Esc 或工具列的縮小按鈕返回。」；v1.14.0 的放大書寫照常（1× 961／326 px、2× 1932／652 px、dialog 與 `inert`、2× 畫的筆跡與 Answer Preview 的 PNG 相同、回到按下時的捲動位置）；連續 2 次執行都通過，只有對 Pages 的 GET 24 個，console／page／CSP／unhandled rejection 0。
- [x] 驗收時的計畫要求（原文）：Public release.json／navigation = 1.14.1／candidate SHA；canonical public smoke；主要 JS 含 `icon-button`、`drawing-tool-icon`、`aria-keyshortcuts` 與新的狀態文字「工具列的縮小按鈕」、不含舊的「按 Esc 或「結束放大」返回」，主要 CSS 含 `.drawing-toolbar .icon-button`（44 px 寬）；在部署上的 Student Preview 確認圖示按鈕並操作放大書寫。登入後 smoke 以未登入的檢查替代（release-prep review 核定，同 v1.14.0）：只改按鈕的呈現，練習頁的儲存與提交程式路徑沒有改變，部署上的 Student Preview 使用同一個 `DrawingCanvas`。
- [x] Production 的存取：一次 Pages 部署；未登入的公開 GET；GitHub 的唯讀 API。沒有 Supabase 的任何存取、沒有登入。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.14.1 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、設計、完整證據與已知限制：[v1.14.1 delivery](v1.14.1-delivery.md)。以下歷史 checklist 保留原樣。

## v1.14.0 enlarged handwriting production acceptance closure

日期：2026-10-16（Asia/Taipei）。已接受的 production runtime candidate 為 `b9e2d49150a8c02cd1ddd1e21bf30fadcbef6d10`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.13.0：tag object `43cf42ec9e23c7a6bf6394b382a2e41385848c1d`／peeled `249857ce86d572a8493aede27d831dbabb8d0dfc`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `249857ce86d572a8493aede27d831dbabb8d0dfc`；release prep 開始時 staged empty、working tree 只有本 feature 的變更；v1.13.0 tag object 與 peeled commit 未變；local／remote v1.14.0 tag absent。
- [x] 需求範圍：human 要求手寫畫布可以放大，解決一題有三小題時寫不下的問題，完成後交由 sub-agent reviewer 審查並以 Playwright 實際測試。Human 決定（選項）：「全螢幕＋縮放」，只改 frontend；不採用加大邏輯畫布（需要 migration、Edge 與付費的 provider canary）。
- [x] 實作：`DrawingCanvas.tsx` 的「放大書寫」（全視窗編輯區、1×／1.5×／2×、移動畫面、Esc 返回、modal 與 inert、焦點留在編輯區、頁面捲動計數鎖定與位置還原、筆畫進行中先保存）；`global.css` 的放大版面。保存格式、座標換算與 repository 呼叫不變。
- [x] Regression：新增 `DrawingCanvas-enlarged.test.tsx`（13 個測試）；既有測試未修改。
- [x] Local gates：110 files／1,678 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation）：1440／1180／820／360 放大、2×、移動畫面、保存座標、Esc 還原；modal、焦點、Esc 中斷筆畫、傳統捲軸（headed Chromium）下 1× 沒有捲軸且 2× 大小穩定、頁面底部的最後一題放大後捲動位置還原；題庫編寫頁 Student Preview；console／page errors 0。
- [x] Sub-agent review（本 session 內的 code reviewer）：cycle 1 一項 blocking、兩項 should-fix 與數個 nit，已修正；cycle 2 APPROVE 並另提一項 should-fix 與四個 nit，全部修正（修正後重跑 gates 與 browser）；cycle 3 APPROVE、沒有新發現。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=false（Risk C 來自 ignored `.env.local` 與 package files 的 unrecognized path）。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.13.0` 10／10 PASS（110 files／1,678 tests）；`release:preflight`（沒有 `--sha` 與 `--require-clean`，含 `--require-tag-absent`）7／7 PASS。Commit 後以嚴格形式重跑，結果記於 post-commit report。
- [x] Release-prep review（同一個 sub-agent）：PASS，沒有 blocking；兩項文件的 should-fix（2× 寬度的推導、登入後 smoke 替代的先例）與 nit 已修正。
- [x] 單一 candidate commit `b9e2d49150a8c02cd1ddd1e21bf30fadcbef6d10`（parent `249857ce…`，10 個路徑，三個 feature 檔案的 staged 與 HEAD blob 與 review 時相同）；commit 後 `release:check --base v1.13.0 --require-clean` 10／10 PASS（report 為 1.14.0／candidate SHA／Risk C）；strict `release:preflight --sha <candidate> --branch master --require-clean --require-tag-absent` 8／8 PASS；一次 normal push（remote master `249857c → b9e2d49`）。
- [x] [LearnForge CI 38916766079](https://github.com/LukeTsengTW/learnforge/actions/runs/38916766079)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 117026113645。
- [x] Backend：不需要（沒有 migration 或 Edge 變更）；沒有存取 Supabase。
- [x] [Deploy LearnForge to GitHub Pages 38917018937](https://github.com/LukeTsengTW/learnforge/actions/runs/38917018937)／attempt 1／workflow_dispatch／master／exact candidate success；build job 117026991260、deploy job 117027828141、deployment 7121715145 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.14.0／v1.14.0、gitSha `b9e2d49150a8c02cd1ddd1e21bf30fadcbef6d10`，一般與 cache-busted 相同；canonical public smoke PASS，舊的 1.13.0 identity 被拒絕；主要 JS 含「放大書寫」、「結束放大」、「移動畫面」、`canvas-viewport` 與放大時的狀態文字，主要 CSS 含 `.drawing-editor.is-expanded`（fixed）與 `.canvas-viewport`（overflow auto）；74 個路徑 HTTP 200，sha256 已保存供 closure-SHA parity；未登入的瀏覽器 smoke PASS。
- [x] 部署上的放大書寫：Student Preview（demo q7，800 × 600）：1440 寬由 564 px 放大為 961 px（2× 為 1932 px），360 寬由 256 px 放大為 326 px（2× 為 652 px）；編輯區鋪滿視窗、dialog／`aria-modal`、header 為 `inert`；2× 畫的一筆在 Esc 後，編輯畫布與 Answer Preview 畫布的 PNG 雜湊相同（筆跡進入作答狀態，零寫入）；頁面回到按下「放大書寫」時的捲動位置；連續 3 次執行都通過，只有對 Pages 的 GET，console／page／CSP／unhandled rejection 0。
- [x] 登入後 smoke 的替代：release-process 要求 frontend 行為在部署後另做登入後的唯讀 smoke；本版改以部署上未登入可用的 Student Preview 實際操作（同一個 `DrawingCanvas`）、release.json identity 與 bundle 內容檢查替代，不請 human 登入。沒有涵蓋登入後的練習頁與雲端儲存；這兩者的程式路徑本版沒有改變，並已在本機 fixture 以真正的 practice store 驗證保存的座標。與 v1.12.0（部署前的登入 canary）不同，本版沒有任何登入後的執行；較接近的先例是 v1.10.2。Release-prep review 核定可以接受。
- [x] Production 的存取：一次 Pages 部署；未登入的公開 GET；GitHub 的唯讀 API。沒有 Supabase 的任何存取、沒有登入。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.14.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、調查、設計、完整證據與已知限制：[v1.14.0 delivery](v1.14.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.13.0 lenient calculation grading production acceptance closure

日期：2026-10-16（Asia/Taipei）。已接受的 production runtime candidate 為 `25ac8e927d2a6256b8a6738973e75e0e286fb099`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.12.0：tag object `a54cd424f8cb051c9df92462249df8115ad82fa9`／peeled `1e00babe720fedde556e56548d614f27f902a01a`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `1e00babe720fedde556e56548d614f27f902a01a`；session 開始時 working tree clean，release prep 開始時 staged empty、working tree 只有本次的變更；v1.12.0 tag object 與 peeled commit 未變；local／remote v1.13.0 tag absent。
- [x] 需求範圍：human 要求放寬所有計算題的評分標準（寫出答案就直接給分），並把「離散數學習題 Ch1、Ch3、Ch5、Ch7、Ch8」中的「講義」改為「習題解答」。Human 的決定（2026-10-16，結構化提問，三項都選建議選項）：逐小題，答案正確即給該小題滿分、改共用的正式評分規則而不改 rubric 文字；直接修改 revision 1；發版前做一次付費的 AI 評分驗證。
- [x] 實作：`calculation-grading.ts` 的 `LENIENT_CALCULATION_SCORING` 嵌入打字與手寫的正式評分 instructions；習題題庫 19 處「講義」：18 處改為「習題解答」，說明中的「習題解答講義」刪去「講義」（scripted，數量逐項驗證）；重新產生 generated context（只有該題庫的 13 筆改變）。畫圖題、舊版 advisory、rubric 文字與配分、已提交的分數不變。
- [x] Regression：新增評分規則的測試；修改 `discrete-math-exercises-2026.test.tsx`、`LibraryPage.test.tsx`、`ch3-set-theory.test.tsx`（既有題庫的 v1.10.0 雜湊在反向套用本次用詞變更後必須重現）。
- [x] Local gates：109 files／1,665 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation，Chromium headless shell，1440／360）：Library 卡片與搜尋、練習頁 0 處「講義」、13 個題目標題、KaTeX errors 0、無 overflow；console／page errors 0，request 只有對本機的 GET。
- [x] Sub-agent feature review：沒有 blocking；證明題的 should-fix 已採納（兩次確認，第二次把「derive」移除並明寫求解類以結果為答案）；舊版 advisory 的測試已加入；其餘兩項 nit 依 delivery 所述保留。
- [x] Edge impact（import graph）：ai-drawing、ai-grade、ai-responses、ai-tutor、save-quiz-draft、submit-quiz 需要重新部署；其餘五個不變。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=true；human 已授權一次付費的 AI 評分（demo q6 只寫最終答案）。Canary script 已在本機 harness 排練：正常情境完成，兩個反向情境在身分檢查停止且沒有寫入。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.12.0` 10／10 PASS；`release:preflight`（沒有 `--sha`、`--require-clean` 與 `--require-tag-absent` 的形式）5／5 PASS。Commit 後以嚴格形式重跑，結果記於 post-commit report。
- [x] Release-prep review：cycle 1 REWORK（文件中三處事實錯誤：分小題題數、ai-grade 的分組、「19 處全部改為」的寫法；canary 的重複提交與排練讀取），cycle 2 PASS；單一 candidate commit `25ac8e927d2a6256b8a6738973e75e0e286fb099`（parent `1e00babe…`，14 個路徑，staged 與 HEAD 的 blob 與 review 時相同）；commit 後 `release:check --base v1.12.0 --require-clean` 10／10 與 strict preflight 7／7 PASS；一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38857531012](https://github.com/LukeTsengTW/learnforge/actions/runs/38857531012)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 116832238798。
- [x] Edge：部署前清單 ai-tutor 20、ai-drawing 22、ai-grade 22、ai-responses 24、submit-quiz 10、save-quiz-draft 8；各部署一次（05:48:40Z–05:49:04Z，全部 exit 0）後為 21／23／23／25／11／9，verify_jwt 與 id 不變，其餘五個 function 不變；讀回的部署內容與 candidate 逐檔相同，相對先前部署只改了 generated context（六個）與 calculation-grading（ai-grade、ai-responses、submit-quiz），檢查 0 項失敗；runtime health 6／6（五個 401 `MISSING_CREDENTIALS`、save-quiz-draft OPTIONS 204，皆有 execution id）。沒有列出 secrets、沒有 SQL、沒有讀取 log。
- [x] [Deploy LearnForge to GitHub Pages 38857865149](https://github.com/LukeTsengTW/learnforge/actions/runs/38857865149)／attempt 1／workflow_dispatch／master／exact candidate success；build job 116833289016、deploy job 116833686224、deployment 7112026893 均 success。Exactly one dispatch，在六個 Edge 部署之後。
- [x] Production release.json／navigation：version 1.13.0／v1.13.0、gitSha `25ac8e927d2a6256b8a6738973e75e0e286fb099`，一般與 cache-busted 相同；canonical public smoke PASS，舊的 1.12.0 identity 被拒絕；部署的 bundle 中習題題庫的 13 個題目標題為「習題解答」、新的說明、「習題解答講義」0 處；74 個路徑 HTTP 200，sha256 已保存供 closure-SHA parity 比對；未登入的瀏覽器 smoke（Home、Library 7 張卡片、Author、練習頁轉到登入、1440／360 無 overflow；console／page／CSP／rejection 0，只有 GET）PASS。
- [x] Provider canary（human 登入一次，一次付費的 AI 評分（依結果來源與程式路徑推定））：身分檢查 4 筆紀錄與兩份保留草稿相符；`demo`／v2-handwriting 只於 q6 打字「x=3 或 x=1/2」，save-quiz-draft 1 次、submit-quiz 1 次（200，ai-grading-v4，guard 8 項檢查成立）；**q6 AI 評分 6 / 6，三項 criterion 各 2 / 2**；總分 6 / 20，只有 q6 由 AI 評分；AI 評分約 7.5 秒；練習紀錄 4 → 5 筆，兩份保留草稿未動；guard 阻擋 0、錯誤 0。Chrome 已關閉、profile 已刪除。
- [x] Production 的存取：六個 Edge 部署、一次 Pages 部署、canary 的寫入與一次付費的 AI 評分（依結果來源與程式路徑推定）；讀取為 function 清單 2 次、`get_edge_function` 6 次、health 6 個 request、canary 登入後的 GET 與公開 GET。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.13.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、調查、設計、完整證據、canary 與已知限制：[v1.13.0 delivery](v1.13.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.12.0 submit progress production acceptance closure

日期：2026-10-15（Asia/Taipei）。已接受的 production runtime candidate 為 `8deebbeb467dee60ddd0a8a37221eba7f12ef11b`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.11.0：tag object `857ce080e8e5e950b1b3cd77c282afffadfbd466`／peeled `b66ae763b86fd3e0a97efe4445b47f6fc9c24ec6`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `b66ae763b86fd3e0a97efe4445b47f6fc9c24ec6`；session 開始時 working tree clean，release prep 開始時 staged empty、working tree 只有本 feature 的變更；v1.11.0 tag object 與 peeled commit 未變；local／remote v1.12.0 tag absent。
- [x] 需求範圍：human 要求按下「提交測驗」時顯示提交的進度條與已完成的項目，讓使用者不會因為等很久以為當掉而離開；完成後以 sub-agent review，並以 Playwright 測試，需要登入時通知 human。逐題的評分進度需要後端變更（評分在單一 submit-quiz 請求內進行，評分紀錄的 RLS 只在提交後可讀），不在範圍內；本版只改 frontend。
- [x] 實作：practice store 在正式提交時發布目前的步驟（save／verify／grade／result 與 waiting）；提交中的卡片固定在畫面底部；提交沒有完成時「提交未完成」在提交區顯示原因並取得焦點；移除表單上方的「正在檢查填空題答案語意…」。提交流程、CAS、request id 與 repository 呼叫不變。
- [x] Regression：新增 1 個測試檔、8 個測試（store 2、route 2、component 4）；既有測試只改 `handwriting-submit-sync.test.tsx` 的一個斷言（拒絕提交時的原因現在出現在頁面通知與提交區兩處）。
- [x] Local gates：109 files／1,662 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation，Chromium headless shell）：四個步驟依序推進、計時前進、等待中的評分、提交失敗的卡片與焦點、在填空題按 Enter 由頁面中段提交、1440／768／360 與深色主題無 overflow、減少動態效果停用動畫；console／page errors 0，request 只有對本機的 GET。
- [x] Sub-agent review（本 session 內的 code reviewer）：cycle 1 無 blocking、8 項發現，修正 7 項，第 8 項（「提交未完成」顯示頁面當下的通知）同意低優先、列入已知限制；cycle 2 確認 7 項皆已解決，另提 3 個 nit 亦已修正（修正後重跑 gates 與 browser；nit 的修正由 release-prep review 確認）。
- [x] 登入後的 canary（提交前；human 在一般 Chrome 的全新暫存 profile 手動登入一次）：本機提供的 candidate build（production 的 client 設定、base `/`、production backend），`demo`／v2-handwriting 只作答 q1–q4，save-quiz-draft 1 次、submit-quiz 1 次（200，ai-grading-v4）；卡片依序走完四個步驟；結果頁 8 / 20；q6／q7 為 system/unanswered，AI 評分 0；guard 阻擋 0；console／page errors 0。練習紀錄 3 → 4 筆，兩份保留草稿未動。Chrome 已關閉、profile 已刪除。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=false（Risk C 來自 ignored `.env.local` 與 package files 的 unrecognized path）。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.11.0` 10／10 PASS；`release:preflight`（沒有 `--sha`、`--require-clean` 與 `--require-tag-absent` 的形式）5／5 PASS。
- [x] Release-prep review：cycle 1 REWORK（兩項都在文件：canary 推定的伺服器寫入、登入後 smoke 的替代沒有明說），cycle 2 PASS；單一 candidate commit `8deebbeb467dee60ddd0a8a37221eba7f12ef11b`（parent `b66ae763…`，17 個路徑，staged 與 HEAD 的 blob 與 review 時相同）；commit 後 `release:check --base v1.11.0 --require-clean` 10／10 與 strict preflight 7／7 PASS；一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38757888867](https://github.com/LukeTsengTW/learnforge/actions/runs/38757888867)：push／master／exact candidate SHA／attempt 1／completed-success，checks job 116501071412 的每個 step 為 success。
- [x] Backend：不需要，沒有部署 Edge function，也沒有 migration 或 Edge runtime health。
- [x] [Deploy LearnForge to GitHub Pages 38758178628](https://github.com/LukeTsengTW/learnforge/actions/runs/38758178628)／attempt 1／workflow_dispatch／master／exact candidate success；build job 116502103168、deploy job 116502939405、deployment 7096505218 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.12.0／v1.12.0、gitSha `8deebbeb467dee60ddd0a8a37221eba7f12ef11b`，一般與 cache-busted 相同；canonical public smoke PASS，舊的 1.11.0 identity 被拒絕；部署的主要 JS 含「正在提交測驗」、「提交未完成」與 `submit-stopped-reason`，不含「正在檢查填空題答案語意」（部署前的 v1.11.0 bundle 相反）；74 個路徑 HTTP 200，sha256 已保存供 closure-SHA parity 比對。
- [x] Production public zero-write browser smoke（未登入，GET 以外的 request 在送出前中止）：navigation 1440 顯示 v1.12.0、360 依既有樣式隱藏；Home、Library 7 張卡片、Author；沒有 session 時練習頁轉到登入；1440／360 無 document overflow；Pages GET 21、Turnstile GET 2；中止 0、失敗 0、console／page errors 0、CSP violations 0、unhandled rejections 0。
- [x] 登入後 smoke 的替代：release-process 要求 frontend 行為在部署後另做登入後的唯讀 smoke；本版改以部署前的登入後 canary（candidate 程式碼對 production backend 的一次草稿建立、儲存與正式提交）加上部署後的 release.json identity 與 bundle 內容檢查替代，不再請 human 登入。沒有涵蓋 Pages origin 與 `/learnforge/` base 下的登入 session、CI 建置的 artifact 在登入後的行為。Release-prep review 核定可以接受。
- [x] Production 的存取：一次 Pages 部署與部署前 canary 的寫入；沒有執行 SQL、沒有列出 secrets、沒有讀取 Edge function 的 metadata 或 log。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.12.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、設計、完整證據、canary 與已知限制：[v1.12.0 delivery](v1.12.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.11.0 handwriting capacity budget production acceptance closure

日期：2026-10-14（Asia/Taipei）。已接受的 production runtime candidate 為 `3eddd2e3613062099174ee0d2169a72854185442`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.10.2：tag object `ed2ca5fc6f4b64287f3328dbaa51b4a37e173fec`／peeled `e516cc4e2abdad09f6c9e15a23ec8175f6f8284f`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `e516cc4e2abdad09f6c9e15a23ec8175f6f8284f`；staged empty；v1.10.2 tag object 與 peeled commit 未變；local／remote v1.11.0 tag absent。
- [x] 需求範圍：human 回報在 iPad 上被 256 筆的上限擋下，要求做剩下的三步（容量提示、提高上限、座標取整），並要求先做設計分析，把筆數上限由主要的容量限制改為只防濫用。另納入四項（整份草稿在接受時檢查、拒絕訊息分開、進行中的畫法、被接受的一筆重畫一次），由 independent reviewer 逐項裁定。同步的時機與協定、整份草稿 4 MiB 的上限與 geometry 預算不在範圍內。
- [x] 設計分析的結論：必須 migration，只改一個資料庫函式的兩個數字；不需要重新設計 schema。預算：每題取樣點 32,000；筆數 16,000 只防濫用（正常落筆到抬筆的一筆至少兩個點，所以正常書寫下取樣點預算先到；並且小於 65,536）；geometry 25,000,000、PNG 2,000,000 bytes、畫布邊長 1200、整份草稿 4 MiB／100 題不變。
- [x] 實作：座標取整到 0.1；容量提示（任何一項達到 75% 或沒有一筆一般筆畫的餘裕時出現）與依上限分開的拒絕訊息；整份草稿的大小在接受變更時檢查，量法與 save-quiz-draft 相同；進行中的筆畫畫在已完成筆畫的離屏圖上，無法使用時退回完整重畫；被接受的一筆完整重畫一次。取樣與提交的程式沒有改；drawing schema、保存格式與已保存的圖不變。
- [x] Migration `20261013142522_drawing_point_budget.sql`：與前一次定義 `private.v4_strokes_shape_valid` 的 migration 只差兩行。本機資料庫：18 個 migration 套用後新的 security.sql 如預期失敗；套用第 19 個後函式的屬性與套用前相同、定義只差兩行，完整的 security.sql 通過並 rollback；邊界為 16,000／16,001 筆與 32,000／32,001 點。
- [x] 量測（合成筆畫、本機、桌面 headless 瀏覽器，見 delivery）：256／512／1,024／2,048 筆的序列化大小、解析與驗證、server rasterize、資料庫檢查、瀏覽器互動、同步時主執行緒的工作與 localStorage 配額。沒有實機資料。
- [x] Regression：新增 8 個測試檔、61 個測試；既有測試的修改只有上限數字改讀共用常數、訊息文字、多一種作答結果與取整的 helper。沒有既有測試因為進行中的畫法或一次重畫而修改。
- [x] Local gates：108 files／1,654 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation；Chromium 與 WebKit，device pixel ratio 1 與 2）：680 項情境檢查 PASS，包含進行中的畫面與完整重畫逐位元相同、擁有者接受但不重畫、被拒絕的一筆不留在畫布、離屏圖無法建立、四種上限的拒絕與提示、1440／768／360 的版面、Author Preview、localStorage 已滿。v1.10.2 取樣情境的回歸：Chromium 62 PASS；WebKit 61 PASS、1 項未通過（針對小數座標的縮減量期望；WebKit 的滑鼠只回報整數像素，v1.10.2 的 build 結果相同）。console／page errors 0，沒有 provider 呼叫。
- [x] Independent review（feature candidate，request `lf-2026-10-13-handwriting-capacity`，cycle 1）：PASS，無 blocking finding。
- [x] 以最終 diff 重算 Edge import graph：`drawing-raster.ts` 可由 ai-drawing、ai-grade、ai-responses、save-quiz-draft、submit-quiz 到達，`draft-v4.ts` 可由 save-quiz-draft、submit-quiz 到達；其餘變更的 runtime 路徑只在前端。需要部署的是這五個 function。相對 v1.10.2：migration ＋1；無 DB 表、Auth、RLS、secrets、provider configuration 或 dependency change。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=true。
- [x] Human 對 production migration 與五個 Edge function 部署的授權：2026-10-14 取得；32,000 points／16,000 strokes 不再調整。
- [x] Human 對 provider canary 的決定：2026-10-14 選擇 3A（專用的 release-canary 帳號、看得見容易辨識的 3～4 筆、一次正式提交、允許一次付費 AI 評分）。同一則訊息決定整份草稿 4 MiB 本版不擴大、之後另開 capacity／sync follow-up。
- [x] Release tools（commit 前，含全部變更的 working tree）：`release:check --base v1.10.2` 10／10 PASS（1,654 tests）；`release:preflight`（沒有 `--sha` 與 `--require-clean` 的形式）PASS。
- [x] Release-prep browser smoke（同一 isolation 方式，1.11.0 working tree 的正式 build；Chromium，24 項檢查 PASS）：navigation 在 1440 顯示 v1.11.0、360 時依既有樣式隱藏；Library 7 張卡片；Author Student Preview 的筆畫放開前後畫面相同、座標是 0.1 的倍數、密集筆畫以遠少於取樣數的點重畫；容量提示在 24,000 點出現、31,750 點變成警示；Answer Preview 重建的畫布與作答畫布相同；console／page／CSP／overflow 全為 0；bundle 內的上限為 16000／32000，沒有舊上限的字樣。
- [x] Release review PASS（cycle 2；cycle 1 退回，更正兩個錯誤敘述與三處措辭）；candidate commit `3eddd2e3613062099174ee0d2169a72854185442`（38 個路徑，內容與 review 時相同）、一次 normal push；commit 後 `release:check --base v1.10.2 --require-clean` 10／10 與 strict preflight 7／7 PASS；exact candidate CI 38488009950 PASS；local／master／origin parity。
- [x] Backend 同步：migration 以 CLI dry-run 後套用一次，migration 清單 18 → 19（前後各讀一次）；五個 Edge function 依序部署（ai-drawing 22、ai-grade 22、ai-responses 24、submit-quiz 10、save-quiz-draft 8），其餘六個不變；部署內容與 candidate 逐檔相同（35 項）；Edge runtime health 5／5（四個 401 MISSING_CREDENTIALS、一個 204，log 以 execution id 確認）。
- [x] Backend 完成後，一次 exact candidate deploy.yml dispatch：run 38549398847／deployment 7062829973 success。
- [x] Public release.json／navigation = 1.11.0／`3eddd2e…`；canonical public smoke PASS 並拒絕 1.10.2；72 個 asset HTTP 200；bundle 內上限 16,000／32,000；瀏覽器 smoke 25 項 PASS（Library、Author、Student／Answer Preview、1440／360、KaTeX／console／CSP，沒有 functions/v1/ 的請求）。
- [x] 登入後的 canary（human 登入一次）：`discrete-math-ch1-counting-examples` 的 q01 畫 4 筆、7,511 點；5 次草稿儲存被接受；正式提交一次（9,010 ms）；按下提交時的本機答案、最後一次被接受的儲存與伺服器讀回的筆數、點數與筆畫 SHA-256 相同；結果頁與練習紀錄重建的畫面與提交前的畫布 0 個像素不同；只有 q01 由 AI 評分；兩份保留草稿未動。依 3A 調整：不是「多於 256 筆」，也沒有做重新載入的檢查（改以提交後伺服器讀回的答案比對）；只驗到取樣點上限。
- [x] Production review（含 canary）的 independent review PASS。
- [ ] Documentation closure commit：本 snapshot 寫於 commit 之前。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment＋parity smoke：尚未執行。
- [ ] Annotated v1.11.0 tag：尚未建立。
- GitHub Release：**not used / not planned**。

Candidate scope、設計分析、量測、完整證據、rollout 順序與已知限制：[v1.11.0 delivery](v1.11.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.10.2 handwriting stroke sampling production acceptance closure

日期：2026-10-12（Asia/Taipei）。已接受的 production runtime candidate 為 `d410196434907d1fb567d50e39aaba7a5048bdba`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.10.1：tag object `e382d9f5455b6f155582c8ea7de6649d1cee94ca`／peeled `e27ffdae2d0ce3d46c40143474bfcdd7e9bb38bb`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `e27ffdae2d0ce3d46c40143474bfcdd7e9bb38bb`；staged empty；v1.10.1 tag object 與 peeled commit 未變；local／remote v1.10.2 tag absent。
- [x] 需求範圍：human 要求先精簡取樣點。只做這一項；容量提示、調整上限、drawing schema、server 與座標取整都不在範圍內。
- [x] 調查：先前每個 pointer 事件存一個點，沒有篩選。除了 6000 個取樣點，每題另有 256 筆的上限；精簡取樣點只在取樣點先滿時有幫助。
- [x] 實作只在 frontend：新模組 `src/lib/stroke-sampling.ts`（容許誤差 0.5、最長線段 24、run 上限 128）與 `DrawingCanvas.tsx` 的三個呼叫點。保存的點是收到的取樣；筆畫的最後一點永遠是最新的取樣，畫布顯示的就是會被保存的。上限、保存格式、提交流程與既有的圖不變。
- [x] 量測（來源分開記錄，見 delivery）：合成手寫模型中 120 Hz 觸控筆一般速度每筆約 45 → 15 點；真實指標事件的密集曲線 863 → 77 點。0.5 與 24 是判斷，沒有實機資料。256 筆的上限成為多數模型情況下先碰到的限制。
- [x] Regression：新增 17 個測試；既有測試只改了一個 helper 的輸入（讓每個取樣都不可精簡），斷言不變。新增與修改的測試檔配上 v1.10.1 的畫布為 4 failed／24 passed。
- [x] Local gates：100 files／1,593 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation）：八個情境執行以真實指標事件比對收到的取樣、保存的筆畫、畫布像素與提交後的重建，55 項檢查 PASS；v1.10.1 的畫布在同一組為 50 PASS／5 不成立。console／page errors 0，沒有 provider 呼叫。
- [x] Independent review（feature candidate，request `lf-2026-10-12-stroke-sampling`，cycle 1）：PASS，無 blocking finding。
- [x] 以最終 diff 重算 Edge import graph：變更的路徑與 Edge function 可到達的檔案沒有交集；`supabase/` 之下沒有變更；相對 v1.10.1 無 migration、DB／Auth／RLS／secrets／provider configuration／dependency change。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=false；沒有 provider canary。
- [x] Release-prep browser smoke（同一 isolation 方式，1.10.2 working tree）：navigation 在 1440 顯示 v1.10.2、360 時依既有樣式隱藏；Author Student Preview 的密集筆畫以遠少於取樣數的點重畫，Answer Preview 重建的畫布與作答畫布相同；console／page／CSP／overflow 全為 0。
- [x] Release review（cycle 1 PASS）；單一 candidate commit `d410196434907d1fb567d50e39aaba7a5048bdba`（parent `e27ffda…`，12 files）、一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38257740645](https://github.com/LukeTsengTW/learnforge/actions/runs/38257740645)：push／master／exact candidate SHA／attempt 1／completed-success，checks job `114840075919`；lint、test（100 files／1,593 tests）、quizzes、AI context、Edge imports、build、production audit PASS。Source-bound `release:check` 10／10 PASS 與 strict `release:preflight` 7／7 PASS 是另外的 local evidence，非 CI steps。
- [x] Backend：沒有部署任何 Edge function，也沒有 Edge runtime health（release review 核定略過；import graph 交集為空、`supabase/` 之下無差異）。11 個 function 的 revision 未變：ai-tutor 20、ai-grade 21、ai-drawing 21、ai-responses 23、save-quiz-draft 7、submit-quiz 9、password-hint 14、ai-quota 16、ai-usage 15、account-recovery-code 13、recover-account 13；依據是 Pages dispatch 前、Pages 部署後與 production review 時（最後一次由 independent reviewer 讀取）的 function metadata 讀取。沒有執行 SQL、沒有列出 secrets、沒有讀取 function log。
- [x] [Deploy LearnForge to GitHub Pages 38258278947](https://github.com/LukeTsengTW/learnforge/actions/runs/38258278947)／attempt 1／workflow_dispatch／master／exact candidate success；build job `114841916798`、deploy job `114842555195`、deployment `7015664756` 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.10.2／v1.10.2、gitSha `d410196434907d1fb567d50e39aaba7a5048bdba`。Root／manifest HTTP 200、由 HTML／JS／CSS 可達的 72 個 assets HTTP 200、base /learnforge/；canonical public smoke PASS，舊的 1.10.1 identity 被拒絕。Navigation 字樣在 desktop 寬度可見。index.html 與 72 個 assets 的雜湊已記錄於 delivery，供 closure-SHA parity 比對。
- [x] Production public zero-write acceptance（未登入，28 項檢查 PASS）：Library 7 張卡片；Author 為 Valid；Student Preview 13/13 打字＋手寫、Answer Preview 13/13；手寫 regression 情境在 1440（q03）與 360（q09）各一題（四筆、最後一筆後立刻切換作答方式、復原／重做、橡皮擦），Answer Preview 重建的畫布與作答畫布的雜湊相同；1440／360 無 document overflow；KaTeX errors 0、raw LaTeX 0、first-party console errors 0、page errors 0、CSP violations 0；16 個 request 全是對 Pages 的 GET，沒有 Supabase request 或 non-GET。
- [x] Production 上的取樣精簡觀察（未登入，Author Student Preview，從頁面外部計數）：q07 於 1440 的三筆，畫布收到 379／302／4 個取樣，重畫的折線為 27／40／4 點；q12 於 360 的一筆 505 個取樣為 31 點；Answer Preview 的 PNG 與折線點數等於作答畫布；沒有提示。觀察數的是重畫的折線，不是保存的答案。
- [x] Independent review（request `lf-2026-10-12-stroke-sampling`）：feature、release、candidate CI、public production acceptance 與 production review 均 cycle 1 PASS，無 blocking finding。
- Authenticated canary：略過（release review 核定）。登入後的練習頁、草稿儲存與正式提交搭配精簡後的筆畫，在 production 的這個部署上沒有執行過，只有本機證據；canary 帳號沒有被使用。
- Provider canary：classifier 不要求，未執行；沒有任何 provider 呼叫。
- [ ] Documentation closure commit：本文件 commit 前尚未建立；scope 為 README.md、CHANGELOG.md、docs/release-checklist.md、docs/v1.10.2-delivery.md。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment／parity：尚未執行；production 目前部署的是已接受的 runtime candidate `d410196…`。
- [ ] Annotated v1.10.2 tag：尚未建立。GitHub Release：**not used / not planned**。

這個版本沒有使用 canary 帳號，沒有讀取、也沒有變更它的資料；v1.10.1 記錄的保留資料（兩份保留的草稿與兩筆已提交的作答）這次沒有再查核。任何 cleanup 需另行授權；兩份保留的草稿不得提交。

Candidate scope、演算法、量測、production evidence 與已知限制：[v1.10.2 delivery](v1.10.2-delivery.md)。以下歷史 checklist 保留原樣。

## v1.10.1 handwriting submit synchronization production acceptance closure

日期：2026-10-12（Asia/Taipei）。已接受的 production runtime candidate 為 `46e2e3ebe42f81519522d063d8facb63ef9dd6d3`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.10.0：tag object `af0d71171bf15884c798abaea091ccfeae29c50a`／peeled `b5a1b3f7da750d6aaa225b519a41fda7a1a22499`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `b5a1b3f7da750d6aaa225b519a41fda7a1a22499`；staged empty；v1.10.0 tag object 與 peeled commit 未變；local／remote v1.10.1 tag absent。
- [x] 調查：在 v1.10.0 重現出四種「畫面有、提交沒有」的情況（超過手寫儲存上限、提交進行中的筆畫、儲存回應遺失、其他 client 改寫草稿）；一般的 debounce／in-flight race 在 v1.10.0 已正確。Root cause 與 submit-boundary contract 見 delivery。
- [x] 修正只在 frontend：答案更新的同步結果、畫布只保留被接受的筆跡、提交邊界檢查、辨認自己已套用的儲存。手寫儲存上限、drawing schema、正式提交與評分語意不變；沒有 timeout／固定等待／輪詢。
- [x] Regression：新增 25 個測試；三個新測試檔在 v1.10.0 的 source 上為 16 failed／8 passed（通過的 8 個是 v1.10.0 已正確的情境）。
- [x] Local gates：98 files／1,576 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（本機受控 fixture，零網路 isolation，原因與做法見 delivery）：八個情境（立刻提交、較舊的儲存進行中、作答方式切換、橡皮擦、儲存回應遺失、第 257 筆、提交進行中、其他 client 改寫）以筆數、點數、序列化雜湊與畫布像素比對提交前後，21 項檢查 PASS；v1.10.0 的 source 在後四個情境不成立。console／page errors 0，沒有 provider 呼叫。
- [x] Independent review（feature candidate，request `lf-2026-10-12-handwriting-submit-sync`，cycle 1）：PASS，無 blocking finding。
- [x] 以最終 diff 重算 Edge import graph：本次變更的路徑與 Edge function 可到達的檔案沒有交集；`supabase/` 之下沒有變更；相對 v1.10.0 無 migration、DB／Auth／RLS／secrets／provider configuration／dependency change。
- [x] Classifier：security-ai／Risk C／providerCanaryRequired=true。觸發 provider 規則的只有 `AttemptProvider.tsx` 與 `CloudAttemptProvider.tsx`（檔名含 provider 的舊 React context 元件，沒有任何檔 import）；實際變更沒有 provider／grading／raster／prompt／model／evidence 行為的改變。Human supervisor 於 2026-10-12 決定豁免，不做付費 provider canary；本次沒有任何 provider 呼叫的授權。
- [x] Release-prep browser smoke（同一 isolation 方式，1.10.1 working tree）：navigation 在 1440 顯示 v1.10.1、360 時依既有樣式隱藏；Library 7 張卡片；Author Student Preview 手寫筆畫正常累積；fixture 的八個情境 21 項檢查 PASS；console／page／CSP／overflow 全為 0。
- [x] Release-prep review（cycle 1 REWORK：delivery 對既有 CI 風險的描述不精確；改寫後 cycle 2 PASS）；單一 candidate commit `46e2e3ebe42f81519522d063d8facb63ef9dd6d3`（parent `b5a1b3f…`，26 files）、一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38192246973](https://github.com/LukeTsengTW/learnforge/actions/runs/38192246973)：push／master／exact candidate SHA／attempt 1／completed-success，checks job `114627290209`；lint、test（98 files／1,576 tests）、quizzes、AI context、Edge imports、build、production audit PASS。Source-bound `release:check` 10／10 PASS 與 strict `release:preflight` 7／7 PASS 是另外的 local evidence，非 CI steps。
- [x] Backend：沒有部署任何 Edge function，也沒有 Edge runtime health（import graph 交集為空、`supabase/` 之下無差異）。六個 revisions 仍為 ai-tutor 20、ai-grade 21、ai-drawing 21、ai-responses 23、save-quiz-draft 7、submit-quiz 9，其餘五個 function 未變；依據是 Pages dispatch 前、Pages 部署後與 production canary 後的 function metadata 讀取。沒有執行 SQL、沒有列出 secrets、沒有讀取 function log。
- [x] [Deploy LearnForge to GitHub Pages 38192838517](https://github.com/LukeTsengTW/learnforge/actions/runs/38192838517)／attempt 1／workflow_dispatch／master／exact candidate success；build job `114629089659`、deploy job `114629391312`、deployment `7004704317` 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.10.1／v1.10.1、gitSha `46e2e3ebe42f81519522d063d8facb63ef9dd6d3`。Root／manifest HTTP 200、由 HTML／JS／CSS 可達的 72 個 assets HTTP 200、base /learnforge/；canonical public smoke PASS，舊的 1.10.0 identity 被拒絕。Navigation 字樣在 desktop 寬度可見。index.html 與 72 個 assets 的雜湊已記錄於 delivery，供 closure-SHA parity 比對。
- [x] Production public zero-write acceptance（未登入）：Library 7 張卡片；Author 為 Valid；Student Preview 13/13 打字＋手寫、Answer Preview 13/13；手寫情境在 1440 與 360 各一題（四筆、最後一筆後立刻切換作答方式、復原／重做、橡皮擦），Answer Preview 重建的畫布與作答畫布的雜湊相同；1440／360 無 document overflow；KaTeX errors 0、raw LaTeX 0、first-party console errors 0、page errors 0、CSP violations 0；16 個 request 全是對 Pages 的 GET，沒有 Supabase request 或 non-GET。
- [x] Production submit canary 的做法是 human 的決定：human 看過方案 A（只用橡皮擦、不呼叫 provider、看不到筆跡）、B（看得見的筆跡、一次付費 AI 評分）與 D（不做）之後選了 A。
- [x] 第一次嘗試在開啟題庫那一步停止（點擊 timeout；停止後頁面為 hidden），對 production 的寫入為 0，沒有重試；本機演練重現了同樣的失敗，並確認加上四個 Chrome 啟動參數後視窗被遮住時流程仍可完成。
- [x] 第二次嘗試完成（既有專用 release-canary identity，`discrete-math` revision 2 的 q2）：橡皮擦 4 筆／32 點；最後一筆放開後 74 ms 完成提交的兩次點擊，點擊之前沒有任何儲存送出過這些筆畫；`save-quiz-draft` 1 次、`submit-quiz` 1 次，皆 HTTP 200；提交當下的本機狀態、最後一次儲存與 server 保存的答案列三者的筆數、點數、工具序列與序列化 SHA-256 相同。Guard 擋下的 request 0；console／page errors 0。
- [x] Provider calls 0（由回應與 source 推得）：瀏覽器沒有送出 ai-tutor／ai-grade／ai-drawing request；`submit-quiz` 的回應中五題計算題全是 system／unanswered 且 cached 為 false。沒有讀取 function log、SQL 或 provider 用量紀錄。
- [x] 與原始驗收要求的出入已記錄：畫面上看不到筆跡、結果頁顯示未作答且沒有重建的圖、只有結構比對、提交是兩次點擊、human 登入兩次。看得見的手寫筆跡在 production 沒有這個版本的 end-to-end 證據。
- [x] Canary 之後的 production 狀態：canary 帳號有兩筆已提交的作答（新增的 0 / 100 與原有的 1 / 20）與兩份保留的草稿；沒有 cleanup、沒有登出。Mutation evidence 的範圍：未執行 SQL、未做 DB row count／hash 的前後比對；觀察到的寫入是 `get_or_create_quiz_draft` 1、`save-quiz-draft` 1、`submit-quiz` 1 與 application 自動送出的 account-recovery-code status 查詢；ai-quota 自動 GET 3 次，housekeeping 的 affected rows UNKNOWN；rubric 的 cache／呼叫紀錄與 judgment 依 source 推得，沒有觀察。
- [x] Independent review（request `lf-2026-10-12-handwriting-submit-sync`）：candidate CI、public production acceptance 與 production review 均 PASS，無 blocking finding。Production canary 的 cycle 1 為 REWORK（第一次嘗試在寫入前停止，要求先有視窗被遮住時仍能完成的證據），cycle 2 PASS。Release-prep review 與 production canary 的兩次 REWORK 各有一個 blocking finding，都已處理。
- Provider canary：classifier 標記為需要，human 豁免，未執行。
- [ ] Documentation closure commit：本文件 commit 前尚未建立；scope 為 README.md、CHANGELOG.md、docs/release-checklist.md、docs/v1.10.1-delivery.md。
- [ ] Closure commit exact CI：尚未取得。
- [ ] Exact closure-SHA Pages deployment／parity：尚未執行；production 目前部署的是已接受的 runtime candidate `46e2e3e…`。
- [ ] Annotated v1.10.1 tag：尚未建立。GitHub Release：**not used / not planned**。

Production 保留的 canary 資料：v1.9.0 與 v1.10.0 的兩份 canary 草稿、原有的一筆已提交作答，以及這次新增的一筆已提交作答；任何 cleanup 需另行授權。兩份保留的草稿含有看得見的筆畫與文字，不得提交。

Candidate scope、調查、contract、production evidence、與原始要求的出入及已知限制：[v1.10.1 delivery](v1.10.1-delivery.md)。以下歷史 checklist 保留原樣。

## v1.10.0 chapter 3 set theory examples production acceptance closure

日期：2026-10-11（Asia/Taipei）。已接受的 production runtime candidate 為 `46543f7c2e2cf66a2bc3231eef6a055b6daf074f`。本 section 在 documentation closure commit 前整理；**closure commit、closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.9.0：tag object `03e71a6523f1f5b60511004d7ce6c8f713384b65`／peeled `61c4c40105af2f8d643f6b7d264c9f17fdfa3dea`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `61c4c40105af2f8d643f6b7d264c9f17fdfa3dea`；staged empty；v1.9.0 tag object 與 peeled commit 未變；local／remote v1.10.0 tag absent。
- [x] 來源 PDF（2,964,329 bytes、SHA-256 `8b3839d1a0276751131e376c67472e9d4ad65fa7353610c757359d5354fa99a3`、24 頁）逐頁對照頁面影像：13 個 worked-example units 皆有對應題目，沒有漏題或新增題；canonical answers 獨立重算 67/67 相符，沒有 source answer 衝突；來源筆誤兩處（p7、p23 (c)）已記錄。
- [x] 新題庫 13 calculation／13 drawing-capable，150 分，1200×900；9 revisions／7 current／103 questions／103 contexts；既有 90 題 baseline 雜湊保留。
- [x] Local gates：95 files／1,551 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence（零網路 isolation，原因與做法見 delivery）：Library 7 張卡片、新卡片與搜尋／篩選、Author Valid、13/13 Student Preview、13/13 Answer Preview、三個 viewport 共 39/39 次打字／手寫切換、代表題的輸入與筆跡保留；360/768/1440 無 document overflow，KaTeX errors 0，console／page errors 0，CSP violations 0，沒有 submit 或 provider 呼叫。
- [x] Independent review（feature candidate，request `lf-2026-10-11-ch3-set-theory-examples`，cycle 1）：PASS，無 blocking finding。
- [x] 以目前 source 重算 runtime import graph：六個受影響 Edge functions；save-quiz-draft verify_jwt=true，其餘五個維持 false。
- [x] 相對 v1.9.0 無 migration、DB／Auth／RLS／secrets／provider configuration／dependency change。Classifier：security-ai／Risk C／providerCanaryRequired=false。
- [x] Release-prep browser smoke（同一 isolation 方式，1.10.0 working tree）：navigation 顯示 v1.10.0、Library 7 current、新卡片資訊、Author Valid、代表題 Student／Answer Preview、360／1440，console／page／CSP／KaTeX／overflow 全為 0。
- [x] Release-prep review（request `lf-2026-10-11-release-prep-v1.10.0`，cycle 1）PASS；單一 candidate commit `46543f7c2e2cf66a2bc3231eef6a055b6daf074f`（parent `61c4c40…`，13 files）、一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38133987396](https://github.com/LukeTsengTW/learnforge/actions/runs/38133987396)：push／master／exact candidate SHA／attempt 1／completed-success，checks job `114453959026`；lint、test、quizzes、AI context、Edge imports、build、production audit PASS。Source-bound `release:check` 10／10 PASS 與 strict `release:preflight` 7／7 PASS 是另外的 local evidence，非 CI steps。
- [x] 明確的 backend production mutation 授權；部署前 gate（identity、clean tree、tag absence、exact CI、production 仍為 1.9.0、18／18 migrations、import graph、candidate context 103）PASS。
- [x] 六個 required Edge functions 各部署一次／ACTIVE／identity 與 JWT parity：ai-tutor 19→20 false、ai-grade 20→21 false、ai-drawing 20→21 false、ai-responses 22→23 false、save-quiz-draft 6→7 true、submit-quiz 8→9 false；其餘五個 function 未變，無 unrelated deployment。
- [x] Edge source／context verification（60 項）：deployed file set 等於 runtime import graph，內容與 candidate 相符（僅 CRLF 行尾差異）；canonical contexts 103，v1.9.0 的 90 筆保留、新增 13 筆；migration delta 0（18 = 18）。這個階段沒有對資料庫執行 SQL，也沒有 secrets list。
- [x] Edge runtime health：六個 revisions 各一個不帶 credential 的 request；五個回 HTTP 401（function 內的 auth 層）、save-quiz-draft OPTIONS 回 204；platform logs 皆有 execution id 與 Boot event、無 error。Provider calls 0 與沒有 application mutation 的依據是 control flow，沒有資料庫前後比對。Independent review（request `lf-2026-10-11-edge-sync-runtime-v1.10.0`，cycle 1）PASS。
- [x] Explicit exact-candidate Pages authorization；[Deploy LearnForge to GitHub Pages 38146242320](https://github.com/LukeTsengTW/learnforge/actions/runs/38146242320)／attempt 1／workflow_dispatch／master／exact candidate success；build job `114490096796`、deploy job `114490375862`、deployment `6996759743` 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.10.0／v1.10.0、gitSha `46543f7c2e2cf66a2bc3231eef6a055b6daf074f`。Root／manifest HTTP 200、由 HTML／JS／CSS 可達的 72 個 assets HTTP 200、base /learnforge/；canonical public smoke PASS，舊的 1.9.0 identity 被拒絕。Navigation 字樣在 desktop 寬度可見。
- [x] Production public zero-write acceptance：Library 7 張卡片／7 current quizzes、`discrete-math-ch3-set-theory-examples` 可見（13 calculation questions／150 分／約 120 分鐘）；Author 為 Valid；Student Preview 13/13 打字＋手寫、Answer Preview 13/13；360／768／1440 無 document overflow；KaTeX errors 0、raw LaTeX 0、first-party console errors 0、page errors 0、CSP violations 0；沒有 Supabase request 或 non-GET。
- [x] Production draft canary：既有專用 release-canary identity、`discrete-math-ch3-set-theory-examples`／revision 1／q01；typed persistence、drawing persistence、mode isolation PASS；save-quiz-draft 3 calls／all HTTP 200；submit calls 0、provider calls 0；其餘 12 題 untouched。
- [x] Retained canary state：一份 draft attempt 與 q01 的 answer state，保留為 release canary evidence，沒有 cleanup。Mutation evidence 的範圍：未執行 SQL、未做 DB row count／hash 的前後比對；瀏覽器端觀察到的 intentional mutation 限於 canary draft／q01 answer，沒有觀察到其他明確的 application mutation；ai-quota 自動 GET 3 次，housekeeping 的 affected rows UNKNOWN；account-recovery-code 6 次 POST 依 client／source contract 判定為 status／read-style 呼叫。
- [x] Production acceptance independent review（request `lf-2026-10-11-pages-acceptance-v1.10.0`，cycle 1）：PASS，無 blocking finding。
- Provider canary：不需要（providerCanaryRequired=false），未執行。Submit／AI 評分／tutor 沒有 v1.10.0 的 end-to-end production 證據，列為已接受的 non-blocking 限制。
- [ ] Documentation closure commit：本文件 commit 前尚未建立；scope 為 README.md、CHANGELOG.md、docs/release-checklist.md、docs/v1.10.0-delivery.md。
- [ ] Closure commit exact CI：尚未取得；由 post-commit evidence 記錄 exact closure SHA、push／master 與結果。
- [ ] Exact closure-SHA Pages deployment／parity：**尚未授權**；production 暫時保持已接受 runtime candidate `46543f7…`，不得沿用此 SHA 代替未來 closure SHA parity。
- [ ] Annotated v1.10.0 tag：**尚未授權**、尚未建立。GitHub Release：**not used / not planned**。

Production 已含 retained release canary draft（一份 draft attempt 與 q01 的 answer state）；任何 cleanup 需另行授權。後續順序僅為 documentation closure commit／exact CI → 明確授權 exact closure-SHA Pages deployment＋parity smoke → explicit annotated-tag authorization → annotated v1.10.0 tag。

本 closure stage 只允許四份 docs、單一 normal commit／push。Candidate scope、來源對應、production evidence 與 release-process notes：[v1.10.0 delivery](v1.10.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.9.0 discrete-math exercises 2026 production acceptance closure

日期：2026-10-10（Asia/Taipei）。已接受的 production runtime candidate 為 `20940d942a402eaaa7f4e4de53cf40104c88303e`。本 section 在 documentation closure commit 前整理；**closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable base v1.8.0：tag object `331383ac77aa8492db0abc4d2c3ab7142b67148f`／peeled `e4ca50ec3668046cdc4430befc434799c89922bb`，保持不變。

- [x] Pre-preparation HEAD／master／origin/master／live remote master = `e4ca50ec3668046cdc4430befc434799c89922bb`；staged empty；local／remote v1.9.0 tag absent。
- [x] 五份 PDF 共 15 頁逐頁對照頁面影像：13 exercises／36 個小題皆有對應題目；canonical answers 獨立重算 57/57 相符，未發現講義答案有誤。
- [x] 新題庫 13 calculation／13 drawing-capable，150 分，1200×900；8 revisions／6 current／90 questions／90 contexts；既有 77 題 baseline 雜湊保留。
- [x] Local gates：94 files／1,513 PASS，零 skipped；lint、check:quizzes、check:ai-context、check:edge-imports、build、production audit、diff-check PASS。
- [x] Feature browser evidence：13/13 Student Preview、13/13 Answer Preview、13/13 打字／手寫切換、Library 卡片與篩選、本機隔離 Supabase stack 上的登入作答與草稿還原；360/768/1440 無 document overflow，KaTeX errors 0，console／page errors 0，沒有 submit 或 provider 呼叫。
- [x] Independent review（feature candidate，cycle 1）：PASS，無 blocking finding。
- [x] Runtime import graph 確認六個受影響 Edge functions；save-quiz-draft verify_jwt=true，其餘五個維持 false。
- [x] 功能 delta 無 migration、DB／Auth／RLS／secrets／provider configuration／dependency change。Classifier：security-ai／Risk C／providerCanaryRequired=false。
- [x] Release-prep review（cycle 1）PASS；單一 candidate commit `20940d942a402eaaa7f4e4de53cf40104c88303e`（parent `e4ca50e…`，13 files）、一次 normal push；local／master／origin parity。
- [x] [Exact LearnForge CI 38039509456](https://github.com/LukeTsengTW/learnforge/actions/runs/38039509456)：push／master／exact candidate SHA／attempt 1／completed-success，checks job `114176773826`；lint、test、quizzes、AI context、Edge imports、build、production audit PASS。Source-bound `release:check` 10／10 PASS 是另外的 local evidence，非 CI steps。
- [x] 明確的 backend production mutation 授權；部署前 gate（identity、clean tree、tag absence、exact CI、strict preflight、18／18 migrations）PASS。
- [x] 六個 required Edge functions 各部署一次／ACTIVE／identity 與 JWT parity：ai-tutor 18→19 false、ai-grade 19→20 false、ai-drawing 19→20 false、ai-responses 21→22 false、save-quiz-draft 5→6 true、submit-quiz 7→8 false；其餘五個 function 未變，無 unrelated deployment。
- [x] Edge source／context verification：deployed file set 等於 runtime import graph，內容與 candidate 相符（僅 CRLF 行尾差異）；canonical contexts 90，v1.8.0 的 77 筆保留、新增 13 筆；migration delta 0，DB catalog fingerprint 不變。Independent review（cycle 1）PASS。
- [x] Edge runtime health：六個 revisions 各一個不帶 credential 的 request；五個回 HTTP 401（function 內的 auth 層）、save-quiz-draft OPTIONS 回 204；platform logs 皆有 execution id 與 Boot event、無 error；application 資料不變，provider calls 0。Independent review（cycle 1）PASS。
- [x] Explicit exact-candidate Pages authorization；[Deploy LearnForge to GitHub Pages 38050771887](https://github.com/LukeTsengTW/learnforge/actions/runs/38050771887)／attempt 1／workflow_dispatch／master／exact candidate success；build job `114209274708`、deploy job `114209527901`、deployment `6980492964` 均 success。Exactly one dispatch。
- [x] Production release.json／navigation：version 1.9.0／v1.9.0、gitSha `20940d942a402eaaa7f4e4de53cf40104c88303e`。Root／manifest HTTP 200、8 個 index-referenced assets HTTP 200、base /learnforge/、Supabase project `mrrssxqolvcjxgqzoeqt`；canonical public smoke PASS，舊的 1.8.0 identity 被拒絕。
- [x] Production public zero-write acceptance：Library 6 current quizzes、`discrete-math-exercises-2026` 可見（13 calculation questions／150 分／約 120 分鐘）；Student Preview 13/13 打字＋手寫、Answer Preview 13/13；360／768／1440 無 document overflow；KaTeX errors 0、raw LaTeX 0、first-party console errors 0、page errors 0、CSP violations 0；沒有 Supabase request 或 non-GET。
- [x] Production draft canary：既有專用 release-canary identity、`discrete-math-exercises-2026`／revision 1／q01；typed persistence、drawing persistence、mode isolation PASS；save-quiz-draft 3 calls／all HTTP 200；submit calls 0、provider calls 0。
- [x] Retained canary application delta：attempts +1、answers +1；既有資料列不變；q01 保留為 release canary evidence，沒有 cleanup。
- [x] Production acceptance independent review（cycle 1）：PASS，無 blocking finding。
- [x] Documentation closure content：三份授權 docs 反映已接受 runtime 與 release-process notes；本 snapshot 不預先宣稱 closure commit／CI 或 closure-SHA Pages deployment 成功。
- Provider canary：不需要（providerCanaryRequired=false），未執行。Submit／AI 評分／tutor 沒有新的 v1.9.0 end-to-end production 證據，列為已接受的限制。
- [ ] Closure commit exact CI：本文件 commit 前尚未取得；由 post-commit evidence 記錄 exact closure SHA、push／master 與結果。
- [ ] Exact closure-SHA Pages parity/deployment：**尚未授權**；production 暫時保持已接受 runtime candidate `20940d9…`，不得沿用此 SHA 代替未來 closure SHA parity。
- [ ] Explicit annotated-tag authorization：尚未取得。
- [ ] Annotated v1.9.0 tag：尚未建立。GitHub Release：**not used / not planned**。

Production 已含 retained release canary draft（attempts +1／answers +1）；任何 cleanup 需另行授權。後續順序僅為 documentation closure commit／exact CI → 明確授權 exact closure-SHA Pages deployment＋parity smoke → explicit annotated-tag authorization → annotated v1.9.0 tag。

本 closure stage 只允許三份 docs、單一 normal commit／push。Candidate scope、來源對應、production evidence 與 release-process notes：[v1.9.0 delivery](v1.9.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.8.0 corrected eraser-width-100 production verification closure

日期：2026-10-10（Asia/Taipei）。已接受的 production runtime candidate 為 `621fb86e1cf82ad9f976fd2bd99435c6002f1fc8`。本 section 在 documentation closure commit 前整理；**closure commit CI、exact closure-SHA Pages parity 與 annotated tag 仍 pending**，不預先宣稱完成。Immutable v1.7.0：tag object `84991972d4d2040e06bd1f5060b3bb9b13548923`／peeled `860386404d3c78c9aa5cad8d014f18e7fa86e5ff`，保持不變。

- [x] Closure initial immutable gate：HEAD／origin/master／live master = `621fb86e1cf82ad9f976fd2bd99435c6002f1fc8`，working tree clean、staged empty、diff-check PASS，local／remote v1.8.0 tag absent。
- [x] 初始 feature `d982a788139dd952a09fbe8056034ea5680e8024`／[CI 37793995779](https://github.com/LukeTsengTW/learnforge/actions/runs/37793995779) 保留為歷史證據；舊 release-prep `7b2fe6bab4aba53b209fad935c5801f7c59c036b` 已被 width-100 correction supersede，不能作為 final tag target。
- [x] Eraser-width-100 reviewed implementation：`d1a6235c962fc1b2398f0f7a1224e6924ffde782`，精確 16 implementation files；[CI 37896952651](https://github.com/LukeTsengTW/learnforge/actions/runs/37896952651)／checks job `113710363113`／attempt 1／success，93 files／1,476 tests PASS。
- [x] Corrected release candidate docs commit：`621fb86e1cf82ad9f976fd2bd99435c6002f1fc8`，parent `d1a6235…`；scope 僅 CHANGELOG、release checklist、v1.8.0 delivery。
- [x] Clean corrected candidate release gates：strict local-ref preflight、clean tree／tag absence、source-bound release:check 10／10 PASS。
- [x] Candidate normal master push／[exact LearnForge CI 37901220379](https://github.com/LukeTsengTW/learnforge/actions/runs/37901220379)：push／master／exact `621fb86…`／attempt 1／completed-success，93 files／1,476 tests；lint、quizzes、AI context、Edge imports、build、production audit PASS。Release check／classification 是另外的 local evidence，非 CI steps。
- [x] Drawing contract：pen default 4、UI 1–24；eraser default 24、UI 4–100；stored structural width 1–100。DrawingStroke 結構不變、無 eraserSize field；DOM preview、logical-to-CSS scaling 與 destination-out 保留。
- [x] Reviewed backend scope：shared drawing-raster validation 與 DB helper upper width 40→100；無 table／column／RLS／Auth、secret／provider configuration change，resource ceilings／grammar／coordinate validation 不變。
- [x] Canonical [PostgreSQL gate 37894748704](https://github.com/LukeTsengTW/learnforge/actions/runs/37894748704)：job `113703442902`／attempt 1／20 of 20 PASS；Supabase CLI 2.117.0／PostgreSQL 17.6／fresh 18 migrations；完整 security.sql 經 container psql exit 0、ROLLBACK／actual final PASS marker observed，37／37 table counts unchanged、fixture users 0→0。
- [x] Backend read-only preflight 與明確 production backend mutation human authorization 已完成；採 DB first、five Edge next、provider canary、Pages later。
- [x] Production migration `20261009025324_drawing_width_100` applied exactly once；18 migrations。Live helper OID `18187`、postgres owner、plpgsql／IMMUTABLE／empty search_path、max width 100；postgres＋service_role EXECUTE，PUBLIC／anon／authenticated 無 EXECUTE。
- [x] Production DB boundaries：pen／eraser width 0=false、1/40/41/99/100=true、101=false；256/257 strokes=true/false，6000/6001 points=true/false；只用 read-only SELECT，不在 production 跑 security.sql。
- [x] Exactly five Edge deployments／ACTIVE／exact candidate source closure／JWT parity：ai-drawing v19 false、ai-grade v19 false、ai-responses v21 false、save-quiz-draft v5 true、submit-quiz v7 false；stored width 1–100，resource ceilings 不變。
- [x] Classification **security-ai／Risk C／providerCanaryRequired=true**；required production canary 已完成，非以 local tests 代替。
- [x] Width-100 canary A/B/C：q7 width100 saved/reloaded、production raster/PNG path、fresh provider grading/finalizer PASS；exactly 1 provider call、cached=false、ai_requests=0、personal AI credits=0。
- [x] Retained canary application deltas：attempts +1、answers +1、fill judgments +1、rubric judgments +2、rubric cache +1、rubric calls +1；successful evidence 保留，沒有 cleanup 待辦。
- [x] Explicit exact-candidate Pages authorization；[Deploy LearnForge to GitHub Pages 37957364887](https://github.com/LukeTsengTW/learnforge/actions/runs/37957364887)／attempt 1／workflow_dispatch／master／exact candidate success；build job `113911180474`、deploy job `113911788399`、deployment `6965441041` 均 success。
- [x] Production release.json／navigation：version 1.8.0／v1.8.0、gitSha `621fb86e1cf82ad9f976fd2bd99435c6002f1fc8`。Root／manifest HTTP 200、all 7 index-referenced JS/CSS assets HTTP 200、base /learnforge/、Supabase project `mrrssxqolvcjxgqzoeqt`。
- [x] Public zero-write drawing acceptance：`#/author` → demo / v2-handwriting bundled source → Student Preview q7；local React answer state，不建立 draft、不 save／submit、不呼叫 provider。
- [x] Eraser max100 actual erase／preview：ink pixels 7324→6124，移除 1200；logical erase gap 100，width40 對照移除 480。Pen／eraser independence 與 active contact width snapshot PASS。
- [x] Preview scaling／responsive：1440 viewport Canvas 564，expected 70.5 CSS px；768 Canvas 618，expected 77.25；360 Canvas 256，expected 32。Observed width 符合、height 僅 subpixel rounding、border 無額外 +2px、document overflow 0。
- [x] Undo／redo／clear、q6/q7 isolation、bitmap replay、hover／size change 不新增 history；PNG 800×600、6124 ink pixels，preview shown/hidden PNG hash 相同，preview ring 不在 bitmap／PNG。
- [x] Light／Dark preview、border/inset contrast 與 toolbar／Canvas layout PASS；測試後恢復原 theme。
- [x] Automated real-browser mouse hover／down／drag／up（無新 move）／leave／rapid re-entry PASS；pen/palette 隱藏正常，無 stale footprint／非預期擦除。
- [x] Controlled pen／touch lifecycle 與 stylus rejected touch PASS，**SYNTHETIC ONLY**；不將此項當作真實 Apple Pencil evidence。
- [x] Authenticated read-only acceptance：既有專用 canary session 的 history／submitted result／q7 answer bitmap／judgment／navigation 正常；canary counts 維持 1/1/1/2/1/1、ai_requests=0，provider retained total=1。
- [x] First-party application console/page/CSP errors 0、asset 404 0；第三方 browser／Cloudflare noise 分開分類。Credential scan 0 matches。
- [x] Human-confirmed real iPad／Safari／Apple Pencil acceptance：human 明確回覆「v1.8.0 iPad / Safari / Apple Pencil acceptance PASS」，涵蓋先前 real-device checklist；Codex 未自動控制 iPad。
- [x] Documentation closure content：三份授權 docs 反映已接受 runtime；本 snapshot 不預先宣稱 closure commit／CI 或 final closure-SHA Pages deployment 成功。
- [ ] Closure commit exact CI：本文件 commit 前尚未取得；由 post-commit evidence 記錄 exact closure SHA、push／master／attempt 1 與結果。
- [ ] Exact closure-SHA Pages parity/deployment：**尚未授權**；production 暫時保持已接受 runtime candidate `621fb86…`，不得沿用此 SHA 代替未來 closure SHA parity。
- [ ] Explicit annotated-tag authorization：尚未取得。
- [ ] Annotated v1.8.0 tag：尚未建立。GitHub Release：**not used / not planned**。

Production 已含 retained width100 canary data，**DB max must not automatically narrow back to40**；rollback 需另行分析／授權。後續順序僅為 documentation closure commit／exact CI → 明確授權 exact closure-SHA Pages deployment＋parity smoke → explicit annotated-tag authorization → annotated v1.8.0 tag。

本 closure stage 只允許三份 docs、單一 normal commit／push；local `npm run release:check -- --base v1.7.0` 的 source-bound 結果與 closure CI 另留 evidence。完整 runtime evidence 見 [v1.8.0 delivery](v1.8.0-delivery.md)。以下歷史 release sections 保留原樣。

## v1.7.0 Chapter 1 counting examples documentation closure

日期：2026-10-08（Asia/Taipei）。Accepted candidate `45b9bfb765792a43425ccc2e2c434c403da2360a` 的 production acceptance 已完成。Immutable base v1.6.3：tag object `beab214501508d6df9f1c975bb34d04e4b6f6a1b`／peeled `94d5d5122b6725891b719658e41ecf15c76f3634` 不變。以下記錄已完成的 candidate 證據；documentation-only closure 準備 final deployment，closure SHA／CI／final Pages／精簡 parity smoke 留於 post-commit report，不預先宣稱 future mutations 成功。

- [x] Pre-preparation HEAD/master/origin/live remote = `31ac42e68df9b173e63f3c3341411b818bcf5b47`；clean tree/index；v1.7.0 local/remote tag 和 GitHub Release absent；production 仍為 immutable v1.6.3。
- [x] Feature/fix tip CI 37753146630：93 files／1,433 PASS，零 skipped；所有 canonical CI stages PASS。
- [x] 新題庫 26 calculation／26 drawing-capable，150 分，1200×900；7 revisions／5 current／77 questions／77 contexts；既有內容雜湊保留。
- [x] Prior feature browser evidence：26/26 Student Preview、26/26 Answer Preview、360/768/1440、無 document overflow、KaTeX errors 0。
- [x] AST runtime graph 確認六個受影響 Edge functions；無 unresolved/nonliteral local imports；save-quiz-draft verify_jwt=true，其餘五個保留 false。
- [x] 功能 delta 無 migration、DB/Auth/RLS/secrets/provider configuration/dependency change。Risk C 的 canonical context 必須同步到 Edge；不要求 paid provider canary。
- [x] Prepared source strict preflight／source-bound release:check against v1.6.3：10/10 PASS，lint／1,433 tests／TypeScript／Pages-base build／manifest／production audit／diff-check。
- [x] 一個 release-prep commit、一次 normal push、exact candidate CI 37759361106：93 files／1,433 PASS、零 skipped、全部 stages success；local/master/origin/live parity。
- [x] 六個 required Edge 各部署一次，全部 ACTIVE，id/JWT 保留，accepted revisions ai-tutor 18、ai-grade 18、ai-drawing 18、ai-responses 20、save-quiz-draft 4、submit-quiz 6；無 unrelated deployment。
- [x] ai-tutor live canonical source 完全相符；ai-grade independent API source inspection 確認 revision/hash、readable source 與 Chapter 1 contexts。CLI UnsafeFunctionDownloadPathError 是 verification-tool extraction limitation；沒有 safety bypass，不要求其餘 CLI downloads、不 redeploy。
- [x] 六個 Edge 確認後，一次 exact candidate Pages 37762035891／deployment 6932859081，全部 workflow stages／deployment success。
- [x] Public release.json／navigation = 1.7.0／candidate SHA；root、manifest、assets HTTP 200，base=/learnforge/，production Supabase ref unchanged。
- [x] 五個 current Library quizzes、離散數學／計數搜尋、新 quiz 26 題／150 分與 q01/q06/q14/q19/q26、來源修正與保留性 PASS。
- [x] 26/26 Student／Answer Preview、schema-1/schema-2 controls、雙 buffers／question isolation／active-only／reset；360/768/1440 無 overflow；KaTeX／非預期 rendered raw TeX／application console／page errors／LearnForge CSP 均 0。沒有 provider canary／user-data mutation；不宣稱實機 iPad/Safari/Apple Pencil。
- [x] Candidate acceptance 已完成並取得 documentation-only closure／一次 final Pages 的授權；closure 不變更 runtime，不 redeploy Edge，不重試 source download。
- [ ] Immutable v1.7.0 tag：尚未建立，final closure verification 後仍 STOP，等待另行授權；不建立 GitHub Release。

Candidate scope、來源校正、完整基準與部署程序：[v1.7.0 delivery](v1.7.0-delivery.md)。以下歷史 checklist 保留原樣。

## v1.6.3 Apple Pencil stability / iPad compatibility closure

日期：2026-10-07（Asia/Taipei）；immutable baseline v1.6.2 object `7f4d2431929dd88bac321b90cbd0817719c7f5c9`／peeled `82ea0f112ee6fe33d5ebc97a6bc00cb8765b11fe` 保持不變。

- [x] Accepted exact candidate `f93ad94dc9d5843ab897dfe2313ecb51f4c6ca34`；pre-closure HEAD/master/origin/live remote／production manifest parity，clean tree/index，v1.6.3 tag／GitHub Release absent。
- [x] Proven reused-ID stale capture-loss and delayed controlled-history races fixed; synchronous accumulation/pending replay and imperative flush contract preserved。
- [x] Nonempty zero-displacement `[P,P]`／multiple-identical pen and eraser strokes replay as visible circular dots; shared PNG replay corrected。
- [x] iPad trace: prior up/commit/pending-clear/loss completed; failed Scribble-enabled rapid re-contact delivered neither pointerdown nor stylus touchstart. No speculative input/timing workaround。
- [x] iPad-only「Apple Pencil 使用提醒」links to exact [Apple Taiwan settings instructions](https://support.apple.com/zh-tw/guide/ipad/ipad355ab2a7/ipados)，設定 > Apple Pencil > 隨手寫；no Scribble-state detection claim。
- [x] Temporary drawingDebug observer/UI and debug-specific tests removed before release; actual product regressions retained。
- [x] Focused 89／full 91 files・1,359 tests／TypeScript／lint／Pages-base build／diff-check PASS；clean/source-bound 10/10 gates，unchanged classifier Risk C／providerCanaryRequired=false。
- [x] Exact candidate CI 37640405750／Pages 37640714852／deployment 6913318153 success；version 1.6.3／manifest and navigation parity／canonical public smoke PASS。
- [x] Complete controlled browser matrix: 24 groups, 24/24 committed dots including PNG, rapid A–D same/different IDs, stale capture, palm, tools/history, KaTeX, Light/Dark and 360/768/1440 PASS; notice platform/keyboard-link/responsive checks PASS。
- [x] **REAL APPLE PENCIL PASS WITH SCRIBBLE DISABLED** on exact accepted candidate: actual iPad notice/link, rapid a–d／i j t x／dots／20+ contacts／palm／math all PASS. No missing ink/dot, phantom palm, pause requirement or lock. Scribble-enabled handwriting is not claimed fixed。
- [x] User explicitly authorized exactly one docs-only closure commit／normal push／exact CI／final Pages dispatch／final smoke／one unsigned annotated tag creation and exact-ref push。
- [ ] Post-commit closure SHA／CI／final Pages deployment／release.json parity and clean refs, then tag object/message/peeled-target/local-remote equality; exact results recorded in the final post-commit report without a second docs commit。
- [x] Closure scope documentation-only; zero source/tests/package/workflow/quiz/context/dependency/backend changes, Edge/provider/user-data mutations or GitHub Release。

Actual evidence: [v1.6.3 delivery](v1.6.3-delivery.md)。以下歷史 checklist 保留原樣。

## v1.6.2 frontend drawing UX release

日期：2026-10-07；基準 immutable v1.6.1／911ea84f71e72cf29ff2ca2f56726d212056e401。

- [x] Preserve interrupted implementation；CSS harness-only correction；focused 55/55 PASS。
- [x] TypeScript、lint、full 91 files／1,325 tests、Pages-base build、diff check PASS。
- [x] Feature bf2c7d3f45432796151fae9286720854aeb7c73b 只有四個 frontend/test/helper/CSS files；protected quiz/context/models/Supabase paths unchanged。
- [x] package/lock roots/visible label = 1.6.2；無 dependency maintenance。
- [x] LF exact-candidate clean clone canonical 10/10 gates；Risk C／providerCanaryRequired=false 由 package/lock root metadata 保守規則造成，actual delta frontend-only；single candidate push／CI 37609915649 success。
- [x] Initial exact Pages 37610202192／deployment 6908021226 success；canonical public smoke PASS（5 assets／production Supabase identity unchanged）。
- [x] Complete production browser smoke：17 checks／6 Light+Dark 360/768/1440 layouts，pointer ownership／palm concurrency／history／clear／PNG／storage failure PASS；zero overflow／console／CSP errors；CalculationAnswerEditor buffer regressions 由原 focused tests 證明。
- [x] KaTeX initial zero-count 是 300ms parse debounce 的 smoke synchronization defect；當時「解析中…」、0 cards/Markdown；等待 Valid／title／revision 2／Student Preview／MISSISSIPPI 後 11 cards、46 KaTeX／2 display、zero raw leakage/errors。沒有修改 Markdown／quiz／math dependencies。
- [x] CRLF validation checkout false context drift 原因已證明；只新建 local core.autocrlf=false clone，generated context byte 等同 v1.6.1，repo policy 未修改。
- [ ] Docs-only closure／push／CI／final Pages／manifest parity／clean tree；actual final identity 由 post-commit report 核對。
- [x] Zero backend／user-data mutations；v1.6.1 immutable；no v1.6.2 tag／GitHub Release。

Actual evidence and limitations: [v1.6.2 delivery](v1.6.2-delivery.md)。歷史 checklist 保留如下。

## v1.6.1 production verification / closure preparation

日期：2026-10-07。比較基準為 immutable `v1.6.0`／`9575a17f0541c85c46f81bd88820ff7f91c7964c`；以下歷史 records 保留原樣。

- [x] 起始 clean tree；continuations 保留既有 dirty implementation；remote master 無 drift，v1.6.1 tag absent。
- [x] discrete-math/1 archived/text-only；discrete-math/2 uniquely current，11 題／100 分／6 single／5 calculation；q2–q6 = 1200 × 900。
- [x] 6 bundled revisions／4 current quizzes／51 questions／51 contexts；全部原有 40 contexts 不變，只新增 11 discrete-math/2 contexts。
- [x] 16 files／411 focused tests；stale dynamic-inventory correction 後 supplemental 4 files／60 tests；DrawingStroke fixture typing correction 後 tsc、quizzes、AI context、Edge imports、Pages-base build、diff check PASS。
- [x] One local feature commit `b43c3120be1d9aa73a00e5971f90bac084d50f9a`；package/lock roots/visible label 準備為 1.6.1，無 dependency changes。
- [x] 兩個 stale capability assertions 已證明並窄幅修正；test-fix／final candidate `c8c84f89c8541a0e9a74ec666d983f7d198d0dad` 在既有 feature／release-prep 上追加，沒有改寫歷史。Affected 2 files／28 tests、tsc、full 90 files／1,300 tests 與 validators PASS。
- [x] Clean/source-bound ten candidate release gates against v1.6.0；single exact candidate-tip push 含三個 commits；exact CI [37599748395](https://github.com/LukeTsengTW/learnforge/actions/runs/37599748395) success。
- [x] Risk C／providerCanaryRequired=false；learnforge-demo／mrrssxqolvcjxgqzoeqt 確認。六函式一次 batch 部署、ACTIVE／JWT／完整 runtime source／51-context hash PASS；沒有重部署其他五函式或 provider canary。
- [x] Initial exact Pages [37601057313](https://github.com/LukeTsengTW/learnforge/actions/runs/37601057313)／deployment 6906473959 success；canonical public smoke、live revision-2 Library/Author、controlled typed/handwritten fixture、Dark／KaTeX／360/768/1440 layouts PASS。九個 deployed JS assets 與 exact workflow artifact bytes 相同。
- [ ] One docs-only closure commit／push／CI；final exact Pages deployment；manifest/SHA parity／UI/Edge smoke／clean tree：post-commit report 核對，未在此 snapshot 預先宣稱未執行的結果。
- [x] v1.6.1 tag／GitHub Release excluded from this authorized stage；v1.6.0 immutable。

Actual evidence and limitations: [v1.6.1 delivery](v1.6.1-delivery.md)。No DB/RLS/Auth/secret/data mutations or water-quality-system work.

## v1.6.0 production verification / closure preparation

驗證日期：2026-10-07。Replacement v1.6.0 production／required smoke PASS at e3aaedb5badc34f9b64507ef5de5b06fa796c445；docs-only closure preparation。Comparison baseline 是永久 CLOSED 的 v1.5.0／e06b740be8cc33776757f16360d76c381ed56a19。以下歷史 sections 保留原樣。

- [x] 起始 working tree clean；local HEAD／remote master = 567039f236b751434f28b8664f61e0b66a09021f；沒有 drift。
- [x] Feature automatic CI [37552181064](https://github.com/LukeTsengTW/learnforge/actions/runs/37552181064) 成功，push/master、attempt 1、exact feature SHA。
- [x] v1.5.0 local／remote annotated tag peeled target 與 production manifest baseline = e06b740be8cc33776757f16360d76c381ed56a19；v1.6.0 local／remote tag absent。
- [x] 起始 strict preflight PASS。Machine impact=security-ai／Risk C／providerCanaryRequired=false；unknown bootstrap paths、author CSS path heuristic 與未修改的 ignored .env.local 保留 conservative result。Actual committed runtime delta 為 frontend-only，human-reviewed product policy Risk B；沒有 backend rollout。
- [x] Package 與 lockfile root versions、visible Layout label 準備為 1.6.0；沒有 dependency／Dark Mode source／backend／content 修改。
- [x] Original release-prep b18d9460bf6d199ab04ccfcae3f59c566ad17fed／CI [37554010777](https://github.com/LukeTsengTW/learnforge/actions/runs/37554010777) success。
- [x] Initial Pages [37554255396](https://github.com/LukeTsengTW/learnforge/actions/runs/37554255396)／deployment 6898896968 success；其 canonical smoke 因 public-root /learnforge/theme-init.js 不符合 assets contract 而 FAIL，未把 deployment success 當成 smoke PASS。
- [x] First continuation 的 jsdom filesystem URL harness defect 保留；Node source-text harness 修正後 3 files／109 focused tests PASS。Bootstrap bytes unchanged、Pages assets path／pre-paint order／no collision proof PASS。
- [x] 第二次 offline FAIL 精確診斷：AdGuard 在 loopback index.html 注入 external script，offset 901；assetUrl line 36 的 %／?／& rejection 正確。原 report 的 static-import 說法更正為 HTML linkedAssets line 192。Ignored exact-file harness PASS，captured injected reference 仍在 fetch 前被拒絕；canonical source/parser/dependencies 未改。
- [x] Exactly one remediation commit e3aaedb5badc34f9b64507ef5de5b06fa796c445／exact-SHA push／CI [37575119526](https://github.com/LukeTsengTW/learnforge/actions/runs/37575119526) success；strict clean preflight/tag absence／source-bound release:check against v1.5.0 的 ten gates、1,284 tests、production audit、release:report PASS。
- [x] Replacement Pages [37575293906](https://github.com/LukeTsengTW/learnforge/actions/runs/37575293906)／deployment 6902285847 success，exact remediation SHA、release_version=1.6.0。
- [x] Canonical network public smoke PASS：release.json exact remediation identity、five JS assets、expected Supabase public ref；authenticated read-only Light／Dark toggle／keyboard focus／reload persistence、Home／Library filters、bundled Student／Answer previews、360／768／1440、KaTeX／no raw LaTeX／no page overflow／no relevant console/CSP error PASS。七個 production-byte VM cases 驗證 system fallback；未修改 OS theme。
- [ ] Exactly one docs-only closure commit／push、exact closure CI、final Pages deployment／production manifest／compact smoke PASS。
- [ ] Separate immutable v1.6.0 tag authorization；此 stage 不建立 tag／GitHub Release。

Closure commit 尚未建立，不在文件內自我引用未來 SHA／CI／deployment；final gates 由 post-commit verification report 記錄，沒有第二個 closure docs commit。詳細 failure history、scope、evidence 與 remaining gates 見 [v1.6 delivery](v1.6-delivery.md)。Production Supabase identity 沿用 learnforge-demo／mrrssxqolvcjxgqzoeqt；沒有 DB／Edge／Auth／RLS／secret／provider 或 real-user practice mutation。

## v1.5.0 production verification / closure preparation

驗證日期：2026-10-06。狀態：初始 v1.5.0 production deployment 與 required smoke PASS；docs-only closure preparation。初始 deployed SHA 為 c1f7b53666b7e0c19df25aa57fb1a0e4621226a5。Previous closed v1.4.0 annotated tag target 維持 7bc49ccd34702158b3129b2e2ee190cd8bd06d9a；以下 v1.4 歷史 section 完整保留。

已核對的 source facts：

- [x] Feature commit b1858ec2686bcc91af60c63bec052efb1f137ed6：feat: add discrete math midterm quiz。
- [x] Feature automatic CI [run 37394001697](https://github.com/LukeTsengTW/learnforge/actions/runs/37394001697)：push/master、attempt 1、success；87 files／1,266 tests。
- [x] Package target 1.5.0；package.json 與 package-lock.json 的兩個 root version 一致。除了 KaTeX 及其必要的 commander 相依版本外，其他 dependency 版本維持不變。
- [x] 已審閱的新題庫 discrete-math/1：11 題／100 宣告 points／6 single／5 calculation，source 內容與 canonical contexts 保持 committed feature 狀態。
- [x] Canonical contexts 29 → 40；原有 29 個保留不變。所有 11 個 production-configured entrypoints 的 runtime import closure 已分析。
- [x] v1.5.0 exact local／remote tag refs 在本機 preparation precheck 皆不存在。
- [x] 本機 KaTeX remediation：^0.18.2 解析為 0.18.10；direct-only resolution 留下兩個 vulnerable nested copies，故加入最小 `"katex": "$katex"` override。最後只有一份 fixed copy；inherited-trust probe PASS，npm audit --omit=dev exit 0／0 vulnerabilities。
- [x] 本機 Layout source diff 只有 v1.4.0 → v1.5.0；desktop 可見 v1.5.0，mobile 沿用既有隱藏 badge CSS，DOM 值為 v1.5.0。1280×900／360×800 Library、Home、Author 與 math regression PASS，沒有正式作答或 provider 呼叫。

已完成的 committed／production gates：

- [x] Release-prep diff review、exact commit c1f7b53666b7e0c19df25aa57fb1a0e4621226a5 與 push。
- [x] Release-prep automatic CI [run 37473338473](https://github.com/LukeTsengTW/learnforge/actions/runs/37473338473)：push/master、attempt 1、success；87 files／1266 tests，production audit 0 vulnerabilities。
- [x] Clean-tree strict preflight／release:check：10/10 gates PASS；full base 7bc49ccd34702158b3129b2e2ee190cd8bd06d9a。Source fingerprint 91bedafa0e2174b2f1119c457c5c94ed232b5e50f7063801f1b0934145298fa0。
- [x] Machine classification：impact=security-ai、Risk C、providerCanaryRequired=false；不覆寫 machine result，沒有 provider canary／OpenAI 呼叫。source-map-js advisory 維持 MINOR／build-tool-only；production audit clean。
- [x] 初始 cutover 前 exact clean source／remote SHA 與 v1.5.0 local／remote tag absence 再核對。
- [x] Edge batch rollout：ai-responses 17→18、ai-grade 15→16、ai-drawing 15→16、save-quiz-draft 1→2、ai-tutor 15→16、submit-quiz 3→4 → learnforge-demo / mrrssxqolvcjxgqzoeqt；一次 batch，無 retry，先於 Pages cutover。
- [x] 六個 Edge Functions ACTIVE；save-quiz-draft verify_jwt=true，其餘五個 false。ai-tutor／submit-quiz deployed source provenance 證明 40 contexts、原有 29 不變、新增 11 discrete-math/1 identities；五個 unaffected functions 未重新部署。cutover 前後 inventory unchanged。
- [x] Minimum backend compatibility 以 management-plane canonical source/provenance 驗證；沒有 application endpoint／provider probe 或資料 mutation，不宣稱完整 formal grading E2E。
- [x] 初始 Pages [run 37486449686](https://github.com/LukeTsengTW/learnforge/actions/runs/37486449686)、attempt 1、build/deploy success；deployment 6887929745／github-pages；所有 identity、quality、audit、build、manifest gates PASS。
- [x] Canonical GET-only public smoke：root／release.json HTTP 200；app learnforge、version 1.5.0、gitSha c1f7b53666b7e0c19df25aa57fb1a0e4621226a5，exact 三個 keys；HTTPS／base／assets／production Supabase identity 正確。
- [x] Production Home／Library desktop 1280×900、mobile 360×800 PASS：四 current cards、midterm 11 題／總分100分／約90分鐘；Home 布林代數基礎／13分；搜尋2025／Discrete Mathematics、科目／計算題篩選、empty reset／focus 正常；沒有 page overflow 或 console error。
- [x] Production Author bundled read-only preview PASS：Stirling note、Q3(b)四個≥／165／sum8、Q6 246；沒有 KaTeX error／raw LaTeX leakage，mobile 長公式安全內部捲動；沒有 import/export/edit/save。
- [x] Optional authenticated read-only smoke PASS：使用已存在的 production session，navigation／Library／search／filters 正常；沒有 credentials entry、attempt／draft／submission／account mutation、Tutor quota 或 provider 呼叫。

在這個 closure preparation snapshot 尚未完成的 gates：

- [ ] 審閱四個 closure docs；建立一次 docs-only closure commit，capture exact SHA；此文件寫成時 commit 尚未建立，SHA intentionally TBD。
- [ ] Push exact closure SHA 一次，require automatic closure CI success。
- [ ] 從 exact clean closure SHA／version 1.5.0 dispatch final Pages，require deployment success。
- [ ] Final public release.json exact closure SHA／HTTP 200、compact UI/mobile smoke、Edge unchanged／ACTIVE verification。
- [ ] Annotated v1.5.0 tag 指向已驗證的 final production closure SHA；tag 目前 absent、需要另行授權。沒有 GitHub Release 計畫或授權。

保留的 local remediation evidence：lint／87 files、1266 tests／check:quizzes（5 revisions、4 current quizzes、40 questions）／check:ai-context（5 revisions、40 contexts）／check:edge-imports／build／git diff --check PASS；npm audit --omit=dev exit 0／0 vulnerabilities。Local browser math regression PASS；development-only React DevTools warning／build chunk-size advisory 不影響 gates。Committed CI、strict checks、初始 Pages 與 production smoke 分別具備上述真實證據；不把 local 結果當成 production 結果。完整 source dependency closure、schema1 draft／formal grading 路徑、initial production evidence 及 remaining closure sequence 見 [v1.5 delivery](v1.5-delivery.md)。已授權 mutations 為六個 Edge bundles 與初始 Pages rollout；沒有 migration／schema／RLS／Auth／secret／provider configuration 或 user-data mutation。Final closure deployment／tag 在此 snapshot 保持 pending。

## v1.4.0 final release closure

以下狀態記錄 2026-10-05 documentation-only closure preparation 時點。

初始 production 身分：version `1.4.0`、SHA `dfe351a95bffd101148296c900e67ec342861881`；[Pages run 37248564582](https://github.com/LukeTsengTW/learnforge/actions/runs/37248564582)／deployment ID `6848985198`（`github-pages`）。

| Pre-closure evidence | 此 preparation 時點已完成的結果 |
|---|---|
| Library implementation 審閱 | PASS |
| Release identity commit push | PASS：上述 exact SHA |
| Automatic CI | PASS：[run 37213421513](https://github.com/LukeTsengTW/learnforge/actions/runs/37213421513)；86 files／1,249 tests |
| Strict local preflight | PASS |
| `release:check` | PASS：10/10 gates |
| 初始 v1.4 Pages build／deploy | PASS：run `37248564582`、attempt 1；fresh 86 files／1,249 tests |
| Public release identity smoke | PASS：exact version／SHA |
| Production Library UI smoke | PASS：搜尋、篩選、空狀態／重設、鍵盤及 360 × 800 排版 |
| Authenticated read-only smoke | PASS：使用既有 session；沒有完整 request-level network trace |
| Provider canary | 不需要：`providerCanaryRequired=false` |
| v1.4 feature rollout mutation audit | 零 backend／provider mutation；沒有 Edge／Auth 變更 |

Human-reviewed product release policy 為 Risk B；machine classifier 保留 `impact=security-ai`、`risk=C`、`providerCanaryRequired=false` 的寬 lineage／設定 inventory 結果。完整契約、證據範圍及限制見 [v1.4 delivery](v1.4-delivery.md)。

此 preparation snapshot 之後的 final closure sequence 為：

1. 審閱此 documentation-only diff。
2. 另行授權後建立並 push exact docs-only closure commit。
3. 部署該 exact closure SHA。
4. 執行 final public／read-only／no-provider smoke。
5. 建立指向該 exact deployed closure commit 的 annotated `v1.4.0` tag。

在此 preparation 時點，docs-only closure commit 尚未建立，final closure SHA／Pages run 與 annotated tag 因此沒有可記錄的身分；未把後續步驟標成 PASS。GitHub Release 未規劃或授權。

## v1.3.0 final release closure

以下是 2026-10-03 的 v1.3 發布記錄；本輪僅準備 documentation-only diff，尚未建立 closure commit。

- Production frontend：[https://luketsengtw.github.io/learnforge/](https://luketsengtw.github.io/learnforge/)（v1.3.0）。
- Production backend：Supabase `learnforge-demo`，ref `mrrssxqolvcjxgqzoeqt`，Tokyo / `ap-northeast-1`。
- Implementation SHA：`8ef526583578c917526075e459ef76eea533741b`；初始 v1.3 Pages cutover：[run 37090982945](https://github.com/LukeTsengTW/learnforge/actions/runs/37090982945)。
- Production migrations 共 17 筆；v1.3 新增 `20261001140508_multimodal_calculation_drafts`、`20261002024103_ai_grading_v4_multimodal_submission`。
- 六個 rollout functions 維持 ACTIVE：ai-grade v15、ai-tutor v15、ai-drawing v15、ai-responses v17、save-quiz-draft v1、submit-quiz v3。`save-quiz-draft` 平台 `verify_jwt=true`；其他五個為 false，由 handler 驗證 user。
- Product contract、證據範圍與限制見 [v1.3 delivery](v1.3-delivery.md)。

| Release gate | 已完成狀態 |
|---|---|
| M6.2 database rollout / M6.3 Edge rollout | PASS |
| Legacy v1.2 frontend compatibility：BS2、BS3、BS5、BS6 | PASS |
| M6.4 real Tutor/provider smoke | PASS：兩次完成、3 personal credits；restore 無新 provider |
| M6.5 初始 v1.3 Pages cutover | PASS：exact implementation SHA |
| Typed schema1→schema2 autosave / browser reload | PASS：真實 authenticated UI 與 normal save-quiz-draft path |
| BS4 runtime/auth/persistence replacement | CLOSED |
| Handwriting mode autosave / reload | PASS |
| Formal ai-grading-v4 submission | PASS：恰一個手寫 calculation provider execution，零 personal Tutor credits |
| Result reload / History reconstruction | PASS：persisted evidence，零 grading-provider replay |
| Protected historical / non-canary integrity | 捕捉的 release snapshots 未見非 canary corruption |

**Original direct legacy BS4 HTTP 503 probe：NOT EXECUTED。** Browser tooling 缺少 direct authenticated execution channel；不把未執行的 legacy 503 probe 寫成 PASS。其 runtime/auth/persistence requirement 由更強的 typed-v4 production autosave/reload proof 關閉。

下列 closure steps 全部 **NOT YET DONE**，需要後續各階段授權：

1. [ ] 發布審閱此 documentation-only diff。
2. [ ] 建立並 push docs-only closure commit。
3. [ ] 從該 exact closure SHA 部署最終 Pages。
4. [ ] 執行 final public/read-only/no-provider smoke。
5. [ ] 建立指向 exact deployed closure commit 的 annotated `v1.3.0` tag。

目前沒有 docs-closure SHA 可填寫；不得先把以上項目標成完成。GitHub Release 不在本次 closure 計畫／授權內。

Recovery lineage：前一 public v1.2 closure commit `0ebdc270e20c5798d08f27234ade771dbdaf3267`／[Pages run 36589054006](https://github.com/LukeTsengTW/learnforge/actions/runs/36589054006)；初始 v1.3 cutover commit `8ef526583578c917526075e459ef76eea533741b`／run `37090982945`。回復舊 artifact 前仍須另審相容性，這是 recovery evidence，不授權 rollback。

Security accepted baseline：ERROR 0 / WARN 1 / INFO 9；leaked-password protection warning 保留。Performance baseline：ERROR 0 / WARN 0 / INFO 8。Global rows 是觀察值，不因普通 concurrent user activity 單獨判定 release drift。既有 canary evidence 保留，cleanup 需另行授權。

## v1.2.0 final release closure

以下保留 v1.2 初始 cutover 當時的紀錄及待辦，不描述目前 v1.3 狀態；後續 v1.2 closure recovery point 已列於上方。

Current public production frontend: [https://luketsengtw.github.io/learnforge/](https://luketsengtw.github.io/learnforge/). Current production backend is Supabase `learnforge-demo`, ref `mrrssxqolvcjxgqzoeqt`, Tokyo. The old “linked development project” label for this ref is historical; the public frontend uses this production backend.

Production has migration `20260928143200_ai_grading_v3_submission` and `submit-quiz` version 2 (ACTIVE, `verify_jwt=false`). The v1.2 frontend is deployed; the prior v1.1.1 frontend was not a compatible v3 smoke client because it expected `semantic-fill-v2`. The v1.2 release commit `4fb1edbf40b6a823a3d44cfae4f043a4e6ec975b` deployed successfully in Pages Run #6 (`36580074719`). Recovery points: v1.1.1 commit `5608fdad6b9ec01d5aabe9fd28ec9f2cbd834894`, Pages run `36427515831`; previous `submit-quiz` revision 1.

Cutover sequence:

1. Compatibility, version metadata, documentation and local release gates: PASS.
2. Release commit `4fb1edbf40b6a823a3d44cfae4f043a4e6ec975b` pushed to `master`: PASS.
3. Pages Run #6 (`36580074719`) deployed that exact release commit; build, deploy and public v1.2.0 artifact checks: PASS.
4. User-run authenticated production smoke and read-only database verification: PASS. Calculation, drawing, Result reload, erased-drawing system evidence and personal quota isolation are recorded in [v1.2 delivery notes](v1.2-delivery.md). Idempotency is covered by automated tests; no separate manual production replay was performed.
5. Remaining: create and push the docs-only closure commit, deploy Pages from that exact SHA, and repeat the public smoke. Only then create the annotated `v1.2.0` tag pointing to the deployed closure commit. Do not create a GitHub Release in this closure.

See [v1.2 delivery notes](v1.2-delivery.md) for the product contract and release lineage.

## Historical v1.0 release checklist

The following records the v1.0 release gate as it stood on 2026-09-27; its status and pre-release assumptions do not describe the current v1.3 production state.

Status on 2026-09-27: **READY FOR PUBLIC DEPLOYMENT** after the Final Release Gate. No Git commit, push, Pages deploy or tag has been performed; the public URL remains 404 until deployment.

## Verified in the v1.0 workspace and linked project at that time

- [x] Node 24.21.0 / npm 11.19.0; package version 1.0.0.
- [x] Baseline 320 tests passed before implementation; final 353 tests / 42 files passed.
- [x] Lint, TypeScript/production build, quiz validation and AI context checks passed.
- [x] `npm audit --json` and `npm audit --omit=dev --json`: zero vulnerabilities; no dependency upgrade.
- [x] Two additive migrations applied after list, inspection, rollback fixture and dry run; all 12 linked/local migrations aligned.
- [x] Generated public types rechecked; full security SQL passed with rollback.
- [x] New `account-recovery-code` / `recover-account` Edge functions ACTIVE with platform `verify_jwt=false`; Deno checks passed.
- [x] Dedicated-account recovery, replay denial, old/new password login, session binding and current-password policy verified live.
- [x] Temporary `RECOVERY_ALLOW_NO_CAPTCHA` removed; public recovery fails closed again.
- [x] Auth signup/email enabled, confirm-email off for synthetic addresses, password minimum 8, require-current-password on.
- [x] Final Gate used real Turnstile: missing/invalid CAPTCHA signup and recovery denied; positive signup, login and full recovery passed in Chrome.
- [x] Wrong recovery code and used-code replay denied; old password login denied and new password login succeeded.
- [x] Temporary localhost widget/Edge allowlist entries removed; production hostname only, bypass absent.
- [x] Security advisors: 0 ERROR / 1 WARN; event-trigger grant warnings removed while RLS automation still works.
- [x] Remaining leaked-password warning explained: organization is Free; protection not available on current plan.
- [x] Production `/learnforge/` build tested in Chromium, Firefox and WebKit; core routes and HashRouter reload passed.
- [x] Live shared-tab/independent-context sync, simultaneous submit race, offline reconnect and recovery backup checks passed.
- [x] 360 / 768 / 1440 widths checked for Account, password recovery, practice recovery, Result and Analytics; screenshots reviewed.
- [x] Form labels, focus and keyboard smoke checked; existing accessibility-oriented tests passed. No WCAG certification claimed.
- [x] Source and production secret scan clean; external `_blank` links have `noopener noreferrer`; no `unsafe-eval`.
- [x] Test accounts enumerated with counts and retained; OpenAI calls for v1.0: 0.
- [x] README, CHANGELOG, SECURITY, privacy and delivery documents prepared.

## Required before any public deployment

- [x] Real Cloudflare Turnstile widget restricted to `luketsengtw.github.io`; no test key or localhost hostname remains.
- [x] `VITE_TURNSTILE_SITE_KEY` included in the production frontend build; Supabase Auth CAPTCHA and Edge `TURNSTILE_SECRET_KEY` configured.
- [x] Edge `TURNSTILE_ALLOWED_HOSTNAMES` matches the exact production hostname; development bypass absent.
- [x] Native Auth CAPTCHA enabled; real signup/login and custom recovery success plus missing/invalid token rejection verified.
- [x] GitHub Actions public variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` present.
- [x] GitHub Pages source set to GitHub Actions. The site remains 404 before deployment; use `configure-pages` output for the actual base path.
- [x] Auth Site URL and additional redirect set to `https://luketsengtw.github.io/learnforge/`. Do not push the whole local `config.toml` over unrelated remote settings.
- [x] Project identity reconciled during v1.2 M5A: `learnforge-demo` / `mrrssxqolvcjxgqzoeqt` is the backend used by the public Pages bundle; no separate release project was selected.
- [ ] Obtain explicit authorization for commit, push and Pages deployment. None of those actions happened in this Final Gate.
- [ ] After deployment, run a smoke against the actual Pages URL: login, protected route reload, submit/result, history, account and real CAPTCHA recovery. Local preview does not establish real Pages hosting behavior.
- [ ] Decide whether to remove the enumerated test accounts; deletion requires separate explicit authorization and review of cascade effects.

## Reproducible local verification

```sh
node --version
npm --version
npm ci
npm run lint
npm run test
npm run check:quizzes
npm run check:ai-context
npm run build -- --base=/learnforge/
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /learnforge/
npm audit --json
npm audit --omit=dev --json
```

Run the optional `scripts/release-browser-e2e.mjs` with `PLAYWRIGHT_MODULE_DIR` pointing to an installed `node_modules` containing Playwright and `PLAYWRIGHT_BROWSERS_PATH` pointing to its matching installed browsers. It uses the production preview and creates a dedicated `lfv10ui_` account; it deliberately does not delete it. No auth storage state, trace or raw recovery secret is saved. Do not run it against production without authorization.

`scripts/release-recovery-e2e.mjs` requires the expressly authorized temporary development CAPTCHA exception when real credentials are absent. It uses a dedicated `lfv10rc_` account and removes the exception in `finally`. Inspect the removal result even if a test fails. It also verifies fail-closed behavior after removal. Do not leave a bypass enabled if the process is interrupted.

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
npx supabase gen types typescript --linked --schema public
npx supabase db query --linked --file supabase/tests/security.sql
npx supabase db advisors --linked --type security --fail-on error
deno check --no-lock --node-modules-dir=none supabase/functions/account-recovery-code/index.ts supabase/functions/recover-account/index.ts
git diff --check
```

## Rollback and incident notes

Do not reset, truncate or repair linked migration history. Keep the recovery tables and applied migrations. For an incident, first disable the custom recovery endpoint or make it return a fixed unavailable response, remove any bypass, and stop new claims. Investigate the claim/used state before retrying an ambiguous reset. Never manually resurrect a consumed code. Existing five-minute claims can expire, while the database fence rejects delayed invalid Auth writes.

Database rollback must be an inspected additive migration and retain the fence until no pending recovery writes can commit. Reverting only the first migration's trigger would reintroduce the confirmed Auth multi-statement failure. Re-deploy a reviewed previous Edge revision only after checking schema compatibility; do not regrant browser EXECUTE on the event-trigger function. Restore Auth policy only to an equally strong documented setting.

After a future Pages deployment, frontend rollback can redeploy a prior reviewed artifact; current work has no public artifact to roll back. GitHub Pages cannot provide arbitrary response security headers; its meta CSP is a partial protection. Keep the one-hour JWT acceptance window, server-only advisor INFO messages, localStorage risks and whole-attempt conflict policy visible in release notes.
