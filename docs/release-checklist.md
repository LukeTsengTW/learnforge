# Release checklist

## v1.6.2 frontend drawing UX release

日期：2026-10-07；基準 immutable v1.6.1／911ea84f71e72cf29ff2ca2f56726d212056e401。

- [x] Preserve interrupted implementation；CSS harness-only correction；focused 55/55 PASS。
- [x] TypeScript、lint、full 91 files／1,325 tests、Pages-base build、diff check PASS。
- [x] Feature bf2c7d3f45432796151fae9286720854aeb7c73b 只有四個 frontend/test/helper/CSS files；protected quiz/context/models/Supabase paths unchanged。
- [x] package/lock roots/visible label = 1.6.2；無 dependency maintenance。
- [ ] Same-SHA clean candidate canonical gates／Risk B／no provider canary；candidate push／CI。
- [ ] Initial exact Pages／public smoke／non-persisting browser feature smoke。
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
