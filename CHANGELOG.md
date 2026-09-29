# Changelog

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
