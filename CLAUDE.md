# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode
- `npx vitest run <path/to/file>` — run a single test file
- `npm run lint` — oxlint (fast Rust-based linter; this project does not use ESLint)
- `npm run format` / `npm run format:check` — Prettier (with `prettier-plugin-tailwindcss` for class sorting)

## Project scope

This is a **template**, not a multi-language product: each deployment is hard-configured for one fixed source→target language pair and one fixed level system (e.g. CEFR), defined in source under `src/config` rather than chosen at runtime. The reference instance being built in this repo is **English → Spanish, CEFR**. Adapting the template for a different pair means editing that config and rebuilding — there is intentionally no in-app language-pair picker. MVP scope covers Roman-alphabet language pairs only; other writing systems are out of scope for this template.

## Exercise pipeline (core domain logic)

1. The AI receives source language, target language, and a level, and returns a sentence written in the *source* language whose grammar/vocabulary is adapted to the target level. The grammar points being tested are included in the JSON response but hidden from the user (only the sentence is shown), to avoid biasing the translation attempt.
2. The user submits a translation into the target language.
3. The AI evaluates the translation: scores from 1–10 for meaning, grammar, naturalness, and vocabulary; concise explanations of any real issues; better alternative translations addressing those issues. Evaluation should judge overall meaning/intent the way a teacher would, not literal word-for-word matching — some flexibility in vocabulary and grammatical structure is expected and correct.

All exercises and evaluations are persisted locally (Dexie/IndexedDB) — this is a local-first app with no backend.

## AI provider architecture (BYOK)

Users bring their own API key for a provider of their choice. One `AIProvider` interface, three adapter implementations:

- **Anthropic** — native Messages API
- **Google** — native Gemini API
- **OpenAI-compatible** — generic adapter (base URL + model), used for OpenAI and DeepSeek presets, plus a "Custom" option for any other OpenAI-compatible endpoint

Structured AI responses (sentence generation, evaluation) are validated against Zod schemas rather than trusted as-is.

## Secure key storage

Platform-aware, deliberately no user-facing passphrase (friction was prioritized over maximal security for this low-value local secret):

- **Native (Capacitor)**: Capacitor Secure Storage → iOS Keychain / Android Keystore
- **Web/PWA**: Web Crypto AES-GCM, encryption key derived from a stable per-device value (not a user passphrase). This protects against casual inspection of IndexedDB/backups, not against a compromised browser — an accepted trade-off for a personal-use local app.

## Data layer

Dexie + `dexie-react-hooks` (`liveQuery`) only — no Redux/Zustand/TanStack Query. Keep it that way unless the AI-request lifecycle (loading/retry/cache) genuinely outgrows a small custom hook.

## Build milestones

- [x] M0 — Project scaffold (Vite/React/TS/Tailwind/Vitest/oxlint/Prettier/Capacitor init)
- [ ] M1 — Template config layer (fixed language pair + level system)
- [ ] M2 — Persistence layer (Dexie schema)
- [ ] M3 — AI provider layer + BYOK settings UI
- [ ] M4 — Exercise generation flow
- [ ] M5 — Translation evaluation flow
- [ ] M6 — History/review view
- [ ] M7 — Mobile packaging (Capacitor Android → APK)
- [ ] M8 — PWA packaging
