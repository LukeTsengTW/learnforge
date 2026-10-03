# Release checklist

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
