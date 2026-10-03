# Privacy and data handling

本文件描述已實作的 LearnForge v1.3 production 行為，不宣稱法律合規、零 retention 或 GDPR、HIPAA、FERPA 認證。

## What is stored

| 資料 | 位置與用途 |
|---|---|
| Username / internal synthetic email | Supabase Auth/profile identity；internal address 不可收信，不作為聯絡地址 |
| Password | 透過 HTTPS 直接交給 Supabase Auth；application tables/logs 不保存 |
| Password hint | Private table，透過限流的公開 username lookup 回傳；請勿放個資或敏感資訊 |
| schema1/schema2 attempts and answers | Account-scoped Supabase tables，保存 exact quiz/revision、schema、submission state、timestamps、grades 與 judgments |
| Calculation text / drawing strokes | schema2 可同時保留文字與筆畫 buffer；選取的 mode 決定 active grading evidence。完成的 vector strokes 保存於答案及帳號隔離的 local cache，不是上傳圖片庫 |
| AI / formal grading ledgers | Validated structured responses、request/model/feature、credit state、provider metadata、usage/timing；formal system ledger 與 personal Tutor ledger 分開 |
| Recovery hash / state | Private SHA-256 digest、建立／使用時間與短期 claim metadata；不保存 raw recovery code |
| Rate-limit buckets | Username、hashed IP、時間與計數；recovery 於後續要求清理過期 buckets |
| Browser localStorage | SDK session、帳號隔離的 practice cache／recovery backups、legacy practice data 與 local authoring draft，未加密 |

Raw recovery code 只顯示一次，短暫存在頁面/runtime 記憶體；只有主動 Copy／Download 才寫到 clipboard／下載檔，使用者自行保存的副本不受 application storage controls 管理。

## External processing

Supabase 處理 Auth、database 與 Edge requests；platform operational logs 可能含 IP/network metadata 與 endpoint activity。Production Turnstile public client configuration 已存在，真實公開 signup 已在 v1.3 release flow 驗證；Cloudflare 處理 challenge/network 資料以評估濫用。本輪未重讀 server CAPTCHA 設定或重跑 negative-token／recovery tests，enforcement 證據範圍見 [Security](../SECURITY.md)。

Tutor 要求由使用者明確按 AI 提示／解釋等功能觸發。**正式 grading 可由使用者按「提交測驗」觸發 OpenAI，不需要另按 AI 按鈕。** Server 只傳該功能所需的 active answer、canonical question/reference/rubric 與分析 context；browser 不能任選模型或 prompt。

v4 文字計算傳 active text 與相關 context；手寫計算由 server 驗證並 rasterize **active drawing** 後傳圖像與 canonical calculation rubric。Inactive calculation buffer 保留在答案資料中，但不作 grading input。Generic DrawingQuestion 的分析／正式 grading 是另一條路徑，亦使用 server-rendered raster，不接受任意 browser PNG。Passwords、recovery codes、session credentials 不是 AI context。

Formal submission grading 與 personal Tutor credit usage 分離；空白/system/rule evidence 不需要 provider。已保存的 Result/History/Analytics evidence 讀取不重新呼叫評分模型。

AI calls 使用 `store=false`，不代表 provider 零 retention；provider terms 與 account settings 仍影響其處理方式。沒有另加 analytics/marketing SDK；靜態 hosting 與平台服務仍可能保留 operational logs。

## Retention, access and limitations

Submitted attempts 與已完成 AI evidence 保留在 Supabase；沒有自動 account/data-retention job 或 self-service account deletion UI。Release canary data 保留，清理需要另行明確授權。敏感資料問題請透過 repository 的私密 security/advisory 管道聯絡維護者，不把秘密或答案貼進公開 issue。

Browser 存取 application records 受本人 ownership 與 RLS 檢查；schema1 使用既有受控保存流程，schema2 寫入由 server v4 邊界處理。具 server 權限的管理者仍可存取。Recovery UI 隔離目前帳號，不能防止 XSS、extension 或他人存取同一 browser profile 的底層 localStorage。Logout 保留練習 cache；清除 storage 前應先保存需要的 backups，匯出 JSON 可能包含所有答案與筆畫。

本平台用於自願自主練習。請勿在答案、畫圖、password hints 或 authoring content 輸入 confidential、regulated 或可識別個人的資料。AI 可能誤讀手寫或判錯，須由人判斷；不是教師評分或考試準確度保證。
