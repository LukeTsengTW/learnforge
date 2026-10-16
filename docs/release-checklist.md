# Release checklist

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
