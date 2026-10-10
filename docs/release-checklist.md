# Release checklist

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
