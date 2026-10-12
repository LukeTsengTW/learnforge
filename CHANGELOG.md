# Changelog

## 1.10.2 — 手寫筆畫取樣點精簡

Release candidate preparation：2026-10-12（Asia/Taipei）。基準 immutable v1.10.1（tag object `e382d9f5455b6f155582c8ea7de6649d1cee94ca`／peeled `e27ffdae2d0ce3d46c40143474bfcdd7e9bb38bb`）。變更與 release metadata 合併為單一 candidate commit；該 commit 的 SHA、push CI，以及之後 Pages／production acceptance 的 exact identities 由 post-commit report 記錄。這不是 closure 或 tag；本階段沒有存取或變更 production。

- 手寫筆畫在畫的當下精簡密集的指標取樣。先前每一個 pointer 事件都存成一個點，沒有任何篩選。現在一段連續的取樣若都落在「上一個保留點到最新取樣」這條線段的 0.5 個邏輯單位內、線段不超過 24 個邏輯單位，就只保留兩端；第一個不符合的取樣讓前一個取樣成為保留點。距離是到線段而不是到直線，所以折返的筆畫會保留折返點。
- 保存的點都是實際收到的取樣，順序不變；筆畫起於落筆點、止於抬筆點；每一個沒有保存的取樣距保存的筆畫不超過 0.5 個邏輯單位，也就是顯示、儲存與 rasterize 所用的那張圖的半個像素。相距超過 24 個邏輯單位的取樣照原樣保存，所以用少數事件畫出的筆畫與先前相同。
- 筆畫的最後一點永遠是最新的取樣，畫布顯示的就是當下會被保存的筆畫；v1.10.1 的「正式提交等於畫布上已完成的筆跡」不變。橡皮擦筆畫同樣處理。
- 沒有改變：每題 256 筆、6000 個取樣點的儲存上限與提示、drawing schema 與保存格式、正式提交與評分的流程、已經保存的圖。沒有題庫、generated canonical context、Edge function、migration、Auth／RLS／secrets／provider configuration 或 dependency delta；以 import graph 確認變更的路徑不在任何 Edge function 可到達的檔案內。全庫維持 9 revisions／7 current／103 questions／103 canonical contexts。
- 量測分兩種來源。合成的手寫模型（沒有實機錄製資料）：120 Hz 的觸控筆以一般速度寫 256 筆，取樣點由 11,565 降為 3,857（每筆約 45 → 15），原本 130 筆就到 6000 點，現在 256 筆都放得下；慢速書寫由 74 筆到 223 筆；以整數 CSS 像素回報的滑鼠為 1.3–1.8 倍。真實指標事件（Playwright 的滑鼠路徑，本機 fixture）：三條密集曲線 863 個取樣存成 77 點；單一 6,601 個取樣的筆畫存成 773 點，先前會被上限拒絕。0.5 與 24 這兩個數字是判斷，不是實機量測的結果。
- 256 筆的上限沒有改變，在多數模型情況下會變成先碰到的限制；提高它需要 migration，不在本次範圍。
- Local gates：100 files／1,593 tests 全部 PASS、零 skipped（新增 17 個）；lint／check:quizzes／check:ai-context／check:edge-imports／build／audit／diff-check 通過。新增與修改的測試檔配上 v1.10.1 的畫布為 4 failed／24 passed。Browser 證據使用本機受控 fixture，以真實指標事件比對收到的取樣、保存的筆畫與畫布像素。
- Classifier：security-ai／Risk C／providerCanaryRequired=false。沒有 provider canary，也沒有任何 provider 呼叫。
- 已知限制：沒有 iPad／Apple Pencil 實機驗證；效益數字來自模型與滑鼠路徑；AI 評分所見的圖可能在邊緣像素上與未精簡時不同，沒有比較過評分結果；已保存的圖不會被重新精簡。完整清單見 delivery。
- Package／lock root version 與 visible navigation label 準備為 1.10.2。調查、量測、驗證證據與尚待驗收項目見 [v1.10.2 delivery](docs/v1.10.2-delivery.md)。

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
