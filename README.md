# LearnForge

**v1.6.1 release preparation — 離散數學期中考計算題手寫。** `discrete-math/2` 是唯一 current revision：11 題／宣告 100 分，q2–q6 使用既有打字／手寫 selector 與 1200 × 900 DrawingCanvas；六題單選維持原樣。封存的 `discrete-math/1` 保留 text-only 歷史契約。Bundled inventory 為 6 revisions／4 current quizzes／51 questions，canonical contexts 為 51，原有 40 objects 完全保留。Production cutover、Edge／Pages／smoke 尚待精確 candidate gates 通過；實際 evidence 見 [v1.6.1 delivery](docs/v1.6.1-delivery.md)。下列 v1.6.0 與更早敘述保留為歷史 snapshots；canonical v1.6.0 已永久 closed 在 `9575a17f0541c85c46f81bd88820ff7f91c7964c`，immutable tag 保持不變。

**Production verified：v1.6.0 — Dark Mode。** Replacement Pages deployment 與 canonical／authenticated read-only smoke 已在 e3aaedb5badc34f9b64507ef5de5b06fa796c445 通過；此為 docs-only closure snapshot，final closure SHA／CI／Pages 身分由 post-commit verification report 記錄。Immutable v1.6.0 tag 尚未建立，需要另行授權。Light／Dark、偏好保存及完整 remediation history 見 [v1.6 交付文件](docs/v1.6-delivery.md)。

**Previous permanently closed release：v1.5.0。** Annotated v1.5.0 tag 的 canonical target 維持 e06b740be8cc33776757f16360d76c381ed56a19；此 release identity 永久保留，不把 v1.6 source 當成 v1.5 重新部署。v1.5 的期中考、declared totalPoints、KaTeX 修復與既有 backend rollout 維持。[v1.5 交付文件](docs/v1.5-delivery.md)、[v1.4](docs/v1.4-delivery.md)、[v1.3](docs/v1.3-delivery.md)、[v1.2](docs/v1.2-delivery.md)、[v1.2 設計文件](docs/v1.2-design.md)、[v1.1](docs/v1.1-delivery.md)及 [v1.0](docs/v1.0-delivery.md)保留作為歷史 snapshots。

v1.3 的多模態計算題契約維持：宣告手寫能力的精確題目版本可讓計算題選擇打字或手寫；正式提交依目前選取的模式評分，結果保存供日後重建。

v1.6.0 沿用既有固定 KaTeX 0.18.x 與最小 npm override；沒有 dependency maintenance。Dark Mode 使用共用 CSS semantic tokens 與 root data-theme；全域導覽的「深色模式」按鈕可用鍵盤操作，Light appearance 保留。

v1.0 加入單次帳號復原碼、修改密碼、練習衝突備份 UI、Auth／RLS 強化及發布驗證，沒有新增主要學習功能。請先閱讀 [SECURITY.md](SECURITY.md)、[隱私說明](docs/privacy.md) 與 [發布檢查表](docs/release-checklist.md)。

LearnForge 是學生自主練習平台，讓學生透過選擇、填空、推導與繪圖整理理解。題庫使用可版本管理的 Quiz Markdown；新提交以六種題型組成正式練習分數，歷史結果則依保存的 grading version 還原，不重新評分。v0.2 建立 Username + Password、Supabase 與帳號隔離的本機 cache；v0.3 加入多題庫、每份題目的多次提交、練習紀錄與錯題回顧；v0.4 加入受題目與作答狀態限制的 AI Tutor；v0.5 讓已完成的 AI 建議可在重新整理及歷史紀錄中恢復，並提供個人使用紀錄；v0.6–v0.7 的計算題與畫圖題 AI 功能原為 advisory；v0.8 增加本機題庫編寫工具；v0.9 加入學習分析與單題錯題複習。原有 parser、歷史 deterministic grading、drawing engine 與 Auth 架構保留。

## 功能

- 全域 Light／Dark 主題涵蓋頁面、卡片、控制項、結果狀態、code／KaTeX 與 Author。明確選擇保存於 learnforge:theme 並在 reload 保留；沒有有效偏好時依 prefers-color-scheme 初始化，不將系統預設寫成明確偏好。同步 head bootstrap 在 React 載入前套用主題。
- Production 有四份 current bundled 題庫、五個 revisions：原「數位邏輯與基礎數學」7 題、「布林代數基礎」7 題、「離散數學：關係」8 題、「2025 Discrete Mathematics 期中考」11 題（宣告總分 100 分，6 題單選、5 題計算）。期中考已隨 v1.5.0 上線，六個 Edge bundles 的 canonical contexts 已同步為 40。Library／Home 卡片顯示宣告 totalPoints；deterministic maxPoints 語意維持，Home featured 仍為 boolean-algebra。歷史發布證據維持原狀。
- `#/library` 支援標籤、科目、題型各一個單選篩選，預設為「所有標籤／所有科目／所有題型」。標籤與科目選項由 current catalog 動態產生並去重；題型沿用既有 `QUESTION_TYPE`／`QUESTION_LABEL` 的單選、多選、是非、填空、計算、畫圖六型。
- Library 搜尋只比對題庫 `title`、`description`、`subject`、`tags`，輸入會 trim，Latin 文字不區分大小寫。Canonical answers、solutions、rubrics、hints 不參與搜尋。
- 搜尋與所有有效篩選採 AND；題型條件只要題庫中任一題符合就成立。僅篩選 `quizCatalog.current`，保留原題庫順序，不加入 archived revisions。
- 篩選／搜尋無結果時顯示空狀態與「清除篩選」；重設會清空搜尋、恢復三個預設值及完整 current catalog，並將 focus 回到搜尋。桌面與 360 × 800 手機排版、鍵盤巡覽及可見 focus 已做 UI smoke；這不是 WCAG 認證。
- `#/author` 可編寫 raw Quiz Markdown、匯入本機檔案、複製 bundled revision、即時解析、正式題目／答案預覽、檢視 metadata 與題目導覽、建立新 revision、本機草稿、複製及下載 .quiz.md。編寫頁不建立正式作答，也不呼叫 AI 或寫入 Supabase。
- 原範例共 7 題：2 單選、1 多選、1 是非、1 填空、1 計算、1 畫圖。
- 目前 demo revision 為 `demo/v2-handwriting`，其計算題提供「打字／手寫」；封存的 `demo/v1-7d7c900e` 保留文字計算題及歷史結果。其他未宣告此能力的精確版本仍使用原有文字輸入。
- schema2 計算答案保留文字與筆畫兩個 buffer；只有選取的模式是正式評分輸入，未選取的內容不參與評分。
- 非 v4-capable 的 schema1 新提交使用 `ai-grading-v3`；schema2 提交使用 `ai-grading-v4`。六種題型均納入練習分數，計算與畫圖可取得 rubric 部分得分。歷史提交依保存的 grading version 還原，不偷偷改分。AI 自動評分僅供學習參考，可能存在誤判。
- Markdown、inline／block LaTeX、提示切換、完整解答與 rubric。
- Canvas 畫筆、橡皮擦、黑／紅／藍、筆寬、復原／重做、確認清除、PNG 匯出。
- 每個帳號及題庫最多一份未完成草稿；可提交多次，每次有獨立 UUID。提交後在 UI 與資料庫鎖定；再次練習建立新草稿，已提交紀錄不刪除。
- `#/history` 以每頁 20 筆載入提交紀錄；`#/mistakes` 依歷次答案、當時的題目版本與正式評分版本重建結果。v3/v4 的 incorrect 與 partial 題目（包括計算／畫圖）都可列入回顧。
- `#/analytics` 從最近最多 500 次正式提交推導整體、科目、主題標籤、客觀題題型與 UTC 週趨勢；整體得分率使用已保存的六型分數，客觀題正確率仍只使用 single、multiple、true-false、fill。顯示完成率、樣本數與無法解析的歷史筆數。
- `#/review` 按題庫與題目去重，只有最新可解析客觀題結果為答錯才列入佇列。單題複習使用當時的精確版本與正式題目／評分元件；檢查答案後才顯示解答，可重試，但不建立正式作答、不改寫歷史、不呼叫 AI。
- v3/v4 正式提交的 fill 空白為未作答、規則命中即全分、非空白規則不符時才由 AI 判語意。計算／畫圖的空白由 server 保存 unanswered evidence，不需要 provider；v4 手寫計算由 server rasterize 後沿用計算 rubric，與 DrawingQuestion 的畫圖評分不同。provider、raster 或 evidence 驗證失敗時 attempt 保持 draft，供之後重試。
- 註冊／登入／登出、session 恢復、自己的 profile、限流的密碼提示查詢。
- `#/account` 管理密碼與一次性復原碼；`#/recover-account` 使用 username + 復原碼重設密碼；`#/recovery` 檢視、匯出、保守還原或刪除本裝置的練習衝突備份。
- 未完成客觀題時先警告，再由使用者決定是否提交。
- HashRouter：公開 `#/`、`#/library`、`#/author` 及 Auth 頁；`#/quiz/:quizId`、`#/result/:attemptId`、`#/history`、`#/mistakes`、`#/analytics`、`#/review`、`#/ai-usage` 需要登入。舊 `#/result/:quizId` 連結導向該題庫最近一次已提交作答。
- 手機／平板／桌面排版、鍵盤可操作表單與畫布工具、文字狀態、可見 focus。
- AI Tutor：草稿可主動取得 AI 提示；提交後，答錯的客觀題可取得錯誤說明，非畫圖題可取得另一種解答說明。AI 僅供學習參考，以題庫答案與解析為主要依據。
- 舊版已提交 attempt 可保留 v0.6/v0.7 的 calculation grading 與 drawing analysis advisory controls；v3/v4 attempt 已在提交時完成正式 AI rubric grading，不顯示這些額外評分按鈕。
- 每位已登入使用者有 5 小時滾動 20 personal Tutor credits。提示與錯誤說明各 1 credit，解答說明 2 credits；舊版的 calculation/drawing advisory 分別按其歷史功能計費。v3/v4 正式 fill/calculation/drawing submission grading 使用 system grading ledger，不扣 personal credits。
- AI 自動評分是 learning reference，可能存在誤判。Result、History、Analytics 與 Mistakes 讀取 persisted grading evidence，不為重開頁面重新呼叫評分模型。
- `#/ai-usage` 顯示本人的額度、最近 5 小時各功能完成次數及每頁 20 筆的 AI 使用紀錄。額度用盡時依 server 時間顯示最早恢復一筆 credit 的相對時間。

## Tech stack

Vite 8、React 19、TypeScript 6、React Router、react-markdown、remark-math、rehype-katex、KaTeX、Vitest、Testing Library、jsdom、Oxlint／ESLint。v0.2 新增精確版本 `@supabase/supabase-js@2.117.1`，開發使用 `supabase@2.117.0`。一般分層 CSS，沒有 UI framework、Redux 或網路字型。確切版本請看 `package-lock.json`。

Markdown renderer 使用 `skipHtml`，不啟用 raw HTML；KaTeX `trust: false`。應用程式沒有 `dangerouslySetInnerHTML`。數學字型隨 build 一同輸出，不依賴 CDN。

## 安裝與執行

Required Node.js：**24.21.0**；npm：**11.19.0**。

Repository 提供 `.nvmrc` 與 `.node-version` 作為相同的精確版本來源；`package.json` 的 engines 與 CI 也固定此版本。使用支援 `.nvmrc` 的 nvm 時，可在專案根目錄執行：

```sh
nvm use
```

若使用 nvm-windows，請明確指定 `nvm use 24.21.0`，不假定它會自動讀取 `.nvmrc`。請先確認 `node --version` 為 `v24.21.0`、`npm --version` 為 `11.19.0`，再執行：

```sh
npm ci
# 將 .env.example 複製成 .env.local，填入自己的公開 client 設定
npm run dev
```

開啟終端機列出的本機 URL。初次沒有 lockfile 時才使用 `npm install`。

`.env.example` 列出 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 與 `VITE_TURNSTILE_SITE_KEY`。從 Supabase project 的 Connect／API Keys 取得 project URL 與 `sb_publishable_…` key，填入 `.env.local`。只有這三項公開 client 設定可進前端 bundle；不要填 server secret、service-role key、database password 或 Turnstile secret。`.env`、`.env.*` 均被 Git 忽略，只有 `.env.example` 例外。沒有 site key 時不顯示假的 CAPTCHA；公開發布前必須補齊真實設定。

AI Tutor、正式 submission grading 與歷史 AI advisory 都只在 Supabase Edge Function 的 server environment 讀取 `OPENAI_API_KEY`。請透過 Supabase Dashboard 的 Edge Function Secrets 安全設定；不要寫入 `.env.local`、Vite 變數、GitHub Actions 公開變數、資料庫或原始碼。缺少 secret 時安全回傳服務暫不可用；正式提交 grading 失敗時 attempt 保持 draft。模型固定 `gpt-6-luna`，使用 Responses API、Structured Outputs、`store=false`；Tutor 的 `reasoning.effort=low`，正式 grading 與歷史計算／畫圖分析使用 `reasoning.effort=medium`。畫圖 PNG 固定 `detail=high`，不啟用工具或一般聊天。正式 grading 不消耗 personal Tutor credits。

若 Windows 的 `npm.ps1` 出現 `Cannot find module ... npm-cli.js`，可改用同一套 Node.js 24.21.0 環境中的 `npm.cmd`，不必修改系統設定。

## 驗證指令

```sh
npm run lint
npm run test
npm run build
npm run preview
npm run generate:ai-context # 題庫 Markdown 更新後重新產生 server manifest
npm run check:ai-context    # CI/test/build 自動檢查 manifest drift
npm run check:quizzes       # 驗證所有 bundled revisions、catalog identity 與 current 唯一性
```

- `lint`：原有 Oxlint + ESLint，包含 TypeScript 與 React Hooks 檢查。
- `test`：Vitest 單次執行；`npm run test:watch` 啟動互動監看。
- `build`：`tsc -b` strict 型別檢查，再產生 production `dist/`。
- `check:quizzes`：直接重用正式 parser 與 catalog，檢查所有 bundled source；test/build 也會執行。
- `preview`：預覽已產生的 production build。

測試包括 parser 的正常／錯誤案例、六種題型的評分、座標轉換、筆畫歷史、儲存資料驗證、提交鎖定、重新開始、完整 UI 流程與 Markdown 安全設定；不以 snapshot 代替行為驗證。Canvas 真實繪圖、PNG 像素與 RWD 另外透過瀏覽器驗證，jsdom 測試不假裝驗證 raster rendering。

## Project structure / Architecture

```text
src/
  models/                   # 純 TS：Question union、Quiz、Attempt、Grade、Drawing、Analytics
  lib/
    quiz-parser.ts          # raw .quiz.md -> Quiz；QuizParseError
    grading.ts              # pure deterministic grading
    attempt.ts              # pure attempt reducer / lifecycle
    attempt-storage.ts      # versioned localStorage boundary / validation
    drawing.ts              # coordinates、history、replay、PNG utilities
    supabase.ts             # typed client、公開環境設定、要求 timeout
  content/quizzes/           # 每份 Quiz Markdown 的版本目錄；舊 demo id/revision 保留
  components/               # Markdown、Layout、Brand、error UI
  features/auth/            # Auth service / Provider、pure validation、route guard
  features/quiz/            # catalog、domain ↔ DB mapping、repositories、sync store、quiz UI
  features/ai/              # quota / Tutor service、狀態與操作 UI
  features/author/          # raw Markdown authoring、preview、draft、revision 模擬
  features/analytics/       # bounded cloud scan、純聚合與 latest-outcome review queue
  types/database.types.ts   # 從 linked project schema 產生，非手寫 row interfaces
  pages/                    # Home / Library / Quiz / Result / History / Mistakes / Analytics / Review / AI Usage / Auth
  styles/global.css         # base / layout / components / responsive layers
  App.tsx                   # HashRouter 與頁面組裝
  *.test.tsx, lib/*.test.ts # Vitest / Testing Library
.github/workflows/deploy.yml
docs/implementation-plan.md
docs/v0.1-delivery.md        # 歷史交付紀錄
docs/v0.2-delivery.md        # v0.2 歷史交付紀錄
docs/v0.3-delivery.md        # v0.3 實際驗證與限制
docs/v0.4-delivery.md        # v0.4 實際驗證與限制
docs/v0.5-delivery.md        # v0.5 恢復、使用紀錄與驗證
docs/v0.6-delivery.md        # v0.6 計算題 AI 參考評分與驗證
docs/v0.7-delivery.md        # v0.7 圖像題 AI 參考分析與驗證
docs/v0.8-delivery.md        # v0.8 題庫編寫工作區與驗證
docs/v0.9-delivery.md        # v0.9 學習分析、錯題複習與驗證
docs/v1.3-delivery.md        # v1.3 歷史多模態計算題與評分交付
docs/v1.4-delivery.md        # v1.4 題庫搜尋／篩選與 closure preparation snapshot
docs/v1.5-delivery.md        # v1.5 production verification、Edge dependency closure 與 closure preparation snapshot
scripts/generate-ai-quiz-context.mjs
scripts/ai-quiz-context.ts  # 使用既有 parser 的 manifest 投影與大小限制
supabase/
  config.toml
  migrations/               # 所有 schema / grants / RLS / RPC / triggers
  functions/password-hint/  # 既有公開密碼提示
  functions/ai-tutor/       # 已登入 Tutor request
  functions/ai-grade/       # 已登入、已提交計算題的 AI 參考評分
  functions/ai-drawing/     # 已登入、已提交畫圖題的 AI 圖像分析
  functions/ai-quota/       # 已登入 quota status
  functions/ai-responses/   # 已登入完成回覆恢復
  functions/ai-usage/       # 已登入個人用量與紀錄
  functions/save-quiz-draft/ # 已登入 schema2 草稿保存
  functions/submit-quiz/    # server-owned v3/v4 正式提交
  functions/_shared/        # 生成的 quiz context、AI 共用程式、純 TS drawing rasterizer
  tests/security.sql        # rollback transaction 的角色／RLS 整合檢查
```

資料流：

```text
quizzes/**/*.quiz.md -> parseQuiz() -> version-aware catalog / Quiz discriminated union
                                    |
                             React question renderer
                                    |
                            QuestionAnswer / QuizAttempt
                                    |
             schema1 draft sync / schema2 save-quiz-draft -> submit-quiz
                                    |
                  deterministic rules / persisted v3/v4 rubric judgments
                                    |
                     persisted judgments -> submitted Result
```

React component 不解析 raw DSL、不計算正確性。Parser 與 grading 不依賴 React。`Question` 使用六個明確分支，不以大量 optional properties 混用不同題型。`QuestionAnswer` 與 `QuestionGrade` 也是 discriminated unions；舊版 manual grade 的 score/maxScore 是 `null`，v3/v4 calculation/drawing 則保存正式分數與來源證據。

## 學習分析與錯題複習（v0.9）

Analytics 僅讀取登入者的 `status=submitted` attempts 與 answers。每批先讀 50 筆 attempts，再以 `attempt_id IN (...)` 批次查詢答案及 persisted fill/rubric judgments；最多掃描最近 500 次提交，超過時明示截斷。沒有完整雲端資料時顯示無法取得分析，不把本機 cache 當成全部歷史。每筆以 `quiz_id + quiz_revision` 尋找 bundled 題庫：`deterministic-v1` 依舊 deterministic 規則重建，`semantic-fill-v2` 使用持久化 fill judgment，`ai-grading-v3` 與 `ai-grading-v4` 使用相應 schema 的持久化 fill/rubric judgments；都不重新呼叫模型。缺少舊版本、判題證據或資料格式損壞者分別計數並排除，絕不改用目前題庫版本或推測 AI 結果。現有 `attempts_history_idx` 與 `answers(attempt_id,question_id)` 唯一索引支援查詢。

整體得分率以 persisted `score / maxScore` 聚合 v3/v4 六種題型；客觀題正確率仍只計單選、多選、是非、填空的「答對 ÷（答對＋答錯）」，未作答另計，完成率為「已作答 ÷ 全部客觀題」。計算題與畫圖題不會混入客觀題正確率。科目依題庫 `subject`；主題優先使用題目 `tags`，只有題目無 tag 時才用題庫 tags。同一題有多個 tag 時，每個 tag 各累積一次。標籤提示是透明產品規則：已作答少於 3 題次顯示「資料不足」，達 3 題次後正確率 ≥80% 為「表現穩定」、60–79% 為「持續練習」、低於 60% 為「需要複習」；它不是正式能力測量。趨勢以最近可分析提交為結尾，按 UTC 週一分組顯示 8 週，空週正確率為空值。

`#/mistakes` 保留每次歷史需要回顧的事件；v3/v4 incorrect 與 partial 都包含 calculation/drawing persisted evidence。`#/review` 仍只處理 deterministic 可檢查的客觀題，以 `quizId + questionId` 為概念鍵，最新答錯才列入，最新答對或未作答便不列入。歷史正式結果依評分版本與持久化判題重建，不重新呼叫模型。項目保留該次 `quizRevision`，題庫已更新時顯示舊／新版資訊；單題複習仍使用舊版精確題目，完整題庫連結使用目前版本。複習答案只存在 React 記憶體，按「檢查答案」才使用純 deterministic grader 顯示答案／解法；「再試一次」會清除答案和解法。複習完成不寫 Supabase、PracticeAttempt、History 或 AI ledger；要永久移出佇列，必須正式重新提交並答對。聚合只在本人的瀏覽器計算，不把學生答案或完整分析資料送往 OpenAI 或額外第三方。

## Supabase 與 Auth 架構

### v1.3 draft persistence 與 formal submission grading

v4 capability 由載入的 **精確 quiz revision** 是否有宣告 drawing 設定的 calculation 決定，不用最新版本替代。開啟題庫時 `get_or_create_quiz_draft` 可以仍回傳 server schema1；client 只在記憶體升級。第一次實際答案變更才透過 authenticated `save-quiz-draft` 保存 schema2。平台 `verify_jwt=true`，handler 另外驗證 user context、owner、revision、V4 answer shape 與 CAS，再呼叫 service-only `save_quiz_attempt_v4`。Browser 不直接呼叫該 RPC；成功回應須為 `answerSchemaVersion=2`，失敗不降級至 v3 writer。

Browser formal submission 只提供 `requestId`、`attemptId` 和 `expectedUpdatedAt`；不傳 grading version、題目、rubric、模型、prompt、hash 或分數。`submit-quiz` 驗證 session，從本人 draft/answers 與 exact revision manifest 取得 canonical data。非 v4-capable 的 schema1 新提交使用 `ai-grading-v3`，schema2 使用 `ai-grading-v4`；歷史結果保留原版本。

v4 文字計算只評 active text；手寫計算由 server 驗證 active strokes、重建 raster，仍走 **calculation rubric**，不是 generic drawing analysis。DrawingQuestion 保持自己的畫圖評分路徑。Inactive buffer 保留，但不進 authoritative answer identity 或 grading input。fill 先處理 blank/rule match；計算／畫圖空白保存 system unanswered evidence，無須 provider。Canonical criterion IDs、每項上限、得分與總分驗證通過後才原子 finalize；provider/raster/evidence 失敗時保留 draft。

正式 grading 固定 `gpt-6-luna`、`reasoning.effort=medium`、`store=false`，使用 private system ledger，不扣 personal Tutor credits。Result/History/Analytics/Mistakes 只重建 persisted evidence，不為重開頁面重跑 AI；submitted schema1/schema2 紀錄與判題證據不可改寫。AI 自動評分僅供學習參考，可能存在誤判。

### 歷史 AI Tutor、恢復、計算題與圖像參考分析及個人額度（v0.4–v1.1）

Browser 只送 `requestId`、`feature`、`attemptId`、`questionId`。Edge Function 用 `@supabase/server` 的 `auth: 'user'` 驗證身份，以 RLS-scoped client 讀取本人作答，再用 `quiz_id + quiz_revision + question_id` 精確查找生成的 canonical manifest。題庫仍只在 Git Markdown，沒有搬進 Supabase；題目與標準答案不能由 request 決定。生成器設有每題 32 KiB 上限及個別欄位限制，測試與 build 都會拒絕 stale manifest。

OpenAI 回應使用嚴格 JSON schema，文字透過既有安全 Markdown/KaTeX 元件顯示。草稿提示不傳標準答案或完整解答；提交後錯誤說明只對已判錯的客觀題開放，解答說明支援客觀題與計算題。畫圖題只在已提交且符合歷史 advisory 條件時送出由 server 重建的單題圖像與 context。學生答案及圖中的文字視為不可信資料。Tutor 與 v0.4–v1.1 的 calculation/drawing advisory 不改寫正式成績；v1.1 的 fill judge 與 v1.2/v1.3 的六型 submission grading 則屬於正式提交流程。

`ai_requests` 啟用 RLS 且不授權 browser role。Edge 以 server privileged RPC 查額度、保留、完成與退還；`reserve_ai_request` 在 per-user transaction advisory lock 內計算最近 5 小時已完成與有效保留 credits，防止同時呼叫超額。保留 15 分鐘後可自動失效；同一 `requestId` 完成後重試回傳已保存結果，不再次呼叫 OpenAI。安全拒答已消耗 provider usage，記為完成；失敗、格式錯誤或未完成輸出會退還。Rolling 額度回傳 DB `serverNow` 與 `nextCreditAt`；只在用盡時顯示最早恢復一筆 credit 的相對時間，不宣稱有固定整批 reset 時間。

v0.5 的 `ai-responses` 以 `withSupabase({ auth: 'user' })` 驗證 session，先透過 RLS client 確認 attempt 屬於本人，再以僅授權 service role 的 RPC 讀取 `ai_requests`。完成回覆依 `(user_id, attempt_id, question_id, feature)` 隔離，按 `completed_at DESC, created_at DESC, id DESC` 選最新；有效 reservation 只投影為處理中，不回傳虛構內容。Browser 只收到題目、功能、經驗證的回覆與完成時間，不收到 token、provider ID 或 ledger metadata。Quiz 草稿和已提交 Result 載入時只呼叫讀取 API；從 History 重開也不再扣點。已存在回覆可手動重新產生；只有這個明確操作才產生新 UUID。網路逾時後首次重試保留原 requestId，讓 server 回放既有結果或回報仍在處理。

v0.6 的 `ai-grade` 只接受 `{requestId,feature,attemptId,questionId}`，要求 JWT 使用者擁有已提交的 attempt、該題確為此作答版本的計算題、已保存非空白且不超過 8192 UTF-8 bytes 的答案，以及各項分數為正且總和等於題目分數的 scored rubric。題目、標準答案、解法、評分規準與上限分數只取自 server 生成的版本化 manifest；browser 不能提供它們，也不能指定模型或扣點。學生答案在提示詞中明確視為不可信資料。模型可以認可等價解法與部分正確步驟，但嚴格 JSON schema 回覆仍須通過 server 對 criterion ID、每項上限、狀態、分數界線及總分的驗證；格式錯誤或 provider 失敗會退還 reservation。安全拒答不顯示分數。此結果只存於私有 AI ledger，不更新作答或客觀題正式分數。

計算題評分使用 `gpt-6-luna`、`reasoning.effort=medium`、`store=false`，固定扣 2 credits。`ai-responses` 以同一版本化 manifest 驗證並恢復最新已完成的評分；重開 Result／History 不扣點，明確按「重新評分」才產生新的 requestId。`ai-quota` 與 `ai-usage` 包含 `calculation_grading` 的成本及次數。所有 user-facing AI 函式在平台設定 `verify_jwt=false`，由 handler 的 `withSupabase({ auth: 'user' })` 驗證 JWT；`password-hint` 沒有修改。

v0.7 的 `ai-drawing` 只接受 `{requestId,feature,attemptId,questionId}`，先驗證 JWT、attempt ownership／submitted 狀態、版本化 drawing 題、已保存的 canonical strokes 及 scored rubric，再由 Edge 純 TypeScript rasterizer 按原畫布座標、顏色、筆寬與擦除語意重建不透明白底 PNG。空白、全擦除、過大或格式不符的圖像在扣點前拒絕；browser 圖片、base64、截圖、筆畫、題目及 prompt 欄位均被拒絕。圖像僅在記憶體中傳給 Responses API，固定 `gpt-6-luna`、`detail=high`、`reasoning.effort=medium`、`store=false`，每次 4 credits。模型依可見的語意與連接關係給逐項建議；server 嚴格驗證 criterion ID、上限、狀態、得分與總分。安全拒答不顯示 0 分，失敗回退 credits。完成結果由私有 ledger 恢復，明確「重新分析」才新建請求；正式 deterministic score 與已提交筆畫保持原狀。畫圖影像會計入 provider 回報的 input tokens；不自行估算美元成本。

`ai-usage` 同樣只用 JWT 身份查本人資料。Server RPC 提供最近 5 小時、24 小時及全期的 request/status/feature 計數與 token 合計；`NULL` token 欄位視為「provider 未回報」，加總時按 0 處理，另有 `usageReportedCount` 指出有 usage 欄位的筆數。學生畫面只顯示額度與各功能次數，不顯示 token 或美元成本。紀錄以 `(created_at DESC, id DESC)` 游標分頁，每頁 20 筆；題庫標題由 bundled revision 解析，舊 revision 不在 bundle 時退回 quiz id 和 question id。RPC 僅授權 service role，browser 無法直接 SELECT ledger；Edge 解析 attempt metadata 時使用 RLS client。

保留政策：`completed` AI 回覆保留，以便日後恢復；`refunded`、`expired` 暫時保留供稽核，未來若要清理，只考慮超過 30 天的這兩種狀態。v0.5 沒有排程刪除。Ledger 不新增 raw prompt、完整學生答案或 canonical full prompt；AI 回覆只對本人可讀。短期畫面 state 之外沒有把 AI ledger 鏡像到 localStorage。

套用新 migration 前先比對 linked migration list，執行 `npx supabase db push --linked --dry-run --skip-vault`，確認清單只有預期檔案後才使用 `npx supabase db push --linked --skip-vault --yes`。v0.7 當時有圖像分析與原始 credits 範圍修正兩筆 migration。Public schema／RPC signature 變更後重新執行 `npx supabase gen types typescript --linked --schema public` 更新 generated DB types。`ai-tutor`、`ai-grade`、`ai-drawing`、`ai-quota`、`ai-responses`、`ai-usage` 均使用 platform `verify_jwt=false` 與 handler `withSupabase({ auth: 'user' })`；部署時需 `--no-verify-jwt`。`password-hint` 的既有設定維持不變。

`AuthProvider` 管理 session、loading、失敗狀態與帳號；頁面只呼叫 `AuthService`。Supabase SDK 持久化並自動更新 session；恢復時依序驗證 `getUser()`、server `auth.sessions` 綁定與自己的 profile。過期或撤銷的 session 不視為已登入；網路失敗時要求恢復連線，本機答案不刪除。已載入的草稿仍可暫存離線輸入，但重新載入不能離線繞過驗證。要求有 15 秒 timeout。

畫面只有 Username／Password，不顯示 Email 欄位。`normalizeUsername()` trim + lowercase；`validateUsername()` 使用 `^[a-z0-9_]{3,24}$`；`usernameToSyntheticEmail()` 得到 `<username>@users.learnforge.invalid`。例如 ` LuKe_123 ` → `luke_123` → `luke_123@users.learnforge.invalid`。這是 Auth 的內部識別，不是可收信地址。

註冊先驗證名稱、至少 8 字元密碼、確認密碼、1–200 字元提示，再將密碼直接交給 Supabase Auth。密碼不放進 metadata、application tables、logs 或 localStorage。`auth.users` INSERT trigger 以 `NEW.id` 原子建立 profile 與 hint，檢查 normalized username、synthetic email 一致性，不接受使用者指定另一個 UUID。Trigger 使用固定空 `search_path`、完整限定名稱、撤銷 PUBLIC execute。

**專案需啟用 Email provider／signup，關閉 Confirm email**，否則 synthetic email 無法收確認信，也無法立即建立 session。linked demo 已確認 `mailer_autoconfirm=true`。v1.0 已把遠端 minimum password length 從 6 提高為 8，並啟用 Require current password when updating；前端新密碼為至少 8 字元、至多 72 UTF-8 bytes。沒有 email reset 或帳號改名；密碼重設使用 Recovery Code。

公開首頁與 `#/library`；保護 Quiz、Result、History、Mistakes，未登入會導向 `#/login` 並保存原目的地。只允許 app 內受保護路徑作 redirect，避免外站跳轉或登入迴圈。header 顯示 normalized username／登出；logout 清除本機 session，保留該帳號的作答 cache，其他帳號不會自動套用。

### Account Recovery 與 CAPTCHA（v1.0）

Recovery Code 使用 Web Crypto 128-bit 隨機值，以八組四位十六進位字元呈現。DB 只保存 SHA-256 digest。註冊成功會產生一組，只顯示一次；必須勾選「我已保存復原碼」再繼續。Copy／Download 由使用者主動按下，不自動下載，也不放入 localStorage。既有帳號可在 Account 產生或更換；更換立即撤銷舊碼。遺失密碼且沒有可用復原碼時，沒有自行恢復的途徑。

`account-recovery-code` 使用 `withSupabase({ auth: 'user' })`，再綁定 user ID 與 JWT session ID。公開 `recover-account` 只接受 username、code、新密碼及 CAPTCHA token；失敗採 generic message，成功不建立 session，要求正常登入並產生新碼。private recovery table、rate-limit table 和管理 RPC 均不授權 browser roles。

Claim RPC 與 Auth Admin 請求是兩個交易。`active → claiming → used` 以 5 分鐘 TTL、鎖定與安全 release 處理失敗；Auth 交易的 deferred trigger 驗證最終密碼更新與 claim，原子完成 consume、移除暫存 marker、刪除舊 sessions。過期、撤銷或延遲重播會讓密碼交易 rollback。完整一致性模型及對 Supabase Auth SQL transaction 的依賴見交付報告。

復原限流集中於資料庫：每 30 分鐘 username 5、IP hash 20、global 200；超額回 429 與 Retry-After: 1800。密碼提示只是記憶輔助，不能重設密碼。帳號頁修改密碼必須先重新驗證目前密碼，並把 `current_password` 交给 Auth server。

Production frontend 已包含真實 Turnstile site configuration；v1.3 release evidence 已透過實際 public signup flow 建立測試帳號，沒有 bypass。Signup／login 將 CAPTCHA token 交給原生 Auth；Recovery server 驗證 Siteverify success、`action=recovery` 與 hostname，缺 secret 預設 fail closed。v1.0 Final Gate 記錄過缺少／無效 token 拒絕及 development bypass 移除；本輪文件 closure 僅確認公開 bundle 的設定與既有 v1.3 signup 證據，未重新讀取 server CAPTCHA／bypass 設定或重跑 negative-token/recovery 測試，不宣稱新的全面 enforcement 驗證。詳見 [Security](SECURITY.md) 與 [v1.3 交付文件](docs/v1.3-delivery.md)。

目前 accepted security advisor baseline 保留 leaked-password protection warning；本輪不調整 Auth 或方案。v1.0 交付文件中的 Free plan 說明是當時的紀錄，不把未重新核實的方案能力當成新的保證。

### Schema / RLS / grants

| Table | 內容與約束 | Client grant 與 RLS |
|---|---|---|
| `profiles` | PK `id` → `auth.users` cascade；唯一且格式受限的 username；timestamps | authenticated 只 SELECT 自己；無 client 寫入 |
| `password_hints` | PK `user_id` → `auth.users` cascade；trim 後 1–200 字元；timestamps | anon／authenticated 全部撤權；無一般讀取 policy |
| `attempts` | UUID、user、quiz／revision、draft/submitted、時間、answer_schema_version 1/2、分數 cache；只有 draft 有 `(user_id,quiz_id)` 部分唯一索引；提交紀錄有排序索引 | authenticated 可 SELECT 本人紀錄；schema1 草稿走既有受控流程，schema2 寫入限 server v4 邊界；已提交紀錄不得修改或刪除 |
| `answers` | UUID、JSONB answer／可選 grade；唯一 `(attempt_id,question_id)`；複合 FK `(attempt_id,user_id)`；user index | 自己 + parent attempt 也是自己；schema2 由 v4 writer 寫入；提交後不得改／刪答案；restart 刪 parent 才 cascade |
| `private.hint_rate_limits` | durable fixed-window counters | 非 API schema；RLS；僅 service_role server 存取 |

所有表啟用 RLS；user-owned policy 明確檢查 `(select auth.uid()) IS NOT NULL`。anon 沒有 application table 權限。v0.3 的 `get_or_create_quiz_draft` 與 `save_quiz_attempt_v3` 僅授權 authenticated，皆為 **security invoker**；前者以 transaction advisory lock 和部分唯一索引保證同題庫只有一份草稿，後者依 attempt UUID、owner 與 server `updated_at` 做 CAS，原子更新 header 與 answers。舊 `save_quiz_attempt` 的 authenticated EXECUTE 已撤銷。提交鎖定 trigger 與 answer parent row lock 防止並行變更穿過提交界線。schema2 的 `save_quiz_attempt_v4` 只授權 service_role；browser 不能直接 promote 或 finalize。歷史 deterministic 結果按原版本解讀；v3/v4 正式分數及 judgments 由 server 原子保存，讀取時不回溯改分，仍不能當防作弊考試或可信成績認證。

### 密碼提示 Edge Function

`#/forgot-password` 明示「提示不能重設密碼」，並連到帳號復原碼頁。提示可由知道 username 的人查詢，請勿放密碼或敏感個資。

只接受 `POST {"username":"..."}`，拒絕批次／多欄位／超過 1 KiB 的 request。`verify_jwt=false` 讓遺失密碼的人能使用；Edge runtime 使用內建 server credential 呼叫僅 service_role 可執行的 `request_password_hint` RPC。前端無法直接讀 hints，也無法呼叫該 privileged RPC。

資料庫原子計數，每 15 分鐘最多 **同 username 3 次、IP hash 10 次、全域 100 次**。全域上限仍限制變造 forwarded IP 的請求；超額 HTTP 429 + Retry-After: 900。回傳只投影 `{hint: string|null}`；查無使用者是 `{hint:null}`。不回 email、UUID、profile 或 DB error。回應 no-store；錯誤用固定訊息。這是 demo 基本防濫用，沒有 CAPTCHA／分散式攻擊防護；名稱是否存在仍可由單次結果推測，全域 quota 也可能被耗盡。

### Link、migration 與 generated types

```sh
npx supabase login
npx supabase link --project-ref <你的專案-ref>
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
# 檢查只包含預期的 additive migrations，再套用
npx supabase db push --linked --skip-vault
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
npx supabase functions deploy password-hint --use-api
npx supabase functions deploy account-recovery-code --use-api --no-verify-jwt
npx supabase functions deploy recover-account --use-api --no-verify-jwt
npx supabase db query --linked --file supabase/tests/security.sql
npx supabase db advisors --linked --type security --fail-on error
```

PowerShell 請用 `npx.cmd`；generated types 可透過 `| Out-File -Encoding utf8 src/types/database.types.ts` 保存。CLI credential／database password 只供 CLI 安全輸入，不能放進 Vite。`.temp` 連結資訊不進 Git。需要完整本機 Supabase 時，可使用已安裝 Docker 的環境執行 `npx supabase start`；Production backend 是 `learnforge-demo`；此處 CLI 指令是管理流程說明，不授權執行 migration/deploy。沒有宣稱驗證 Docker stack。

Migration：`20260925031723_v02_foundation.sql` 建 schema；`20260925033026_v02_owner_binding.sql` 補帳號綁定；`20260925054652_v03_practice_history.sql` 加入多次練習與歷史；`20260925060343_v03_answer_lock_visibility.sql` 補提交後鎖定可見性；`20260925074745_v04_ai_tutor_quota.sql` 加入 AI ledger 和 quota RPC；`20260925102541_v05_ai_experience.sql` 加入恢復／用量索引、RPC 和 server 時間；`20260925104314_v05_ai_usage_metadata_boundary.sql` 讓 attempt metadata 只由 Edge 的 user-scoped RLS client 解析。舊 attempts、answers、UUID 與 Auth users 原地保留。新增變更先 `npx supabase migration new <name>`；不要對 linked project 執行 reset、truncate、migration repair 或刪除 Auth users。`security.sql` 建立測試 fixture 後完整 rollback。

## 題庫編寫工作區（v0.8）

`#/author` 是公開的本機編寫工具，並非管理後台。它直接編輯 `.quiz.md` 文字，使用正式 `parseQuiz()` 做 300 ms debounced validation；parser 採 fail-fast，每次顯示第一個阻塞錯誤。合法題目使用正式的 Question、Markdown／KaTeX、Canvas 與答案渲染元件預覽；預覽作答只在 React 記憶體中，可切換 Student／Answer Preview 或單獨重設。編寫頁不建立 attempt、不寫 practice cache／Supabase、不呼叫 AI、不扣 credits。直接進入 `#/author` 不需要初始化 Supabase client。

可建立已可解析的範例題庫，插入六種題型 DSL 範本（計算與畫圖範本含 scored rubric），從本機匯入單一 UTF-8 `.quiz.md`／`.md`／`.txt`，或複製 bundled revision 的 raw source。source、匯入檔案和單份本機草稿各限 1 MiB。草稿使用獨立的 `learnforge:author:` localStorage key，只有按「儲存本機草稿」才保存，亦可載入或清除；不自動同步。下載保留原始 source 文字，只清理下載檔名；複製使用 Clipboard API 並在失敗時嘗試選取編輯器文字。Import／New／Load bundled／Load draft 會在未匯出修改前要求確認。

Validation 將阻塞 parser error 與非阻塞內容提醒分開。Metadata inspector 顯示 canonical Quiz 的 id、revision、current、題型分布、宣告分數、自動評分最高分與手動分數。計算／畫圖的「AI capability」使用正式 scored rubric 判斷邏輯，僅提示能否於正式作答後使用相關功能，不送出 AI request，也不判斷學術內容是否正確。選擇 bundled source 只複製至編輯器；建立新 revision 要手動輸入不同的 revision，不自行產生 hash。工具純函式會模擬舊 current 改 false、新 current 改 true，檢查 id、revision 與 catalog 唯一性；原 source 檔永遠不會由瀏覽器改寫。

建議出版流程：

1. 開啟 `#/author`。
2. 選擇建立新題庫、匯入本機檔案，或載入 bundled revision。
3. 直接修改 Quiz Markdown DSL，必要時插入題型範本。
4. 修正 validation 的阻塞錯誤，逐項檢查非阻塞提醒。
5. 切換學生／答案預覽，確認題目、公式、解答、rubric 與 Canvas。
6. 下載 `.quiz.md`，保留該檔案的原始文字。
7. 將新 revision 放入建議的 `src/content/quizzes/<quiz-id>/` 路徑。
8. 將舊 revision 的 `current` 改為 `false`。
9. 確認新 revision 的 `current="true"`；保留舊 revision 檔供歷史作答使用。
10. 執行 `npm run check:quizzes`、`npm run lint`、`npm run test`、`npm run build`、`npm run check:ai-context`；題目有變更時依原流程更新 AI context manifest。
11. 審閱差異後透過 Git commit／push 與既有部署流程發布。

瀏覽器本身不執行第 7–11 步，不會修改 Git、bundled 題庫或 Supabase 題庫，也沒有 CMS／server-side 發布能力。

## Quiz Markdown DSL specification (v1)

副檔名為 `.quiz.md`。使用 UTF-8；接受 LF／CRLF 及 UTF-8 BOM。第一個非空白行為 metadata，接著為一級標題與可選的 Markdown 描述：

```markdown
@quiz id="demo"
# 數位邏輯與基礎數學

這裡是測驗描述，可用 **Markdown** 與 $x^2$。
```

v0.1/v0.2 的 `@quiz id="..."` 格式仍可由 parser 讀取；bundled catalog 在 v0.3 額外要求明確 metadata：

```markdown
@quiz id="demo" revision="v1-7d7c900e" subject="數位邏輯與基礎數學" tags="logic-gates,algebra" estimatedMinutes="20" current="true"
# 數位邏輯與基礎數學

從邏輯閘到方程式的練習。
```

`id` 是穩定題庫識別，`revision` 是內容版本；修改題目或正解時須建立新 revision 並保留舊檔。`subject`、描述與標題需非空，`estimatedMinutes` 是正整數。逗號分隔的 quiz/question `tags` 會 trim、正規化並去重；題目可寫 `:::question id="q1" type="single" points="2" tags="logic-gates,nand"`。每個 quiz id 只能有一個 `current="true"` revision；歷史結果以 id + revision 精確解析，舊版不重複出現在題庫清單。缺少歷史檔時只顯示紀錄與快取分數，不猜測題目或正解。

### 題目邊界與屬性

```markdown
:::question id="q1" type="single" points="2"
這裡是題目 Markdown。
:::options
- [ ] a | 第一個選項
- [x] b | 正確選項
:::hint
提示 Markdown。
:::solution
完整解答 Markdown。
:::end
```

- 所有 directive 必須從**行首**開始、單獨一行；不可在尾端加空白或註解（question 屬性之間允許空白）。
- 每題用 `:::question ...` 開始、`:::end` 結束；區塊切換即結束上一區塊，不使用巢狀 `:::` 關閉語法。
- `id`、`type`、`points` 必填；fill 額外必填 `match`。屬性一律 `key="value"`，不支援引號跳脫、單引號或未引號值。
- Quiz／question／option id 格式：`[a-zA-Z0-9][a-zA-Z0-9_-]*`；禁止 `constructor`、`prototype` 與 `__proto__`。題號在該 quiz 內唯一，選項 id 在該題內唯一。
- `points` 為大於 0 的有限十進位數字，可有小數；不接受負數、指數表示法、NaN、Infinity。
- 題幹位於 question 起始後、第一個 section 之前，不可空白。每題都必須有非空白 `:::solution`。
- section 可調換順序但不得重複。`:::hint` 可選；`:::rubric` 可選。
- `:::options` 僅用於 single／multiple；`:::answer` 用於其餘題型；`:::drawing` 用於 drawing（必填），亦可用於 calculation（可選，用於啟用手寫）。
- 題目之間只能有空白行。未知屬性、未知區塊、題型不適用的區塊與缺少結尾均報錯，不默默忽略。
- 正常 Markdown 支援標題、段落、列表、引用、連結、程式碼及數學。Markdown code fence（至少 3 個反引號或波浪號）中的 directive 會保留為文字；未關閉的 fence 報錯。要在 prose 中展示 directive，請放入 code fence。

### 六種題型

| `type` | 額外內容 | 正確性／參考答案 |
| --- | --- | --- |
| `single` | `:::options`，至少 2 個選項 | 恰好 1 個 `[x]` |
| `multiple` | `:::options`，至少 2 個選項 | 至少 1 個 `[x]` |
| `true-false` | `:::answer` | 必須為小寫 `true` 或 `false` |
| `fill` | `match="exact"` 或 `match="case-insensitive"`、`:::answer` | 一行非空白答案 |
| `calculation` | `:::answer`；可選 `:::drawing` 啟用手寫 | Markdown 參考答案；正式評分依 submission version |
| `drawing` | `:::answer`、`:::drawing` | Markdown 文字參考；正式評分依 submission version |

### 選項

選項第一行必須使用 `- [ ] id | Markdown` 或 `- [x] id | Markdown`（也接受 `[X]`）。管線與 id 間需有空格。選項 id 不影響排序，按檔案順序顯示。續行縮排兩個空格；parser 移除這兩個空格，保留其餘 Markdown。選項之間的空行允許存在。例：

```markdown
:::options
- [ ] a | $A + B$
- [x] b | **AND**：$AB$

  這是同一選項的下一個段落。
```

### 填空與比對

```markdown
:::question id="gate" type="fill" points="2" match="case-insensitive"
互斥或的英文縮寫？
:::answer
XOR
:::solution
**XOR** 是 Exclusive OR。
:::end
```

- `exact`：輸入與 canonical answer 完全相同，大小寫、內外空格都有差別。
- `case-insensitive`：只使用 `toLowerCase()` 忽略大小寫，不移除學生答案的空格、不做 Unicode 正規化。
- DSL 區塊外圍空白會被 trim；學生作答不被偷偷改寫。只含空白的輸入視為未作答。
- 使用者應輸入答案文字；若 `:::answer` 使用 Markdown 標記，標記也屬於要精確比對的字串。一般填空答案建議純文字，公式解釋放在 solution。
- 比對策略集中於 `fillMatchers`，可在後續明確擴充 regex／numeric tolerance；v0.1 不接受這些策略。

### 計算、畫圖、rubric

```markdown
:::question id="derive" type="calculation" points="4"
解出 $x^2-5x+6=0$，寫出推導。
:::answer
$x=2$ 或 $x=3$。
:::solution
因式分解得到 $(x-2)(x-3)=0$。
:::rubric
- 2 | 正確因式分解。
- 2 | 寫出兩個根。
:::end

:::question id="draw" type="drawing" points="2"
畫出 AND Gate 與 A、B、Y 標示。
:::drawing
width=800
height=600
:::answer
左側兩條輸入、D 形閘體、右側一條輸出；$Y=AB$。
:::solution
確認標示與輸入輸出方向正確，且輸出沒有反相小圓圈。
:::rubric
- 1 | 閘體正確。
- 1 | 三個端點標示正確。
:::end
```

- `:::drawing` 可用於 drawing 題，亦可由 calculation 題選擇宣告以啟用打字＋手寫；DrawingQuestion 必須有設定，歷史文字 calculation 不需要。
- Parser 的歷史相容範圍仍為 width/height 各 **100–2000** 的整數，且只能各出現一次；不接受未知 key、小數或缺值。
- v4 publication 另外要求 drawing dimensions 在 **100–1200** 的安全範圍，並驗證 formal scored rubric。這是 v4 發布／server raster 能力要求，不是把所有歷史 parser 上限改成 1200。
- rubric 每行為 `- 數字 | Markdown 說明`，或 `- | Markdown 說明`。說明為單行，支援 inline Markdown／LaTeX。
- rubric 必須全部有分數或全部無分數。有分數時每項須非負，總和需等於題目 points（容許浮點誤差 `1e-8`）；不能只評部分分數。rubric 可用於任何題型。

### 數學與錯誤

Inline：`$E = mc^2$`。Block：`$$x^2 - 5x + 6 = 0$$`，也支援分行：

```markdown
$$
x^2 - 5x + 6 = 0
$$
```

`QuizParseError` 包含行號、可辨識時的 question id 與原因。例如：`第 18 行（題目 q2）：單選題必須恰好有一個正確答案。`

UI 會顯示「題目格式錯誤，無法載入。」；開發模式顯示簡潔的 parser 原因，production 不顯示詳細錯誤或 stack trace。Parser 驗證 DSL 結構，不驗證題目內容的學術正確性或所有 LaTeX 語法。

## 完整 example quiz

直接閱讀 [目前 demo/v2-handwriting](src/content/quizzes/demo/v2.quiz.md)、[封存 demo/v1-7d7c900e](src/content/quizzes/demo/v1.quiz.md)、[布林代數](src/content/quizzes/boolean-algebra/v1.quiz.md)、[離散數學：關係](src/content/quizzes/relations/v1.quiz.md) 與[2025 離散數學期中考](src/content/quizzes/discrete-math/v1.quiz.md)。`quiz-loader.ts` 使用 typed `import.meta.glob` 匯入所有 `src/content/quizzes/**/*.quiz.md`，建立版本感知的 catalog；解析失敗附檔名／行號，其他有效題庫仍可使用。重複 id+revision 或多個 current 等識別歧義會在測試與載入時明確報錯。題目不放進 Supabase。

## Grading 規則

- `gradeSingleChoice()`：唯一 option id 完全相同才得全分。
- `gradeMultipleChoice()`：去重為集合後，元素與正確答案集合必須完全相同。少選、多選都是 0 分，無部分給分。
- `gradeTrueFalse()`：boolean 嚴格相等；`false` 是有效作答。
- `gradeFillBlank()`：純確定性函式，依 `exact`／`case-insensitive` 策略評分，空白答案視為未作答；函式本身不呼叫 AI。
- `gradeQuiz()`：供舊 `deterministic-v1` 提交依原規則重建，回傳每題狀態及 score/maxScore/correctCount/incorrectCount/unansweredCount/manualCount。
- 歷史 `semantic-fill-v2` 提交使用原有確定性規則處理填空；非空白且規則未命中才由 server-side AI 語意判題。正確得該題全分，錯誤得零分；provider 或驗證失敗時不完成提交，保留草稿與答案供重試。
- `gradeQuizWithFillJudgments()` 用已保存的 fill judgment 還原 semantic-fill-v2；v3/v4 結果則使用 persisted fill/rubric evidence。Result、History、Analytics、Mistakes、Review 載入歷史時只讀判題紀錄，不重新呼叫 OpenAI；舊 attempt 不回溯改分。
- 客觀題狀態互斥：correct／incorrect／unanswered，未作答得 0 分。
- 在歷史 `deterministic-v1` 與 `semantic-fill-v2` 中，計算與畫圖仍按原 manual representation 排除於當時的 score/maxScore；v3/v4 則對 calculation/drawing 建立正式 persisted rubric grade，並納入六型 practice score。

## Canvas 設計

每題定義固定 logical resolution（demo 為 800 × 600），直接設定 Canvas `width`／`height`。CSS 只調整顯示寬度且保持長寬比；繪圖前用 `(clientX - rect.left) * logicalWidth / rect.width` 換算座標，Y 軸同理並 clamp 範圍，邊框位於外層元素，不干擾座標。

Pointer Events + pointer capture 支援滑鼠、手指與觸控筆；`touch-action: none` 僅限畫布。每筆存 `tool/color/width/points`；筆寬也是 logical units。重繪與螢幕尺寸無關，橡皮擦使用 `destination-out`。復原／重做操作 stroke history，新筆畫清除 redo；清除需確認，清除後不可復原。只持久化已完成的 strokes，進行中的 pointer 與 undo/redo 不存入 localStorage。

`exportDrawingPng()` 以 logical resolution 重播至離屏 Canvas、補上不透明白底並回傳 PNG Blob；`downloadDrawingPng()` 本機下載，不上傳。結果畫布是唯讀。純工具測試座標／history，實際 Canvas 與 PNG 在瀏覽器驗證。

## Attempt repository 與 local/cloud synchronization

Domain `PracticeAttempt` 同時包含歷史 schemaVersion 1 的 `QuizAttempt` 與 schemaVersion 2 的 `QuizAttemptV4`；後者涵蓋 `QuizDraftV4` 與 `SubmittedQuizAttemptV4`，保留 exact quiz id/revision、時間、答案及結果的版本邊界。schema2 calculation 保存 `type/mode/text/strokes`，只把 active buffer 投影為 grading identity。`PracticeRecord` 另綁 attempt UUID 與 remote version；`SupabasePracticeRepository` 封裝版本化草稿保存、正式提交及歷史。UI 透過 Context + `useSyncExternalStore`；parser、grader、drawing engine 不知道 Supabase 存在，舊 repositories 留作歷史相容。

目前 cache key 為 `learnforge:attempt:v3:<user-id>:<attempt-id>`；草稿索引為 `learnforge:draft-index:v3:<user-id>:<quiz-id>`。v2 的 `learnforge:attempt:v2:<user-id>:<quiz-id>` 只在 remote UUID 相符時複製進 v3，遷移可重複執行，原 key 不刪；損壞內容保留 recovery 備份。若同一 UUID 的本機版本已提交、遠端仍是草稿，會先顯示待同步狀態，成功提交至雲端才開啟結果。不同帳號或 attempt 不能互覆，已提交的 cache 不可改寫。v0.1 未綁帳號的 `learnforge:attempt:v1:<quiz-id>` 仍需使用者明確確認匯入，原資料保留。

答案事件立即寫入本機，約 800ms 後批次同步至雲端；提交以 attempt UUID 和 server `updated_at` 做 CAS。只比較同一 UUID 的草稿時間，提交紀錄不被新草稿覆寫；衝突內容存 recovery 備份並顯示通知。Canvas 仍只保存筆畫模型，不上傳 PNG。斷網時目前載入的草稿可暫存在本機；雲端建立新草稿與提交需要連線。重新開始只刪除目前 draft，已提交歷史保留。其他分頁更新在下次同步或重新整理時合併；沒有 Realtime，也沒有逐題協同合併。 schema1 使用既有受控 writer；schema2 只透過 `save-quiz-draft`，不因錯誤 fallback 至 schema1/v3 writer。

`#/recovery` 預設只列目前帳號的備份 metadata，原始 JSON 須主動檢視或匯出。安全還原只允許有效 v3 備份、相同 user／attempt／revision、完全相同的雲端版本，而且目前本機及雲端草稿皆無答案；之後再次同步還會核對版本。Submitted、新版雲端、跨帳號或格式不明的備份只能匯出，不能偷偷覆寫。備份留在發生衝突的瀏覽器，刪除需確認。

## GitHub Pages notes

HashRouter 的 route 位於 `#` 後方，重新整理 `.../learnforge/#/quiz/demo` 不需伺服器處理巢狀路徑。Vite 預設 `base: '/'` 適合 root Pages site。

若是 project Pages site，例如 repository 名稱 `learnforge`，手動 build：

```sh
npm run build -- --base=/learnforge/
```

也可在 `vite.config.ts` 的 `defineConfig` 頂層設定 `base: '/你的-repository-name/'`。不要把 hash route 加進 base，且保留前後斜線。沒有假定 username 或 custom domain，未建立 `CNAME`。

Production Pages URL：[https://luketsengtw.github.io/learnforge/](https://luketsengtw.github.io/learnforge/)。**Settings → Pages → Source** 為 **GitHub Actions**；`.github/workflows/deploy.yml` 僅由 `workflow_dispatch` 手動觸發。初始 v1.4 production 部署為 SHA `dfe351a95bffd101148296c900e67ec342861881`、[Pages run 37248564582](https://github.com/LukeTsengTW/learnforge/actions/runs/37248564582)；驗證證據與 2026-10-05 closure preparation snapshot 見 [v1.4 交付文件](docs/v1.4-delivery.md)。歷史 v1.3 初始 cutover 為 SHA `8ef526583578c917526075e459ef76eea533741b`、Pages run `37090982945`；v1.3 契約與 v1.2 recovery lineage 保留於 [v1.3 交付文件](docs/v1.3-delivery.md)。

**Settings → Secrets and variables → Actions → Variables** 使用三個公開變數：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_TURNSTILE_SITE_KEY`。不要設定 server key；缺任一變數會停止 build。CI 在 pull request／master push 執行完整本機 gates；部署維持 `workflow_dispatch`，要求 `release_sha`、`release_version`，並核對 workflow、checkout、remote master 與 package version。Workflow 固定 Node 24.21.0／npm 11.19.0，包含 Edge import check 與 production dependency audit，核對 Pages base path 後 build 並產生公開 `release.json`。Checkout 不保留憑證；只有 deploy job 取得 pages:write / id-token:write。Push 不會自動部署；完整風險政策與指令見 [release process](docs/release-process.md)。

## Known limitations

- 題庫仍是 Git 內四個題庫、五個 bundled revisions；目前只有 `demo/v2-handwriting` 這個精確版本宣告 calculation handwriting，選用 schema2/v4。v0.8 編寫工具只提供本機編輯、預覽與匯出，沒有 CMS、多人協作或動態發布；移除舊 revision 檔會讓相應歷史只能顯示基本紀錄與分數快取。
- 錯題頁依序分頁載入提交並用 persisted grading evidence 重建結果；目前只列已載入頁的錯題，需按「載入更多」檢視較早紀錄。recovery 備份只在產生衝突的裝置上。
- 未同步的作答可能因清除瀏覽器資料而遺失；大量筆畫可能超過 localStorage 容量。斷電時尚未完成的一筆不會保存，undo/redo 不跨重新整理。
- 沒有 email delivery；Recovery Code 是 bearer secret，遺失密碼且沒有有效碼時無法自行恢復。
- 已載入草稿可離線暫存，但重新载入須連線驗證 session；不是離線 PWA。共用裝置應登出；未加密的本機 cache 可被有該瀏覽器存取權的人讀取。既發出的 JWT 在部分 Supabase API 仍可能有效到 expiry（目前 3600 秒），詳見 SECURITY.md。
- Server rate limiter 是基本保護，全域額度可能被濫用耗盡；production Turnstile public signup 已有實測證據，本輪未重新核實全部 server enforcement 設定。沒有多帳號 Sybil 防護或全球分散式 DDoS 保證。
- Canvas 工具可鍵盤操作，但畫圖本身仍需要 pointer 裝置；沒有純鍵盤繪圖或圖像內容的自動替代描述。
- v3/v4 AI grading 是學習參考，可能誤判；provider、raster 或 evidence validation 失敗時 attempt 保持草稿，需稍後重試。Calculation/drawing v3/v4 grading 使用 canonical rubric 與可見影像 evidence，不執行電路模擬、正式拓撲驗證或安全認證；目前沒有圖像品質 benchmark。圖像超過 1200×1200、256 筆畫、6000 點、25 百萬幾何像素工作量或 2 MB PNG 時不送模型。畫圖工具仍無純鍵盤繪圖能力。手寫辨識可能誤讀，不能當教師評分或考試準確度保證。
- Historical `deterministic-v1` 、`semantic-fill-v2`、`ai-grading-v3` 與 `ai-grading-v4` 結果不重新判定；舊版 calculation/drawing advisory 不改寫歷史正式分數。Tutor 與舊版 advisory 可能誤判，v3/v4 Result 不會因為重新載入而再次呼叫 AI。
- Markdown 支援 CommonMark 與 math，未加入 GFM table／task-list plugin、raw HTML 或 MathJax fallback。
- LaTeX 使用 KaTeX 支援的子集；長公式在區塊內水平捲動。
- 編寫器是純文字 textarea，沒有 syntax highlighting 或 WYSIWYG。Validation 對結構錯誤 fail-fast，品質提醒不驗證學術正確性。本機草稿只有一份且受瀏覽器儲存限制；清除瀏覽器資料會失去該草稿。
- 答案隨靜態題庫打包，localStorage 可由使用者修改；本產品是自主練習，不能當防作弊考試或可信成績系統。
- v0.9 分析只掃描最近 500 次提交；更早的正式結果不影響本版佇列。單題複習僅是暫時練習，重新整理後本次進度重置。沒有 AI mastery scoring 或正式能力排名。v0.2 的既有 warning 與歷史限制詳見當時的交付報告。

## 後續構想

發布後觀察實際使用規模、復原失敗、同步衝突與 rubric grading 品質，再評估備份保存政策、更細緻的同步合併、評分校準或分析時間窗。任何新功能另開 scope，不是 v1.3.0 的承諾。

後續可評估填空規則、rubric 品質與跨題型 AI grading 的可靠度及成本監測；不建立教師批改或人工覆核流程。AI 自動評分僅供學習參考。本版也不含一般 AI 聊天、admin dashboard、server-side quiz CMS、cloud image upload、leaderboard、social、PWA 或 SSR。

## 上游參考

- [Supabase Auth user data / profile triggers](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase changelog](https://supabase.com/changelog)

- [React Router HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter)
- [react-markdown（含 math 範例與 HTML 安全說明）](https://github.com/remarkjs/react-markdown)
- [Vitest getting started](https://vitest.dev/guide/)
- [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting)
