# Security

LearnForge v1.3 是自主練習平台，不是教師評分、防作弊考試或可信成績系統。標準答案隨靜態題庫打包；localStorage 與 client cache 可被修改。正式 `ai-grading-v3`／`ai-grading-v4` 的分數採 server 驗證後保存的 judgments；AI 自動評分僅供學習參考，可能存在誤判。

## Reporting a vulnerability

請透過 repository 的 GitHub Security Advisory 私下聯絡維護者。Private reporting 是否開放尚未確認；若沒有入口，先向維護者索取私密管道，不公開 exploit 細節。沒有另設或虛構 support email。Issue、截圖與 logs 不得包含密碼、復原碼、API key、JWT、私人答案或 production 原始紀錄。

## Account and recovery boundaries

- Username 對應不可收信的 internal synthetic email；沒有 email-reset flow。密碼提示是可公開查詢的記憶輔助，不能放敏感資訊。
- Recovery Code 使用 128-bit 隨機值；private table 只保存 SHA-256 hash。原碼只顯示一次，Copy／Download 需使用者主動操作；持有有效碼即可重設帳號密碼，應比照密碼保護。
- Rotation 立即撤銷舊碼。Recovery 使用 `active / claiming / used`、五分鐘 claim TTL 與 Auth 密碼交易中的 deferred trigger；claim RPC 與 Auth HTTP 請求仍是分開的交易。過期、撤銷、重播或延遲寫入應 rollback。
- 此 fence 依賴 Supabase Auth 在同一 PostgreSQL 交易保存密碼與 app metadata。v1.0 曾實測；Auth 升級需另跑 SQL fixture 與 live recovery E2E，不能把不確定回應當成功。
- Recovery 撤銷 database sessions，session restore 也檢查 session ID；已發出的 access JWT 在部分其他 Supabase API 仍可能有效至 expiry，既有基線為一小時，不是立即全面撤銷保證。
- 修改密碼須重新驗證目前密碼並傳 `current_password`；既有部署曾確認 server enforcement。Client 新密碼限制至少 8 字元、至多 72 UTF-8 bytes；本輪不修改或重測 Auth policy。

## Browser and database threat model

Browser 只可存取自己的 RLS-protected application data。Recovery、hints、rate limits 與 AI ledgers 保持 server-only；不要為消除 advisor INFO 而放寬 policy。Privileged RPC 使用固定 search path 與明確 grants，service credentials 不進 browser。

LocalStorage 包含 SDK session、帳號隔離的答案／筆畫與 conflict backups，沒有加密。XSS、惡意 extension 或能使用同一 browser profile 的人可以讀取；logout 清除 session，刻意保留練習 cache。清除 browser storage 可能遺失未同步資料。Owner checks 防止意外混用帳號，不能修補已遭入侵的 browser。

Practice sync 使用 owner／attempt／exact revision／updated_at CAS 與 submission locks；衝突採整份 attempt 選擇，不是協作合併。Backup 只可還原至同 owner/revision、版本未改且空白的草稿，不能覆寫 submitted 或較新雲端資料。

### v3 / v4 formal authority

正式提交只送 `requestId`、`attemptId`、`expectedUpdatedAt`。Server 載入本人草稿、已保存答案及 **精確題目版本**；browser 不能指定 grading version、模型、prompt、canonical answer、rubric、分數或 answer hash。非 v4-capable schema1 新提交用 v3；schema2 用 v4。Canonical criteria、分數上限、各項與總分驗證完成後才原子 finalize；缺少可信 evidence 或 provider/raster 失敗時保留草稿。

schema2 草稿經 authenticated `save-quiz-draft`：平台 `verify_jwt=true`，handler 亦驗證 user context、ownership、exact revision、answer shape 與 CAS，再呼叫 service-only `save_quiz_attempt_v4`。Browser 不可直接 promote/finalize authoritative v4 state；schema2 save 失敗沒有 v3 writer fallback。其他五個 rollout handlers 保留已驗證的 `verify_jwt=false` 與 handler user authentication。

### Active-mode and server-raster boundaries

schema2 `CalculationAnswerV4` 保留 `type / mode / text / strokes`。文字與筆畫兩個 buffer 不因切換被刪除；grading identity 與 input 只使用 active buffer：drawing mode 排除 inactive text，text mode 排除 inactive strokes。

手寫計算先驗證儲存的 strokes，由 server 重建 active drawing raster；browser PNG、截圖或任意圖像不能作為正式 grading authority。此題仍走 **calculation rubric/provider path**，不是 generic DrawingQuestion analysis。DrawingQuestion 的畫圖 grading 保持不同路徑。可見空白由 server raster 判定；`raster_blank` 可保存 system unanswered evidence／私有 ledger bookkeeping，不代表已執行 provider。

正式 v3/v4 grading 使用私有 system ledger，不扣 personal Tutor credits。Submitted evidence 鎖定；Result、History、Analytics 依 persisted version／exact revision 重建，不因重開而回放 provider，也不默默重評歷史。詳見 [v1.3 delivery](docs/v1.3-delivery.md)。

## Abuse controls

| Surface | 既有界線 |
|---|---|
| Auth signup/sign-in | 既有遠端基線 30 requests / 5 min / IP；本輪未重讀平台 rate-limit 設定 |
| Password hint | Username 3、IP hash 10、global 100 / 15 min |
| Recovery | Username 5、IP hash 20、global 200 / 30 min；429 + Retry-After |
| AI Tutor | 20 personal credits / rolling 5h / account |
| v3/v4 formal rubric grading | Private rubric-judge ledger、既有 per-attempt／per-user claims；不扣 personal credits |

Forwarded IP 不是可信身份；變換 IP 時仍有 global bounds，但攻擊者可能耗盡共同額度。Per-account quota 不能防止多帳號濫用，也沒有 DDoS／Sybil resistance 保證；本輪沒有新增限額。

### Turnstile production evidence

Production frontend 已包含 Turnstile site configuration；2026-10-03 的 v1.3 release evidence 記錄過真實 public signup 成功，沒有 CAPTCHA bypass。Client signup/login 把 token 交給原生 Auth，Recovery server 驗證 Siteverify success、action 與 hostname，缺 secret 預設 fail closed。v1.0 Final Gate 另記錄過 native Auth／recovery 的 missing/invalid-token 拒絕及 development bypass 移除。

本輪只重新確認 production bundle 的公開設定、client 中沒有 development bypass，以及既有 signup 證據；未重新讀取遠端 Auth CAPTCHA／recovery bypass 配置，也沒有再做 negative-token 或 recovery E2E。Positive signup 不等於全部 enforcement 已重新驗證。不得以 `RECOVERY_ALLOW_NO_CAPTCHA` 開發例外作為 production 保證，或留下「CAPTCHA 尚未設定、不能公開註冊」的舊版說法。

Accepted security advisor baseline 為 ERROR 0 / WARN 1 / INFO 9，保留 leaked-password protection warning。本輪不修正 warning、不升級方案；歷史文件的 Free plan 說明不等同重新確認目前方案能力。

## Production configuration

只有 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_TURNSTILE_SITE_KEY` 是 frontend configuration。`OPENAI_API_KEY`、service-role/secret keys、DB credentials、`TURNSTILE_SECRET_KEY` 不得進 Vite、Git、公用 workflow variables 或文件。

Production HTML 使用沒有 `unsafe-eval` 的 CSP 與 strict-origin-when-cross-origin referrer policy。KaTeX/UI 仍允許 inline styles；GitHub Pages 無法任意設定 response headers，meta CSP 不能 enforce frame-ancestors 或取代 HSTS。Markdown raw HTML 關閉、KaTeX trust=false；沒有第三方 analytics SDK。

UI 錯誤使用固定訊息；不記錄 credentials、raw recovery code、私人答案或原始 provider errors。Auth/Edge operational logs 與 provider processing 仍存在，見 [privacy](docs/privacy.md)。發布 evidence 與未驗證限制不是安全認證。
