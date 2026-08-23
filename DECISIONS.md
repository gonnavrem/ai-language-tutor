# Design decisions

Why non-obvious choices were made, so they don't get re-litigated or
"fixed" back into a problem they already solved. Add an entry as soon as a
trade-off is settled, not batched at session end. Skip anything derivable
from the code. One tight paragraph per entry — no separate sections.

Starts at M3 — earlier milestones aren't retroactively documented.

---

## M3 — AI provider layer + BYOK settings UI

**Raw `fetch`, not provider SDKs.** Measured (real gzipped bundle) that
`@anthropic-ai/sdk` / `@google/genai` add meaningful weight for an app that
ships as a PWA/APK. The Custom OpenAI-compatible endpoint also needs a
generic HTTP path regardless. SDK retry/backoff was small enough to rebuild
(`src/lib/ai/http.ts`).

**Native structured-output falls back to prompt+Zod on a 400, not any
error.** JSON Schema can't express Zod refinements, so `schema.parse()` is
required either way — native mode is just a reliability upgrade. Gating the
fallback on 400 specifically keeps real failures (401, 500s) from being
silently swallowed as "no native support."

**Anthropic needs `anthropic-dangerous-direct-browser-access: true` on
every request.** Verified via `curl -X OPTIONS`: without it, CORS preflight
fails before the request reaches the API. Undocumented. Google/OpenAI need
no equivalent — don't remove this thinking it's dead code.

**Model field is free text + `<datalist>`, not a validated dropdown.**
Model catalogs churn too fast for a maintained allowlist — confirmed when
the doc-derived Google default (`gemini-2.5-flash-lite`) was already dead
for new accounts within the same session. Test Connection (a real call) is
the actual validator.

**API key field always requires re-typing to save; nothing cached in
state.** Simpler for a single-user app. The alternative (reuse the saved
key when the field's left blank) needs correct invalidation on
provider/preset switch — not worth it unless retyping becomes a real
annoyance.

**Web secure storage splits the device seed (localStorage) from the
ciphertext (IndexedDB).** Threat model per CLAUDE.md is casual
IndexedDB/backup inspection, not a compromised browser — splitting storage
backends raises that bar without a user-facing passphrase.

**`ProviderSettings` loads config via `useEffect`, not `useLiveQuery`.**
`SecureStorage` also backs onto the Capacitor Keychain, which has no Dexie
table to observe — a live query here would leak the web-only
implementation into a component that must also work natively.

## M4 — Exercise generation flow

**The current exercise lives in localStorage, not Dexie, until it's
superseded by the next one — not until it's solved.** An unsolved,
abandoned exercise is never written to `exercises`: it has no evaluative
value. A solved one stays in localStorage too and only flushes to Dexie
(`exercises` + `evaluations`, M5) when the user moves on to the next
exercise. One object shape covers both pending and solved (an optional
`evaluation` field added by M5) — there's no separate pending/solved
union, and the practice screen never reads Dexie to decide what to show.
Consequence, intentional: History (M6) won't list the exercise currently
on screen until the user has moved past it.

**There is a single generation entry point, `requestExercise(level)`,
used by both the regenerate button and the level selector.** Changing the
level immediately reloads the current exercise at the new level — there's
no reason to keep showing a sentence for a level the user just explicitly
left. Treating "regenerate" and "level changed" as the same operation
avoids two parallel code paths for what is the same intent.

**`requestExercise` commits only on success.** It generates the
replacement first; the old exercise (solved or not) is only flushed/
discarded once the new one has arrived. A failed request leaves the
screen showing exactly what it showed before, plus an inline error —
never a blank state. Flushing or discarding before the replacement is
confirmed would leave nothing to show on a failed request.

**A one-slot prefetch buffer is filled in the background right after
each exercise becomes current, keyed to its level.** Consuming it
(regenerate or level change, when the level matches) is instant; an
in-flight buffer fill is awaited rather than duplicated, so clicking
before it resolves still costs one call, not two. A level mismatch
discards the buffer outright. This shifts generation cost earlier in time
rather than duplicating it — steady-state cost is still one generation
call per exercise seen, plus exactly one wasted call at the end of each
session (the trailing unconsumed buffer) and one per level change made
while a buffer is warm. Accepted as negligible given the short
prompt/response and the cheap default models in `presets.ts`; revisit
only if a future preset defaults to an expensive model. Background fill
failures are silent — never surfaced as an error unless the user's own
consume attempt (buffer or fallback) also fails.

**Default level is `appConfig.levelSystem.levels[0]`, not a hardcoded id
like `'B1'`.** The level system is config-driven per CLAUDE.md — assuming
a CEFR id would break for any other level system the template is
reconfigured for.

**A localStorage entry that fails Zod `safeParse` is treated as empty,
not an error.** The stored shape can change across template versions; a
stale or corrupt entry should fall back to "nothing pending" (triggering
a fresh `requestExercise`) rather than crash the practice screen.

**No cross-tab sync for the current-exercise/buffer state (no `storage`
event listener).** Accepted limitation for a single-user local app —
don't add one later mistaking this for a bug.

**`requestExercise` calls are serialized through a module-level promise
queue, not left free-running.** Overlapping calls (initial-load racing a
fast level change, or two fast clicks) previously could interleave reads/
writes of the shared prefetch buffer, or resolve out of call order and let
a stale response overwrite newer state in `Practice`. Serializing means
generation cost is still one call per exercise seen — same as the buffer's
own design — just with in-order completion guaranteed instead of relying
on ad hoc sequence tokens in the component. The prefetch buffer also now
records the `providerId`/`model` it was generated with, not just the level:
provider settings can change between a background fill and its consumption,
and `CurrentExercise.aiProvider/aiModel` must reflect what actually
produced the sentence.
