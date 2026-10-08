# Changelog

## 1.7.0 — 離散數學第一章例題與 Author Preview 手寫作答

Release candidate preparation：2026-10-08。基準 immutable v1.6.3；feature/fix tip `31ac42e68df9b173e63f3c3341411b818bcf5b47`。Candidate CI／Edge／Pages／production smoke 的 exact identities 在 post-commit report 記錄；這不是 closure 或 tag。

- 新 bundled quiz family `discrete-math-ch1-counting-examples/1`：依 `01 計數的基本原理 - 2026.pdf` 收錄 26 題 worked examples、26 calculation／drawing-capable、150 分、1200×900，支援打字與手寫。全庫 7 revisions／5 current／77 questions／77 canonical contexts。
- 保留 PDF 原文差異：p.4 社會學／人類學；例題 1.21 僅 (a)/(c)；p.24 三個係數計算同屬可見的 (a)；p.33 使用 `print(i * j + k)`，例題 1.39 答案為 1540。
- Author Student Preview 依 `requiresV4Draft` 選擇 schema 2，使用完整 PracticeAnswer／CalculationAnswerV4。兩個緩衝保留，Answer Preview 只顯示 active buffer，計算題維持 local/manual semantics；沒有新增作答 persistence 或 provider 呼叫。
- Author grid 使用 `grid-template-columns: minmax(0, 1fr)`，避免較長 revision controls 在 360px 撐寬頁面。測試以限定 accessible queries 與獨立 preview roundtrip 消除重複詳解渲染，保留預設 5 秒與所有清除／無網路／無儲存斷言。
- 舊六份 Quiz、51 questions、51 canonical contexts 與 current `discrete-math/2` 均保留。功能沒有 migration、Auth／RLS／secrets／provider configuration 或 dependency delta。
- Generated canonical context 是 Edge-visible artifact；runtime import graph 確認僅 ai-tutor、ai-grade、ai-drawing、ai-responses、save-quiz-draft、submit-quiz 需要部署。Risk C／providerCanaryRequired=false；部署順序為 candidate CI → 六個 Edge → Pages → production smoke。
- Feature/fix CI [37753146630](https://github.com/LukeTsengTW/learnforge/actions/runs/37753146630)：93 files／1,433 PASS，零 skipped，全部 stages success。來源瀏覽器證據與 release candidate 邊界見 [delivery](docs/v1.7.0-delivery.md)。

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
