# Language Tutor

A local-first, BYOK AI translation-practice app. The AI generates a level-adapted
sentence in the source language, the user translates it into the target
language, and the AI evaluates the translation on meaning, grammar,
naturalness, and vocabulary — with scores, issue explanations, and better
alternatives.

This is a **template**: each deployment is fixed to one source→target
language pair and one level system, configured in source (see
`src/config`). The reference instance configured here is **English → Spanish
(CEFR)**.

## Stack

React + TypeScript + Vite, Tailwind CSS v4, Zod, Dexie (local persistence),
Capacitor (Android/iOS packaging), React Router.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run test` / `npm run test:watch` — run tests with Vitest
- `npm run lint` — lint with oxlint
- `npm run format` / `npm run format:check` — format with Prettier
