# LearnForge

**Current status: v0.4 — AI Tutor + rolling AI credit quota（程式碼；遠端部署狀態見 [v0.4 交付報告](docs/v0.4-delivery.md)）**。

LearnForge 讓學生透過選擇、填空、推導與繪圖整理理解。題庫使用可版本管理的 Quiz Markdown，提交後可查看客觀題成績、自己的答案、正確／參考答案、完整解答與評分規準。v0.2 建立 Username + Password、Supabase 與帳號隔離的本機 cache；v0.3 加入多題庫、每份題目的多次提交、練習紀錄與錯題回顧；v0.4 加入受題目與作答狀態限制的 AI Tutor。原本 parser、grading、drawing engine 與 Auth 架構保留。

## 功能

- 公開題庫目前有三份：原「數位邏輯與基礎數學」7 題、「布林代數基礎」7 題、「離散數學：關係」8 題。題庫卡片顯示科目、標籤、題數、自動評分總分與預估時間。
- 原範例共 7 題：2 單選、1 多選、1 是非、1 填空、1 計算、1 畫圖。
- 5 題客觀題自動評分，最高 **10 分**；計算題 6 分、畫圖題 4 分僅供自行對照，排除於自動分數與最高分。
- Markdown、inline／block LaTeX、提示切換、完整解答與 rubric。
- Canvas 畫筆、橡皮擦、黑／紅／藍、筆寬、復原／重做、確認清除、PNG 匯出。
- 每個帳號及題庫最多一份未完成草稿；可提交多次，每次有獨立 UUID。提交後在 UI 與資料庫鎖定；再次練習建立新草稿，已提交紀錄不刪除。
- `#/history` 以每頁 20 筆載入提交紀錄；`#/mistakes` 從歷次答案及當時的題目版本重新評分，列出答錯的客觀題。
- 註冊／登入／登出、session 恢復、自己的 profile、限流的密碼提示查詢。
- 未完成客觀題時先警告，再由使用者決定是否提交。
- HashRouter：公開 `#/`、`#/library` 及 Auth 頁；`#/quiz/:quizId`、`#/result/:attemptId`、`#/history`、`#/mistakes` 需要登入。舊 `#/result/:quizId` 連結導向該題庫最近一次已提交作答。
- 手機／平板／桌面排版、鍵盤可操作表單與畫布工具、文字狀態、可見 focus。
- AI Tutor：草稿可主動取得 AI 提示；提交後，答錯的客觀題可取得錯誤說明，非畫圖題可取得另一種解答說明。AI 僅供學習參考，以題庫答案與解析為主要依據。
- 每位已登入使用者有 5 小時滾動 20 credits；提示與錯誤說明各 1 credit，解答說明 2 credits。額度不足時隱藏相應操作，由 server 原子保留／完成／退還額度。

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

`.env.example` 僅列 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`，值為空白。從 Supabase project 的 Connect／API Keys 取得 project URL 與 `sb_publishable_…` key，填入 `.env.local`。缺少或錯誤設定會顯示 configuration error。只有 publishable client key 能放入 Vite；它會出現在公開 bundle 中。不要填入 server secret、service-role key 或 database password。`.env`、`.env.*` 均被 Git 忽略，只有 `.env.example` 例外。

AI Tutor 僅在 Supabase Edge Function 的 server environment 讀取 `OPENAI_API_KEY`。請透過 Supabase Dashboard 的 Edge Function Secrets 安全設定；不要寫入 `.env.local`、Vite 變數、GitHub Actions 公開變數、資料庫或原始碼。缺少 secret 時 Tutor 安全回傳服務暫不可用，且不保留額度。模型固定 `gpt-6-luna`，使用 Responses API、`reasoning.effort=low`、Structured Outputs、`store=false`；不啟用工具或一般聊天。

若 Windows 的 `npm.ps1` 出現 `Cannot find module ... npm-cli.js`，可改用同一套 Node.js 24.21.0 環境中的 `npm.cmd`，不必修改系統設定。

## 驗證指令

```sh
npm run lint
npm run test
npm run build
npm run preview
npm run generate:ai-context # 題庫 Markdown 更新後重新產生 server manifest
npm run check:ai-context    # CI/test/build 自動檢查 manifest drift
```

- `lint`：原有 Oxlint + ESLint，包含 TypeScript 與 React Hooks 檢查。
- `test`：Vitest 單次執行；`npm run test:watch` 啟動互動監看。
- `build`：`tsc -b` strict 型別檢查，再產生 production `dist/`。
- `preview`：預覽已產生的 production build。

測試包括 parser 的正常／錯誤案例、六種題型的評分、座標轉換、筆畫歷史、儲存資料驗證、提交鎖定、重新開始、完整 UI 流程與 Markdown 安全設定；不以 snapshot 代替行為驗證。Canvas 真實繪圖、PNG 像素與 RWD 另外透過瀏覽器驗證，jsdom 測試不假裝驗證 raster rendering。

## Project structure / Architecture

```text
src/
  models/                   # 純 TS：Question union、Quiz、Attempt、Grade、Drawing
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
  types/database.types.ts   # 從 linked project schema 產生，非手寫 row interfaces
  pages/                    # Home / Library / Quiz / Result / History / Mistakes / Auth
  styles/global.css         # base / layout / components / responsive layers
  App.tsx                   # HashRouter 與頁面組裝
  *.test.tsx, lib/*.test.ts # Vitest / Testing Library
.github/workflows/deploy.yml
docs/implementation-plan.md
docs/v0.1-delivery.md        # 歷史交付紀錄
docs/v0.2-delivery.md        # v0.2 歷史交付紀錄
docs/v0.3-delivery.md        # v0.3 實際驗證與限制
docs/v0.4-delivery.md        # v0.4 實際驗證與限制
scripts/generate-ai-quiz-context.mjs
scripts/ai-quiz-context.ts  # 使用既有 parser 的 manifest 投影與大小限制
supabase/
  config.toml
  migrations/               # 所有 schema / grants / RLS / RPC / triggers
  functions/password-hint/  # 既有公開密碼提示
  functions/ai-tutor/       # 已登入 Tutor request
  functions/ai-quota/       # 已登入 quota status
  functions/_shared/        # username 與生成的 server quiz context
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
                         pure reducer -> gradeQuiz()
                                    |
                        immutable submission -> Result
```

React component 不解析 raw DSL、不計算正確性。Parser 與 grading 不依賴 React。`Question` 使用六個明確分支，不以大量 optional properties 混用不同題型。`QuestionAnswer` 與 `QuestionGrade` 也是 discriminated unions；manual grade 的 score/maxScore 是 `null`。

## Supabase 與 Auth 架構

### AI Tutor 與額度（v0.4）

Browser 只送 `requestId`、`feature`、`attemptId`、`questionId`。Edge Function 用 `@supabase/server` 的 `auth: 'user'` 驗證身份，以 RLS-scoped client 讀取本人作答，再用 `quiz_id + quiz_revision + question_id` 精確查找生成的 canonical manifest。題庫仍只在 Git Markdown，沒有搬進 Supabase；題目與標準答案不能由 request 決定。生成器設有每題 32 KiB 上限及個別欄位限制，測試與 build 都會拒絕 stale manifest。

OpenAI 回應使用嚴格 JSON schema，文字透過既有安全 Markdown/KaTeX 元件顯示。草稿提示不傳標準答案或完整解答；提交後錯誤說明只對已判錯的客觀題開放，解答說明支援客觀題與計算題。畫圖內容不送至 OpenAI，也不顯示 AI 操作。學生答案視為不可信資料；Tutor 不是正式評分者。

`ai_requests` 啟用 RLS 且不授權 browser role。Edge 以 server privileged RPC 查額度、保留、完成與退還；`reserve_ai_request` 在 per-user transaction advisory lock 內計算最近 5 小時已完成與有效保留 credits，防止同時呼叫超額。保留 15 分鐘後可自動失效；同一 `requestId` 完成後重試回傳已保存結果，不再次呼叫 OpenAI。安全拒答已消耗 provider usage，記為完成；失敗、格式錯誤或未完成輸出會退還。Rolling 額度顯示 `nextCreditAt`，不宣稱有固定整批 reset 時間。

套用 v0.4 時先比對 linked migration list，執行 `npx supabase db push --linked --dry-run --skip-vault`，確認只有 v0.4 migration 後才使用 `npx supabase db push --linked --skip-vault --yes`。成功後重新執行 `npx supabase gen types typescript --linked --schema public` 更新 generated DB types，部署 `ai-tutor` 與 `ai-quota`，兩者都需 `verify_jwt=true`。`password-hint` 的既有設定維持不變。

`AuthProvider` 管理 session、loading、失敗狀態與帳號；頁面只呼叫 `AuthService`。Supabase SDK 持久化並自動更新 session；恢復時再呼叫 `getUser()` 驗證，讀取自己的 profile。失效 token 清除本機 session 並回到登入；短暫斷網且尚未到期的 session 可繼續使用帳號隔離的 cache。要求有 15 秒 timeout，失敗不會直接刪除作答。

畫面只有 Username／Password，不顯示 Email 欄位。`normalizeUsername()` trim + lowercase；`validateUsername()` 使用 `^[a-z0-9_]{3,24}$`；`usernameToSyntheticEmail()` 得到 `<username>@users.learnforge.invalid`。例如 ` LuKe_123 ` → `luke_123` → `luke_123@users.learnforge.invalid`。這是 Auth 的內部識別，不是可收信地址。

註冊先驗證名稱、至少 8 字元密碼、確認密碼、1–200 字元提示，再將密碼直接交給 Supabase Auth。密碼不放進 metadata、application tables、logs 或 localStorage。`auth.users` INSERT trigger 以 `NEW.id` 原子建立 profile 與 hint，檢查 normalized username、synthetic email 一致性，不接受使用者指定另一個 UUID。Trigger 使用固定空 `search_path`、完整限定名稱、撤銷 PUBLIC execute。

**專案需啟用 Email provider／signup，關閉 Confirm email**，否則 synthetic email 無法收確認信，也無法立即建立 session。linked demo 已確認 `mailer_autoconfirm=true`。本機 config 的 minimum password length 是 8；另請在遠端 Auth password policy 設至少 8（前端已強制 8）。沒有 email reset、帳號改名或密碼重設功能。

公開首頁與 `#/library`；保護 Quiz、Result、History、Mistakes，未登入會導向 `#/login` 並保存原目的地。只允許 app 內受保護路徑作 redirect，避免外站跳轉或登入迴圈。header 顯示 normalized username／登出；logout 清除本機 session，保留該帳號的作答 cache，其他帳號不會自動套用。

### Schema / RLS / grants

| Table | 內容與約束 | Client grant 與 RLS |
|---|---|---|
| `profiles` | PK `id` → `auth.users` cascade；唯一且格式受限的 username；timestamps | authenticated 只 SELECT 自己；無 client 寫入 |
| `password_hints` | PK `user_id` → `auth.users` cascade；trim 後 1–200 字元；timestamps | anon／authenticated 全部撤權；無一般讀取 policy |
| `attempts` | UUID、user、quiz／revision、draft/submitted、時間、分數 cache；只有 draft 有 `(user_id,quiz_id)` 部分唯一索引；提交紀錄有排序索引 | authenticated 可讀自己的紀錄、建立／修改／刪除自己的 draft；已提交紀錄不得修改或刪除 |
| `answers` | UUID、JSONB answer／可選 grade；唯一 `(attempt_id,question_id)`；複合 FK `(attempt_id,user_id)`；user index | 自己 + parent attempt 也是自己；提交後不得直接改／刪答案；restart 刪 parent 才 cascade |
| `private.hint_rate_limits` | durable fixed-window counters | 非 API schema；RLS；僅 service_role server 存取 |

所有表啟用 RLS；user-owned policy 明確檢查 `(select auth.uid()) IS NOT NULL`。anon 沒有 application table 權限。v0.3 的 `get_or_create_quiz_draft` 與 `save_quiz_attempt_v3` 僅授權 authenticated，皆為 **security invoker**；前者以 transaction advisory lock 和部分唯一索引保證同題庫只有一份草稿，後者依 attempt UUID、owner 與 server `updated_at` 做 CAS，原子更新 header 與 answers。舊 `save_quiz_attempt` 的 authenticated EXECUTE 已撤銷。提交鎖定 trigger 與 answer parent row lock 防止並行變更穿過提交界線。分數只是 client cache，載入後以對應題目版本重新 deterministic grading，不能當正式可信成績。

### 密碼提示 Edge Function

`#/forgot-password` 明示「LearnForge Demo 目前僅提供密碼提示，無法重設遺失的密碼。」這不是 password reset。提示可由知道 username 的人查詢，請勿放密碼或敏感個資。

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
npx supabase db query --linked --file supabase/tests/security.sql
npx supabase db advisors --linked --type security --fail-on error
```

PowerShell 請用 `npx.cmd`；generated types 可透過 `| Out-File -Encoding utf8 src/types/database.types.ts` 保存。CLI credential／database password 只供 CLI 安全輸入，不能放進 Vite。`.temp` 連結資訊不進 Git。需要完整本機 Supabase 時，可使用已安裝 Docker 的環境執行 `npx supabase start`；本次使用 linked development project，沒有宣稱驗證 Docker stack。

Migration：`20260925031723_v02_foundation.sql` 建 schema；`20260925033026_v02_owner_binding.sql` 補帳號綁定；`20260925054652_v03_practice_history.sql` 移除全域 user+quiz 唯一約束，加入草稿部分唯一索引、歷史索引、新 RPC 與 RLS；`20260925060343_v03_answer_lock_visibility.sql` 讓提交後答案的鎖定 trigger 仍能看見 parent row。舊 attempts、answers、UUID 與 Auth users 原地保留。新增變更先 `npx supabase migration new <name>`；不要對 linked project 執行 reset、truncate、migration repair 或刪除 Auth users。`security.sql` 建立測試 fixture 後完整 rollback。

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
- `:::options` 僅用於 single／multiple；`:::answer` 用於其餘題型；`:::drawing` 僅用於 drawing 且必填。
- 題目之間只能有空白行。未知屬性、未知區塊、題型不適用的區塊與缺少結尾均報錯，不默默忽略。
- 正常 Markdown 支援標題、段落、列表、引用、連結、程式碼及數學。Markdown code fence（至少 3 個反引號或波浪號）中的 directive 會保留為文字；未關閉的 fence 報錯。要在 prose 中展示 directive，請放入 code fence。

### 六種題型

| `type` | 額外內容 | 正確性／參考答案 |
| --- | --- | --- |
| `single` | `:::options`，至少 2 個選項 | 恰好 1 個 `[x]` |
| `multiple` | `:::options`，至少 2 個選項 | 至少 1 個 `[x]` |
| `true-false` | `:::answer` | 必須為小寫 `true` 或 `false` |
| `fill` | `match="exact"` 或 `match="case-insensitive"`、`:::answer` | 一行非空白答案 |
| `calculation` | `:::answer` | Markdown 參考答案；不自動評分 |
| `drawing` | `:::answer`、`:::drawing` | Markdown 文字參考；不自動評分 |

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

- drawing 必須恰有 `width`、`height` 兩個設定，`key=integer`，各為 100–2000 的整數；不接受重複 key、未知 key、小數或缺值。
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

直接閱讀 [原 demo 的 v1 題庫](src/content/quizzes/demo/v1.quiz.md)、[布林代數](src/content/quizzes/boolean-algebra/v1.quiz.md) 與[離散數學：關係](src/content/quizzes/relations/v1.quiz.md)。`quiz-loader.ts` 使用 typed `import.meta.glob` 匯入所有 `src/content/quizzes/**/*.quiz.md`，建立版本感知的 catalog；解析失敗附檔名／行號，其他有效題庫仍可使用。重複 id+revision 或多個 current 等識別歧義會在測試與載入時明確報錯。題目不放進 Supabase。

## Grading 規則

- `gradeSingleChoice()`：唯一 option id 完全相同才得全分。
- `gradeMultipleChoice()`：去重為集合後，元素與正確答案集合必須完全相同。少選、多選都是 0 分，無部分給分。
- `gradeTrueFalse()`：boolean 嚴格相等；`false` 是有效作答。
- `gradeFillBlank()`：依指定策略評分，空白答案視為未作答。
- `gradeQuiz()`：回傳每題狀態及 score/maxScore/correctCount/incorrectCount/unansweredCount/manualCount。
- 客觀題狀態互斥：correct／incorrect／unanswered，未作答得 0 分。
- 計算與畫圖永遠為 manual，無論是否作答，均排除於 deterministic score、maxScore 與三個客觀題計數。

## Canvas 設計

每題定義固定 logical resolution（demo 為 800 × 600），直接設定 Canvas `width`／`height`。CSS 只調整顯示寬度且保持長寬比；繪圖前用 `(clientX - rect.left) * logicalWidth / rect.width` 換算座標，Y 軸同理並 clamp 範圍，邊框位於外層元素，不干擾座標。

Pointer Events + pointer capture 支援滑鼠、手指與觸控筆；`touch-action: none` 僅限畫布。每筆存 `tool/color/width/points`；筆寬也是 logical units。重繪與螢幕尺寸無關，橡皮擦使用 `destination-out`。復原／重做操作 stroke history，新筆畫清除 redo；清除需確認，清除後不可復原。只持久化已完成的 strokes，進行中的 pointer 與 undo/redo 不存入 localStorage。

`exportDrawingPng()` 以 logical resolution 重播至離屏 Canvas、補上不透明白底並回傳 PNG Blob；`downloadDrawingPng()` 本機下載，不上傳。結果畫布是唯讀。純工具測試座標／history，實際 Canvas 與 PNG 在瀏覽器驗證。

## Attempt repository 與 local/cloud synchronization

Domain `QuizAttempt` 仍維持 schemaVersion 1、quiz id/revision、typed answers、時間、in-progress/submitted 與結果，未塞入資料庫欄位。v0.3 以獨立的 `PracticeRecord` 綁定 attempt UUID、remote version、exact quiz revision；`SupabasePracticeRepository` 集中封裝草稿、提交、刪草稿、精確結果與分頁歷史。UI 透過 Context + `useSyncExternalStore`；parser、grader、drawing engine 不知道 Supabase 存在。v0.2 的 `AttemptRepository`、`LocalAttemptRepository` 與 `SupabaseAttemptRepository` 保留供舊資料相容。

目前 cache key 為 `learnforge:attempt:v3:<user-id>:<attempt-id>`；草稿索引為 `learnforge:draft-index:v3:<user-id>:<quiz-id>`。v2 的 `learnforge:attempt:v2:<user-id>:<quiz-id>` 只在 remote UUID 相符時複製進 v3，遷移可重複執行，原 key 不刪；損壞內容保留 recovery 備份。若同一 UUID 的本機版本已提交、遠端仍是草稿，會先顯示待同步狀態，成功提交至雲端才開啟結果。不同帳號或 attempt 不能互覆，已提交的 cache 不可改寫。v0.1 未綁帳號的 `learnforge:attempt:v1:<quiz-id>` 仍需使用者明確確認匯入，原資料保留。

答案事件立即寫入本機，約 800ms 後批次同步至雲端；提交以 attempt UUID 和 server `updated_at` 做 CAS。只比較同一 UUID 的草稿時間，提交紀錄不被新草稿覆寫；衝突內容存 recovery 備份並顯示通知。Canvas 仍只保存筆畫模型，不上傳 PNG。斷網時目前載入的草稿可暫存在本機；雲端建立新草稿與提交需要連線。重新開始只刪除目前 draft，已提交歷史保留。其他分頁更新在下次同步或重新整理時合併；沒有 Realtime，也沒有逐題協同合併。

## GitHub Pages notes

HashRouter 的 route 位於 `#` 後方，重新整理 `.../learnforge/#/quiz/demo` 不需伺服器處理巢狀路徑。Vite 預設 `base: '/'` 適合 root Pages site。

若是 project Pages site，例如 repository 名稱 `learnforge`，手動 build：

```sh
npm run build -- --base=/learnforge/
```

也可在 `vite.config.ts` 的 `defineConfig` 頂層設定 `base: '/你的-repository-name/'`。不要把 hash route 加進 base，且保留前後斜線。沒有假定 username 或 custom domain，未建立 `CNAME`。

已提供手動觸發的 `.github/workflows/deploy.yml`：

1. 把 repository 推上 GitHub，至 **Settings → Pages → Source** 選擇 **GitHub Actions**。
2. 至 **Settings → Secrets and variables → Actions → Variables** 設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`（公開 client configuration）。不要設定 server key。
3. 至 **Actions → Deploy LearnForge to GitHub Pages → Run workflow**。
4. Workflow 執行 npm ci、lint、test，再使用 `configure-pages` 輸出的 `base_path` build，最後上傳並部署 `dist/`。

不硬編 username、repository name 或分支名稱。本次部署 Supabase schema／Function，沒有發布 GitHub Pages；是否啟用 push 自動部署由 repository 管理者另行設定。

## Known limitations

- 題庫仍是 Git 內的三份 bundled Markdown，沒有題庫編輯器、管理後台或動態發布；移除舊 revision 檔會讓相應歷史只能顯示基本紀錄與分數快取。
- 錯題頁依序分頁讀取提交作答並重新評分；目前只列已載入頁的錯題，需按「載入更多」檢視較早紀錄。recovery 備份只在產生衝突的裝置上，沒有可視化 recovery UI。
- 未同步的作答可能因清除瀏覽器資料而遺失；大量筆畫可能超過 localStorage 容量。斷電時尚未完成的一筆不會保存，undo/redo 不跨重新整理。
- 沒有 password reset／email delivery。遺失密碼且提示無法協助時無法自行恢復；只適合 demo 使用。
- offline fallback 需頁面已載入，不是離線 PWA；過期 session 需連線重新登入。共用裝置應登出；未加密的本機 cache 可被有該瀏覽器存取權的人讀取。
- Server rate limiter 是基本保護，可能被濫用耗盡全域額度；正式開放前需補帳號復原、註冊 CAPTCHA／配額及持續監測。
- Canvas 工具可鍵盤操作，但畫圖本身仍需要 pointer 裝置；沒有純鍵盤繪圖或圖像內容的自動替代描述。
- 計算／畫圖不自動判分。手動題清空或擦除後是否還有可見內容，不做 pixel 分析。
- Markdown 支援 CommonMark 與 math，未加入 GFM table／task-list plugin、raw HTML 或 MathJax fallback。
- LaTeX 使用 KaTeX 支援的子集；長公式在區塊內水平捲動。
- 答案隨靜態題庫打包，localStorage 可由使用者修改；本產品是自主練習，不能當防作弊考試或可信成績系統。
- 沒有單題重練、跨題庫分析或 mastery scoring。v0.2 的既有 warning 與歷史限制詳見當時的交付報告。

## Future roadmap

下一個 milestone 建議 **v0.5 帳號復原與同步可靠性**：建立可驗證的帳號復原方式、CAPTCHA／註冊防濫用、recovery UI、較完整的多裝置衝突測試與備份政策，再評估學習分析。

後續可分階段評估 regex／numeric tolerance、計算題參考評分、畫圖 multimodal 分析與更細緻的成本監測。AI 不影響正式答案。本版也不含一般 AI 聊天、admin dashboard、quiz editor、cloud image upload、leaderboard、social、PWA 或 SSR。

## 上游參考

- [Supabase Auth user data / profile triggers](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase changelog](https://supabase.com/changelog)

- [React Router HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter)
- [react-markdown（含 math 範例與 HTML 安全說明）](https://github.com/remarkjs/react-markdown)
- [Vitest getting started](https://vitest.dev/guide/)
- [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting)
