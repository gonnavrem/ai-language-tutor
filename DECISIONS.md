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

## M5 — Translation evaluation flow

**Evaluation categories are scored 1–5, not 1–10.** Coarser bands are
noticeably more consistent for an LLM rater than a 10-point scale, which
invites invented distinctions between e.g. a 6 and a 7 that aren't real.
The rubric judges intent/fidelity over literal word matching, per
CLAUDE.md's "judge overall meaning/intent the way a teacher would" —
full band-by-band criteria (kept here as the reference; the prompt itself
uses the compact one-line-per-category form in `evaluateTranslation.ts`
to keep per-call token cost down, since the user pays for it via their own
key):

1. **Meaning** (semantic fidelity/intent, no penalty for style): 5 =
   intention and all nuance intact; 4 = main meaning intact, a secondary
   nuance or minor emphasis lost; 3 = incomplete/distorted message — a
   relevant piece of information is missing or the pragmatic intent is
   altered, though the base idea is still recognizable; 2 = serious
   semantic error — inverted subject/object relation, wrongly
   added/omitted negation, or a critical false friend; 1 = unrecognizable,
   incomprehensible, or contradicts the original.
2. **Grammar** (morphosyntactic correctness in the target language,
   judged in isolation): 5 = flawless; 4 = one minor local error
   (agreement, article, preposition) that doesn't affect comprehension;
   3 = two minor errors, or one clear structural error (wrong tense/mood,
   anomalous word order), noticeable but understandable; 2 = multiple
   errors or serious structural failures that require rereading; 1 =
   severe syntactic breakdown.
3. **Naturalness** (fluency, collocations, idiomaticity — native-sounding
   vs. robotic calque): 5 = fully idiomatic; 4 = mostly natural, with a
   slightly rigid or infrequent turn of phrase; 3 = understandable but
   with an evident calque from the source language ("literal
   translation"); 2 = very forced, word combinations a native speaker
   would never use naturally; 1 = robotic, word-for-word, borders on
   absurd.
4. **Vocabulary** (lexical precision and register, judged in isolation —
   if a wrong term wrecks the overall meaning, that impact is scored
   under Meaning, not here): 5 = precise, varied, register-appropriate;
   4 = valid but generic or suboptimal word choice; 3 = evident lexical
   imprecision (term out of context or clearly wrong register); 2 =
   incorrect vocabulary or a repeated false friend; 1 = invented terms,
   wrong-language terms, or absurd choices.

**The overall score is computed client-side, never by the AI.**
`meaning×0.4 + grammar×0.25 + naturalness×0.2 + vocabulary×0.15`, capped
at `meaning + 0.5` and rounded to the nearest 0.5 (half-stars allowed for
overall; category scores stay strict integers) — see
`evaluationScore.ts`. Computing it in the app guarantees the weighting is
actually applied correctly, keeps the AI from having to do arithmetic,
and keeps `EvaluationResultSchema` — the AI's own output shape — down to
just the four integers plus `issues`/`alternatives`. The cap exists so a
translation with broken meaning can't score well overall just by being
grammatically clean: without it, `meaning=2` with everything else at 5
would weight out to 3.8; the cap pulls that down to 2.5.

**Evaluation only flags issues for a category scoring ≤3, and only skips
alternatives when all four categories are 5.** A 4 is a valid
translation with cosmetic room for improvement, not an error worth
frustrating the learner over — flagging it as an "issue" would
contradict the "judge intent, not literalism" principle above.

**No editing/resubmitting after evaluation.** Once `CurrentExercise.
evaluation` is set, the translation is locked — this is also what "solved"
means for the M4 discard-vs-persist rule (an exercise flushes to Dexie
only if `evaluation` is present). A "keep discussing this exercise"
follow-up mode is a plausible future feature but explicitly out of scope
here, so there's no in-between "evaluated but still editable" state to
design for.

**`submitEvaluation` has no request queue, unlike `requestExercise`.**
It doesn't touch the prefetch buffer or any other shared mutable state,
so the M4 queue's reason for existing doesn't apply. Concurrency is
instead handled by the UI simply disabling regenerate/level-select/submit
while any request (generation or evaluation) is in flight — cheaper than
merging queues or introducing response versioning for a race that a
disabled button already prevents.

**The in-progress translation draft is persisted into `CurrentExercise`
(localStorage), debounced ~300ms.** `CurrentExercise` already survives a
refresh (M4); letting the untimed draft survive one too is a small
extension of the same mechanism, not new infrastructure — worth it for
the quality-of-life win of not losing typed-but-unsubmitted work.

**Evaluation prompts don't take the exercise's level as input.** The
rubric judges translation quality in absolute terms; the level already
shaped the source sentence's difficulty during generation
(`generateExercise.ts`), so re-passing it to evaluation would be a
level-relative grading curve that CLAUDE.md's scoring criteria don't
call for.
