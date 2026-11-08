/**
 * Dev-only mock mode (`npm run dev:mock`): AI calls are canned and the history
 * is pre-populated, so the app can be used without an API key or spending
 * requests. Both conditions are compile-time constants, so production builds
 * drop every branch (and import) guarded by this flag. See DECISIONS.md.
 */
export const MOCK_MODE = import.meta.env.DEV && import.meta.env.MODE === 'mock'
