# LearnForge v0.1 implementation plan

## Initial inspection

- Clean Git working tree at `C:/learnforge`; inspected all source files, package scripts, TypeScript/Vite configuration, Oxlint configuration and existing README.
- Node 24.13.0, npm 11.14.1, Vite 8.3.1, React / React DOM 19.3.0, TypeScript 6.0.3.
- Context-mode resolves bundled npm 11.14.1. The project shell uses Node 24.13.0 and npm.cmd 11.6.2; its npm.ps1 wrapper is broken, so installation and shell commands use npm.cmd without changing the system.
- The template has Oxlint, no ESLint configuration or test runner, and no TypeScript `strict` setting. Keep Oxlint; add ESLint and Vitest, and enable strict checking.
- No applicable AGENTS.md or LearnForge-specific memory found.

## Design plan

- Paper `#ffffff`, workspace `#f4f7fa`, ink `#18334c`, secondary text `#52677b`, teal `#087e80`, rule `#dce5ed`.
- Headings and text use Segoe UI / Microsoft JhengHei / system sans; KaTeX supplies math typography. No remote font dependency.
- Left-aligned content with a 1080px maximum. A quiet circuit illustration identifies the subject; question numbers and progress convey actual learning position.
- Desktop: compact question navigator beside a continuous worksheet. Mobile: navigator above the worksheet, roomy full-width answer controls.

```text
Home                       Practice
brand         navigation   brand         navigation
intro       AND circuit    title / progress
demo quiz / start           question nav | question 1
what to expect                          | question 2 ...
                                        | submit
```

Review: avoid a generic dashboard with repeated feature cards. Use a single practice card, a circuit exercise illustration, and a worksheet layout. No gradients, decorative statistics or motion. Color is always accompanied by text.

## Implementation order

1. Domain unions, explicit section-based DSL, line-aware validation and pure deterministic grading.
2. Fixed logical drawing coordinates, stroke history and PNG export.
3. Versioned, validated local attempt persistence with immutable submissions.
4. Shared safe Markdown/KaTeX rendering, HashRouter pages, accessible responsive controls.
5. Parser / grading / drawing / persistence / UI tests and complete DSL documentation.
6. Actual lint, test and build gates, then browser flows at 360px, 768px and desktop.

No accounts, database, AI, credentials, uploads or future-version integrations.
